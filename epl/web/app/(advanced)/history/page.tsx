import Link from 'next/link'
import { select, type PredictionRow } from '@/lib/db'
import { num, pct } from '@/lib/format'
import { errorRows } from '@/lib/history'
import { parseHistoryFilter } from '@/lib/validate'
import { MODEL_LABEL, MODEL_SHORT, TARGET_BY_KEY, TARGETS } from '@/lib/targets'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

const PAGE = 50
type SP = Promise<Record<string, string | undefined>>

export default async function HistoryPage({ searchParams }: { searchParams: SP }) {
  const f = parseHistoryFilter(await searchParams, TARGETS.map(t => t.key))
  const q: Record<string, string> = {
    select: '*', mode: 'eq.backtest', model_name: `eq.${f.model}`, status: 'eq.completed', order: 'match_date.desc,match_id.asc',
  }
  if (f.season) q.season = `eq.${f.season}`
  if (f.team) q.or = `(home_team.eq."${f.team}",away_team.eq."${f.team}")`
  const rows = await select<PredictionRow>('epl_prediction_results', q, { from: (f.page - 1) * PAGE, to: f.page * PAGE - 1 })
  const targets = f.target ? [TARGET_BY_KEY[f.target]] : TARGETS.filter(t => ['goals_total', 'outcome', 'goals_over_2_5', 'corners_total', 'shots_total', 'yellows_total'].includes(t.key))
  const errs = rows.flatMap(r => errorRows(r, targets))
  const params = new URLSearchParams(Object.entries({ season: f.season, team: f.team, model: f.model, target: f.target }).filter(([, v]) => v) as [string, string][])
  const teams = ['Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 'Burnley', 'Chelsea', 'Coventry', 'Crystal Palace', 'Everton', 'Fulham', 'Hull', 'Ipswich', 'Leeds', 'Leicester', 'Liverpool', 'Luton', 'Man City', 'Man United', 'Newcastle', "Nott'm Forest", 'Sheffield United', 'Southampton', 'Sunderland', 'Tottenham', 'West Ham', 'Wolves']

  return (
    <>
      <h1>Historical accuracy</h1>
      <p className="lede">
        Predictions for past matches, made walk-forward (each from models trained only on earlier gameweeks), beside what
        actually happened. 2023/24–2024/25 were used to choose models; 2025/26 and 2026/27 are out of sample.
      </p>
      <form className="filters" method="get">
        <label>Season
          <select name="season" defaultValue={f.season ?? ''}>
            <option value="">All</option>
            {['2026-27', '2025-26', '2024-25', '2023-24'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Team
          <select name="team" defaultValue={f.team ?? ''}>
            <option value="">All</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Statistic
          <select name="target" defaultValue={f.target ?? ''}>
            <option value="">Key statistics</option>
            {TARGETS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label>Model
          <select name="model" defaultValue={f.model}>
            {['selected', 'baseline', 'team_avg', 'poisson_strength', 'glm', 'hgb', 'logit_outcome', 'hgb_outcome', 'market'].map(m => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
          </select>
        </label>
        <button className="btn ghost" type="submit">Filter</button>
        <a className="btn ghost" href={`/api/export?${params.toString()}`}>Download CSV</a>
      </form>
      {f.model === 'selected' && <p className="note">&ldquo;Selected&rdquo; predictions exist only for out-of-sample seasons (2025/26 onwards), because the selection was made on the earlier seasons.</p>}

      {errs.length === 0 ? <p className="muted">No matching predictions.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Fixture</th><th>Statistic</th><th className="num">Predicted</th><th className="num">Actual</th><th className="num">Abs. error</th><th className="num">P(actual)</th><th>Hit</th><th>Model</th></tr></thead>
            <tbody>
              {errs.map((e, i) => (
                <tr key={i}>
                  <td className="small">{e.match_date}</td>
                  <td className="small">{e.fixture}</td>
                  <td className="small">{TARGET_BY_KEY[e.target].label}</td>
                  <td className="num">{e.predicted}</td>
                  <td className="num">{e.actual}</td>
                  <td className="num">{num(e.abs_error, 2)}</td>
                  <td className="num">{pct(e.prob_of_actual, 0)}</td>
                  <td>{e.correct === null ? '' : e.correct ? <span className="pos">✓</span> : <span className="neg">✗</span>}</td>
                  <td className="small">{MODEL_SHORT[e.model] ?? e.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        {f.page > 1 && <Link href={`/history?${params.toString()}&page=${f.page - 1}`}>← Newer</Link>}
        <span className="muted">Page {f.page} · {rows.length} matches</span>
        {rows.length === PAGE && <Link href={`/history?${params.toString()}&page=${f.page + 1}`}>Older →</Link>}
      </div>
      <p className="note">
        &ldquo;P(actual)&rdquo; is the probability the forecast gave to what actually happened. &ldquo;Hit&rdquo; for probabilities uses a 50%
        threshold and for the result the most likely outcome; aggregate scores are on the <Link href="/evaluation">evaluation page</Link>.
      </p>
    </>
  )
}
