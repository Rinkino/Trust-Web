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

const statusConfig: Record<string, { cls: string; icon: React.ReactNode; color: string }> = {
  PENDING: { cls: 'pill pill-pending', icon: <Clock size={11} strokeWidth={2} />,      color: 'var(--warning)' },
  WON:     { cls: 'pill pill-won',     icon: <Trophy size={11} strokeWidth={2} />,     color: 'var(--success)' },
  LOST:    { cls: 'pill pill-lost',    icon: <X size={11} strokeWidth={2} />,          color: 'var(--danger)'  },
  VOID:    { cls: 'pill pill-void',    icon: <MinusCircle size={11} strokeWidth={2} />, color: 'var(--text-muted)' },
}

export default function PredictionCard({ prediction, showUser, index = 0 }: Props) {
  const delayClass = ['', 'delay-1', 'delay-2', 'delay-3'][index % 4]
  const sc = statusConfig[prediction.status] ?? statusConfig.PENDING

  const [expanded, setExpanded]       = useState(false)
  const [legs, setLegs]               = useState<SlipLeg[] | null>(null)
  const [legsLoading, setLegsLoading] = useState(false)
  const [legsError, setLegsError]     = useState('')

  const bookie = BOOKIE_MAP[prediction.platform]
  const canExpand = !!bookie || prediction.platform === 'Polymarket'

  async function handleToggle() {
    if (!canExpand) return
    const next = !expanded
    setExpanded(next)

    // Only fetch once
    if (!next || legs !== null || legsLoading) return

    // Polymarket — data already on the prediction
    if (prediction.platform === 'Polymarket') {
      setLegs([{
        index: 1,
        tournament: 'Polymarket',
        match: prediction.title,
        market: 'Binary Market',
        selection: prediction.selection ?? '—',
        odds: prediction.odds,
        kickoff: '—',
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

  return (
    <div className={`glass-glow animate-fade-in-up ${delayClass}`} style={{ overflow: 'hidden' }}>

      {/* Main card body — clickable if expandable */}
      <div
        onClick={handleToggle}
        style={{
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
          cursor: canExpand ? 'pointer' : 'default',
        }}
      >
        {/* User header */}
        {showUser && prediction.profiles && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 800, color: '#fff',
              }}>
                {prediction.profiles.username[0].toUpperCase()}
              </div>
              <Link
                to={`/u/${prediction.profiles.username}`}
                onClick={e => e.stopPropagation()}
                style={{ fontWeight: 600, color: 'var(--accent-light)', fontSize: '14px', textDecoration: 'none' }}
              >
                @{prediction.profiles.username}
              </Link>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span>{Math.max(0, prediction.profiles.credit_score).toFixed(1)} cr</span>
              {prediction.profiles.correct_streak > 0 && (
                <span style={{ color: 'var(--streak)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Flame size={12} strokeWidth={1.5} />
                  {prediction.profiles.correct_streak}d
                </span>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <h3 style={{
            fontSize: '15px', fontWeight: 600, marginBottom: '10px', lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {prediction.title}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{
              padding: '3px 10px', borderRadius: '6px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {prediction.platform}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: '6px',
              background: 'rgba(var(--accent-rgb), 0.1)',
              border: '1px solid rgba(var(--accent-rgb), 0.25)',
              fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700,
            }}>
              ×{prediction.odds}
            </span>
            {prediction.betslip_code && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Hash size={10} strokeWidth={1.5} />
                {prediction.betslip_code}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <Lock size={10} strokeWidth={1.5} />
              {new Date(prediction.locked_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={sc.cls} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {sc.icon}
              {prediction.status}
            </span>
            {prediction.score_contribution != null && prediction.score_contribution !== 0 && (
              <span style={{
                fontSize: '12px', fontWeight: 700,
                color: prediction.score_contribution > 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                {prediction.score_contribution > 0 ? '+' : ''}{prediction.score_contribution.toFixed(2)} pts
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {prediction.betslip_link && (
              <a
                href={prediction.betslip_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: '12px', color: 'var(--accent)', textDecoration: 'none',
                  fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                Betslip <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            )}
            {canExpand && (
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                style={{
                  color: 'var(--text-muted)',
                  transition: 'transform 0.2s',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Expanded selections */}
      {expanded && canExpand && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {legsLoading && (
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              Loading selections...
            </div>
          )}

          {legsError && (
            <div style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--danger)' }}>
              {legsError}
            </div>
          )}

          {legs && legs.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {legs.map((leg, i) => (
                <li key={i} style={{
                  padding: '10px 20px',
                  borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '2px' }}>
                      {leg.tournament}
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {leg.match}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {leg.market} · <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{leg.selection}</span>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700 }}>@{leg.odds.toFixed(2)}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{leg.kickoff.replace('.utc', ' UTC')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {legs && legs.length === 0 && !legsLoading && (
            <div style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-muted)' }}>
              No selections available
            </div>
          )}
        </div>
      )}
    </div>
  )
}
