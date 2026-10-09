import { selectAll, type PredictionRow } from '@/lib/db'
import { errorRows } from '@/lib/history'
import { TARGET_BY_KEY, TARGETS } from '@/lib/targets'
import { csvCell, parseHistoryFilter } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// CSV of per-match evaluation results for the given filters (max 5,000 matches).
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries())
  const f = parseHistoryFilter(sp, TARGETS.map(t => t.key))
  const q: Record<string, string> = {
    select: '*', mode: 'eq.backtest', model_name: `eq.${f.model}`, status: 'eq.completed', order: 'match_date.asc,match_id.asc',
  }
  if (f.season) q.season = `eq.${f.season}`
  if (f.team) q.or = `(home_team.eq."${f.team}",away_team.eq."${f.team}")`
  const rows = await selectAll<PredictionRow>('epl_prediction_results', q, 5000)
  const targets = f.target ? [TARGET_BY_KEY[f.target]] : TARGETS
  const cols = ['match_id', 'season', 'match_date', 'fixture', 'target', 'kind', 'model', 'model_version', 'predicted', 'actual', 'abs_error', 'prob_of_actual', 'correct'] as const
  const lines = [cols.join(',')]
  for (const r of rows) for (const e of errorRows(r, targets)) lines.push(cols.map(c => csvCell(e[c])).join(','))
  const name = `epl-evaluation-${f.model}${f.season ? `-${f.season}` : ''}${f.target ? `-${f.target}` : ''}.csv`
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  })
}
