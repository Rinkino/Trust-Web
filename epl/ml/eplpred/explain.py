"""Plain-language explanations of a live prediction, computed from the fitted model.

For the Poisson GLM (log link, standardised inputs) a side's expected goals factor
exactly:

    E[goals] = exp(intercept) * prod_g exp(sum_{j in g} coef_j * (x_j - mean_j) / scale_j)

where the means and scales are the training averages. exp(intercept) is the expected
goals of a side whose every input equals the training average, and each group factor
is how much that group of inputs moves the number up or down. Nothing is
approximated: the product reproduces the model's prediction (checked below).

The groups are attributions inside one model, not causal effects: correlated inputs
share credit, and a different model could split it differently.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .features import pooled
from .models.ml import count_features

GROUPS: list[tuple[str, str]] = [
    ("attack", "Recent attacking output (goals, shots and shots on target)"),
    ("opp_defence", "Opponent's recent defending (goals and shots conceded)"),
    ("quality", "Results and rating (Elo, points per game, league position)"),
    ("opp_quality", "Opponent's results and rating"),
    ("venue", "Playing at home or away"),
    ("schedule", "Rest days and fixture congestion"),
    ("promoted", "Promotion or relegation"),
    ("tempo", "How open both sides' recent games have been"),
    ("league", "League-wide scoring level and stage of the season"),
]

_QUALITY = ("elo", "season_ppg", "season_gdpg", "position", "ppg_l5", "ppg_l10", "hist_n")
_SCHEDULE = ("rest_days", "n7", "n14")


def feature_group(col: str) -> str:
    if col == "is_home":
        return "venue"
    if col == "elo_diff":
        return "quality"
    if col.startswith("lg_") or col == "matchday":
        return "league"
    side, name = col[:2], col[2:]
    if name in _SCHEDULE:
        return "schedule"
    if name in ("promoted", "from_above", "from_below", "prev_tier_ppg", "prev_tier_gdpg"):
        return "promoted"
    if name in _QUALITY:
        return "quality" if side == "t_" else "opp_quality"
    attacking = "_for_" in name
    if side == "t_":
        return "attack" if attacking else "tempo"
    return "tempo" if attacking else "opp_defence"


# Team facts shown next to the explanation (raw model inputs, not derived opinions).
FACTS = {
    "elo": "Elo rating",
    "position": "League position",
    "season_ppg": "Points per game this season",
    "ppg_l5": "Points per game, last 5",
    "goals_for_ewm": "Goals scored per game (recent, weighted)",
    "goals_ag_ewm": "Goals conceded per game (recent, weighted)",
    "shots_for_ewm": "Shots per game (recent, weighted)",
    "sot_for_ewm": "Shots on target per game (recent, weighted)",
    "rest_days": "Days since last league match",
    "promoted": "Promoted this season",
}


def _r(x, d=3):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(float(x), d)


def explain_glm(model, rows: pd.DataFrame, stat: str = "goals") -> dict[str, dict]:
    """Per match: for each side, the baseline expected goals and the factor applied by
    each group of inputs, plus the raw team facts. `model` is a fitted PoissonGLM."""
    pipe = model.models[stat]
    scaler, reg = pipe.steps[0][1], pipe.steps[-1][1]
    cols = count_features(stat)
    groups = [feature_group(c) for c in cols]
    P = pooled(rows[[c for c in rows.columns if c.startswith(("h_", "a_", "lg_")) or c in ("elo_diff", "elo_exp_home", "matchday")]])
    X = P[cols].values.astype(float)
    Z = (X - scaler.mean_) / scaler.scale_
    contrib = Z * reg.coef_
    mu_model = pipe.predict(X)
    base = math.exp(float(reg.intercept_))
    n = len(rows)
    out: dict[str, dict] = {}
    for i, mid in enumerate(rows.index):
        sides = {}
        for side, k in (("home", i), ("away", i + n)):
            g = {name: 0.0 for name, _ in GROUPS}
            for gname, c in zip(groups, contrib[k]):
                g[gname] += float(c)
            mu = base * math.exp(sum(g.values()))
            assert abs(mu - mu_model[k]) < 1e-6 * max(1.0, mu_model[k]), "explanation does not reproduce the model"
            sides[side] = {"expected": _r(mu, 4), "factors": {name: _r(math.exp(v), 4) for name, v in g.items()}}
        r = rows.loc[mid]
        facts = {side: {k: _r(r.get(f"{p}_{k}")) for k in FACTS} for side, p in (("home", "h"), ("away", "a"))}
        out[mid] = {
            "method": "glm_log_linear_decomposition",
            "stat": stat,
            "baseline_expected": _r(base, 4),
            "groups": [{"key": k, "label": lbl} for k, lbl in GROUPS],
            "sides": sides,
            "facts": facts,
            "fact_labels": FACTS,
            "league": {"goals_home": _r(r.get("lg_goals_home")), "goals_away": _r(r.get("lg_goals_away")),
                       "rate_h": _r(r.get("lg_rate_h")), "rate_d": _r(r.get("lg_rate_d")), "rate_a": _r(r.get("lg_rate_a"))},
        }
    return out


def explain(model_name: str, model, rows: pd.DataFrame) -> dict[str, dict]:
    """Explanation for the model that produced the match-result probabilities, where
    that model supports one. Returns {} otherwise (the site then says so)."""
    if model_name == "glm":
        return explain_glm(model, rows)
    return {}
