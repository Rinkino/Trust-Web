"""Permissions and secret handling."""
import os
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
EPL_TABLES = ["epl_matches", "epl_model_registry", "epl_target_selection", "epl_model_evaluations", "epl_predictions",
              "epl_demo_runs", "epl_demo_run_items", "epl_data_source_audit", "epl_pipeline_runs",
              "epl_match_odds", "epl_value_backtest"]


def _sql() -> str:
    return "\n".join(p.read_text() for p in sorted((ROOT / "epl/supabase/migrations").glob("*.sql")))


def test_every_table_has_rls_and_only_read_policies():
    sql = _sql()
    for t in EPL_TABLES:
        assert re.search(rf"alter table public\.{t}\s+enable row level security", sql), t
        assert re.search(rf"create policy {t}_read\s+on public\.{t}\s+for select", sql), t
    assert not re.search(r"create policy \w+ on public\.epl_\w+ for (insert|update|delete|all)", sql)
    assert "revoke insert, update, delete, truncate" in sql


def test_writer_function_checks_github_identity_and_whitelists_tables():
    src = (ROOT / "epl/supabase/functions/epl-writer/index.ts").read_text()
    assert "token.actions.githubusercontent.com" in src
    assert "claims.repository !== REPOSITORY" in src
    assert ".github/workflows/epl-pipeline.yml@" in src
    assert "epl_predictions:       { mode: 'insert' }" in src     # predictions can only be added
    assert "epl_demo_runs" not in src                              # demo runs are not writable by the pipeline


def test_no_secrets_committed():
    files = subprocess.check_output(["git", "ls-files", "epl", ".github"], cwd=ROOT, text=True).split()
    jwt = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
    for f in files:
        p = ROOT / f
        if not p.is_file() or p.suffix in {".png", ".ico"}:
            continue
        text = p.read_text(errors="ignore")
        assert "service_role" not in text.lower() or f.endswith(("index.ts", ".md", "test_security.py")), f
        for m in jwt.findall(text):
            # Only the public anon key may appear, and only where documented as public.
            assert '"role":"anon"' in _decode_role(m), f"possible secret token in {f}"
        assert not re.search(r"sb_secret_[A-Za-z0-9]", text), f


def _decode_role(token: str) -> str:
    import base64
    import json
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    try:
        return json.dumps(json.loads(base64.urlsafe_b64decode(payload)), separators=(",", ":"))
    except Exception:
        return ""


@pytest.mark.skipif(not os.environ.get("EPL_SUPABASE_ANON_KEY"), reason="needs network + public anon key")
def test_public_key_cannot_write():
    import requests
    from eplpred.upload import SUPABASE_URL
    key = os.environ["EPL_SUPABASE_ANON_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/epl_predictions", headers=h, json={"mode": "live"}, timeout=30)
    assert r.status_code in (401, 403)
    r = requests.post(f"{SUPABASE_URL}/functions/v1/epl-writer", headers={"Authorization": f"Bearer {key}"},
                      json={"table": "epl_matches", "rows": [{}]}, timeout=30)
    assert r.status_code == 401
    r = requests.get(f"{SUPABASE_URL}/rest/v1/epl_matches?select=match_id&limit=1", headers=h, timeout=30)
    assert r.status_code == 200
