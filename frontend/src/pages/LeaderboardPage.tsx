import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Award, Flame, Shield, TrendingUp, Zap, Trophy } from 'lucide-react'
import type React from 'react'

type User = {
  id: string; username: string; credit_score: number; visibility_score: number
  correct_streak: number; user_state: string; total_resolved: number; total_correct: number
}

const medalColors = ['#fbbf24', '#94a3b8', '#c97c3a']
const medalLabels = ['1st', '2nd', '3rd']

function accuracy(u: User): string {
  if (!u.total_resolved) return '—'
  return `${Math.round((u.total_correct / u.total_resolved) * 100)}%`
}

function SparkleIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 1L13.8 9.2L22 12L13.8 14.8L12 23L10.2 14.8L2 12L10.2 9.2Z" />
      <path d="M19 2L19.9 5.1L23 6L19.9 6.9L19 10L18.1 6.9L15 6L18.1 5.1Z" opacity="0.5" />
    </svg>
  )
}

export default function LeaderboardPage() {
  const [users, setUsers]           = useState<User[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [trending, setTrending]     = useState<User[]>([])
  const [tab, setTab]               = useState<'credibility' | 'trending'>('credibility')
  const [loading, setLoading]       = useState(true)
  const [mounted, setMounted]       = useState(false)

  useEffect(() => {
    Promise.all([api.getLeaderboard(), api.getTrending()])
      .then(([lb, tr]) => {
        setUsers(lb.users ?? [])
        setTotalUsers(lb.totalUsers ?? 0)
        setTrending(tr ?? [])
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setTimeout(() => setMounted(true), 50) })
  }, [])

  useEffect(() => {
    if (!loading) setTimeout(() => setMounted(true), 50)
  }, [loading])

  const list = tab === 'credibility' ? users : trending

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div className="animate-icon-pop" style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trophy size={18} strokeWidth={1.5} style={{ color: '#fbbf24' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Leaderboard</h1>
          <span className="animate-sparkle" style={{ marginLeft: '4px' }}>
            <SparkleIcon size={14} color="var(--warning)" />
          </span>
        </div>
        {totalUsers > 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', paddingLeft: '2px' }}>
            Top {users.length} of {totalUsers} predictors · top 10% by credibility
          </p>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        display: 'flex', borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)',
        marginTop: '14px',
      }}>
        {([
          { id: 'credibility', label: 'Credibility', icon: <Shield  size={14} strokeWidth={1.5} /> },
          { id: 'trending',    label: 'Hot Streaks', icon: <Flame   size={14} strokeWidth={1.5} /> },
        ] as { id: 'credibility' | 'trending'; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '14px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '14px', fontWeight: tab === t.id ? 700 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              position: 'relative',
              transition: 'color 0.2s',
            }}
          >
            <span style={{
              color: tab === t.id ? 'var(--accent-light)' : 'var(--text-muted)',
              transition: 'color 0.2s',
            }}>{t.icon}</span>
            {t.label}
            {tab === t.id && (
              <span style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '48px', height: '3px', borderRadius: '3px 3px 0 0',
                background: 'var(--accent)',
                animation: 'scale-in 0.25s cubic-bezier(0.16,1,0.3,1)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Skeleton ── */}
      {loading && (
        <div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '14px',
                animation: `row-in 0.4s ease ${i * 0.05}s both`,
              }}
            >
              <div style={{ width: '28px', textAlign: 'center', flexShrink: 0 }}>
                <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%', margin: '0 auto' }} />
              </div>
              <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: '13px', borderRadius: '4px', marginBottom: '7px', width: '35%' }} />
                <div className="skeleton" style={{ height: '11px', borderRadius: '4px', width: '55%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Top 3 podium (credibility only) ── */}
      {!loading && tab === 'credibility' && users.length >= 3 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px', background: 'var(--border)',
          margin: '0', borderBottom: '1px solid var(--border)',
        }}>
          {users.slice(0, 3).map((u, i) => (
            <Link
              key={u.id}
              to={`/u/${u.username}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '24px 12px 20px',
                background: i === 0 ? 'rgba(251,191,36,0.04)' : 'var(--bg)',
                textDecoration: 'none', color: 'inherit',
                transition: 'background 0.2s',
                position: 'relative', overflow: 'hidden',
                animation: `bounce-in 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s both`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? 'rgba(251,191,36,0.04)' : 'var(--bg)')}
            >
              {/* Gold shimmer on #1 */}
              {i === 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, transparent 30%, rgba(251,191,36,0.04), transparent 70%)',
                  animation: 'shimmer-sweep 5s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Medal icon */}
              <div
                className="animate-icon-pop"
                style={{ marginBottom: '10px', animationDelay: `${0.2 + i * 0.12}s` }}
              >
                <Award size={22} strokeWidth={2} style={{ color: medalColors[i] }} />
              </div>

              {/* Avatar */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                background: medalColors[i],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, color: '#fff',
                marginBottom: '10px',
                boxShadow: i === 0 ? `0 0 20px ${medalColors[i]}55` : 'none',
                transition: 'transform 0.2s',
              }}>
                {u.username[0].toUpperCase()}
              </div>

              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px', textAlign: 'center' }}>
                {u.username}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {medalLabels[i]}
              </div>
              <div style={{
                fontWeight: 800, fontSize: '15px',
                color: 'var(--accent-light)',
              }}>
                {Math.max(0, u.credit_score).toFixed(1)}
              </div>
              {u.correct_streak > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '3px',
                  fontSize: '11px', color: 'var(--streak)', marginTop: '4px',
                }}>
                  <Flame size={10} strokeWidth={2} className="animate-streak" />
                  {u.correct_streak}d
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* ── List ── */}
      {!loading && list.map((u, i) => {
        const isTop3 = i < 3 && tab === 'credibility'
        if (isTop3) return null

        return (
          <Link
            key={u.id}
            to={`/u/${u.username}`}
            className="lb-row"
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit',
              animation: mounted ? `row-in 0.45s cubic-bezier(0.16,1,0.3,1) ${(i - (tab === 'credibility' ? 3 : 0)) * 0.05}s both` : 'none',
            }}
          >
            {/* Rank */}
            <div style={{ width: '28px', textAlign: 'center', flexShrink: 0, fontSize: '13px', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
            </div>

            {/* Avatar */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: 700, color: '#fff',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 0 14px rgba(var(--accent-rgb),0.4)'
                e.currentTarget.style.transform = 'scale(1.08)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {u.username[0].toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{u.username}</span>
                {u.correct_streak > 2 && (
                  <span style={{
                    color: 'var(--streak)', fontSize: '12px',
                    display: 'flex', alignItems: 'center', gap: '2px',
                    background: 'rgba(249,115,22,0.08)',
                    padding: '2px 6px', borderRadius: '20px',
                    border: '1px solid rgba(249,115,22,0.18)',
                  }}>
                    <Flame size={10} strokeWidth={2} className="animate-streak" />
                    {u.correct_streak}
                  </span>
                )}
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '15px', fontWeight: 800,
                  color: tab === 'credibility' ? 'var(--accent-light)' : 'var(--streak)',
                }}>
                  {tab === 'credibility'
                    ? `${Math.max(0, u.credit_score).toFixed(1)} cr`
                    : `${u.correct_streak}d`
                  }
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', alignItems: 'center' }}>
                <span>{u.total_resolved} picks</span>
                <span>{accuracy(u)} hit rate</span>
                {tab === 'trending' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <TrendingUp size={11} strokeWidth={1.5} />
                    {u.visibility_score.toFixed(1)} vis
                  </span>
                )}
                {tab === 'credibility' && u.correct_streak > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--streak)' }}>
                    <Zap size={10} strokeWidth={2} />
                    {u.correct_streak}d streak
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}

      {!loading && list.length === 0 && (
        <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="animate-float-gentle" style={{ display: 'inline-block', marginBottom: '16px' }}>
            <Award size={36} strokeWidth={1} style={{ opacity: 0.3 }} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600 }}>No ranked predictors yet</p>
          <p style={{ fontSize: '13px', marginTop: '6px', opacity: 0.6 }}>Be the first to build a track record.</p>
        </div>
      )}

      <div style={{ height: '72px' }} />
    </div>
  )
}
