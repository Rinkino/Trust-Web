import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { LogOut, LayoutDashboard } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function DragonLogo({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 260 260" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M199.02,231.09c-13.25-57.48-90.49-86.23-108.58-107.12c-9.3-10.74-6.97-22.15-1.16-28.29c6.24-6.58,18.13-7.88,27-2.09c7.76,5.05,22.86,19.06,26.25,24.23c3.39,5.16,3.35,9.43,5.17,12.9c2.07,3.9,6.75,5.98,13.53,3.95c6.28-1.87,9.75-4.35,9.75-4.35s-6.56-0.25-9.16-3.94c0,0-9.1-19.95-12.36-28.11c10.43,2.77,17.05,5.97,21.68,8.89c0.57,4.44-1.32,12.09-1.4,12.43c0.21-0.12,3.58-2.11,8.59-7.1c0.25,0.21,0.5,0.41,0.74,0.6c1.77,1.41-1.49,12.56-1.49,12.56s6.12-4.11,10.8-9.67c4.05-4.79,7.46-10.87,7.46-10.87s-13.25-5.6-19.36-15.3c-6.13-9.69-0.79-20.21-0.79-20.21s-10.22-3.28-18.78-15.62c-9-12.98-5.52-28.93-5.52-28.93c-7.32,2.94-13.74,17.5-13.74,17.5s-18.49-9.87-42.51-6.8C73.47,35.69,53.33,22.55,44.97,1.8c0,0-6.47,28.39,18.04,46.26c-1.33,0.9-2.66,1.85-3.99,2.87c-11.96,6.81-27.15,6.41-38.85-1.79c0,0,0.62,4.26,2.9,9.38c2.28,5.11,6.21,11.09,12.84,14.53c0.71,0.37,1.41,0.67,2.1,0.93c-1.38,2.2-2.66,4.48-3.81,6.82C27.67,91.76,14.56,97.3,2,94.02c0,0,6.59,12.03,18.41,13.5c2.73,0.34,5.11-0.07,7.15-0.88c-0.1,4.98,0.15,9.64,0.71,14.06c-0.3,9.68-6.83,18.27-16.35,20.99h-0.01c0,0,9.18,5.46,17.68,1.78c1.66-0.72,2.94-1.7,3.93-2.79c6.98,16.86,19.64,30.46,35.78,45.97c4.33,4.17,9.19,8.63,14.12,13.28c48.5,2.8,85.22,24.51,116.32,57.87C200.72,250.56,201.44,241.58,199.02,231.09z" />
      <path d="M147.91,70.11l13.72,13.65l-21.9-7.9L147.91,70.11z" />
      <path d="M181.003,133.297c0,0,6.706,6.836,16.005,8.195c-0.628,3.718-1.577,5.572-1.577,5.572s15.96,12.85,35.508,4.572c-0.902,10.276-13.643,14.81-13.643,14.81S230.983,183.407,258,173c-14.657,19.075-36.539,13.759-49.848,6.944C196.19,173.819,180.788,155.727,181.003,133.297z" />
    </svg>
  )
}

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
          {/* Dragon logo mark */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(var(--accent-rgb),0.4)',
            transition: 'box-shadow 0.3s',
          }}>
            <DragonLogo size={18} color="#fff" />
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
