import { useState, useEffect } from 'react'
import type React from 'react'
import { api } from '../lib/api'
import PredictionCard from '../components/PredictionCard'
import { Rss, Trophy, Flame, Radio, Award, TrendingUp } from 'lucide-react'

type FeedItem = {
  id: string; title: string; betslip_code: string; betslip_link?: string
  odds: number; platform: string; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  locked_at: string; resolved_at?: string; score_contribution?: number
  profiles: { username: string; credit_score: number; visibility_score: number; correct_streak: number; user_state: string }
}

type LeaderboardUser = {
  id: string; username: string; credit_score: number; visibility_score: number
  correct_streak: number; user_state: string; total_resolved: number; total_correct: number
}

const rankColors = ['#fbbf24', '#94a3b8', '#c97c3a']

export default function Feed() {
  const [feed, setFeed]             = useState<FeedItem[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [trending, setTrending]     = useState<LeaderboardUser[]>([])
  const [tab, setTab]               = useState<'feed' | 'leaderboard' | 'trending'>('feed')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    Promise.all([api.getFeed(), api.getLeaderboard(), api.getTrending()])
      .then(([f, l, t]) => {
        setFeed(f); setLeaderboard(l); setTrending(t)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load feed')
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = [
    { id: 'feed' as const,        label: 'Feed',        icon: <Rss size={14} strokeWidth={1.5} /> },
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: <Trophy size={14} strokeWidth={1.5} /> },
    { id: 'trending' as const,    label: 'Trending',    icon: <Flame size={14} strokeWidth={1.5} /> },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--text-muted)' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      Loading...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>
      <p style={{ fontWeight: 600, color: 'var(--danger)' }}>Could not connect to API</p>
      <p style={{ fontSize: '13px' }}>{error}</p>
      <p style={{ fontSize: '12px', marginTop: '4px' }}>Make sure the backend is running on port 3001</p>
    </div>
  )

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <h1 className="animate-fade-in-up" style={{ fontSize: '22px', fontWeight: 800 }}>
            Community
          </h1>
          {tab === 'feed' && (
            <div className="animate-fade-in" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
              fontSize: '11px', fontWeight: 700, color: '#10b981',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#10b981',
                animation: 'pulse-glow 2s ease-in-out infinite',
                display: 'inline-block',
              }} />
              Live
            </div>
          )}
        </div>
        <p className="animate-fade-in-up delay-1" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Predictions ranked by real credibility
        </p>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up delay-1" style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        padding: '4px', borderRadius: '12px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        width: 'fit-content',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
            fontWeight: tab === t.id ? 700 : 400, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {feed.length === 0
            ? <Empty icon={<Radio size={32} strokeWidth={1} />} text="No predictions yet" sub="Be the first to lock a prediction" />
            : feed.map((item, i) => <PredictionCard key={item.id} prediction={item} showUser index={i} />)
          }
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {leaderboard.length === 0
            ? <Empty icon={<Trophy size={32} strokeWidth={1} />} text="No ranked users yet" sub="Start making predictions to appear here" />
            : leaderboard.map((user, i) => (
              <div key={user.id} className="glass-glow animate-fade-in-up" style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                {/* Rank */}
                <div style={{
                  width: '36px', textAlign: 'center',
                  fontSize: i < 3 ? '18px' : '14px',
                  fontWeight: 800,
                  color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#c97c3a' : 'var(--text-subtle)',
                  flexShrink: 0,
                }}>
                  {i < 3
                    ? <Award size={18} strokeWidth={1.5} style={{ color: rankColors[i] }} />
                    : <span style={{ color: 'var(--text-subtle)', fontWeight: 800 }}>{i + 1}</span>
                  }
                </div>

                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 800, color: '#fff',
                }}>
                  {user.username[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>@{user.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {user.total_correct}/{user.total_resolved} correct
                    {user.correct_streak > 0 && (
                      <span style={{ color: 'var(--streak)', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Flame size={11} strokeWidth={1.5} />
                        {user.correct_streak}d streak
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: 'var(--accent-light)', fontSize: '16px' }}>
                    {user.credit_score.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>credit</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Trending */}
      {tab === 'trending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trending.length === 0
            ? <Empty icon={<TrendingUp size={32} strokeWidth={1} />} text="No trending predictors" sub="Maintain a 3+ day streak to appear here" />
            : trending.map((user, i) => (
              <div key={user.id} className="glass-glow animate-fade-in-up" style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px',
                borderColor: i === 0 ? 'rgba(249,115,22,0.4)' : 'var(--border)',
              }}>
                {/* Streak badge */}
                <div style={{
                  padding: '6px 10px', borderRadius: '10px',
                  background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                  color: 'var(--streak)', fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  animation: i === 0 ? 'streak-burn 1.5s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }}>
                  <Flame size={14} strokeWidth={1.5} />
                  {user.correct_streak}d
                </div>

                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 800, color: '#fff',
                }}>
                  {user.username[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>@{user.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {user.total_resolved} predictions ·{' '}
                    <span style={{ textTransform: 'capitalize' }}>{user.user_state.toLowerCase()}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: 'var(--accent-light)', fontSize: '16px' }}>
                    {user.visibility_score.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>visibility</div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function Empty({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
      <div style={{ marginBottom: '12px', opacity: 0.4 }}>{icon}</div>
      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{text}</p>
      <p style={{ fontSize: '13px' }}>{sub}</p>
    </div>
  )
}
