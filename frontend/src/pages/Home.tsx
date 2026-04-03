import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Lock, TrendingUp, Flame, Award, ShieldCheck,
  ChevronRight, Zap, Target, Eye, Users, MessageSquare,
  CheckCircle, ArrowRight, BarChart2, Globe,
} from 'lucide-react'
import Aurora from '../components/Aurora'
import { useScrollReveal } from '../lib/useScrollReveal'

const mockCards = [
  {
    id: '1', user: 'cryptoedge', credit: 87.3, streak: 12,
    title: 'BTC/USD closes above $72k on Friday — 3-leg parlay locked',
    platform: 'Polymarket', odds: 2.85, status: 'WON' as const, locked: '2 hours ago', pts: '+4.21',
  },
  {
    id: '2', user: 'sharpbets_io', credit: 61.9, streak: 5,
    title: 'Man City win vs Arsenal + BTTS — double locked pre-kickoff',
    platform: 'Betfair', odds: 3.40, status: 'PENDING' as const, locked: '4 hours ago', pts: null,
  },
  {
    id: '3', user: 'quant_calls', credit: 112.5, streak: 19,
    title: 'Fed holds rates + SPY stays above 520 EOD — 2 leg accum',
    platform: 'Kalshi', odds: 1.92, status: 'WON' as const, locked: '1 day ago', pts: '+2.88',
  },
]

