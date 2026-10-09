// epl-picks: visitors' own match picks. The only path into epl_user_picks.
//
// A visitor is identified by a random 32-byte key generated in their browser. Only
// sha256(key) is stored, so the key works like a password for that visitor's picks.
//
// actions:
//   save  {key, match_id, pick: 'H'|'D'|'A', home_goals?, away_goals?}
//   clear {key, match_id}
//   list  {key}
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
const MATCH = /^[0-9]{4}-[0-9]{2}_[a-z0-9-]+_[a-z0-9-]+$/
const goals = (x: unknown) => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 20 ? (x as number) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(400, { error: 'invalid JSON' }) }
  const { action, key } = body as { action?: string; key?: string }
  if (typeof key !== 'string' || !KEY.test(key)) return json(400, { error: 'invalid key' })
  const player = await sha256(key)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  if (action === 'list') {
    const { data, error } = await db.from('epl_user_pick_scores')
      .select('match_id,home_team,away_team,kickoff_utc,pick,home_goals,away_goals,prediction_id,created_at,updated_at,match_status,fthg,ftag,ftr,points')
      .eq('player_hash', player).order('kickoff_utc', { ascending: true }).limit(500)
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

  if (action === 'clear') {
    const { error } = await db.from('epl_user_picks').delete().eq('player_hash', player).eq('match_id', matchId)
    if (error) return json(500, { error: error.message })
    return json(200, { cleared: matchId })
  }

  if (action !== 'save') return json(400, { error: 'action must be save, clear or list' })
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
  const { count } = await db.from('epl_user_picks').select('pick_id', { count: 'exact', head: true })
    .eq('player_hash', player).gt('updated_at', since)
  if ((count ?? 0) >= 30) return json(429, { error: 'Too many changes in the last minute. Try again shortly.' })

  // The model prediction on display right now: the latest pre-kickoff 'selected' live prediction.
  const { data: pred } = await db.from('epl_predictions').select('prediction_id')
    .eq('mode', 'live').eq('model_name', 'selected').eq('match_id', matchId)
    .order('created_at', { ascending: false }).limit(1)
  const predictionId = pred?.[0]?.prediction_id ?? null

  const { data: saved, error } = await db.from('epl_user_picks').upsert(
    { player_hash: player, match_id: matchId, pick, home_goals: hg, away_goals: ag, prediction_id: predictionId },
    { onConflict: 'player_hash,match_id' },
  ).select('match_id,pick,home_goals,away_goals,prediction_id,created_at,updated_at').single()
  if (error) {
    const closed = /closed/.test(error.message)
    return json(closed ? 409 : 500, { error: closed ? 'Picks for this match are closed: it has kicked off.' : error.message })
  }
  return json(200, { saved })
})
