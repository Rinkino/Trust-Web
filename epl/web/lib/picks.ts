// Picks: request validation and the scoring rules, shared by the API route and the
// pages. Kept free of framework imports so it can be unit-tested with node --test.

export type Outcome = 'H' | 'D' | 'A'
export const OUTCOMES: Outcome[] = ['H', 'D', 'A']

import { PROP_KEY } from './props.ts'

const KEY = /^[0-9a-f]{64}$/
const MATCH = /^[0-9]{4}-[0-9]{2}_[a-z0-9-]+_[a-z0-9-]+$/

export type PicksRequest =
  | { action: 'list'; key?: string }
  | { action: 'claim'; key: string }
  | { action: 'clear'; key?: string; match_id: string }
  | { action: 'save'; key?: string; match_id: string; pick: Outcome; home_goals?: number; away_goals?: number }
  | { action: 'list_props' }
  | { action: 'save_prop'; match_id: string; prop_key: string; label: string; model_prob: number }
  | { action: 'remove_prop'; match_id: string; prop_key: string }

export function outcomeOfScore(h: number, a: number): Outcome {
  return h > a ? 'H' : h === a ? 'D' : 'A'
}

/** `signedIn`: the request carries a sign-in token, so the browser key is optional
 * (the account owns the picks). `claim` always needs the key of the picks to move. */
export function parsePicksRequest(body: unknown, signedIn = false): { ok: true; req: PicksRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'body must be a JSON object' }
  const b = body as Record<string, unknown>
  const allowed = new Set(['action', 'key', 'match_id', 'pick', 'home_goals', 'away_goals', 'prop_key', 'label', 'model_prob'])
  if (Object.keys(b).some(k => !allowed.has(k))) return { ok: false, error: 'unexpected field' }
  // Saved predictions belong to a signed-in account only.
  if (b.action === 'list_props' || b.action === 'save_prop' || b.action === 'remove_prop') {
    if (!signedIn) return { ok: false, error: 'sign in to save predictions' }
    if (b.action === 'list_props') return { ok: true, req: { action: 'list_props' } }
    if (typeof b.match_id !== 'string' || !MATCH.test(b.match_id)) return { ok: false, error: 'invalid match' }
    if (typeof b.prop_key !== 'string' || !PROP_KEY.test(b.prop_key)) return { ok: false, error: 'invalid prediction' }
    if (b.action === 'remove_prop') return { ok: true, req: { action: 'remove_prop', match_id: b.match_id, prop_key: b.prop_key } }
    if (typeof b.label !== 'string' || b.label.trim().length === 0 || b.label.length > 120) return { ok: false, error: 'invalid label' }
    if (typeof b.model_prob !== 'number' || !(b.model_prob >= 0 && b.model_prob <= 1)) return { ok: false, error: 'invalid probability' }
    return { ok: true, req: { action: 'save_prop', match_id: b.match_id, prop_key: b.prop_key, label: b.label.trim(), model_prob: b.model_prob } }
  }
  if (b.key !== undefined && (typeof b.key !== 'string' || !KEY.test(b.key))) return { ok: false, error: 'invalid key' }
  const key = b.key as string | undefined
  if (!key && (!signedIn || b.action === 'claim')) return { ok: false, error: b.action === 'claim' ? 'claim needs a key' : 'sign in, or send a key' }
  if (b.action === 'claim') return signedIn ? { ok: true, req: { action: 'claim', key: key! } } : { ok: false, error: 'sign in to claim picks' }
  if (b.action === 'list') return { ok: true, req: { action: 'list', key } }
  if (typeof b.match_id !== 'string' || !MATCH.test(b.match_id)) return { ok: false, error: 'invalid match' }
  if (b.action === 'clear') return { ok: true, req: { action: 'clear', key, match_id: b.match_id } }
  if (b.action !== 'save') return { ok: false, error: 'action must be save, clear, list or claim' }
  if (b.pick !== 'H' && b.pick !== 'D' && b.pick !== 'A') return { ok: false, error: 'pick must be H, D or A' }
  const hasScore = b.home_goals !== undefined || b.away_goals !== undefined
  if (!hasScore) return { ok: true, req: { action: 'save', key, match_id: b.match_id, pick: b.pick } }
  const ok = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 20
  if (!ok(b.home_goals) || !ok(b.away_goals)) return { ok: false, error: 'scores must be whole numbers from 0 to 20' }
  if (outcomeOfScore(b.home_goals as number, b.away_goals as number) !== b.pick) {
    return { ok: false, error: 'The score does not match the result you picked.' }
  }
  return { ok: true, req: { action: 'save', key, match_id: b.match_id, pick: b.pick, home_goals: b.home_goals as number, away_goals: b.away_goals as number } }
}

// ── Scoring ──────────────────────────────────────────────────────────────────
// 1 point for the right result; 2 more for the exact score (if a score was given).
// The same rules score the model: its pick is its most likely result, and its score
// is the most likely scoreline that agrees with that result.

export function points(pick: Outcome, score: [number, number] | null, actual: [number, number]): number {
  const right = outcomeOfScore(actual[0], actual[1]) === pick ? 1 : 0
  const exact = score && score[0] === actual[0] && score[1] === actual[1] ? 2 : 0
  return right + exact
}

export function modelPick(outcome: number[] | null | undefined, top?: number[][] | null): { pick: Outcome; prob: number; score: [number, number] | null } | null {
  if (!outcome || outcome.length !== 3) return null
  const i = outcome.indexOf(Math.max(...outcome))
  const pick = OUTCOMES[i]
  const s = (top ?? []).find(([h, a]) => outcomeOfScore(h, a) === pick)
  return { pick, prob: outcome[i], score: s ? [s[0], s[1]] : null }
}
