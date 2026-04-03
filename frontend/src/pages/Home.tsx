import { Link } from 'react-router-dom'
import { Lock, TrendingUp, Flame, Award, ShieldCheck, ChevronRight, Zap } from 'lucide-react'
import Aurora from '../components/Aurora'

const mockCards = [
  {
    id: '1',
    user: 'cryptoedge',
    credit: 87.3,
    streak: 12,
    title: 'BTC/USD closes above $72k on Friday — 3-leg parlay locked',
    platform: 'Polymarket',
    odds: 2.85,
    status: 'WON' as const,
    locked: '2 hours ago',
    pts: '+4.21',
  },
  {
    id: '2',
    user: 'sharpbets_io',
    credit: 61.9,
    streak: 5,
    title: 'Man City win vs Arsenal + BTTS — double locked pre-kickoff',
    platform: 'Betfair',
    odds: 3.40,
    status: 'PENDING' as const,
    locked: '4 hours ago',
    pts: null,
  },
  {
    id: '3',
    user: 'quant_calls',
    credit: 112.5,
    streak: 19,
    title: 'Fed holds rates + SPY stays above 520 EOD — 2 leg accum',
    platform: 'Kalshi',
    odds: 1.92,
    status: 'WON' as const,
    locked: '1 day ago',
    pts: '+2.88',
  },
]

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  WON:     { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', label: 'WON' },
  PENDING: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', label: 'PENDING' },
  LOST:    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'LOST' },
}

