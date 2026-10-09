import type { CountValue, PredictionRow } from '@/lib/db'
import { actualFor } from '@/lib/format'
import { TARGETS, type Target } from '@/lib/targets'

export type ErrorRow = {
  match_id: string; season: string; match_date: string; fixture: string; model: string; model_version: string
  target: string; kind: string; predicted: string; actual: string; abs_error: number | null
  prob_of_actual: number | null; correct: boolean | null
}

/** One row per (prediction, target): prediction made before kickoff beside the actual result. */
export function errorRows(p: PredictionRow, targets: Target[] = TARGETS): ErrorRow[] {
  const out: ErrorRow[] = []
  for (const t of targets) {
    const v = p.values[t.key]
    const a = actualFor(t.key, p as unknown as Record<string, unknown>)
    if (v === undefined || a === null) continue
    const base = {
      match_id: p.match_id, season: p.season ?? '', match_date: p.match_date, fixture: `${p.home_team} v ${p.away_team}`,
      model: (p.target_models?.[t.key] as string | undefined) ?? p.model_name, model_version: p.model_version, target: t.key, kind: t.kind,
    }
    if (t.kind === 'count') {
      const c = v as CountValue
      out.push({ ...base, predicted: c.mean.toFixed(2), actual: String(a), abs_error: Math.abs(c.mean - a), prob_of_actual: null, correct: null })
    } else if (t.kind === 'probability') {
      const pr = v as number
      out.push({ ...base, predicted: pr.toFixed(3), actual: a ? 'yes' : 'no', abs_error: null, prob_of_actual: a ? pr : 1 - pr, correct: (pr >= 0.5) === (a === 1) })
    } else {
      const probs = v as number[]
      const best = probs.indexOf(Math.max(...probs))
      out.push({ ...base, predicted: ['H', 'D', 'A'][best], actual: ['H', 'D', 'A'][a], abs_error: null, prob_of_actual: probs[a], correct: best === a })
    }
  }
  return out
}
