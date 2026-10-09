"""Synthetic but realistic league data for fast, offline tests."""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

TEAMS = ["Arsenal", "Chelsea", "Liverpool", "Everton", "Fulham", "Brentford"]


@pytest.fixture(autouse=True)
def _never_upload(monkeypatch):
    """Tests run inside the pipeline job, where GitHub's OIDC variables would let the
    writer reach the real database. Without them every write goes to local files."""
    monkeypatch.delenv("ACTIONS_ID_TOKEN_REQUEST_URL", raising=False)
    monkeypatch.delenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN", raising=False)


def make_season(start_year: int, rng: np.random.Generator, teams=TEAMS) -> list[dict]:
    """Double round robin, one round a week from mid August."""
    season = f"{start_year}-{(start_year + 1) % 100:02d}"
    rows = []
    n = len(teams)
    rounds = []
    order = teams[:]
    for _ in range(n - 1):
        rounds.append([(order[i], order[n - 1 - i]) for i in range(n // 2)])
        order = [order[0]] + [order[-1]] + order[1:-1]
    rounds += [[(a, h) for h, a in r] for r in rounds]
    d0 = date(start_year, 8, 16)
    strength = {t: rng.normal(0, 0.3) for t in teams}
    for ri, r in enumerate(rounds):
        day = d0 + timedelta(days=7 * ri)
        for h, a in r:
            mh = np.exp(0.35 + strength[h] - strength[a] * 0.5)
            ma = np.exp(0.1 + strength[a] - strength[h] * 0.5)
            gh, ga = int(rng.poisson(mh)), int(rng.poisson(ma))
            hs, as_ = int(rng.poisson(13)), int(rng.poisson(10))
            rows.append({
                "match_id": f"{season}_{h.lower()}_{a.lower()}", "season": season, "competition": "EPL",
                "match_date": pd.Timestamp(day), "kickoff_utc": pd.Timestamp(f"{day} 14:00", tz="UTC"),
                "kickoff_time": "15:00", "round": ri + 1, "home_team": h, "away_team": a, "status": "completed",
                "fthg": gh, "ftag": ga, "ftr": "H" if gh > ga else "A" if gh < ga else "D", "hthg": 0, "htag": 0,
                "hs": max(hs, gh + 1), "as": max(as_, ga + 1), "hst": gh + int(rng.poisson(2)), "ast": ga + int(rng.poisson(2)),
                "hc": int(rng.poisson(5.5)), "ac": int(rng.poisson(4.5)), "hf": int(rng.poisson(11)), "af": int(rng.poisson(11)),
                "hy": int(rng.poisson(1.6)), "ay": int(rng.poisson(1.8)), "hr": int(rng.random() < 0.05), "ar": int(rng.random() < 0.07),
                "odds_avg_h": 2.2, "odds_avg_d": 3.3, "odds_avg_a": 3.4, "odds_avg_over25": 1.9, "odds_avg_under25": 1.9,
                "source": "test",
            })
    for r in rows:
        r["hst"] = min(r["hst"], r["hs"])
        r["ast"] = min(r["ast"], r["as"])
    return rows


def to_frame(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    for c in ["fthg", "ftag", "hthg", "htag", "hs", "as", "hst", "ast", "hc", "ac", "hf", "af", "hy", "ay", "hr", "ar"]:
        df[c] = df[c].astype("Float64")
    return df.sort_values(["match_date", "match_id"]).reset_index(drop=True)


@pytest.fixture(scope="session")
def league() -> pd.DataFrame:
    rng = np.random.default_rng(7)
    rows = []
    for y in range(2018, 2024):
        rows += make_season(y, rng)
    return to_frame(rows)
