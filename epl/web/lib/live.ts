import { latestRun, select, type Evaluation, type PredictionRow, type Values } from '@/lib/db'

/** A 'selected' prediction plus the values of the single model behind its result
 * probabilities, stored by the same pipeline run. Beginner pages show that model's
 * expected goals and likely scores so every number on the card comes from one model. */
export type FixtureRow = PredictionRow & { resultModel?: { name: string; values: Values } }

export async function withResultModel(rows: PredictionRow[]): Promise<FixtureRow[]> {
  const pairs = rows.map(r => ({ r, m: (r.target_models as Record<string, string> | null)?.outcome }))
  const runs = [...new Set(rows.map(r => r.pipeline_run))]
  const models = [...new Set(pairs.map(p => p.m).filter((m): m is string => !!m))]
  if (!rows.length || !models.length) return rows
  const per = await select<{ match_id: string; model_name: string; pipeline_run: string; values: Values }>('epl_predictions', {
    select: 'match_id,model_name,pipeline_run,values', mode: 'eq.live',
    model_name: `in.(${models.join(',')})`, pipeline_run: `in.(${runs.join(',')})`,
  })
  const by = new Map(per.map(x => [`${x.pipeline_run}|${x.match_id}|${x.model_name}`, x]))
  return pairs.map(({ r, m }) => {
    const x = m ? by.get(`${r.pipeline_run}|${r.match_id}|${m}`) : undefined
    return x ? { ...r, resultModel: { name: m!, values: x.values } } : r
  })
}

/** The latest stored pre-kickoff 'selected' prediction for every fixture not yet started. */
export async function upcomingPredictions(nowIso: string, competition = 'EPL'): Promise<FixtureRow[]> {
  const rows = await select<PredictionRow>('epl_predictions', {
    select: 'prediction_id,match_id,home_team,away_team,kickoff_utc,match_date,created_at,data_cutoff,values,target_models,pipeline_run,model_version,mode,model_name,selection_version',
    competition: `eq.${competition}`, mode: 'eq.live', model_name: 'eq.selected', kickoff_utc: `gt.${nowIso}`, order: 'kickoff_utc.asc,created_at.desc',
  })
  const latest = new Map<string, PredictionRow>()
  for (const r of rows) if (!latest.has(r.match_id)) latest.set(r.match_id, r)
  return withResultModel([...latest.values()])
}

/** Scheduled fixtures that have no published prediction yet (beyond the prediction window). */
export async function laterFixtures(nowIso: string, predicted: Set<string>, limit = 10, competition = 'EPL') {
  const rows = await select<{ match_id: string; home_team: string; away_team: string; kickoff_utc: string }>('epl_matches', {
    select: 'match_id,home_team,away_team,kickoff_utc', competition: `eq.${competition}`, status: 'eq.scheduled', kickoff_utc: `gt.${nowIso}`,
    order: 'kickoff_utc.asc', limit: 80,
  })
  return rows.filter(r => !predicted.has(r.match_id)).slice(0, limit)
}

/** How the match-result model did on the held-out 2025/26 season (from the latest run). */
export async function heldOutResultAccuracy(competition = 'EPL'): Promise<{ accuracy: number; n: number; season: string } | null> {
  const run = await latestRun()
  if (!run) return null
  const rows = await select<Evaluation>('epl_model_evaluations', {
    select: 'accuracy,n_matches,season', competition: `eq.${competition}`, run_key: `eq.${run.run_key}`, model_name: 'eq.selected', target: 'eq.outcome',
    split: 'eq.test', season: 'eq.ALL', limit: 1,
  })
  const r = rows[0]
  return r && r.accuracy != null ? { accuracy: r.accuracy, n: r.n_matches, season: '2025/26' } : null
}

/** Calendar day of a kickoff in UK time, for grouping fixtures into match days. */
export function ukDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })
}
