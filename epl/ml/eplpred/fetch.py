"""Download source files, or read them from a local directory.

Raw files are not committed to the repository: football-data.co.uk does not state
redistribution terms, so every pipeline run downloads them again and records a
checksum. A local directory can be supplied for development and tests.
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .config import ALL_SEASONS, CURRENT_SEASON_START, FIXTURE_JSON_URL, football_data_url, season_start_year

USER_AGENT = "TrustWeb-EPL-research/1.0 (+https://github.com/Rinkino/Trust-Web)"


@dataclass
class RawFile:
    kind: str            # 'results' | 'fixtures'
    start_year: int
    url: str
    status: int
    content: bytes
    retrieved_at: str

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.content).hexdigest()


def _get(url: str, retries: int = 3) -> tuple[int, bytes]:
    import requests

    last: Exception | None = None
    for attempt in range(retries):
        try:
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
            return r.status_code, r.content
        except requests.RequestException as e:  # network blip: back off and retry
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"failed to fetch {url}: {last}")


def download_all(seasons: list[str] | None = None) -> list[RawFile]:
    out: list[RawFile] = []
    for label in seasons or ALL_SEASONS:
        y = season_start_year(label)
        url = football_data_url(y)
        status, body = _get(url)
        out.append(RawFile("results", y, url, status, body, datetime.now(timezone.utc).isoformat()))
        time.sleep(0.5)  # be polite to a free service
    url = FIXTURE_JSON_URL.format(year=CURRENT_SEASON_START)
    status, body = _get(url)
    out.append(RawFile("fixtures", CURRENT_SEASON_START, url, status, body, datetime.now(timezone.utc).isoformat()))
    return out


def load_local(directory: str | Path, seasons: list[str] | None = None) -> list[RawFile]:
    """Read files named like the fetch workflow stores them (E0_2526.csv, fixturedownload_epl-2026.json)."""
    d = Path(directory)
    out: list[RawFile] = []
    for label in seasons or ALL_SEASONS:
        y = season_start_year(label)
        code = f"{y % 100:02d}{(y + 1) % 100:02d}"
        p = d / f"E0_{code}.csv"
        if p.exists():
            out.append(RawFile("results", y, football_data_url(y), 200, p.read_bytes(),
                               datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat()))
    p = d / f"fixturedownload_epl-{CURRENT_SEASON_START}.json"
    if p.exists():
        out.append(RawFile("fixtures", CURRENT_SEASON_START, FIXTURE_JSON_URL.format(year=CURRENT_SEASON_START), 200,
                           p.read_bytes(), datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat()))
    return out
