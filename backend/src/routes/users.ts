import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Search users by username prefix
router.get('/search', async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q || '').trim().slice(0, 50)
  if (!q) return res.json([])

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, credit_score, visibility_score, correct_streak, user_state, total_resolved, total_correct')
    .ilike('username', `%${q}%`)
    .order('credit_score', { ascending: false })
    .limit(15)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Get leaderboard — top users by credit score (the credibility window)
router.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  // Count total users first to compute top 10%
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gt('total_resolved', 2)

  const totalUsers = count ?? 0
  const topN = Math.max(10, Math.ceil(totalUsers * 0.1)) // top 10% or at least 10

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, credit_score, visibility_score, correct_streak, user_state, total_resolved, total_correct')
    .gt('total_resolved', 2)   // only users with meaningful track record
    .gt('credit_score', 0)
    .order('credit_score', { ascending: false })
    .limit(topN)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ users: data || [], totalUsers })
})

// Get trending — users with active streaks
router.get('/trending', async (_req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, credit_score, visibility_score, correct_streak, user_state, total_resolved')
    .in('user_state', ['ACTIVE', 'PENDING'])
    .gt('correct_streak', 2)
    .order('correct_streak', { ascending: false })
    .limit(20)

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
})

// Get own analytics — score history + platform breakdown + recent form
router.get('/me/analytics', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!

  const [
    { data: scoreHistory, error: historyError },
    { data: predictions, error: predsError },
  ] = await Promise.all([
    supabase
      .from('score_history')
      .select('credit_before, credit_after, credit_delta, result, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(30),

    supabase
      .from('predictions')
      .select('platform, odds, status')
      .eq('user_id', userId),
  ])

  if (historyError) return res.status(500).json({ error: historyError.message })
  if (predsError)   return res.status(500).json({ error: predsError.message })

  const resolved = (predictions || []).filter(p => p.status !== 'PENDING')

  // Platform breakdown
  const platformCounts: Record<string, number> = {}
  for (const p of (predictions || [])) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1
  }

  // Average odds on resolved predictions
  const avgOdds = resolved.length > 0
    ? resolved.reduce((sum, p) => sum + p.odds, 0) / resolved.length
    : null

  // Recent form — last 10 resolved, newest first
  const recentForm = (predictions || [])
    .filter(p => p.status !== 'PENDING')
    .slice(-10)
    .map(p => p.status)

  res.json({
    score_history: scoreHistory || [],
    platform_breakdown: platformCounts,
    avg_odds: avgOdds !== null ? Math.round(avgOdds * 100) / 100 : null,
    recent_form: recentForm,
  })
})

// Get own profile
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.userId)
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
})

// Get public profile by username
router.get('/:username', async (req: AuthRequest, res: Response) => {
  const { username } = req.params

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, credit_score, visibility_score, correct_streak, best_streak_ever, user_state, total_resolved, total_correct, created_at')
    .eq('username', username)
    .single()

  if (error || !profile) return res.status(404).json({ error: 'User not found' })

  // Show 0 publicly if credit score is negative
  const publicProfile = {
    ...profile,
    credit_score: Math.max(0, profile.credit_score),
    is_negative: profile.credit_score < 0,
  }

  res.json(publicProfile)
})

// Update username
router.patch('/me/username', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { username } = req.body

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' })
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3–30 characters' })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' })
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) {
    return res.status(400).json({ error: 'Username already taken' })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ username, username_confirmed: true })
    .eq('id', req.userId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
})

// Delete own account
router.delete('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!

  // Delete predictions + profile first (or rely on cascade), then auth user
  await supabase.from('score_history').delete().eq('user_id', userId)
  await supabase.from('predictions').delete().eq('user_id', userId)
  await supabase.from('profiles').delete().eq('id', userId)

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return res.status(500).json({ error: error.message })

  res.json({ success: true })
})

export default router
