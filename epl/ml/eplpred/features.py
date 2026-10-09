"""Leakage-safe feature engineering.

One chronological pass over the matches. For each calendar date we first compute
features for every match on that date from the current team state, and only then
update the state with that date's completed results. A match therefore never sees
its own statistics, nor any match played on the same day or later.

Features are deliberately limited to what the results file provides before kickoff:
no lineups, injuries, referees or weather, because there is no reliable historical
source for them.
"""
from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# stat -> (home column, away column). 'points' is derived.
FEATURE_STATS: dict[str, tuple[str, str]] = {
    "goals": ("fthg", "ftag"), "shots": ("hs", "as"), "sot": ("hst", "ast"),
    "corners": ("hc", "ac"), "yellows": ("hy", "ay"), "reds": ("hr", "ar"), "fouls": ("hf", "af"),
}
ROLLING_STATS = ["goals", "shots", "sot", "corners", "yellows"]
WINDOWS = (3, 5, 10)


@dataclass(frozen=True)
class FeatureConfig:
    ewm_halflife: float = 10.0      # matches
    shrink_k: float = 4.0           # pseudo-matches of league average mixed into every EWM
    league_window: int = 380        # matches used for the trailing league environment
    elo_k: float = 20.0
    elo_home: float = 60.0
    elo_season_regress: float = 0.2


@dataclass
class _Ewm:
    num: float = 0.0
    den: float = 0.0

    def update(self, x: float, lam: float) -> None:
        self.num = self.num * lam + x
        self.den = self.den * lam + 1.0

    def value(self, prior: float, k: float) -> float:
        return (self.num + k * prior) / (self.den + k)


@dataclass
class _Team:
    elo: float = 1500.0
    ewm: dict = field(default_factory=lambda: defaultdict(_Ewm))      # (scope, stat, 'for'|'ag') -> _Ewm
    recent: deque = field(default_factory=lambda: deque(maxlen=max(WINDOWS)))
    dates: deque = field(default_factory=lambda: deque(maxlen=20))
    season: str | None = None
    s_pts: int = 0
    s_gf: int = 0
    s_ga: int = 0
    s_n: int = 0
    matches_total: int = 0


def _elo_g(gd: int) -> float:
    gd = abs(gd)
    return 1.0 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8


def _points(gf: int, ga: int) -> int:
    return 3 if gf > ga else 1 if gf == ga else 0


@dataclass(frozen=True)
class TierRecord:
    """One team's completed season in a modelled competition."""
    tier: int
    ppg: float
    gdpg: float


def season_records(matches: pd.DataFrame, tiers: dict[str, int]) -> dict[tuple[str, str], TierRecord]:
    """(season, team) -> tier and per-game record, from completed matches in every competition.
    Used only for the season *before* the one being predicted, which is complete by then."""
    out: dict[tuple[str, str], TierRecord] = {}
    c = matches[matches.status == "completed"]
    if "competition" not in c.columns:
        return out
    for (season, comp), g in c.groupby(["season", "competition"]):
        tier = tiers.get(comp)
        if tier is None:
            continue
        acc: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])   # pts, gd, n
        for r in g.itertuples():
            gh, ga = int(r.fthg), int(r.ftag)
            for team, gf, gag in ((r.home_team, gh, ga), (r.away_team, ga, gh)):
                a = acc[team]
                a[0] += _points(gf, gag); a[1] += gf - gag; a[2] += 1
        for team, (pts, gd, n) in acc.items():
            out[(season, team)] = TierRecord(tier, pts / n, gd / n)
    return out


