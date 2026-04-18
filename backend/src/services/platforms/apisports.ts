/**
 * Multi-sport fixture resolution
 *
 * Football  → football-data.org  (FOOTBALL_DATA_KEY)
 *             Full historical data, major leagues, 10 req/min free
 *
 * All other → api-sports.io      (API_SPORTS_KEY)
 *             Basketball, tennis, hockey, baseball, rugby — 100 req/day free
 *             Each sport lives on its own subdomain.
 *
 * Search flow per leg:
 *   football  → football-data.org /matches (date window, fuzzy name match)
 *   other     → api-sports /teams?search + /games?team&date (fuzzy away match)
 *
 * Resolver calls getFixtureResult(id, sport) so it always hits the right API.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FD_BASE = 'https://api.football-data.org/v4'

const AS_BASES: Record<string, string> = {
  football:   'https://v3.football.api-sports.io',   // fallback for leagues not on football-data.org free tier
  basketball: 'https://v1.basketball.api-sports.io',
  tennis:     'https://v1.tennis.api-sports.io',
  hockey:     'https://v1.hockey.api-sports.io',
  baseball:   'https://v1.baseball.api-sports.io',
  rugby:      'https://v1.rugby.api-sports.io',
  volleyball: 'https://v1.volleyball.api-sports.io',
  handball:   'https://v1.handball.api-sports.io',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FixtureResult = {
  fixtureId:  number
  homeTeam:   string
  awayTeam:   string
  homeScore:  number
  awayScore:  number
  finished:   boolean
}

export type PredictionLeg = {
  fixture_id:     number | null
  fixture_source: 'fd' | 'as' | null   // 'fd' = football-data.org, 'as' = api-sports.io
  sport:          string
  home_team:      string
  away_team:      string
  kickoff_at:     string | null
  market_type:    string | null   // '1x2' | 'btts' | 'over_under'
  market_value:   string | null   // 'home'|'draw'|'away'|'yes'|'no'|'over_2.5' etc
  tournament:     string
  odds:           number
}

// ---------------------------------------------------------------------------
// Caches (process-lifetime)
// ---------------------------------------------------------------------------

const fixtureCache   = new Map<string, FixtureResult>()                          // "sport:id" → result (finished only)
const dateCache      = new Map<string, any[]>()                                   // "YYYY-MM-DD" → fd football matches[]
const asDateCache    = new Map<string, any[]>()                                   // "YYYY-MM-DD" → as football fixtures[]
const searchCache    = new Map<string, { id: number; source: 'fd' | 'as' } | null>() // "sport:home|away|date" → {id, source}
const asTeamCache    = new Map<string, number | null>()                           // "sport:name" → team ID

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fdFetch(path: string): Promise<any> {
  const key = process.env.FOOTBALL_DATA_KEY
  if (!key) throw new Error('FOOTBALL_DATA_KEY not set')
  const res = await fetch(`${FD_BASE}${path}`, {
    headers: { 'X-Auth-Token': key, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`football-data.org ${path} → ${res.status}`)
  return res.json()
}

async function asFetch(sport: string, path: string): Promise<any> {
  const key  = process.env.API_SPORTS_KEY
  const base = AS_BASES[sport]
  if (!key)  throw new Error('API_SPORTS_KEY not set')
  if (!base) throw new Error(`No API-Sports base for sport: ${sport}`)
  const res = await fetch(`${base}${path}`, {
    headers: { 'x-apisports-key': key, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`api-sports ${sport}${path} → ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

// Common abbreviations / short names → canonical fragments that appear in API names
const TEAM_ALIASES: Record<string, string> = {
  'psg':             'paris',
  'man utd':         'manchester united',
  'man united':      'manchester united',
  'man city':        'manchester city',
  'atletico madrid': 'atletico',
  'atletico':        'atletico',
  'inter milan':     'internazionale',
  'inter':           'internazionale',
  'ac milan':        'milan',
  'istanbul bb':     'basaksehir',
  'istanbul basaksehir': 'basaksehir',
  'dynamo makhachkala':  'makhachkala',
  'genclerbirligi':  'genclerbirligi',
  'real oviedo':     'oviedo',
  'celta':           'celta',
  'alaves':          'alaves',
  'betis':           'betis',
  'rangers':         'rangers',
  'burnley':         'burnley',
  'southampton':     'southampton',
  'pec zwolle':      'zwolle',
  'psv eindhoven':   'psv',
  'psv':             'psv',
  'fc botosani':     'botosani',
  'botosani':        'botosani',
  'metaloglobus':    'metaloglobus',
  'trabzonspor':     'trabzonspor',
  'galatasaray':     'galatasaray',
  'motherwell':      'motherwell',
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fuzzyMatch(apiName: string, searchName: string): boolean {
  const a = norm(apiName)
  const bRaw = searchName.toLowerCase().trim()
  const b = norm(bRaw)

  // Direct inclusion
  if (a.includes(b) || b.includes(a)) return true

  // Alias expansion — map short/bookie name to a canonical fragment
  const aliased = TEAM_ALIASES[bRaw] ?? TEAM_ALIASES[b]
  if (aliased && a.includes(norm(aliased))) return true

  // Acronym check — "PSG" matches "Paris Saint-Germain" (first letters of each word)
  const apiWords = apiName.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 0)
  const acronym  = norm(apiWords.map(w => w[0]).join(''))
  if (b === acronym && b.length >= 2) return true

  // Word-overlap — ≥60% of significant words in searchName appear somewhere in apiName
  const searchWords = bRaw.split(/[\s\-_]+/).map(norm).filter(w => w.length >= 3)
  if (searchWords.length > 0) {
    const matched = searchWords.filter(sw => a.includes(sw))
    if (matched.length >= Math.ceil(searchWords.length * 0.6)) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Football-data.org — football only
// ---------------------------------------------------------------------------

async function getFootballMatchesInWindow(date: string): Promise<any[]> {
  if (dateCache.has(date)) return dateCache.get(date)!
  try {
    const d    = new Date(date)
    const from = new Date(d.getTime() - 2 * 86400000).toISOString().split('T')[0]
    const to   = new Date(d.getTime() + 2 * 86400000).toISOString().split('T')[0]
    const data = await fdFetch(`/matches?dateFrom=${from}&dateTo=${to}`)
    const matches = (data.matches || []) as any[]
    dateCache.set(date, matches)
    return matches
  } catch (err) {
    console.warn('[football-data] date window fetch error:', err)
    return []
  }
}

async function getAsFootballMatchesInWindow(date: string): Promise<any[]> {
  if (asDateCache.has(date)) return asDateCache.get(date)!
  if (!process.env.API_SPORTS_KEY) return []
  try {
    const d    = new Date(date)
    const from = new Date(d.getTime() - 2 * 86400000).toISOString().split('T')[0]
    const to   = new Date(d.getTime() + 2 * 86400000).toISOString().split('T')[0]
    const data = await asFetch('football', `/fixtures?from=${from}&to=${to}`)
    const fixtures = (data.response || []) as any[]
    asDateCache.set(date, fixtures)
    return fixtures
  } catch (err) {
    console.warn('[api-sports football] date window fetch error:', err)
    return []
  }
}

async function searchFootballFixture(
  homeTeam: string,
  awayTeam: string,
  date: string,
): Promise<{ fixtureId: number; homeTeam: string; awayTeam: string } | null> {
  // --- Try football-data.org first (bulk date window, no extra quota) ---
  if (process.env.FOOTBALL_DATA_KEY) {
    const matches = await getFootballMatchesInWindow(date)
    const match   = matches.find(m =>
      fuzzyMatch(m.homeTeam.name, homeTeam) &&
      fuzzyMatch(m.awayTeam.name, awayTeam),
    )
    if (match) return { fixtureId: match.id, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name }
  }

  // --- Fallback: api-sports.io football (covers Europa/Conference/CONMEBOL/etc.) ---
  const fixtures = await getAsFootballMatchesInWindow(date)
  const match = fixtures.find((f: any) =>
    fuzzyMatch(f.teams?.home?.name ?? '', homeTeam) &&
    fuzzyMatch(f.teams?.away?.name ?? '', awayTeam),
  )
  if (!match) return null
  return {
    fixtureId: match.fixture.id as number,
    homeTeam:  match.teams.home.name as string,
    awayTeam:  match.teams.away.name as string,
  }
}

async function getFootballResult(fixtureId: number, source: 'fd' | 'as' = 'fd'): Promise<FixtureResult | null> {
  // api-sports football fixture IDs are flagged with source='as'
  if (source === 'as') {
    if (!process.env.API_SPORTS_KEY) return null
    try {
      const data    = await asFetch('football', `/fixtures?id=${fixtureId}`)
      const fixture = data.response?.[0]
      if (!fixture) return null
      const finished = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(fixture.fixture?.status?.short ?? '')
      return {
        fixtureId,
        homeTeam:  fixture.teams?.home?.name ?? '',
        awayTeam:  fixture.teams?.away?.name ?? '',
        homeScore: fixture.goals?.home ?? 0,
        awayScore: fixture.goals?.away ?? 0,
        finished,
      }
    } catch (err) {
      console.warn('[api-sports football] getResult error:', err)
      return null
    }
  }

  // Check all warmed date windows first — avoids individual API calls entirely
  for (const matches of dateCache.values()) {
    const m = matches.find((m: any) => m.id === fixtureId)
    if (m) {
      const finished = m.status === 'FINISHED'
      return {
        fixtureId,
        homeTeam:  m.homeTeam?.name  ?? '',
        awayTeam:  m.awayTeam?.name  ?? '',
        homeScore: m.score?.fullTime?.home ?? 0,
        awayScore: m.score?.fullTime?.away ?? 0,
        finished,
      }
    }
  }

  // Fall back to individual call (only if date cache wasn't pre-warmed)
  if (!process.env.FOOTBALL_DATA_KEY) return null
  try {
    const data     = await fdFetch(`/matches/${fixtureId}`)
    const finished = data.status === 'FINISHED'
    return {
      fixtureId,
      homeTeam:  data.homeTeam?.name  ?? '',
      awayTeam:  data.awayTeam?.name  ?? '',
      homeScore: data.score?.fullTime?.home ?? 0,
      awayScore: data.score?.fullTime?.away ?? 0,
      finished,
    }
  } catch (err) {
    console.warn('[football-data] getResult error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// API-Sports — non-football sports
// ---------------------------------------------------------------------------

async function getAsTeamId(sport: string, name: string): Promise<number | null> {
  const key = `${sport}:${norm(name)}`
  if (asTeamCache.has(key)) return asTeamCache.get(key)!
  try {
    const data = await asFetch(sport, `/teams?search=${encodeURIComponent(name)}`)
    const id   = (data.response?.[0]?.id as number) ?? null
    asTeamCache.set(key, id)
    return id
  } catch {
    return null
  }
}

async function searchNonFootballFixture(
  sport: string,
  homeTeam: string,
  awayTeam: string,
  date: string,
): Promise<{ fixtureId: number; homeTeam: string; awayTeam: string } | null> {
  if (!process.env.API_SPORTS_KEY || !AS_BASES[sport]) return null

  const homeId = await getAsTeamId(sport, homeTeam)
  if (!homeId) return null

  try {
    const data  = await asFetch(sport, `/games?team=${homeId}&date=${date}`)
    const games = (data.response || []) as any[]

    const match = games.find(g =>
      fuzzyMatch(g.teams?.away?.name ?? '', awayTeam),
    )
    if (!match) return null

    return {
      fixtureId: match.id as number,
      homeTeam:  match.teams.home.name as string,
      awayTeam:  match.teams.away.name as string,
    }
  } catch (err) {
    console.warn(`[api-sports] ${sport} search error:`, err)
    return null
  }
}

function extractNonFootballScores(sport: string, game: any): { homeScore: number; awayScore: number } {
  // Basketball: scores.home.points / scores.away.points
  // Hockey/Baseball: scores.home.total / scores.away.total
  // Rugby/Volleyball/Handball: similar to football goals
  const home = game.scores?.home
  const away = game.scores?.away

  if (sport === 'basketball') {
    return { homeScore: home?.points ?? 0, awayScore: away?.points ?? 0 }
  }
  return {
    homeScore: home?.total ?? home?.goals ?? home?.points ?? 0,
    awayScore: away?.total ?? away?.goals ?? away?.points ?? 0,
  }
}

const AS_FINISHED_STATUSES = new Set(['FT', 'AOT', 'AP', 'AET', 'PEN', 'POST', 'CANC', 'Finished'])

async function getNonFootballResult(sport: string, fixtureId: number): Promise<FixtureResult | null> {
  if (!process.env.API_SPORTS_KEY) return null
  try {
    const data = await asFetch(sport, `/games?id=${fixtureId}`)
    const game = data.response?.[0]
    if (!game) return null

    const finished = AS_FINISHED_STATUSES.has(game.status?.short ?? game.status?.long ?? '')
    const { homeScore, awayScore } = extractNonFootballScores(sport, game)

    return {
      fixtureId,
      homeTeam:  game.teams?.home?.name ?? '',
      awayTeam:  game.teams?.away?.name ?? '',
      homeScore,
      awayScore,
      finished,
    }
  } catch (err) {
    console.warn(`[api-sports] ${sport} getResult error:`, err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-warm the date cache for a set of dates so getFixtureResult can serve
 * football-data.org results from cache without any per-fixture API calls.
 * Call this in the resolver before fetching individual results.
 * Fetches sequentially to respect football-data.org's 10 req/min rate limit.
 */
