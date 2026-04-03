import { TrendingUp, Eye, Flame, Activity, Clock, TrendingDown, Moon } from 'lucide-react'

type Props = {
  creditScore: number
  visibilityScore: number
  userState: string
  correctStreak: number
}

const stateConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  ACTIVE:   { color: '#10b981', label: 'Active',  icon: <Activity size={12} strokeWidth={2} /> },
  PENDING:  { color: '#f59e0b', label: 'Pending', icon: <Clock size={12} strokeWidth={2} /> },
  DECAYING: { color: '#6b6b8a', label: 'Cooling', icon: <TrendingDown size={12} strokeWidth={2} /> },
  DORMANT:  { color: '#3a3a5c', label: 'Dormant', icon: <Moon size={12} strokeWidth={2} /> },
}

export default function ScoreBadge({ creditScore, visibilityScore, userState, correctStreak }: Props) {
  const state = stateConfig[userState] ?? stateConfig.DECAYING
  const isTrending = correctStreak >= 5
  const displayCredit = Math.max(0, creditScore)
  const highCredit = displayCredit > 50

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>

      {/* Credit */}
      <div
        className={`glass-glow animate-fade-in-up ${highCredit ? 'animate-border-glow' : ''}`}
        style={{
          padding: '14px 20px', borderRadius: '14px', minWidth: '100px',
          borderColor: highCredit ? 'rgba(var(--accent-rgb), 0.4)' : 'var(--border)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px',
        }}>
          <TrendingUp size={12} strokeWidth={1.5} style={{ color: 'var(--accent-light)' }} />
          Credit
        </div>
        <div style={{
          fontSize: '22px', fontWeight: 800,
          color: creditScore < 0 ? 'var(--danger)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {displayCredit.toFixed(1)}
        </div>
      </div>

      {/* Visibility */}
      <div className="glass-glow animate-fade-in-up delay-1" style={{
        padding: '14px 20px', borderRadius: '14px', minWidth: '100px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px',
        }}>
          <Eye size={12} strokeWidth={1.5} style={{ color: 'var(--accent-light)' }} />
          Visibility
        </div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-light)', fontVariantNumeric: 'tabular-nums' }}>
          {visibilityScore.toFixed(1)}
        </div>
      </div>

      {/* Streak */}
      {correctStreak > 0 && (
        <div
          className={`glass-glow animate-fade-in-up delay-2 ${isTrending ? 'animate-pulse-glow' : ''}`}
          style={{
            padding: '14px 20px', borderRadius: '14px', minWidth: '100px',
            borderColor: isTrending ? 'rgba(249,115,22,0.4)' : 'var(--border)',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px',
          }}>
            <Flame size={12} strokeWidth={1.5} style={{ color: 'var(--streak)' }} />
            Streak
          </div>
          <div
            style={{ fontSize: '22px', fontWeight: 800, color: 'var(--streak)', fontVariantNumeric: 'tabular-nums' }}
            className={isTrending ? 'animate-streak' : ''}
          >
            {correctStreak}d
          </div>
        </div>
      )}

      {/* State badge */}
      <div
        className="animate-fade-in-up delay-3"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '20px',
          border: `1px solid ${state.color}33`,
          background: `${state.color}11`,
          color: state.color,
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        {state.icon}
        {state.label.toUpperCase()}
      </div>
    </div>
  )
}
