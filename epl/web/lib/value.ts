// Reading the betting evaluation (epl_value_backtest). Kept free of framework imports so
// it can be unit-tested with node --test.

export type ValueMetrics = {
  bets: number; matches?: number; wins?: number; win_rate?: number; avg_odds?: number; avg_break_even?: number
  avg_model_prob?: number; avg_ev?: number; avg_edge?: number; pnl?: number; roi?: number; roi_ci?: [number, number] | null
  max_drawdown?: number; clv_n?: number; clv_mean?: number | null; clv_positive_share?: number | null
}
export type ValueQuality = {
  matches: number; log_loss: number; brier: number; avg_overround: number
  calibration: { lo: number; hi: number; n: number; mean_p: number; freq: number }[]
}
export type ValueRow = {
  run_key: string; split: 'validation' | 'test' | 'live'; season: string; model_name: string; model_version: string | null
  role: 'baseline' | 'existing_model' | 'market' | 'other'; market: '1x2' | 'ou25'; price_source: string
  strategy: string; strategy_config: Record<string, number | string>; eligible_selections: number; eligible_matches: number
  metrics: ValueMetrics; quality: ValueQuality; period_start: string | null; period_end: string | null
  methodology: string; created_at: string
}

/** Fewer bets than this are reported but never described as evidence either way. */
export const MIN_BETS_FOR_VERDICT = 200

export type Verdict = { kind: 'none' | 'small' | 'loses' | 'unclear' | 'positive' | 'advantage'; text: string }

/** Plain-language reading of one strategy result. The interval, not the bet count, decides:
 * the count only rules out samples too small to read at all. A positive interval counts as
 * evidence of an advantage only on matches never used to choose models or strategies. */
export function verdict(m: ValueMetrics | undefined, split: string = 'validation'): Verdict {
  if (!m || m.bets === 0) return { kind: 'none', text: 'No bets passed the filters.' }
  const roi = m.roi ?? 0
  const ci = m.roi_ci
  if (m.bets < MIN_BETS_FOR_VERDICT || !ci) {
    return { kind: 'small', text: `Insufficient sample: ${m.bets} bets is too few to tell skill from luck.` }
  }
  const r = `${signed(roi)} per unit staked (95% range ${signed(ci[0])} to ${signed(ci[1])}, ${m.matches ?? '?'} matches)`
  if (ci[1] < 0) return { kind: 'loses', text: `Lost money: ${r}.` }
  if (ci[0] <= 0) return { kind: 'unclear', text: `Inconclusive: ${r}. Neither a gain nor a loss is established.` }
  if (split === 'validation') {
    return { kind: 'positive', text: `Positive historical result: ${r}, on seasons that were also used to choose the model.` }
  }
  return { kind: 'advantage', text: `Evidence of an advantage on unseen matches: ${r}. Still subject to uncertainty and further testing.` }
}

export const VERDICT_TAG: Record<Verdict['kind'], [string, string]> = {
  none: ['no bets', 'warn'], small: ['too few', 'warn'], loses: ['lost money', 'bad'], unclear: ['inconclusive', 'warn'],
  positive: ['positive in sample', 'warn'], advantage: ['evidence of edge', 'good'],
}

export type Coverage = { season: string; completed_matches: number; stage: string; bookmaker: string; market: string; with_odds: number }

export function signed(x: number | null | undefined, digits = 1): string {
  if (x == null || Number.isNaN(x)) return '—'
  const v = x * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

export const ROLE_LABEL: Record<string, string> = {
  baseline: 'A · League average',
  existing_model: 'B · Our model',
  market: 'C · Bookmaker market',
  other: 'Other model',
}
export const ROLE_ORDER = ['baseline', 'existing_model', 'market']

export const PRICE_LABEL: Record<string, string> = {
  best: 'Best price across bookmakers',
  average: 'Average price across bookmakers',
  bet365: 'Bet365',
  pinnacle: 'Pinnacle',
}
export const MARKET_LABEL: Record<string, string> = { '1x2': 'Match result (home / draw / away)', ou25: 'Over / under 2.5 goals' }

export const STRATEGY_LABEL: Record<string, string> = {
  ev_0: 'Every positive-EV selection',
  ev_5: 'EV at least +5%',
  ev_10: 'EV at least +10%',
  filtered: 'EV ≥ 5%, edge ≥ 2 pts, probability ≥ 15%, 200+ earlier selections in its probability band',
}

/** The latest run's rows for one view. */
export function pick(rows: ValueRow[], f: { split: string; season: string; market: string; price: string }) {
  return rows.filter(r => r.split === f.split && r.season === f.season && r.market === f.market && r.price_source === f.price)
}
