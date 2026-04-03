import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get leaderboard — sorted by credit score, negative scores shown as unranked publicly
router.get('/leaderboard', async (_req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, credit_score, visibility_score, correct_streak, user_state, total_resolved, total_correct')
    .gt('credit_score', 0)
    .order('visibility_score', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
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

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' })
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
    .update({ username })
    .eq('id', req.userId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.json(data)
})

export default router
