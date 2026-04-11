import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Award, Flame, Shield, TrendingUp } from 'lucide-react'

type User = {
  id: string; username: string; credit_score: number; visibility_score: number
  correct_streak: number; user_state: string; total_resolved: number; total_correct: number
}

const medalColors = ['#fbbf24', '#94a3b8', '#c97c3a']

function accuracy(u: User): string {
  if (!u.total_resolved) return '—'
  return `${Math.round((u.total_correct / u.total_resolved) * 100)}%`
}

export default function LeaderboardPage() {
  const [users, setUsers]           = useState<User[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [trending, setTrending]     = useState<User[]>([])
  const [tab, setTab]               = useState<'credibility' | 'trending'>('credibility')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([api.getLeaderboard(), api.getTrending()])
      .then(([lb, tr]) => {
        setUsers(lb.users ?? [])
        setTotalUsers(lb.totalUsers ?? 0)
        setTrending(tr ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const list = tab === 'credibility' ? users : trending

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Leaderboard</h1>
        {totalUsers > 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Top {users.length} of {totalUsers} predictors · top 10% by credibility
          </p>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        display: 'flex', borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)',
        marginTop: '12px',
      }}>
        {([
          { id: 'credibility', label: 'Credibility', icon: <Shield size={14} strokeWidth={1.5} /> },
          { id: 'trending',    label: 'Hot Streaks', icon: <Flame size={14} strokeWidth={1.5} /> },
        ] as { id: 'credibility' | 'trending'; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '14px', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
            fontSize: '14px', fontWeight: tab === t.id ? 700 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            position: 'relative', transition: 'color 0.15s',
          }}>
            {t.icon}{t.label}
            {tab === t.id && (
              <span style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '48px', height: '3px', borderRadius: '3px 3px 0 0',
                background: 'var(--accent)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Skeleton */}
      {loading && (
        <div>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '28px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface-2)', margin: '0 auto' }} />
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '13px', background: 'var(--surface-2)', borderRadius: '4px', marginBottom: '6px', width: '35%' }} />
                <div style={{ height: '11px', background: 'var(--surface-2)', borderRadius: '4px', width: '55%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!loading && list.map((u, i) => (
        <Link
          key={u.id}
          to={`/u/${u.username}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            textDecoration: 'none', color: 'inherit',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* Rank */}
          <div style={{ width: '28px', textAlign: 'center', flexShrink: 0, fontSize: '14px', fontWeight: 700 }}>
            {i < 3
              ? <Award size={20} strokeWidth={2} style={{ color: medalColors[i] }} />
              : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</span>
            }
          </div>

          {/* Avatar */}
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            background: i < 3
              ? `linear-gradient(135deg, ${medalColors[i]}, ${medalColors[i]}88)`
              : 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 800, color: '#fff',
            boxShadow: i < 3 ? `0 0 12px ${medalColors[i]}44` : 'none',
          }}>
            {u.username[0].toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{u.username}</span>
              {u.correct_streak > 2 && (
                <span style={{ color: 'var(--streak)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Flame size={11} strokeWidth={1.5} />{u.correct_streak}
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
            <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>{u.total_resolved} picks</span>
              <span>{accuracy(u)} hit rate</span>
              {tab === 'trending' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <TrendingUp size={11} strokeWidth={1.5} />
                  {u.visibility_score.toFixed(1)} vis
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}

      {!loading && list.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Award size={32} strokeWidth={1} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ fontSize: '15px', fontWeight: 600 }}>No ranked predictors yet</p>
        </div>
      )}

      <div style={{ height: '72px' }} />
    </div>
  )
}
