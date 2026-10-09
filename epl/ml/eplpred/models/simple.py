"""Model A family: league-average baseline and naive team averages."""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import STATS, TARGETS
from ..distributions import estimate_alpha
from . import STAT_KEYS, Prediction

PROB_TARGETS = [t for t in TARGETS if t.kind == "probability"]


def _event(df: pd.DataFrame, key: str) -> pd.Series:
    g = df.fthg.astype(float) + df.ftag.astype(float)
    c = df.hc.astype(float) + df.ac.astype(float)
    y = df.hy.astype(float) + df.ay.astype(float)
    return {
        "goals_over_1_5": g > 1.5, "goals_over_2_5": g > 2.5, "goals_over_3_5": g > 3.5,
        "btts": (df.fthg.astype(float) > 0) & (df.ftag.astype(float) > 0),
        "corners_over_8_5": c > 8.5, "corners_over_9_5": c > 9.5, "corners_over_10_5": c > 10.5,
        "yellows_at_least_4": y > 3.5,
        "red_home": df.hr.astype(float) > 0, "red_away": df.ar.astype(float) > 0,
    }[key].astype(float)


class LeagueBaseline:
    """Predicts every match with the league averages of the last `window` matches
    played before the cutoff: home-side and away-side means for each statistic,
    empirical H/D/A frequencies and empirical frequencies for every threshold event."""

    name = "baseline"
    algorithm = "Trailing league averages (last 380 matches before the gameweek)"

    def __init__(self, window: int = 380):
        self.window = window

    def fit(self, train: pd.DataFrame, cutoff) -> "LeagueBaseline":
        recent = train.sort_values("match_date").tail(self.window)
        self.mu, self.alpha = {}, {}
        for s, (h, a) in STATS.items():
            yh, ya = recent[h].astype(float).dropna(), recent[a].astype(float).dropna()
            mh, ma = float(yh.mean()), float(ya.mean())
            self.mu[s] = (mh, ma)
            self.alpha[s] = (estimate_alpha(yh.values, np.full(len(yh), mh)), estimate_alpha(ya.values, np.full(len(ya), ma)))
        res = recent.ftr.value_counts(normalize=True)
        self.outcome = (float(res.get("H", 0)), float(res.get("D", 0)), float(res.get("A", 0)))
        self.events = {t.key: float(_event(recent, t.key).mean()) for t in PROB_TARGETS}
        return self

    def predict(self, rows: pd.DataFrame) -> list[Prediction]:
        direct = {"outcome": self.outcome, **self.events}
        return [Prediction(mid, dict(self.mu), dict(self.alpha), 0.0, dict(direct)) for mid in rows.index]


class TeamAverage:
    """Naive team averages: home expectation = mean of the home team's (shrunk,
    exponentially weighted) home record 'for' and the away team's away record
    'against'; symmetric for the away side. No fitting beyond the dispersion."""

    name = "team_avg"
    algorithm = "Average of team attack and opponent concession EWMAs (venue-specific, shrunk to league mean)"

    def _mu(self, df: pd.DataFrame, s: str) -> tuple[np.ndarray, np.ndarray]:
        mh = 0.5 * (df[f"h_{s}_for_venue"].values + df[f"a_{s}_ag_venue"].values)
        ma = 0.5 * (df[f"a_{s}_for_venue"].values + df[f"h_{s}_ag_venue"].values)
        return mh, ma

    def fit(self, train: pd.DataFrame, cutoff) -> "TeamAverage":
        recent = train.sort_values("match_date").tail(3 * 380)
        self.alpha = {}
        for s in STAT_KEYS:
            h, a = STATS[s]
            mh, ma = self._mu(recent, s)
            self.alpha[s] = (estimate_alpha(recent[h].astype(float).values, mh), estimate_alpha(recent[a].astype(float).values, ma))
        return self

    def predict(self, rows: pd.DataFrame) -> list[Prediction]:
        mus = {s: self._mu(rows, s) for s in STAT_KEYS}
        return [Prediction(mid, {s: (float(mus[s][0][i]), float(mus[s][1][i])) for s in STAT_KEYS}, dict(self.alpha))
                for i, mid in enumerate(rows.index)]


class MarketReference:
    """Average pre-closing bookmaker odds converted to probabilities (overround
    removed proportionally). Evaluation context only; never used for predictions."""

    name = "market"
    algorithm = "Implied probabilities from average pre-closing odds (football-data.co.uk)"

    def fit(self, train, cutoff) -> "MarketReference":
        return self

    def predict(self, rows: pd.DataFrame) -> list[Prediction]:
        out = []
        for mid, r in rows.iterrows():
            d: dict[str, object] = {}
            oh, od, oa = r.get("odds_avg_h"), r.get("odds_avg_d"), r.get("odds_avg_a")
            if all(pd.notna(x) and x > 1 for x in (oh, od, oa)):
                inv = np.array([1 / oh, 1 / od, 1 / oa])
                d["outcome"] = tuple(float(x) for x in inv / inv.sum())
            ov, un = r.get("odds_avg_over25"), r.get("odds_avg_under25")
            if all(pd.notna(x) and x > 1 for x in (ov, un)):
                d["goals_over_2_5"] = float((1 / ov) / (1 / ov + 1 / un))
            out.append(Prediction(mid, direct=d))
        return out
