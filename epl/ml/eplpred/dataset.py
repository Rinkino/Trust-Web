"""Turn raw files into the validated match table plus an audit trail."""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .fetch import RawFile
from .ingest import MergeReport, merge_sources, parse_fixture_json, parse_football_data

STAT_COLS = ["fthg", "ftag", "hthg", "htag", "hs", "as", "hst", "ast", "hc", "ac", "hf", "af", "hy", "ay", "hr", "ar"]


@dataclass
class Dataset:
    matches: pd.DataFrame
    audit: list[dict] = field(default_factory=list)
    merge: MergeReport | None = None

    @property
    def completed(self) -> pd.DataFrame:
        return self.matches[self.matches.status == "completed"]


def build_dataset(files: list[RawFile]) -> Dataset:
    results: list[dict] = []
    fixtures: list[dict] = []
    audit: list[dict] = []
    for f in files:
        entry = {"source": ("football-data.co.uk" if f.kind == "results" else "fixturedownload.com") + f" ({f.competition})",
                 "source_url": f.url, "retrieved_at": f.retrieved_at, "http_status": f.status,
                 "bytes": len(f.content), "sha256": f.sha256,
                 "records_retrieved": 0, "records_accepted": 0, "records_rejected": 0, "validation_errors": []}
        if f.status != 200:
            entry["validation_errors"] = [{"reason": f"HTTP {f.status}"}]
            audit.append(entry)
            continue
        res = (parse_football_data if f.kind == "results" else parse_fixture_json)(f.content, f.start_year, f.url, f.competition)
        (results if f.kind == "results" else fixtures).extend(res.rows)
        entry.update(records_retrieved=res.retrieved, records_accepted=len(res.rows), records_rejected=len(res.rejected))
        errs = [{"row": r["row"], "reason": r["reason"]} for r in res.rejected]
        errs += [{"warning": w} for w in res.warnings[:50]]
        if len(res.warnings) > 50:
            errs.append({"warning": f"... {len(res.warnings) - 50} more warnings"})
        entry["validation_errors"] = errs
        audit.append(entry)

    rows, rep = merge_sources(results, fixtures)
    df = pd.DataFrame(rows)
    df["match_date"] = pd.to_datetime(df["match_date"])
    df["kickoff_utc"] = pd.to_datetime(df["kickoff_utc"], utc=True)
    for c in STAT_COLS:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("Float64")
    df = df.sort_values(["match_date", "kickoff_utc", "match_id"], na_position="first").reset_index(drop=True)
    return Dataset(df, audit, rep)


def coverage_report(ds: Dataset) -> pd.DataFrame:
    """Share of completed matches with each statistic present, by season."""
    c = ds.completed
    g = c.groupby("season")
    out = pd.DataFrame({"matches": g.size()})
    for col in ["hs", "hst", "hc", "hf", "hy", "hr", "hxg", "odds_avg_h", "odds_avg_over25", "kickoff_time"]:
        if col in c:
            out[col] = g[col].apply(lambda s: round(float(s.notna().mean()), 3))
    return out
