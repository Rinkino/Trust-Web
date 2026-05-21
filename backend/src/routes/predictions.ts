import { Router, Response, Request } from 'express'
import { createClient } from '@supabase/supabase-js'
import rateLimit from 'express-rate-limit'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { calculateScoreUpdate, ScoringContext } from '../services/scoring'
import { fetchPolymarketMarket } from '../services/platforms/polymarket'
import { retrieveSlip } from '../services/platforms/convertbetcodes'
import { buildLegsFromSlip, isVirtualSport } from '../services/platforms/apisports'
import { notifyFollowers } from './follows'
import { runResolutionCycle } from '../services/resolver'

const router = Router()

// 10 prediction submissions per user per hour
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.userId ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many predictions submitted — maximum 10 per hour' },
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Preview a betslip code — no auth required
// For Polymarket: ?url=...
// For bookmakers: ?code=HRNXX6&bookie=sportybet:ng
router.get('/preview', async (req: Request, res: Response) => {
  const { url, code, bookie } = req.query

  if (code && bookie) {
    try {
      const slip = await retrieveSlip(String(code), String(bookie))
      return res.json(slip)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[preview] Error fetching slip:', msg)
      return res.status(502).json({ error: 'Could not fetch slip data' })
    }
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Provide either url (Polymarket) or code+bookie (bookmaker)' })
  }
  try {
    const market = await fetchPolymarketMarket(url)
    return res.json(market)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[preview] Error fetching Polymarket market:', msg)
    return res.status(502).json({ error: 'Could not fetch market data' })
  }
})

