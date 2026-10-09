import { Reliability } from '@/components/viz'
import LeagueTabs from '@/components/LeagueTabs'
import { leagueOf } from '@/lib/leagues'
import { select, selectAll } from '@/lib/db'
import { MODEL_LABEL } from '@/lib/targets'
import {
  MARKET_LABEL, PRICE_LABEL, ROLE_LABEL, ROLE_ORDER, STRATEGY_LABEL, VERDICT_TAG, pick, signed, verdict, type Coverage, type ValueRow,
} from '@/lib/value'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

type SP = Promise<Record<string, string | undefined>>
const pct = (x: number | null | undefined, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`)
const n2 = (x: number | null | undefined, d = 2) => (x == null ? '—' : x.toFixed(d))
const SPLIT_LABEL: Record<string, string> = {
  validation: 'Validation seasons (used to choose the models)',
  test: 'Test season (held out)',
  live: 'Current season to date',
}

export default async function BettingPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const league = leagueOf(sp.league)
  const latest = await select<{ run_key: string }>('epl_value_backtest', { select: 'run_key', competition: `eq.${league}`, order: 'created_at.desc', limit: 1 })
  const runKey = latest[0]?.run_key
  if (!runKey) {
    return (
      <>
        <h1>Betting against the market</h1>
        <p className="muted">The betting evaluation has not run yet. It is produced by the daily pipeline.</p>
      </>
    )
  }
  const [rows, coverage, bestCheck] = await Promise.all([
    selectAll<ValueRow>('epl_value_backtest', { select: '*', competition: `eq.${league}`, run_key: `eq.${runKey}` }),
    selectAll<Coverage>('epl_odds_coverage', { select: '*' }),
    selectAll<{ season: string; market: string; matches: number; below_100pct: number }>('epl_best_price_check', { select: '*' }),
  ])
  const split = ['validation', 'test', 'live'].includes(sp.split ?? '') ? sp.split! : 'validation'
  const seasons = [...new Set(rows.filter(r => r.split === split).map(r => r.season))].sort((a, b) => (a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b)))
  const season = sp.season && seasons.includes(sp.season) ? sp.season : 'ALL'
  const market = sp.market === 'ou25' ? 'ou25' : '1x2'
  const prices = [...new Set(rows.map(r => r.price_source))]
  const price = sp.price && prices.includes(sp.price) ? sp.price : 'average'
  const view = pick(rows, { split, season, market, price })
  const roles = ROLE_ORDER.filter(role => view.some(r => r.role === role))
  const byRole = (role: string, strategy: string) => view.find(r => r.role === role && r.strategy === strategy)
  const strategies = [...new Set(view.map(r => r.strategy))]
  const anyRow = view[0]
  const model = view.find(r => r.role === 'existing_model')

  // Headline: the existing model, every positive-EV bet, best prices, validation and test.
  const head = (['validation', 'test'] as const).map(s => ({
    split: s,
    row: rows.find(r => r.split === s && r.season === 'ALL' && r.market === market && r.price_source === 'average' && r.role === 'existing_model' && r.strategy === 'ev_0'),
  }))

  return (
    <>
      <LeagueTabs path="/betting" current={league} />
      <h1 style={{ marginTop: 14 }}>Betting against the market</h1>
      <p className="lede">
        Would betting on the model&apos;s numbers have made money? Every past match was predicted walk-forward (using only
        earlier matches), then compared with the bookmakers&apos; odds published before kick-off. The strategies below were
        fixed in advance; none was tuned to these results.
      </p>

      <div className="callout">
        <strong>The short answer.</strong>{' '}
        {head.map(({ split: s, row }) => (
          <span key={s}>
            {s === 'validation' ? 'Validation seasons' : 'Held-out season'}: {row ? verdict(row.metrics, s).text : 'not available.'}{' '}
          </span>
        ))}
        <br />
        <span className="small">
          {model ? MODEL_LABEL[model.model_name] ?? model.model_name : 'The model'} on {MARKET_LABEL[market].toLowerCase()}, betting every
          selection where it estimated a positive expected value, at the average bookmaker price. A model that is less accurate than the
          market mostly finds &ldquo;value&rdquo; where it is wrong, and the bookmakers&apos; margin has to be beaten on top of that.
        </span>
      </div>

      <form className="filters" method="get">
        <input type="hidden" name="league" value={league} />
        <label>Market
          <select name="market" defaultValue={market}>
            {Object.entries(MARKET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Period
          <select name="split" defaultValue={split}>
            {Object.entries(SPLIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Season
          <select name="season" defaultValue={season}>
            {seasons.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All seasons in period' : s}</option>)}
          </select>
        </label>
        <label>Odds taken
          <select name="price" defaultValue={price}>
            {prices.map(p => <option key={p} value={p}>{PRICE_LABEL[p] ?? p}</option>)}
          </select>
        </label>
        <button className="btn ghost" type="submit">Show</button>
      </form>

      {!anyRow ? <p className="muted">No results for this combination (the bookmaker may not be in the data for this period).</p> : (
        <>
          <p className="small muted">
            {anyRow.eligible_matches} matches from {anyRow.period_start} to {anyRow.period_end} with complete odds.
            {split === 'live' && ' The current season is in progress: treat any figure here as early and noisy.'}
          </p>

          <h2>How accurate are the probabilities?</h2>
          <p className="small muted">On every eligible match, not only the ones bet on. Lower is better for both scores.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Source of probabilities</th><th className="num">Log loss</th><th className="num">Brier score</th><th className="num">Matches</th></tr></thead>
              <tbody>
                {roles.map(role => {
                  const q = view.find(r => r.role === role)?.quality
                  return (
                    <tr key={role}>
                      <td>{ROLE_LABEL[role]}{role === 'existing_model' && model ? <span className="muted small"> ({MODEL_LABEL[model.model_name] ?? model.model_name})</span> : null}</td>
                      <td className="num">{n2(q?.log_loss, 4)}</td><td className="num">{n2(q?.brier, 4)}</td><td className="num">{q?.matches ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            The bookmaker market here is the average pre-closing odds with the margin removed (average margin in this period:{' '}
            {pct(anyRow.quality.avg_overround, 1)}). If our model scores worse than the market, its disagreements with the market are,
            on average, its own errors.
          </p>

          {price === 'best' && <BestWarning rows={bestCheck.filter(b => b.market === market)} />}

          <h2>Strategy results</h2>
          <p className="small muted">
            Flat stakes of 1 unit per bet at the pre-closing price of: {PRICE_LABEL[price] ?? price}. Return is profit divided by stakes.
            The 95% range comes from resampling matches; when it spans zero the result cannot be told apart from luck.
          </p>
          {strategies.map(st => (
            <section key={st} className="card" style={{ marginTop: 12 }}>
              <h3>{STRATEGY_LABEL[st] ?? st}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Probabilities from</th><th className="num">Bets</th><th className="num">Won</th><th className="num">Avg odds</th>
                      <th className="num">Matches</th><th className="num">Break-even</th><th className="num">Profit</th><th className="num">Return</th><th className="num">95% range</th>
                      <th className="num">Worst drawdown</th><th className="num">Beat closing price</th><th>Reading</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(role => {
                      const r = byRole(role, st)
                      const m = r?.metrics
                      const v = verdict(m, split)
                      return (
                        <tr key={role}>
                          <td>{ROLE_LABEL[role]}</td>
                          <td className="num">{m?.bets ?? 0}</td>
                          <td className="num">{m?.bets ? pct(m.win_rate, 1) : '—'}</td>
                          <td className="num">{m?.bets ? n2(m.avg_odds) : '—'}</td>
                          <td className="num">{m?.matches ?? '—'}</td>
                          <td className="num">{m?.bets ? pct(m.avg_break_even, 1) : '—'}</td>
                          <td className={`num ${m?.pnl != null ? (m.pnl >= 0 ? 'pos' : 'neg') : ''}`}>{m?.bets ? `${m.pnl! >= 0 ? '+' : ''}${n2(m.pnl, 1)}` : '—'}</td>
                          <td className="num">{m?.bets ? signed(m.roi) : '—'}</td>
                          <td className="num">{m?.roi_ci ? `${signed(m.roi_ci[0])} to ${signed(m.roi_ci[1])}` : '—'}</td>
                          <td className="num">{m?.bets ? n2(m.max_drawdown, 1) : '—'}</td>
                          <td className="num">{m?.clv_n ? `${pct(m.clv_positive_share)} (avg ${signed(m.clv_mean)})` : '—'}</td>
                          <td><span className={`tag ${VERDICT_TAG[v.kind][1]}`} title={v.text}>{VERDICT_TAG[v.kind][0]}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <p className="note">
            The bookmaker-market row can only bet where a price beats the average market&apos;s margin-free price, so it tests price
            shopping rather than prediction; at average prices it never bets. &ldquo;Beat closing price&rdquo; is the share of bets whose price was better than the
            margin-free closing price (closing-line value); consistently beating the close is the usual sign of a real edge.
          </p>

          <h2>Calibration by probability range</h2>
          <p className="small muted">Each dot: selections the source gave a similar probability. On the diagonal means those things happened as often as predicted.</p>
          <div className="grid three">
            {roles.map(role => {
              const q = view.find(r => r.role === role)?.quality
              return q?.calibration?.length ? <Reliability key={role} bins={q.calibration} title={ROLE_LABEL[role]} /> : null
            })}
          </div>
        </>
      )}

      <h2>Odds coverage</h2>
      <p className="small muted">
        Completed matches with a complete, plausible set of prices, per bookmaker. Matches without prices for a source are left
        out of that source&apos;s results (shown above as fewer matches), never filled in.
      </p>
      <CoverageTable rows={coverage.filter(c => c.market === market)} />

      <h2>What the terms mean</h2>
      <ul className="small">
        <li><strong>Implied probability</strong> = 1 ÷ decimal odds. It includes the bookmaker&apos;s margin, so a market&apos;s implied probabilities add up to more than 100%.</li>
        <li><strong>Margin-adjusted (fair) probability</strong>: each implied probability divided by their total, so they add up to 100%.</li>
        <li><strong>Break-even probability</strong> = 1 ÷ the odds taken: how often a bet must win to break even.</li>
        <li><strong>Expected value (EV)</strong> = model probability × odds − 1: the model&apos;s own estimate of return per unit. For example, 47% at odds of 2.40 gives 0.47 × 2.40 − 1 = +12.8%. It is only as good as the probability behind it, so it is an estimate, not a guaranteed return.</li>
        <li><strong>Edge</strong> = model probability − fair market probability, in percentage points: how much the model disagrees with the market. It is not a return.</li>
      </ul>

      <h2>Limitations</h2>
      <ul className="small muted">
        <li>Odds come from football-data.co.uk: one pre-closing snapshot (Friday afternoon for weekend games, Tuesday afternoon for midweek) and the closing odds. There are no per-quote timestamps, and predictions made earlier in the week may have faced different prices.</li>
        <li>&ldquo;Best price&rdquo; is the best across many bookmakers at that moment. Getting it every time needs accounts everywhere, and bookmakers limit winning customers, so it flatters every strategy.</li>
        <li>Only the match result and over/under 2.5 goals have historical odds. Both teams to score, corners and cards are not evaluated: no free archive of their odds exists.</li>
        <li>Bets are settled on the stored final score; void or postponed matches are not in the data.</li>
        <li>Fixed 1-unit stakes; staking plans such as Kelly would change the swings, not whether a strategy has an edge.</li>
      </ul>
      <p className="note">{anyRow?.methodology}</p>
    </>
  )
}

function CoverageTable({ rows }: { rows: Coverage[] }) {
  const seasons = [...new Set(rows.map(r => r.season))].sort()
  const cols = (['pre_closing', 'closing'] as const).flatMap(stage => ['average', 'best', 'bet365', 'pinnacle'].map(b => [stage, b] as const))
  if (!seasons.length) return <p className="muted small">Coverage appears after the first pipeline run that stores odds.</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th rowSpan={2}>Season</th><th rowSpan={2} className="num">Matches</th><th colSpan={4}>Before closing (used for bets)</th><th colSpan={4}>Closing (used for closing-line value)</th></tr>
          <tr>{cols.map(([s, b]) => <th key={s + b} className="num">{b === 'bet365' ? 'Bet365' : b[0].toUpperCase() + b.slice(1)}</th>)}</tr>
        </thead>
        <tbody>
          {seasons.map(season => {
            const total = rows.find(r => r.season === season)?.completed_matches ?? 0
            return (
              <tr key={season}>
                <td>{season}</td><td className="num">{total}</td>
                {cols.map(([s, b]) => {
                  const n = rows.find(r => r.season === season && r.stage === s && r.bookmaker === b)?.with_odds ?? 0
                  return <td key={s + b} className={`num ${n < total ? 'warn-text' : ''}`}>{n === total ? 'all' : n}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BestWarning({ rows }: { rows: { season: string; matches: number; below_100pct: number }[] }) {
  const bad = rows.filter(r => r.below_100pct > 0).sort((a, b) => a.season.localeCompare(b.season))
  if (!bad.length) return null
  return (
    <div className="callout">
      <strong>Best prices flatter these results.</strong> In some matches the best prices across bookmakers add up to less than
      100%, which would guarantee a profit by backing every outcome, so some quotes cannot have been real or obtainable:{' '}
      {bad.map((r, i) => <span key={r.season}>{i ? ', ' : ''}{r.season}: {r.below_100pct} of {r.matches} matches</span>)}.
      Average prices are the realistic comparison.
    </div>
  )
}
