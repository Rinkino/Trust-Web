import { Lock, ExternalLink, Trophy, X, Clock, MinusCircle, Hash, Flame } from 'lucide-react'

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
  onResolve?: (id: string, result: 'WON' | 'LOST' | 'VOID') => void
  isOwn?: boolean
  index?: number
}

const statusConfig: Record<string, { cls: string; icon: React.ReactNode; color: string }> = {
  PENDING: {
    cls: 'pill pill-pending',
    icon: <Clock size={11} strokeWidth={2} />,
    color: 'var(--warning)',
  },
  WON: {
    cls: 'pill pill-won',
    icon: <Trophy size={11} strokeWidth={2} />,
    color: 'var(--success)',
  },
  LOST: {
    cls: 'pill pill-lost',
    icon: <X size={11} strokeWidth={2} />,
    color: 'var(--danger)',
  },
  VOID: {
    cls: 'pill pill-void',
    icon: <MinusCircle size={11} strokeWidth={2} />,
    color: 'var(--text-muted)',
  },
}

export default function PredictionCard({ prediction, showUser, onResolve, isOwn, index = 0 }: Props) {
  const delayClass = ['', 'delay-1', 'delay-2', 'delay-3'][index % 4]
  const sc = statusConfig[prediction.status] ?? statusConfig.PENDING

  return (
    <div
      className={`glass-glow animate-fade-in-up ${delayClass}`}
      style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}
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
            <span style={{ fontWeight: 600, color: 'var(--accent-light)', fontSize: '14px' }}>
              @{prediction.profiles.username}
            </span>
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
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', lineHeight: 1.45 }}>
          {prediction.title}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* Platform tag */}
          <span style={{
            padding: '3px 10px', borderRadius: '6px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
          }}>
            {prediction.platform}
          </span>
          {/* Odds badge */}
          <span style={{
            padding: '3px 10px', borderRadius: '6px',
            background: 'rgba(var(--accent-rgb), 0.1)',
            border: '1px solid rgba(var(--accent-rgb), 0.25)',
            fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700,
          }}>
            ×{prediction.odds}
          </span>
          {/* Betslip code */}
          {prediction.betslip_code && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: 'var(--text-muted)',
            }}>
              <Hash size={10} strokeWidth={1.5} />
              {prediction.betslip_code}
            </span>
          )}
          {/* Locked timestamp */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', color: 'var(--text-muted)',
          }}>
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
          <span
            className={sc.cls}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
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

        {prediction.betslip_link && (
          <a
            href={prediction.betslip_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px', color: 'var(--accent)', textDecoration: 'none',
              fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Betslip
            <ExternalLink size={12} strokeWidth={1.5} />
          </a>
        )}
      </div>

      {/* Resolve buttons */}
      {isOwn && prediction.status === 'PENDING' && onResolve && (
        <div style={{
          display: 'flex', gap: '8px',
          paddingTop: '12px', borderTop: '1px solid var(--border)',
        }}>
          {([
            { r: 'WON' as const,  label: 'Mark Won',  c: 'var(--success)' },
            { r: 'LOST' as const, label: 'Mark Lost', c: 'var(--danger)' },
            { r: 'VOID' as const, label: 'Void',      c: 'var(--text-muted)' },
          ]).map(({ r, label, c }) => (
            <button
              key={r}
              onClick={() => onResolve(prediction.id, r)}
              style={{
                flex: r === 'VOID' ? 0 : 1,
                padding: '8px 12px', borderRadius: '8px',
                border: `1px solid ${c}44`, background: `${c}11`,
                color: c, fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${c}22`
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${c}11`
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
