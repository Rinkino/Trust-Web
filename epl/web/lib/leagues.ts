// The competitions on the site. Codes match the `competition` column in every table.
export const LEAGUES = { EPL: 'Premier League', ELC: 'Championship' } as const
export type League = keyof typeof LEAGUES
export const LEAGUE_CODES = Object.keys(LEAGUES) as League[]

/** A `?league=` value, defaulting to the Premier League for anything else. */
export function leagueOf(x: string | null | undefined): League {
  return x && (LEAGUE_CODES as string[]).includes(x) ? (x as League) : 'EPL'
}
