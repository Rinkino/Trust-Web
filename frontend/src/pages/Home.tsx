import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, Lock, BarChart2, Flame, Award,
  Target, Users, Eye, TrendingUp, MessageSquare, Globe,
  Clock, Trophy, X, MinusCircle, Zap, Star, Shield, ChevronRight,
} from 'lucide-react'
import type React from 'react'

const D = "'DM Serif Display', Georgia, serif"

/* ── Custom SVG icons (sourced + hand-crafted) ─────────────── */

function SparkleIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 1L13.8 9.2L22 12L13.8 14.8L12 23L10.2 14.8L2 12L10.2 9.2Z" />
      <path d="M19 2L19.9 5.1L23 6L19.9 6.9L19 10L18.1 6.9L15 6L18.1 5.1Z" opacity="0.55" />
      <path d="M5 17L5.7 19.3L8 20L5.7 20.7L5 23L4.3 20.7L2 20L4.3 19.3Z" opacity="0.4" />
    </svg>
  )
}

function DiamondIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 2L20.5 8L20.5 16L12 22L3.5 16L3.5 8Z" />
      <path d="M12 2L20.5 8L12 11L3.5 8Z" opacity="0.4" />
    </svg>
  )
}

function LightningIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function HexBadgeIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5Z" />
      <path d="M9 11l2 2 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
    </svg>
  )
}

/* ── Static particles config (outside component = stable) ───── */
const PARTICLES: { x: number; y: number; size: number; delay: number; dur: number; dx: number }[] = [
  { x: 7,  y: 22, size: 2.5, delay: 0,   dur: 9,    dx: 14  },
  { x: 17, y: 67, size: 1.5, delay: 1.6, dur: 7,    dx: -11 },
  { x: 31, y: 42, size: 3,   delay: 2.9, dur: 11,   dx: 22  },
  { x: 48, y: 81, size: 1.5, delay: 0.7, dur: 8,    dx: -16 },
  { x: 62, y: 18, size: 2,   delay: 2.1, dur: 10.5, dx: 9   },
  { x: 79, y: 55, size: 2.5, delay: 4.0, dur: 7.5,  dx: -21 },
  { x: 91, y: 33, size: 1.5, delay: 1.8, dur: 9,    dx: 17  },
  { x: 11, y: 88, size: 3,   delay: 5.4, dur: 8.5,  dx: -13 },
  { x: 54, y: 9,  size: 2,   delay: 2.7, dur: 10,   dx: 8   },
  { x: 73, y: 74, size: 1.5, delay: 3.5, dur: 7.5,  dx: -18 },
  { x: 39, y: 51, size: 2.5, delay: 0.3, dur: 8,    dx: 24  },
  { x: 86, y: 14, size: 2,   delay: 5.9, dur: 9.5,  dx: -7  },
  { x: 25, y: 96, size: 1,   delay: 3.2, dur: 6.5,  dx: 12  },
  { x: 66, y: 38, size: 3,   delay: 1.1, dur: 12,   dx: -9  },
  { x: 44, y: 73, size: 1.5, delay: 6.7, dur: 8,    dx: 20  },
]

/* ── Ticker items ───────────────────────────────────────────── */
const TICKER_ITEMS = [
  { icon: <Trophy size={11} strokeWidth={2} />, text: 'cryptoedge locked BTC above $72k — WON +4.21 pts' },
  { icon: <Flame  size={11} strokeWidth={2} />, text: 'quant_calls on 19-day streak — 94.7% accuracy' },
  { icon: <Zap    size={11} strokeWidth={2} />, text: 'sharpbets_io locked Arsenal win pre-kickoff' },
  { icon: <Star   size={11} strokeWidth={2} />, text: '247 predictions locked in the last hour' },
  { icon: <Shield size={11} strokeWidth={2} />, text: 'All predictions timestamped and immutable' },
  { icon: <TrendingUp size={11} strokeWidth={2} />, text: 'fed_watcher locked rate hold — WON +2.88 pts' },
  { icon: <Award  size={11} strokeWidth={2} />, text: 'Top 1% accuracy requires 85+ credit score' },
  { icon: <Lock   size={11} strokeWidth={2} />, text: 'Average odds accuracy: 71.4% across top 50' },
]

