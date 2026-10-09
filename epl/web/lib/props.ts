// Plain-language predictions ("Arsenal more corners than Leeds", "Over 1.5 goals") with the
// model's chance for each, computed from the stored distributions of each team. Nothing here
// is a new model: every number is arithmetic on what the pipeline published. Kept free of
// framework imports so it can be unit-tested with node --test.

export type Stat = 'goals' | 'corners' | 'yellows' | 'shots' | 'sot'
export const STATS: Stat[] = ['goals', 'corners', 'yellows', 'shots', 'sot']

export const STAT_INFO: Record<Stat, { name: string; one: string; many: string; total: number[]; team: number[] }> = {
  goals: { name: 'Goals', one: 'goal', many: 'goals', total: [0.5, 1.5, 2.5, 3.5, 4.5], team: [0.5, 1.5, 2.5] },
  corners: { name: 'Corners', one: 'corner', many: 'corners', total: [6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5], team: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5] },
  yellows: { name: 'Cards', one: 'yellow card', many: 'yellow cards', total: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5], team: [0.5, 1.5, 2.5, 3.5] },
  shots: { name: 'Shots', one: 'shot', many: 'shots', total: [18.5, 20.5, 22.5, 24.5, 26.5, 28.5, 30.5], team: [7.5, 9.5, 11.5, 13.5, 15.5, 17.5] },
  sot: { name: 'On target', one: 'shot on target', many: 'shots on target', total: [5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5], team: [2.5, 3.5, 4.5, 5.5, 6.5] },
}

export type Sides = { home: number[]; away: number[] }
export type Prop = {
  key: string          // stable id, also how a saved prediction is settled (see settle())
  family: string       // used to keep suggestions varied
  stat: Stat | 'result'
  label: string
  p: number
  reliable: boolean    // the model beat the league average for this kind of number in testing
}

/** Probabilities scaled to add up to 1 (stored lists are cut once 99.95% is covered). */
export function norm(p: number[]): number[] {
  const s = p.reduce((a, b) => a + b, 0)
  return s > 0 ? p.map(x => x / s) : p
}
export const mean = (p: number[]) => norm(p).reduce((a, x, i) => a + i * x, 0)
/** P(X > line) for a half line such as 2.5. */
export function over(p: number[], line: number): number {
  return norm(p).reduce((a, x, i) => a + (i > line ? x : 0), 0)
}
/** Two independent counts: P(home > away), P(equal), P(away > home). */
export function compare(h: number[], a: number[]): { home: number; level: number; away: number } {
  const ph = norm(h), pa = norm(a)
  let home = 0, level = 0, away = 0
  ph.forEach((x, i) => pa.forEach((y, j) => {
    if (i > j) home += x * y; else if (i === j) level += x * y; else away += x * y
  }))
  return { home, level, away }
}
export function convolve(h: number[], a: number[]): number[] {
  const out = new Array(h.length + a.length - 1).fill(0)
  norm(h).forEach((x, i) => norm(a).forEach((y, j) => { out[i + j] += x * y }))
  return out
}

const fmt = (line: number) => String(line)

export type PropInput = {
  home: string; away: string
  sides: Partial<Record<Stat, Sides>>
  outcome?: number[] | null          // [H, D, A]
  btts?: number | null
  reliable: (target: string) => boolean
}

export function buildProps(x: PropInput): Prop[] {
  const out: Prop[] = []
  const { home: H, away: A } = x
  if (x.outcome && x.outcome.length === 3) {
    const [h, d, a] = x.outcome
    const r = x.reliable('outcome')
    out.push(
      { key: 'res:H', family: 'result', stat: 'result', label: `${H} win`, p: h, reliable: r },
      { key: 'res:D', family: 'result', stat: 'result', label: 'Draw', p: d, reliable: r },
      { key: 'res:A', family: 'result', stat: 'result', label: `${A} win`, p: a, reliable: r },
      { key: 'dc:HD', family: 'result', stat: 'result', label: `${H} win or draw`, p: h + d, reliable: r },
      { key: 'dc:DA', family: 'result', stat: 'result', label: `${A} win or draw`, p: d + a, reliable: r },
      { key: 'dc:HA', family: 'result', stat: 'result', label: 'Either team wins (no draw)', p: h + a, reliable: r },
    )
  }
  if (x.btts != null) {
    out.push(
      { key: 'btts:yes', family: 'btts', stat: 'goals', label: 'Both teams score', p: x.btts, reliable: x.reliable('btts') },
      { key: 'btts:no', family: 'btts', stat: 'goals', label: 'At least one team fails to score', p: 1 - x.btts, reliable: x.reliable('btts') },
    )
  }
  for (const s of STATS) {
    const sd = x.sides[s]
    if (!sd) continue
    const info = STAT_INFO[s]
    const total = convolve(sd.home, sd.away)
    const rt = x.reliable(`${s}_total`)
    for (const line of info.total) {
      const p = over(total, line)
      out.push({ key: `tot:${s}:over:${fmt(line)}`, family: `tot:${s}`, stat: s, label: `Over ${fmt(line)} ${info.many}`, p, reliable: rt })
      out.push({ key: `tot:${s}:under:${fmt(line)}`, family: `tot:${s}`, stat: s, label: `Under ${fmt(line)} ${info.many}`, p: 1 - p, reliable: rt })
    }
    for (const side of ['home', 'away'] as const) {
      const team = side === 'home' ? H : A
      const r = x.reliable(`${s}_${side}`)
      for (const line of info.team) {
        const p = over(sd[side], line)
        out.push({ key: `team:${side}:${s}:over:${fmt(line)}`, family: `team:${side}:${s}`, stat: s, label: `${team} over ${fmt(line)} ${info.many}`, p, reliable: r })
        out.push({ key: `team:${side}:${s}:under:${fmt(line)}`, family: `team:${side}:${s}`, stat: s, label: `${team} under ${fmt(line)} ${info.many}`, p: 1 - p, reliable: r })
      }
    }
    if (s !== 'goals') {  // for goals this is the match result
      const c = compare(sd.home, sd.away)
      const r = x.reliable(`${s}_home`) && x.reliable(`${s}_away`)
      out.push(
        { key: `cmp:${s}:home`, family: `cmp:${s}`, stat: s, label: `${H} more ${info.many} than ${A}`, p: c.home, reliable: r },
        { key: `cmp:${s}:away`, family: `cmp:${s}`, stat: s, label: `${A} more ${info.many} than ${H}`, p: c.away, reliable: r },
      )
    }
  }
  return out
}

