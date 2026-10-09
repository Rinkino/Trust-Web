import math

import numpy as np
import pandas as pd

from eplpred.metrics import brier_binary, brier_multi, calibration, log_loss_binary, log_loss_multi, mae, rmse, summarise


def test_point_metrics():
    err = np.array([1.0, -2.0, 3.0])
    assert mae(err) == 2.0
    assert np.isclose(rmse(err), math.sqrt(14 / 3))


def test_probability_metrics_known_values():
    p, y = np.array([0.8, 0.3]), np.array([1.0, 0.0])
    assert np.isclose(log_loss_binary(p, y), -(math.log(0.8) + math.log(0.7)) / 2)
    assert np.isclose(brier_binary(p, y), (0.04 + 0.09) / 2)
    probs = np.array([[0.5, 0.3, 0.2], [0.2, 0.3, 0.5]])
    y3 = np.array([0, 1])
    assert np.isclose(log_loss_multi(probs, y3), -(math.log(0.5) + math.log(0.3)) / 2)
    assert np.isclose(brier_multi(probs, y3), ((0.25 + 0.09 + 0.04) + (0.04 + 0.49 + 0.25)) / 2)


def test_uniform_outcome_baseline_log_loss_is_log3():
    probs = np.full((30, 3), 1 / 3)
    y = np.arange(30) % 3
    assert np.isclose(log_loss_multi(probs, y), math.log(3))


def test_calibration_of_a_perfectly_calibrated_forecast_is_near_zero():
    rng = np.random.default_rng(1)
    p = rng.random(20000)
    y = (rng.random(20000) < p).astype(float)
    ece, bins = calibration(p, y)
    assert ece < 0.02 and len(bins) == 10


def test_summarise_counts_and_coverage():
    scores = [{"goals_total": {"err": e, "nll": 1.0, "in50": c50, "in80": 1.0}}
              for e, c50 in [(1, 1.0), (-1, 0.0), (2, 1.0), (0, 0.0)]]
    s = summarise(scores, "goals_total", "count")
    assert s["mae"] == 1.0 and s["coverage_50"] == 0.5 and s["coverage_80"] == 1.0 and s["n"] == 4


def test_selection_prefers_simpler_model_within_tolerance_and_flags_baseline():
    from eplpred.selection import select
    ev = pd.DataFrame([
        {"model": "baseline", "target": "goals_home", "kind": "count", "mae": 1.000, "improvement_pct": 0.0},
        {"model": "team_avg", "target": "goals_home", "kind": "count", "mae": 0.950, "improvement_pct": 5.0},
        {"model": "hgb", "target": "goals_home", "kind": "count", "mae": 0.948, "improvement_pct": 5.2},
        {"model": "baseline", "target": "red_home", "kind": "probability", "log_loss": 0.200, "improvement_pct": 0.0},
        {"model": "glm", "target": "red_home", "kind": "probability", "log_loss": 0.203, "improvement_pct": -1.5},
    ])
    rows = []
    for i in range(50):
        rows.append({"match_id": f"m{i}", "model": "baseline", "scores": {"goals_home": {"err": 1.0}, "red_home": {"ll": 0.2}}})
        rows.append({"match_id": f"m{i}", "model": "team_avg", "scores": {"goals_home": {"err": 0.95}}})
    sel = select(ev, pd.DataFrame(rows)).set_index("target")
    # hgb is only 0.2% better than team_avg: the simpler model is kept.
    assert sel.loc["goals_home", "selected"] == "team_avg"
    assert sel.loc["goals_home", "best_raw"] == "hgb"
    assert sel.loc["red_home", "selected"] == "baseline"
    assert not sel.loc["red_home", "reliable"]
