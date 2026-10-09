import { Activity, Clock, TrendingDown, Moon } from 'lucide-react'
import type React from 'react'

type Props = {
  creditScore: number
  visibilityScore: number
  userState: string
  correctStreak: number
}

const stateConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  ACTIVE:   { color: 'var(--success)',    label: 'Active',  icon: <Activity     size={12} strokeWidth={2} /> },
  PENDING:  { color: 'var(--warning)',    label: 'Pending', icon: <Clock        size={12} strokeWidth={2} /> },
  DECAYING: { color: 'var(--text-muted)', label: 'Cooling', icon: <TrendingDown size={12} strokeWidth={2} /> },
  DORMANT:  { color: 'var(--text-muted)', label: 'Dormant', icon: <Moon         size={12} strokeWidth={2} /> },
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100
  return (
    <div style={{ height: '2px', background: 'var(--border)', marginTop: '10px' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color }} />
    </div>
  )
}

function Stat({ label, value, suffix, color, bar }: {
  label: string
  value: string
  suffix?: string
  color: string
  bar: React.ReactNode
}) {
  return (
    <div style={{ padding: '14px 16px', minWidth: '112px', flex: 1 }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <div className="mono" style={{ fontSize: '24px', fontWeight: 500, color, lineHeight: 1 }}>
        {value}
        {suffix && <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '3px' }}>{suffix}</span>}
      </div>
      {bar}
    </div>
  )
}

export default function ScoreBadge({ creditScore, visibilityScore, userState, correctStreak }: Props) {
  const state = stateConfig[userState] ?? stateConfig.DECAYING
  const displayCredit = Math.max(0, creditScore)

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'stretch' }}>
      <div className="border-grid" style={{ gridAutoFlow: 'column', flex: '1 1 auto' }}>
        <Stat
          label="Credit"
          value={displayCredit.toFixed(1)}
          color={creditScore < 0 ? 'var(--danger)' : 'var(--text)'}
          bar={<MiniBar value={displayCredit} max={150} color="var(--accent)" />}
        />
        <Stat
          label="Visibility"
          value={visibilityScore.toFixed(1)}
          color="var(--text)"
          bar={<MiniBar value={visibilityScore} max={100} color="var(--accent-light)" />}
        />
        {correctStreak > 0 && (
          <Stat
            label="Streak"
            value={String(correctStreak)}
            suffix={correctStreak === 1 ? 'win' : 'wins'}
            color="var(--streak)"
            bar={<MiniBar value={Math.min(correctStreak, 30)} max={30} color="var(--streak)" />}
          />
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'center',
        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        color: state.color, fontSize: '12px',
      }}>
        {state.icon}
        {state.label}
      </div>
    </div>
  )
}
