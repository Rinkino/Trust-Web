import { Router, Response, Request } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { calculateScoreUpdate, ScoringContext } from '../services/scoring'
import { fetchPolymarketMarket } from '../services/platforms/polymarket'
import { retrieveSlip } from '../services/platforms/convertbetcodes'
import { buildLegsFromSlip, isVirtualSport } from '../services/platforms/apisports'
import { notifyFollowers } from './follows'

const router = Router()

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
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
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
  const parsedOdds = parseFloat(odds)
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
      // Block virtual sports — no real-world result exists to verify against
      const virtualLegs = slip.legs.filter((l: any) => isVirtualSport(l.tournament))
      if (virtualLegs.length > 0) {
        const names = [...new Set(virtualLegs.map((l: any) => l.tournament as string))].join(', ')
        return res.status(400).json({ error: `Virtual sports cannot be submitted: ${names}` })
      }

      try {
        legs = await buildLegsFromSlip(slip.legs)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[predictions] Could not build legs for', betslip_code, '—', msg)
      }
    }
  }

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
  const VALID_STATUSES = ['PENDING', 'WON', 'LOST', 'VOID']
  const rawStatus = String(req.query.status || 'PENDING')
  const status = rawStatus === 'all' ? null : (VALID_STATUSES.includes(rawStatus) ? rawStatus : 'PENDING')

  let query = supabase
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

  if (status) query = query.eq('status', status)

  // For visibility sort we order by the joined profile column
  if (sort === 'visibility') {
    query = query.order('locked_at', { ascending: false })
  } else {
    query = query.order('locked_at', { ascending: false })
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  // If visibility sort, re-sort in JS since Supabase can't order by joined columns
  let items = data || []
  if (sort === 'visibility') {
    items = [...items].sort((a, b) => {
      const va = (a.profiles as any)?.visibility_score ?? 0
      const vb = (b.profiles as any)?.visibility_score ?? 0
      return vb - va
    })
  }

  if (error) return res.status(500).json({ error: error.message })

  res.json({
    items:   items,
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
