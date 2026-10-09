import { Count, ProbBar } from '@/components/viz'
import type { CountValue, Evaluation, PredictionRow, Selection } from '@/lib/db'
import { actualFor, num, OUTCOME, pct, signedPct, when } from '@/lib/format'
import { MODEL_SHORT, TARGET_BY_KEY } from '@/lib/targets'

export type Evidence = Record<string, { sel?: Selection; test?: Evaluation }>

type Props = {
  p: PredictionRow
  evidence: Evidence
  actual?: Record<string, any> | null     // match row with results (historical mode only)
  fixtureSource?: string
}

const SECTIONS: { title: string; counts: string[]; probs: string[] }[] = [
  { title: 'Goals', counts: ['goals_home', 'goals_away', 'goals_total'], probs: ['goals_over_1_5', 'goals_over_2_5', 'goals_over_3_5', 'btts'] },
  { title: 'Shots', counts: ['shots_home', 'shots_away', 'shots_total', 'sot_home', 'sot_away', 'sot_total'], probs: [] },
  { title: 'Corners', counts: ['corners_home', 'corners_away', 'corners_total'], probs: ['corners_over_8_5', 'corners_over_9_5', 'corners_over_10_5'] },
  { title: 'Cards', counts: ['yellows_home', 'yellows_away', 'yellows_total'], probs: ['yellows_at_least_4', 'red_home', 'red_away'] },
]

function evidenceText(key: string, ev: Evidence): React.ReactNode {
  const e = ev[key]
  if (!e?.test) return <span className="muted">—</span>
  const m = e.test.target_kind === 'count' ? `MAE ${num(e.test.mae, 2)}` : `log loss ${num(e.test.log_loss, 3)}`
  return (
    <span className="small">
      {m} <span className={e.test.improvement_pct != null && e.test.improvement_pct > 0 ? 'pos' : 'neg'}>({signedPct(e.test.improvement_pct)} vs baseline)</span>
      {e.sel && !e.sel.reliable ? <span className="tag warn" style={{ marginLeft: 6 }}>weak</span> : null}
    </span>
  )
}

export default function FixturePrediction({ p, evidence, actual, fixtureSource }: Props) {
  const v = p.values
  const tm = (p.target_models ?? {}) as Record<string, string>
  const outcome = v.outcome as number[] | undefined
  const top = v.top_scorelines as number[][] | undefined
  const act = (k: string) => (actual ? actualFor(k, actual) : null)
  const actualOutcome = act('outcome')

  return (
    <article className="card fixture">
      <div className="head">
        <div>
          <div className="teams">{p.home_team} <span className="muted">vs</span> {p.away_team}</div>
          <div className="small muted">
            {p.kickoff_utc ? `Kick-off ${when(p.kickoff_utc)}` : `Match date ${p.match_date}`}
            {fixtureSource ? ` · fixture source: ${fixtureSource}` : ''}
          </div>
        </div>
        {actual ? (
          <div className="mono" style={{ fontSize: 20 }}>{actual.fthg}–{actual.ftag} <span className="small muted">final</span></div>
        ) : <span className="tag accent">{p.mode === 'live' ? 'live prediction' : 'reconstructed (backtest)'}</span>}
      </div>

      {outcome && (
        <div style={{ marginBottom: 14 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Result probabilities <span className="tag">{MODEL_SHORT[tm.outcome] ?? '?'}</span>{' '}
            {evidenceText('outcome', evidence)}
          </div>
          <ProbBar p={outcome} />
          <div className="small muted mono" style={{ marginTop: 4 }}>
            Home {pct(outcome[0], 1)} · Draw {pct(outcome[1], 1)} · Away {pct(outcome[2], 1)}
            {actualOutcome != null ? <> · actual: <strong>{OUTCOME[actualOutcome]}</strong> (forecast gave it {pct(outcome[actualOutcome], 1)})</> : null}
          </div>
        </div>
      )}

      {SECTIONS.map(sec => (
        <section key={sec.title} style={{ marginTop: 10 }}>
          <h3>{sec.title}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Statistic</th><th>Expected (80% range)</th>{actual ? <th className="num">Actual</th> : null}<th>Model</th><th>Model&apos;s 2025/26 test error</th></tr>
              </thead>
              <tbody>
                {sec.counts.map(k => (
                  <tr key={k}>
                    <td>{TARGET_BY_KEY[k].label}</td>
                    <td><Count v={v[k] as CountValue | undefined} /></td>
                    {actual ? <td className="num">{act(k) ?? '—'}</td> : null}
                    <td><span className="tag">{MODEL_SHORT[tm[k]] ?? '?'}</span></td>
                    <td>{evidenceText(k, evidence)}</td>
                  </tr>
                ))}
                {sec.probs.map(k => (
                  <tr key={k}>
                    <td>{TARGET_BY_KEY[k].label} <span className="muted small">probability</span></td>
                    <td className="mono">{pct(v[k] as number | undefined, 1)}</td>
                    {actual ? <td className="num">{act(k) == null ? '—' : act(k) ? 'yes' : 'no'}</td> : null}
                    <td><span className="tag">{MODEL_SHORT[tm[k]] ?? '?'}</span></td>
                    <td>{evidenceText(k, evidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {top && (
        <p className="small muted" style={{ marginTop: 10 }}>
          Most likely scorelines: {top.slice(0, 5).map(([h, a, pr]) => `${h}–${a} (${pct(pr, 1)})`).join(', ')}
        </p>
      )}

      <details>
        <summary>Inputs and audit trail</summary>
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Prediction id</dt><dd className="mono">{p.prediction_id}</dd>
          <dt>Created</dt><dd>{when(p.created_at)}{p.mode === 'live' ? (p.generated_before_kickoff === false ? ' (after kickoff!)' : ' (before kickoff)') : ' (reconstructed later from data before the match)'}</dd>
          <dt>Information cut-off</dt><dd>{when(p.data_cutoff)} — no result after this was used</dd>
          <dt>Model set</dt><dd className="mono">{p.model_version}</dd>
          <dt>Pipeline run</dt><dd className="mono">{p.pipeline_run}</dd>
          <dt>Per-target models</dt>
          <dd className="small">
            {Object.entries(tm).filter(([k]) => !k.startsWith('_') && k !== 'top_scorelines').map(([k, m]) => `${TARGET_BY_KEY[k]?.label ?? k}: ${MODEL_SHORT[m] ?? m}`).join(' · ')}
          </dd>
          {tm._versions ? <><dt>Model versions</dt><dd className="mono small">{Object.entries(tm._versions as unknown as Record<string, string>).map(([m, ver]) => `${m}@${ver}`).join(', ')}</dd></> : null}
        </dl>
        <p className="note">
          The &ldquo;test error&rdquo; columns describe how the model did on the whole 2025/26 season. They are not the probability that
          this particular prediction is right.
        </p>
      </details>
    </article>
  )
}
