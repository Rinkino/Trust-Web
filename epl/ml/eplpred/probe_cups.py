"""One-off check before adding the European cups: which feeds can be downloaded, how
much history they hold, and which team names the current name table does not know.
Downloads and prints only; writes nothing anywhere.

    python -m eplpred.probe_cups
"""
from __future__ import annotations

import csv
import io
import json
import os
from collections import Counter
from datetime import date

from .fetch import _get
from .teams import UnknownTeam, normalize_team

FIXTURE = "https://fixturedownload.com/feed/json/{slug}-{year}"
SLUGS = {
    "Champions League": ["champions-league", "uefa-champions-league"],
    "Europa League": ["europa-league", "uefa-europa-league"],
    "Conference League": ["conference-league", "europa-conference-league", "uefa-conference-league"],
}
CLUBELO = ["http://api.clubelo.com/{what}", "https://api.clubelo.com/{what}"]


def unknown(names) -> list[str]:
    out = []
    for n in names:
        try:
            normalize_team(n)
        except UnknownTeam:
            out.append(n)
    return sorted(set(out))


def probe_fixtures(lines: list[str]) -> None:
    lines.append("## fixturedownload.com")
    for comp, slugs in SLUGS.items():
        found = None
        for slug in slugs:
            status, body = _get(FIXTURE.format(slug=slug, year=2026))
            lines.append(f"- {comp} `{slug}-2026`: HTTP {status}, {len(body)} bytes")
            if status == 200 and body.strip().startswith(b"["):
                found = slug
                break
        if not found:
            continue
        years, names, scored = [], Counter(), 0
        for y in range(2008, 2027):
            status, body = _get(FIXTURE.format(slug=found, year=y))
            if status != 200 or not body.strip().startswith(b"["):
                continue
            items = json.loads(body)
            if not items:
                continue
            years.append(y)
            for it in items:
                names[it.get("HomeTeam")] += 1
                names[it.get("AwayTeam")] += 1
                scored += it.get("HomeTeamScore") is not None
        unk = unknown([n for n in names if n])
        lines.append(f"  - seasons available: {years[0] if years else '-'}..{years[-1] if years else '-'} ({len(years)}), "
                     f"matches with a score: {scored}, clubs: {len(names)}, unknown names: {len(unk)}")
        if years:
            sample = json.loads(_get(FIXTURE.format(slug=found, year=years[-1]))[1])[:2]
            lines.append(f"  - sample row: `{json.dumps(sample[0]) if sample else '-'}`")
        lines.append("  - unknown: " + ", ".join(unk))


def probe_clubelo(lines: list[str]) -> None:
    lines.append("## ClubElo")
    today = date.today().isoformat()
    for what in (today, "Fixtures", "Barcelona"):
        for base in CLUBELO:
            url = base.format(what=what)
            try:
                status, body = _get(url)
            except RuntimeError as e:
                lines.append(f"- `{url}`: {e}")
                continue
            text = body.decode("utf-8", "replace")
            rows = list(csv.reader(io.StringIO(text)))
            lines.append(f"- `{url}`: HTTP {status}, {len(rows)} rows; header `{rows[0] if rows else '-'}`")
            if status == 200 and len(rows) > 1:
                lines.append(f"  - first rows: `{rows[1:3]}`")
                if what == today and "Club" in rows[0]:
                    i = rows[0].index("Club")
                    lvl = rows[0].index("Level") if "Level" in rows[0] else None
                    clubs = [r[i] for r in rows[1:] if r and (lvl is None or r[lvl] == "1")]
                    unk = unknown(clubs)
                    lines.append(f"  - top-division clubs: {len(clubs)}, unknown to the name table: {len(unk)}")
                    lines.append("  - unknown (first 120): " + ", ".join(unk[:120]))
                break


def main() -> int:
    lines = ["# European cups: data check", ""]
    probe_fixtures(lines)
    lines.append("")
    probe_clubelo(lines)
    text = "\n".join(lines)
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(text + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
