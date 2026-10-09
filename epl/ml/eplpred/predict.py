"""Composite predictions (best model per target) and live predictions for upcoming fixtures."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd

from .backtest import make_model
from .config import LIVE_HORIZON_DAYS, TARGETS
from .derive import derive

COUNT_TARGETS = [t.key for t in TARGETS if t.kind == "count"]


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
    for name in needed:
        model = make_model(name, configs.get(name)).fit(train, cutoff)
        per_model[name] = {p.match_id: derive(p)[0] for p in model.predict(fixtures)}
    out = []
    for mid, r in fixtures.iterrows():
        vals_by_model = {m: per_model[m][mid] for m in needed}
        values, used = composite(vals_by_model, selection)
        out.append({"match_id": mid, "home_team": r.home_team, "away_team": r.away_team,
                    "kickoff_utc": r.kickoff_utc, "match_date": r.match_date, "values": values,
                    "target_models": used, "per_model": vals_by_model})
    return out, info
