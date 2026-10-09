"""Betting evaluation: probability maths, margin removal, EV, chronology, ingestion of odds."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from eplpred.ingest import parse_odds
from eplpred.value import (Strategy, break_even, edge_pp, evaluate, expected_value, fair_probabilities, max_drawdown,
                           overround, place_bets, roi_interval, selections)


def test_implied_and_fair_probabilities():
    odds = [2.0, 3.5, 4.0]
    raw = 1 / np.array(odds)
    assert overround(odds) == pytest.approx(raw.sum() - 1)
    fair = fair_probabilities(odds)
    assert fair.sum() == pytest.approx(1.0)
    # proportional removal keeps the ratios between outcomes
    assert fair[0] / fair[1] == pytest.approx(raw[0] / raw[1])
    assert all(f < r for f, r in zip(fair, raw))      # removing a margin lowers each probability


def test_expected_value_break_even_and_edge_are_different_things():
    # Worked example: model 47% for an away win at 2.40
    assert break_even(2.40) == pytest.approx(0.41667, abs=1e-5)
    assert expected_value(0.47, 2.40) == pytest.approx(0.128)
    # edge is in probability points against the margin-free market, not a return
    assert edge_pp(0.47, 0.40) == pytest.approx(0.07)
    assert expected_value(0.40, 2.40) < 0   # break-even is 41.7%, so 40% at 2.40 loses


def test_drawdown_and_roi_interval():
    assert max_drawdown(np.array([1.0, -1, -1, 2, -1])) == pytest.approx(2.0)
    assert max_drawdown(np.array([])) == 0.0
    bets = pd.DataFrame({"match_id": list("abcdefgh"), "ret": [1.5, -1, -1, 2.0, -1, -1, 0.8, -1]})
    lo, hi = roi_interval(bets)
    assert lo < bets.ret.mean() < hi


def _matches():
    rows = []
    for i, (hg, ag) in enumerate([(2, 0), (1, 1), (0, 3), (2, 2)]):
        rows.append({"match_id": f"m{i}", "status": "completed", "fthg": hg, "ftag": ag,
                     "odds": {"pre_closing": {"average": {"1x2": [2.0, 3.4, 4.0], "ou25": [1.9, 1.9]},
                                              "best": {"1x2": [2.1, 3.6, 4.4], "ou25": [2.0, 1.95]}},
                              "closing": {"average": {"1x2": [1.9, 3.5, 4.2], "ou25": [1.85, 1.95]}}}})
    return pd.DataFrame(rows)


def _frame(p_home: float):
    return pd.DataFrame([{"match_id": f"m{i}", "season": "2023-24", "match_date": pd.Timestamp("2023-09-01") + pd.Timedelta(days=7 * i),
                          "model": "glm", "values": {"outcome": [p_home, 0.25, 0.75 - p_home], "goals_over_2_5": 0.5}}
                         for i in range(4)])


def test_selections_settle_correctly_and_use_pre_closing_prices():
    sel = selections(_frame(0.6), _matches(), "glm")
    home = sel[(sel.market == "1x2") & (sel.selection == "H") & (sel.price_source == "best")]
    assert list(home.won) == [True, False, False, False]
    assert set(home.odds) == {2.1}                       # pre-closing best price, never closing
    over = sel[(sel.market == "ou25") & (sel.selection == "over") & (sel.price_source == "average")]
    assert list(over.won) == [False, False, True, True]  # 2-0, 1-1, 0-3, 2-2
    # fair probability comes from the margin-free average pre-closing market
    assert home.fair.iloc[0] == pytest.approx(fair_probabilities([2.0, 3.4, 4.0])[0])
    # closing-line value: price taken against the margin-free closing price
    assert home.clv.iloc[0] == pytest.approx(2.1 * fair_probabilities([1.9, 3.5, 4.2])[0] - 1)


def test_market_probabilities_never_show_value_at_their_own_average_price():
    sel = selections(_frame(0.6), _matches(), "market")
    avg = sel[sel.price_source == "average"]
    assert (avg.ev < 0).all()        # margin removed, so EV at the same prices is negative
    assert (avg.edge.abs() < 1e-12).all()


def test_calibration_history_counts_only_earlier_matches():
    sel = selections(_frame(0.6), _matches(), "glm")
    h = sel[(sel.market == "1x2") & (sel.selection == "H") & (sel.price_source == "best")].sort_values("match_date")
    assert list(h.calibration_n) == [0, 1, 2, 3]


def test_strategy_filters_and_flat_stakes():
    sel = selections(_frame(0.6), _matches(), "glm")
    b = place_bets(sel[sel.price_source == "best"], Strategy("t", min_ev=0.05))
    assert (b.ev >= 0.05).all() and len(b) > 0
    assert set(b.ret) <= {-1.0} | set((b.odds - 1).round(10))
    none = place_bets(sel, Strategy("t", min_ev=0.0, min_calibration_n=99))
    assert none.empty


def test_evaluate_reports_every_strategy_and_never_mixes_markets():
    rows = evaluate(_frame(0.6), _matches(), {"model": "glm", "market": "market"}, {"validation": ["2023-24"]})
    assert rows and {r["market"] for r in rows} == {"1x2", "ou25"}
    for r in rows:
        assert r["eligible_matches"] == 4
        assert r["quality"]["matches"] == 4


def test_parse_odds_keeps_complete_plausible_markets_only():
    header = ["AvgH", "AvgD", "AvgA", "MaxH", "MaxD", "MaxA", "B365H", "B365D", "B365A", "Avg>2.5", "Avg<2.5",
              "AvgCH", "AvgCD", "AvgCA", "PSH", "PSD", "PSA"]
    rec = ["2.0", "3.4", "4.0", "2.2", "3.6", "4.4", "2.0", "", "4.0", "1.9", "1.9",
           "1.9", "3.5", "4.2", "1.1", "1.1", "1.1"]
    odds, bad = parse_odds(header, rec)
    assert odds["pre_closing"]["average"]["1x2"] == [2.0, 3.4, 4.0]
    assert odds["pre_closing"]["average"]["ou25"] == [1.9, 1.9]
    assert odds["closing"]["average"]["1x2"] == [1.9, 3.5, 4.2]
    assert "bet365" not in odds["pre_closing"]        # one price missing: whole market dropped
    assert "pinnacle" not in odds["pre_closing"]      # implied total 2.7: data error
    assert len(bad) == 2


def test_pipeline_value_stage_on_a_real_walk_forward(league):
    from types import SimpleNamespace

    from eplpred.backtest import DEFAULT_CONFIG, walk_forward
    from eplpred.features import build_features
    from eplpred.pipeline import odds_table_rows, value_rows_for

    lg = league.copy()
    lg["source_url"] = "https://example.test/E0.csv"
    lg["odds"] = [{"pre_closing": {"average": {"1x2": [2.2, 3.3, 3.4], "ou25": [1.9, 1.9]},
                                   "best": {"1x2": [2.3, 3.5, 3.6], "ou25": [1.98, 1.97]}},
                   "closing": {"average": {"1x2": [2.1, 3.4, 3.6], "ou25": [1.9, 1.9]}}}] * len(lg)
    data = lg.set_index("match_id").join(build_features(lg))
    fr = walk_forward(data, ["2023-24"], {"baseline": {}, "glm": DEFAULT_CONFIG["glm"], "market": {}}).frame()
    ds = SimpleNamespace(matches=lg)
    rows = value_rows_for(fr, ds, {"outcome": "glm", "goals_over_2_5": "baseline"}, {"glm": "v1", "baseline": "v0"},
                          "run", "method")
    roles = {(r["market"], r["model_name"]): r["role"] for r in rows}
    assert roles[("1x2", "glm")] == "existing_model"
    assert roles[("ou25", "baseline")] == "existing_model"   # selected model for that market
    assert roles[("1x2", "market")] == "market"
    n = (lg.season == "2023-24").sum()
    assert all(r["eligible_matches"] == n for r in rows)
    assert all(r["split"] == "validation" for r in rows if r["season"] == "2023-24")
    # bets are only ever placed at pre-closing prices of the row's own price source
    assert {r["price_source"] for r in rows} == {"average", "best"}
    from eplpred.pipeline import comparability
    assert comparability(rows)["mismatched"] == []
    odds_rows = odds_table_rows(ds, SimpleNamespace(remote=False))
    assert len(odds_rows) == len(lg) and len({r["odds_hash"] for r in odds_rows}) == 1
