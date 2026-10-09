// Mirrors epl/ml/eplpred/config.py TARGETS. Order is the display order.
export type TargetKind = 'count' | 'probability' | 'outcome'
export type Target = { key: string; kind: TargetKind; label: string; group: string }

const count = (stat: string, label: string, group: string): Target[] => [
  { key: `${stat}_home`, kind: 'count', label: `Home ${label}`, group },
  { key: `${stat}_away`, kind: 'count', label: `Away ${label}`, group },
  { key: `${stat}_total`, kind: 'count', label: `Total ${label}`, group },
]

export const TARGETS: Target[] = [
  ...count('goals', 'goals', 'Goals'),
  { key: 'outcome', kind: 'outcome', label: 'Match result (H/D/A)', group: 'Goals' },
  { key: 'goals_over_1_5', kind: 'probability', label: 'Over 1.5 goals', group: 'Goals' },
  { key: 'goals_over_2_5', kind: 'probability', label: 'Over 2.5 goals', group: 'Goals' },
  { key: 'goals_over_3_5', kind: 'probability', label: 'Over 3.5 goals', group: 'Goals' },
  { key: 'btts', kind: 'probability', label: 'Both teams score', group: 'Goals' },
  ...count('shots', 'shots', 'Shots'),
  ...count('sot', 'shots on target', 'Shots'),
  ...count('corners', 'corners', 'Corners'),
  { key: 'corners_over_8_5', kind: 'probability', label: 'Over 8.5 corners', group: 'Corners' },
  { key: 'corners_over_9_5', kind: 'probability', label: 'Over 9.5 corners', group: 'Corners' },
  { key: 'corners_over_10_5', kind: 'probability', label: 'Over 10.5 corners', group: 'Corners' },
  ...count('yellows', 'yellow cards', 'Cards'),
  { key: 'yellows_at_least_4', kind: 'probability', label: '4+ yellow cards', group: 'Cards' },
  { key: 'red_home', kind: 'probability', label: 'Home red card', group: 'Cards' },
  { key: 'red_away', kind: 'probability', label: 'Away red card', group: 'Cards' },
]
export const TARGET_BY_KEY = Object.fromEntries(TARGETS.map(t => [t.key, t])) as Record<string, Target>
export const GROUPS = ['Goals', 'Shots', 'Corners', 'Cards']

export const MODEL_LABEL: Record<string, string> = {
  baseline: 'Baseline (league average)',
  team_avg: 'A · Team averages',
  poisson_strength: 'B · Poisson team strength',
  glm: 'C · Poisson GLM',
  hgb: 'C · Gradient boosting',
  logit_outcome: 'C · Logistic (result)',
  hgb_outcome: 'C · Boosted classifier (result)',
  market: 'Market odds (reference)',
  selected: 'Selected per target',
}
export const MODEL_SHORT: Record<string, string> = {
  baseline: 'Baseline', team_avg: 'Team avg', poisson_strength: 'Poisson', glm: 'GLM', hgb: 'GBM',
  logit_outcome: 'Logit', hgb_outcome: 'GBM clf', market: 'Market', selected: 'Selected',
}
export const MODEL_ORDER = ['baseline', 'team_avg', 'poisson_strength', 'glm', 'logit_outcome', 'hgb', 'hgb_outcome', 'market']

export const PRIMARY: Record<TargetKind, 'mae' | 'log_loss'> = { count: 'mae', probability: 'log_loss', outcome: 'log_loss' }
