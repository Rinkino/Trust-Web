import LogoOrbit from './LogoOrbit'

type Props = { label?: string }

export default function LoadingSpinner({ label }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <LogoOrbit />
      {label && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          {label}
        </p>
      )}
    </div>
  )
}
