"""Chronological walk-forward backtesting.

For each evaluation season the matches are grouped into weekly blocks (Monday to
Sunday, i.e. a gameweek including midweek rounds). Before each block every model is
refitted on matches strictly before the block's Monday, then predicts the block.
Features themselves are already computed from earlier dates only (features.py), so
a match on Sunday may use Saturday's results through its features but never its own.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

import pandas as pd

from .derive import actual_values, derive, score_row
from .models.ml import HGBOutcome, LogitOutcome, PoissonGLM, PoissonHGB
from .models.simple import LeagueBaseline, MarketReference, TeamAverage
from .models.strength import PoissonStrength

DEFAULT_CONFIG: dict[str, dict] = {
    "baseline": {},
    "team_avg": {},
    "poisson_strength": {"halflife_days": 240.0, "l2": 2.0},
    "glm": {"alpha": 1.0},
    "hgb": {"max_iter": 200, "min_samples_leaf": 80},
    "logit_outcome": {"C": 0.1},
    "hgb_outcome": {},
    "market": {},
}

FACTORIES: dict[str, Callable[..., object]] = {
    "baseline": LeagueBaseline, "team_avg": TeamAverage, "poisson_strength": PoissonStrength,
    "glm": PoissonGLM, "hgb": PoissonHGB, "logit_outcome": LogitOutcome, "hgb_outcome": HGBOutcome,
    "market": MarketReference,
}


def make_model(name: str, config: dict | None = None):
    return FACTORIES[name](**(config if config is not None else DEFAULT_CONFIG[name]))


@dataclass
class BacktestResult:
    records: list[dict] = field(default_factory=list)   # one per (match, model)
    timings: dict[str, float] = field(default_factory=dict)

    def frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.records)


def week_start(d: pd.Timestamp) -> pd.Timestamp:
    d = pd.Timestamp(d).normalize()
    return d - pd.Timedelta(days=d.weekday())


_SHARED: dict = {}


def _run_block(args) -> tuple[list[dict], dict[str, float]]:
    season, cutoff, block_ids, models = args
    completed = _SHARED["completed"]
    block = completed.loc[block_ids]
    train = completed[completed.match_date < cutoff]
    # Invariant: nothing in the training set is on or after the block start.
    assert train.empty or train.match_date.max() < cutoff
    timings: dict[str, float] = {}
    recs: list[dict] = []
    for name, cfg in models.items():
        t0 = time.perf_counter()
        model = make_model(name, cfg).fit(train, cutoff)
        timings[name] = time.perf_counter() - t0
        for pred in model.predict(block):
            row = block.loc[pred.match_id]
            values, pmfs = derive(pred)
            recs.append({
                "match_id": pred.match_id, "season": season, "match_date": row.match_date,
                "home_team": row.home_team, "away_team": row.away_team,
                "model": name, "cutoff": cutoff, "train_last_date": train.match_date.max(),
                "values": values, "scores": score_row(values, pmfs, actual_values(row)),
                "mu": pred.mu, "alpha": pred.alpha,
            })
    return recs, timings


def _init_worker():
    from threadpoolctl import threadpool_limits
    threadpool_limits(1)


def walk_forward(data: pd.DataFrame, seasons: list[str], models: dict[str, dict], n_jobs: int = 1,
                 progress: bool = False) -> BacktestResult:
    """`data`: completed matches joined with features, indexed by match_id.

    Models are refitted before every weekly block. Blocks are independent, so they
    can run in parallel without changing results."""
    res = BacktestResult()
    completed = data[data.status == "completed"].sort_values("match_date")
    _SHARED["completed"] = completed
    jobs = []
    for season in seasons:
        rows = completed[completed.season == season]
        for start, block in rows.groupby(rows.match_date.map(week_start)):
            jobs.append((season, pd.Timestamp(start), list(block.index), models))
    if n_jobs > 1:
        import multiprocessing as mp
        with mp.get_context("fork").Pool(n_jobs, initializer=_init_worker) as pool:
            outputs = pool.map(_run_block, jobs, chunksize=1)
    else:
        outputs = [_run_block(j) for j in jobs]
    for i, (recs, timings) in enumerate(outputs):
        res.records.extend(recs)
        for k, v in timings.items():
            res.timings[k] = res.timings.get(k, 0.0) + v
    if progress:
        print(f"  {len(jobs)} blocks, {len(res.records)} predictions", flush=True)
    return res
