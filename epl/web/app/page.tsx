import Link from 'next/link'
import LocalTime from '@/components/LocalTime'
import LeagueTabs from '@/components/LeagueTabs'
import MatchCard from '@/components/MatchCard'
import { LEAGUES, leagueOf } from '@/lib/leagues'
import { heldOutResultAccuracy, laterFixtures, ukDay, upcomingPredictions, type FixtureRow } from '@/lib/live'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const league = leagueOf((await searchParams).league)
  const now = new Date().toISOString()
  const [preds, acc] = await Promise.all([upcomingPredictions(now, league), heldOutResultAccuracy(league)])
  const later = await laterFixtures(now, new Set(preds.map(p => p.match_id)), 10, league)
  const days = new Map<string, FixtureRow[]>()
  for (const p of preds) {
    const d = p.kickoff_utc ? ukDay(p.kickoff_utc) : p.match_date
    days.set(d, [...(days.get(d) ?? []), p])
  }

  return (
    <>
      <LeagueTabs path="/" current={league} />
      <h1 style={{ marginTop: 14 }}>Upcoming {LEAGUES[league]} matches</h1>
      <p className="lede">
        For each match the model gives the chance of a home win, a draw and an away win, and its most likely score. Open a
        match to see why, then make your own pick.
      </p>

      <div className="callout info">
        <strong>How to read the percentages.</strong> They are chances, not certainties: a team given 60% is expected to win
        about 6 times in 10 such games and not win the other 4.
        {acc ? <> On the 2025/26 season, which the model never saw during development, its most likely result was right in{' '}
          <strong>{Math.round(acc.accuracy * 100)}%</strong> of {acc.n} matches.</> : null}{' '}
        <Link href={league === 'EPL' ? '/evaluation' : `/evaluation?league=${league}`}>How it was tested</Link>.
      </div>

      {preds.length === 0 ? (
        <p className="muted" style={{ marginTop: 20 }}>
          No predictions are published right now. Predictions appear for fixtures in the next three weeks after each daily update.
        </p>
      ) : [...days.entries()].map(([day, list]) => (
        <section key={day}>
          <h2>{day}</h2>
          <div className="grid matches">
            {list.map(p => <MatchCard key={p.match_id} p={p} />)}
          </div>
        </section>
      ))}

      {later.length > 0 && (
        <section>
          <h2>Later fixtures</h2>
          <p className="small muted" style={{ marginBottom: 8 }}>
            Predictions for these are published once they are within three weeks, so they use the latest results.
          </p>
          <ul className="later">
            {later.map(f => (
              <li key={f.match_id}>
                <span className="small muted"><LocalTime iso={f.kickoff_utc} /></span>
                <span>{f.home_team} v {f.away_team}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
