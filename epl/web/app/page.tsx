import Link from 'next/link'
import MatchCard from '@/components/MatchCard'
import { LEAGUES, LEAGUE_CODES, type League } from '@/lib/leagues'
import { heldOutResultAccuracy, ukDay, ukDayKey, upcomingPredictions, type FixtureRow } from '@/lib/live'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

type Filter = League | 'ALL'

/** Home: one match day at a time, for one league or all of them. */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const league: Filter = sp.league && (LEAGUE_CODES as string[]).includes(sp.league) ? (sp.league as League) : 'ALL'
  const now = new Date()
  const preds = await upcomingPredictions(now.toISOString(), league === 'ALL' ? LEAGUE_CODES : league)
  const acc = league === 'ALL' ? null : await heldOutResultAccuracy(league)

  // Match days with at least one prediction, in order.
  const byDay = new Map<string, FixtureRow[]>()
  for (const p of preds) {
    const k = p.kickoff_utc ? ukDayKey(p.kickoff_utc) : p.match_date
    byDay.set(k, [...(byDay.get(k) ?? []), p])
  }
  const days = [...byDay.keys()]
  const day = sp.day && byDay.has(sp.day) ? sp.day : days[0]
  const list = day ? byDay.get(day)! : []

  // Matches of the chosen day, grouped by league when showing all of them.
  const groups = new Map<string, FixtureRow[]>()
  for (const p of list) {
    const c = p.competition ?? 'EPL'
    groups.set(c, [...(groups.get(c) ?? []), p])
  }
  const leagueOrder = (c: string) => (LEAGUE_CODES as string[]).indexOf(c)
  const ordered = [...groups.entries()].sort((a, b) => leagueOrder(a[0]) - leagueOrder(b[0]))

  const href = (l: Filter, d?: string) => {
    const q = new URLSearchParams()
    if (l !== 'ALL') q.set('league', l)
    if (d) q.set('day', d)
    const s = q.toString()
    return s ? `/?${s}` : '/'
  }
  const todayKey = ukDayKey(now.toISOString())
  const tomorrowKey = ukDayKey(new Date(now.getTime() + 86400000).toISOString())
  const dayLabel = (k: string) => k === todayKey ? 'Today' : k === tomorrowKey ? 'Tomorrow'
    : new Date(`${k}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

  return (
    <>
      <h1>Upcoming matches</h1>

      <nav className="filters" aria-label="Filter matches">
        <div className="filter-row" role="group" aria-label="Competition">
          {(['ALL', ...LEAGUE_CODES] as Filter[]).map(l => (
            <Link key={l} href={href(l)} className={`fchip${l === league ? ' on' : ''}`} aria-current={l === league ? 'true' : undefined}>
              {l === 'ALL' ? 'All leagues' : LEAGUES[l]}
            </Link>
          ))}
        </div>
        {days.length > 0 && (
          <div className="filter-row days" role="group" aria-label="Day">
            {days.map(k => (
              <Link key={k} href={href(league, k)} className={`fchip day${k === day ? ' on' : ''}`} aria-current={k === day ? 'true' : undefined}>
                <span>{dayLabel(k)}</span>
                <span className="fchip-n">{byDay.get(k)!.length}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {!day ? (
        <p className="muted" style={{ marginTop: 20 }}>
          No predictions are published right now. They appear for matches in the next three weeks after each daily update.
        </p>
      ) : (
        <>
          <h2 className="day-h">{ukDay(`${day}T12:00:00Z`)}</h2>
          {ordered.map(([c, ms]) => (
            <section key={c}>
              {league === 'ALL' && <h3 className="league-h">{LEAGUES[c as League] ?? c}</h3>}
              <div className="grid matches">
                {ms.map(p => <MatchCard key={p.match_id} p={p} />)}
              </div>
            </section>
          ))}
        </>
      )}

      <p className="hint" style={{ marginTop: 20 }}>
        Percentages are chances, not certainties: 60% means about 6 times in 10.
        {acc ? <> On 2025/26, a season the model never saw while it was built, its most likely {LEAGUES[league as League]} result was
          right in <strong>{Math.round(acc.accuracy * 100)}%</strong> of {acc.n} matches.</> : null}{' '}
        <Link href={league === 'ALL' || league === 'EPL' ? '/evaluation' : `/evaluation?league=${league}`}>How it was tested</Link>.
      </p>
    </>
  )
}
