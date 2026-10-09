// epl-writer: the only write path into the epl_* tables.
//
// Callers authenticate with a GitHub Actions OIDC token instead of a stored secret.
// The token is signed by GitHub and proves the request comes from the EPL pipeline
// workflow in Rinkino/Trust-Web. The service-role key stays inside Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6'

const ISSUER = 'https://token.actions.githubusercontent.com'
const AUDIENCE = 'epl-writer'
const REPOSITORY = 'Rinkino/Trust-Web'
const WORKFLOW_PREFIX = `${REPOSITORY}/.github/workflows/epl-pipeline.yml@`
const MAX_ROWS = 1000

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`))

// table -> how rows may be written
const TABLES: Record<string, { mode: 'insert' | 'upsert'; onConflict?: string }> = {
  epl_matches:           { mode: 'upsert', onConflict: 'match_id' },
  epl_predictions:       { mode: 'insert' },
  epl_prediction_explanations: { mode: 'insert' },
  epl_model_evaluations: { mode: 'upsert', onConflict: 'run_key,model_name,model_version,target,split,season' },
  epl_model_registry:    { mode: 'upsert', onConflict: 'model_name,model_version' },
  epl_target_selection:  { mode: 'upsert', onConflict: 'selection_version,target' },
  epl_data_source_audit: { mode: 'insert' },
  epl_pipeline_runs:     { mode: 'upsert', onConflict: 'run_key' },
  epl_match_odds:        { mode: 'insert' },
  epl_value_backtest:    { mode: 'upsert', onConflict: 'run_key,model_name,market,price_source,strategy,split,season' },
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'missing token' })
  let claims: Record<string, unknown>
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, audience: AUDIENCE })
    claims = payload as Record<string, unknown>
  } catch (e) {
    return json(401, { error: `invalid token: ${(e as Error).message}` })
  }
  if (claims.repository !== REPOSITORY) return json(403, { error: 'wrong repository' })
  if (typeof claims.job_workflow_ref !== 'string' || !claims.job_workflow_ref.startsWith(WORKFLOW_PREFIX)) {
    return json(403, { error: 'only the epl-pipeline workflow may write' })
  }
  if (claims.event_name === 'pull_request' || claims.event_name === 'pull_request_target') {
    return json(403, { error: 'pull request runs may not write' })
  }

  let body: { op?: string; table?: string; rows?: unknown[] }
  try { body = await req.json() } catch { return json(400, { error: 'invalid JSON' }) }

  if (body.op === 'ping') return json(200, { ok: true, ref: claims.ref, sha: claims.sha })

  const spec = body.table ? TABLES[body.table] : undefined
  if (!spec) return json(400, { error: `table not writable: ${body.table}` })
  if (!Array.isArray(body.rows) || body.rows.length === 0) return json(400, { error: 'rows must be a non-empty array' })
  if (body.rows.length > MAX_ROWS) return json(413, { error: `at most ${MAX_ROWS} rows per request` })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const q = db.from(body.table!)
  const { error, count } = spec.mode === 'insert'
    ? await q.insert(body.rows, { count: 'exact' })
    : await q.upsert(body.rows, { onConflict: spec.onConflict, count: 'exact' })
  if (error) return json(422, { error: error.message, details: error.details, hint: error.hint })
  return json(200, { ok: true, table: body.table, written: count })
})
