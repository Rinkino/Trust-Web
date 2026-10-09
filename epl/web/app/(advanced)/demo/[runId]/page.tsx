import Link from 'next/link'
import { notFound } from 'next/navigation'
import DemoButton from '@/components/DemoButton'
import FixturePrediction from '@/components/FixturePrediction'
import { select, type PredictionRow } from '@/lib/db'
import { loadEvidence } from '@/lib/evidence'
import { when } from '@/lib/format'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

type Run = { run_id: string; mode: string; seed: string; eligible_count: number; eligible_hash: string; selection_rule: string; created_at: string }
type Item = { position: number; match_id: string; prediction_id: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export default async function DemoRun({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  if (!UUID.test(runId)) notFound()
  const [run] = await select<Run>('epl_demo_runs', { select: '*', run_id: `eq.${runId}` })
  if (!run) notFound()
  const items = await select<Item>('epl_demo_run_items', { select: '*', run_id: `eq.${runId}`, order: 'position.asc' })
  const ids = items.map(i => i.prediction_id)
  const [preds, evidence, generated] = await Promise.all([
    select<PredictionRow>('epl_prediction_results', { select: '*', prediction_id: `in.(${ids.join(',')})` }),
    loadEvidence(),
    select<{ prediction_id: string; generated_before_kickoff: boolean | null }>('epl_predictions', { select: 'prediction_id,generated_before_kickoff', prediction_id: `in.(${ids.join(',')})` }),
  ])
  const gbk = Object.fromEntries(generated.map(g => [g.prediction_id, g.generated_before_kickoff]))
  const byId = Object.fromEntries(preds.map(p => [p.prediction_id, { ...p, generated_before_kickoff: gbk[p.prediction_id] }]))
  const historical = run.mode === 'historical'

  return (
    <>
      <p><Link href="/demo">← All demonstration runs</Link></p>
      <h1>{historical ? 'Historical demonstration' : 'Three random upcoming matches'}</h1>
      {historical ? (
        <div className="callout">
          <strong>Historical mode — not live predictions.</strong> These three matches have already been played. Each
          prediction was reconstructed by models trained only on matches before that match&apos;s gameweek, and features used
          only earlier results. The actual outcome is shown alongside.
        </div>
      ) : (
        <div className="callout info">
          <strong>Live mode.</strong> These are the predictions the pipeline stored for each fixture before kickoff. The
          selection below is new; the predictions themselves keep their original creation time and model versions.
        </div>
      )}

      <dl className="kv card" style={{ margin: '14px 0 22px' }}>
        <dt>Run id</dt><dd className="mono">{run.run_id}</dd>
        <dt>Created</dt><dd>{when(run.created_at)}</dd>
        <dt>Mode</dt><dd>{run.mode}</dd>
        <dt>Random seed</dt><dd className="mono">{run.seed}</dd>
        <dt>Eligible matches</dt><dd>{run.eligible_count} <span className="muted small">(sha256 of sorted ids: <span className="mono">{run.eligible_hash.slice(0, 16)}…</span>)</span></dd>
        <dt>Selection rule</dt><dd className="small">{run.selection_rule}</dd>
      </dl>

      {items.map(it => {
        const p = byId[it.prediction_id]
        if (!p) return <p key={it.position} className="neg">Prediction {it.prediction_id} not found.</p>
        return (
          <FixturePrediction
            key={it.position}
            p={p}
            evidence={evidence}
            actual={historical && p.status === 'completed' ? p : null}
            fixtureSource={historical ? 'football-data.co.uk results' : 'fixturedownload.com schedule, cross-checked with football-data.co.uk'}
          />
        )
      })}

      <div style={{ marginTop: 20 }}><DemoButton label="Run again (new random selection)" /></div>
    </>
  )
}
