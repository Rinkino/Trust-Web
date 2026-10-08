import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Flame } from 'lucide-react'

type User = {
  id: string; username: string; credit_score: number; visibility_score: number
  correct_streak: number; user_state: string; total_resolved: number; total_correct: number
}

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
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>

      <div style={{ padding: '28px 16px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em' }}>Leaderboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {tab === 'credibility'
            ? totalUsers > 0
              ? `Ranked by credit score. Showing ${users.length} of ${totalUsers} predictors.`
              : 'Ranked by credit score.'
            : 'Longest current win streaks.'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        display: 'flex', gap: '20px', padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
        marginTop: '18px',
      }}>
        {([
          { id: 'credibility', label: 'Credit' },
          { id: 'trending',    label: 'Streaks' },
        ] as { id: 'credibility' | 'trending'; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 0', border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'inherit',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '14px', fontWeight: tab === t.id ? 600 : 400,
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Column headings */}
      {!loading && list.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 72px 80px',
          gap: '12px', padding: '10px 16px',
          fontSize: '12px', color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>#</span>
          <span>Predictor</span>
          <span style={{ textAlign: 'right' }}>Hit rate</span>
          <span style={{ textAlign: 'right' }}>{tab === 'credibility' ? 'Credit' : 'Streak'}</span>
        </div>
      )}

      {loading && (
        <div>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: '20px', height: '12px' }} />
              <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              <div className="skeleton" style={{ height: '12px', width: '40%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && list.map((u, i) => (
        <Link
          key={u.id}
          to={`/u/${u.username}`}
          className="lb-row"
          style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 72px 80px',
            gap: '12px', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <span className="mono" style={{
            fontSize: '13px',
            color: i < 3 ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: i < 3 ? 500 : 400,
          }}>
            {String(i + 1).padStart(2, '0')}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: i === 0 && tab === 'credibility' ? 'var(--accent)' : 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 600,
              color: i === 0 && tab === 'credibility' ? '#fff' : 'var(--text)',
            }}>
              {u.username[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.username}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>{u.total_resolved} resolved</span>
                {tab === 'credibility' && u.correct_streak > 2 && (
                  <span style={{ color: 'var(--streak)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <Flame size={11} strokeWidth={2} />{u.correct_streak}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className="mono" style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
            {accuracy(u)}
          </span>

          <span className="mono" style={{
            textAlign: 'right', fontSize: '14px', fontWeight: 500,
            color: tab === 'credibility' ? 'var(--text)' : 'var(--streak)',
          }}>
            {tab === 'credibility' ? Math.max(0, u.credit_score).toFixed(1) : u.correct_streak}
          </span>
        </Link>
      ))}

      {!loading && list.length === 0 && (
        <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '15px', color: 'var(--text)' }}>Nobody is ranked yet.</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>
            Predictors show up here after their first resolved pick.
          </p>
        </div>
      )}

      <div style={{ height: '72px' }} />
    </div>
  )
}
