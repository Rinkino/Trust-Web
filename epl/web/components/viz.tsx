import { num, pct } from '@/lib/format'
import type { CountValue } from '@/lib/db'

export function ProbBar({ p }: { p: number[] }) {
  const labels = ['H', 'D', 'A']
  const colors = ['var(--bar-h)', 'var(--bar-d)', 'var(--bar-a)']
  return (
    <div className="probbar" role="img" aria-label={`Home ${pct(p[0])}, draw ${pct(p[1])}, away ${pct(p[2])}`}>
      {p.map((x, i) => (
        <span key={i} style={{ width: `${x * 100}%`, background: colors[i] }}>{x > 0.12 ? `${labels[i]} ${pct(x)}` : ''}</span>
      ))}
    </div>
  )
}

export function Count({ v }: { v: CountValue | undefined }) {
  if (!v) return <span className="muted">—</span>
  return (
    <span>
      <span className="mono">{num(v.mean, 2)}</span>
      <span className="muted small mono"> (80%: {v.pi80[0]}–{v.pi80[1]})</span>
    </span>
  )
}

/** Reliability diagram: predicted probability (x) vs observed frequency (y). */
export function Reliability({ bins, title }: { bins: { lo: number; hi: number; n: number; mean_p: number; freq: number }[]; title: string }) {
  const W = 260, H = 220, P = 32
  const x = (v: number) => P + v * (W - P - 10)
  const y = (v: number) => H - P - v * (H - P - 10)
  const maxN = Math.max(...bins.map(b => b.n), 1)
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label={title}>
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--border)" strokeDasharray="4 3" />
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="var(--muted)" />
        <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="var(--muted)" />
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <text x={x(t)} y={H - 14} fontSize="10" textAnchor="middle" fill="var(--muted)">{t}</text>
            <text x={P - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {bins.map((b, i) => (
          <circle key={i} cx={x(b.mean_p)} cy={y(b.freq)} r={2.5 + 5 * Math.sqrt(b.n / maxN)} fill="var(--accent)" fillOpacity="0.75">
            <title>{`predicted ${pct(b.mean_p, 1)} · observed ${pct(b.freq, 1)} · n=${b.n}`}</title>
          </circle>
        ))}
        <text x={W / 2 + 10} y={H - 2} fontSize="10" textAnchor="middle" fill="var(--muted)">predicted probability</text>
      </svg>
      <figcaption className="small muted">{title}</figcaption>
    </figure>
  )
}

/** Small grouped bars: metric by season for a few models. */
export function SeasonBars({ seasons, series, title, lowerIsBetter = true }: {
  seasons: string[]; series: { name: string; color: string; values: (number | null)[] }[]; title: string; lowerIsBetter?: boolean
}) {
  const W = 520, H = 200, P = 36
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null))
  if (!all.length) return null
  const lo = Math.min(...all) * 0.97, hi = Math.max(...all) * 1.01
  const gw = (W - P - 10) / seasons.length
  const bw = Math.min(18, (gw - 10) / series.length)
  const y = (v: number) => H - 30 - ((v - lo) / (hi - lo || 1)) * (H - 50)
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
        {[lo, (lo + hi) / 2, hi].map((t, i) => (
          <g key={i}>
            <line x1={P} x2={W - 10} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={P - 4} y={y(t) + 3} fontSize="10" textAnchor="end" fill="var(--muted)">{t.toFixed(3)}</text>
          </g>
        ))}
        {seasons.map((s, si) => (
          <g key={s}>
            {series.map((ser, k) => {
              const v = ser.values[si]
              if (v === null) return null
              const x0 = P + si * gw + (gw - bw * series.length) / 2 + k * bw
              return (
                <rect key={k} x={x0} y={y(v)} width={bw - 2} height={H - 30 - y(v)} fill={ser.color}>
                  <title>{`${ser.name} ${s}: ${v.toFixed(4)}`}</title>
                </rect>
              )
            })}
            <text x={P + si * gw + gw / 2} y={H - 14} fontSize="11" textAnchor="middle" fill="var(--muted)">{s}</text>
          </g>
        ))}
      </svg>
      <figcaption className="small muted">
        {title} ({lowerIsBetter ? 'lower is better' : 'higher is better'}).{' '}
        {series.map(s => <span key={s.name} style={{ marginRight: 12 }}><span style={{ color: s.color }}>■</span> {s.name}</span>)}
      </figcaption>
    </figure>
  )
}
