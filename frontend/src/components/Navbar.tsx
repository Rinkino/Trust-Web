import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { BarChart2, LayoutDashboard, Palette, Shield } from 'lucide-react'

type Props = { user: { id: string; email?: string } | null }

export default function Navbar({ user }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme, themes } = useTheme()
  const [showThemes, setShowThemes] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(20px)',
      backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)',
    }}>
      <div style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: '0 24px', height: '60px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {user && (
            <>
              <NavLink
                to="/feed"
                active={location.pathname === '/feed'}
                icon={<BarChart2 size={14} strokeWidth={1.5} />}
              >
                Feed
              </NavLink>
              <NavLink
                to="/dashboard"
                active={location.pathname === '/dashboard'}
                icon={<LayoutDashboard size={14} strokeWidth={1.5} />}
              >
                Dashboard
              </NavLink>
            </>
          )}

          {/* Theme switcher */}
          <div style={{ position: 'relative', marginLeft: '4px' }}>
            <button
              onClick={() => setShowThemes(v => !v)}
              className="btn-ghost"
              style={{ padding: '8px 10px', gap: '6px', display: 'flex', alignItems: 'center' }}
              title="Switch theme"
            >
              <Palette size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: themes.find(t => t.id === theme)?.color,
                boxShadow: `0 0 6px ${themes.find(t => t.id === theme)?.color}`,
              }} />
            </button>

            {showThemes && (
              <div
                className="animate-fade-in"
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '6px', minWidth: '150px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                  zIndex: 300,
                }}
              >
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setShowThemes(false) }}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: theme === t.id ? 'var(--surface-2)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: theme === t.id ? 'var(--text)' : 'var(--text-muted)',
                      fontSize: '13px', fontWeight: theme === t.id ? 600 : 400,
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

          {user ? (
            <button onClick={handleSignOut} className="btn-ghost" style={{ marginLeft: '4px' }}>
              Sign out
            </button>
          ) : (
            <Link to="/login" className="btn-accent" style={{ marginLeft: '8px' }}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function NavLink({
  to,
  children,
  active,
  icon,
}: {
  to: string
  children: React.ReactNode
  active: boolean
  icon?: React.ReactNode
}) {
  return (
    <Link
      to={to}
      style={{
        padding: '7px 14px', borderRadius: '8px',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontSize: '13px', fontWeight: active ? 600 : 400,
        textDecoration: 'none',
        background: active ? 'var(--surface-2)' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
        display: 'flex', alignItems: 'center', gap: '6px',
        position: 'relative',
      }}
    >
      {icon && <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>}
      {children}
      {active && (
        <span style={{
          position: 'absolute', bottom: '-1px', left: '50%',
          transform: 'translateX(-50%)',
          width: '20px', height: '2px',
          background: 'var(--accent)',
          borderRadius: '1px',
        }} />
      )}
    </Link>
  )
}
