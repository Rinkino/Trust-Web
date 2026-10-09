import Link from 'next/link'
import DemoButton from '@/components/DemoButton'
import { select } from '@/lib/db'
import { when } from '@/lib/format'

export const revalidate = 0
export const dynamic = 'force-dynamic'

type Run = { run_id: string; mode: string; seed: string; eligible_count: number; created_at: string }

export default async function DemoIndex() {
  const runs = await select<Run>('epl_demo_runs', { select: 'run_id,mode,seed,eligible_count,created_at', order: 'created_at.desc', limit: 25 }, { revalidate: 0 })
  return (
    <>
      <h1>Three-match demonstration</h1>
      <p className="lede">
        Press the button to pick three eligible fixtures at random. A fresh random seed is generated and stored with the
        run, together with a hash of the full eligible list, so the choice can be re-derived and checked later. Every press
        creates a new run; earlier runs are kept.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
        <DemoButton />
        <DemoButton mode="historical" label="Historical demo (3 past matches)" />
      </div>
      <div className="callout info" style={{ marginTop: 18 }}>
        <strong>Live mode</strong> uses upcoming fixtures and the predictions the pipeline stored for them before kickoff.
        If fewer than three exist, the button falls back to <strong>historical mode</strong>: three completed 2025/26 or
        2026/27 matches, predicted by models trained only on matches before each one&apos;s gameweek, shown next to the real
        result. Historical demos are labelled as reconstructions and are never presented as live predictions.
      </div>

      <h2>Previous runs</h2>
      {runs.length === 0 ? <p className="muted">No runs yet.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Run</th><th>Mode</th><th>Created</th><th className="num">Eligible matches</th><th>Seed</th></tr></thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.run_id}>
                  <td><Link href={`/demo/${r.run_id}`} className="mono small">{r.run_id.slice(0, 8)}</Link></td>
                  <td><span className={`tag ${r.mode === 'live' ? 'good' : 'warn'}`}>{r.mode}</span></td>
                  <td className="small">{when(r.created_at)}</td>
                  <td className="num">{r.eligible_count}</td>
                  <td className="mono small">{r.seed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