export async function prefetchMatchResults(dates: string[]): Promise<void> {
  const unique = [...new Set(dates)]
  for (const date of unique) {
    await getFootballMatchesInWindow(date)
  }
}

/**
 * Find a fixture ID for any supported sport.
 * Football → football-data.org first, then api-sports.io fallback.
 * Other sports → api-sports.io directly.
 */
export async function searchFixture(
  homeTeam: string,
  awayTeam: string,
  date: string,
  sport = 'football',
): Promise<{ fixtureId: number; homeTeam: string; awayTeam: string; source: 'fd' | 'as' } | null> {
  const cacheKey = `${sport}:${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}|${date}`
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)
    return cached ? { fixtureId: cached.id, homeTeam, awayTeam, source: cached.source } : null
  }

  let result: { fixtureId: number; homeTeam: string; awayTeam: string } | null = null
  let source: 'fd' | 'as' = sport === 'football' ? 'fd' : 'as'

  if (sport === 'football') {
    result = await searchFootballFixture(homeTeam, awayTeam, date)
    // searchFootballFixture already tries fd then as internally —
    // detect which one succeeded by checking if fd had the match
    if (result) {
      const fdMatches = dateCache.get(date) || []
      const fromFd = fdMatches.some((m: any) => m.id === result!.fixtureId)
      source = fromFd ? 'fd' : 'as'
    }
  } else {
    result = await searchNonFootballFixture(sport, homeTeam, awayTeam, date)
  }

  searchCache.set(cacheKey, result ? { id: result.fixtureId, source } : null)
  return result ? { ...result, source } : null
}

