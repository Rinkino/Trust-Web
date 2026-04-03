import AnimatedCounter from './AnimatedCounter'

type Props = {
  icon: React.ReactNode
  value: number
  label: string
  color?: string
  decimals?: number
}

export default function StatCard({ icon, value, label, color = 'var(--accent)', decimals = 1 }: Props) {
  return (
    <div
      className="glass-glow animate-fade-in-up"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        '--hover-color': color,
      } as React.CSSProperties}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 0 30px ${color}44, 0 8px 32px rgba(0,0,0,0.4)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: `${color}1a`,
        border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color }}>
        <AnimatedCounter value={value} decimals={decimals} />
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  )
}
