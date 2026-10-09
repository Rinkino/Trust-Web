import Link from 'next/link'
import { Reliability, SeasonBars } from '@/components/viz'
import { latestRun, latestSelection, selectAll, type Evaluation } from '@/lib/db'
import { day, num, pct, signedPct } from '@/lib/format'
import { MODEL_LABEL, MODEL_SHORT, TARGETS } from '@/lib/targets'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

const COUNT_MODELS = ['baseline', 'team_avg', 'poisson_strength', 'glm', 'hgb']
const PROB_MODELS = ['baseline', 'team_avg', 'poisson_strength', 'glm', 'hgb']
const OUTCOME_MODELS = ['baseline', 'team_avg', 'poisson_strength', 'glm', 'logit_outcome', 'hgb', 'hgb_outcome', 'market']

type SP = Promise<Record<string, string | undefined>>

export default async function EvaluationPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const split = sp.split === 'validation' ? 'validation' : 'test'
  const run = await latestRun()
  if (!run) return <><h1>Model evaluation</h1><p className="muted">No successful pipeline run yet.</p></>
  const [all, selection] = await Promise.all([
    selectAll<Evaluation>('epl_model_evaluations', { select: '*', run_key: `eq.${run.run_key}` }),
    latestSelection(),
  ])
  const seasonsAvail = [...new Set(all.filter(e => e.split === split && e.season !== 'ALL').map(e => e.season))].sort()
  const defaultSeason = split === 'test' ? '2025-26' : 'ALL'
  const season = sp.season && (sp.season === 'ALL' || seasonsAvail.includes(sp.season)) ? sp.season : defaultSeason
  const ev = all.filter(e => e.split === split && e.season === season)
  const get = (model: string, target: string) => ev.find(e => e.model_name === model && e.target === target)
  const sel = Object.fromEntries(selection.map(s => [s.target, s]))
  const any = ev[0]
  const methodology = any?.methodology ?? ''

  return (
    <>
      <h1>Model evaluation</h1>
      <p className="lede">
        Every model is scored on the same matches. Predictions were made walk-forward: before each gameweek the models
        were retrained on earlier matches only, then predicted that gameweek. {methodology}
      </p>

      <form className="filters" method="get">
        <label>Split
          <select name="split" defaultValue={split}>
            <option value="test">Test (held out)</option>
            <option value="validation">Validation (used to choose models)</option>
          </select>
        </label>
        <label>Season
          <select name="season" defaultValue={season}>
            <option value="ALL">All seasons in split</option>
            {seasonsAvail.map(s => <option key={s} value={s}>{s}{s === '2026-27' ? ' (to date)' : ''}</option>)}
          </select>
        </label>
        <button className="btn ghost" type="submit">Show</button>
      </form>

      {any && (
        <div className="callout info">
          <strong>{split === 'test' ? 'Out of sample.' : 'Used for model selection.'}</strong>{' '}
          {day(any.eval_start)} to {day(any.eval_end)}, {Math.max(...ev.filter(e => e.target === 'goals_home').map(e => e.n_matches), 0)} matches.
          {split === 'test'
            ? ' These matches were never used to tune or choose any model. 2026/27 is the current season to date.'
            : ' Scores here influenced which model serves each target, so they are optimistic for the chosen model.'}
          {' '}Run <span className="mono">{run.run_key}</span>.
        </div>
      )}

      <h2>Counts: mean absolute error</h2>
      <p className="note">
        MAE is the average distance between the expected count and what happened, in the statistic&apos;s own units
        (lower is better). Improvement = 100 × (baseline MAE − model MAE) / baseline MAE. The bracket is a 95% bootstrap
        interval for that improvement; if it includes 0 the difference may be noise.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target</th>
              {COUNT_MODELS.map(m => <th key={m} className="num">{MODEL_SHORT[m]}</th>)}
              <th>Best</th><th className="num">Best vs baseline</th>
              <th>Selected</th><th className="num">Selected vs baseline</th><th className="num">RMSE (sel.)</th><th className="num">80% interval coverage</th>
            </tr>
          </thead>
          <tbody>
            {TARGETS.filter(t => t.kind === 'count').map(t => {
              const rows = COUNT_MODELS.map(m => get(m, t.key))
              const valid = rows.filter((r): r is Evaluation => !!r && r.mae != null)
              if (!valid.length) return null
              const best = valid.reduce((a, b) => (b.mae! < a.mae! ? b : a))
              const s = sel[t.key]
              const sr = s ? get(s.selected_model, t.key) : undefined
              return (
                <tr key={t.key}>
                  <td>{t.label}</td>
                  {rows.map((r, i) => <td key={i} className={`num ${r === best ? 'best' : ''}`}>{num(r?.mae ?? null, 3)}</td>)}
                  <td>{MODEL_SHORT[best.model_name]}</td>
                  <Imp e={best} />
                  <td>{s ? MODEL_SHORT[s.selected_model] : '—'}{s && !s.reliable ? <span className="tag warn" style={{ marginLeft: 6 }}>weak</span> : null}</td>
                  <Imp e={sr} />
                  <td className="num">{num(sr?.rmse ?? null, 3)}</td>
                  <td className="num">{pct(sr?.coverage_80 ?? null)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note">
        The 80% interval should contain the actual count about 80% of the time; counts are whole numbers, so coverage can
        sit a little above the nominal level.
      </p>

      <h2>Probabilities: log loss and Brier score</h2>
      <p className="note">
        Log loss punishes confident wrong forecasts heavily; Brier is the mean squared error of the probability. Both: lower
        is better. Accuracy alone is not used to rank probability forecasts.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target</th><th className="num">Base rate</th>
              {PROB_MODELS.map(m => <th key={m} className="num">{MODEL_SHORT[m]}</th>)}
              <th className="num">Market</th>
              <th>Selected</th><th className="num">Log-loss change</th><th className="num">Brier (sel.)</th><th className="num">Calibration error</th>
            </tr>
          </thead>
          <tbody>
            {TARGETS.filter(t => t.kind === 'probability').map(t => {
              const rows = PROB_MODELS.map(m => get(m, t.key))
              const valid = rows.filter((r): r is Evaluation => !!r && r.log_loss != null)
              if (!valid.length) return null
              const best = valid.reduce((a, b) => (b.log_loss! < a.log_loss! ? b : a))
              const s = sel[t.key]
              const sr = s ? get(s.selected_model, t.key) : undefined
              const mk = get('market', t.key)
              return (
                <tr key={t.key}>
                  <td>{t.label}</td>
                  <td className="num">{pct(rows[0]?.calibration?.base_rate ?? null)}</td>
                  {rows.map((r, i) => <td key={i} className={`num ${r === best ? 'best' : ''}`}>{num(r?.log_loss ?? null, 4)}</td>)}
                  <td className="num muted">{num(mk?.log_loss ?? null, 4)}</td>
                  <td>{s ? MODEL_SHORT[s.selected_model] : '—'}{s && !s.reliable ? <span className="tag warn" style={{ marginLeft: 6 }}>weak</span> : null}</td>
                  <Imp e={sr} />
                  <td className="num">{num(sr?.brier ?? null, 4)}</td>
                  <td className="num">{pct(sr?.ece ?? null, 1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2>Match result (home / draw / away)</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Model</th><th className="num">Log loss</th><th className="num">Brier</th><th className="num">Most-likely outcome correct</th><th className="num">vs baseline</th><th className="num">Matches</th></tr></thead>
          <tbody>
            {OUTCOME_MODELS.map(m => {
              const r = get(m, 'outcome')
              if (!r) return null
              return (
                <tr key={m}>
                  <td>{MODEL_LABEL[m]}{sel.outcome?.selected_model === m ? <span className="tag good" style={{ marginLeft: 6 }}>selected</span> : null}</td>
                  <td className="num">{num(r.log_loss, 4)}</td>
                  <td className="num">{num(r.brier, 4)}</td>
                  <td className="num">{pct(r.accuracy, 1)}</td>
                  {m === 'baseline' ? <td className="num muted">—</td> : <Imp e={r} />}
                  <td className="num">{r.n_matches}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note">
        The market row converts average pre-closing bookmaker odds into probabilities. It is shown only as an external
        yardstick and is never used to make predictions here. Beating it would be surprising; matching it is a good result.
      </p>

      <h2>Calibration of the selected models</h2>
      <p className="note">Each dot is a group of forecasts: when the model said x%, did it happen about x% of the time? Dots on the dashed line are well calibrated. Larger dots hold more matches.</p>
      <div className="grid two">
        {[['outcome', 'Home win probability'], ['goals_over_2_5', 'Over 2.5 goals'], ['btts', 'Both teams score'], ['corners_over_9_5', 'Over 9.5 corners']].map(([t, label]) => {
          const s = sel[t]
          const r = s ? get(s.selected_model, t) : undefined
          const bins = r?.calibration?.bins
          return bins?.length ? <div key={t} className="card"><Reliability bins={bins} title={`${label} · ${MODEL_SHORT[s!.selected_model]} · n=${r!.n_matches}`} /></div> : null
        })}
      </div>

      <h2>By season</h2>
      <PerSeason all={all} />

      <h2>Model selection</h2>
      <p className="note">
        For each target the candidates were ranked on {selection[0]?.selection_period ?? 'the validation seasons'}. A more complex model
        replaced a simpler one only when it was better by more than 0.5%. &ldquo;Weak&rdquo; means the chosen model&apos;s improvement over
        the baseline was not statistically distinguishable from zero on validation.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Target</th><th>Selected</th><th>Why</th></tr></thead>
          <tbody>
            {TARGETS.map(t => {
              const s = sel[t.key]
              if (!s) return null
              return (
                <tr key={t.key}>
                  <td>{t.label}</td>
                  <td>{MODEL_LABEL[s.selected_model]} <span className="mono small muted">{s.selected_version}</span></td>
                  <td className="small">{s.reason}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2>Limitations</h2>
      <ul className="note" style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>Inputs are limited to what the results files contain: no lineups, injuries, suspensions, referees, weather or xG history (xG only exists from 2026/27).</li>
        <li>&ldquo;Days of rest&rdquo; counts Premier League matches only; cup and European fixtures are not in the data.</li>
        <li>Totals and threshold probabilities are derived by treating the two teams&apos; counts as independent, apart from the low-score correction for goals. Calibration above shows where that holds.</li>
        <li>Red cards are rare (about 1 in 10 team-matches), so their probabilities rest on little signal.</li>
        <li>Models are retrained weekly in the backtest but features update daily, which mirrors how the live pipeline runs.</li>
      </ul>
      <p className="note"><Link href="/history">Per-match results</Link> · <Link href="/data">Data status</Link></p>
    </>
  )
}

function Imp({ e }: { e: Evaluation | undefined }) {
  if (!e || e.improvement_pct == null) return <td className="num muted">—</td>
  const ci = e.calibration?.improvement_ci
  return (
    <td className={`num ${e.improvement_pct > 0 ? 'pos' : e.improvement_pct < 0 ? 'neg' : ''}`}>
      {signedPct(e.improvement_pct)}
      {ci ? <span className="muted small"> [{ci[0].toFixed(1)}, {ci[1].toFixed(1)}]</span> : null}
    </td>
  )
}

function PerSeason({ all }: { all: Evaluation[] }) {
  const seasons = [...new Set(all.filter(e => e.season !== 'ALL').map(e => e.season))].sort()
  const series = (target: string, metric: 'mae' | 'log_loss', models: [string, string][]) =>
    models.map(([m, color]) => ({
      name: MODEL_SHORT[m], color,
      values: seasons.map(s => (all.find(e => e.season === s && e.model_name === m && e.target === target)?.[metric] ?? null) as number | null),
    }))
  const palette: [string, string][] = [['baseline', 'var(--bar-d)'], ['poisson_strength', 'var(--bar-a)'], ['glm', 'var(--bar-h)'], ['hgb', '#7b5ea7']]
  return (
    <div className="grid two">
      <div className="card"><SeasonBars seasons={seasons} series={series('goals_total', 'mae', palette)} title="Total goals MAE by season" /></div>
      <div className="card"><SeasonBars seasons={seasons} series={series('outcome', 'log_loss', [...palette, ['market', '#3c9a6b']])} title="Match result log loss by season" /></div>
      <div className="card"><SeasonBars seasons={seasons} series={series('corners_total', 'mae', palette)} title="Total corners MAE by season" /></div>
      <div className="card"><SeasonBars seasons={seasons} series={series('shots_home', 'mae', palette)} title="Home shots MAE by season" /></div>
    </div>
  )
}

