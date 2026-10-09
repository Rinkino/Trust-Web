import json

import pytest

from eplpred.ingest import make_match_id, merge_sources, parse_date, parse_fixture_json, parse_football_data
from eplpred.teams import UnknownTeam, normalize_team

HEADER = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,HS,AS,HST,AST,HF,AF,HC,AC,HY,AY,HR,AR,AvgH,AvgD,AvgA"
URL = "https://example/2425/E0.csv"


def csv(*lines: str) -> bytes:
    return ("﻿" + "\n".join([HEADER, *lines]) + "\n").encode("utf-8")


GOOD = "E0,16/08/2024,20:00,Man United,Fulham,1,0,H,0,0,D,R Jones,14,10,5,2,12,10,7,8,2,3,0,0,1.6,4.2,5.5"


def test_parses_valid_row_and_normalises():
    r = parse_football_data(csv(GOOD), 2024, URL)
    assert r.rejected == []
    row = r.rows[0]
    assert row["home_team"] == "Man United" and row["away_team"] == "Fulham"
    assert row["match_date"] == "2024-08-16"
    assert row["kickoff_time"] == "20:00"
    assert row["kickoff_utc"].startswith("2024-08-16T19:00")  # BST -> UTC
    assert row["fthg"] == 1 and row["ftr"] == "H" and row["hs"] == 14 and row["hr"] == 0
    assert row["match_id"] == "2024-25_man-united_fulham"
    assert row["source"] == "football-data.co.uk" and row["source_url"] == URL


def test_team_name_variants_map_to_one_canonical_name():
    for name in ["Man Utd", "Manchester United", "man united", "  Man United "]:
        assert normalize_team(name) == "Man United"
    assert normalize_team("Spurs") == "Tottenham"
    assert normalize_team("Nottm Forest") == "Nott'm Forest"
    with pytest.raises(UnknownTeam):
        normalize_team("Real Madrid")


def test_two_and_four_digit_years():
    assert str(parse_date("16/08/24")) == "2024-08-16"
    assert str(parse_date("16/08/2024")) == "2024-08-16"
    with pytest.raises(ValueError):
        parse_date("2024-08-16")


def test_duplicate_fixture_rejected():
    r = parse_football_data(csv(GOOD, GOOD), 2024, URL)
    assert len(r.rows) == 1 and len(r.rejected) == 1
    assert "duplicate" in r.rejected[0]["reason"]


def test_missing_statistics_become_null_not_zero():
    line = "E0,17/08/2024,15:00,Arsenal,Wolves,2,0,H,1,0,H,,,,,,,,,,,,,,,,"
    r = parse_football_data(csv(line), 2024, URL)
    row = r.rows[0]
    assert row["hs"] is None and row["hc"] is None and row["hy"] is None
    assert row["fthg"] == 2


@pytest.mark.parametrize("line,reason", [
    ("E0,17/08/2024,15:00,Arsenal,Wolves,-1,0,H,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "implausible"),
    ("E0,17/08/2024,15:00,Arsenal,Wolves,2,0,A,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "contradicts"),
    ("E0,17/08/2024,15:00,Arsenal,Wolves,,0,H,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "missing full-time"),
    ("E0,17/08/2024,15:00,Arsenal,Arsenal,1,0,H,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "identical"),
    ("E0,17/08/2024,15:00,Arsenal,Atlantis FC,1,0,H,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "unknown team"),
    ("E0,17/08/2019,15:00,Arsenal,Wolves,1,0,H,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "outside season"),
    ("E0,17/08/2024,15:00,Arsenal,Wolves,1,0,H,2,0,H,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "half-time"),
    ("E0,17/08/2024,15:00,Arsenal,Wolves,1.5,0,H,0,0,D,,1,1,1,1,1,1,1,1,1,1,0,0,,,", "non-integer"),
])
def test_invalid_records_are_rejected_with_reason(line, reason):
    r = parse_football_data(csv(line), 2024, URL)
    assert r.rows == []
    assert reason in r.rejected[0]["reason"]


def test_empty_trailing_fields_tolerated_but_data_in_extras_rejected():
    ok = parse_football_data(csv(GOOD + ",,,"), 2024, URL)
    assert len(ok.rows) == 1 and any("trailing" in w for w in ok.warnings)
    bad = parse_football_data(csv(GOOD + ",9"), 2024, URL)
    assert bad.rows == [] and "more fields" in bad.rejected[0]["reason"]


def test_shots_on_target_above_shots_blanked_but_result_kept():
    line = "E0,17/08/2024,15:00,Arsenal,Wolves,2,0,H,1,0,H,,5,4,9,1,1,1,1,1,1,1,0,0,,,"
    r = parse_football_data(csv(line), 2024, URL)
    row = r.rows[0]
    assert row["hs"] is None and row["hst"] is None and row["fthg"] == 2


def test_latin1_files_and_missing_required_columns():
    raw = ("Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,Referee\nE0,19/08/00,Charlton,Man City,4,0,H,M\xe9ndez\n").encode("cp1252")
    r = parse_football_data(raw, 2000, URL)
    assert len(r.rows) == 1 and r.rows[0]["referee"] == "Mndez"
    broken = parse_football_data(b"Div,Date,HomeTeam\nE0,19/08/00,Charlton\n", 2000, URL)
    assert broken.rows == [] and "missing required" in broken.warnings[0]


def test_fixture_feed_and_merge():
    feed = [
        {"RoundNumber": 1, "DateUtc": "2024-08-16 19:00:00Z", "HomeTeam": "Man Utd", "AwayTeam": "Fulham",
         "HomeTeamScore": 1, "AwayTeamScore": 0},
        {"RoundNumber": 2, "DateUtc": "2024-08-24 14:00:00Z", "HomeTeam": "Spurs", "AwayTeam": "Everton",
         "HomeTeamScore": None, "AwayTeamScore": None},
        {"RoundNumber": 2, "DateUtc": "2024-08-24 14:00:00Z", "HomeTeam": "Spurs", "AwayTeam": "Everton",
         "HomeTeamScore": None, "AwayTeamScore": None},
    ]
    fx = parse_fixture_json(json.dumps(feed).encode(), 2024, "https://feed")
    assert len(fx.rows) == 2 and len(fx.rejected) == 1
    results = parse_football_data(csv(GOOD), 2024, URL).rows
    merged, rep = merge_sources(results, fx.rows)
    by = {r["match_id"]: r for r in merged}
    assert by["2024-25_man-united_fulham"]["status"] == "completed"
    assert by["2024-25_tottenham_everton"]["status"] == "scheduled"
    assert rep.conflicts == []
    # A disagreeing score in the schedule feed is reported, never applied.
    feed[0]["HomeTeamScore"] = 3
    fx2 = parse_fixture_json(json.dumps(feed[:1]).encode(), 2024, "https://feed")
    merged2, rep2 = merge_sources(results, fx2.rows)
    assert len(rep2.conflicts) == 1
    assert {r["match_id"]: r for r in merged2}["2024-25_man-united_fulham"]["fthg"] == 1


def test_match_id_is_stable_across_sources():
    assert make_match_id("2024-25", normalize_team("Spurs"), normalize_team("Man Utd")) == "2024-25_tottenham_man-united"
