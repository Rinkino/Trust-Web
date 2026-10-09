import Link from 'next/link'
import { notFound } from 'next/navigation'
import LocalTime from '@/components/LocalTime'
import MatchView, { type MatchData } from '@/components/MatchView'
import PickWidget from '@/components/PickWidget'
import { latestSelection, select, type PredictionRow, type Values } from '@/lib/db'
import { drivers, effect, factValue, type Explanation } from '@/lib/explain'
import { withResultModel } from '@/lib/live'
import { LEAGUES, leagueOf } from '@/lib/leagues'
import { STATS, type Sides, type Stat } from '@/lib/props'

export const dynamic = 'force-dynamic'

const MATCH = /^[0-9]{4}-[0-9]{2}_[a-z0-9-]+_[a-z0-9-]+$/

type Match = {
  match_id: string; season: string; competition: string; home_team: string; away_team: string; kickoff_utc: string | null; match_date: string
  status: string; fthg: number | null; ftag: number | null; hc: number | null; ac: number | null; hy: number | null; ay: number | null
  hs: number | null; as: number | null; hst: number | null; ast: number | null
}

/** Each team's distribution for a statistic. Goals come from the model behind the result
 * chances (so they agree with the win/draw/loss figures); the others from the model chosen
 * for that statistic's match total. */
function sidesFor(v: Values, rv: Values): Partial<Record<Stat, Sides>> {
  const out: Partial<Record<Stat, Sides>> = {}
  for (const s of STATS) {
    if (s === 'goals' && Array.isArray(rv.goals_home_pmf) && Array.isArray(rv.goals_away_pmf)) {
      out.goals = { home: rv.goals_home_pmf as number[], away: rv.goals_away_pmf as number[] }
      continue
    }
    const x = v[`${s}_sides`] as unknown as { home?: number[]; away?: number[] } | undefined
    if (x?.home && x?.away) out[s] = { home: x.home, away: x.away }
  }
  return out
}

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  if (!MATCH.test(matchId)) notFound()
  const [m] = await select<Match>('epl_matches', {
    select: 'match_id,season,competition,home_team,away_team,kickoff_utc,match_date,status,fthg,ftag,hc,ac,hy,ay,hs,as,hst,ast',
    match_id: `eq.${matchId}`, limit: 1,
  })
  if (!m) notFound()
  const preds = await select<PredictionRow>('epl_predictions', {
    select: 'prediction_id,match_id,created_at,data_cutoff,values,target_models,pipeline_run,model_version,generated_before_kickoff',
    mode: 'eq.live', model_name: 'eq.selected', match_id: `eq.${matchId}`, order: 'created_at.desc', limit: 20,
  })
  // The prediction shown is the latest one published before kickoff.
  const shown = preds.find(r => r.generated_before_kickoff !== false)
  const p = shown ? (await withResultModel([shown]))[0] : undefined
  const [expl, selection] = await Promise.all([
    p ? select<{ explanation: Explanation }>('epl_prediction_explanations', {
      select: 'explanation', pipeline_run: `eq.${p.pipeline_run}`, match_id: `eq.${matchId}`, limit: 1,
    }) : Promise.resolve([]),
    latestSelection(m.competition),
  ])
  const started = !!m.kickoff_utc && new Date(m.kickoff_utc).getTime() <= Date.now()
  const open = m.status === 'scheduled' && !started
  const done = m.status === 'completed' && m.fthg != null && m.ftag != null
  const H = m.home_team, A = m.away_team

  const v = p?.values
  const rv = p?.resultModel?.values ?? v
  const outcome = (v?.outcome as number[] | undefined) ?? null
  const top = ((rv?.top_scorelines as number[][] | undefined) ?? [])[0]
  const e = expl[0]?.explanation
  const tm = (p?.target_models ?? {}) as Record<string, string>
  const explains = !!(e && outcome && e.model_name === tm.outcome && e.outcome &&
    e.outcome.every((x, i) => Math.abs(x - outcome[i]) < 0.002))

  const data: MatchData | null = v && rv ? {
    matchId, home: H, away: A, open,
    outcome,
    btts: typeof rv.btts === 'number' ? rv.btts : null,
    topScore: top ? [top[0], top[1], top[2]] : null,
    sides: sidesFor(v, rv),
    reliableTargets: selection.filter(s => s.reliable).map(s => s.target),
    actual: done ? { fthg: m.fthg, ftag: m.ftag, hc: m.hc, ac: m.ac, hy: m.hy, ay: m.ay, hs: m.hs, as: m.as, hst: m.hst, ast: m.ast } : null,
  } : null

  return (
    <>
      <p className="small"><Link href={m.competition === 'EPL' ? '/' : `/?league=${m.competition}`}>← All {LEAGUES[leagueOf(m.competition)]} matches</Link></p>
      <header className="match-head">
        <h1 className="match-h1">{H} <span className="muted">vs</span> {A}</h1>
        <p className="muted small">
          {m.kickoff_utc ? <LocalTime iso={m.kickoff_utc} /> : m.match_date}
          {done ? <> · <strong className="final">Final {m.fthg}–{m.ftag}</strong></> : started ? ' · kicked off' : ''}
        </p>
      </header>

      {!data ? (
        <section className="block">
          <p className="muted">No prediction yet. Predictions are published for matches in the next three weeks, after each daily update.</p>
        </section>
      ) : (
        <>
          <MatchView d={data} />
          {Object.keys(data.sides).length < STATS.length && (
            <p className="hint">Some statistics appear after the next daily update.</p>
          )}
        </>
      )}

      <section className="block">
        <PickWidget matchId={m.match_id} home={H} away={A} open={open} />
      </section>

      {p && (
        <details className="more">
          <summary>How this was worked out</summary>
          <div className="more-body">
            <p className="small">
              Published <LocalTime iso={p.created_at} />, using results up to {p.data_cutoff.slice(0, 10)}. Predictions are never
              edited after publishing. The model only knows past results and statistics: not injuries, line-ups or transfers.
            </p>
            {explains && e && (
              <>
                <h3 style={{ marginTop: 14 }}>What moved the expected goals</h3>
                <div className="grid two">
                  {(['home', 'away'] as const).map(side => (
                    <div key={side}>
                      <p className="small"><strong>{side === 'home' ? H : A}</strong>: {e.sides[side].expected.toFixed(2)} expected goals</p>
                      <ul className="drivers small">
                        {drivers(e, side, H, A).big.map(x => (
                          <li key={x.key}><span className={x.pct > 0 ? 'pos' : 'neg'}>{x.pct > 0 ? '▲' : '▼'}</span> {x.text} <span className="muted">{effect(x.pct)}</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table>
                    <thead><tr><th>Input</th><th className="num">{H}</th><th className="num">{A}</th></tr></thead>
                    <tbody>
                      {Object.entries(e.fact_labels).map(([k, label]) => (
                        <tr key={k}><td>{label}</td><td className="num">{factValue(k, e.facts.home[k])}</td><td className="num">{factValue(k, e.facts.away[k])}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="small" style={{ marginTop: 10 }}>
              <Link href="/evaluation">How accurate the model has been</Link> · <Link href="/betting">Compared with bookmakers</Link>
            </p>
          </div>
        </details>
      )}
    </>
  )
}
