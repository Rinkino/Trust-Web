import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { api } from '../lib/api'
import {
  Shield, Menu, X, BarChart2, LayoutDashboard,
  Palette, LogOut, Search, User, Flame, ChevronRight,
} from 'lucide-react'

type Props = { user: { id: string; email?: string } | null }

type Profile = {
  username: string
  credit_score: number
  correct_streak: number
  user_state: string
}

export default function Navbar({ user }: Props) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { theme, setTheme, themes } = useTheme()

  const [open, setOpen]           = useState(false)
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [search, setSearch]       = useState('')
  const [showThemes, setShowThemes] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Fetch own profile when user logs in
  useEffect(() => {
    if (!user) { setProfile(null); return }
    api.getMe().then(data => setProfile(data)).catch(() => {})
  }, [user?.id])

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Trap focus / close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/login')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    navigate(`/u/${q}`)
    setSearch('')
    setOpen(false)
  }

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)',
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          padding: '0 16px', height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              borderRadius: '9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px var(--accent-glow)',
            }}>
              <Shield size={16} strokeWidth={2} color="#fff" />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
              Trust<span style={{ color: 'var(--accent)' }}>Web</span>
            </span>
          </Link>

          {/* Hamburger */}
          <button
            onClick={() => setOpen(v => !v)}
            className="btn-ghost"
            style={{ padding: '8px', borderRadius: '10px' }}
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>
        </div>
      </nav>

      {/* ── Backdrop ─────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.15s ease',
          }}
        />
      )}

      {/* ── Drawer ───────────────────────────────────────────────── */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(320px, 88vw)',
        zIndex: 400,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Menu</span>
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost"
            style={{ padding: '6px', borderRadius: '8px' }}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Profile section */}
        {user && profile ? (
          <Link
            to={`/u/${profile.username}`}
            style={{
              margin: '12px 16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: 800, color: '#fff',
            }}>
              {profile.username[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
                @{profile.username}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>{Math.max(0, profile.credit_score).toFixed(1)} cr</span>
                {profile.correct_streak > 0 && (
                  <span style={{ color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Flame size={11} strokeWidth={1.5} />
                    {profile.correct_streak}d streak
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </Link>
        ) : user ? (
          <div style={{ margin: '12px 16px', padding: '14px 16px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ width: '80px', height: '14px', borderRadius: '6px', background: 'var(--border)', marginBottom: '6px' }} />
            <div style={{ width: '50px', height: '11px', borderRadius: '4px', background: 'var(--border)' }} />
          </div>
        ) : null}

        {/* User search */}
        <div style={{ padding: '8px 16px' }}>
          <form onSubmit={handleSearch} style={{ position: 'relative' }}>
            <Search size={15} strokeWidth={1.5} style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text)', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </form>
        </div>

        {/* Nav links */}
        <div style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <DrawerLink to="/feed" active={location.pathname === '/feed'} icon={<BarChart2 size={17} strokeWidth={1.5} />}>
            Feed
          </DrawerLink>
          {user && (
            <DrawerLink to="/dashboard" active={location.pathname === '/dashboard'} icon={<LayoutDashboard size={17} strokeWidth={1.5} />}>
              Dashboard
            </DrawerLink>
          )}
          {!user && (
            <DrawerLink to="/login" active={location.pathname === '/login'} icon={<User size={17} strokeWidth={1.5} />}>
              Sign In
            </DrawerLink>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Theme picker */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowThemes(v => !v)}
            style={{
              width: '100%', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '10px', color: 'var(--text-muted)', fontSize: '13px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Palette size={17} strokeWidth={1.5} />
            <span style={{ flex: 1, textAlign: 'left' }}>Theme</span>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: themes.find(t => t.id === theme)?.color,
              boxShadow: `0 0 6px ${themes.find(t => t.id === theme)?.color}`,
            }} />
          </button>

          {showThemes && (
            <div style={{ paddingLeft: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setShowThemes(false) }}
                  style={{
                    padding: '8px 12px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: theme === t.id ? 'var(--surface-2)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: theme === t.id ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: '13px', fontWeight: theme === t.id ? 600 : 400,
                    width: '100%', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: t.color,
                    boxShadow: theme === t.id ? `0 0 6px ${t.color}` : 'none',
                  }} />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sign out */}
        {user && (
          <div style={{ padding: '0 16px 20px' }}>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderRadius: '10px', color: 'var(--danger)', fontSize: '13px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--danger-rgb,239,68,68), 0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={17} strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

function DrawerLink({
  to, children, active, icon,
}: {
  to: string; children: React.ReactNode; active: boolean; icon?: React.ReactNode
}) {
  return (
    <Link
      to={to}
      style={{
        padding: '10px 14px', borderRadius: '10px',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontSize: '14px', fontWeight: active ? 600 : 400,
        textDecoration: 'none',
        background: active ? 'var(--surface-2)' : 'transparent',
        transition: 'background 0.15s, color 0.15s',
        display: 'flex', alignItems: 'center', gap: '10px',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      {icon && <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>}
      {children}
    </Link>
  )
}
