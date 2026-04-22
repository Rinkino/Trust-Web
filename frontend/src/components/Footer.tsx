import { Link } from 'react-router-dom'
import { GitBranch, AtSign, Mail } from 'lucide-react'
import TrustWebBadge from './TrustWebBadge'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '48px 24px 32px',
      marginTop: 'auto',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <TrustWebBadge size={32} animate />
              <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em' }}>
                Trust<span style={{ color: 'var(--accent)' }}>Web</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '200px' }}>
              Credibility you actually earn. Built for predictors who are willing to be held accountable.
            </p>
          </div>

          {/* Product */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              Product
            </p>
            {[
              { label: 'Feed', to: '/feed' },
              { label: 'Leaderboard', to: '/feed' },
              { label: 'How it works', to: '/#how-it-works' },
              { label: 'Get Started', to: '/login' },
            ].map(l => (
              <Link key={l.label} to={l.to} style={{
                display: 'block', fontSize: '13px', color: 'var(--text-muted)',
                textDecoration: 'none', marginBottom: '10px',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Company */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              Company
            </p>
            {[
              { label: 'About', to: '/#about' },
              { label: 'Contact', to: '/#contact' },
            ].map(l => (
              <a key={l.label} href={l.to} style={{
                display: 'block', fontSize: '13px', color: 'var(--text-muted)',
                textDecoration: 'none', marginBottom: '10px',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Social */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              Connect
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { icon: <GitBranch size={16} strokeWidth={1.5} />, href: 'https://github.com/Rinkino/Trust-Web' },
                { icon: <AtSign size={16} strokeWidth={1.5} />, href: '#' },
                { icon: <Mail size={16} strokeWidth={1.5} />, href: '#contact' },
              ].map((s, i) => (
                <a key={i} href={s.href} target={s.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', textDecoration: 'none',
                  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.color = 'var(--accent-light)'
                    e.currentTarget.style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: '24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '12px',
          fontSize: '12px', color: 'var(--text-muted)',
        }}>
          <span>© {new Date().getFullYear()} TrustWeb. All rights reserved.</span>
          <span style={{ color: 'var(--text-subtle)' }}>
            Built for predictors who put their name on it.
          </span>
        </div>
      </div>
    </footer>
  )
}
