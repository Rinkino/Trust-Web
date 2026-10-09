"""Aggregate per-match scores into metrics, with bootstrap uncertainty."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .config import TARGETS

PRIMARY = {"count": "mae", "probability": "log_loss", "outcome": "log_loss"}


def mae(err: np.ndarray) -> float:
    return float(np.mean(np.abs(err)))


def rmse(err: np.ndarray) -> float:
    return float(math.sqrt(np.mean(np.square(err))))


def log_loss_binary(p: np.ndarray, y: np.ndarray) -> float:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def brier_binary(p: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean((p - y) ** 2))


def log_loss_multi(probs: np.ndarray, y: np.ndarray) -> float:
    probs = np.clip(probs, 1e-6, 1)
    probs = probs / probs.sum(1, keepdims=True)
    return float(-np.mean(np.log(probs[np.arange(len(y)), y])))


def brier_multi(probs: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean(((probs - np.eye(probs.shape[1])[y]) ** 2).sum(1)))


def calibration(p: np.ndarray, y: np.ndarray, bins: int = 10) -> tuple[float, list[dict]]:
    """Expected calibration error and reliability bins (equal-width)."""
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    out, ece = [], 0.0
    for b in range(bins):
        m = idx == b
        if m.sum() == 0:
            continue
        mp, fy = float(p[m].mean()), float(y[m].mean())
        ece += m.sum() / len(p) * abs(mp - fy)
        out.append({"lo": round(float(edges[b]), 2), "hi": round(float(edges[b + 1]), 2), "n": int(m.sum()),
                    "mean_p": round(mp, 4), "freq": round(fy, 4)})
    return float(ece), out


def per_match_loss(scores: list[dict], target: str, kind: str) -> np.ndarray:
    """The per-match quantity behind the primary metric (abs error or log loss)."""
    vals = [s[target] for s in scores if target in s]
    if kind == "count":
        return np.array([abs(v["err"]) for v in vals])
    return np.array([v["ll"] for v in vals])


def summarise(scores: list[dict], target: str, kind: str) -> dict | None:
    vals = [s[target] for s in scores if target in s]
    if not vals:
        return None
    n = len(vals)
    if kind == "count":
        err = np.array([v["err"] for v in vals])
        nll = [v["nll"] for v in vals if v["nll"] is not None]
        return {"n": n, "mae": mae(err), "rmse": rmse(err), "bias": float(err.mean()),
                "mean_nll": float(np.mean(nll)) if nll else None,
                "coverage_50": float(np.mean([v["in50"] for v in vals])),
                "coverage_80": float(np.mean([v["in80"] for v in vals]))}
    if kind == "probability":
        p = np.array([v["p"] for v in vals])
        y = np.array([v["y"] for v in vals])
        ece, bins = calibration(p, y)
        return {"n": n, "log_loss": log_loss_binary(p, y), "brier": brier_binary(p, y), "ece": ece,
                "accuracy": float(np.mean((p >= 0.5) == (y == 1))), "base_rate": float(y.mean()),
                "mean_p": float(p.mean()), "calibration": bins}
    probs = np.array([v["probs"] for v in vals])
    y = np.array([v["y"] for v in vals])
    ece, bins = calibration(probs[:, 0], (y == 0).astype(float))
    return {"n": n, "log_loss": log_loss_multi(probs, y), "brier": brier_multi(probs, y),
            "accuracy": float(np.mean(probs.argmax(1) == y)), "ece": ece, "calibration": bins,
            "freq": [float(np.mean(y == i)) for i in range(3)], "mean_p": probs.mean(0).round(4).tolist()}


def paired_bootstrap(a: np.ndarray, b: np.ndarray, reps: int = 2000, seed: int = 0) -> tuple[float, float]:
    """95% CI of the relative improvement 100*(mean(b)-mean(a))/mean(b) of a over b."""
    rng = np.random.default_rng(seed)
    n = len(a)
    idx = rng.integers(0, n, size=(reps, n))
    ma, mb = a[idx].mean(1), b[idx].mean(1)
    rel = 100 * (mb - ma) / mb
    return float(np.percentile(rel, 2.5)), float(np.percentile(rel, 97.5))


def evaluate(frame: pd.DataFrame, models: list[str], baseline: str = "baseline") -> pd.DataFrame:
    """Metrics for every (model, target) on the matches in `frame`. Comparisons with the
    baseline use only matches where both have a prediction (identical test sets)."""
    rows = []
    by_model = {m: frame[frame.model == m].set_index("match_id") for m in models}
    base = by_model.get(baseline)
    for t in TARGETS:
        for m in models:
            f = by_model[m]
            ids = [i for i, s in f.scores.items() if t.key in s]
            if not ids:
                continue
            if base is not None and m != baseline:
                ids = [i for i in ids if i in base.index and t.key in base.scores[i]]
            if not ids:
                continue
            s = summarise(list(f.scores[ids]), t.key, t.kind)
            row = {"model": m, "target": t.key, "kind": t.kind, **{k: v for k, v in s.items()}}
            if base is not None:
                bs = summarise(list(base.scores[ids]), t.key, t.kind)
                pm = PRIMARY[t.kind]
                row["baseline_metric"] = bs[pm]
                row["improvement_pct"] = 100 * (bs[pm] - s[pm]) / bs[pm]
                if m != baseline:
                    la = per_match_loss(list(f.scores[ids]), t.key, t.kind)
                    lb = per_match_loss(list(base.scores[ids]), t.key, t.kind)
                    row["improvement_ci"] = paired_bootstrap(la, lb)
            row["eval_start"] = f.loc[ids, "match_date"].min()
            row["eval_end"] = f.loc[ids, "match_date"].max()
            rows.append(row)
    return pd.DataFrame(rows)