export default function Home() {
  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <Aurora />

      {/* Content above aurora */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Hero */}
        <div style={{
          maxWidth: '900px', margin: '0 auto',
          padding: '90px 24px 80px', textAlign: 'center',
        }}>

          {/* Badge */}
          <div className="animate-fade-in-up" style={{ marginBottom: '24px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 16px', borderRadius: '20px',
              background: 'rgba(var(--accent-rgb), 0.1)',
              border: '1px solid rgba(var(--accent-rgb), 0.35)',
              fontSize: '12px', fontWeight: 700, color: 'var(--accent-light)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <Zap size={12} strokeWidth={2} />
              Trust the math, not the hype
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up delay-1" style={{
            fontSize: 'clamp(40px, 8vw, 72px)',
            fontWeight: 900, lineHeight: 1.03,
            letterSpacing: '-0.04em', marginBottom: '24px',
          }}>
            Credibility you<br />
            <span className="gradient-text">actually earn</span>
          </h1>

          <p className="animate-fade-in-up delay-2" style={{
            fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1.75,
            maxWidth: '540px', margin: '0 auto 44px',
          }}>
            Lock predictions before events start. Build a trust score based on
            accuracy, consistency, and real value — not followers.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-up delay-3" style={{
            display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Link to="/login" className="btn-accent" style={{
              fontSize: '15px', padding: '14px 36px', gap: '8px',
              boxShadow: '0 0 32px var(--accent-glow)',
            }}>
              Start Building Trust
              <ChevronRight size={16} strokeWidth={2} />
            </Link>
            <Link to="/feed" className="btn-ghost" style={{ fontSize: '15px', padding: '14px 32px', gap: '8px' }}>
              Explore Feed
              <ChevronRight size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px 56px' }}>
          <div style={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px',
          }}>
            {[
              { icon: <Lock size={16} strokeWidth={1.5} />, label: '10k+ Predictions Locked' },
              { icon: <ShieldCheck size={16} strokeWidth={1.5} />, label: '99.8% Verifiable' },
              { icon: <Flame size={16} strokeWidth={1.5} />, label: 'Top streak: 47 days' },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`animate-fade-in-up delay-${i + 1}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', borderRadius: '40px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)',
                }}
              >
                <span style={{ color: 'var(--accent-light)' }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Live preview cards */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#10b981', display: 'inline-block',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }} />
              Live Predictions
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '16px',
          }}>
            {mockCards.map((card, i) => {
              const st = statusStyles[card.status]
              return (
                <div
                  key={card.id}
                  className={`glass-glow animate-fade-in-up delay-${i + 1}`}
                  style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}
                >
                  {/* User row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 800, color: '#fff',
                      }}>
                        {card.user[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--accent-light)', fontSize: '13px' }}>
                        @{card.user}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>{card.credit.toFixed(1)} cr</span>
                      {card.streak > 0 && (
                        <span style={{ color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Flame size={11} strokeWidth={1.5} />
                          {card.streak}d
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <p style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.45, color: 'var(--text)', margin: 0 }}>
                    {card.title}
                  </p>

                  {/* Meta */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '6px',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
                    }}>
                      {card.platform}
                    </span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '6px',
                      background: 'rgba(var(--accent-rgb), 0.1)',
                      border: '1px solid rgba(var(--accent-rgb), 0.25)',
                      fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700,
                    }}>
                      ×{card.odds}
                    </span>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', color: 'var(--text-muted)',
                    }}>
                      <Lock size={10} strokeWidth={1.5} />
                      {card.locked}
                    </span>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '20px',
                      background: st.bg,
                      border: `1px solid ${st.color}44`,
                      fontSize: '11px', fontWeight: 700, color: st.color,
                      letterSpacing: '0.05em',
                    }}>
                      {card.status === 'WON' && <Award size={11} strokeWidth={2} />}
                      {card.status === 'PENDING' && <Lock size={11} strokeWidth={2} />}
                      {card.status}
                    </span>
                    {card.pts && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                        {card.pts} pts
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* How it works */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 80px' }}>
          <h2 style={{
            textAlign: 'center', fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: '40px',
          }}>
            How it works
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              {
                step: '01', icon: <Lock size={20} strokeWidth={1.5} />,
                title: 'Lock before it starts',
                desc: 'Submit your prediction with a betslip code. The system verifies the event hasn\'t started and locks it immutably.',
              },
              {
                step: '02', icon: <TrendingUp size={20} strokeWidth={1.5} />,
                title: 'Math does the scoring',
                desc: 'Correct calls earn points scaled by odds and streak. Wrong calls cost more the more credible you are.',
              },
              {
                step: '03', icon: <Flame size={20} strokeWidth={1.5} />,
                title: 'Streaks earn visibility',
                desc: 'Consecutive correct windows put you in trending. Consistency beats lucky one-off calls.',
              },
              {
                step: '04', icon: <Award size={20} strokeWidth={1.5} />,
                title: 'Trust is permanent',
                desc: 'Your credit score is your track record. It decays with inactivity — you can\'t rest on old glory.',
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className={`glass-glow animate-fade-in-up delay-${i + 1}`}
                style={{ padding: '24px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'rgba(var(--accent-rgb), 0.12)',
                    border: '1px solid rgba(var(--accent-rgb), 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-light)',
                  }}>
                    {item.icon}
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 800, color: 'var(--text-subtle)',
                    letterSpacing: '0.06em',
                  }}>
                    {item.step}
                  </span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 100px' }}>
          <div
            className="glass-glow animate-fade-in-up animate-border-glow"
            style={{
              padding: '56px 48px', textAlign: 'center',
              borderColor: 'rgba(var(--accent-rgb), 0.4)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 100%, var(--accent-glow), transparent 70%)',
            }} />
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={36} strokeWidth={1.5} style={{ color: 'var(--accent-light)', marginBottom: '16px' }} />
              <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
                Ready to prove your edge?
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.7 }}>
                Every prediction is timestamped. Every call is on record. The math decides who's credible.
              </p>
              <Link to="/login" className="btn-accent" style={{
                fontSize: '15px', padding: '14px 40px', gap: '8px',
                boxShadow: '0 0 32px var(--accent-glow)',
              }}>
                Get Started Free
                <ChevronRight size={16} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
