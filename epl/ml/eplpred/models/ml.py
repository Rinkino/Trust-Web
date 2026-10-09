"""Model C: statistical machine learning on the engineered features.

Count statistics use team-perspective ("pooled") rows: each match contributes a row
for the home side and one for the away side, with the team's own features (t_*),
its opponent's (o_*) and is_home. One regressor per statistic therefore predicts
both sides.

  glm  - L2-regularised Poisson regression (log link) on standardised features
  hgb  - histogram gradient boosting with Poisson loss

Match-result classifiers predict H/D/A directly from match-level features:

  logit_outcome - multinomial logistic regression
  hgb_outcome   - histogram gradient boosting classifier
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, PoissonRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ..config import STATS, TRAIN_FROM
from ..distributions import estimate_alpha
from ..features import pooled
from . import STAT_KEYS, Prediction

# Per-statistic inputs. Each model sees the team and opponent versions of the
# statistic's own form features plus general strength, schedule and environment.
GENERAL = ["elo", "season_ppg", "season_gdpg", "position", "ppg_l5", "ppg_l10", "rest_days", "n7", "n14",
           "promoted", "hist_n"]


def _team_cols(s: str) -> list[str]:
    base = [f"{s}_for_ewm", f"{s}_ag_ewm", f"{s}_for_venue", f"{s}_ag_venue"]
    if s in ("goals", "shots", "sot", "corners", "yellows"):
        base += [f"{s}_for_l{w}" for w in (3, 5, 10)] + [f"{s}_ag_l{w}" for w in (3, 5, 10)]
    return base


RELATED = {"goals": ["shots", "sot"], "shots": ["goals", "sot", "corners"], "sot": ["goals", "shots"],
           "corners": ["shots"], "yellows": ["fouls", "reds"], "reds": ["fouls", "yellows"]}


def count_features(s: str) -> list[str]:
    own = _team_cols(s)
    rel = [f"{r}_for_ewm" for r in RELATED[s]] + [f"{r}_ag_ewm" for r in RELATED[s]]
    cols = [f"t_{c}" for c in own + rel + GENERAL] + [f"o_{c}" for c in own + rel + GENERAL]
    return cols + ["is_home", "elo_diff", "matchday", f"lg_{s}_home", f"lg_{s}_away"]


OUTCOME_FEATURES = (
    ["elo_diff", "elo_exp_home", "matchday", "lg_rate_h", "lg_rate_d", "lg_rate_a"]
    + [f"{p}_{c}" for p in ("h", "a") for c in
       ["goals_for_ewm", "goals_ag_ewm", "goals_for_venue", "goals_ag_venue", "sot_for_ewm", "sot_ag_ewm",
        "shots_for_ewm", "shots_ag_ewm", "ppg_l5", "ppg_l10", "season_ppg", "season_gdpg", "position",
        "promoted", "rest_days", "elo"]]
)


def _train_rows(train: pd.DataFrame) -> pd.DataFrame:
    return train[train.match_date >= pd.Timestamp(TRAIN_FROM)]


def _pooled_with_targets(df: pd.DataFrame) -> pd.DataFrame:
    p = pooled(df[[c for c in df.columns if c.startswith(("h_", "a_", "lg_")) or c in ("elo_diff", "elo_exp_home", "matchday")]])
    for s, (h, a) in STATS.items():
        p[f"y_{s}"] = np.concatenate([df[h].astype(float).values, df[a].astype(float).values])
    return p


class _PooledCountModel:
    name = "?"

    def _make(self):
        raise NotImplementedError

    def fit(self, train: pd.DataFrame, cutoff) -> "_PooledCountModel":
        d = _train_rows(train)
        P = _pooled_with_targets(d)
        n = len(d)
        recent = np.zeros(len(P), bool)
        recent_idx = np.argsort(d.match_date.values)[-760:]
        recent[recent_idx] = True
        recent[recent_idx + n] = True
        self.models, self.alpha = {}, {}
        for s in STAT_KEYS:
            cols = count_features(s)
            ok = P[f"y_{s}"].notna().values
            m = self._make()
            m.fit(P.loc[ok, cols].values, P.loc[ok, f"y_{s}"].values)
            self.models[s] = m
            mu = m.predict(P.loc[ok & recent, cols].values)
            y = P.loc[ok & recent, f"y_{s}"].values
            side = P.loc[ok & recent, "is_home"].values == 1
            self.alpha[s] = (estimate_alpha(y[side], mu[side]), estimate_alpha(y[~side], mu[~side]))
        return self

    def predict(self, rows: pd.DataFrame) -> list[Prediction]:
        P = pooled(rows[[c for c in rows.columns if c.startswith(("h_", "a_", "lg_")) or c in ("elo_diff", "elo_exp_home", "matchday")]])
        n = len(rows)
        mus = {s: self.models[s].predict(P[count_features(s)].values) for s in STAT_KEYS}
        return [Prediction(mid, {s: (float(mus[s][i]), float(mus[s][i + n])) for s in STAT_KEYS}, dict(self.alpha))
                for i, mid in enumerate(rows.index)]


class PoissonGLM(_PooledCountModel):
    name = "glm"
    algorithm = "L2-regularised Poisson regression (sklearn PoissonRegressor), pooled team-perspective rows"

    def __init__(self, alpha: float = 1.0):
        self.reg = alpha

    def config(self) -> dict:
        return {"alpha": self.reg}

    def _make(self):
        return make_pipeline(StandardScaler(), PoissonRegressor(alpha=self.reg / 100.0, solver="newton-cholesky", max_iter=100))


class PoissonHGB(_PooledCountModel):
    name = "hgb"
    algorithm = "HistGradientBoostingRegressor (Poisson loss), pooled team-perspective rows"

    def __init__(self, max_iter: int = 200, learning_rate: float = 0.05, max_leaf_nodes: int = 15,
                 min_samples_leaf: int = 80, l2: float = 1.0):
        self.params = dict(max_iter=max_iter, learning_rate=learning_rate, max_leaf_nodes=max_leaf_nodes,
                           min_samples_leaf=min_samples_leaf, l2_regularization=l2)

    def config(self) -> dict:
        return dict(self.params)

    def _make(self):
        return HistGradientBoostingRegressor(loss="poisson", early_stopping=False, random_state=0, **self.params)


class _OutcomeClassifier:
    name = "?"

    def _make(self):
        raise NotImplementedError

    def fit(self, train: pd.DataFrame, cutoff) -> "_OutcomeClassifier":
        d = _train_rows(train)
        y = d.ftr.map({"H": 0, "D": 1, "A": 2}).values
        self.model = self._make()
        self.model.fit(d[OUTCOME_FEATURES].values, y)
        return self

    def predict(self, rows: pd.DataFrame) -> list[Prediction]:
        p = self.model.predict_proba(rows[OUTCOME_FEATURES].values)
        return [Prediction(mid, direct={"outcome": (float(p[i, 0]), float(p[i, 1]), float(p[i, 2]))})
                for i, mid in enumerate(rows.index)]


class LogitOutcome(_OutcomeClassifier):
    name = "logit_outcome"
    algorithm = "Multinomial logistic regression on match-level features"

    def __init__(self, C: float = 0.1):
        self.C = C

    def config(self) -> dict:
        return {"C": self.C}

    def _make(self):
        return make_pipeline(StandardScaler(), LogisticRegression(C=self.C, max_iter=2000))


class HGBOutcome(_OutcomeClassifier):
    name = "hgb_outcome"
    algorithm = "HistGradientBoostingClassifier on match-level features"

    def __init__(self, max_iter: int = 150, learning_rate: float = 0.04, max_leaf_nodes: int = 8, min_samples_leaf: int = 100):
        self.params = dict(max_iter=max_iter, learning_rate=learning_rate, max_leaf_nodes=max_leaf_nodes,
                           min_samples_leaf=min_samples_leaf)

    def config(self) -> dict:
        return dict(self.params)

    def _make(self):
        return HistGradientBoostingClassifier(early_stopping=False, random_state=0, l2_regularization=1.0, **self.params)
