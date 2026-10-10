"""Two divisions linked by promotion and relegation."""
from __future__ import annotations

import numpy as np
import pandas as pd

from conftest import make_season, to_frame
from eplpred.features import build_features, season_records

TOP = ["Arsenal", "Chelsea", "Liverpool", "Everton", "Fulham", "Brentford"]
LOW = ["Leeds", "Burnley", "Sunderland", "Norwich", "Watford", "Millwall"]


def two_divisions():
    """2021-22: TOP / LOW. From 2022-23 Fulham (relegated) and Leeds (promoted) swap."""
    rng = np.random.default_rng(3)
    rows = []
    top, low = TOP[:], LOW[:]
    for y in (2021, 2022):
        for comp, teams in (("EPL", top), ("ELC", low)):
            for r in make_season(y, rng, teams):
                r["competition"] = comp
                rows.append(r)
        top = [t for t in top if t != "Fulham"] + ["Leeds"]
        low = [t for t in low if t != "Leeds"] + ["Fulham"]
    return to_frame(rows)


def test_teams_carry_last_season_from_the_other_division():
    m = two_divisions()
    f = m.set_index("match_id").join(build_features(m))
    rec = season_records(m, {"EPL": 1, "ELC": 2})
    leeds_prev = rec[("2021-22", "Leeds")]
    assert leeds_prev.tier == 2

    leeds_home = f[(f.season == "2022-23") & (f.home_team == "Leeds")].iloc[0]
    assert leeds_home.h_from_below == 1 and leeds_home.h_from_above == 0 and leeds_home.h_promoted == 1
    assert abs(leeds_home.h_prev_tier_ppg - leeds_prev.ppg) < 1e-9

    fulham_home = f[(f.season == "2022-23") & (f.home_team == "Fulham")].iloc[0]
    assert fulham_home.competition == "ELC"
    assert fulham_home.h_from_above == 1 and fulham_home.h_promoted == 0
    assert abs(fulham_home.h_prev_tier_ppg - rec[("2021-22", "Fulham")].ppg) < 1e-9

    # Teams that stayed put carry nothing over.
    stay = f[(f.season == "2022-23") & (f.home_team == "Arsenal")].iloc[0]
    assert stay.h_from_above == 0 and stay.h_from_below == 0 and stay.h_prev_tier_ppg == 0


def test_each_division_keeps_its_own_league_averages():
    m = two_divisions()
    m.loc[m.competition == "ELC", ["hc", "ac"]] += 10           # a very different corner environment
    f = m.set_index("match_id").join(build_features(m))
    late = f[f.season == "2022-23"]
    epl, elc = late[late.competition == "EPL"], late[late.competition == "ELC"]
    assert elc.lg_corners_home.mean() > epl.lg_corners_home.mean() + 8


def test_previous_season_only_no_same_season_leakage():
    m = two_divisions()
    f = m.set_index("match_id").join(build_features(m))
    first = f[f.season == "2021-22"]
    # No earlier season exists, so nothing can be carried over in the first season.
    assert (first.h_prev_tier_ppg == 0).all() and (first.a_prev_tier_ppg == 0).all()


def test_actual_values_treat_pandas_na_as_missing():
    """Real lower-division files have the odd blank statistic, read as pd.NA."""
    import pandas as pd
    from eplpred.derive import actual_values

    row = pd.Series({"fthg": 2, "ftag": 1, "hs": pd.NA, "as": 9, "hst": 4, "ast": 3,
                     "hc": 5, "ac": pd.NA, "hy": 1, "ay": 2, "hr": 0, "ar": 0}).astype("Int64")
    out = actual_values(row)
    assert out["shots_home"] is None and out["shots_total"] is None
    assert out["corners_away"] is None and out["corners_total"] is None
    assert out["goals_total"] == 3.0 and out["outcome"] == 0