/**
 * Fetch match result for a known fixture ID.
 * sport must match what was used when the fixture was searched.
 * source distinguishes football-data.org ('fd') from api-sports ('as').
 * Finished results are cached indefinitely.
 */
export async function getFixtureResult(
  fixtureId: number,
  sport = 'football',
  source: 'fd' | 'as' = 'fd',
): Promise<FixtureResult | null> {
  const cacheKey = `${sport}:${source}:${fixtureId}`
  if (fixtureCache.has(cacheKey)) return fixtureCache.get(cacheKey)!

  const result = sport === 'football'
    ? await getFootballResult(fixtureId, source)
    : await getNonFootballResult(sport, fixtureId)

  if (result?.finished) fixtureCache.set(cacheKey, result)
  return result
}

/**
 * Evaluate a prediction leg against a finished match result.
 * Returns PENDING if the match isn't finished or the market is unsupported.
 */
export function determineOutcome(
  result: FixtureResult,
  marketType: string,
  marketValue: string,
): 'WON' | 'LOST' | 'PENDING' {
  if (!result.finished) return 'PENDING'

  const { homeScore, awayScore } = result
  const total = homeScore + awayScore
  const mt    = marketType.toLowerCase()
  const mv    = marketValue.toLowerCase()

  if (mt === '1x2') {
    if (mv === 'home') return homeScore > awayScore   ? 'WON' : 'LOST'
    if (mv === 'draw') return homeScore === awayScore  ? 'WON' : 'LOST'
    if (mv === 'away') return awayScore > homeScore   ? 'WON' : 'LOST'
  }

  if (mt === 'btts') {
    const both = homeScore > 0 && awayScore > 0
    if (mv === 'yes') return both  ? 'WON' : 'LOST'
    if (mv === 'no')  return !both ? 'WON' : 'LOST'
  }

  if (mt === 'over_under') {
    const parts = mv.match(/^(over|under)_([\d.]+)$/)
    if (!parts) return 'PENDING'
    const threshold = parseFloat(parts[2])
    return parts[1] === 'over'
      ? total > threshold ? 'WON' : 'LOST'
      : total < threshold ? 'WON' : 'LOST'
  }

  return 'PENDING'
}

