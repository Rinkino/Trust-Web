import { TrendingUp, Eye, Flame, Activity, Clock, TrendingDown, Moon, Zap } from 'lucide-react'
import type React from 'react'

type Props = {
  creditScore: number
  visibilityScore: number
  userState: string
  correctStreak: number
}

const stateConfig: Record<string, { color: string; label: string; icon: React.ReactNode; bg: string }> = {
  ACTIVE:   { color: '#10b981', label: 'Active',  bg: 'rgba(16,185,129,0.1)',  icon: <Activity    size={12} strokeWidth={2} /> },
  PENDING:  { color: '#f59e0b', label: 'Pending', bg: 'rgba(245,158,11,0.1)', icon: <Clock       size={12} strokeWidth={2} /> },
  DECAYING: { color: '#6b6b8a', label: 'Cooling', bg: 'rgba(107,107,138,0.1)',icon: <TrendingDown size={12} strokeWidth={2} /> },
  DORMANT:  { color: '#3a3a5c', label: 'Dormant', bg: 'rgba(58,58,92,0.15)',  icon: <Moon        size={12} strokeWidth={2} /> },
}

function SparkleIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 1L13.8 9.2L22 12L13.8 14.8L12 23L10.2 14.8L2 12L10.2 9.2Z" />
      <path d="M19 2L19.9 5.1L23 6L19.9 6.9L19 10L18.1 6.9L15 6L18.1 5.1Z" opacity="0.5" />
    </svg>
  )
}

function MiniBar({ value, max = 150, color = 'var(--accent)' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100
  return (
    <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
      <div style={{
        height: '100%', borderRadius: '2px', background: color,
        animation: `bar-fill 1.4s cubic-bezier(0.16,1,0.3,1) 0.3s both`,
        '--bar-w': `${pct}%`,
      } as React.CSSProperties} />
    </div>
  )
}

export default function ScoreBadge({ creditScore, visibilityScore, userState, correctStreak }: Props) {
  const state       = stateConfig[userState] ?? stateConfig.DECAYING
  const isTrending  = correctStreak >= 5
  const isElite     = creditScore > 80
  const displayCredit = Math.max(0, creditScore)

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>

      {/* ── Credit ── */}
      <div
        className={`glass-glow animate-bounce-in ${isElite ? 'animate-glow-border' : ''}`}
        style={{
          padding: '16px 20px', borderRadius: '14px', minWidth: '110px',
          position: 'relative', overflow: 'hidden',
          borderColor: isElite ? 'rgba(var(--accent-rgb),0.35)' : undefined,
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* Elite sparkle */}
        {isElite && (
          <span
            className="animate-sparkle"
            style={{
              position: 'absolute', top: '10px', right: '12px',
              color: 'var(--accent-light)', opacity: 0.7,
            }}
          >
            <SparkleIcon size={10} color="var(--accent-light)" />
          </span>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
        }}>
          <TrendingUp size={12} strokeWidth={1.5} style={{ color: 'var(--accent-light)' }} />
          Credit
        </div>
        <div
          className={isElite ? 'animate-neon' : ''}
          style={{
            fontSize: '26px', fontWeight: 800,
            color: creditScore < 0 ? 'var(--danger)' : isElite ? 'var(--accent-light)' : 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            animation: isElite ? 'neon-pulse 3s ease-in-out infinite' : undefined,
          }}
        >
          {displayCredit.toFixed(1)}
        </div>
        <MiniBar value={displayCredit} max={150} color={isElite ? 'var(--accent-light)' : 'var(--accent)'} />
      </div>

      {/* ── Visibility ── */}
      <div
        className="glass-glow animate-bounce-in"
        style={{ padding: '16px 20px', borderRadius: '14px', minWidth: '110px', animationDelay: '0.1s' }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
        }}>
          <Eye size={12} strokeWidth={1.5} style={{ color: 'var(--accent-light)' }} />
          Visibility
        </div>
        <div style={{
          fontSize: '26px', fontWeight: 800,
          color: 'var(--accent-light)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {visibilityScore.toFixed(1)}
        </div>
        <MiniBar value={visibilityScore} max={100} color="var(--accent-light)" />
      </div>

      {/* ── Streak ── */}
      {correctStreak > 0 && (
        <div
          className="glass-glow animate-bounce-in"
          style={{
            padding: '16px 20px', borderRadius: '14px', minWidth: '110px',
            animationDelay: '0.2s',
            borderColor: isTrending ? 'rgba(249,115,22,0.35)' : undefined,
            background: isTrending ? 'rgba(249,115,22,0.03)' : undefined,
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
          }}>
            <Flame size={12} strokeWidth={1.5} style={{ color: 'var(--streak)' }} />
            Streak
          </div>
          <div style={{
            fontSize: '26px', fontWeight: 800,
            color: 'var(--streak)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            display: 'flex', alignItems: 'baseline', gap: '3px',
          }}>
            <span className={isTrending ? 'animate-streak' : ''}>{correctStreak}</span>
            <span style={{ fontSize: '14px', opacity: 0.7 }}>d</span>
          </div>
          <MiniBar value={Math.min(correctStreak, 30)} max={30} color="var(--streak)" />

          {/* Hot streak badge */}
          {isTrending && (
            <div style={{
              marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: 700, color: 'var(--streak)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <Zap size={9} strokeWidth={2} />
              On fire
            </div>
          )}
        </div>
      )}

      {/* ── State badge ── */}
      <div
        className="animate-bounce-in"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '20px',
          border: `1px solid ${state.color}44`,
          background: state.bg,
          color: state.color,
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.05em',
          animationDelay: '0.3s',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {state.icon}
        {state.label.toUpperCase()}
      </div>
    </div>
  )
}
