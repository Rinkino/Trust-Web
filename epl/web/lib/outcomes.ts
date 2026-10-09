// The model's most likely outcomes per market, computed from the stored predictive
// distributions (no new modelling here). Kept free of framework imports so it can be
// unit-tested with node --test.

export type Pick = { label: string; p: number }

/** Ranges for each match total: [low, high], high = null means "or more". */
export const BINS: Record<string, { unit: [string, string]; bins: [number, number | null][] }> = {
  goals: { unit: ['goal', 'goals'], bins: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, null]] },
  corners: { unit: ['corner', 'corners'], bins: [[0, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, null]] },
  yellows: { unit: ['yellow card', 'yellow cards'], bins: [[0, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, null]] },
  shots: { unit: ['shot', 'shots'], bins: [[0, 17], [18, 21], [22, 25], [26, 29], [30, 33], [34, null]] },
  sot: { unit: ['shot on target', 'shots on target'], bins: [[0, 5], [6, 7], [8, 9], [10, 11], [12, null]] },
}

export function binLabel([lo, hi]: [number, number | null], unit: [string, string]): string {
  if (hi === null) return `${lo} or more ${unit[1]}`
  if (lo === 0 && hi > 0) return `${hi} or fewer ${unit[1]}`
  if (lo === hi) return `${lo} ${lo === 1 ? unit[0] : unit[1]}`
  return `${lo}–${hi} ${unit[1]}`
}

/** Probability of each range from P(total = 0), P(total = 1), ... The stored list is cut
 * once 99.95% is covered; the remainder belongs to the open-ended top range. */
export function binProbs(pmf: number[], bins: [number, number | null][]): number[] {
  const total = pmf.reduce((a, b) => a + b, 0)
  return bins.map(([lo, hi]) => {
    if (hi === null) return Math.max(0, 1 - pmf.slice(0, lo).reduce((a, b) => a + b, 0))
    return pmf.slice(lo, hi + 1).reduce((a, b) => a + b, 0) / (total > 1 ? total : 1)
  })
}

export function top3(picks: Pick[]): Pick[] {
  return [...picks].sort((a, b) => b.p - a.p).slice(0, 3)
}

export function totalPicks(stat: keyof typeof BINS | string, pmf: number[] | undefined | null): Pick[] | null {
  const def = BINS[stat]
  if (!def || !pmf || pmf.length === 0) return null
  const probs = binProbs(pmf, def.bins)
  return top3(def.bins.map((b, i) => ({ label: binLabel(b, def.unit), p: probs[i] })))
}

export function resultPicks(outcome: number[] | undefined | null, home: string, away: string): Pick[] | null {
  if (!outcome || outcome.length !== 3) return null
  return top3([{ label: `${home} win`, p: outcome[0] }, { label: 'Draw', p: outcome[1] }, { label: `${away} win`, p: outcome[2] }])
}

export function scorePicks(top: number[][] | undefined | null, home: string, away: string): Pick[] | null {
  if (!top || top.length === 0) return null
  return top.slice(0, 3).map(([h, a, p]) => ({ label: `${home} ${h}–${a} ${away}`, p }))
}
