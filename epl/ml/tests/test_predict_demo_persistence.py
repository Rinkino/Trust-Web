import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from eplpred.demo import eligible_hash, select_three, verify_run
from eplpred.features import build_features
from eplpred.predict import composite, eligible_fixtures, predict_live
from eplpred.upload import Writer, clean_rows

ROOT = Path(__file__).resolve().parents[3]


def _with_schedule(league):
    now = datetime(2024, 1, 10, tzinfo=timezone.utc)
    last9 = league[league.season == "2023-24"].tail(9).match_id
    hist = league[~league.match_id.isin(last9)].copy()
    sched = league[league.match_id.isin(last9)].copy()
    sched["status"] = "scheduled"
    sched["match_date"] = [pd.Timestamp("2024-01-12")] * 3 + [pd.Timestamp("2024-01-05")] * 3 + [pd.Timestamp("2024-03-30")] * 3
    sched["kickoff_utc"] = sched.match_date.dt.tz_localize("UTC") + pd.Timedelta(hours=15)
    for c in ["fthg", "ftag", "hs", "as"]:
        sched[c] = pd.NA
    for c in ["fthg", "ftag", "hs", "as"]:
        sched[c] = sched[c].astype("Float64")
    m = pd.concat([hist, sched]).sort_values(["match_date", "match_id"]).reset_index(drop=True)
    return m, now


def test_eligible_fixtures_exclude_completed_past_and_far_future(league):
    m, now = _with_schedule(league)
    e = eligible_fixtures(m, now, horizon_days=21)
    assert len(e) == 3
    assert (e.status == "scheduled").all() and (e.kickoff_utc > now).all()


def test_live_prediction_uses_selected_models_and_records_attribution(league):
    m, now = _with_schedule(league)
    data = m.set_index("match_id").join(build_features(m))
    selection = {"goals_home": "poisson_strength", "goals_away": "poisson_strength", "outcome": "baseline",
                 "corners_total": "team_avg"}
    preds, info = predict_live(data, {"poisson_strength": {"halflife_days": 240.0, "l2": 2.0}, "baseline": {}, "team_avg": {}},
                               selection, now=now)
    assert info["eligible"] == 3 and len(preds) == 3
    for p in preds:
        assert p["target_models"]["goals_home"] == "poisson_strength"
        assert p["target_models"]["outcome"] == "baseline"
        assert np.isclose(sum(p["values"]["outcome"]), 1.0, atol=1e-3)
        assert set(p["per_model"]) == {"poisson_strength", "baseline", "team_avg"}


def test_composite_takes_each_target_from_its_model():
    vals = {"a": {"goals_home": {"mean": 1}, "top_scorelines": [[1, 0, 0.1]]}, "b": {"goals_home": {"mean": 2}, "btts": 0.5}}
    v, used = composite(vals, {"goals_home": "a", "btts": "b"})
    assert v["goals_home"]["mean"] == 1 and v["btts"] == 0.5 and used["top_scorelines"] == "a"


def test_demo_selection_is_random_distinct_and_auditable():
    ids = [f"2026-27_team{i}_team{i + 1}" for i in range(20)]
    picks = {tuple(select_three(ids, f"seed{i}")) for i in range(50)}
    assert len(picks) > 40                      # different seeds give different draws
    for p in picks:
        assert len(set(p)) == 3 and set(p) <= set(ids)
    seed = "abc123"
    chosen = select_three(ids, seed)
    assert select_three(list(reversed(ids)), seed) == chosen     # order of the input does not matter
    assert verify_run(chosen, seed, ids, eligible_hash(ids))
    assert not verify_run(chosen, seed, ids[:-1], eligible_hash(ids))
    counts = {i: 0 for i in ids}
    for s in range(3000):
        for m in select_three(ids, str(s)):
            counts[m] += 1
    assert max(counts.values()) / min(counts.values()) < 1.5      # roughly uniform
    with pytest.raises(ValueError):
        select_three(ids[:2], seed)


def test_demo_rule_matches_edge_function_source():
    src = (ROOT / "epl/supabase/functions/epl-demo/index.ts").read_text()
    assert "sha256(seed + e.match_id)" in src and "slice(0, 3)" in src
    assert "ids.join(',')" in src and "sort()" in src


def test_rows_are_json_safe_and_keep_timestamps(tmp_path, monkeypatch):
    # Inside GitHub Actions with id-token permission the writer would go remote.
    monkeypatch.delenv("ACTIONS_ID_TOKEN_REQUEST_URL", raising=False)
    monkeypatch.delenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN", raising=False)
    rows = clean_rows([{"a": np.float64("nan"), "b": np.int64(3), "c": pd.Timestamp("2024-01-01", tz="UTC"),
                        "d": {"x": (1.0, 2.0)}, "e": pd.NA}])
    s = json.dumps(rows)
    assert '"a": null' in s and '"b": 3' in s and "2024-01-01T00:00:00+00:00" in s
    w = Writer(outdir=str(tmp_path))
    assert not w.remote
    w.write("epl_predictions", [{"mode": "live", "values": {"x": 1}}])
    assert (tmp_path / "epl_predictions.jsonl").read_text().count("\n") == 1