class FeatureBuilder:
    def __init__(self, cfg: FeatureConfig | None = None, tier: int = 1,
                 records: dict[tuple[str, str], TierRecord] | None = None):
        self.cfg = cfg or FeatureConfig()
        # This competition's tier, and every team's record in the modelled competitions, so a
        # team arriving from another division can carry its previous season with it.
        self.tier = tier
        self.records = records or {}
        self.lam = 0.5 ** (1.0 / self.cfg.ewm_halflife)
        self.teams: dict[str, _Team] = defaultdict(_Team)
        self.league: dict[str, deque] = {}
        self.season_teams: dict[str, set] = {}
        self.season_order: list[str] = []
        self.relegated_elo: dict[str, float] = {}     # season -> mean elo of teams relegated at its end
        self.promoted_out_elo: dict[str, float] = {}  # season -> mean elo of teams that went up at its end

    # ── league environment ────────────────────────────────────────────────────
    def _league_mean(self, key: str, default: float) -> float:
        q = self.league.get(key)
        return float(np.mean(q)) if q else default

    def _league_push(self, key: str, x: float) -> None:
        q = self.league.setdefault(key, deque(maxlen=self.cfg.league_window))
        q.append(x)

    def _priors(self) -> dict[str, tuple[float, float, float]]:
        """stat -> (league mean for home side, for away side, per team overall)."""
        out = {}
        defaults = {"goals": (1.5, 1.15), "shots": (13.5, 10.5), "sot": (5.0, 4.0), "corners": (5.8, 4.6),
                    "yellows": (1.5, 1.8), "reds": (0.06, 0.08), "fouls": (11.0, 11.5), "points": (1.6, 1.15)}
        for s, (dh, da) in defaults.items():
            h = self._league_mean(f"{s}_h", dh)
            a = self._league_mean(f"{s}_a", da)
            out[s] = (h, a, (h + a) / 2)
        return out

    # ── season bookkeeping ───────────────────────────────────────────────────
    def _enter_season(self, season: str, teams_in_season: set[str]) -> None:
        if season in self.season_teams:
            return
        prev = self.season_order[-1] if self.season_order else None
        if prev is not None:
            leavers = [t for t in self.season_teams[prev] if t not in teams_in_season]
            went_up = [t for t in leavers if self._tier_in(season, t) is not None and self._tier_in(season, t) < self.tier]
            went_down = [t for t in leavers if t not in went_up]
            # Relegated = the lowest of the previous season by points, goal difference, goals.
            table = sorted(self.season_teams[prev], key=lambda t: (self.teams[t].s_pts, self.teams[t].s_gf - self.teams[t].s_ga, self.teams[t].s_gf))
            relegated = [t for t in table if t in went_down][:3] or table[:3]
            self.relegated_elo[prev] = float(np.mean([self.teams[t].elo for t in relegated]))
            if went_up:
                self.promoted_out_elo[prev] = float(np.mean([self.teams[t].elo for t in went_up]))
        for t in teams_in_season:
            st = self.teams[t]
            if prev is not None and t not in self.season_teams.get(prev, set()):
                if self._came_from_above(t, season):
                    # Relegated into this division: start at the level of the sides that went up.
                    st.elo = self.promoted_out_elo.get(prev, 1580.0)
                else:
                    # Promoted (or returning) team: start from the level of the sides that went down.
                    st.elo = self.relegated_elo.get(prev, 1420.0)
            else:
                st.elo = (1 - self.cfg.elo_season_regress) * st.elo + self.cfg.elo_season_regress * 1500.0
            st.season, st.s_pts, st.s_gf, st.s_ga, st.s_n = season, 0, 0, 0, 0
        self.season_teams[season] = set(teams_in_season)
        self.season_order.append(season)

    def _tier_in(self, season: str, team: str) -> int | None:
        r = self.records.get((season, team))
        return r.tier if r else None

    def _previous(self, team: str, season: str) -> TierRecord | None:
        """The team's record last season in another modelled division, if it changed division."""
        prev = _previous_season(season)
        r = self.records.get((prev, team)) if prev else None
        return r if r and r.tier != self.tier else None

    def _came_from_above(self, team: str, season: str) -> bool:
        r = self._previous(team, season)
        return bool(r and r.tier < self.tier)

    def _promoted(self, team: str, season: str) -> int:
        """New to this division from below (or from outside the modelled divisions)."""
        i = self.season_order.index(season)
        if i == 0:
            return 0
        new = team not in self.season_teams[self.season_order[i - 1]]
        return int(new and not self._came_from_above(team, season))

    def _positions(self, season: str) -> dict[str, float]:
        teams = sorted(self.season_teams[season],
                       key=lambda t: (-self.teams[t].s_pts, -(self.teams[t].s_gf - self.teams[t].s_ga), -self.teams[t].s_gf, t))
        return {t: float(i + 1) for i, t in enumerate(teams)}

    # ── features for one side ────────────────────────────────────────────────
    def _side(self, team: str, venue: str, day: pd.Timestamp, priors: dict, pos: dict, season: str) -> dict:
        st = self.teams[team]
        k = self.cfg.shrink_k
        f: dict[str, float] = {}
        vi = 0 if venue == "home" else 1
        for s in FEATURE_STATS:
            ph, pa, pt = priors[s]
            p_for_v, p_ag_v = (ph, pa) if venue == "home" else (pa, ph)
            f[f"{s}_for_ewm"] = st.ewm[("all", s, "for")].value(pt, k)
            f[f"{s}_ag_ewm"] = st.ewm[("all", s, "ag")].value(pt, k)
            f[f"{s}_for_venue"] = st.ewm[(venue, s, "for")].value(p_for_v, k)
            f[f"{s}_ag_venue"] = st.ewm[(venue, s, "ag")].value(p_ag_v, k)
        recent = list(st.recent)
        for w in WINDOWS:
            r = recent[-w:]
            for s in ROLLING_STATS:
                vals_f = [m["for"][s] for m in r if m["for"].get(s) is not None]
                vals_a = [m["ag"][s] for m in r if m["ag"].get(s) is not None]
                f[f"{s}_for_l{w}"] = float(np.mean(vals_f)) if vals_f else priors[s][2]
                f[f"{s}_ag_l{w}"] = float(np.mean(vals_a)) if vals_a else priors[s][2]
            f[f"ppg_l{w}"] = float(np.mean([m["pts"] for m in r])) if r else priors["points"][2]
        f["hist_n"] = float(min(st.matches_total, 50))
        f["elo"] = st.elo
        f["season_n"] = float(st.s_n)
        f["season_ppg"] = st.s_pts / st.s_n if st.s_n else priors["points"][2]
        f["season_gdpg"] = (st.s_gf - st.s_ga) / st.s_n if st.s_n else 0.0
        f["position"] = pos.get(team, 10.5) if st.s_n else 10.5
        last = st.dates[-1] if st.dates else None
        f["rest_days"] = float(min((day - last).days, 30)) if last is not None and (day - last).days < 200 else 30.0
        f["n7"] = float(sum(1 for d in st.dates if 0 < (day - d).days <= 7))
        f["n14"] = float(sum(1 for d in st.dates if 0 < (day - d).days <= 14))
        f["promoted"] = float(self._promoted(team, season))
        prev = self._previous(team, season)
        f["from_above"] = float(bool(prev and prev.tier < self.tier))
        f["from_below"] = float(bool(prev and prev.tier > self.tier))
        f["prev_tier_ppg"] = prev.ppg if prev else 0.0
        f["prev_tier_gdpg"] = prev.gdpg if prev else 0.0
        return f

    def _features(self, row, priors, pos) -> dict:
        day = row["match_date"]
        h = self._side(row["home_team"], "home", day, priors, pos, row["season"])
        a = self._side(row["away_team"], "away", day, priors, pos, row["season"])
        out = {f"h_{k}": v for k, v in h.items()}
        out.update({f"a_{k}": v for k, v in a.items()})
        for s in FEATURE_STATS:
            out[f"lg_{s}_home"], out[f"lg_{s}_away"], _ = priors[s]
        out["elo_diff"] = h["elo"] - a["elo"] + self.cfg.elo_home
        out["elo_exp_home"] = 1.0 / (1.0 + 10 ** (-out["elo_diff"] / 400))
        out["matchday"] = float(min(h["season_n"], a["season_n"]))
        return out

    # ── state update with a completed match ──────────────────────────────────
    def _update(self, row) -> None:
        h, a = self.teams[row["home_team"]], self.teams[row["away_team"]]
        gh, ga = int(row["fthg"]), int(row["ftag"])
        vals_h, vals_a = {}, {}
        for s, (ch, ca) in FEATURE_STATS.items():
            xh, xa = row[ch], row[ca]
            if pd.isna(xh) or pd.isna(xa):
                continue
            xh, xa = float(xh), float(xa)
            vals_h[s], vals_a[s] = xh, xa
            for team, venue, x_for, x_ag in ((h, "home", xh, xa), (a, "away", xa, xh)):
                for scope in ("all", venue):
                    team.ewm[(scope, s, "for")].update(x_for, self.lam)
                    team.ewm[(scope, s, "ag")].update(x_ag, self.lam)
            self._league_push(f"{s}_h", xh)
            self._league_push(f"{s}_a", xa)
        ph, pa = _points(gh, ga), _points(ga, gh)
        self._league_push("points_h", ph)
        self._league_push("points_a", pa)
        self._league_push("result", 0 if gh > ga else 1 if gh == ga else 2)
        h.recent.append({"for": vals_h, "ag": vals_a, "pts": ph})
        a.recent.append({"for": vals_a, "ag": vals_h, "pts": pa})
        # Elo
        exp_h = 1.0 / (1.0 + 10 ** (-(h.elo - a.elo + self.cfg.elo_home) / 400))
        score_h = 1.0 if gh > ga else 0.5 if gh == ga else 0.0
        delta = self.cfg.elo_k * _elo_g(gh - ga) * (score_h - exp_h)
        h.elo += delta
        a.elo -= delta
        for t, gf, gag, p in ((h, gh, ga, ph), (a, ga, gh, pa)):
            t.s_pts += p
            t.s_gf += gf
            t.s_ga += gag
            t.s_n += 1
            t.matches_total += 1
            t.dates.append(row["match_date"])

    def league_result_rates(self) -> tuple[float, float, float]:
        q = self.league.get("result")
        if not q:
            return (0.46, 0.25, 0.29)
        arr = np.asarray(q)
        return tuple(float((arr == i).mean()) for i in range(3))  # type: ignore[return-value]

    # ── driver ───────────────────────────────────────────────────────────────
    def run(self, matches: pd.DataFrame) -> pd.DataFrame:
        """Return one feature row per match in `matches` (completed and scheduled).

        `matches` must contain every completed match to be used as history. Rows are
        processed date by date; scheduled rows only receive features.
        """
        m = matches.sort_values(["match_date", "match_id"]).reset_index(drop=True)
        season_teams = {s: set(g.home_team) | set(g.away_team) for s, g in m.groupby("season")}
        out_rows: list[dict] = []
        for day, block in m.groupby("match_date", sort=True):
            for season in sorted(block.season.unique()):
                self._enter_season(season, season_teams[season])
            priors = self._priors()
            rates = self.league_result_rates()
            positions = {s: self._positions(s) for s in block.season.unique()}
            for row in block.to_dict("records"):
                f = self._features(row, priors, positions[row["season"]])
                f["lg_rate_h"], f["lg_rate_d"], f["lg_rate_a"] = rates
                f["match_id"] = row["match_id"]
                out_rows.append(f)
            for row in block.to_dict("records"):
                if row["status"] == "completed":
                    self._update(row)
                else:
                    # The published schedule is known in advance, so later fixtures may
                    # count this date for rest days and congestion. No results are added.
                    self.teams[row["home_team"]].dates.append(row["match_date"])
                    self.teams[row["away_team"]].dates.append(row["match_date"])
        feats = pd.DataFrame(out_rows).set_index("match_id")
        return feats


