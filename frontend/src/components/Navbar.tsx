import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { Shield, Palette, LogOut, LayoutDashboard } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Props = { user: { id: string; email?: string } | null }

export default function Navbar({ user }: Props) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { theme, setTheme, themes } = useTheme()
  const [showThemes, setShowThemes] = useState(false)
  const [showMenu, setShowMenu]     = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
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

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(20px)',
      backgroundColor: 'color-mix(in srgb, var(--bg) 88%, transparent)',
    }}>
      <div style={{
        maxWidth: '600px', margin: '0 auto',
        padding: '0 16px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px',
      }}>
        <Link to="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px var(--accent-glow)',
          }}>
            <Shield size={14} strokeWidth={2} color="#fff" />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Trust<span style={{ color: 'var(--accent)' }}>Web</span>
          </span>
        </Link>

        <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Theme switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowThemes(v => !v); setShowMenu(false) }}
              className="btn-ghost"
              style={{ padding: '8px 10px', gap: '6px', display: 'flex', alignItems: 'center' }}
            >
              <Palette size={15} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: themes.find(t => t.id === theme)?.color,
                boxShadow: `0 0 6px ${themes.find(t => t.id === theme)?.color}`,
              }} />
            </button>
            {showThemes && (
              <div className="animate-fade-in" style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '6px', minWidth: '150px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 300,
              }}>
                {themes.map(t => (
                  <button key={t.id} onClick={() => { setTheme(t.id); setShowThemes(false) }} style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: theme === t.id ? 'var(--surface-2)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: theme === t.id ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: '13px', fontWeight: theme === t.id ? 600 : 400,
                    transition: 'background 0.15s',
                  }}>
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

          {/* User avatar / sign in */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowMenu(v => !v); setShowThemes(false) }}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                  border: showMenu ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'border-color 0.15s',
                }}
              >
                {(user.email ?? '?')[0].toUpperCase()}
              </button>
              {showMenu && (
                <div className="animate-fade-in" style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '6px', minWidth: '160px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 300,
                }}>
                  <Link
                    to="/dashboard"
                    onClick={() => setShowMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px',
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
                      padding: '8px 12px', borderRadius: '8px',
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
              padding: '7px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
              background: 'var(--accent)', color: '#fff', textDecoration: 'none',
            }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
