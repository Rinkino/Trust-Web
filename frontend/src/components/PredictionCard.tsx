import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ExternalLink, Trophy, X, Clock, MinusCircle, Hash, Flame, ChevronDown, Zap } from 'lucide-react'
import type React from 'react'
import { api } from '../lib/api'

const BOOKIE_MAP: Record<string, string> = {
  'Sportybet': 'sportybet:ng',
  'Bet9ja':    'bet9ja',
  'BetKing':   'betking',
  '1xBet':     '1xbet',
  'MSport':    'msport',
  '22bet':     '22bet',
}

type SlipLeg = {
  index: number; tournament: string; match: string
  market: string; selection: string; odds: number; kickoff: string
}

type Prediction = {
  id: string
  title: string
  betslip_code: string
  betslip_link?: string
  odds: number
  platform: string
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID'
  locked_at: string
  resolved_at?: string
  score_contribution?: number
  market_id?: string
  selection?: string
  profiles?: {
    username: string
    credit_score: number
    visibility_score: number
    correct_streak: number
    user_state: string
  }
  needs_review?: boolean
  review_note?: string
}

type Props = {
  prediction: Prediction
  showUser?: boolean
  index?: number
}

const STATUS = {
  PENDING: {
    cls: 'pill pill-pending pending-pulse',
    icon: <Clock    size={10} strokeWidth={2} />,
    label: 'Pending',
    borderColor: 'rgba(245,158,11,0.15)',
    glow: 'rgba(245,158,11,0.04)',
  },
  WON: {
    cls: 'pill pill-won',
    icon: <Trophy   size={10} strokeWidth={2} />,
    label: 'Won',
    borderColor: 'rgba(16,185,129,0.2)',
    glow: 'rgba(16,185,129,0.04)',
  },
  LOST: {
    cls: 'pill pill-lost',
    icon: <X        size={10} strokeWidth={2} />,
    label: 'Lost',
    borderColor: 'rgba(239,68,68,0.15)',
    glow: 'rgba(239,68,68,0.03)',
  },
  VOID: {
    cls: 'pill pill-void',
    icon: <MinusCircle size={10} strokeWidth={2} />,
    label: 'Void',
    borderColor: 'var(--border)',
    glow: 'transparent',
  },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export default function PredictionCard({ prediction, showUser, index = 0 }: Props) {
  void index
  const sc = STATUS[prediction.status] ?? STATUS.PENDING

  const [expanded, setExpanded]       = useState(false)
  const [legs, setLegs]               = useState<SlipLeg[] | null>(null)
  const [legsLoading, setLegsLoading] = useState(false)
  const [legsError, setLegsError]     = useState('')
  const [hovered, setHovered]         = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)

  const bookie    = BOOKIE_MAP[prediction.platform]
  const canExpand = !!bookie || prediction.platform === 'Polymarket'

  /* 3D tilt */
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left - r.width  / 2) / (r.width  / 2)
    const y = (e.clientY - r.top  - r.height / 2) / (r.height / 2)
    el.style.transition = 'transform 0.06s ease'
    el.style.transform  = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-2px)`
  }, [])

  const onLeave = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1)'
    el.style.transform  = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateY(0)'
    setHovered(false)
  }, [])

  async function handleToggle() {
    if (!canExpand) return
    const next = !expanded
    setExpanded(next)
    if (!next || legs !== null || legsLoading) return

    if (prediction.platform === 'Polymarket') {
      setLegs([{
        index: 1, tournament: 'Polymarket', match: prediction.title,
        market: 'Binary Market', selection: prediction.selection ?? '—',
        odds: prediction.odds, kickoff: '—',
      }])
      return
    }

    setLegsLoading(true); setLegsError('')
    try {
      const data = await api.previewSlip(prediction.betslip_code, bookie!)
      setLegs(data.legs ?? [])
    } catch (err: unknown) {
      setLegsError(err instanceof Error ? err.message : 'Could not load selections')
    } finally {
      setLegsLoading(false)
    }
  }

  const profile = prediction.profiles

  return (
    <article
      ref={cardRef}
      className={`${prediction.status === 'WON' ? 'won-shimmer' : ''} card-3d`}
      style={{
        borderBottom: '1px solid var(--border)',
        backgroundColor: hovered ? sc.glow : 'transparent',
        borderLeft: hovered ? `2px solid ${sc.borderColor}` : '2px solid transparent',
        transition: 'background 0.2s, border-left-color 0.2s',
        willChange: 'transform',
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={() => setHovered(true)}
    >
      <div style={{ padding: '14px 16px', display: 'flex', gap: '12px' }}>

        {/* Avatar */}
        {showUser && profile && (
          <Link
            to={`/u/${profile.username}`}
            style={{ textDecoration: 'none', flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: '#fff',
              transition: 'box-shadow 0.2s, transform 0.2s',
              boxShadow: hovered ? '0 0 16px rgba(var(--accent-rgb),0.4)' : 'none',
              transform: hovered ? 'scale(1.06)' : 'scale(1)',
            }}>
              {profile.username[0].toUpperCase()}
            </div>
          </Link>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* User header */}
          {showUser && profile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              marginBottom: '6px', flexWrap: 'wrap',
            }}>
              <Link
                to={`/u/${profile.username}`}
                onClick={e => e.stopPropagation()}
                style={{ fontWeight: 700, color: 'var(--text)', fontSize: '14px', textDecoration: 'none' }}
              >
                {profile.username}
              </Link>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>·</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{timeAgo(prediction.locked_at)}</span>
              {profile.correct_streak > 0 && (
                <span className="animate-streak" style={{
                  color: 'var(--streak)', fontSize: '12px',
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  background: 'rgba(249,115,22,0.08)',
                  padding: '2px 6px', borderRadius: '20px',
                  border: '1px solid rgba(249,115,22,0.18)',
                }}>
                  <Flame size={10} strokeWidth={2} />{profile.correct_streak}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {Math.max(0, profile.credit_score).toFixed(1)} cr
              </span>
            </div>
          )}

          {/* Title */}
          <p
            onClick={handleToggle}
            style={{
              fontSize: '14px', lineHeight: 1.6, color: 'var(--text)',
              marginBottom: '10px',
              cursor: canExpand ? 'pointer' : 'default',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => canExpand && (e.currentTarget.style.color = 'var(--accent-light)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
          >
            {prediction.title}
          </p>

          {/* Flagged banner */}
          {prediction.needs_review && (
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'flex-start',
              padding: '8px 12px', borderRadius: '8px', marginBottom: '10px',
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
              <Clock size={13} strokeWidth={1.5} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)' }}>Pending manual review</span>
                {prediction.review_note && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.5 }}>
                    {prediction.review_note}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{
              padding: '3px 8px', borderRadius: '5px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {prediction.platform}
            </span>
            <span style={{
              padding: '3px 8px', borderRadius: '5px',
              background: 'rgba(var(--accent-rgb),0.1)',
              border: '1px solid rgba(var(--accent-rgb),0.2)',
              fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '3px',
            }}>
              <Zap size={9} strokeWidth={2} />×{prediction.odds}
            </span>
            <span className={sc.cls} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', fontSize: '11px',
              transition: 'transform 0.15s',
            }}>
              {sc.icon}{sc.label}
            </span>
            {prediction.score_contribution != null && prediction.score_contribution !== 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: prediction.score_contribution > 0 ? 'var(--success)' : 'var(--danger)',
                display: 'inline-flex', alignItems: 'center', gap: '2px',
                animation: 'bounce-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
              }}>
                {prediction.score_contribution > 0 ? '+' : ''}{prediction.score_contribution.toFixed(2)}pts
              </span>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {prediction.betslip_code && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                fontSize: '11px', color: 'var(--text-subtle)',
              }}>
                <Hash size={9} strokeWidth={1.5} />{prediction.betslip_code}
              </span>
            )}
            <span style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              fontSize: '11px', color: 'var(--text-subtle)',
            }}>
              <Lock size={9} strokeWidth={1.5} />
              {new Date(prediction.locked_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {prediction.betslip_link && (
              <a
                href={prediction.betslip_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: '11px', color: 'var(--accent)', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Betslip <ExternalLink size={10} strokeWidth={1.5} />
              </a>
            )}
            {canExpand && (
              <button
                onClick={handleToggle}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: 'var(--text-muted)', padding: 0,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-light)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {expanded ? 'Hide' : 'Selections'}
                <ChevronDown
                  size={13} strokeWidth={1.5}
                  style={{
                    transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
            )}
          </div>

          {/* Expanded legs */}
          {expanded && canExpand && (
            <div style={{
              marginTop: '12px', borderRadius: '10px',
              border: '1px solid var(--border)', overflow: 'hidden',
              background: 'var(--surface-2)',
              animation: 'scale-in 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}>
              {legsLoading && (
                <div style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center',
                  gap: '8px', color: 'var(--text-muted)', fontSize: '12px',
                }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                    animation: 'spin 0.7s linear infinite', flexShrink: 0,
                  }} />
                  Loading selections...
                </div>
              )}
              {legsError && (
                <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--danger)' }}>
                  {legsError}
                </div>
              )}
              {legs && legs.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {legs.map((leg, i) => (
                    <li
                      key={i}
                      style={{
                        padding: '10px 16px',
                        borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                        animation: `row-in 0.35s ease ${i * 0.06}s both`,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{leg.tournament}</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{leg.match}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {leg.market} · <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{leg.selection}</span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700 }}>@{leg.odds.toFixed(2)}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{leg.kickoff.replace('.utc', ' UTC')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {legs && legs.length === 0 && !legsLoading && (
                <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  No selections available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
