"""Candidate models. Every model exposes the same interface:

    fit(train: DataFrame, cutoff: Timestamp) -> self
    predict(rows: DataFrame) -> list[Prediction]

`train` and `rows` are match rows joined with their pre-match features. Training
rows are always strictly before `cutoff`; the backtest enforces it and so do the
tests.
"""
from __future__ import annotations

from dataclasses import dataclass, field

STAT_KEYS = ["goals", "shots", "sot", "corners", "yellows", "reds"]


@dataclass
class Prediction:
    match_id: str
    mu: dict[str, tuple[float, float]] = field(default_factory=dict)       # stat -> (home, away)
    alpha: dict[str, tuple[float, float]] = field(default_factory=dict)    # stat -> NB dispersion
    rho: float = 0.0                                                        # Dixon-Coles, goals only
    direct: dict[str, object] = field(default_factory=dict)                 # target -> prob or (H, D, A)
