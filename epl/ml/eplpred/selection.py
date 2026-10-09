"""Hyper-parameter tuning (earlier season) and per-target model selection (later seasons).

Neither step ever looks at the held-out test season.
"""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

from .backtest import DEFAULT_CONFIG, walk_forward
from .config import MODEL_ORDER, SIMPLER_MODEL_TOLERANCE, TARGETS
from .metrics import PRIMARY, evaluate, paired_bootstrap, per_match_loss

GRIDS: dict[str, dict[str, list]] = {
    "poisson_strength": {"halflife_days": [120.0, 240.0, 480.0], "l2": [2.0, 8.0, 32.0]},
    "glm": {"alpha": [1.0, 3.0, 10.0]},
    "hgb": {"max_iter": [50, 100, 250], "min_samples_leaf": [40, 120]},
    "logit_outcome": {"C": [0.001, 0.003, 0.01, 0.1]},
    "hgb_outcome": {"max_iter": [50, 100, 250]},
}


def _grid(name: str) -> list[dict]:
    g = GRIDS.get(name)
    if not g:
        return [DEFAULT_CONFIG[name]]
    keys = list(g)
    return [dict(zip(keys, vals)) for vals in itertools.product(*(g[k] for k in keys))]


def tune(data: pd.DataFrame, seasons: list[str], n_jobs: int = 1, log=print) -> tuple[dict[str, dict], pd.DataFrame]:
    """For each tunable model pick the configuration with the lowest mean
    (metric / baseline metric) over the targets it predicts, on `seasons` only."""
    base = walk_forward(data, seasons, {"baseline": {}}, n_jobs=n_jobs).frame()
    chosen = dict(DEFAULT_CONFIG)
    rows = []
    for name in GRIDS:
        best, best_score = None, np.inf
        for cfg in _grid(name):
            fr = pd.concat([base, walk_forward(data, seasons, {name: cfg}, n_jobs=n_jobs).frame()])
            ev = evaluate(fr, ["baseline", name])
            ev = ev[ev.model == name]
            rel = [r[PRIMARY[r["kind"]]] / r["baseline_metric"] for r in ev.to_dict("records")]
            score = float(np.mean(rel))
            rows.append({"model": name, "config": cfg, "relative_score": score, "targets": len(rel)})
            log(f"  tune {name} {cfg}: {score:.4f}")
            if score < best_score:
                best, best_score = cfg, score
        chosen[name] = best
    return chosen, pd.DataFrame(rows)


def select(eval_val: pd.DataFrame, frame_val: pd.DataFrame) -> pd.DataFrame:
    """Per target: rank candidates by the primary metric on the validation seasons.
    Starting from the simplest model, a more complex model replaces the current
    choice only if it is better by more than SIMPLER_MODEL_TOLERANCE (relative).
    A target is flagged unreliable when the chosen model does not beat the
    league-average baseline with a bootstrap CI that excludes zero."""
    out = []
    for t in TARGETS:
        ev = eval_val[(eval_val.target == t.key) & eval_val.model.isin(MODEL_ORDER)]
        if ev.empty:
            continue
        pm = PRIMARY[t.kind]
        ev = ev.set_index("model")
        order = [m for m in MODEL_ORDER if m in ev.index]
        current = order[0]
        for m in order[1:]:
            if ev.loc[m, pm] < ev.loc[current, pm] * (1 - SIMPLER_MODEL_TOLERANCE):
                current = m
        best_raw = ev[pm].idxmin()
        reliable, ci = False, None
        if current != "baseline":
            fa = frame_val[frame_val.model == current].set_index("match_id")
            fb = frame_val[frame_val.model == "baseline"].set_index("match_id")
            ids = [i for i in fa.index if t.key in fa.scores[i] and i in fb.index and t.key in fb.scores[i]]
            la = per_match_loss(list(fa.scores[ids]), t.key, t.kind)
            lb = per_match_loss(list(fb.scores[ids]), t.key, t.kind)
            ci = paired_bootstrap(la, lb)
            reliable = ci[0] > 0
        imp = float(ev.loc[current, "improvement_pct"]) if current != "baseline" else 0.0
        if current == "baseline":
            reason = "No candidate beat the league-average baseline by more than the tolerance on validation."
        else:
            reason = (f"Lowest {pm} among candidates after preferring simpler models within "
                      f"{SIMPLER_MODEL_TOLERANCE:.1%}; {imp:+.1f}% vs baseline on validation")
            if best_raw != current:
                reason += f" ({best_raw} was marginally lower but not by enough to justify the complexity)"
            if not reliable:
                reason += "; improvement not statistically distinguishable from zero"
        out.append({"target": t.key, "kind": t.kind, "selected": current, "primary_metric": pm,
                    "metric": float(ev.loc[current, pm]), "baseline_metric": float(ev.loc["baseline", pm]),
                    "improvement_pct": imp, "improvement_ci": ci, "reliable": bool(reliable), "best_raw": best_raw,
                    "reason": reason, "candidates": {m: float(ev.loc[m, pm]) for m in order}})
    return pd.DataFrame(out)
