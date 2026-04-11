import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Bell, Flame, Lock } from 'lucide-react'

type Notif = {
  id: string
  type: string
  read: boolean
  created_at: string
  predictions: { id: string; title: string; betslip_code: string; odds: number; platform: string; status: string } | null
  profiles: { username: string; credit_score: number; correct_streak: number } | null
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function Notifications() {
  const [notifs, setNotifs]   = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.getNotifications()
      .then(data => { setNotifs(data); api.markNotificationsRead().catch(() => {}) })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        padding: '16px 16px',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 92%, transparent)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Notifications</h1>
      </div>

      {loading && (
        <div>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '13px', background: 'var(--surface-2)', borderRadius: '4px', marginBottom: '6px', width: '60%' }} />
                <div style={{ height: '12px', background: 'var(--surface-2)', borderRadius: '4px', width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ padding: '24px 16px', color: 'var(--danger)', fontSize: '14px' }}>{error}</p>}

      {!loading && notifs.length === 0 && !error && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={32} strokeWidth={1} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No notifications yet</p>
          <p style={{ fontSize: '13px' }}>Follow predictors to get alerts when they post.</p>
        </div>
      )}

      {notifs.map(n => {
        const u = n.profiles
        const p = n.predictions
        return (
          <div
            key={n.id}
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', gap: '12px',
              background: n.read ? 'transparent' : 'rgba(var(--accent-rgb), 0.04)',
              transition: 'background 0.12s',
            }}
          >
            {/* Avatar */}
            {u && (
              <Link to={`/u/${u.username}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 800, color: '#fff',
                }}>
                  {u.username[0].toUpperCase()}
                </div>
              </Link>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
                {u && (
                  <Link to={`/u/${u.username}`} style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', textDecoration: 'none' }}>
                    {u.username}
                  </Link>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>locked a new pick</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</span>
              </div>
              {p && (
                <div style={{
                  padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  fontSize: '13px',
                }}>
                  <p style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>{p.title}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      {p.platform}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700 }}>×{p.odds}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Lock size={9} strokeWidth={1.5} />{p.betslip_code}
                    </span>
                  </div>
                </div>
              )}
              {u && u.correct_streak > 0 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Flame size={11} strokeWidth={1.5} /> {u.correct_streak}-pick streak
                </div>
              )}
            </div>
          </div>
        )
      })}

      <div style={{ height: '72px' }} />
    </div>
  )
}
