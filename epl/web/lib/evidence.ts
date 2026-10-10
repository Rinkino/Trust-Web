import type { Evidence } from '@/components/FixturePrediction'
import { latestRun, latestSelection, select, type Evaluation } from '@/lib/db'

/** For every target: the selected model and its held-out (2025/26) evaluation. */
export async function loadEvidence(competition = 'EPL'): Promise<Evidence> {
  const [run, selection] = await Promise.all([latestRun(competition), latestSelection(competition)])
  if (!run) return {}
  const evals = await select<Evaluation>('epl_model_evaluations', {
    select: 'model_name,target,target_kind,mae,log_loss,brier,improvement_pct,n_matches,calibration',
    competition: `eq.${competition}`, run_key: `eq.${run.run_key}`, split: 'eq.test', season: 'eq.2025-26',
  })
  const out: Evidence = {}
  for (const s of selection) {
    out[s.target] = { sel: s, test: evals.find(e => e.model_name === s.selected_model && e.target === s.target) }
  }
  return out
}
