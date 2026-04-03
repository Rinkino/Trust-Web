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

export default router
