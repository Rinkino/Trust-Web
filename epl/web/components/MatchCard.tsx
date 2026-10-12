import Link from 'next/link'
import LocalTime from '@/components/LocalTime'
import { ProbBar } from '@/components/viz'
import type { FixtureRow } from '@/lib/live'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** One upcoming fixture on the home page: kickoff, H/D/A, most likely score. */
export default function MatchCard({ p }: { p: FixtureRow }) {
  const outcome = p.values.outcome as number[] | undefined
  // Same model as the result chances, so the score agrees with them.
  const tops = ((p.resultModel?.values ?? p.values).top_scorelines as number[][] | undefined)?.slice(0, 3) ?? []
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
          {tops.length ? <>Likeliest scores{' '}
            {tops.map((t, i) => <span key={i} className="score-opt"><strong className="mono">{t[0]}–{t[1]}</strong> <span className="muted">{pct(t[2])}</span></span>)}
          </> : null}
        </span>
        <Link className="btn" href={`/match/${p.match_id}`}>View prediction</Link>
      </div>
    </article>
  )
}