/* ── Mock cards ─────────────────────────────────────────────── */
const mockCards = [
  {
    id: '1', user: 'cryptoedge', credit: 87.3, streak: 12,
    title: 'BTC/USD closes above $72k on Friday — 3-leg parlay locked',
    platform: 'Polymarket', odds: 2.85, status: 'WON' as const, pts: '+4.21',
  },
  {
    id: '2', user: 'sharpbets_io', credit: 61.9, streak: 5,
    title: 'Man City win vs Arsenal + BTTS — double locked pre-kickoff',
    platform: 'Betfair', odds: 3.40, status: 'PENDING' as const, pts: null,
  },
  {
    id: '3', user: 'quant_calls', credit: 112.5, streak: 19,
    title: 'Fed holds rates + SPY stays above 520 EOD — 2 leg accum',
    platform: 'Kalshi', odds: 1.92, status: 'WON' as const, pts: '+2.88',
  },
]

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string }> = {
  WON:     { icon: <Trophy    size={9} strokeWidth={2} />, color: 'var(--success)',    label: 'WON',     bg: 'rgba(16,185,129,0.1)' },
  PENDING: { icon: <Clock     size={9} strokeWidth={2} />, color: 'var(--warning)',    label: 'PENDING', bg: 'rgba(245,158,11,0.1)' },
  LOST:    { icon: <X         size={9} strokeWidth={2} />, color: 'var(--danger)',     label: 'LOST',    bg: 'rgba(239,68,68,0.1)' },
  VOID:    { icon: <MinusCircle size={9} strokeWidth={2} />, color: 'var(--text-muted)', label: 'VOID', bg: 'var(--surface-2)' },
}

