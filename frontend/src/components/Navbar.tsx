import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { Shield, Palette } from 'lucide-react'
import { useState } from 'react'

// Minimal top bar — just logo + theme switcher
export default function Navbar() {
  const location = useLocation()
  const { theme, setTheme, themes } = useTheme()
  const [showThemes, setShowThemes] = useState(false)

  // Hide the top bar on pages that have their own header
  const hideOn = ['/login', '/register']
  if (hideOn.includes(location.pathname)) return null

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

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowThemes(v => !v)}
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
      </div>
    </nav>
  )
}