const statusStyles: Record<string, { bg: string; color: string }> = {
  WON:     { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  PENDING: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  LOST:    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  const ref = useScrollReveal()
  return (
    <div id={id} ref={ref} style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 100px' }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: 700, color: 'var(--accent-light)',
      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <span style={{ display: 'inline-block', width: '20px', height: '1px', background: 'var(--accent)' }} />
      {children}
    </p>
  )
}

export default function Home() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState('')

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactError('Please fill in all fields')
      return
    }
    // Opens default mail client with prefilled message
    const subject = encodeURIComponent(`TrustWeb contact from ${contactForm.name}`)
    const body = encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\n${contactForm.message}`)
    window.location.href = `mailto:hello@trustweb.app?subject=${subject}&body=${body}`
    setContactSent(true)
    setContactError('')
  }

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <Aurora />
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>

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

          <div className="animate-fade-in-up delay-3" style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/login" className="btn-accent" style={{
              fontSize: '15px', padding: '14px 36px', gap: '8px',
              boxShadow: '0 0 32px var(--accent-glow)',
            }}>
              Start Building Trust
              <ChevronRight size={16} strokeWidth={2} />
            </Link>
            <a href="#about" className="btn-ghost" style={{ fontSize: '15px', padding: '14px 32px', gap: '8px' }}>
              Learn More
              <ChevronRight size={16} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px 64px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {[
              { icon: <Lock size={15} strokeWidth={1.5} />,       label: '10k+ Predictions Locked' },
              { icon: <ShieldCheck size={15} strokeWidth={1.5} />, label: '99.8% Verifiable' },
              { icon: <Flame size={15} strokeWidth={1.5} />,       label: 'Top streak: 47 days' },
              { icon: <Globe size={15} strokeWidth={1.5} />,       label: '30+ Platforms Supported' },
            ].map((item, i) => (
              <div key={item.label} className={`animate-fade-in-up delay-${i + 1}`} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '40px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)',
              }}>
                <span style={{ color: 'var(--accent-light)' }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Live preview ── */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 100px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', background: '#10b981',
                display: 'inline-block', animation: 'pulse-glow 2s ease-in-out infinite',
              }} />
              Live Feed Preview
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '16px' }}>
            {mockCards.map((card, i) => {
              const st = statusStyles[card.status]
              return (
                <div key={card.id} className={`glass-glow animate-fade-in-up delay-${i + 1}`}
                  style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', alignItems: 'center' }}>
                      <span>{card.credit.toFixed(1)} cr</span>
                      {card.streak > 0 && (
                        <span style={{ color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Flame size={11} strokeWidth={1.5} />
                          {card.streak}d
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.45, color: 'var(--text)' }}>{card.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '11px',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', fontWeight: 500,
                      }}>{card.platform}</span>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '11px',
                        background: 'rgba(var(--accent-rgb), 0.1)',
                        border: '1px solid rgba(var(--accent-rgb), 0.25)',
                        color: 'var(--accent-light)', fontWeight: 700,
                      }}>×{card.odds}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {card.pts && <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>{card.pts} pts</span>}
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: st.bg, color: st.color,
                        border: `1px solid ${st.color}33`,
                      }}>{card.status}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── How it works ── */}
        <Section id="how-it-works">
          <SectionLabel>How it works</SectionLabel>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '16px' }}>
            The system that can't be gamed
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '560px', marginBottom: '48px' }}>
            Every mechanism is designed to surface genuine skill over time. There are no shortcuts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { icon: <Lock size={22} strokeWidth={1.5} />, step: '01', title: 'Lock before it starts', desc: 'Submit with a betslip code. System verifies the event hasn\'t started and seals the prediction immutably.' },
              { icon: <BarChart2 size={22} strokeWidth={1.5} />, step: '02', title: 'Math does the scoring', desc: 'Correct calls earn points scaled by odds and streak multiplier. Wrong calls cost more the more credible you are.' },
              { icon: <Flame size={22} strokeWidth={1.5} />, step: '03', title: 'Streaks earn visibility', desc: 'Consecutive correct 24hr windows put you in trending. A single lucky hit never beats sustained performance.' },
              { icon: <Award size={22} strokeWidth={1.5} />, step: '04', title: 'Trust is permanent', desc: 'Your credit score is your track record. It decays with inactivity — you can\'t coast on old calls forever.' },
            ].map((item, i) => (
              <div key={item.step} className={`glass-glow delay-${i + 1}`}
                style={{ padding: '24px', animationDelay: `${i * 0.1}s` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'rgba(var(--accent-rgb), 0.1)',
                    border: '1px solid rgba(var(--accent-rgb), 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-light)',
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '0.06em' }}>
                    {item.step}
                  </span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── About ── */}
        <Section id="about">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>

            <div>
              <SectionLabel>About TrustWeb</SectionLabel>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '20px', lineHeight: 1.1 }}>
                Built because credibility was broken
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: '20px' }}>
                Every tipster platform rewards marketing over merit. The loudest voice wins, not the sharpest mind. People with real edge get buried under influencers with no accountability.
              </p>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: '32px' }}>
                TrustWeb flips that. Your visibility is determined entirely by your track record — locked, timestamped, and verifiable by anyone. No followers. No paid promotions. Just math.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  'Predictions locked before events start — no retroactive claiming',
                  'Credit score built over time, not overnight',
                  'Negative scores for consistently bad calls',
                  'Streak visibility rewards sustained performance',
                ].map(point => (
                  <div key={point} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <CheckCircle size={16} strokeWidth={1.5} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: <Target size={20} strokeWidth={1.5} />, title: 'Our Mission', desc: 'Surface genuine predictive skill. Give edge players the visibility they deserve and expose bad actors automatically.' },
                { icon: <Users size={20} strokeWidth={1.5} />, title: 'Who it\'s for', desc: 'Sports analysts, market traders, political forecasters, crypto callers — anyone willing to put their name on a call before it happens.' },
                { icon: <Eye size={20} strokeWidth={1.5} />, title: 'Full transparency', desc: 'Every prediction is publicly verifiable via the original betslip link. We don\'t adjudicate — the data does.' },
                { icon: <TrendingUp size={20} strokeWidth={1.5} />, title: 'Where we\'re going', desc: 'Platform API integrations for automatic resolution, ML-powered rising talent detection, and cross-market credibility.' },
              ].map(item => (
                <div key={item.title} className="glass-glow" style={{ padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                    background: 'rgba(var(--accent-rgb), 0.1)',
                    border: '1px solid rgba(var(--accent-rgb), 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-light)',
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{item.title}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Contact ── */}
        <Section id="contact">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'flex-start' }}>

            <div>
              <SectionLabel>Contact</SectionLabel>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '16px', lineHeight: 1.1 }}>
                Get in touch
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: '36px' }}>
                Building something that integrates with TrustWeb? Have feedback? Want to be an early partner platform? We want to hear from you.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { icon: <MessageSquare size={18} strokeWidth={1.5} />, label: 'General enquiries', value: 'hello@trustweb.app' },
                  { icon: <Globe size={18} strokeWidth={1.5} />,         label: 'Platform partnerships', value: 'partners@trustweb.app' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent-light)', flexShrink: 0,
                    }}>
                      {item.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{item.label}</p>
                      <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-glow" style={{ padding: '32px' }}>
              {contactSent ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle size={40} strokeWidth={1.5} style={{ color: 'var(--success)', marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Message sent</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>We'll get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Send a message</h3>

                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Name</label>
                    <input className="input" type="text" placeholder="Your name"
                      value={contactForm.name}
                      onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} />
                  </div>

                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Email</label>
                    <input className="input" type="email" placeholder="you@example.com"
                      value={contactForm.email}
                      onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} />
                  </div>

                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Message</label>
                    <textarea className="input" rows={4} placeholder="What's on your mind?"
                      value={contactForm.message}
                      onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                      style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>

                  {contactError && (
                    <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{contactError}</p>
                  )}

                  <button type="submit" className="btn-accent" style={{ padding: '13px', gap: '8px' }}>
                    Send Message
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </Section>

        {/* ── Bottom CTA ── */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 100px' }}>
          <div className="glass-glow" style={{
            padding: '64px 40px', textAlign: 'center',
            borderColor: 'rgba(var(--accent-rgb), 0.3)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 120%, var(--accent-glow), transparent 65%)',
            }} />
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, marginBottom: '14px', position: 'relative', letterSpacing: '-0.03em' }}>
              Ready to prove your edge?
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '16px', position: 'relative', lineHeight: 1.6 }}>
              Every prediction timestamped. Every call on record. The math decides who's credible.
            </p>
            <Link to="/login" className="btn-accent" style={{
              fontSize: '15px', padding: '14px 40px', gap: '8px',
              position: 'relative', boxShadow: '0 0 32px var(--accent-glow)',
            }}>
              Get Started Free
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
