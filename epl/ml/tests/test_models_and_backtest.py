import numpy as np
import pandas as pd
import pytest

from eplpred import backtest
from eplpred.backtest import DEFAULT_CONFIG, walk_forward, week_start
from eplpred.config import TARGETS
from eplpred.derive import derive
from eplpred.distributions import btts, convolve, interval, outcome_probs, pmf, prob_over, score_matrix
from eplpred.features import build_features
from eplpred.models import Prediction


@pytest.fixture(scope="module")
def data(league):
    return league.set_index("match_id").join(build_features(league))


def test_pmf_and_scoreline_probabilities_sum_to_one():
    for alpha in (0.0, 0.1):
        assert np.isclose(pmf(1.4, alpha, 12).sum(), 1.0)
    ph, pa = pmf(1.6, 0, 12), pmf(1.1, 0, 12)
    for rho in (0.0, -0.1, 0.08):
        m = score_matrix(ph, pa, rho, 1.6, 1.1)
        assert np.isclose(m.sum(), 1.0)
        h, d, a = outcome_probs(m)
        assert np.isclose(h + d + a, 1.0) and min(h, d, a) > 0
        assert 0 < btts(m) < 1
    assert np.isclose(convolve(ph, pa).sum(), 1.0)


def test_thresholds_and_intervals_are_consistent():
    p = pmf(10.2, 0.05, 30)
    assert prob_over(p, 9.5) > prob_over(p, 10.5) > prob_over(p, 11.5)
    assert np.isclose(prob_over(p, 9.5), p[10:].sum())
    lo50, hi50 = interval(p, 0.5)
    lo80, hi80 = interval(p, 0.8)
    assert lo80 <= lo50 <= 10 <= hi50 <= hi80


def test_derive_produces_every_target_with_valid_ranges():
    pred = Prediction("m", mu={s: (1.5, 1.1) for s in ["goals", "shots", "sot", "corners", "yellows", "reds"]},
                      alpha={s: (0.0, 0.0) for s in ["goals"]}, rho=-0.05)
    values, _ = derive(pred)
    for t in TARGETS:
        assert t.key in values, t.key
        v = values[t.key]
        if t.kind == "probability":
            assert 0 <= v <= 1
        elif t.kind == "outcome":
            assert np.isclose(sum(v), 1.0, atol=1e-3)
        else:
            assert v["pi80"][0] <= v["pi50"][0] <= v["pi50"][1] <= v["pi80"][1]
    assert np.isclose(values["goals_total"]["mean"], 2.6, atol=1e-3)


def test_walk_forward_trains_only_on_earlier_matches(data, monkeypatch):
    seen = []
    real = backtest.make_model

    def spy(name, cfg=None):
        m = real(name, cfg)
        fit = m.fit

        def wrapped(train, cutoff):
            seen.append((pd.Timestamp(cutoff), train.match_date.max(), set(train.index)))
            return fit(train, cutoff)
        m.fit = wrapped
        return m

    monkeypatch.setattr(backtest, "make_model", spy)
    res = walk_forward(data, ["2023-24"], {"baseline": {}, "poisson_strength": DEFAULT_CONFIG["poisson_strength"]})
    fr = res.frame()
    assert len(fr) == 2 * (data.season == "2023-24").sum()
    for cutoff, last, _ in seen:
        assert last < cutoff
    # No match is in the training set used for its own prediction.
    train_sets = {c: ids for c, _, ids in seen}
    for r in fr.itertuples():
        assert r.match_id not in train_sets[r.cutoff]
        assert r.match_date >= r.cutoff and week_start(r.match_date) == r.cutoff


def test_all_models_run_and_beat_nothing_unrealistic(data):
    cfg = {k: v for k, v in DEFAULT_CONFIG.items()}
    cfg["hgb"] = {"max_iter": 20, "min_samples_leaf": 20}
    cfg["hgb_outcome"] = {"max_iter": 20, "min_samples_leaf": 20}
    res = walk_forward(data, ["2023-24"], cfg)
    fr = res.frame()
    assert set(fr.model) == set(cfg)
    for r in fr[fr.model != "market"].itertuples():
        if "outcome" in r.values:
            assert np.isclose(sum(r.values["outcome"]), 1.0, atol=2e-3)


def test_parallel_and_serial_backtests_agree(data):
    models = {"baseline": {}, "team_avg": {}}
    a = walk_forward(data, ["2023-24"], models, n_jobs=1).frame()
    b = walk_forward(data, ["2023-24"], models, n_jobs=2).frame()
    ka = sorted((r.match_id, r.model, round(r.values["goals_home"]["mean"], 6)) for r in a.itertuples())
    kb = sorted((r.match_id, r.model, round(r.values["goals_home"]["mean"], 6)) for r in b.itertuples())
    assert ka == kb
