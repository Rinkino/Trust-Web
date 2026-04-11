import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Follow a user
router.post('/:username', authMiddleware, async (req: AuthRequest, res: Response) => {
  const followerId = req.userId!
  const { username } = req.params

  const { data: target } = await supabase
    .from('profiles').select('id').eq('username', username).single()
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.id === followerId) return res.status(400).json({ error: 'Cannot follow yourself' })

  const { error } = await supabase
    .from('follows')
    .upsert({ follower_id: followerId, following_id: target.id }, { onConflict: 'follower_id,following_id' })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ following: true })
})

// Unfollow a user
router.delete('/:username', authMiddleware, async (req: AuthRequest, res: Response) => {
  const followerId = req.userId!
  const { username } = req.params

  const { data: target } = await supabase
    .from('profiles').select('id').eq('username', username).single()
  if (!target) return res.status(404).json({ error: 'User not found' })

  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', target.id)

  res.json({ following: false })
})

// Check if current user follows a username
router.get('/status/:username', authMiddleware, async (req: AuthRequest, res: Response) => {
  const followerId = req.userId!
  const { username } = req.params

  const { data: target } = await supabase
    .from('profiles').select('id').eq('username', username).single()
  if (!target) return res.json({ following: false })

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', target.id)
    .maybeSingle()

  res.json({ following: !!data })
})

// Get notifications for current user
router.get('/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id, type, read, created_at,
      predictions ( id, title, betslip_code, odds, platform, status ),
      profiles!notifications_from_user_id_fkey ( username, credit_score, correct_streak )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// Mark notifications as read
router.patch('/notifications/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  res.json({ ok: true })
})

// Get unread notification count
router.get('/notifications/count', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  res.json({ count: count ?? 0 })
})

export default router

/**
 * Called from predictions route when a new prediction is posted.
 * Inserts a notification for every follower of the poster.
 */
export async function notifyFollowers(
  posterId: string,
  predictionId: string
): Promise<void> {
  const { data: followers } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', posterId)

  if (!followers?.length) return

  const rows = followers.map(f => ({
    user_id:        f.follower_id,
    from_user_id:   posterId,
    type:           'new_prediction',
    prediction_id:  predictionId,
  }))

  await supabase.from('notifications').insert(rows)
}