/* ── 3D tilt card wrapper ───────────────────────────────────── */
function TiltCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left - r.width  / 2) / (r.width  / 2)
    const y = (e.clientY - r.top  - r.height / 2) / (r.height / 2)
    el.style.transition = 'transform 0.06s ease'
    el.style.transform  = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(12px) scale(1.015)`
  }, [])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.65s cubic-bezier(0.16,1,0.3,1)'
    el.style.transform  = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateZ(0) scale(1)'
  }, [])

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className="card-3d" style={{ ...style, willChange: 'transform' }}>
      {children}
    </div>
  )
}

/* ── Count-up stat (IntersectionObserver) ───────────────────── */
function CountUpStat({ target, suffix = '', label, i = 0 }: {
  target: number; suffix?: string; label: string; i?: number
}) {
  const [val, setVal] = useState(0)
  const ref  = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return
      done.current = true
      const dur = 2600
      const t0  = performance.now()
      const tick = (now: number) => {
        const p    = Math.min((now - t0) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(ease * target))
        if (p < 1) requestAnimationFrame(tick)
        else setVal(target)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])

  return (
    <div ref={ref} className="animate-bounce-in" style={{ animationDelay: `${i * 0.14}s` }}>
      <div style={{
        fontFamily: D,
        fontSize: 'clamp(34px, 4vw, 52px)',
        fontWeight: 400, lineHeight: 1, marginBottom: '8px',
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {val.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
        {label}
      </div>
    </div>
  )
}

/* ── Scroll reveal section ──────────────────────────────────── */
function Section({ children, id, bg }: { children: React.ReactNode; id?: string; bg?: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity   = '0'
    el.style.transform = 'translateY(40px)'
    el.style.transition = 'opacity 0.8s ease, transform 0.8s ease'
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity   = '1'
        el.style.transform = 'translateY(0)'
        obs.disconnect()
      }
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section id={id} ref={ref} style={{ background: bg || 'transparent', padding: '110px 0' }}>
      <div className="page-wide">{children}</div>
    </section>
  )
}

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
      <div style={{ width: '16px', height: '1px', background: color || 'var(--accent)' }} />
      <p style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: color || 'var(--accent-light)',
      }}>
        {children}
      </p>
    </div>
  )
}

/* ── Preview card (hero) ────────────────────────────────────── */
function PreviewCard({
  card, shift = 0, delay = 0,
}: { card: typeof mockCards[0]; shift?: number; delay?: number }) {
  const st = statusConfig[card.status]
  return (
    <TiltCard style={{ marginLeft: `${shift}px` }}>
      <div
        className={`glass-glow ${card.status === 'WON' ? 'won-shimmer animate-card-glow' : ''} ${card.status === 'PENDING' ? 'pending-pulse' : ''}`}
        style={{
          padding: '18px 20px', borderRadius: '12px',
          animation: `bounce-in 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
          borderColor: card.status === 'WON' ? 'rgba(16,185,129,0.2)' : undefined,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 0 12px rgba(var(--accent-rgb),0.35)',
            }}>
              {card.user[0].toUpperCase()}
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>@{card.user}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                {card.credit.toFixed(1)} cr
              </span>
            </div>
          </div>
          {card.streak > 0 && (
            <span className="animate-streak" style={{
              fontSize: '11px', color: 'var(--streak)',
              display: 'flex', alignItems: 'center', gap: '3px',
              background: 'rgba(249,115,22,0.1)', padding: '3px 8px',
              borderRadius: '20px', border: '1px solid rgba(249,115,22,0.2)',
            }}>
              <Flame size={10} strokeWidth={2} />{card.streak}
            </span>
          )}
        </div>

        {/* Title */}
        <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text)', marginBottom: '14px' }}>
          {card.title}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{
              padding: '3px 8px', borderRadius: '5px', fontSize: '11px',
              border: '1px solid var(--border)', color: 'var(--text-muted)',
              background: 'var(--surface-2)',
            }}>{card.platform}</span>
            <span style={{
              padding: '3px 8px', borderRadius: '5px', fontSize: '11px',
              background: 'rgba(var(--accent-rgb),0.1)',
              border: '1px solid rgba(var(--accent-rgb),0.2)',
              color: 'var(--accent-light)', fontWeight: 700,
            }}>×{card.odds}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {card.pts && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>
                {card.pts}
              </span>
            )}
            <span style={{
              fontSize: '11px', fontWeight: 700, color: st.color,
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '3px 8px', borderRadius: '20px',
              background: st.bg, border: `1px solid ${st.color}40`,
            }}>
              {st.icon} {st.label}
            </span>
          </div>
        </div>
      </div>
    </TiltCard>
  )
}

