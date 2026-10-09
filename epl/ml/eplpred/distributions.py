"""Predictive distributions for count statistics and everything derived from them.

Every model outputs, per statistic, an expected count for each side and a dispersion
parameter. From those we derive the full probability mass function, totals (by
convolving the two sides), threshold probabilities, scorelines and the match result.
"""
from __future__ import annotations

import math

import numpy as np
from scipy import stats as st

KMAX = {"goals": 12, "shots": 60, "sot": 30, "corners": 30, "yellows": 14, "reds": 5}


def pmf(mu: float, alpha: float, kmax: int) -> np.ndarray:
    """Poisson (alpha == 0) or negative binomial with variance mu + alpha*mu^2,
    truncated at kmax with the tail mass folded into the last cell."""
    mu = max(float(mu), 1e-6)
    k = np.arange(kmax + 1)
    if alpha <= 1e-6:
        p = st.poisson.pmf(k, mu)
    else:
        n = 1.0 / alpha
        p = st.nbinom.pmf(k, n, n / (n + mu))
    p[-1] += max(0.0, 1.0 - p.sum())
    return p / p.sum()


def convolve(p1: np.ndarray, p2: np.ndarray) -> np.ndarray:
    return np.convolve(p1, p2)


def quantile(p: np.ndarray, q: float) -> int:
    return int(np.searchsorted(np.cumsum(p), q - 1e-12))


def interval(p: np.ndarray, level: float) -> tuple[int, int]:
    """Central prediction interval: [q_(1-level)/2, q_(1+level)/2]."""
    lo = (1 - level) / 2
    return quantile(p, lo), quantile(p, 1 - lo)


def prob_over(p: np.ndarray, threshold: float) -> float:
    return float(p[int(math.floor(threshold)) + 1:].sum())


def score_matrix(ph: np.ndarray, pa: np.ndarray, rho: float = 0.0, mu_h: float = 0.0, mu_a: float = 0.0) -> np.ndarray:
    """Joint scoreline probabilities, independent sides, with the optional
    Dixon-Coles adjustment for 0-0, 1-0, 0-1 and 1-1."""
    m = np.outer(ph, pa)
    if rho:
        m[0, 0] *= max(1 - mu_h * mu_a * rho, 0)
        m[0, 1] *= max(1 + mu_h * rho, 0)
        m[1, 0] *= max(1 + mu_a * rho, 0)
        m[1, 1] *= max(1 - rho, 0)
        m /= m.sum()
    return m


def outcome_probs(m: np.ndarray) -> tuple[float, float, float]:
    h = float(np.tril(m, -1).sum())
    d = float(np.trace(m))
    a = float(np.triu(m, 1).sum())
    s = h + d + a
    return h / s, d / s, a / s


def btts(m: np.ndarray) -> float:
    return float(m[1:, 1:].sum())


def estimate_alpha(y: np.ndarray, mu: np.ndarray) -> float:
    """Moment estimator of NB2 dispersion. 0 means Poisson is adequate."""
    y, mu = np.asarray(y, float), np.asarray(mu, float)
    ok = ~(np.isnan(y) | np.isnan(mu))
    y, mu = y[ok], np.maximum(mu[ok], 1e-6)
    if len(y) < 30:
        return 0.0
    a = float(((y - mu) ** 2 - mu).sum() / (mu ** 2).sum())
    return float(np.clip(a, 0.0, 2.0)) if a > 0.005 else 0.0
