// Read-only access to the epl_* tables through PostgREST with the public anon key.
// RLS restricts that key to SELECT, so nothing here can change data.
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vezcwptlyyeqsaybhegv.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const SUPABASE_URL = URL_

type Query = Record<string, string | number | undefined>

function qs(q: Query): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.append(k, String(v))
  return p.toString()
}

export async function select<T = Record<string, unknown>>(
  table: string, q: Query = {}, opts: { from?: number; to?: number; revalidate?: number } = {},
): Promise<T[]> {
  const from = opts.from ?? 0
  const to = opts.to ?? from + 999
  const res = await fetch(`${URL_}/rest/v1/${table}?${qs(q)}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${to}` },
    next: { revalidate: opts.revalidate ?? 300 },
  })
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

/** Every row, following PostgREST pagination (bounded by maxRows). */
export async function selectAll<T = Record<string, unknown>>(table: string, q: Query = {}, maxRows = 20000, revalidate = 300): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < maxRows; from += 1000) {
    const rows = await select<T>(table, q, { from, to: from + 999, revalidate })
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

export async function count(table: string, q: Query = {}, revalidate = 300): Promise<number> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${qs({ ...q, select: q.select ?? '*' })}`, {
    method: 'HEAD',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact', Range: '0-0' },
    next: { revalidate },
  })
  const range = res.headers.get('content-range') ?? '*/0'
  return Number(range.split('/')[1] ?? 0)
}

// ── Typed rows ────────────────────────────────────────────────────────────────
export type PipelineRun = {
  run_key: string; started_at: string; finished_at: string | null; status: string
  stages: Record<string, { seconds: number; ok: boolean }>; summary: any; git_sha: string | null
  workflow_url: string | null; error: string | null
}
export type Evaluation = {
  model_name: string; model_version: string; target: string; target_kind: string; split: string; season: string
  eval_start: string; eval_end: string; n_matches: number; methodology: string
  mae: number | null; rmse: number | null; mean_nll: number | null; log_loss: number | null; brier: number | null
  accuracy: number | null; ece: number | null; coverage_50: number | null; coverage_80: number | null
  baseline_metric: number | null; improvement_pct: number | null
  calibration: { bins?: { lo: number; hi: number; n: number; mean_p: number; freq: number }[]; improvement_ci?: [number, number] | null; bias?: number; base_rate?: number; freq?: number[]; mean_p?: number | number[] } | null
}
export type Selection = {
  selection_version: string; target: string; target_kind: string; selected_model: string; selected_version: string
  primary_metric: string; selection_period: string; reason: string; reliable: boolean; created_at: string
  metrics: { metric: number; baseline_metric: number; improvement_pct: number; improvement_ci: [number, number] | null; candidates: Record<string, number>; best_raw: string }
}
export type CountValue = { mean: number; mode: number; median: number; pi50: [number, number]; pi80: [number, number] }
export type Values = Record<string, CountValue | number | number[] | number[][]>
export type PredictionRow = {
  prediction_id: string; mode: string; match_id: string; model_name: string; model_version: string
  selection_version: string | null; created_at: string; data_cutoff: string; values: Values
  target_models: Record<string, any> | null; pipeline_run: string
  season?: string; match_date: string; kickoff_utc: string | null; home_team: string; away_team: string; status?: string
  fthg?: number | null; ftag?: number | null; ftr?: string | null; hs?: number | null; as?: number | null; hst?: number | null
  ast?: number | null; hc?: number | null; ac?: number | null; hy?: number | null; ay?: number | null; hr?: number | null; ar?: number | null
  generated_before_kickoff?: boolean | null
}
export type Registry = {
  model_name: string; model_version: string; algorithm: string; description: string; feature_set: string[]
  config: any; training_cutoff: string | null; training_start: string | null; training_end: string | null
  metrics: any; artifact_location: string | null; status: string; created_at: string
}

/** The latest successful run that covered this competition. Leagues run in parallel jobs,
 * each recording its own run; runs from before that recorded only the Premier League. */
export async function latestRun(competition = 'EPL'): Promise<PipelineRun | null> {
  const base = { select: '*', status: 'eq.succeeded', order: 'finished_at.desc', limit: 1 }
  const rows = await select<PipelineRun>('epl_pipeline_runs', { ...base, [`summary->competitions->${competition}`]: 'not.is.null' })
  if (rows[0] || competition !== 'EPL') return rows[0] ?? null
  return (await select<PipelineRun>('epl_pipeline_runs', base))[0] ?? null
}

export async function latestSelection(competition = 'EPL'): Promise<Selection[]> {
  const v = await select<{ selection_version: string }>('epl_target_selection', {
    select: 'selection_version', competition: `eq.${competition}`, order: 'created_at.desc', limit: 1,
  })
  if (!v[0]) return []
  return select<Selection>('epl_target_selection', { select: '*', competition: `eq.${competition}`, selection_version: `eq.${v[0].selection_version}` })
}