/* ── HOW IT WORKS step card ─────────────────────────────────── */
function HiwCard({
  num, icon, title, desc, delay = 0,
}: { num: string; icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity   = '0'
    el.style.transform = 'translateY(28px) scale(0.97)'
    el.style.transition = `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity   = '1'
        el.style.transform = 'translateY(0) scale(1)'
        obs.disconnect()
      }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])

  return (
    <div ref={ref} className="gradient-border feature-icon-wrap" style={{ padding: '44px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div className="feature-icon" style={{
          width: '44px', height: '44px', borderRadius: '10px',
          background: 'rgba(var(--accent-rgb),0.1)',
          border: '1px solid rgba(var(--accent-rgb),0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-light)',
          transition: 'transform 0.3s, background 0.3s',
        }}>
          {icon}
        </div>
        <span style={{
          fontFamily: D, fontSize: '72px',
          lineHeight: 1, userSelect: 'none', fontWeight: 400,
          WebkitTextStroke: '1px var(--border)',
          color: 'transparent',
        } as React.CSSProperties}>{num}</span>
      </div>
      <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px', color: 'var(--text)' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.75 }}>{desc}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
   ───────────────────────────────────────────────────────────── */
export default function Home() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState('')

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactError('Please fill in all fields'); return
    }
    const subject = encodeURIComponent(`TrustWeb contact from ${contactForm.name}`)
    const body    = encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\n${contactForm.message}`)
    window.location.href = `mailto:hello@trustweb.app?subject=${subject}&body=${body}`
    setContactSent(true); setContactError('')
  }

  return (
    <div>

      {/* ══════════════════════════════════════
          HERO
         ══════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        minHeight: 'calc(100vh - 60px)',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>

        {/* Dot-grid background */}
        <div className="hero-dot-grid" style={{ position: 'absolute', inset: 0, opacity: 0.8 }} />

        {/* Aurora glow orbs */}
        <div className="glow-orb animate-morph" style={{
          width: '700px', height: '700px',
          background: 'var(--accent)',
          top: '-260px', left: '-180px',
          animationDuration: '14s',
        }} />
        <div className="glow-orb animate-morph" style={{
          width: '500px', height: '500px',
          background: 'var(--accent-light)',
          bottom: '-150px', right: '-120px',
          animationDuration: '18s',
          animationDelay: '-7s',
        }} />
        <div className="glow-orb animate-float-gentle" style={{
          width: '300px', height: '300px',
          background: 'var(--accent)',
          top: '40%', left: '55%',
          animationDuration: '10s',
          opacity: 0.08,
          filter: 'blur(60px)',
        }} />

        {/* Moving scan line */}
        <div className="scan-line" />

        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="particle-dot"
            style={{
              left: `${p.x}%`, top: `${p.y}%`,
              width: `${p.size}px`, height: `${p.size}px`,
              '--pdur':   `${p.dur}s`,
              '--pdelay': `${p.delay}s`,
              '--pdx':    `${p.dx}px`,
            } as React.CSSProperties}
          />
        ))}

        {/* ─ Content ─ */}
        <div className="page-wide" style={{ position: 'relative', zIndex: 1, width: '100%', padding: '80px 48px' }}>
          <div className="hero-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '80px', alignItems: 'center',
          }}>

            {/* ── Left ── */}
            <div>

              {/* Live badge */}
              <div className="animate-fade-in" style={{ marginBottom: '36px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  padding: '7px 16px', borderRadius: '40px',
                  border: '1px solid rgba(16,185,129,0.35)',
                  background: 'rgba(16,185,129,0.06)',
                  fontSize: '12px', color: 'var(--text-muted)',
                  backdropFilter: 'blur(8px)',
                }}>
                  {/* Ping dot */}
                  <span style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
                    <span className="animate-ping" style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: 'var(--success)', opacity: 0.45,
                    }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--success)',
                    }} />
                  </span>
                  Live — predictions being locked right now
                  <ChevronRight size={11} strokeWidth={2} style={{ opacity: 0.5 }} />
                </div>
              </div>

              {/* Animated headline */}
              <h1 style={{
                fontFamily: D,
                fontSize: 'clamp(50px, 6.5vw, 84px)',
                fontWeight: 400, lineHeight: 1.0,
                letterSpacing: '-0.025em',
                marginBottom: '32px',
                overflow: 'hidden',
              }}>
                {['Earn', 'your'].map((w, i) => (
                  <span
                    key={w}
                    className="animate-word-rise"
                    style={{
                      display: 'inline-block',
                      marginRight: '0.28em',
                      animationDelay: `${0.05 + i * 0.1}s`,
                    }}
                  >{w}</span>
                ))}
                <br />
                <em
                  className="animate-word-rise animate-gradient-text"
                  style={{
                    fontStyle: 'italic',
                    display: 'inline-block',
                    animationDelay: '0.28s',
                  }}
                >credibility.</em>
                <br />
                {['Not', 'buy', 'it.'].map((w, i) => (
                  <span
                    key={w}
                    className="animate-word-rise"
                    style={{
                      display: 'inline-block',
                      marginRight: '0.28em',
                      animationDelay: `${0.4 + i * 0.1}s`,
                    }}
                  >{w}</span>
                ))}
              </h1>

              <p className="animate-fade-in-up delay-6" style={{
                fontSize: '17px', color: 'var(--text-muted)', lineHeight: 1.8,
                maxWidth: '400px', marginBottom: '48px',
              }}>
                Lock predictions before events start. Build a verifiable track record based on accuracy — not followers.
              </p>

              {/* CTA row */}
              <div className="animate-fade-in-up delay-8" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Link
                  to="/login"
                  className="btn-accent animate-shimmer-btn btn-glow"
                  style={{ fontSize: '15px', padding: '14px 32px', gap: '8px', borderRadius: '8px' }}
                >
                  Start Building Trust
                  <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <Link
                  to="/home"
                  className="btn-ghost"
                  style={{ fontSize: '14px', padding: '14px 24px' }}
                >
                  Explore Feed
                </Link>
              </div>

              {/* Trust pills */}
              <div className="animate-fade-in-up delay-10" style={{ display: 'flex', gap: '14px', marginTop: '36px', flexWrap: 'wrap' }}>
                {[
                  { icon: <Lock size={11} strokeWidth={2} />, text: 'Timestamped' },
                  { icon: <Shield size={11} strokeWidth={2} />, text: 'Immutable' },
                  { icon: <TrendingUp size={11} strokeWidth={2} />, text: 'Math-scored' },
                ].map((p) => (
                  <div key={p.text} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '11px', color: 'var(--text-muted)',
                  }}>
                    <span style={{ color: 'var(--accent-light)' }}>{p.icon}</span>
                    {p.text}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right — 3D cards ── */}
            <div className="hero-cards" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <PreviewCard card={mockCards[0]} shift={0}  delay={0.35} />
              <PreviewCard card={mockCards[1]} shift={22} delay={0.55} />
              <PreviewCard card={mockCards[2]} shift={11} delay={0.75} />
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px',
          background: 'linear-gradient(to bottom, transparent, var(--bg))',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ══════════════════════════════════════
          TICKER
         ══════════════════════════════════════ */}
      <div
        className="ticker-wrap"
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div
          className="animate-ticker"
          style={{ display: 'flex', width: 'max-content' }}
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '14px 28px',
                borderRight: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                fontSize: '12px', color: 'var(--text-muted)',
              }}
            >
              <span style={{ color: 'var(--accent-light)', opacity: 0.7 }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          STATS STRIP
         ══════════════════════════════════════ */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="page-wide">
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { target: 10000, suffix: '+',    label: 'Predictions Locked' },
              { target: 998,   suffix: '/1k',  label: 'Verifiable on-chain' },
              { target: 47,    suffix: 'd',    label: 'Top streak ever' },
              { target: 30,    suffix: '+',    label: 'Platforms supported' },
            ].map((s, i) => (
              <div
                key={i}
                className="stat-card-hover"
                style={{
                  padding: '44px 0',
                  paddingLeft: i > 0 ? '40px' : 0,
                  borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                  position: 'relative', overflow: 'hidden',
                  transition: 'background 0.2s',
                }}
              >
                <CountUpStat target={s.target} suffix={s.suffix} label={s.label} i={i} />
                {/* Animated progress line at bottom */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--border)' }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                    animation: `bar-fill 2.4s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.25}s both`,
                    '--bar-w': '100%',
                  } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          HOW IT WORKS
         ══════════════════════════════════════ */}
      <Section id="how-it-works">

        {/* Section header */}
        <div className="hiw-split" style={{
          display: 'grid', gridTemplateColumns: '1fr 2fr',
          gap: '80px', alignItems: 'flex-start', marginBottom: '72px',
        }}>
          <div>
            <Label>How it works</Label>
            <h2 style={{
              fontFamily: D,
              fontSize: 'clamp(30px, 4vw, 52px)',
              fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.05,
              color: 'var(--text)',
            }}>
              The system<br /><em>that can&apos;t<br />be gamed.</em>
            </h2>
          </div>
          <p style={{
            fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.85,
            alignSelf: 'center',
          }}>
            Every mechanism is designed to surface genuine skill over time. You can&apos;t buy credibility here — you can only earn it, through verifiable calls made before the outcome is known.
          </p>
        </div>

        {/* Steps grid */}
        <div className="border-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <HiwCard
            num="01"
            icon={<Lock size={20} strokeWidth={1.5} />}
            title="Lock before it starts"
            desc="Submit with a betslip code. System verifies the event hasn't started and seals the prediction immutably — timestamped, permanent."
            delay={0.1}
          />
          <HiwCard
            num="02"
            icon={<BarChart2 size={20} strokeWidth={1.5} />}
            title="Math does the scoring"
            desc="Correct calls earn points scaled by odds and streak multiplier. Wrong calls cost more the more credible you are."
            delay={0.2}
          />
          <HiwCard
            num="03"
            icon={<Flame size={20} strokeWidth={1.5} />}
            title="Streaks earn visibility"
            desc="Consecutive correct windows put you in trending. A single lucky hit never beats sustained performance."
            delay={0.3}
          />
          <HiwCard
            num="04"
            icon={<Award size={20} strokeWidth={1.5} />}
            title="Trust is permanent"
            desc="Your credit score is your track record. It decays with inactivity — you can't coast on old calls forever."
            delay={0.4}
          />
        </div>

        {/* Floating feature chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px',
          marginTop: '56px', justifyContent: 'center',
        }}>
          {[
            { icon: <SparkleIcon size={13} color="var(--accent-light)" />, text: 'No backdating' },
            { icon: <DiamondIcon size={13} color="var(--accent-light)" />, text: 'Verified outcomes' },
            { icon: <LightningIcon size={13} color="var(--warning)" />,    text: 'Auto-resolution' },
            { icon: <HexBadgeIcon size={13} color="var(--success)" />,     text: 'Immutable history' },
            { icon: <Star size={13} strokeWidth={2} style={{ color: 'var(--streak)' }} />, text: 'Streak multipliers' },
            { icon: <Eye size={13} strokeWidth={2} style={{ color: 'var(--accent-light)' }} />, text: 'Public track record' },
          ].map((chip, i) => (
            <div
              key={chip.text}
              className="animate-bounce-in"
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '40px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '12px', color: 'var(--text-muted)',
                animationDelay: `${i * 0.08}s`,
                transition: 'border-color 0.2s, background 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.4)'
                e.currentTarget.style.background  = 'var(--surface-2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background  = 'var(--surface)'
              }}
            >
              {chip.icon}
              {chip.text}
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════
          ABOUT
         ══════════════════════════════════════ */}
      <Section id="about" bg="var(--surface)">
        <div className="about-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '100px', alignItems: 'flex-start',
        }}>

          {/* Left */}
          <div className="animate-enter-left">
            <Label>About TrustWeb</Label>
            <h2 style={{
              fontFamily: D,
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.05,
              marginBottom: '28px', color: 'var(--text)',
            }}>
              Built because<br /><em>credibility<br />was broken.</em>
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.9, marginBottom: '20px' }}>
              Every tipster platform rewards marketing over merit. The loudest voice wins, not the sharpest mind.
            </p>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.9, marginBottom: '40px' }}>
              TrustWeb flips that. Your visibility is determined entirely by your track record — locked, timestamped, verifiable by anyone.
            </p>

            {/* Animated checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                'Predictions locked before events start — no retroactive claiming',
                'Credit score built over time, not overnight',
                'Negative scores for consistently bad calls',
                'Streak visibility rewards sustained performance',
              ].map((point, i) => (
                <div
                  key={point}
                  className="animate-enter-left"
                  style={{
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                    animationDelay: `${0.1 + i * 0.1}s`,
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: '1px',
                  }}>
                    <CheckCircle size={11} strokeWidth={2.5} style={{ color: 'var(--success)' }} />
                  </div>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="animate-enter-right">
            {[
              {
                icon: <Target size={18} strokeWidth={1.5} />,
                title: 'Our Mission',
                desc: 'Surface genuine predictive skill. Give edge players the visibility they deserve and expose bad actors automatically.',
              },
              {
                icon: <Users size={18} strokeWidth={1.5} />,
                title: "Who it's for",
                desc: 'Sports analysts, market traders, political forecasters — anyone willing to put their name on a call before it happens.',
              },
              {
                icon: <Eye size={18} strokeWidth={1.5} />,
                title: 'Full transparency',
                desc: "Every prediction is publicly verifiable via the original betslip link. We don't adjudicate — the data does.",
              },
              {
                icon: <TrendingUp size={18} strokeWidth={1.5} />,
                title: "Where we're going",
                desc: 'API integrations for automatic resolution, ML-powered rising talent detection, and cross-market credibility.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="animate-enter-right"
                style={{
                  display: 'flex', gap: '18px', alignItems: 'flex-start',
                  padding: '24px 0',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                  animationDelay: `${0.1 + i * 0.12}s`,
                  transition: 'padding-left 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.paddingLeft = '8px')}
                onMouseLeave={e => (e.currentTarget.style.paddingLeft = '0px')}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: 'rgba(var(--accent-rgb),0.08)',
                  border: '1px solid rgba(var(--accent-rgb),0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-light)', flexShrink: 0,
                  transition: 'background 0.2s, transform 0.2s',
                }}>
                  {item.icon}
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SOCIAL PROOF STRIP
         ══════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '56px 0' }}>
        <div className="page-wide">
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <Label color="var(--text-muted)">Used by serious predictors</Label>
            <h3 style={{
              fontFamily: D,
              fontSize: 'clamp(24px, 3vw, 38px)',
              fontWeight: 400, color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}>
              The leaderboard doesn&apos;t lie.
            </h3>
          </div>

          {/* Top predictor cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {[
              { user: 'cryptoedge',  credit: 87.3,  streak: 12, accuracy: '94%', picks: 142 },
              { user: 'quant_calls', credit: 112.5, streak: 19, accuracy: '91%', picks: 203 },
              { user: 'arb_hunter',  credit: 76.8,  streak: 8,  accuracy: '87%', picks: 98  },
            ].map((u, i) => (
              <div
                key={u.user}
                className="animate-bounce-in"
                style={{
                  background: 'var(--bg)', padding: '28px 24px',
                  animationDelay: `${i * 0.15}s`,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, color: '#fff',
                    flexShrink: 0,
                    boxShadow: '0 0 16px rgba(var(--accent-rgb),0.35)',
                  }}>
                    {u.user[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>@{u.user}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.picks} picks</div>
                  </div>
                  {i === 1 && (
                    <span className="animate-sparkle" style={{ marginLeft: 'auto' }}>
                      <SparkleIcon size={16} color="var(--warning)" />
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Credit</div>
                    <div style={{ fontFamily: D, fontSize: '22px', color: 'var(--accent-light)', fontWeight: 400 }}>
                      {u.credit}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accuracy</div>
                    <div style={{ fontFamily: D, fontSize: '22px', color: 'var(--success)', fontWeight: 400 }}>
                      {u.accuracy}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Streak</div>
                    <div style={{ fontFamily: D, fontSize: '22px', color: 'var(--streak)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Flame size={14} strokeWidth={1.5} className="animate-streak" />
                      {u.streak}d
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          CONTACT
         ══════════════════════════════════════ */}
      <Section id="contact">
        <div className="contact-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '100px', alignItems: 'flex-start',
        }}>
          <div className="animate-enter-left">
            <Label>Contact</Label>
            <h2 style={{
              fontFamily: D,
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.05,
              marginBottom: '20px', color: 'var(--text)',
            }}>
              Get in touch.
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.9, marginBottom: '44px' }}>
              Building something that integrates with TrustWeb? Have feedback? Want to be an early partner?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {[
                { icon: <MessageSquare size={16} strokeWidth={1.5} />, label: 'General enquiries',    value: 'hello@trustweb.app' },
                { icon: <Globe        size={16} strokeWidth={1.5} />, label: 'Platform partnerships', value: 'partners@trustweb.app' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', gap: '16px', alignItems: 'center',
                  padding: '16px', borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  transition: 'border-color 0.2s, transform 0.2s',
                  cursor: 'default',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.35)'
                    e.currentTarget.style.transform   = 'translateX(4px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform   = 'translateX(0)'
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: 'rgba(var(--accent-rgb),0.08)',
                    border: '1px solid rgba(var(--accent-rgb),0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-light)', flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div className="animate-enter-right glass-glow" style={{ padding: '36px' }}>
            {contactSent ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="animate-icon-pop" style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <CheckCircle size={28} strokeWidth={1.5} style={{ color: 'var(--success)' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Message sent</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>We&apos;ll get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>Send a message</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>We read every message.</p>
                </div>
                {[
                  { key: 'name',    label: 'Name',    type: 'text',  placeholder: 'Your name' },
                  { key: 'email',   label: 'Email',   type: 'email', placeholder: 'you@example.com' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="label" style={{ display: 'block', marginBottom: '7px' }}>{f.label}</label>
                    <input
                      className="input"
                      type={f.type}
                      placeholder={f.placeholder}
                      value={(contactForm as Record<string, string>)[f.key]}
                      onChange={e => setContactForm(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: '7px' }}>Message</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="What's on your mind?"
                    value={contactForm.message}
                    onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                {contactError && (
                  <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{contactError}</p>
                )}
                <button
                  type="submit"
                  className="btn-accent animate-shimmer-btn"
                  style={{ padding: '13px', gap: '8px' }}
                >
                  Send Message
                  <ArrowRight size={15} strokeWidth={2} />
                </button>
              </form>
            )}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════
          BOTTOM CTA
         ══════════════════════════════════════ */}
      <div style={{
        borderTop: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
        background: 'var(--surface)',
      }}>

        {/* Animated gradient background */}
        <div className="animate-gradient-x" style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, rgba(var(--accent-rgb), 0.08), transparent)`,
          pointerEvents: 'none',
        }} />

        {/* Decorative rotating diamond */}
        <div className="animate-rotate-slow" style={{
          position: 'absolute', right: '8%', top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.04,
          pointerEvents: 'none',
        }}>
          <DiamondIcon size={320} color="var(--accent)" />
        </div>

        <div className="page-wide" style={{
          position: 'relative', zIndex: 1,
          padding: '128px 48px', textAlign: 'center',
        }}>
          <div className="animate-float-gentle" style={{ display: 'inline-block', marginBottom: '20px' }}>
            <SparkleIcon size={28} color="var(--accent-light)" />
          </div>
          <Label color="var(--text-muted)">Ready to start?</Label>
          <h2 className="animate-word-rise" style={{
            fontFamily: D,
            fontSize: 'clamp(40px, 6vw, 84px)',
            fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.0,
            marginBottom: '24px', color: 'var(--text)',
          }}>
            Prove your edge.
          </h2>
          <p style={{
            color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.8,
            maxWidth: '440px', margin: '0 auto 52px',
          }}>
            Every prediction timestamped. Every call on record. The math decides who&apos;s credible.
          </p>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Link
              to="/login"
              className="btn-accent animate-shimmer-btn btn-glow"
              style={{ fontSize: '16px', padding: '16px 48px', gap: '10px', borderRadius: '10px' }}
            >
              Get Started Free
              <ArrowRight size={17} strokeWidth={2} />
            </Link>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              No credit card required
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
