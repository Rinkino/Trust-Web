"""Three-match demonstration: the selection rule, shared with the epl-demo edge function.

The edge function (supabase/functions/epl-demo) implements exactly this rule in
TypeScript. Keeping a Python copy lets anyone audit a stored run: given its seed and
the eligible match ids, `select_three` must return the stored three, and
`eligible_hash` must match the stored hash.
"""
from __future__ import annotations

import hashlib
import secrets


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def eligible_hash(match_ids: list[str]) -> str:
    return sha256_hex(",".join(sorted(match_ids)))


def select_three(match_ids: list[str], seed: str) -> list[str]:
    """The 3 eligible matches with the smallest sha256(seed + match_id)."""
    unique = sorted(set(match_ids))
    if len(unique) < 3:
        raise ValueError(f"only {len(unique)} eligible matches; at least 3 are needed")
    return sorted(unique, key=lambda m: sha256_hex(seed + m))[:3]


def new_seed() -> str:
    return secrets.token_hex(16)


def verify_run(stored_ids: list[str], seed: str, eligible_ids: list[str], stored_hash: str) -> bool:
    return eligible_hash(eligible_ids) == stored_hash and select_three(eligible_ids, seed) == list(stored_ids)