def test_prediction_rows_never_set_created_at():
    # created_at is assigned by the database at insert time, so a prediction cannot
    # be back-dated by the client.
    src = (ROOT / "epl/ml/eplpred/pipeline.py").read_text()
    pred_section = src[src.index("# 7. Predictions"):src.index("cs[\"backtest_predictions_written\"]")]
    assert "created_at" not in pred_section


def test_schema_protects_predictions_and_results():
    sql = "\n".join(p.read_text() for p in sorted((ROOT / "epl/supabase/migrations").glob("*.sql")))
    assert "epl_predictions rows are immutable" in sql
    assert "epl_matches_protect" in sql
    assert re.search(r"generated_before_kickoff boolean generated always", sql)


def test_writer_refreshes_short_lived_oidc_token(monkeypatch):
    import eplpred.upload as up
    calls = []
    monkeypatch.setattr(up, "oidc_token", lambda: calls.append(1) or f"tok{len(calls)}")
    w = up.Writer()
    assert w.remote and w.token == "tok1"
    w._token_at -= up.Writer.TOKEN_MAX_AGE + 1
    assert w.token == "tok2" and len(calls) == 2


def test_glm_explanation_reproduces_the_model_and_is_stored_with_live_predictions(league):
    import math

    from eplpred.explain import GROUPS, feature_group
    from eplpred.models.ml import count_features

    m, now = _with_schedule(league)
    data = m.set_index("match_id").join(build_features(m))
    selection = {"outcome": "glm", "goals_home": "glm", "goals_away": "glm", "btts": "baseline"}
    preds, _ = predict_live(data, {"glm": {"alpha": 1.0}, "baseline": {}}, selection, now=now)
    keys = {k for k, _ in GROUPS}
    assert all(feature_group(c) in keys for c in count_features("goals"))
    for p in preds:
        e = p["explanation"]
        assert e["model_name"] == "glm" and e["outcome"] == p["values"]["outcome"]
        for side in ("home", "away"):
            s = e["sides"][side]
            # baseline x every group factor == the model's expected goals (rounding only)
            product = e["baseline_expected"] * math.prod(s["factors"].values())
            assert math.isclose(product, s["expected"], rel_tol=2e-3)
            assert math.isclose(s["expected"], p["per_model"]["glm"][f"goals_{side}"]["mean"], rel_tol=2e-3)
        assert e["sides"]["home"]["factors"]["venue"] > 1 > e["sides"]["away"]["factors"]["venue"]
        assert set(e["facts"]["home"]) == set(e["fact_labels"])


def test_no_explanation_when_the_outcome_model_has_none(league):
    m, now = _with_schedule(league)
    data = m.set_index("match_id").join(build_features(m))
    preds, _ = predict_live(data, {"baseline": {}}, {"outcome": "baseline", "goals_home": "baseline"}, now=now)
    assert preds and all(p["explanation"] is None for p in preds)


def test_live_predictions_store_total_distributions_from_the_selected_model(league):
    from eplpred.predict import PMF_STATS

    m, now = _with_schedule(league)
    data = m.set_index("match_id").join(build_features(m))
    selection = {"goals_total": "poisson_strength", "corners_total": "team_avg", "outcome": "baseline"}
    preds, _ = predict_live(data, {"poisson_strength": {"halflife_days": 240.0, "l2": 2.0}, "team_avg": {}, "baseline": {}},
                            selection, now=now)
    for p in preds:
        for name, vals in p["per_model"].items():
            for s in PMF_STATS:
                if f"{s}_total" not in vals:
                    continue
                pmf = vals[f"{s}_total_pmf"]
                assert 0.999 <= sum(pmf) <= 1.0 + 1e-3 and all(x >= 0 for x in pmf)
                mean = sum(i * x for i, x in enumerate(pmf))
                assert abs(mean - vals[f"{s}_total"]["mean"]) < 0.05 * max(1.0, vals[f"{s}_total"]["mean"])
        # the composite carries the distribution of the model chosen for that target
        assert p["values"]["corners_total_pmf"] == p["per_model"]["team_avg"]["corners_total_pmf"]
        assert p["values"]["goals_total_pmf"] == p["per_model"]["poisson_strength"]["goals_total_pmf"]
        assert "shots_total_pmf" not in p["values"]  # shots_total not selected here


def test_per_team_distributions_come_from_the_total_model_and_add_up_to_it(league):
    import numpy as np

    m, now = _with_schedule(league)
    data = m.set_index("match_id").join(build_features(m))
    selection = {"goals_total": "poisson_strength", "corners_total": "team_avg", "corners_home": "poisson_strength",
                 "outcome": "baseline"}
    preds, _ = predict_live(data, {"poisson_strength": {"halflife_days": 240.0, "l2": 2.0}, "team_avg": {}, "baseline": {}},
                            selection, now=now)
    for p in preds:
        sides = p["values"]["corners_sides"]
        # from the total's model, not from the model selected for the home side
        assert sides["model"] == "team_avg"
        assert sides["home"] == p["per_model"]["team_avg"]["corners_home_pmf"]
        for side in ("home", "away"):
            assert 0.999 <= sum(sides[side]) <= 1.001
        # the two teams' distributions add up to the stored total distribution
        total = np.convolve(sides["home"], sides["away"])
        stored = p["values"]["corners_total_pmf"]
        assert np.allclose(total[:len(stored)], stored, atol=2e-3)
        assert "shots_sides" not in p["values"]