// Submit a new prediction
router.post('/', authMiddleware, submitLimiter, async (req: AuthRequest, res: Response) => {
  const { title, betslip_code, betslip_link, odds, platform, event_start_time, selection, market_id } = req.body

  if (!title || !betslip_code || !odds || !platform || !event_start_time) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Field length limits
  if (typeof title !== 'string' || title.length > 200) {
    return res.status(400).json({ error: 'Title must be under 200 characters' })
  }
  if (typeof betslip_code !== 'string' || betslip_code.length > 50) {
    return res.status(400).json({ error: 'Invalid betslip code' })
  }
  if (betslip_link && (typeof betslip_link !== 'string' || betslip_link.length > 500)) {
    return res.status(400).json({ error: 'Invalid betslip link' })
  }

  // Platform whitelist
  const ALLOWED_PLATFORMS = ['Sportybet', 'Polymarket', 'Bet9ja', 'BetKing', '1xBet', 'MSport', '22Bet', 'Betano']
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'Unsupported platform' })
  }

  // Odds must be a valid finite number
  let parsedOdds = parseFloat(odds)
  if (isNaN(parsedOdds) || !isFinite(parsedOdds) || parsedOdds < 1.01 || parsedOdds > 10000) {
    return res.status(400).json({ error: 'Odds must be a number between 1.01 and 10000' })
  }

  // Check event hasn't started yet
  const eventStart = new Date(event_start_time)
  if (isNaN(eventStart.getTime())) {
    return res.status(400).json({ error: 'Invalid event start time' })
  }
  if (eventStart <= new Date()) {
    return res.status(400).json({ error: 'Event has already started — prediction cannot be accepted' })
  }

  // Check for duplicate betslip code
  const { data: existing } = await supabase
    .from('predictions')
    .select('id')
    .eq('betslip_code', betslip_code)
    .single()

  if (existing) {
    return res.status(400).json({ error: 'This betslip code has already been submitted' })
  }

  // For Sportybet slips: fetch structured leg data and look up fixture IDs.
  // Non-blocking — if this fails the prediction still locks, resolver falls back to Puppeteer.
  let legs: any[] | null = null
  const isSportybet = platform?.toLowerCase().includes('sportybet')

  if (isSportybet) {
    let slip = null
    try {
      const bookie = platform.toLowerCase().includes(':') ? platform.toLowerCase() : 'sportybet:ng'
      slip = await retrieveSlip(betslip_code, bookie)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[predictions] Could not fetch slip for', betslip_code, '—', msg)
    }

    if (slip) {
      // Reject already-settled slips — matchesLeft === 0 means all matches are done.
      // This closes the backdating hole: old winning slips can't be submitted with a future date.
      if (slip.matchesLeft === 0 && slip.legCount > 0) {
        return res.status(400).json({ error: 'This slip has already been settled — predictions must be locked before events start' })
      }

      // Use the slip's verified total odds instead of user-submitted value
      if (slip.totalOdds > 0) {
        parsedOdds = slip.totalOdds
      }

      // Block virtual sports — no real-world result exists to verify against
      const virtualLegs = slip.legs.filter((l: any) => isVirtualSport(l.tournament))
      if (virtualLegs.length > 0) {
        const names = [...new Set(virtualLegs.map((l: any) => l.tournament as string))].join(', ')
        return res.status(400).json({ error: `Virtual sports cannot be submitted: ${names}` })
      }

      try {
        legs = await buildLegsFromSlip(slip.legs, event_start_time)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[predictions] Could not build legs for', betslip_code, '—', msg)
      }
    }
  }

  // resolve_after = latest leg kickoff + 2.5h, or event_start + 3h if no kickoff data
  const latestKickoffMs = (legs ?? []).reduce((max: number, l: any) => {
    if (!l.kickoff_at) return max
    return Math.max(max, new Date(l.kickoff_at).getTime())
  }, eventStart.getTime())
  const resolveAfter = new Date(latestKickoffMs + 2.5 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('predictions')
    .insert({
      user_id:          req.userId,
      title,
      betslip_code,
      betslip_link:     betslip_link || null,
      odds:             parsedOdds,
      platform,
      event_start_time: eventStart.toISOString(),
      status:           'PENDING',
      locked_at:        new Date().toISOString(),
      resolve_after:    resolveAfter,
      market_id:        market_id || null,
      selection:        selection || null,
      legs:             legs,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Fire notifications to followers (non-blocking)
  notifyFollowers(req.userId!, data.id).catch(() => {})

  res.status(201).json(data)
})

// Get all predictions for a user
router.get('/user/:userId', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
    .order('locked_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
})

// Get feed — paginated.
// sort=visibility (default): For You — ranked by poster's visibility_score
// sort=recent: newest first
router.get('/feed', async (req: Request, res: Response) => {
  const limit  = Math.min(Number(req.query.limit)  || 20, 50)
  const offset = Math.max(Number(req.query.offset) || 0,  0)
  const sort   = req.query.sort === 'recent' ? 'recent' : 'visibility'
  // Piggyback resolution on feed traffic — best-effort, non-blocking
  setImmediate(() => runResolutionCycle().catch(() => {}))
  const VALID_STATUSES = ['PENDING', 'WON', 'LOST', 'VOID']
  const rawStatus = String(req.query.status || 'PENDING')
  const status = rawStatus === 'all' ? null : (VALID_STATUSES.includes(rawStatus) ? rawStatus : 'PENDING')

  const baseQuery = supabase
    .from('predictions')
    .select(`
      *,
      profiles (
        username,
        credit_score,
        visibility_score,
        user_state,
        correct_streak
      )
    `, { count: 'exact' })

  const filtered = status ? baseQuery.eq('status', status) : baseQuery

  if (sort === 'visibility') {
    // Fetch all matching rows, sort by visibility in JS, then paginate.
    // Supabase cannot ORDER BY a joined column — DB-level pagination would
    // produce wrong pages. Acceptable cost at current scale (<100 users).
    const { data, error, count } = await filtered.order('locked_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })

    const sorted = [...(data || [])].sort((a, b) => {
      const va = (a.profiles as any)?.visibility_score ?? 0
      const vb = (b.profiles as any)?.visibility_score ?? 0
      return vb - va
    })
    const items = sorted.slice(offset, offset + limit)

    return res.json({
      items,
      total:   count ?? 0,
      hasMore: offset + limit < (count ?? 0),
      offset,
      limit,
    })
  }

  // recent sort — DB-level pagination is correct here
  const { data, error, count } = await filtered
    .order('locked_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: error.message })

  res.json({
    items:   data || [],
    total:   count ?? 0,
    hasMore: offset + limit < (count ?? 0),
    offset,
    limit,
  })
})

// Resolve a prediction (manual for MVP)
router.patch('/:id/resolve', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { result } = req.body // 'WON' | 'LOST' | 'VOID'

  if (!['WON', 'LOST', 'VOID'].includes(result)) {
    return res.status(400).json({ error: 'Result must be WON, LOST, or VOID' })
  }

  // Get the prediction
  const { data: prediction, error: predError } = await supabase
    .from('predictions')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single()

  if (predError || !prediction) {
    return res.status(404).json({ error: 'Prediction not found' })
  }

  if (prediction.status !== 'PENDING') {
    return res.status(400).json({ error: 'Prediction already resolved' })
  }

  // Get user profile for scoring context
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.userId)
    .single()

  if (profileError || !profile) {
    return res.status(500).json({ error: 'Profile not found' })
  }

  const ctx: ScoringContext = {
    currentCreditScore: profile.credit_score,
    currentVisibilityScore: profile.visibility_score,
    totalResolved: profile.total_resolved,
    correctStreak: profile.correct_streak,
    wrongStreak: profile.wrong_streak,
    bestStreakEver: profile.best_streak_ever,
    daysInactive: profile.days_inactive,
  }

  const scoring = calculateScoreUpdate(result, prediction.odds, ctx)

  // Update prediction status
  await supabase
    .from('predictions')
    .update({
      status: result,
      resolved_at: new Date().toISOString(),
      score_contribution: scoring.creditDelta,
    })
    .eq('id', id)

  // Update profile scores
  const totalResolved = result !== 'VOID' ? profile.total_resolved + 1 : profile.total_resolved
  const totalCorrect = result === 'WON' ? profile.total_correct + 1 : profile.total_correct

  await supabase
    .from('profiles')
    .update({
      credit_score: scoring.newCreditScore,
      visibility_score: scoring.newVisibilityScore,
      correct_streak: scoring.newCorrectStreak,
      wrong_streak: scoring.newWrongStreak,
      best_streak_ever: Math.max(profile.best_streak_ever, scoring.newCorrectStreak),
      total_resolved: totalResolved,
      total_correct: totalCorrect,
      last_resolved_at: new Date().toISOString(),
      user_state: result === 'WON' ? 'ACTIVE' : 'DECAYING',
    })
    .eq('id', req.userId)

  // Log score history
  await supabase.from('score_history').insert({
    user_id: req.userId,
    prediction_id: id,
    credit_before: ctx.currentCreditScore,
    credit_after: scoring.newCreditScore,
    credit_delta: scoring.creditDelta,
    visibility_before: ctx.currentVisibilityScore,
    visibility_after: scoring.newVisibilityScore,
    visibility_delta: scoring.visibilityDelta,
    result,
  })

  res.json({
    prediction: { ...prediction, status: result },
    scoring,
  })
})

export default router
