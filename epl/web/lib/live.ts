import { latestRun, select, type Evaluation, type PredictionRow } from '@/lib/db'

/** The latest stored pre-kickoff 'selected' prediction for every fixture not yet started. */
export async function upcomingPredictions(nowIso: string): Promise<PredictionRow[]> {
  const rows = await select<PredictionRow>('epl_predictions', {
    select: 'prediction_id,match_id,home_team,away_team,kickoff_utc,match_date,created_at,data_cutoff,values,target_models,pipeline_run,model_version,mode,model_name,selection_version',
    mode: 'eq.live', model_name: 'eq.selected', kickoff_utc: `gt.${nowIso}`, order: 'kickoff_utc.asc,created_at.desc',
  })
  const latest = new Map<string, PredictionRow>()
  for (const r of rows) if (!latest.has(r.match_id)) latest.set(r.match_id, r)
  return [...latest.values()]
}

/** Scheduled fixtures that have no published prediction yet (beyond the prediction window). */
export async function laterFixtures(nowIso: string, predicted: Set<string>, limit = 10) {
  const rows = await select<{ match_id: string; home_team: string; away_team: string; kickoff_utc: string }>('epl_matches', {
    select: 'match_id,home_team,away_team,kickoff_utc', status: 'eq.scheduled', kickoff_utc: `gt.${nowIso}`,
    order: 'kickoff_utc.asc', limit: 80,
  })
  return rows.filter(r => !predicted.has(r.match_id)).slice(0, limit)
}

/** How the match-result model did on the held-out 2025/26 season (from the latest run). */
export async function heldOutResultAccuracy(): Promise<{ accuracy: number; n: number; season: string } | null> {
  const run = await latestRun()
  if (!run) return null
  const rows = await select<Evaluation>('epl_model_evaluations', {
    select: 'accuracy,n_matches,season', run_key: `eq.${run.run_key}`, model_name: 'eq.selected', target: 'eq.outcome',
    split: 'eq.test', season: 'eq.ALL', limit: 1,
  })
  const r = rows[0]
  return r && r.accuracy != null ? { accuracy: r.accuracy, n: r.n_matches, season: '2025/26' } : null
}

/** Calendar day of a kickoff in UK time, for grouping fixtures into match days. */
export function ukDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })
}