def _previous_season(season: str) -> str | None:
    try:
        y = int(season[:4]) - 1
    except ValueError:
        return None
    return f"{y}-{(y + 1) % 100:02d}"


def build_features(matches: pd.DataFrame, cfg: FeatureConfig | None = None) -> pd.DataFrame:
    """Features for every match. Each competition is built separately (its own league
    averages, table and ratings); teams that changed division carry last season's record."""
    from .config import COMPETITIONS

    if "competition" not in matches.columns or matches.competition.nunique() <= 1:
        comp = matches.competition.iloc[0] if "competition" in matches.columns and len(matches) else "EPL"
        tiers = {c.code: c.tier for c in COMPETITIONS.values()}
        return FeatureBuilder(cfg, tiers.get(comp, 1), season_records(matches, tiers)).run(matches)
    tiers = {c.code: c.tier for c in COMPETITIONS.values()}
    records = season_records(matches, tiers)
    parts = [FeatureBuilder(cfg, tiers.get(comp, 1), records).run(g) for comp, g in matches.groupby("competition")]
    return pd.concat(parts)


def feature_columns(feats: pd.DataFrame) -> list[str]:
    return [c for c in feats.columns if c != "match_id"]


def pooled(feats: pd.DataFrame) -> pd.DataFrame:
    """Team-perspective rows: two per match (home side and away side).

    h_* / a_* become t_* (the team being predicted) and o_* (its opponent), plus
    is_home. One model then serves both sides, which doubles the training data.
    """
    h = {c: "t_" + c[2:] for c in feats.columns if c.startswith("h_")}
    a = {c: "o_" + c[2:] for c in feats.columns if c.startswith("a_")}
    home = feats.rename(columns={**h, **a}).copy()
    home["is_home"] = 1.0
    h2 = {c: "o_" + c[2:] for c in feats.columns if c.startswith("h_")}
    a2 = {c: "t_" + c[2:] for c in feats.columns if c.startswith("a_")}
    away = feats.rename(columns={**h2, **a2}).copy()
    away["is_home"] = 0.0
    away["elo_diff"] = -feats["elo_diff"]
    away["elo_exp_home"] = 1 - feats["elo_exp_home"]
    home["side"], away["side"] = "home", "away"
    cols = sorted(set(home.columns))
    return pd.concat([home[cols], away[cols]])
