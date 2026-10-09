import Link from 'next/link'
import LocalTime from '@/components/LocalTime'
import { ProbBar } from '@/components/viz'
import type { PredictionRow } from '@/lib/db'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** One upcoming fixture on the home page: kickoff, H/D/A, most likely score. */
export default function MatchCard({ p }: { p: PredictionRow }) {
  const outcome = p.values.outcome as number[] | undefined
  const top = (p.values.top_scorelines as number[][] | undefined)?.[0]
  return (
    <article className="card match">
      <div className="match-time small muted">{p.kickoff_utc ? <LocalTime iso={p.kickoff_utc} withDate={false} /> : p.match_date}</div>
      <div className="match-teams">
        <span>{p.home_team}</span>
        <span className="muted small">vs</span>
        <span>{p.away_team}</span>
      </div>
      {outcome ? (
        <>
          <div className="hda">
            <div><span className="hda-n">{pct(outcome[0])}</span><span className="hda-l">{p.home_team} win</span></div>
            <div><span className="hda-n">{pct(outcome[1])}</span><span className="hda-l">Draw</span></div>
            <div><span className="hda-n">{pct(outcome[2])}</span><span className="hda-l">{p.away_team} win</span></div>
          </div>
          <ProbBar p={outcome} />
        </>
      ) : <p className="muted small">No result probabilities stored.</p>}
      <div className="match-foot">
        <span className="small">
          {top ? <>Most likely score <strong className="mono">{top[0]}–{top[1]}</strong> <span className="muted">({pct(top[2])})</span></> : null}
        </span>
        <Link className="btn" href={`/match/${p.match_id}`}>View prediction</Link>
      </div>
    </article>
  )
}
