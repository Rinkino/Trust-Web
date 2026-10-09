// epl-demo: creates an auditable three-match demonstration run.
//
// live:       the latest pre-kickoff 'selected' prediction of every verified upcoming fixture
// historical: completed matches with an out-of-sample backtest 'selected' prediction
//             from the current selection version (used when fewer than 3 live fixtures exist)
//
// Selection: a fresh random seed; the three eligible matches with the smallest
// sha256(seed + match_id). The seed, the eligible count and a hash of the sorted
// eligible ids are stored, so anyone can re-derive the choice.
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

type Eligible = { match_id: string; prediction_id: string; created_at: string }

function latestPerMatch(rows: Eligible[]): Eligible[] {
  const by = new Map<string, Eligible>()
  for (const r of rows) {
    const cur = by.get(r.match_id)
    if (!cur || r.created_at > cur.created_at) by.set(r.match_id, r)
  }
  return [...by.values()]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  let mode = 'auto'
  try { mode = (await req.json())?.mode ?? 'auto' } catch { /* empty body means auto */ }
  if (!['auto', 'live', 'historical'].includes(mode)) return json(400, { error: 'mode must be auto, live or historical' })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const since = new Date(Date.now() - 10_000).toISOString()
  const { count: recent } = await db.from('epl_demo_runs').select('run_id', { count: 'exact', head: true }).gt('created_at', since)
  if ((recent ?? 0) >= 3) return json(429, { error: 'Too many runs in the last few seconds. Try again shortly.' })

  const now = new Date().toISOString()
  const { data: liveRows, error: le } = await db.from('epl_prediction_results')
    .select('match_id,prediction_id,created_at,kickoff_utc')
    .eq('mode', 'live').eq('model_name', 'selected').eq('status', 'scheduled').gt('kickoff_utc', now)
    .limit(5000)
  if (le) return json(500, { error: le.message })
  const live = latestPerMatch((liveRows ?? []).filter(r => r.created_at < r.kickoff_utc) as Eligible[])

  let runMode = 'live'
  let eligible = live
  if (mode === 'historical' || (mode === 'auto' && live.length < 3)) {
    runMode = 'historical'
    const { data: sel } = await db.from('epl_target_selection').select('selection_version')
      .order('created_at', { ascending: false }).limit(1)
    const version = sel?.[0]?.selection_version
    const rows: Eligible[] = []
    for (let from = 0; version; from += 1000) {
      const { data, error } = await db.from('epl_prediction_results')
        .select('match_id,prediction_id,created_at')
        .eq('mode', 'backtest').eq('model_name', 'selected').eq('status', 'completed')
        .eq('selection_version', version).order('match_id').range(from, from + 999)
      if (error) return json(500, { error: error.message })
      rows.push(...(data as Eligible[]))
      if (!data || data.length < 1000) break
    }
    eligible = latestPerMatch(rows)
  }

  if (eligible.length < 3) {
    return json(200, {
      error: `Only ${eligible.length} eligible ${runMode} match(es) available; at least 3 are needed.`,
      mode: runMode, eligible_count: eligible.length, live_eligible_count: live.length,
    })
  }

  const seed = crypto.randomUUID().replaceAll('-', '')
  const ids = eligible.map(e => e.match_id).sort()
  const eligibleHash = await sha256(ids.join(','))
  const keyed = await Promise.all(eligible.map(async e => ({ ...e, key: await sha256(seed + e.match_id) })))
  keyed.sort((a, b) => (a.key < b.key ? -1 : 1))
  const chosen = keyed.slice(0, 3)

  const { data: run, error: re } = await db.from('epl_demo_runs').insert({
    mode: runMode, seed, eligible_count: eligible.length, eligible_hash: eligibleHash,
    selection_rule: 'the 3 eligible matches with the smallest sha256(seed + match_id); eligible_hash = sha256 of sorted ids joined by commas',
  }).select('run_id').single()
  if (re) return json(500, { error: re.message })

  const { error: ie } = await db.from('epl_demo_run_items').insert(
    chosen.map((c, i) => ({ run_id: run.run_id, position: i + 1, match_id: c.match_id, prediction_id: c.prediction_id })),
  )
  if (ie) return json(500, { error: ie.message })

  return json(200, { run_id: run.run_id, mode: runMode, seed, eligible_count: eligible.length, live_eligible_count: live.length })
})
