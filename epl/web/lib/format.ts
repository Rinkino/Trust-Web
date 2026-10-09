export const pct = (p: number | null | undefined, digits = 0) =>
  p === null || p === undefined || Number.isNaN(p) ? '—' : `${(p * 100).toFixed(digits)}%`

export const num = (x: number | null | undefined, digits = 2) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : x.toFixed(digits)

export const signedPct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(digits)}%`

export function when(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' } : {}),
  })
}

export const day = (iso: string | null | undefined) => when(iso, false)

/** Observed value for a target from a match row (mirrors eplpred.derive.actual_values). */
export function actualFor(target: string, m: Record<string, any>): number | null {
  const pair: Record<string, [string, string]> = {
    goals: ['fthg', 'ftag'], shots: ['hs', 'as'], sot: ['hst', 'ast'], corners: ['hc', 'ac'], yellows: ['hy', 'ay'], reds: ['hr', 'ar'],
  }
  const side = (stat: string, s: 'home' | 'away' | 'total'): number | null => {
    const [h, a] = pair[stat]
    const vh = m[h], va = m[a]
    if (s === 'home') return vh ?? null
    if (s === 'away') return va ?? null
    return vh == null || va == null ? null : vh + va
  }
  const mm = /^(goals|shots|sot|corners|yellows)_(home|away|total)$/.exec(target)
  if (mm) return side(mm[1], mm[2] as 'home' | 'away' | 'total')
  const over = (stat: string, t: number) => { const v = side(stat, 'total'); return v == null ? null : Number(v > t) }
  switch (target) {
    case 'goals_over_1_5': return over('goals', 1.5)
    case 'goals_over_2_5': return over('goals', 2.5)
    case 'goals_over_3_5': return over('goals', 3.5)
    case 'corners_over_8_5': return over('corners', 8.5)
    case 'corners_over_9_5': return over('corners', 9.5)
    case 'corners_over_10_5': return over('corners', 10.5)
    case 'yellows_at_least_4': return over('yellows', 3.5)
    case 'btts': return m.fthg == null ? null : Number(m.fthg > 0 && m.ftag > 0)
    case 'red_home': return m.hr == null ? null : Number(m.hr > 0)
    case 'red_away': return m.ar == null ? null : Number(m.ar > 0)
    case 'outcome': return m.fthg == null ? null : m.fthg > m.ftag ? 0 : m.fthg === m.ftag ? 1 : 2
  }
  return null
}

export const OUTCOME = ['Home win', 'Draw', 'Away win']
