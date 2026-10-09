import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelPick, parsePicksRequest, points } from './picks.ts'
import { drivers, factValue, headline, type Explanation } from './explain.ts'

const KEY = 'a'.repeat(64)

test('pick requests accept only well-formed input', () => {
  assert.equal(parsePicksRequest({ action: 'list', key: KEY }).ok, true)
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: '2026-27_arsenal_leeds', pick: 'H' }).ok, true)
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: '2026-27_arsenal_leeds', pick: 'H', home_goals: 2, away_goals: 1 }).ok, true)
  // score must agree with the picked result
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: '2026-27_arsenal_leeds', pick: 'A', home_goals: 2, away_goals: 1 }).ok, false)
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: '2026-27_arsenal_leeds', pick: 'H', home_goals: 2 }).ok, false)
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: '2026-27_arsenal_leeds', pick: 'X' }).ok, false)
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: "x'; drop table", pick: 'H' }).ok, false)
  assert.equal(parsePicksRequest({ action: 'list', key: 'short' }).ok, false)
  // signed in: the key is optional, except for claiming a browser's picks
  assert.equal(parsePicksRequest({ action: 'list' }).ok, false)
  assert.equal(parsePicksRequest({ action: 'list' }, true).ok, true)
  assert.equal(parsePicksRequest({ action: 'save', match_id: '2026-27_arsenal_leeds', pick: 'H' }, true).ok, true)
  assert.equal(parsePicksRequest({ action: 'claim' }, true).ok, false)
  assert.equal(parsePicksRequest({ action: 'claim', key: KEY }).ok, false)
  assert.equal(parsePicksRequest({ action: 'claim', key: KEY }, true).ok, true)
  assert.equal(parsePicksRequest({ action: 'list', key: KEY, extra: 1 }).ok, false)
  assert.equal(parsePicksRequest({ action: 'save', key: KEY, match_id: '2026-27_arsenal_leeds', pick: 'H', home_goals: 1.5, away_goals: 0 }).ok, false)
})

test('scoring: 1 for the result, 2 more for the exact score', () => {
  assert.equal(points('H', null, [2, 1]), 1)
  assert.equal(points('H', [2, 1], [2, 1]), 3)
  assert.equal(points('H', [3, 1], [2, 1]), 1)
  assert.equal(points('D', [1, 1], [2, 1]), 0)
})

test('the model picks its most likely result and the likeliest score that agrees with it', () => {
  // 1-1 is the single likeliest score, but the model favours a home win, so its score is 1-0
  const m = modelPick([0.5, 0.27, 0.23], [[1, 1, 0.13], [1, 0, 0.11], [2, 1, 0.09]])
  assert.deepEqual(m, { pick: 'H', prob: 0.5, score: [1, 0] })
  assert.equal(modelPick(null), null)
  assert.deepEqual(modelPick([0.2, 0.3, 0.5], [[1, 1, 0.1]])?.score, null)
})

const E: Explanation = {
  method: 'glm_log_linear_decomposition', stat: 'goals', model_name: 'glm', baseline_expected: 1.4,
  groups: [],
  sides: {
    home: { expected: 2.03, factors: { attack: 1.18, opp_defence: 1.09, venue: 1.07, schedule: 1.004 } },
    away: { expected: 0.95, factors: { attack: 0.92, venue: 0.94, promoted: 0.998 } },
  },
  facts: { home: {}, away: {} }, fact_labels: {}, league: {},
}

test('explanations list only effects of 3% or more, largest first, with the real numbers', () => {
  const h = drivers(E, 'home', 'Brighton', 'Crystal Palace')
  assert.deepEqual(h.big.map(d => d.key), ['attack', 'opp_defence', 'venue'])
  assert.equal(h.small, 1)
  assert.match(h.big[0].text, /^Brighton's recent attacking/)
  assert.match(h.big[1].text, /^Crystal Palace's recent defending/)
  assert.equal(Math.round(h.big[0].pct * 100), 18)
  const a = drivers(E, 'away', 'Brighton', 'Crystal Palace')
  assert.deepEqual(a.big.map(d => d.key), ['attack', 'venue'])
  assert.equal(a.big[1].text, 'Playing away from home')
})

test('headline wording follows the probabilities', () => {
  assert.match(headline([0.63, 0.2, 0.17], 'Brighton', 'Palace'), /Brighton are clear favourites, with a 63%/)
  assert.match(headline([0.41, 0.27, 0.32], 'Sunderland', 'Leeds'), /Sunderland are favourites/)
  assert.match(headline([0.36, 0.33, 0.31], 'A', 'B'), /close call/)
  assert.equal(factValue('position', 3), '3rd')
  assert.equal(factValue('promoted', 0), 'No')
  assert.equal(factValue('elo', 1532.4), '1532')
})
