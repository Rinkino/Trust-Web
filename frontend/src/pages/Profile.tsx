import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import PredictionCard from '../components/PredictionCard'
import ScoreBadge from '../components/ScoreBadge'
import { Target, Hash, Award, Flame, ArrowLeft, BarChart2, UserPlus, UserMinus } from 'lucide-react'

type Profile = {
  id: string
  username: string
  credit_score: number
  visibility_score: number
  correct_streak: number
  best_streak_ever: number
  user_state: string
  total_resolved: number
  total_correct: number
  created_at: string
  is_negative?: boolean
}

type Prediction = {
  id: string; title: string; betslip_code: string; betslip_link?: string
  odds: number; platform: string; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  locked_at: string; resolved_at?: string; score_contribution?: number
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()

  const [profile, setProfile]           = useState<Profile | null>(null)
  const [predictions, setPredictions]   = useState<Prediction[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [tab, setTab]                   = useState<'pending' | 'history'>('history')
  const [following, setFollowing]       = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [adminEmail, setAdminEmail]       = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (!username) return
    api.getProfile(username)
      .then(async (p: Profile) => {
        setProfile(p)
        const [preds, followStatus] = await Promise.all([
          api.getUserPredictions(p.id),
          api.getFollowStatus(username).catch(() => ({ following: false })),
        ])
        setPredictions(preds)
        setFollowing(followStatus.following)

        // If viewing as admin, fetch the real email
        const adminCreds = (() => { try { return atob(sessionStorage.getItem('tw_admin_auth') || '') || null } catch { return null } })()
        if (adminCreds) {
          const ADMIN_API = import.meta.env.VITE_API_URL ?? ''
          const r = await fetch(`${ADMIN_API}/api/x7k2-internal/users/${p.id}`, {
            headers: { Authorization: `Basic ${btoa(adminCreds)}` },
          }).then(res => res.ok ? res.json() : null).catch(() => null)
          if (r?.email) setAdminEmail(r.email)
        }
      })
      .catch(() => setError('User not found'))
      .finally(() => setLoading(false))
  }, [username])

  async function handleFollow() {
    if (!profile) return
    setFollowLoading(true)
    try {
      if (following) {
        await api.unfollowUser(profile.username)
        setFollowing(false)
      } else {
        await api.followUser(profile.username)
        setFollowing(true)
      }
    } catch {}
    finally { setFollowLoading(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--text-muted)' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      Loading...
    </div>
  )

  if (error || !profile) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--text-muted)' }}>
      <p style={{ fontWeight: 600, fontSize: '16px' }}>User not found</p>
      <button onClick={() => navigate('/feed')} style={{ fontSize: '13px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
        Back to feed
      </button>
    </div>
  )

  const pending  = predictions.filter(p => p.status === 'PENDING')
  const resolved = predictions.filter(p => p.status !== 'PENDING')
  const winRate  = profile.total_resolved > 0
    ? Math.round((profile.total_correct / profile.total_resolved) * 100) : 0

  // Recent form from resolved predictions (last 10, newest first)
  const recentForm = [...resolved]
    .sort((a, b) => new Date(b.resolved_at ?? b.locked_at).getTime() - new Date(a.resolved_at ?? a.locked_at).getTime())
    .slice(0, 10)
    .map(p => p.status)

  // Platform breakdown
  const platformCounts: Record<string, number> = {}
  for (const p of predictions) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  })

  return (
    <div className="page">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="animate-fade-in-up"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px',
          padding: 0,
        }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back
      </button>

      {/* Profile header */}
      <div className="animate-fade-in-up" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          {/* Avatar */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 700, color: '#fff',
          }}>
            {profile.username[0].toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '2px' }}>
                  @{profile.username}
                </h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Member since {memberSince}
                </p>
                {adminEmail && (
                  <p style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'monospace', marginTop: '2px' }}>
                    {adminEmail}
                  </p>
                )}
              </div>
              {/* Follow button — only show if viewing someone else's profile */}
              {currentUserId && profile.id !== currentUserId && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={{
                    padding: '8px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
                    cursor: followLoading ? 'default' : 'pointer',
                    border: following ? '1px solid var(--border)' : 'none',
                    background: following ? 'transparent' : 'var(--accent)',
                    color: following ? 'var(--text)' : '#fff',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  {following
                    ? <><UserMinus size={14} strokeWidth={1.8} />Following</>
                    : <><UserPlus size={14} strokeWidth={1.8} />Follow</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {[
            { icon: <Target size={13} strokeWidth={1.5} />, label: 'Win Rate', value: `${winRate}%`, color: 'var(--success)' },
            { icon: <Hash size={13} strokeWidth={1.5} />,   label: 'Resolved', value: String(profile.total_resolved), color: 'var(--text-muted)' },
            { icon: <Award size={13} strokeWidth={1.5} />,  label: 'Best Streak', value: `${profile.best_streak_ever}`, color: 'var(--streak)' },
            ...(profile.correct_streak > 1 ? [{
              icon: <Flame size={13} strokeWidth={1.5} />, label: 'On Fire', value: `${profile.correct_streak} in a row`, color: 'var(--streak)',
            }] : []),
          ].map(s => (
            <div key={s.label} className="glass-glow" style={{
              padding: '8px 14px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Score badge */}
        <ScoreBadge
          creditScore={profile.credit_score}
          visibilityScore={profile.visibility_score}
          userState={profile.user_state}
          correctStreak={profile.correct_streak}
        />

        {/* Recent form */}
        {recentForm.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Recent Form
            </p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {recentForm.map((r, i) => (
                <div
                  key={i}
                  title={r}
                  style={{
                    width: '26px', height: '26px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: r === 'WON' ? 'rgba(34,197,94,0.15)' : r === 'LOST' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                    color: r === 'WON' ? 'var(--success)' : r === 'LOST' ? 'var(--danger)' : 'var(--text-muted)',
                    border: `1px solid ${r === 'WON' ? 'rgba(34,197,94,0.3)' : r === 'LOST' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                  }}
                >
                  {r === 'WON' ? 'W' : r === 'LOST' ? 'L' : 'V'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform breakdown (only if more than one platform) */}
        {Object.keys(platformCounts).length > 1 && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(platformCounts).map(([platform, count]) => (
              <span key={platform} style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}>
                {platform} · {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {([
          { id: 'history' as const, label: 'History', count: resolved.length },
          { id: 'pending' as const, label: 'Live',    count: pending.length },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
            fontWeight: tab === t.id ? 700 : 400, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'var(--surface-2)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.2s',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                padding: '2px 7px', borderRadius: '10px', fontSize: '11px',
                background: tab === t.id ? 'var(--accent)' : 'var(--border)',
                color: tab === t.id ? '#fff' : 'var(--text-muted)',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Predictions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tab === 'history' && (
          resolved.length === 0
            ? <Empty icon={<BarChart2 size={32} strokeWidth={1} />} text="No resolved predictions yet" sub="This user hasn't had any predictions resolve" />
            : [...resolved]
                .sort((a, b) => new Date(b.resolved_at ?? b.locked_at).getTime() - new Date(a.resolved_at ?? a.locked_at).getTime())
                .map((p, i) => <PredictionCard key={p.id} prediction={p} index={i} />)
        )}
        {tab === 'pending' && (
          pending.length === 0
            ? <Empty icon={<Target size={32} strokeWidth={1} />} text="No live predictions" sub="Nothing locked and pending yet" />
            : pending.map((p, i) => <PredictionCard key={p.id} prediction={p} index={i} />)
        )}
      </div>
      <div style={{ height: '72px' }} />
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
