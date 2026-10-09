// Plain-English rendering of a stored model explanation (epl_prediction_explanations).
// Every number shown comes from the explanation row; this file only words it. Kept free
// of framework imports so it can be unit-tested with node --test.

export type SideExplanation = { expected: number; factors: Record<string, number> }
export type Explanation = {
  method: string
  stat: string
  model_name: string
  baseline_expected: number
  groups: { key: string; label: string }[]
  sides: { home: SideExplanation; away: SideExplanation }
  facts: { home: Record<string, number | null>; away: Record<string, number | null> }
  fact_labels: Record<string, string>
  league: Record<string, number | null>
  outcome?: number[] | null
}

export type Driver = { key: string; text: string; pct: number }

/** Effects smaller than this (as a fraction of expected goals) are grouped as "small". */
export const SMALL = 0.03

function describe(key: string, team: string, opponent: string, side: 'home' | 'away'): string {
  switch (key) {
    case 'attack': return `${team}'s recent attacking numbers (goals, shots, shots on target)`
    case 'opp_defence': return `${opponent}'s recent defending (goals and shots conceded)`
    case 'quality': return `${team}'s results and rating (Elo, points per game, league position)`
    case 'opp_quality': return `${opponent}'s results and rating`
    case 'venue': return side === 'home' ? `Playing at home` : `Playing away from home`
    case 'schedule': return `Rest days and fixture congestion`
    case 'promoted': return `Promotion or relegation`
    case 'tempo': return `How open both teams' recent games have been`
    case 'league': return `League-wide scoring level and stage of the season`
    default: return key
  }
}

/** Groups that moved one side's expected goals by at least SMALL, largest first. */
export function drivers(e: Explanation, side: 'home' | 'away', home: string, away: string): { big: Driver[]; small: number } {
  const [team, opp] = side === 'home' ? [home, away] : [away, home]
  const all = Object.entries(e.sides[side].factors).map(([key, f]) => ({ key, text: describe(key, team, opp, side), pct: f - 1 }))
  const big = all.filter(d => Math.abs(d.pct) >= SMALL).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
  return { big, small: all.length - big.length }
}

export const effect = (pct: number) =>
  `${pct > 0 ? 'raises' : 'lowers'} expected goals by ${Math.round(Math.abs(pct) * 100)}%`

/** Headline: which side the model favours and by how much, from its own probabilities. */
export function headline(outcome: number[], home: string, away: string): string {
  const [h, d, a] = outcome
  const p = (x: number) => `${Math.round(x * 100)}%`
  const top = Math.max(h, d, a)
  const gap = top - [h, d, a].filter(x => x !== top).reduce((m, x) => Math.max(m, x), 0)
  if (top === d) return `The model leans towards a draw (${p(d)}), but no result is clearly favoured.`
  const fav = top === h ? home : away
  if (gap < 0.08) return `A close call: ${fav} are marginally more likely to win (${p(top)}), with no clear favourite.`
  if (top >= 0.6) return `${fav} are clear favourites, with a ${p(top)} chance of winning.`
  return `${fav} are favourites, with a ${p(top)} chance of winning.`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Display a raw team fact. */
export function factValue(key: string, v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  switch (key) {
    case 'elo': return String(Math.round(v))
    case 'position': return ordinal(Math.round(v))
    case 'rest_days': return `${Math.round(v)}`
    case 'promoted': return v > 0.5 ? 'Yes' : 'No'
    default: return v.toFixed(2)
  }
}
