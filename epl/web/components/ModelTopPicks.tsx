import type { Selection, Values } from '@/lib/db'
import { resultPicks, scorePicks, totalPicks, type Pick } from '@/lib/outcomes'

type Market = { title: string; picks: Pick[] | null; weak?: boolean; note?: string }

/** The model's three most likely outcomes for each market, shown next to the visitor's pick.
 * Everything comes from the stored prediction; markets without a stored distribution say so. */
export default function ModelTopPicks({ values, resultValues, home, away, selection }: {
  values: Values                // per-target selected models
  resultValues: Values          // the model behind the result chances (goals, scores)
  home: string; away: string
  selection: Record<string, Selection>
}) {
  const pmf = (v: Values, k: string) => v[`${k}_total_pmf`] as number[] | undefined
  const weak = (t: string) => selection[t]?.reliable === false
  const markets: Market[] = [
    { title: 'Match result', picks: resultPicks(values.outcome as number[] | undefined, home, away), weak: weak('outcome') },
    { title: 'Exact score', picks: scorePicks(resultValues.top_scorelines as number[][] | undefined, home, away) },
    { title: 'Total goals', picks: totalPicks('goals', pmf(resultValues, 'goals')), weak: weak('goals_total') },
    { title: 'Total corners', picks: totalPicks('corners', pmf(values, 'corners')), weak: weak('corners_total') },
    { title: 'Yellow cards (bookings)', picks: totalPicks('yellows', pmf(values, 'yellows')), weak: weak('yellows_total'),
      note: red(values.red_home as number | undefined, values.red_away as number | undefined, home, away) },
    { title: 'Total shots', picks: totalPicks('shots', pmf(values, 'shots')), weak: weak('shots_total') },
    { title: 'Shots on target', picks: totalPicks('sot', pmf(values, 'sot')), weak: weak('sot_total') },
  ]
  return (
    <section className="card top-picks">
      <h2 className="box-title">The model&apos;s top 3 for each market</h2>
      <p className="small muted">
        Its three most likely outcomes, with the chance it gives each. Even the top outcome often has well under a 50%
        chance: these are the likeliest answers, not safe ones.
      </p>
      <div className="grid markets">
        {markets.map(m => (
          <div key={m.title} className="market">
            <h3>{m.title} {m.weak ? <span className="tag warn">not clearly better than average in testing</span> : null}</h3>
            {m.picks ? (
              <ol className="market-picks">
                {m.picks.map((p, i) => (
                  <li key={p.label}>
                    <span className="mp-rank">{i + 1}</span>
                    <span className="mp-label">{p.label}</span>
                    <span className="mp-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, p.p * 100)}%` }} /></span>
                    <span className="mp-p mono">{Math.round(p.p * 100)}%</span>
                  </li>
                ))}
              </ol>
            ) : <p className="small muted">Not stored for this prediction yet; it appears with the next daily update.</p>}
            {m.note ? <p className="note" style={{ marginTop: 6 }}>{m.note}</p> : null}
          </div>
        ))}
      </div>
      <p className="note">
        Goalkeeper saves are not predicted: the free match data this site uses does not record them, so there is nothing
        to train or test a saves model on. Shots on target is the closest statistic available.
      </p>
    </section>
  )
}

function red(h: number | undefined, a: number | undefined, home: string, away: string): string | undefined {
  if (h == null || a == null) return undefined
  return `Red card chance: ${home} ${Math.round(h * 100)}%, ${away} ${Math.round(a * 100)}%.`
}
