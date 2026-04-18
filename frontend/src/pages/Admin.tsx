import { useState, useEffect, useCallback } from 'react'
import {
  Users, BarChart2, Zap, Trophy, AlertTriangle,
  Clock, CheckCircle, XCircle, MinusCircle,
  TrendingUp, Flame, Search, RefreshCw, Activity,
  Lock, Ticket, Wrench, Bot,
} from 'lucide-react'

// ── Auth ────────────────────────────────────────────────────────────────────

const ADMIN_KEY = 'tw_admin_auth'
const ADMIN_API = import.meta.env.VITE_API_URL || ''

async function adminFetch(path: string, creds: string) {
  const res = await fetch(`${ADMIN_API}/api/x7k2-internal${path}`, {
    headers: { Authorization: `Basic ${btoa(creds)}` },
  })
  if (res.status === 401 || res.status === 404) throw new Error('bad_creds')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Types ────────────────────────────────────────────────────────────────────

type Overview = {
  generated_at: string
  users: { total: number; new_7d: number; recent: any[] }
  predictions: { total: number; pending: number; won: number; lost: number; void: number; overall_win_rate: string; by_platform: Record<string, number> }
  recent_resolutions: any[]
  leaderboard: any[]
  flagged_users: { count: number; reason: string; users: any[] }
}

type Tab = 'overview' | 'live' | 'wins' | 'users' | 'activity' | 'tickets' | 'ai' | 'debug'

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmt(n: number, decimals = 1) { return n.toFixed(decimals) }

const statusColor: Record<string, string> = {
  WON: 'var(--success)', LOST: 'var(--danger)', VOID: 'var(--text-muted)', PENDING: 'var(--warning)',
}
const statusIcon: Record<string, React.ReactNode> = {
  WON:     <CheckCircle size={12} strokeWidth={2} />,
  LOST:    <XCircle size={12} strokeWidth={2} />,
  VOID:    <MinusCircle size={12} strokeWidth={2} />,
  PENDING: <Clock size={12} strokeWidth={2} />,
}

// ── Stat card ────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, minWidth: '140px',
      padding: '16px 18px', borderRadius: '12px',
      background: 'var(--surface-2)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: color ?? 'var(--accent)' }}>
        {icon}
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ onAuth }: { onAuth: (creds: string) => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const creds = `${user}:${pass}`
    try {
      await adminFetch('/', creds)
      sessionStorage.setItem(ADMIN_KEY, btoa(creds))
      onAuth(creds)
    } catch {
      setErr('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '360px',
        padding: '32px', borderRadius: '16px',
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <Lock size={22} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Admin Access</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>TrustWeb control panel</p>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            value={user} onChange={e => setUser(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            style={{
              padding: '11px 14px', borderRadius: '10px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: '14px', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <input
            value={pass} onChange={e => setPass(e.target.value)}
            placeholder="Password" type="password"
            autoComplete="current-password"
            style={{
              padding: '11px 14px', borderRadius: '10px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: '14px', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          {err && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>{err}</p>}
          <button
            type="submit" disabled={loading || !user || !pass}
            style={{
              padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
              background: 'var(--accent)', color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer',
              opacity: loading || !user || !pass ? 0.6 : 1,
            }}
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export default function Admin() {
  const [creds, setCreds]       = useState<string | null>(() => {
    try { return atob(sessionStorage.getItem(ADMIN_KEY) || '') || null } catch { return null }
  })
  const [tab, setTab]           = useState<Tab>('overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [live, setLive]         = useState<any[]>([])
  const [wins, setWins]         = useState<any[]>([])
  const [users, setUsers]       = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [tickets, setTickets]         = useState<any[]>([])
  const [aiResolutions, setAiResolutions] = useState<any[]>([])
  const [debug, setDebug]             = useState<{ total: number; predictions: any[] } | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [rebuildingId, setRebuildingId] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [loading, setLoading]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState('')

  const load = useCallback(async (c: string, t: Tab, forceRefresh = false) => {
    if (!c) return
    if (t === 'overview' && overview && !forceRefresh) return
    if (t === 'live'     && live.length && !forceRefresh) return
    if (t === 'wins'     && wins.length && !forceRefresh) return
    if (t === 'users'    && users.length && !forceRefresh) return
    if (t === 'activity' && activity.length && !forceRefresh) return
    if (t === 'tickets'  && tickets.length && !forceRefresh) return
    if (t === 'ai'       && aiResolutions.length && !forceRefresh) return
    if (t === 'debug'    && debug && !forceRefresh) return

    forceRefresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      if (t === 'overview') setOverview(await adminFetch('/', c))
      if (t === 'live')     setLive(await adminFetch('/live', c))
      if (t === 'wins')     setWins(await adminFetch('/biggest-wins', c))
      if (t === 'users')    setUsers(await adminFetch('/users', c))
      if (t === 'activity') setActivity(await adminFetch('/activity', c))
      if (t === 'tickets')  setTickets(await adminFetch('/tickets', c))
      if (t === 'ai')       setAiResolutions((await adminFetch('/ai-resolutions', c)).predictions)
      if (t === 'debug')    setDebug(await adminFetch('/debug/pending', c))
    } catch (err: any) {
      if (err.message === 'bad_creds') { setCreds(null); sessionStorage.removeItem(ADMIN_KEY) }
      else setError(err.message)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [overview, live, wins, users, activity, tickets])

  async function resolveTicket(id: string, result: 'WON' | 'LOST' | 'VOID') {
    if (!creds) return
    setResolvingId(id)
    try {
      const res = await fetch(`${ADMIN_API}/api/x7k2-internal/tickets/${id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${btoa(creds)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ result }),
      })
      if (res.ok) setTickets(prev => prev.filter(t => t.id !== id))
    } finally {
      setResolvingId(null)
    }
  }

  async function resolveDebugTicket(id: string, result: 'WON' | 'LOST' | 'VOID') {
    if (!creds) return
    setResolvingId(id)
    try {
      const res = await fetch(`${ADMIN_API}/api/x7k2-internal/tickets/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Basic ${btoa(creds)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      })
      if (res.ok) setDebug(prev => prev ? { ...prev, total: prev.total - 1, predictions: prev.predictions.filter(p => p.id !== id) } : prev)
    } finally {
      setResolvingId(null)
    }
  }

  async function rebuildLegs(id: string) {
    if (!creds) return
    setRebuildingId(id)
    try {
      const res = await fetch(`${ADMIN_API}/api/x7k2-internal/debug/rebuild-legs/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${btoa(creds)}` },
      })
      const data = await res.json()
      if (res.ok) {
        setDebug(prev => prev ? {
          ...prev,
          predictions: prev.predictions.map(p =>
            p.id === id ? { ...p, has_legs: true, leg_count: data.legs?.length ?? 0, legs_with_fixture_id: (data.legs || []).filter((l: any) => l.fixture_id).length } : p
          ),
        } : prev)
      } else {
        alert(data.error || 'Failed to rebuild legs')
      }
    } finally {
      setRebuildingId(null)
    }
  }

  useEffect(() => {
    if (creds) load(creds, tab)
  }, [creds, tab])

  if (!creds) return <LoginGate onAuth={c => { setCreds(c); setTab('overview') }} />

  const o = overview

  const tabDefs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',  icon: <BarChart2 size={15} strokeWidth={1.5} /> },
    { id: 'live',      label: `Live${live.length ? ` (${live.length})` : ''}`, icon: <Zap size={15} strokeWidth={1.5} /> },
    { id: 'wins',      label: 'Big Wins',  icon: <Trophy size={15} strokeWidth={1.5} /> },
    { id: 'users',     label: 'Users',     icon: <Users size={15} strokeWidth={1.5} /> },
    { id: 'activity',  label: 'Activity',  icon: <Activity size={15} strokeWidth={1.5} /> },
    { id: 'tickets',   label: `Tickets${tickets.length ? ` (${tickets.length})` : ''}`,           icon: <Ticket size={15} strokeWidth={1.5} /> },
    { id: 'ai',        label: `AI${aiResolutions.length ? ` (${aiResolutions.length})` : ''}`,   icon: <Bot size={15} strokeWidth={1.5} /> },
    { id: 'debug',     label: `Debug${debug ? ` (${debug.total})` : ''}`,                         icon: <Wrench size={15} strokeWidth={1.5} /> },
  ]

  const filteredUsers = users.filter(u => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()))

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 0 80px' }}>

      {/* Header + tabs — sticky together so tabs never get covered */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 100,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 800, lineHeight: 1.2 }}>Control Panel</h1>
            {o && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Updated {timeAgo(o.generated_at)}</p>}
          </div>
          <button
            onClick={() => load(creds, tab, true)}
            disabled={refreshing}
            style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '7px 10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', color: 'var(--text-muted)',
            }}
          >
            <RefreshCw size={13} strokeWidth={1.5} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {tabDefs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flexShrink: 0, padding: '10px 16px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '13px', fontWeight: tab === t.id ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: '6px',
              position: 'relative', transition: 'color 0.15s', whiteSpace: 'nowrap',
            }}>
              {t.icon}{t.label}
              {tab === t.id && (
                <span style={{
                  position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '32px', height: '2px', borderRadius: '2px 2px 0 0',
                  background: 'var(--accent)',
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ padding: '16px', color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}

      {loading && (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!loading && tab === 'overview' && o && (
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Top stats */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Stat label="Total Users"    value={o.users.total}            sub={`+${o.users.new_7d} this week`}         icon={<Users size={14} />} />
            <Stat label="Total Picks"    value={o.predictions.total}      sub={`${o.predictions.pending} live now`}     icon={<BarChart2 size={14} />} />
            <Stat label="Win Rate"       value={o.predictions.overall_win_rate} sub={`${o.predictions.won} won of ${o.predictions.won + o.predictions.lost}`} icon={<Trophy size={14} />} color="var(--success)" />
            <Stat label="Pending"        value={o.predictions.pending}    sub="awaiting resolution"                     icon={<Clock size={14} />} color="var(--warning)" />
          </div>

          {/* Status breakdown */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>PREDICTION OUTCOMES</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['WON', 'LOST', 'VOID', 'PENDING'] as const).map(s => {
                const v = s === 'WON' ? o.predictions.won : s === 'LOST' ? o.predictions.lost : s === 'VOID' ? o.predictions.void : o.predictions.pending
                const total = o.predictions.total
                const pct = total > 0 ? Math.round((v / total) * 100) : 0
                return (
                  <div key={s} style={{
                    flex: 1, minWidth: '100px', padding: '12px 14px', borderRadius: '10px',
                    background: 'var(--surface-2)', border: `1px solid var(--border)`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', color: statusColor[s] }}>
                      {statusIcon[s]}
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>{s}</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800 }}>{v}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{pct}% of total</div>
                    {/* Mini bar */}
                    <div style={{ marginTop: '8px', height: '3px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: statusColor[s], borderRadius: '2px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Platform breakdown */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>PLATFORM USAGE</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(o.predictions.by_platform)
                .sort(([, a], [, b]) => b - a)
                .map(([platform, count]) => {
                  const pct = o.predictions.total > 0 ? Math.round((count / o.predictions.total) * 100) : 0
                  return (
                    <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '90px' }}>{platform}</span>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>{count} ({pct}%)</span>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Flagged users */}
          {o.flagged_users.count > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertTriangle size={15} strokeWidth={1.5} style={{ color: 'var(--warning)' }} />
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warning)' }}>FLAGGED — {o.flagged_users.count} users</h2>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{o.flagged_users.reason}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {o.flagged_users.users.map((u: any) => (
                  <div key={u.id} style={{
                    padding: '10px 14px', borderRadius: '8px', background: 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>{u.username}</span>
                    <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 700 }}>{u.win_rate} win rate</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.total_resolved} resolved</span>
                    <span style={{ fontSize: '12px', color: 'var(--accent-light)', fontWeight: 700 }}>{Math.max(0, u.credit_score).toFixed(1)} cr</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top users */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>TOP PREDICTORS</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {o.leaderboard.map((u: any, i: number) => (
                <div key={u.id} style={{
                  padding: '12px 14px', borderRadius: '8px', background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 700, minWidth: '20px' }}>#{i + 1}</span>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 800, color: '#fff',
                  }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{u.username}</span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {u.total_resolved} picks · {u.total_resolved > 0 ? Math.round((u.total_correct / u.total_resolved) * 100) : 0}% hit rate
                    </div>
                  </div>
                  {u.correct_streak > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Flame size={12} strokeWidth={1.5} />{u.correct_streak}
                    </span>
                  )}
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-light)' }}>
                    {Math.max(0, u.credit_score).toFixed(1)} cr
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* New users this week */}
          {o.users.recent.length > 0 && (
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>NEW THIS WEEK</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {o.users.recent.map((u: any) => (
                  <div key={u.id} style={{
                    padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#fff' }}>
                      {u.username[0].toUpperCase()}
                    </div>
                    {u.username}
                    <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>{timeAgo(u.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE ── */}
      {!loading && tab === 'live' && (
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{live.length} predictions live right now</span>
          </div>
          {live.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No pending predictions.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {live.map((p: any) => (
              <div key={p.id} style={{
                padding: '12px 14px', borderRadius: '8px', background: 'var(--surface-2)',
                display: 'flex', alignItems: 'flex-start', gap: '12px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{p.profiles?.username ?? '?'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(p.locked_at)}</span>
                    {(p.profiles?.correct_streak ?? 0) > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Flame size={10} strokeWidth={1.5} />{p.profiles.correct_streak}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>{p.title}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '1px 7px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>{p.platform}</span>
                    <span style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700 }}>×{p.odds}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>#{p.betslip_code}</span>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                  {p.profiles?.credit_score != null && <div>{fmt(Math.max(0, p.profiles.credit_score))} cr</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BIGGEST WINS ── */}
      {!loading && tab === 'wins' && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>All-time biggest winning predictions by odds.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wins.map((p: any, i: number) => (
              <div key={p.id} style={{
                padding: '14px 16px', borderRadius: '10px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                {/* Rank */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: i < 3 ? `linear-gradient(135deg, ${['#fbbf24','#94a3b8','#c97c3a'][i]}, ${['#fbbf24','#94a3b8','#c97c3a'][i]}88)` : 'var(--surface)',
                  border: i < 3 ? 'none' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: i < 3 ? '16px' : '13px', fontWeight: 800,
                  color: i < 3 ? '#000' : 'var(--text-muted)',
                }}>
                  {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{p.profiles?.username ?? '?'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '1px 7px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>{p.platform}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginLeft: 'auto' }}>{timeAgo(p.resolved_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--success)' }}>×{p.odds}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{p.betslip_code}</div>
                </div>
              </div>
            ))}
            {wins.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No wins yet.</p>}
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {!loading && tab === 'users' && (
        <div style={{ padding: '16px' }}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder={`Search ${users.length} users...`}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', boxSizing: 'border-box',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text)', fontSize: '13px', outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {filteredUsers.length} of {users.length} users · sorted by credit score
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {filteredUsers.map((u: any) => {
              const hitRate = u.total_resolved > 0 ? Math.round((u.total_correct / u.total_resolved) * 100) : 0
              const stateColor: Record<string, string> = {
                ACTIVE: 'var(--success)', PENDING: 'var(--warning)', DECAYING: 'var(--text-muted)', DORMANT: 'var(--danger)',
              }
              return (
                <div key={u.id} style={{
                  padding: '12px 14px', borderRadius: '8px', background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 800, color: '#fff',
                  }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>{u.username}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', fontWeight: 600, color: stateColor[u.user_state] ?? 'var(--text-muted)', border: `1px solid ${stateColor[u.user_state] ?? 'var(--border)'}44` }}>
                        {u.user_state}
                      </span>
                      {u.correct_streak > 2 && (
                        <span style={{ fontSize: '11px', color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Flame size={10} strokeWidth={1.5} />{u.correct_streak}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span>{u.total_resolved} picks · {hitRate}% hit</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><TrendingUp size={10} strokeWidth={1.5} />{u.visibility_score?.toFixed(1)} vis</span>
                      {u.last_resolved_at && <span>{timeAgo(u.last_resolved_at)}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: u.credit_score >= 0 ? 'var(--accent-light)' : 'var(--danger)' }}>
                      {u.credit_score.toFixed(1)} cr
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                      joined {new Date(u.created_at).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {!loading && tab === 'activity' && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Last 50 events across the platform.</p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activity.map((e: any, i: number) => (
              <div key={e.id + i} style={{
                display: 'flex', gap: '14px',
                paddingBottom: '16px',
                position: 'relative',
              }}>
                {/* Timeline line */}
                {i < activity.length - 1 && (
                  <div style={{
                    position: 'absolute', left: '15px', top: '28px', bottom: 0,
                    width: '1px', background: 'var(--border)',
                  }} />
                )}
                {/* Dot */}
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                  background: e.type === 'resolved'
                    ? (e.status === 'WON' ? 'rgba(16,185,129,0.15)' : e.status === 'LOST' ? 'rgba(239,68,68,0.15)' : 'var(--surface-2)')
                    : 'rgba(var(--accent-rgb),0.15)',
                  border: `1px solid ${e.type === 'resolved'
                    ? (e.status === 'WON' ? 'rgba(16,185,129,0.3)' : e.status === 'LOST' ? 'rgba(239,68,68,0.3)' : 'var(--border)')
                    : 'rgba(var(--accent-rgb),0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: e.type === 'resolved'
                    ? statusColor[e.status]
                    : 'var(--accent)',
                }}>
                  {e.type === 'resolved' ? statusIcon[e.status] : <Lock size={12} strokeWidth={2} />}
                </div>
                <div style={{ flex: 1, paddingTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{e.profiles?.username ?? '?'}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {e.type === 'posted' ? 'locked a pick' : `prediction ${e.status?.toLowerCase()}`}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginLeft: 'auto' }}>{timeAgo(e.at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>{e.title}</p>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '1px 7px', background: 'var(--surface-2)', borderRadius: '4px', border: '1px solid var(--border)' }}>{e.platform}</span>
                    <span style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700 }}>×{e.odds}</span>
                    {e.score_contribution != null && e.score_contribution !== 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: e.score_contribution > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {e.score_contribution > 0 ? '+' : ''}{e.score_contribution.toFixed(2)}pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {activity.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No activity yet.</p>}
          </div>
        </div>
      )}

      {/* ── DEBUG ── */}
      {!loading && tab === 'debug' && debug && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {debug.total} pending prediction{debug.total !== 1 ? 's' : ''}. Predictions without legs are invisible to the auto-resolver — use Rebuild to retry fixture lookup.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {debug.predictions.map((p: any) => {
              const eventPast = new Date(p.event_start_time) < new Date()
              const isRebuilding = rebuildingId === p.id
              return (
                <div key={p.id} style={{
                  padding: '14px 16px', borderRadius: '10px',
                  background: 'var(--surface-2)', border: `1px solid ${!p.has_legs ? 'rgba(239,68,68,0.3)' : p.legs_with_fixture_id < p.leg_count ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{p.user ?? '?'}</span>
                        <span style={{ fontSize: '11px', padding: '1px 7px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{p.platform}</span>
                        <span style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700 }}>×{p.odds}</span>
                        {eventPast && <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600 }}>event passed</span>}
                      </div>
                      <p style={{ fontSize: '13px', marginBottom: '6px', color: 'var(--text)' }}>{p.title}</p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span style={{ color: p.has_legs ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {p.has_legs ? `legs: ${p.legs_with_fixture_id}/${p.leg_count} matched` : 'no legs — resolver blind'}
                        </span>
                        <span>locked {timeAgo(p.locked_at)}</span>
                        <span>starts {new Date(p.event_start_time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {p.needs_review && <span style={{ color: 'var(--warning)', fontWeight: 600 }}>flagged for review</span>}
                      </div>
                    </div>
                    {!p.has_legs && (
                      <button
                        onClick={() => rebuildLegs(p.id)}
                        disabled={isRebuilding}
                        style={{
                          padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          color: 'var(--text)', cursor: isRebuilding ? 'default' : 'pointer',
                          opacity: isRebuilding ? 0.5 : 1, flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}
                      >
                        <Wrench size={12} strokeWidth={1.5} />
                        {isRebuilding ? 'Rebuilding...' : 'Rebuild'}
                      </button>
                    )}
                    {eventPast && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {(['WON', 'LOST', 'VOID'] as const).map(r => (
                          <button
                            key={r}
                            onClick={() => resolveDebugTicket(p.id, r)}
                            disabled={resolvingId === p.id}
                            style={{
                              padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                              cursor: resolvingId === p.id ? 'default' : 'pointer',
                              opacity: resolvingId === p.id ? 0.5 : 1,
                              background: r === 'WON' ? 'rgba(16,185,129,0.15)' : r === 'LOST' ? 'rgba(239,68,68,0.15)' : 'var(--surface)',
                              color: r === 'WON' ? 'var(--success)' : r === 'LOST' ? 'var(--danger)' : 'var(--text-muted)',
                              border: `1px solid ${r === 'WON' ? 'rgba(16,185,129,0.3)' : r === 'LOST' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                            }}
                          >
                            {resolvingId === p.id ? '...' : r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {debug.total === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                <CheckCircle size={32} strokeWidth={1.5} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p>No pending predictions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI RESOLUTIONS ── */}
      {!loading && tab === 'ai' && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            All predictions resolved automatically — by match-score lookup (Auto) or AI web search (AI). Last 100 shown.
          </p>
          {aiResolutions.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              <Bot size={32} strokeWidth={1.5} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p>No AI resolutions yet.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {aiResolutions.map((p: any) => (
              <div key={p.id} style={{
                padding: '16px', borderRadius: '12px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: p.resolution_note ? '12px' : 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: p.status === 'WON' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${p.status === 'WON' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: p.status === 'WON' ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {p.status === 'WON' ? <CheckCircle size={14} strokeWidth={2} /> : <XCircle size={14} strokeWidth={2} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: p.status === 'WON' ? 'var(--success)' : 'var(--danger)' }}>{p.status}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '1px 7px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>{p.platform}</span>
                      <span style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700 }}>×{p.odds}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: p.resolution_source === 'ai' ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.1)',
                        color: p.resolution_source === 'ai' ? '#a78bfa' : 'var(--text-muted)',
                        border: `1px solid ${p.resolution_source === 'ai' ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
                      }}>{p.resolution_source === 'ai' ? 'AI' : 'Auto'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginLeft: 'auto' }}>{p.resolved_at ? timeAgo(p.resolved_at) : ''}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>{p.title}</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>#{p.betslip_code}</span>
                  </div>
                </div>
                {p.resolution_note && (
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', color: 'var(--accent)' }}>
                      <Bot size={12} strokeWidth={1.5} />
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.resolution_source === 'ai' ? 'AI Reasoning' : 'Resolution Note'}</span>
                    </div>
                    {p.resolution_note.split(' | ').map((line: string, i: number) => (
                      <p key={i} style={{ margin: '0 0 4px' }}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TICKETS ── */}
      {!loading && tab === 'tickets' && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Predictions the resolver could not automatically settle. Verify the result manually then apply WON / LOST / VOID.
          </p>
          {tickets.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              <CheckCircle size={32} strokeWidth={1.5} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p>No open tickets — everything resolved automatically.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tickets.map((p: any) => {
              const legs = (p.legs || []) as any[]
              const unresolved = legs.filter((l: any) => !l.fixture_id)
              const isBusy = resolvingId === p.id
              return (
                <div key={p.id} style={{
                  padding: '16px', borderRadius: '12px',
                  background: 'var(--surface-2)', border: '1px solid rgba(245,158,11,0.3)',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <AlertTriangle size={15} strokeWidth={1.5} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{p.profiles?.username ?? '?'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '1px 7px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>{p.platform}</span>
                        <span style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700 }}>×{p.odds}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginLeft: 'auto' }}>
                          started {timeAgo(p.event_start_time)}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>{p.title}</p>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                        #{p.betslip_code}
                        {p.betslip_link && (
                          <a href={p.betslip_link} target="_blank" rel="noreferrer"
                            style={{ marginLeft: '8px', color: 'var(--accent)', textDecoration: 'none' }}>
                            View slip
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unresolved legs */}
                  {unresolved.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--warning)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {unresolved.length} leg{unresolved.length > 1 ? 's' : ''} not found in any API
                      </p>
                      {unresolved.map((l: any, i: number) => (
                        <div key={i} style={{
                          fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          marginBottom: '4px', color: 'var(--text-muted)',
                        }}>
                          {l.home_team} vs {l.away_team}
                          {l.market_type && <span style={{ marginLeft: '8px', color: 'var(--text-subtle)' }}>{l.market_type} · {l.market_value}</span>}
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-subtle)' }}>{l.tournament}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review note */}
                  {p.review_note && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>{p.review_note}</p>
                  )}

                  {/* Resolve buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['WON', 'LOST', 'VOID'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => resolveTicket(p.id, r)}
                        disabled={isBusy}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px',
                          fontSize: '12px', fontWeight: 700, cursor: isBusy ? 'default' : 'pointer',
                          opacity: isBusy ? 0.5 : 1,
                          background: r === 'WON' ? 'rgba(16,185,129,0.15)' : r === 'LOST' ? 'rgba(239,68,68,0.15)' : 'var(--surface)',
                          color: r === 'WON' ? 'var(--success)' : r === 'LOST' ? 'var(--danger)' : 'var(--text-muted)',
                          border: `1px solid ${r === 'WON' ? 'rgba(16,185,129,0.3)' : r === 'LOST' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                        }}
                      >
                        {isBusy ? '...' : r}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
