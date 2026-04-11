import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ExternalLink, Trophy, X, Clock, MinusCircle, Hash, Flame, ChevronDown } from 'lucide-react'
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
}

type Props = {
  prediction: Prediction
  showUser?: boolean
  index?: number
}

const statusConfig: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  PENDING: { cls: 'pill pill-pending', icon: <Clock size={10} strokeWidth={2} />,       label: 'Pending' },
  WON:     { cls: 'pill pill-won',     icon: <Trophy size={10} strokeWidth={2} />,      label: 'Won'     },
  LOST:    { cls: 'pill pill-lost',    icon: <X size={10} strokeWidth={2} />,           label: 'Lost'    },
  VOID:    { cls: 'pill pill-void',    icon: <MinusCircle size={10} strokeWidth={2} />, label: 'Void'    },
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
  const sc = statusConfig[prediction.status] ?? statusConfig.PENDING

  const [expanded, setExpanded]       = useState(false)
  const [legs, setLegs]               = useState<SlipLeg[] | null>(null)
  const [legsLoading, setLegsLoading] = useState(false)
  const [legsError, setLegsError]     = useState('')

  const bookie    = BOOKIE_MAP[prediction.platform]
  const canExpand = !!bookie || prediction.platform === 'Polymarket'

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

    setLegsLoading(true)
    setLegsError('')
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
    <article style={{
      borderBottom: '1px solid var(--border)',
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ padding: '14px 16px', display: 'flex', gap: '12px' }}>

        {/* Avatar */}
        {showUser && profile && (
          <Link to={`/u/${profile.username}`} style={{ textDecoration: 'none', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: '#fff',
            }}>
              {profile.username[0].toUpperCase()}
            </div>
          </Link>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* User header */}
          {showUser && profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', flexWrap: 'wrap' }}>
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
                <span style={{ color: 'var(--streak)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <Flame size={11} strokeWidth={1.5} />{profile.correct_streak}
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
              fontSize: '14px', lineHeight: 1.55, color: 'var(--text)',
              marginBottom: '10px',
              cursor: canExpand ? 'pointer' : 'default',
            }}
          >
            {prediction.title}
          </p>

          {/* Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{
              padding: '2px 8px', borderRadius: '5px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {prediction.platform}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: '5px',
              background: 'rgba(var(--accent-rgb), 0.1)',
              border: '1px solid rgba(var(--accent-rgb), 0.2)',
              fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700,
            }}>
              ×{prediction.odds}
            </span>
            <span className={sc.cls} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '11px' }}>
              {sc.icon}{sc.label}
            </span>
            {prediction.score_contribution != null && prediction.score_contribution !== 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: prediction.score_contribution > 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                {prediction.score_contribution > 0 ? '+' : ''}{prediction.score_contribution.toFixed(2)}pts
              </span>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {prediction.betslip_code && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-subtle)' }}>
                <Hash size={9} strokeWidth={1.5} />{prediction.betslip_code}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-subtle)' }}>
              <Lock size={9} strokeWidth={1.5} />
              {new Date(prediction.locked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            {prediction.betslip_link && (
              <a
                href={prediction.betslip_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
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
                }}
              >
                {expanded ? 'Hide' : 'Selections'}
                <ChevronDown
                  size={13} strokeWidth={1.5}
                  style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
            )}
          </div>

          {/* Expanded legs */}
          {expanded && canExpand && (
            <div style={{ marginTop: '12px', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-2)' }}>
              {legsLoading && (
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  Loading selections...
                </div>
              )}
              {legsError && <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--danger)' }}>{legsError}</div>}
              {legs && legs.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {legs.map((leg, i) => (
                    <li key={i} style={{
                      padding: '10px 16px',
                      borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                    }}>
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
                <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>No selections available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
