"""Static configuration: seasons, sources, targets and evaluation periods."""
from __future__ import annotations

from dataclasses import dataclass

FOOTBALL_DATA_BASE = "https://www.football-data.co.uk/mmz4281"
FIXTURE_JSON_URL = "https://fixturedownload.com/feed/json/epl-{year}"

FIRST_SEASON_START = 2000          # 2000/01 is the first season with match statistics
CURRENT_SEASON_START = 2026        # 2026/27


def season_label(start_year: int) -> str:
    """2025 -> '2025-26'."""
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def season_code(start_year: int) -> str:
    """2025 -> '2526' (football-data.co.uk folder name)."""
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def season_start_year(label: str) -> int:
    return int(label[:4])


def football_data_url(start_year: int) -> str:
    return f"{FOOTBALL_DATA_BASE}/{season_code(start_year)}/E0.csv"


ALL_SEASONS = [season_label(y) for y in range(FIRST_SEASON_START, CURRENT_SEASON_START + 1)]

# ── Evaluation design ───────────────────────────────────────────────────────────
# Chronological, never random. Each later period only ever sees earlier data.
TUNING_SEASONS = ["2022-23"]                    # hyper-parameter choice
VALIDATION_SEASONS = ["2023-24", "2024-25"]     # model selection per target
TEST_SEASONS = ["2025-26"]                      # held out: reported, never used for choices
LIVE_SEASON = season_label(CURRENT_SEASON_START)

# Rows before this date are used only to warm up ratings and rolling features.
TRAIN_FROM = "2003-07-01"

# Live predictions are made for fixtures kicking off within this horizon. Further-out
# fixtures would be predicted from information that will be stale by kickoff.
LIVE_HORIZON_DAYS = 21

# ── Targets ─────────────────────────────────────────────────────────────────────
# Count statistics modelled per side. Column names follow football-data.co.uk.
STATS: dict[str, tuple[str, str]] = {
    "goals":   ("fthg", "ftag"),
    "shots":   ("hs", "as"),
    "sot":     ("hst", "ast"),
    "corners": ("hc", "ac"),
    "yellows": ("hy", "ay"),
    "reds":    ("hr", "ar"),
}
# Statistics used as inputs only.
EXTRA_FEATURE_STATS: dict[str, tuple[str, str]] = {"fouls": ("hf", "af")}


@dataclass(frozen=True)
class Target:
    key: str                 # stable identifier stored in the database
    kind: str                # 'count' | 'probability' | 'outcome'
    label: str
    group: str
    stat: str | None = None
    side: str | None = None  # 'home' | 'away' | 'total'
    threshold: float | None = None


def _count(stat: str, label: str, group: str) -> list[Target]:
    return [
        Target(f"{stat}_home", "count", f"Home {label}", group, stat, "home"),
        Target(f"{stat}_away", "count", f"Away {label}", group, stat, "away"),
        Target(f"{stat}_total", "count", f"Total {label}", group, stat, "total"),
    ]


TARGETS: list[Target] = [
    *_count("goals", "goals", "Goals"),
    Target("outcome", "outcome", "Match result (H/D/A)", "Goals"),
    Target("goals_over_1_5", "probability", "Over 1.5 goals", "Goals", "goals", "total", 1.5),
    Target("goals_over_2_5", "probability", "Over 2.5 goals", "Goals", "goals", "total", 2.5),
    Target("goals_over_3_5", "probability", "Over 3.5 goals", "Goals", "goals", "total", 3.5),
    Target("btts", "probability", "Both teams score", "Goals", "goals"),
    *_count("shots", "shots", "Shots"),
    *_count("sot", "shots on target", "Shots"),
    *_count("corners", "corners", "Corners"),
    Target("corners_over_8_5", "probability", "Over 8.5 corners", "Corners", "corners", "total", 8.5),
    Target("corners_over_9_5", "probability", "Over 9.5 corners", "Corners", "corners", "total", 9.5),
    Target("corners_over_10_5", "probability", "Over 10.5 corners", "Corners", "corners", "total", 10.5),
    *_count("yellows", "yellow cards", "Cards"),
    Target("yellows_at_least_4", "probability", "4+ yellow cards", "Cards", "yellows", "total", 3.5),
    Target("red_home", "probability", "Home red card", "Cards", "reds", "home", 0.5),
    Target("red_away", "probability", "Away red card", "Cards", "reds", "away", 0.5),
]
TARGET_BY_KEY = {t.key: t for t in TARGETS}

# Ordered from simplest to most complex. Ties go to the simpler model.
MODEL_ORDER = ["baseline", "team_avg", "poisson_strength", "glm", "logit_outcome", "hgb", "hgb_outcome"]
REFERENCE_MODELS = ["market"]          # evaluated for context only, never selected

# A model must beat the next-simpler choice by at least this much (relative) on the
# validation metric before the extra complexity is accepted.
SIMPLER_MODEL_TOLERANCE = 0.005