// ---------------------------------------------------------------------------
// Leg-building helpers (called at lock time)
// ---------------------------------------------------------------------------

function parseTeams(match: string): { home: string; away: string } | null {
  const m = match.match(/^(.+?)\s+(?:vs\.?|-)\s+(.+)$/i)
  if (!m) return null
  return { home: m[1].trim(), away: m[2].trim() }
}

export function isVirtualSport(tournament: string): boolean {
  const t = tournament.toLowerCase()
  return (
    t.includes('virtual') ||
    t.includes('esoccer') ||
    t.includes('efootball') ||
    t.includes('e-football') ||
    t.includes('e-soccer') ||
    t.includes('esports')  ||
    t.includes('cyber')    ||
    t.includes('betgames') ||
    t.includes('bet games')
  )
}

function detectSport(tournament: string): string {
  if (isVirtualSport(tournament))                                            return 'virtual'
  const t = tournament.toLowerCase()
  if (t.includes('basketball') || t.includes('nba') || t.includes('nbl'))  return 'basketball'
  if (t.includes('tennis')     || t.includes('atp') || t.includes('wta'))  return 'tennis'
  if (t.includes('baseball')   || t.includes('mlb'))                        return 'baseball'
  if (t.includes('hockey')     || t.includes('nhl'))                        return 'hockey'
  if (t.includes('rugby'))                                                   return 'rugby'
  if (t.includes('volleyball'))                                              return 'volleyball'
  if (t.includes('handball'))                                                return 'handball'
  return 'football'
}

