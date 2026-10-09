"""Composite predictions (best model per target) and live predictions for upcoming fixtures."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd

from .backtest import make_model
from .config import LIVE_HORIZON_DAYS, TARGETS
from .derive import derive
from .explain import explain

COUNT_TARGETS = [t.key for t in TARGETS if t.kind == "count"]

# Live predictions also keep the full distribution of each match total, so the site can
# show the model's most likely outcomes with their probabilities (e.g. "8-9 corners: 24%").
PMF_STATS = ["goals", "shots", "sot", "corners", "yellows"]


def compact_pmf(p, mass: float = 0.9995) -> list[float]:
    """P(total = 0), P(total = 1), ... until `mass` of the probability is covered."""
    out, cum = [], 0.0
    for x in p:
        out.append(round(float(x), 4))
        cum += float(x)
        if cum >= mass:
            break
    return out


def composite(values_by_model: dict[str, dict], selection: dict[str, str]) -> tuple[dict, dict]:
    """Assemble one prediction from the model selected for each target.
    Returns (values, target -> model)."""
    values: dict[str, object] = {}
    used: dict[str, str] = {}
    for target, model in selection.items():
        v = values_by_model.get(model, {}).get(target)
        if v is not None:
            values[target] = v
            used[target] = model
            pmf = values_by_model.get(model, {}).get(f"{target}_pmf")
            if pmf is not None:  # distribution from the same model as the target
                values[f"{target}_pmf"] = pmf
    # Most likely scorelines come from the model that produced the goal expectations.
    gm = selection.get("goals_home")
    if gm and "top_scorelines" in values_by_model.get(gm, {}):
        values["top_scorelines"] = values_by_model[gm]["top_scorelines"]
        used["top_scorelines"] = gm
    return values, used


def eligible_fixtures(matches: pd.DataFrame, now: datetime, horizon_days: int = LIVE_HORIZON_DAYS) -> pd.DataFrame:
    """Verified upcoming fixtures: published in the schedule, not completed, kickoff
    in the future and within the prediction horizon."""
    m = matches
    ko = m.kickoff_utc
    return m[(m.status == "scheduled") & ko.notna() & (ko > pd.Timestamp(now)) &
             (ko <= pd.Timestamp(now + timedelta(days=horizon_days)))]


def predict_live(data: pd.DataFrame, configs: dict[str, dict], selection: dict[str, str], now: datetime | None = None,
                 horizon_days: int = LIVE_HORIZON_DAYS) -> tuple[list[dict], dict]:
    """Fit every selected model on all completed matches and predict eligible fixtures.

    `data` holds matches joined with features; features for scheduled fixtures were
    computed from completed matches only (features.py)."""
    now = now or datetime.now(timezone.utc)
    completed = data[data.status == "completed"]
    cutoff = pd.Timestamp(now.date())
    train = completed[completed.match_date < cutoff + pd.Timedelta(days=1)]
    fixtures = eligible_fixtures(data, now, horizon_days)
    info = {"now": now.isoformat(), "cutoff_last_match": str(train.match_date.max().date()),
            "eligible": len(fixtures), "horizon_days": horizon_days}
    if fixtures.empty:
        return [], info
    needed = sorted(set(selection.values()))
    per_model: dict[str, dict[str, dict]] = {}
    explanations: dict[str, dict] = {}
    for name in needed:
        model = make_model(name, configs.get(name)).fit(train, cutoff)
        per_model[name] = {}
        for p in model.predict(fixtures):
            vals, pmfs = derive(p)
            for s in PMF_STATS:
                if f"{s}_total" in pmfs and f"{s}_total" in vals:
                    vals[f"{s}_total_pmf"] = compact_pmf(pmfs[f"{s}_total"])
            per_model[name][p.match_id] = vals
        if name == selection.get("outcome"):
            explanations = explain(name, model, fixtures)
            for mid, e in explanations.items():
                e["model_name"] = name
                e["outcome"] = per_model[name][mid].get("outcome")
    out = []
    for mid, r in fixtures.iterrows():
        vals_by_model = {m: per_model[m][mid] for m in needed}
        values, used = composite(vals_by_model, selection)
        out.append({"match_id": mid, "home_team": r.home_team, "away_team": r.away_team,
                    "kickoff_utc": r.kickoff_utc, "match_date": r.match_date, "values": values,
                    "target_models": used, "per_model": vals_by_model, "explanation": explanations.get(mid)})
    return out, info