/** Chances in this range make a useful suggestion: likely, but not a near-certainty
 * nobody needs telling (such as "over 0.5 goals"). */
export const SUGGEST_RANGE: [number, number] = [0.6, 0.85]

const KIND_ORDER = ['cmp', 'tot', 'result', 'team', 'btts'] as const
const kindOf = (p: Prop) => (p.key.startsWith('res:') || p.key.startsWith('dc:') ? 'result' : p.key.split(':')[0])

/** The model's best 3-5 suggestions, varied: it takes the most likely candidate of each kind
 * in turn (team against team, match total, result, one team's total, both teams to score),
 * statistics it predicts better than the league average before the others, never two of the
 * same family (one line per statistic and team) and at most two per statistic. */
export function suggestions(props: Prop[], max = 5): Prop[] {
  const pool = props.filter(p => p.p >= SUGGEST_RANGE[0] && p.p <= SUGGEST_RANGE[1])
    .sort((a, b) => Number(b.reliable) - Number(a.reliable) || b.p - a.p)
  const picked: Prop[] = []
  const families = new Set<string>()
  const perStat: Record<string, number> = {}
  const ok = (p: Prop) => !families.has(p.family) && (perStat[p.stat] ?? 0) < 2
  const take = (p: Prop) => {
    picked.push(p); families.add(p.family); perStat[p.stat] = (perStat[p.stat] ?? 0) + 1
  }
  // Round-robin over kinds until full or nothing is left.
  for (let round = 0; round < max && picked.length < max; round++) {
    let added = false
    for (const kind of KIND_ORDER) {
      if (picked.length >= max) break
      const next = pool.find(p => kindOf(p) === kind && ok(p) && (p.reliable || round > 0))
      if (next) { take(next); added = true }
    }
    if (!added && round > 0) break
  }
  return picked.sort((a, b) => Number(b.reliable) - Number(a.reliable) || b.p - a.p)
}

/** Settle a saved prediction against the final statistics. null: not settled (missing data). */
export function settle(key: string, m: Record<string, number | null | undefined>): boolean | null {
  const cols: Record<Stat, [string, string]> = {
    goals: ['fthg', 'ftag'], corners: ['hc', 'ac'], yellows: ['hy', 'ay'], shots: ['hs', 'as'], sot: ['hst', 'ast'],
  }
  const val = (s: Stat, side: 'home' | 'away') => m[cols[s][side === 'home' ? 0 : 1]]
  const parts = key.split(':')
  const gh = m.fthg, ga = m.ftag
  if (parts[0] === 'res' || parts[0] === 'dc' || parts[0] === 'btts') {
    if (gh == null || ga == null) return null
    const r = gh > ga ? 'H' : gh === ga ? 'D' : 'A'
    if (parts[0] === 'res') return r === parts[1]
    if (parts[0] === 'dc') return parts[1].includes(r)
    return (gh > 0 && ga > 0) === (parts[1] === 'yes')
  }
  if (parts[0] === 'tot') {
    const [, s, dir, line] = parts as [string, Stat, string, string]
    const h = val(s, 'home'), a = val(s, 'away')
    if (h == null || a == null) return null
    return dir === 'over' ? h + a > Number(line) : h + a < Number(line)
  }
  if (parts[0] === 'team') {
    const [, side, s, dir, line] = parts as [string, 'home' | 'away', Stat, string, string]
    const v = val(s, side)
    if (v == null) return null
    return dir === 'over' ? v > Number(line) : v < Number(line)
  }
  if (parts[0] === 'cmp') {
    const [, s, who] = parts as [string, Stat, string]
    const h = val(s, 'home'), a = val(s, 'away')
    if (h == null || a == null) return null
    return who === 'home' ? h > a : a > h
  }
  return null
}

/** Accepted keys (the same grammar the database settles). */
export const PROP_KEY = /^(res:[HDA]|dc:(HD|DA|HA)|btts:(yes|no)|tot:(goals|corners|yellows|shots|sot):(over|under):\d{1,2}\.5|team:(home|away):(goals|corners|yellows|shots|sot):(over|under):\d{1,2}\.5|cmp:(corners|yellows|shots|sot):(home|away))$/
