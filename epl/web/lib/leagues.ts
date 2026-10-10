// The competitions on the site. Codes match the `competition` column in every table.
export const LEAGUES = {
  EPL: 'Premier League', ELC: 'Championship', LALIGA: 'La Liga', SERIEA: 'Serie A', BUNDESLIGA: 'Bundesliga', LIGUE1: 'Ligue 1',
} as const
export type League = keyof typeof LEAGUES

// Leagues shown on the site: a league is added once its first pipeline run has succeeded.
export const LEAGUE_CODES: League[] = ['EPL', 'ELC']

/** A `?league=` value, defaulting to the Premier League for anything else. */
export function leagueOf(x: string | null | undefined): League {
  return x && (LEAGUE_CODES as string[]).includes(x) ? (x as League) : 'EPL'
}
