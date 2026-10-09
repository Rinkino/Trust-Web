import Link from 'next/link'
import { LEAGUES, LEAGUE_CODES, type League } from '@/lib/leagues'

/** Premier League | Championship switch for a page, keeping its path. */
export default function LeagueTabs({ path, current }: { path: string; current: League }) {
  return (
    <div className="tabs league-tabs" role="tablist" aria-label="League">
      {LEAGUE_CODES.map(c => (
        <Link key={c} role="tab" aria-selected={c === current} className={`tab${c === current ? ' on' : ''}`}
          href={c === 'EPL' ? path : `${path}?league=${c}`}>{LEAGUES[c]}</Link>
      ))}
    </div>
  )
}
