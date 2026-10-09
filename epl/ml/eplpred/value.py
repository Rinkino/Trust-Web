"""Betting evaluation: model probabilities against bookmaker prices.

Separate from prediction: it only reads the walk-forward predictions the backtest already
made (each from data before its weekly block) and the odds stored with each match.

Terms used throughout:
  implied probability      1 / decimal odds (includes the bookmaker's margin)
  overround                sum of implied probabilities over a complete market, minus 1
  fair (market) probability implied probabilities scaled to sum to 1 (margin removed)
  break-even probability   1 / odds taken: the win rate needed to make a profit at that price
  expected value (EV)      model probability x odds - 1: the model's estimate of return per unit
  edge (percentage points) model probability - fair market probability: a disagreement in
                           probability, not a return

Every strategy here is fixed before looking at results (thresholds below); none is tuned,
and the held-out season is reported like the others, never used to pick one.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

MARKETS = {
    # market: (selections, model target holding the probabilities)
    "1x2": (("H", "D", "A"), "outcome"),
    "ou25": (("over", "under"), "goals_over_2_5"),
}
PRICE_SOURCES = ("best", "average", "bet365", "pinnacle")
CAL_BINS = np.linspace(0, 1, 11)


def implied(odds) -> np.ndarray:
    return 1.0 / np.asarray(odds, dtype=float)


def overround(odds) -> float:
    return float(implied(odds).sum() - 1.0)


def fair_probabilities(odds) -> np.ndarray:
    """Margin removed proportionally: (1/o_i) / sum_j (1/o_j)."""
    inv = implied(odds)
    return inv / inv.sum()


def expected_value(p: float, odds: float) -> float:
    return p * odds - 1.0


def break_even(odds: float) -> float:
    return 1.0 / odds


def edge_pp(p: float, fair: float) -> float:
    return p - fair


@dataclass(frozen=True)
class Strategy:
    """Filters a selection must pass to be bet (flat 1-unit stakes)."""
    key: str
    min_ev: float = 0.0              # model EV at the price taken
    min_edge: float = -1.0           # model prob - fair market prob (probability points); -1 = no filter
    min_prob: float = 0.0            # model probability of the selection
    min_calibration_n: int = 0       # earlier selections in the same probability band

    def describe(self) -> dict:
        return asdict(self)


# Decided in advance, reported together; none is chosen after seeing results.
STRATEGIES = [
    Strategy("ev_0", min_ev=0.0),
    Strategy("ev_5", min_ev=0.05),
    Strategy("ev_10", min_ev=0.10),
    Strategy("filtered", min_ev=0.05, min_edge=0.02, min_prob=0.15, min_calibration_n=200),
]


def model_probs(values: dict, market: str) -> list[float] | None:
    target = MARKETS[market][1]
    v = values.get(target) if isinstance(values, dict) else None
    if v is None:
        return None
    if market == "1x2":
        p = [float(x) for x in v]
        return p if len(p) == 3 and abs(sum(p) - 1) < 0.01 else None
    p = float(v)
    return [p, 1 - p] if 0 <= p <= 1 else None


def selections(frame: pd.DataFrame, matches: pd.DataFrame, prob_source: str) -> pd.DataFrame:
    """One row per (match, market, selection, price source) for completed matches with
    model probabilities, a complete market at that price source and pre-closing average
    odds (for the fair market probability).

    `frame` rows: match_id, season, match_date, model, values. `prob_source` is a model
    name in the frame, or 'market' for the margin-removed average pre-closing odds."""
    m = matches.set_index("match_id") if "match_id" in matches.columns else matches
    out = []
    for r in frame.itertuples():
        if r.match_id not in m.index:
            continue
        mt = m.loc[r.match_id]
        if mt.get("status") != "completed" or not isinstance(mt.get("odds"), dict):
            continue
        odds = mt["odds"]
        pre, close = odds.get("pre_closing", {}), odds.get("closing", {})
        for market, (sels, _) in MARKETS.items():
            avg = pre.get("average", {}).get(market)
            if not avg:
                continue
            fair = fair_probabilities(avg)
            probs = list(fair) if prob_source == "market" else model_probs(r.values, market)
            if probs is None:
                continue
            close_avg = close.get("average", {}).get(market)
            close_fair = fair_probabilities(close_avg) if close_avg else None
            won_idx = _winner(market, mt)
            if won_idx is None:
                continue
            for src in PRICE_SOURCES:
                prices = pre.get(src, {}).get(market)
                if not prices:
                    continue
                for i, sel in enumerate(sels):
                    o = float(prices[i])
                    out.append({
                        "match_id": r.match_id, "season": r.season, "match_date": pd.Timestamp(r.match_date),
                        "market": market, "selection": sel, "price_source": src,
                        "prob": float(probs[i]), "odds": o, "fair": float(fair[i]),
                        "overround": overround(prices),
                        "close_fair": None if close_fair is None else float(close_fair[i]),
                        "won": i == won_idx,
                    })
    df = pd.DataFrame(out)
    if df.empty:
        return df
    df["ev"] = df.prob * df.odds - 1
    df["edge"] = df.prob - df.fair
    df["break_even"] = 1 / df.odds
    # Closing-line value: the price taken against the margin-free closing price.
    df["clv"] = np.where(df.close_fair.notna(), df.odds * df.close_fair.astype(float) - 1, np.nan)
    return add_calibration_history(df)


def _winner(market: str, mt) -> int | None:
    hg, ag = mt.get("fthg"), mt.get("ftag")
    if hg is None or ag is None or pd.isna(hg) or pd.isna(ag):
        return None
    if market == "1x2":
        return 0 if hg > ag else 1 if hg == ag else 2
    return 0 if hg + ag > 2.5 else 1


def add_calibration_history(df: pd.DataFrame) -> pd.DataFrame:
    """For each selection, how many earlier selections (strictly earlier dates, same
    market and price source) fell in the same 10% probability band, and how often they
    won. Only past results, so it can be used as a filter without leakage."""
    df = df.sort_values(["match_date", "match_id", "selection"]).reset_index(drop=True)
    df["band"] = np.clip(np.digitize(df.prob, CAL_BINS) - 1, 0, 9)
    n_hist = np.zeros(len(df), dtype=int)
    for _, g in df.groupby(["market", "price_source", "band"]):
        dates = g.match_date.values
        # count of rows in the group with a strictly earlier date
        n_hist[g.index] = np.searchsorted(dates, dates, side="left")
    df["calibration_n"] = n_hist
    return df


def place_bets(sel: pd.DataFrame, s: Strategy) -> pd.DataFrame:
    m = (sel.ev >= s.min_ev) & (sel.edge >= s.min_edge) & (sel.prob >= s.min_prob) & (sel.calibration_n >= s.min_calibration_n)
    # EV exactly 0 is not a bet: there is nothing to gain.
    m &= sel.ev > 0
    b = sel[m].copy()
    b["ret"] = np.where(b.won, b.odds - 1, -1.0)
    return b.sort_values(["match_date", "match_id"])


def max_drawdown(returns: np.ndarray) -> float:
    """Largest fall from a running peak of cumulative profit, in units staked."""
    if len(returns) == 0:
        return 0.0
    cum = np.concatenate([[0.0], np.cumsum(returns)])
    return float(np.max(np.maximum.accumulate(cum) - cum))


def roi_interval(bets: pd.DataFrame, n_boot: int = 2000, seed: int = 0) -> tuple[float, float] | None:
    """95% bootstrap interval for ROI, resampling whole matches (bets on the same match
    are not independent)."""
    if len(bets) < 2:
        return None
    rng = np.random.default_rng(seed)
    g = bets.groupby("match_id").ret.agg(["sum", "count"])
    s, c = g["sum"].to_numpy(), g["count"].to_numpy()
    idx = rng.integers(0, len(g), size=(n_boot, len(g)))
    rois = s[idx].sum(1) / c[idx].sum(1)
    lo, hi = np.percentile(rois, [2.5, 97.5])
    return float(lo), float(hi)


def summarize(bets: pd.DataFrame) -> dict:
    n = len(bets)
    if n == 0:
        return {"bets": 0}
    ret = bets.ret.to_numpy()
    ci = roi_interval(bets)
    clv = bets.clv.dropna()
    return {
        "bets": n, "matches": int(bets.match_id.nunique()), "wins": int(bets.won.sum()),
        "win_rate": float(bets.won.mean()), "avg_odds": float(bets.odds.mean()),
        "avg_break_even": float(bets.break_even.mean()), "avg_model_prob": float(bets.prob.mean()),
        "avg_ev": float(bets.ev.mean()), "avg_edge": float(bets.edge.mean()),
        "pnl": float(ret.sum()), "roi": float(ret.mean()), "roi_ci": list(ci) if ci else None,
        "max_drawdown": max_drawdown(ret),
        "clv_n": int(len(clv)), "clv_mean": float(clv.mean()) if len(clv) else None,
        "clv_positive_share": float((clv > 0).mean()) if len(clv) else None,
    }


def probability_quality(sel: pd.DataFrame) -> dict:
    """Log loss and Brier score of the probabilities on every eligible match (not only
    bets), and calibration by probability range."""
    s = sel[sel.price_source == "average"]
    if s.empty:
        return {}
    out: dict = {"matches": int(s.match_id.nunique())}
    p = np.clip(s.prob.to_numpy(), 1e-6, 1 - 1e-6)
    y = s.won.to_numpy().astype(float)
    # Multi-class log loss: -log p(actual outcome) per match; Brier: sum over outcomes.
    out["log_loss"] = float(-np.log(np.clip(s[s.won].prob.to_numpy(), 1e-6, 1)).mean())
    # Brier: summed over outcomes for the match result (as in the model evaluation);
    # for over/under the usual single-probability form (half the two-outcome sum).
    b = ((s.prob - s.won.astype(float)) ** 2).groupby(s.match_id).sum().mean()
    out["brier"] = float(b if s.market.iloc[0] == "1x2" else b / 2)
    bands = []
    idx = np.clip(np.digitize(p, CAL_BINS) - 1, 0, 9)
    for b in range(10):
        m = idx == b
        if m.sum():
            bands.append({"lo": round(float(CAL_BINS[b]), 1), "hi": round(float(CAL_BINS[b + 1]), 1), "n": int(m.sum()),
                          "mean_p": round(float(p[m].mean()), 4), "freq": round(float(y[m].mean()), 4)})
    out["calibration"] = bands
    out["avg_overround"] = float(s.groupby("match_id").overround.first().mean())
    return out


def evaluate(frame: pd.DataFrame, matches: pd.DataFrame, models: dict[str, str], periods: dict[str, list[str]]) -> list[dict]:
    """`models`: label -> model name in `frame` (or 'market'). `periods`: split -> seasons.
    Returns one record per (split, season, label, market, price source, strategy)."""
    rows: list[dict] = []
    for label, name in models.items():
        # The market's probabilities come from the odds; any model's rows give the same matches.
        src_frame = frame[frame.model == ("baseline" if name == "market" else name)]
        sel = selections(src_frame, matches, name)
        if sel.empty:
            continue
        for split, seasons in periods.items():
            scopes = [("ALL", seasons)] + ([(s, [s]) for s in seasons] if len(seasons) > 1 else [])
            for season, ss in scopes:
                part = sel[sel.season.isin(ss)]
                for market in MARKETS:
                    pm = part[part.market == market]
                    if pm.empty:
                        continue
                    quality = probability_quality(pm)
                    for src in PRICE_SOURCES:
                        ps = pm[pm.price_source == src]
                        if ps.empty:
                            continue
                        for st in STRATEGIES:
                            rows.append({
                                "split": split, "season": season, "label": label, "model_name": name,
                                "market": market, "price_source": src, "strategy": st.key, "strategy_config": st.describe(),
                                "eligible_selections": int(len(ps)), "eligible_matches": int(ps.match_id.nunique()),
                                "metrics": summarize(place_bets(ps, st)),
                                "quality": quality,
                                "period_start": str(ps.match_date.min().date()), "period_end": str(ps.match_date.max().date()),
                            })
    return rows
