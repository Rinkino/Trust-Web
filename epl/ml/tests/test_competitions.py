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


def test_divisions_only_link_within_a_country():
    """A club that played in the Championship last season is not 'promoted' into La Liga."""
    rng = np.random.default_rng(5)
    rows = []
    for r in make_season(2021, rng, LOW):
        r["competition"] = "ELC"
        rows.append(r)
    spain = ["Barcelona", "Real Madrid", "Sevilla", "Betis", "Valencia", "Leeds"]   # Leeds: artificial overlap
    for r in make_season(2022, rng, spain):
        r["competition"] = "LALIGA"
        rows.append(r)
    m = to_frame(rows)
    f = build_features(m).join(m.set_index("match_id")[["season", "home_team", "competition"]])
    leeds = f[(f.competition == "LALIGA") & (f.home_team == "Leeds")]
    assert len(leeds) and (leeds.h_from_below == 0).all() and (leeds.h_prev_tier_ppg == 0).all()


def test_check_names_lists_unknown_teams_and_writes_nothing(tmp_path, capsys):
    from eplpred.pipeline import main

    raw = tmp_path / "raw"
    raw.mkdir()
    header = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HS,AS,HST,AST,HC,AC,HY,AY,HR,AR"
    lines = [header,
             "SP1,15/08/2025,20:00,Barcelona,Atlantis CF,2,0,H,10,5,4,2,6,3,1,2,0,0",
             "SP1,16/08/2025,20:00,Sevilla,Betis,1,1,D,9,9,3,3,4,4,2,2,0,0"]
    (raw / "SP1_2526.csv").write_text("\n".join(lines) + "\n")
    assert main(["--raw-dir", str(raw), "--check-names", "--competitions", "LALIGA"]) == 0
    out = capsys.readouterr().out
    assert "Atlantis CF" in out and "1 unknown" in out
    assert "LALIGA completed: 1" in out
    assert sorted(p.name for p in tmp_path.iterdir()) == ["raw"]   # nothing written


def test_unknown_competition_is_refused():
    import pytest
    from eplpred.pipeline import main

    with pytest.raises(SystemExit):
        main(["--check-names", "--competitions", "MLS"])


def test_upcoming_list_replaces_placeholder_kickoffs():
    """The schedule feed can show 00:00 on the round's first day before times are set;
    football-data's coming-week list then gives the real date and UK kickoff time."""
    from eplpred.ingest import merge_sources, parse_upcoming_csv

    csv_text = ("Div,Date,Time,HomeTeam,AwayTeam,AvgH\n"
                "D1,10/10/2026,14:30,Dortmund,Werder Bremen,1.6\n"
                "D1,10/10/2026,17:30,Hoffenheim,Hamburg,1.9\n"
                "E0,10/10/2026,12:30,Arsenal,Chelsea,2.0\n"          # another league: ignored
                "D1,11/10/2026,15:30,Atlantis,Hamburg,2.0\n")        # unknown team: rejected
    up = parse_upcoming_csv(csv_text.encode(), "u", {"D1": "BUNDESLIGA"})
    assert len(up.rows) == 2 and len(up.rejected) == 1
    placeholder = {"status": "scheduled", "competition": "BUNDESLIGA", "season": "2026-27",
                   "match_date": "2026-10-09", "kickoff_time": "01:00", "kickoff_utc": "2026-10-09T00:00:00+00:00"}
    fixtures = [{**placeholder, "match_id": "2026-27_dortmund_werder-bremen", "home_team": "Dortmund", "away_team": "Werder Bremen"}]
    played = {**placeholder, "match_id": "2026-27_hoffenheim_hamburg", "status": "completed", "fthg": 1, "ftag": 0}
    rows, rep = merge_sources([played], fixtures, up.rows)
    by = {r["match_id"]: r for r in rows}
    d = by["2026-27_dortmund_werder-bremen"]
    assert d["match_date"] == "2026-10-10" and d["kickoff_utc"] == "2026-10-10T13:30:00+00:00" and d["kickoff_time"] == "14:30"
    assert by["2026-27_hoffenheim_hamburg"]["kickoff_utc"] == "2026-10-09T00:00:00+00:00"   # results are never moved
    assert rep.kickoffs_corrected == 1
