"""Parse, validate and normalise source files into match rows.

Two sources:
  * football-data.co.uk season CSVs: completed results and match statistics (ground truth)
  * fixturedownload.com season JSON: the published schedule, used for upcoming fixtures

Nothing here touches the network; `fetch.py` downloads and this module validates.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass, field
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from .config import season_label
from .teams import UnknownTeam, normalize_team, slug

LONDON = ZoneInfo("Europe/London")

# Our column -> accepted source column names (first present wins). football-data
# renamed a few columns over the years, so every field lists its variants.
COLUMN_MAP: dict[str, tuple[str, ...]] = {
    "date": ("Date",), "time": ("Time",),
    "home_team": ("HomeTeam", "HT"), "away_team": ("AwayTeam", "AT"),
    "fthg": ("FTHG", "HG"), "ftag": ("FTAG", "AG"), "ftr": ("FTR", "Res"),
    "hthg": ("HTHG",), "htag": ("HTAG",),
    "hs": ("HS",), "as": ("AS",), "hst": ("HST",), "ast": ("AST",),
    "hc": ("HC",), "ac": ("AC",), "hf": ("HF",), "af": ("AF",),
    "hy": ("HY",), "ay": ("AY",), "hr": ("HR",), "ar": ("AR",),
    "hxg": ("HxG",), "axg": ("AxG",),
    "referee": ("Referee",),
    "odds_avg_h": ("AvgH", "BbAvH"), "odds_avg_d": ("AvgD", "BbAvD"), "odds_avg_a": ("AvgA", "BbAvA"),
    "odds_avg_over25": ("Avg>2.5", "BbAv>2.5"), "odds_avg_under25": ("Avg<2.5", "BbAv<2.5"),
}
REQUIRED = ("date", "home_team", "away_team", "fthg", "ftag")
INT_STATS = ("fthg", "ftag", "hthg", "htag", "hs", "as", "hst", "ast", "hc", "ac", "hf", "af", "hy", "ay", "hr", "ar")
FLOAT_FIELDS = ("hxg", "axg", "odds_avg_h", "odds_avg_d", "odds_avg_a", "odds_avg_over25", "odds_avg_under25")
# Plausibility ceilings: values above these are data errors, not football.
MAX_VALUE = {"fthg": 15, "ftag": 15, "hthg": 15, "htag": 15, "hs": 60, "as": 60, "hst": 40, "ast": 40,
             "hc": 30, "ac": 30, "hf": 45, "af": 45, "hy": 12, "ay": 12, "hr": 5, "ar": 5}


@dataclass
class IngestResult:
    source: str
    url: str
    rows: list[dict] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)   # {"row": n, "reason": "...", "raw": {...}}
    warnings: list[str] = field(default_factory=list)
    retrieved: int = 0

    def summary(self) -> dict:
        return {"source": self.source, "url": self.url, "retrieved": self.retrieved,
                "accepted": len(self.rows), "rejected": len(self.rejected)}


def make_match_id(season: str, home: str, away: str) -> str:
    # One fixture per (season, home, away) in a league season, so this id survives
    # postponements and is shared by every source.
    return f"{season}_{slug(home)}_{slug(away)}"


def decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("undecodable file")


def parse_date(s: str) -> date:
    s = s.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"bad date {s!r}")


def _season_window(start_year: int) -> tuple[date, date]:
    # Seasons run Aug-May; 2019/20 finished in late July 2020. Generous but bounded.
    return date(start_year, 7, 1), date(start_year + 1, 8, 15)


def _to_int(v: str) -> int | None:
    v = (v or "").strip()
    if v == "":
        return None
    f = float(v)
    if f != int(f):
        raise ValueError(f"non-integer count {v!r}")
    return int(f)


def _to_float(v: str) -> float | None:
    v = (v or "").strip()
    if v == "":
        return None
    f = float(v)
    return f if f > 0 else None


def parse_football_data(raw: bytes, start_year: int, url: str) -> IngestResult:
    season = season_label(start_year)
    res = IngestResult(source="football-data.co.uk", url=url)
    text = decode(raw)
    reader = csv.reader(io.StringIO(text))
    try:
        header = [h.strip() for h in next(reader)]
    except StopIteration:
        res.warnings.append("empty file")
        return res

    col_index: dict[str, int] = {}
    for ours, names in COLUMN_MAP.items():
        for n in names:
            if n in header:
                col_index[ours] = header.index(n)
                break
    missing = [c for c in REQUIRED if c not in col_index]
    if missing:
        res.warnings.append(f"missing required columns {missing}; file skipped")
        return res
    absent = [c for c in INT_STATS if c not in col_index]
    if absent:
        res.warnings.append(f"columns not in this season: {absent}")

    lo, hi = _season_window(start_year)
    seen: dict[str, int] = {}
    for lineno, rec in enumerate(reader, start=2):
        if not any(x.strip() for x in rec):
            continue
        res.retrieved += 1
        raw_row = {header[i] if i < len(header) else f"_extra{i}": v for i, v in enumerate(rec)}
        if len(rec) > len(header):
            extra = rec[len(header):]
            if any(x.strip() for x in extra):
                res.rejected.append({"row": lineno, "reason": "more fields than header with non-empty extras", "raw": raw_row})
                continue
            res.warnings.append(f"line {lineno}: {len(extra)} empty trailing fields ignored")
            rec = rec[: len(header)]

        def get(k: str) -> str:
            i = col_index.get(k)
            return rec[i] if i is not None and i < len(rec) else ""

        try:
            d = parse_date(get("date"))
            if not (lo <= d <= hi):
                raise ValueError(f"date {d} outside season {season}")
            home, away = normalize_team(get("home_team")), normalize_team(get("away_team"))
            if home == away:
                raise ValueError("home and away team identical")
            row: dict = {"season": season, "match_date": d.isoformat(), "home_team": home, "away_team": away}
            for k in INT_STATS:
                v = _to_int(get(k)) if k in col_index else None
                if v is not None and (v < 0 or v > MAX_VALUE[k]):
                    raise ValueError(f"implausible {k}={v}")
                row[k] = v
            for k in FLOAT_FIELDS:
                row[k] = _to_float(get(k)) if k in col_index else None
            if row["fthg"] is None or row["ftag"] is None:
                raise ValueError("missing full-time score")
            ftr = get("ftr").strip().upper() or None
            expect = "H" if row["fthg"] > row["ftag"] else "A" if row["fthg"] < row["ftag"] else "D"
            if ftr and ftr != expect:
                raise ValueError(f"FTR {ftr} contradicts score {row['fthg']}-{row['ftag']}")
            row["ftr"] = expect
            if row["hthg"] is not None and row["htag"] is not None and (row["hthg"] > row["fthg"] or row["htag"] > row["ftag"]):
                raise ValueError("half-time goals exceed full-time goals")
            # Shots on target cannot exceed shots, nor goals exceed shots on target by
            # much (own goals aside). Contradictory stats are blanked, the result kept.
            for s, st in (("hs", "hst"), ("as", "ast")):
                if row[s] is not None and row[st] is not None and row[st] > row[s]:
                    res.warnings.append(f"line {lineno}: {st} > {s}; both set to null")
                    row[s] = row[st] = None
            t = get("time").strip()
            row["kickoff_time"] = None
            row["kickoff_utc"] = None
            if t:
                try:
                    kt = time.fromisoformat(t if len(t) > 4 else "0" + t)
                    row["kickoff_time"] = kt.strftime("%H:%M")
                    row["kickoff_utc"] = datetime.combine(d, kt, LONDON).astimezone(timezone.utc).isoformat()
                except ValueError:
                    res.warnings.append(f"line {lineno}: unparseable time {t!r}")
            ref = get("referee").strip()
            row["referee"] = ref.encode("ascii", "ignore").decode().strip() or None
        except (ValueError, UnknownTeam) as e:
            res.rejected.append({"row": lineno, "reason": str(e), "raw": raw_row})
            continue

        mid = make_match_id(season, home, away)
        if mid in seen:
            res.rejected.append({"row": lineno, "reason": f"duplicate of line {seen[mid]} ({home} v {away})", "raw": raw_row})
            continue
        seen[mid] = lineno
        row.update({
            "match_id": mid, "status": "completed", "competition": "EPL", "round": None,
            "source": "football-data.co.uk", "source_url": url,
            "source_row_hash": hashlib.sha256(json.dumps(rec).encode()).hexdigest()[:16],
        })
        res.rows.append(row)
    return res


def parse_fixture_json(raw: bytes, start_year: int, url: str) -> IngestResult:
    """Published schedule. Scores in this feed are only used to cross-check results."""
    season = season_label(start_year)
    res = IngestResult(source="fixturedownload.com", url=url)
    try:
        items = json.loads(decode(raw))
    except (ValueError, json.JSONDecodeError) as e:
        res.warnings.append(f"invalid JSON: {e}")
        return res
    seen: set[str] = set()
    for i, it in enumerate(items):
        res.retrieved += 1
        try:
            home, away = normalize_team(it.get("HomeTeam")), normalize_team(it.get("AwayTeam"))
            if home == away:
                raise ValueError("home and away team identical")
            ko = datetime.strptime(it["DateUtc"], "%Y-%m-%d %H:%M:%SZ").replace(tzinfo=timezone.utc)
            lo, hi = _season_window(start_year)
            local = ko.astimezone(LONDON)
            if not (lo <= local.date() <= hi):
                raise ValueError(f"kickoff {ko} outside season {season}")
            mid = make_match_id(season, home, away)
            if mid in seen:
                raise ValueError(f"duplicate fixture {home} v {away}")
            seen.add(mid)
            hs, as_ = it.get("HomeTeamScore"), it.get("AwayTeamScore")
            res.rows.append({
                "match_id": mid, "season": season, "competition": "EPL",
                "match_date": local.date().isoformat(), "kickoff_time": local.strftime("%H:%M"),
                "kickoff_utc": ko.isoformat(), "round": it.get("RoundNumber"),
                "home_team": home, "away_team": away, "status": "scheduled",
                "source": "fixturedownload.com", "source_url": url,
                "feed_score": None if hs is None or as_ is None else [int(hs), int(as_)],
            })
        except (ValueError, KeyError, TypeError, UnknownTeam) as e:
            res.rejected.append({"row": i, "reason": str(e), "raw": it})
    return res


@dataclass
class MergeReport:
    completed: int = 0
    scheduled: int = 0
    conflicts: list[str] = field(default_factory=list)
    unverified_results: list[str] = field(default_factory=list)


def merge_sources(results: list[dict], fixtures: list[dict]) -> tuple[list[dict], MergeReport]:
    """Combine results and schedule. Results are authoritative; the schedule only adds
    fixtures that have not been played and the UTC kickoff where the results file
    lacks it. Disagreements are reported, never silently resolved."""
    rep = MergeReport()
    by_id = {r["match_id"]: dict(r) for r in results}
    for f in fixtures:
        mid = f["match_id"]
        if mid in by_id:
            r = by_id[mid]
            if f.get("feed_score") and f["feed_score"] != [r["fthg"], r["ftag"]]:
                rep.conflicts.append(f"{mid}: results file {r['fthg']}-{r['ftag']} vs schedule feed {f['feed_score']}")
            if not r.get("kickoff_utc"):
                r["kickoff_utc"], r["kickoff_time"] = f["kickoff_utc"], f["kickoff_time"]
            r["round"] = f.get("round")
            continue
        row = {k: v for k, v in f.items() if k != "feed_score"}
        if f.get("feed_score"):
            # Played according to the schedule feed but not yet in the results file:
            # keep as scheduled (ineligible because kickoff has passed) until verified.
            rep.unverified_results.append(mid)
        by_id[mid] = row
    rows = sorted(by_id.values(), key=lambda r: (r["match_date"], r.get("kickoff_utc") or "", r["match_id"]))
    rep.completed = sum(r["status"] == "completed" for r in rows)
    rep.scheduled = sum(r["status"] == "scheduled" for r in rows)
    return rows, rep
