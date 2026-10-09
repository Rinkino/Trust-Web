import Link from 'next/link'
import DemoButton from '@/components/DemoButton'
import { count, latestRun, latestSelection, select, type Evaluation, type Registry } from '@/lib/db'
import { num, signedPct, when } from '@/lib/format'
import { MODEL_LABEL, MODEL_SHORT, PRIMARY, TARGET_BY_KEY, type TargetKind } from '@/lib/targets'

export const revalidate = 300

const HEADLINE = ['goals_total', 'outcome', 'goals_over_2_5', 'shots_total', 'sot_total', 'corners_total', 'yellows_total']

export default async function Dashboard() {
  const [run, selection, completed, registry] = await Promise.all([
    latestRun(),
    latestSelection(),
    count('epl_matches', { status: 'eq.completed' }),
    select<Registry>('epl_model_registry', { select: '*', order: 'created_at.desc', limit: 40 }),
  ])
  const nowIso = new Date().toISOString()
  const upcoming = await select<{ match_id: string }>('epl_predictions', {
    select: 'match_id', mode: 'eq.live', model_name: 'eq.selected', kickoff_utc: `gt.${nowIso}`,
  })
  const eligible = new Set(upcoming.map(u => u.match_id)).size
  const evals = run
    ? await select<Evaluation>('epl_model_evaluations', {
        select: 'model_name,target,target_kind,mae,log_loss,n_matches,eval_start,eval_end',
        run_key: `eq.${run.run_key}`, split: 'eq.test', season: 'eq.2025-26', target: `in.(${HEADLINE.join(',')})`,
      })
    : []
  const summary = run?.summary ?? {}
  const seasons: string[] = summary.data?.seasons ?? []
  const selByTarget = Object.fromEntries(selection.map(s => [s.target, s]))
  const currentModels = new Map<string, Registry>()
  for (const r of registry) if (!currentModels.has(r.model_name)) currentModels.set(r.model_name, r)

  return (
    <>
      <h1>Premier League match-statistics predictor</h1>
      <p className="lede">
        Goals, shots, corners and cards for Premier League fixtures, predicted by several models that are compared on
        matches they had not seen. Every number on this site comes from the running pipeline; nothing is hand-entered.
      </p>

      <div className="grid stats">
        <Stat label="Historical matches" value={completed.toLocaleString()} sub={seasons.length ? `${seasons[0]} to ${seasons[seasons.length - 1]}` : ''} />
        <Stat label="Seasons covered" value={String(seasons.length || '—')} sub="football-data.co.uk" />
        <Stat label="Eligible upcoming fixtures" value={String(eligible)} sub="verified, not started, with a prediction" />
        <Stat label="Latest data ingestion" value={run ? when(run.finished_at).replace(/ UTC$/, '') : '—'} sub={summary.data ? `results to ${summary.data.last_result_date}` : 'no successful run yet'} />
        <Stat label="Latest model training" value={currentModels.get('poisson_strength')?.training_end ?? '—'} sub="last match in the training data" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '24px 0 8px' }}>
        <DemoButton />
        <Link className="btn ghost" href="/evaluation">Model evaluation</Link>
        <Link className="btn ghost" href="/predictions">Upcoming predictions</Link>
      </div>
      <p className="note">
        The button picks three eligible upcoming fixtures at random (with a recorded seed) and shows their stored
        pre-kickoff predictions. With fewer than three upcoming fixtures it runs a clearly labelled historical demo instead.
      </p>

      <h2>Held-out season 2025/26: best model vs baseline</h2>
      {evals.length === 0 ? <p className="muted">No evaluation stored yet.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Target</th><th>Metric</th><th className="num">Baseline</th><th className="num">Best model</th><th>Model</th><th className="num">Change</th><th className="num">Matches</th></tr></thead>
            <tbody>
              {HEADLINE.map(t => {
                const rows = evals.filter(e => e.target === t && e.model_name !== 'market' && e.model_name !== 'selected')
                if (!rows.length) return null
                const kind = rows[0].target_kind as TargetKind
                const m = PRIMARY[kind]
                const base = rows.find(r => r.model_name === 'baseline')
                const best = rows.reduce((a, b) => ((b[m] ?? Infinity) < (a[m] ?? Infinity) ? b : a))
                const imp = base && best[m] != null && base[m] ? (100 * ((base[m] as number) - (best[m] as number))) / (base[m] as number) : null
                return (
                  <tr key={t}>
                    <td>{TARGET_BY_KEY[t].label}</td>
                    <td className="muted">{m === 'mae' ? 'MAE' : 'Log loss'}</td>
                    <td className="num">{num(base?.[m] ?? null, 3)}</td>
                    <td className="num">{num(best[m] ?? null, 3)}</td>
                    <td>{MODEL_SHORT[best.model_name]}</td>
                    <td className={`num ${imp != null && imp > 0 ? 'pos' : 'neg'}`}>{signedPct(imp)}</td>
                    <td className="num">{base?.n_matches ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        Lower is better for both metrics. &ldquo;Best model&rdquo; here is simply the lowest score on the test season, shown for
        transparency; the model actually used for predictions was chosen earlier, on 2023/24–2024/25, without seeing this
        season. <Link href="/evaluation">Full comparison</Link>.
      </p>

      <h2>Models in use</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Model</th><th>Version</th><th>Status</th><th>Serves targets</th><th>Training data</th></tr></thead>
          <tbody>
            {[...currentModels.values()].map(r => {
              const serves = selection.filter(s => s.selected_model === r.model_name).length
              return (
                <tr key={r.model_name}>
                  <td>{MODEL_LABEL[r.model_name] ?? r.model_name}</td>
                  <td className="mono small">{r.model_version}</td>
                  <td><span className={`tag ${r.status === 'production' ? 'good' : ''}`}>{r.status}</span></td>
                  <td className="num">{serves}</td>
                  <td className="small">{r.training_start} → {r.training_end}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selection[0] && (
        <p className="note">
          Selection version <span className="mono">{selection[0].selection_version}</span>, chosen on {selection[0].selection_period}.
          {' '}{selection.filter(s => !s.reliable).length} of {selection.length} targets are flagged as not reliably better
          than the baseline ({selection.filter(s => !s.reliable).map(s => TARGET_BY_KEY[s.target]?.label).join(', ') || 'none'}).
          {' '}{selByTarget.outcome ? '' : ''}
        </p>
      )}
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  )
}
