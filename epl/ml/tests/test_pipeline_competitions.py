"""End to end, offline: two divisions in football-data's file format through the whole pipeline."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import pytest

from conftest import make_season

TOP = ["Arsenal", "Chelsea", "Liverpool", "Everton", "Fulham", "Brentford"]
LOW = ["Leeds", "Burnley", "Sunderland", "Norwich", "Watford", "Millwall"]
HEADER = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,HS,AS,HST,AST,HF,AF,HC,AC,HY,AY,HR,AR,AvgH,AvgD,AvgA,Avg>2.5,Avg<2.5"


def _write(tmp, now):
    rng = np.random.default_rng(11)
    top, low = TOP[:], LOW[:]
    fixtures = {"EPL": [], "ELC": []}
    for y in range(2018, 2027):
        for comp, div, teams in (("EPL", "E0", top), ("ELC", "E1", low)):
            lines = [HEADER]
            for r in make_season(y, rng, teams):
                d = r["match_date"]
                if y == 2026 and d >= pd.Timestamp(now.date()):
                    fixtures[comp].append({"DateUtc": f"{d.date()} 14:00:00Z", "HomeTeam": r["home_team"], "AwayTeam": r["away_team"], "RoundNumber": r["round"]})
                    continue
                lines.append(",".join(str(x) for x in [div, d.strftime("%d/%m/%Y"), "15:00", r["home_team"], r["away_team"], r["fthg"], r["ftag"],
                             r["ftr"], 0, 0, "D", "Ref", r["hs"], r["as"], r["hst"], r["ast"], r["hf"], r["af"], r["hc"], r["ac"],
                             r["hy"], r["ay"], r["hr"], r["ar"], 2.2, 3.3, 3.4, 1.9, 1.9]))
            if comp == "ELC" and len(lines) > 3:
                # a blank statistic, as in real lower-division files
                cells = lines[3].split(",")
                cells[HEADER.split(",").index("HS")] = ""
                lines[3] = ",".join(cells)
            (tmp / f"{div}_{y % 100:02d}{(y + 1) % 100:02d}.csv").write_text("\n".join(lines) + "\n")
        # one swap each summer
        out_top, out_low = top[(y % len(top))], low[(y % len(low))]
        top = [t for t in top if t != out_top] + [out_low]
        low = [t for t in low if t != out_low] + [out_top]
    for comp, slug in (("EPL", "epl"), ("ELC", "championship")):
        (tmp / f"fixturedownload_{slug}-2026.json").write_text(json.dumps(fixtures[comp]))


def test_both_divisions_run_end_to_end(tmp_path):
    from eplpred.pipeline import main

    now = datetime.now(timezone.utc)
    raw = tmp_path / "raw"
    raw.mkdir()
    _write(raw, now)
    out = tmp_path / "out"
    assert main(["--raw-dir", str(raw), "--out", str(out), "--quick", "--jobs", "1"]) == 0

    def rows(table):
        p = out / f"{table}.jsonl"
        return [json.loads(x) for x in p.read_text().splitlines()] if p.exists() else []

    for table in ("epl_model_evaluations", "epl_target_selection", "epl_model_registry", "epl_value_backtest"):
        comps = {r["competition"] for r in rows(table)}
        assert comps == {"EPL", "ELC"}, (table, comps)
    live = [r for r in rows("epl_predictions") if r["mode"] == "live" and r["model_name"] == "selected"]
    assert {r["competition"] for r in live} == {"EPL", "ELC"}
    # each competition's selection is versioned separately
    sel = rows("epl_target_selection")
    assert len({(r["competition"], r["selection_version"]) for r in sel}) == 2
    assert (out / "EPL" / "summary.json").exists() and (out / "ELC" / "summary.json").exists()
