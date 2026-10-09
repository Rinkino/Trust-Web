// epl-picks: visitors' own match picks. The only path into epl_user_picks.
//
// A pick belongs to one owner:
//   - a signed-in account (Google sign-in through Supabase Auth, shared with TrustWeb):
//     the caller sends the session's access token in X-User-Token, verified here; or
//   - a browser: a random 32-byte key generated in the browser, of which only
//     sha256(key) is stored, so the key works like a password for those picks.
//
// actions:
//   save  {key?, match_id, pick: 'H'|'D'|'A', home_goals?, away_goals?}
//   clear {key?, match_id}
//   list  {key?}
//   claim {key}   (signed in) move this browser's picks into the account; where the
//                 account already has a pick for the same match, the account's is kept
//   save_prop   {match_id, prop_key, label, model_prob}  (signed in) save one of the
//               model's predictions for a match, e.g. "Arsenal more corners than Leeds"
//   remove_prop {match_id, prop_key}                      (signed in)
//   list_props  {}                                        (signed in) saved predictions,
//               each settled from the final statistics once the match is completed
//
// Picks close at kickoff: the epl_user_picks_guard trigger rejects inserts and
// updates once the match has started, whatever this function does. Each pick is
// linked to the model prediction that was published for the match at that moment,
// so model and visitor can be compared on the same information.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const KEY = /^[0-9a-f]{64}$/
const PROP_KEY = /^(res:[HDA]|dc:(HD|DA|HA)|btts:(yes|no)|tot:(goals|corners|yellows|shots|sot):(over|under):\d{1,2}\.5|team:(home|away):(goals|corners|yellows|shots|sot):(over|under):\d{1,2}\.5|cmp:(corners|yellows|shots|sot):(home|away))$/
const MATCH = /^[0-9]{4}-[0-9]{2}_[a-z0-9-]+_[a-z0-9-]+$/
const goals = (x: unknown) => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 20 ? (x as number) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(400, { error: 'invalid JSON' }) }
  const { action, key } = body as { action?: string; key?: string }
  if (key !== undefined && (typeof key !== 'string' || !KEY.test(key))) return json(400, { error: 'invalid key' })
  const player = key ? await sha256(key) : null

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  let userId: string | null = null
  const token = req.headers.get('x-user-token')
  if (token) {
    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) return json(401, { error: 'Your sign-in has expired. Please sign in again.' })
    userId = data.user.id
  }
  if (!userId && !player) return json(400, { error: 'sign in, or send a browser key' })
  // Every query below is limited to this owner.
  // deno-lint-ignore no-explicit-any
  const mine = (q: any) => (userId ? q.eq('user_id', userId) : q.eq('player_hash', player!))

  if (action === 'claim') {
    if (!userId || !player) return json(400, { error: 'claim needs a signed-in user and a browser key' })
    const { data: device, error: de } = await db.from('epl_user_picks').select('pick_id,match_id')
      .eq('player_hash', player).is('user_id', null)
    if (de) return json(500, { error: de.message })
    const { data: account, error: ae } = await db.from('epl_user_picks').select('match_id').eq('user_id', userId)
    if (ae) return json(500, { error: ae.message })
    const taken = new Set((account ?? []).map(r => r.match_id))
    let moved = 0, kept = 0
    for (const r of device ?? []) {
      if (taken.has(r.match_id)) {
        const { error } = await db.from('epl_user_picks').delete().eq('pick_id', r.pick_id)
        if (error) return json(500, { error: error.message })
        kept++
      } else {
        const { error } = await db.from('epl_user_picks').update({ user_id: userId, player_hash: null }).eq('pick_id', r.pick_id)
        if (error) return json(500, { error: error.message })
        moved++
      }
    }
    return json(200, { moved, duplicates_dropped: kept })
  }

  if (action === 'list_props') {
    if (!userId) return json(401, { error: 'Sign in to see saved predictions.' })
    const { data, error } = await db.from('epl_saved_prop_results')
      .select('match_id,prop_key,label,model_prob,created_at,home_team,away_team,kickoff_utc,match_status,fthg,ftag,won')
      .eq('user_id', userId).order('kickoff_utc', { ascending: true }).limit(1000)
    if (error) return json(500, { error: error.message })
    return json(200, { props: data ?? [] })
  }

  if (action === 'list') {
    const { data, error } = await mine(db.from('epl_user_pick_scores')
      .select('match_id,home_team,away_team,kickoff_utc,pick,home_goals,away_goals,prediction_id,created_at,updated_at,match_status,fthg,ftag,ftr,points'))
      .order('kickoff_utc', { ascending: true }).limit(500)
    if (error) return json(500, { error: error.message })
    const ids = (data ?? []).map(r => r.prediction_id).filter(Boolean)
    const preds: Record<string, unknown> = {}
    if (ids.length) {
      const { data: p, error: pe } = await db.from('epl_predictions')
        .select('prediction_id,created_at,values->outcome,values->top_scorelines').in('prediction_id', ids)
      if (pe) return json(500, { error: pe.message })
      for (const r of p ?? []) preds[r.prediction_id] = r
    }
    return json(200, { picks: (data ?? []).map(r => ({ ...r, prediction: r.prediction_id ? preds[r.prediction_id] ?? null : null })) })
  }

  const matchId = body.match_id
  if (typeof matchId !== 'string' || !MATCH.test(matchId)) return json(400, { error: 'invalid match_id' })
  const { data: m, error: me } = await db.from('epl_matches').select('status,kickoff_utc').eq('match_id', matchId).maybeSingle()
  if (me) return json(500, { error: me.message })
  if (!m) return json(404, { error: 'unknown match' })
  const open = m.status === 'scheduled' && m.kickoff_utc && new Date(m.kickoff_utc).getTime() > Date.now()
  if (!open) return json(409, { error: 'Picks for this match are closed: it has kicked off.' })

  if (action === 'save_prop' || action === 'remove_prop') {
    if (!userId) return json(401, { error: 'Sign in to save predictions.' })
    const propKey = body.prop_key
    if (typeof propKey !== 'string' || !PROP_KEY.test(propKey)) return json(400, { error: 'invalid prediction' })
    if (action === 'remove_prop') {
      const { error } = await db.from('epl_saved_props').delete().eq('user_id', userId).eq('match_id', matchId).eq('prop_key', propKey)
      if (error) return json(/closed/.test(error.message) ? 409 : 500, { error: /closed/.test(error.message) ? 'This match has kicked off.' : error.message })
      return json(200, { removed: propKey })
    }
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : ''
    const prob = typeof body.model_prob === 'number' && body.model_prob >= 0 && body.model_prob <= 1 ? body.model_prob : null
    if (!label) return json(400, { error: 'missing label' })
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count } = await db.from('epl_saved_props').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gt('created_at', since)
    if ((count ?? 0) >= 60) return json(429, { error: 'Too many changes in the last minute. Try again shortly.' })
    const { data: pred } = await db.from('epl_predictions').select('prediction_id')
      .eq('mode', 'live').eq('model_name', 'selected').eq('match_id', matchId)
      .order('created_at', { ascending: false }).limit(1)
    const { error } = await db.from('epl_saved_props').upsert(
      { user_id: userId, match_id: matchId, prop_key: propKey, label, model_prob: prob, prediction_id: pred?.[0]?.prediction_id ?? null },
      { onConflict: 'user_id,match_id,prop_key', ignoreDuplicates: true },
    )
    if (error) return json(/closed/.test(error.message) ? 409 : 500, { error: /closed/.test(error.message) ? 'This match has kicked off.' : error.message })
    return json(200, { saved: propKey })
  }

  if (action === 'clear') {
    const { error } = await mine(db.from('epl_user_picks').delete()).eq('match_id', matchId)
    if (error) return json(500, { error: error.message })
    return json(200, { cleared: matchId })
  }

  if (action !== 'save') return json(400, { error: 'unknown action' })
  const pick = body.pick
  if (pick !== 'H' && pick !== 'D' && pick !== 'A') return json(400, { error: 'pick must be H, D or A' })
  const hasScore = body.home_goals !== undefined && body.home_goals !== null
  const hg = hasScore ? goals(body.home_goals) : null
  const ag = hasScore ? goals(body.away_goals) : null
  if (hasScore && (hg === null || ag === null)) return json(400, { error: 'scores must be whole numbers from 0 to 20' })
  if (hasScore && pick !== (hg! > ag! ? 'H' : hg === ag ? 'D' : 'A')) {
    return json(400, { error: 'The score does not match the result you picked.' })
  }

  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await mine(db.from('epl_user_picks').select('pick_id', { count: 'exact', head: true }))
    .gt('updated_at', since)
  if ((count ?? 0) >= 30) return json(429, { error: 'Too many changes in the last minute. Try again shortly.' })

  // The model prediction on display right now: the latest pre-kickoff 'selected' live prediction.
  const { data: pred } = await db.from('epl_predictions').select('prediction_id')
    .eq('mode', 'live').eq('model_name', 'selected').eq('match_id', matchId)
    .order('created_at', { ascending: false }).limit(1)
  const predictionId = pred?.[0]?.prediction_id ?? null

  const row = { match_id: matchId, pick, home_goals: hg, away_goals: ag, prediction_id: predictionId }
  const { data: saved, error } = await db.from('epl_user_picks').upsert(
    userId ? { ...row, user_id: userId } : { ...row, player_hash: player },
    { onConflict: userId ? 'user_id,match_id' : 'player_hash,match_id' },
  ).select('match_id,pick,home_goals,away_goals,prediction_id,created_at,updated_at').single()
  if (error) {
    const closed = /closed/.test(error.message)
    return json(closed ? 409 : 500, { error: closed ? 'Picks for this match are closed: it has kicked off.' : error.message })
  }
  return json(200, { saved })
})
