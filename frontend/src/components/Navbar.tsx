import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { LogOut, LayoutDashboard } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Props = { user: { id: string; email?: string } | null; username?: string | null }

export default function Navbar({ user, username }: Props) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { theme, setTheme, themes } = useTheme()
  const [showThemes, setShowThemes] = useState(false)
  const [showMenu, setShowMenu]     = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setShowThemes(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hideOn = ['/login', '/register', '/x7k2-admin']
  if (hideOn.includes(location.pathname)) return null

  async function handleSignOut() {
    await supabase.auth.signOut()
    setShowMenu(false)
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(20px)',
      backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)',
    }}>
      <div style={{
        maxWidth: '1160px', margin: '0 auto',
        padding: '0 48px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '24px',
      }}>

        {/* Wordmark */}
        <Link
          to="/home"
          style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {/* Animated logo mark */}
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(var(--accent-rgb),0.4)',
            transition: 'box-shadow 0.3s',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', transition: 'color 0.15s' }}>
            Trust<span className="animate-gradient-text" style={{ fontWeight: 800 }}>Web</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
          {[
            { to: '/home',        label: 'Feed' },
            { to: '/leaderboard', label: 'Leaderboard' },
          ].map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                padding: '6px 14px', borderRadius: '6px',
                fontSize: '13px', fontWeight: isActive(link.to) ? 600 : 400,
                color: isActive(link.to) ? 'var(--text)' : 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
                background: isActive(link.to) ? 'var(--surface-2)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isActive(link.to)) {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.background = 'var(--surface)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive(link.to)) {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right controls */}
        <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

          {/* Theme dot */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowThemes(v => !v); setShowMenu(false) }}
              style={{
                width: '32px', height: '32px', borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: themes.find(t => t.id === theme)?.color,
              }} />
            </button>

            {showThemes && (
              <div className="animate-fade-in" style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '4px', minWidth: '140px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 300,
              }}>
                {themes.map(t => (
                  <button key={t.id} onClick={() => { setTheme(t.id); setShowThemes(false) }} style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: theme === t.id ? 'var(--surface-2)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: theme === t.id ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: '13px', fontWeight: theme === t.id ? 600 : 400,
                    transition: 'background 0.15s',
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowMenu(v => !v); setShowThemes(false) }}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'var(--accent)',
                  border: showMenu ? '2px solid var(--accent-light)' : '2px solid transparent',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'border-color 0.15s',
                }}
              >
                {(username ?? user.email ?? '?')[0].toUpperCase()}
              </button>

              {showMenu && (
                <div className="animate-fade-in" style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '4px', minWidth: '160px',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 300,
                }}>
                  {username && (
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>@{username}</p>
                    </div>
                  )}
                  <Link
                    to="/dashboard"
                    onClick={() => setShowMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '6px',
                      color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LayoutDashboard size={14} strokeWidth={1.5} />
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '6px',
                      color: 'var(--danger)', fontSize: '13px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      transition: 'background 0.15s', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} strokeWidth={1.5} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" style={{
              padding: '7px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              background: 'var(--accent)', color: '#fff', textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
