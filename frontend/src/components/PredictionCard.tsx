import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ExternalLink, Trophy, X, Clock, MinusCircle, Flame, ChevronDown } from 'lucide-react'
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
    cls: 'pill pill-pending',
    icon: <Clock    size={10} strokeWidth={2} />,
    label: 'Pending',
  },
  WON: {
    cls: 'pill pill-won',
    icon: <Trophy   size={10} strokeWidth={2} />,
    label: 'Won',
  },
  LOST: {
    cls: 'pill pill-lost',
    icon: <X        size={10} strokeWidth={2} />,
    label: 'Lost',
  },
  VOID: {
    cls: 'pill pill-void',
    icon: <MinusCircle size={10} strokeWidth={2} />,
    label: 'Void',
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
    <article style={{ borderBottom: '1px solid var(--border)' }}>
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
              fontSize: '14px', fontWeight: 600, color: 'var(--on-accent)',
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
                style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px', textDecoration: 'none' }}
              >
                {profile.username}
              </Link>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>·</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{timeAgo(prediction.locked_at)}</span>
              {profile.correct_streak > 0 && (
                <span title="Win streak" style={{
                  color: 'var(--streak)', fontSize: '12px',
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                }}>
                  <Flame size={10} strokeWidth={2} />{profile.correct_streak}
                </span>
              )}
              <span className="mono" style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {Math.max(0, profile.credit_score).toFixed(1)} credit
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
              padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '10px',
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
              <Clock size={13} strokeWidth={1.5} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>Pending manual review</span>
                {prediction.review_note && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.5 }}>
                    {prediction.review_note}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '10px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{prediction.platform}</span>
            <span className="mono" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--text-muted)' }}>@</span>{prediction.odds.toFixed(2)}
            </span>
            <span className={sc.cls} style={{ gap: '4px' }}>
              {sc.icon}{sc.label}
            </span>
            {prediction.score_contribution != null && prediction.score_contribution !== 0 && (
              <span className="mono" style={{
                color: prediction.score_contribution > 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                {prediction.score_contribution > 0 ? '+' : ''}{prediction.score_contribution.toFixed(2)}
              </span>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {prediction.betslip_code && (
              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {prediction.betslip_code}
              </span>
            )}
            <span className="mono" title="Locked at" style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: 'var(--text-muted)',
            }}>
              <Lock size={10} strokeWidth={1.5} />
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
                  fontSize: '11px', color: 'var(--accent-light)', textDecoration: 'none',
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
                    transition: 'transform 0.2s ease',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
            )}
          </div>

          {/* Expanded legs */}
          {expanded && canExpand && (
            <div style={{
              marginTop: '12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', overflow: 'hidden',
              background: 'var(--surface)',
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
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{leg.tournament}</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{leg.match}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {leg.market} · <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{leg.selection}</span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p className="mono" style={{ fontSize: '12px' }}>@{leg.odds.toFixed(2)}</p>
                        <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{leg.kickoff.replace('.utc', ' UTC')}</p>
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