function normalizeMarket(
  market: string,
  selection: string,
): { marketType: string; marketValue: string } | null {
  const m = market.toLowerCase()
  const s = selection.toLowerCase().trim()

  if (
    m.includes('full time') || m.includes('1x2') ||
    m.includes('match result') || m === 'result' ||
    m.includes('money line') || m.includes('moneyline') ||
    m.includes('winner') || m.includes('match winner')
  ) {
    const value = (s === '1' || s === 'home') ? 'home'
                : (s === 'x' || s === 'draw') ? 'draw'
                : (s === '2' || s === 'away') ? 'away'
                : null
    if (!value) return null
    return { marketType: '1x2', marketValue: value }
  }

  if (m.includes('both teams') || m.includes('btts') || m.includes('both to score')) {
    return { marketType: 'btts', marketValue: s.includes('yes') ? 'yes' : 'no' }
  }

  if (
    m.includes('over') || m.includes('under') ||
    m.includes('goals over') || m.includes('total points') ||
    m.includes('total runs') || m.includes('total goals')
  ) {
    const ou = s.match(/(over|under)\s*([\d.]+)/i)
    if (!ou) return null
    return { marketType: 'over_under', marketValue: `${ou[1].toLowerCase()}_${ou[2]}` }
  }

  return null
}

