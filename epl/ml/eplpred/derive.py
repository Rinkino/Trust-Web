"""From a model's Prediction to every target value, and per-target scores against actuals."""
from __future__ import annotations

import math

import numpy as np

from .config import STATS, TARGETS
from .distributions import KMAX, btts, convolve, interval, outcome_probs, pmf, prob_over, score_matrix
from .models import Prediction


def _side_pmfs(pred: Prediction, s: str):
    mh, ma = pred.mu[s]
    ah, aa = pred.alpha.get(s, (0.0, 0.0))
    return pmf(mh, ah, KMAX[s]), pmf(ma, aa, KMAX[s])


def _count_summary(p: np.ndarray, mean: float) -> dict:
    lo50, hi50 = interval(p, 0.5)
    lo80, hi80 = interval(p, 0.8)
    return {"mean": round(float(mean), 3), "mode": int(np.argmax(p)), "median": int(np.searchsorted(np.cumsum(p), 0.5)),
            "pi50": [lo50, hi50], "pi80": [lo80, hi80]}


def derive(pred: Prediction) -> tuple[dict, dict]:
    """Returns (values, pmfs). `values` is what gets stored and displayed. `pmfs`
    holds the full distributions for scoring and is not stored."""
    values: dict[str, object] = {}
    pmfs: dict[str, np.ndarray] = {}
    for s in STATS:
        if s not in pred.mu:
            continue
        ph, pa = _side_pmfs(pred, s)
        pt = convolve(ph, pa)
        mh, ma = pred.mu[s]
        pmfs[f"{s}_home"], pmfs[f"{s}_away"], pmfs[f"{s}_total"] = ph, pa, pt
        if s != "reds":
            values[f"{s}_home"] = _count_summary(ph, mh)
            values[f"{s}_away"] = _count_summary(pa, ma)
            values[f"{s}_total"] = _count_summary(pt, mh + ma)
    for t in TARGETS:
        if t.kind == "probability" and t.stat in pred.mu and t.key not in ("btts",):
            p = pmfs[f"{t.stat}_{t.side}"]
            values[t.key] = round(prob_over(p, t.threshold), 4)
    if "goals" in pred.mu:
        mh, ma = pred.mu["goals"]
        m = score_matrix(pmfs["goals_home"], pmfs["goals_away"], pred.rho, mh, ma)
        values["outcome"] = [round(x, 4) for x in outcome_probs(m)]
        values["btts"] = round(btts(m), 4)
        top = np.dstack(np.unravel_index(np.argsort(m.ravel())[::-1][:5], m.shape))[0]
        values["top_scorelines"] = [[int(i), int(j), round(float(m[i, j]), 4)] for i, j in top]
    # Directly modelled probabilities override the derived ones for that model.
    for k, v in pred.direct.items():
        values[k] = [round(float(x), 4) for x in v] if isinstance(v, tuple) else round(float(v), 4)
    return values, pmfs


def actual_values(row) -> dict:
    """Observed value for every target, or None when the statistic is missing."""
    out: dict[str, object] = {}

    def num(c):
        v = row[c]
        return None if v is None or (isinstance(v, float) and math.isnan(v)) or v != v else float(v)

    for s, (h, a) in STATS.items():
        vh, va = num(h), num(a)
        out[f"{s}_home"], out[f"{s}_away"] = vh, va
        out[f"{s}_total"] = None if vh is None or va is None else vh + va
    for t in TARGETS:
        if t.kind == "probability":
            if t.key == "btts":
                gh, ga = out["goals_home"], out["goals_away"]
                out[t.key] = None if gh is None else float(gh > 0 and ga > 0)
            else:
                v = out[f"{t.stat}_{t.side}"]
                out[t.key] = None if v is None else float(v > t.threshold)
    gh, ga = out["goals_home"], out["goals_away"]
    out["outcome"] = None if gh is None else (0 if gh > ga else 1 if gh == ga else 2)
    return out


def score_row(values: dict, pmfs: dict, actual: dict) -> dict:
    """Per-target scores for one match. Missing predictions/actuals are skipped."""
    sc: dict[str, dict] = {}
    for t in TARGETS:
        y = actual.get(t.key)
        if y is None or t.key not in values:
            continue
        v = values[t.key]
        if t.kind == "count":
            p = pmfs.get(t.key)
            k = int(y)
            nll = None
            if p is not None:
                nll = -math.log(max(float(p[min(k, len(p) - 1)]), 1e-12))
            sc[t.key] = {"err": v["mean"] - y, "nll": nll,
                         "in50": float(v["pi50"][0] <= y <= v["pi50"][1]), "in80": float(v["pi80"][0] <= y <= v["pi80"][1])}
        elif t.kind == "probability":
            p = min(max(float(v), 1e-6), 1 - 1e-6)
            sc[t.key] = {"p": p, "y": float(y), "ll": -(y * math.log(p) + (1 - y) * math.log(1 - p)), "brier": (p - y) ** 2}
        else:
            probs = np.clip(np.asarray(v, float), 1e-6, 1)
            probs = probs / probs.sum()
            onehot = np.eye(3)[int(y)]
            sc[t.key] = {"probs": probs.tolist(), "y": int(y), "ll": -math.log(probs[int(y)]),
                         "brier": float(((probs - onehot) ** 2).sum()), "hit": float(int(np.argmax(probs)) == int(y))}
    return sc
