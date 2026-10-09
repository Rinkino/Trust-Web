"""Write pipeline outputs to Supabase through the epl-writer edge function.

Inside GitHub Actions the request is authenticated with the job's OIDC token
(audience 'epl-writer'); no database secret exists anywhere in GitHub. Reads use the
public anon key, which only grants what RLS allows (select).
"""
from __future__ import annotations

import json
import math
import os
from datetime import date, datetime
from decimal import Decimal

import numpy as np
import pandas as pd

SUPABASE_URL = os.environ.get("EPL_SUPABASE_URL", "https://vezcwptlyyeqsaybhegv.supabase.co")
WRITER_URL = f"{SUPABASE_URL}/functions/v1/epl-writer"


def _clean(v):
    if v is None:
        return None
    if isinstance(v, (pd.Timestamp, datetime)):
        return None if pd.isna(v) else v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float, Decimal)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, dict):
        return {str(k): _clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, np.ndarray)):
        return [_clean(x) for x in v]
    if v is pd.NA or v is pd.NaT:
        return None
    return v


def clean_rows(rows: list[dict]) -> list[dict]:
    return [{k: _clean(v) for k, v in r.items()} for r in rows]


def oidc_token() -> str | None:
    url, tok = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"), os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not tok:
        return None
    import requests

    r = requests.get(f"{url}&audience=epl-writer", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    r.raise_for_status()
    return r.json()["value"]


class Writer:
    """Sends rows in batches. Without an OIDC token (local runs) it writes JSON files
    to `outdir` instead, so the whole pipeline can be exercised offline."""

    def __init__(self, outdir: str | None = None, batch: int = 250):
        self.token = oidc_token()
        self.outdir = outdir
        self.batch = batch
        self.written: dict[str, int] = {}

    @property
    def remote(self) -> bool:
        return self.token is not None

    def write(self, table: str, rows: list[dict]) -> int:
        rows = clean_rows(rows)
        if not rows:
            return 0
        if not self.remote:
            if self.outdir:
                os.makedirs(self.outdir, exist_ok=True)
                with open(os.path.join(self.outdir, f"{table}.jsonl"), "a") as f:
                    for r in rows:
                        f.write(json.dumps(r) + "\n")
            self.written[table] = self.written.get(table, 0) + len(rows)
            return len(rows)
        import requests

        total = 0
        for i in range(0, len(rows), self.batch):
            chunk = rows[i:i + self.batch]
            for attempt in range(3):
                r = requests.post(WRITER_URL, headers={"Authorization": f"Bearer {self.token}"},
                                  json={"table": table, "rows": chunk}, timeout=120)
                if r.status_code < 500:
                    break
            if r.status_code != 200:
                raise RuntimeError(f"writer {table} batch {i}: HTTP {r.status_code} {r.text[:500]}")
            total += len(chunk)
        self.written[table] = self.written.get(table, 0) + total
        return total


def read_table(table: str, select: str = "*", params: dict | None = None, page: int = 1000) -> list[dict]:
    """Paginated public read (anon key, RLS select only)."""
    import requests

    key = os.environ.get("EPL_SUPABASE_ANON_KEY")
    if not key:
        return []
    out, start = [], 0
    while True:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", params={"select": select, **(params or {})},
                         headers={"apikey": key, "Authorization": f"Bearer {key}", "Range": f"{start}-{start + page - 1}"},
                         timeout=60)
        r.raise_for_status()
        rows = r.json()
        out.extend(rows)
        if len(rows) < page:
            return out
        start += page