function parseKickoff(raw: string): Date | null {
  const m = raw.match(/(\w{3})\s+(\d+),\s*(\d{2}):(\d{2})/i)
  if (!m) return null
  const year = new Date().getFullYear()
  const d    = new Date(`${m[1]} ${m[2]} ${year} ${m[3]}:${m[4]}:00 UTC`)
  if (isNaN(d.getTime())) return null
  if (d.getTime() < Date.now() - 180 * 24 * 60 * 60 * 1000) d.setFullYear(year + 1)
  return d
}

function cleanTournament(raw: string): string {
  // Strip leading "N." index and surrounding whitespace from ConvertBetCodes HTML
  return raw.replace(/^\s*\d+\.\s*/s, '').replace(/\s+/g, ' ').trim()
}

/**
 * Convert raw ConvertBetCodes slip legs into structured PredictionLeg objects.
 * Looks up fixture IDs via the appropriate API for each sport.
 * Non-blocking per leg — if lookup fails, fixture_id stays null.
 *
 * @param fallbackDate  ISO date string (YYYY-MM-DD) used when ConvertBetCodes
 *                      kickoff can't be parsed — typically the prediction's
 *                      event_start_time.
 */
export async function buildLegsFromSlip(
  slipLegs: Array<{
    tournament: string
    match:      string
    market:     string
    selection:  string
    odds:       number
    kickoff:    string
  }>,
  fallbackDate?: string,
): Promise<PredictionLeg[]> {
  const result: PredictionLeg[] = []

  for (const raw of slipLegs) {
    const tournament = cleanTournament(raw.tournament)
    const sport      = detectSport(tournament)
    const teams      = parseTeams(raw.match)
    const normalized = normalizeMarket(raw.market, raw.selection)
    const kickoffAt  = parseKickoff(raw.kickoff)

    // Use parsed kickoff, fall back to prediction's event_start_time, fall back to today
    const searchDate = kickoffAt
      ? kickoffAt.toISOString().split('T')[0]
      : fallbackDate
        ? fallbackDate.split('T')[0]
        : new Date().toISOString().split('T')[0]

    let fixtureId:     number | null     = null
    let fixtureSource: 'fd' | 'as' | null = null
    let canonHome  = teams?.home ?? raw.match
    let canonAway  = teams?.away ?? ''

    if (teams) {
      try {
        const found = await searchFixture(teams.home, teams.away, searchDate, sport)
        if (found) {
          fixtureId     = found.fixtureId
          fixtureSource = found.source
          canonHome     = found.homeTeam
          canonAway     = found.awayTeam
        }
      } catch (err) {
        console.warn(`[fixtures] search failed for ${raw.match} (${sport}):`, err)
      }
    }

    result.push({
      fixture_id:     fixtureId,
      fixture_source: fixtureSource,
      sport,
      home_team:    canonHome,
      away_team:    canonAway,
      kickoff_at:   kickoffAt?.toISOString() ?? null,
      market_type:  normalized?.marketType  ?? null,
      market_value: normalized?.marketValue ?? null,
      tournament,
      odds:         raw.odds,
    })
  }

  return result
}
