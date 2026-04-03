import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { calculateScoreUpdate, ScoringContext } from '../services/scoring'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Submit a new prediction
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, betslip_code, betslip_link, odds, platform, event_start_time } = req.body

  if (!title || !betslip_code || !odds || !platform || !event_start_time) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (odds < 1.01) {
    return res.status(400).json({ error: 'Minimum odds are 1.01' })
  }

  // Check event hasn't started yet
  const eventStart = new Date(event_start_time)
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

  const { data, error } = await supabase
    .from('predictions')
    .insert({
      user_id: req.userId,
      title,
      betslip_code,
      betslip_link: betslip_link || null,
      odds: parseFloat(odds),
      platform,
      event_start_time: eventStart.toISOString(),
      status: 'PENDING',
      locked_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

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

// Get feed — all predictions sorted by user credit score
router.get('/feed', async (_req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
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
    `)
    .eq('status', 'PENDING')
    .order('locked_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })

  // Sort by profile credit score
  const sorted = (data || []).sort((a: any, b: any) => {
    const scoreA = a.profiles?.credit_score ?? 0
    const scoreB = b.profiles?.credit_score ?? 0
    return scoreB - scoreA
  })

  res.json(sorted)
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
