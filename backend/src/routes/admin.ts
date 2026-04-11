import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Guard — HTTP Basic Auth checked against ADMIN_USERNAME / ADMIN_PASSWORD in .env
function adminGuard(req: Request, res: Response, next: () => void) {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD

  if (!expectedUser || !expectedPass) {
    return res.status(503).json({ error: 'Admin access not configured' })
  }

  const authHeader = req.headers['authorization'] || ''
  if (!authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TrustWeb Admin"')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const decoded  = Buffer.from(authHeader.slice(6), 'base64').toString('utf8')
  const [user, ...passParts] = decoded.split(':')
  const pass = passParts.join(':') // support colons in password

  if (user !== expectedUser || pass !== expectedPass) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TrustWeb Admin"')
    return res.status(404).json({ error: 'Not found' }) // Disguise as 404
  }

  next()
}

router.get('/', adminGuard, async (_req: Request, res: Response) => {
  try {
    const [
      { count: totalUsers },
      { count: totalPredictions },
      { count: pendingPredictions },
      { count: wonPredictions },
      { count: lostPredictions },
      { count: voidPredictions },
      { data: recentUsers },
      { data: recentResolutions },
      { data: platformBreakdown },
      { data: topUsers },
      { data: suspiciousUsers },
    ] = await Promise.all([

      // Total users
      supabase.from('profiles').select('*', { count: 'exact', head: true }),

      // Total predictions
      supabase.from('predictions').select('*', { count: 'exact', head: true }),

      // Pending predictions
      supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),

      // Won predictions
      supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('status', 'WON'),

      // Lost predictions
      supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('status', 'LOST'),

      // Void predictions
      supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('status', 'VOID'),

      // New users in last 7 days
      supabase
        .from('profiles')
        .select('id, username, credit_score, user_state, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),

      // Recent resolutions (last 20)
      supabase
        .from('predictions')
        .select('id, title, platform, status, odds, score_contribution, resolved_at, profiles(username)')
        .neq('status', 'PENDING')
        .order('resolved_at', { ascending: false })
        .limit(20),

      // Predictions by platform
      supabase
        .from('predictions')
        .select('platform'),

      // Top 10 users by credit score
      supabase
        .from('profiles')
        .select('id, username, credit_score, visibility_score, correct_streak, total_resolved, total_correct, user_state, last_resolved_at')
        .order('credit_score', { ascending: false })
        .limit(10),

      // Suspicious: >80% win rate with 5+ resolved predictions
      supabase
        .from('profiles')
        .select('id, username, credit_score, total_resolved, total_correct, user_state')
        .gte('total_resolved', 5),
    ])

    // Build platform breakdown from raw data
    const platformCounts: Record<string, number> = {}
    for (const p of (platformBreakdown || [])) {
      platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1
    }

    // Filter suspicious users (win rate > 80%)
    const flagged = (suspiciousUsers || []).filter(u =>
      u.total_resolved > 0 && (u.total_correct / u.total_resolved) > 0.8
    ).map(u => ({
      ...u,
      win_rate: `${Math.round((u.total_correct / u.total_resolved) * 100)}%`,
    }))

    const resolved = (wonPredictions ?? 0) + (lostPredictions ?? 0) + (voidPredictions ?? 0)
    const overallWinRate = resolved > 0
      ? `${Math.round(((wonPredictions ?? 0) / resolved) * 100)}%`
      : 'N/A'

    res.json({
      generated_at: new Date().toISOString(),

      users: {
        total:        totalUsers ?? 0,
        new_7d:       (recentUsers || []).length,
        recent:       recentUsers || [],
      },

      predictions: {
        total:        totalPredictions ?? 0,
        pending:      pendingPredictions ?? 0,
        won:          wonPredictions ?? 0,
        lost:         lostPredictions ?? 0,
        void:         voidPredictions ?? 0,
        overall_win_rate: overallWinRate,
        by_platform:  platformCounts,
      },

      recent_resolutions: recentResolutions || [],

      leaderboard: topUsers || [],

      flagged_users: {
        count:  flagged.length,
        reason: 'Win rate > 80% with 5+ resolved predictions — may warrant review',
        users:  flagged,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[admin] Error:', msg)
    res.status(500).json({ error: 'Internal error' })
  }
})

// Biggest wins — all-time top 30 WON predictions ranked by odds
router.get('/biggest-wins', adminGuard, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, title, betslip_code, platform, odds, resolved_at, locked_at, profiles(username, credit_score)')
    .eq('status', 'WON')
    .order('odds', { ascending: false })
    .limit(30)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// Live — all currently PENDING predictions with user info
router.get('/live', adminGuard, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, title, betslip_code, platform, odds, locked_at, event_start_time, profiles(username, credit_score, correct_streak)')
    .eq('status', 'PENDING')
    .order('locked_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// Full user list — searchable, sorted by credit score
router.get('/users', adminGuard, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim()
  const sort = String(req.query.sort || 'credit_score')
  const validSorts = ['credit_score', 'created_at', 'total_resolved', 'visibility_score']
  const orderCol = validSorts.includes(sort) ? sort : 'credit_score'

  let query = supabase
    .from('profiles')
    .select('id, username, credit_score, visibility_score, correct_streak, wrong_streak, total_resolved, total_correct, user_state, last_resolved_at, days_inactive, created_at')
    .order(orderCol, { ascending: false })
    .limit(200)

  if (q) query = query.ilike('username', `%${q}%`)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// Activity timeline — last 50 events (new predictions + resolutions)
router.get('/activity', adminGuard, async (_req: Request, res: Response) => {
  const [posts, resolutions] = await Promise.all([
    supabase
      .from('predictions')
      .select('id, title, betslip_code, platform, odds, locked_at, profiles(username)')
      .order('locked_at', { ascending: false })
      .limit(25),
    supabase
      .from('predictions')
      .select('id, title, betslip_code, platform, odds, status, score_contribution, resolved_at, profiles(username)')
      .neq('status', 'PENDING')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(25),
  ])

  const events = [
    ...(posts.data || []).map(p => ({ type: 'posted', at: p.locked_at, ...p })),
    ...(resolutions.data || []).map(p => ({ type: 'resolved', at: p.resolved_at, ...p })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50)

  res.json(events)
})

// Per-user detail
router.get('/users/:userId', adminGuard, async (req: Request, res: Response) => {
  const { userId } = req.params

  const [{ data: profile }, { data: predictions }, { data: history }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('predictions').select('*').eq('user_id', userId).order('locked_at', { ascending: false }),
    supabase.from('score_history').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
  ])

  if (!profile) return res.status(404).json({ error: 'User not found' })
  res.json({ profile, predictions: predictions || [], score_history: history || [] })
})

export default router
