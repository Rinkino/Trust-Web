import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN_BETS_FOR_VERDICT, signed, verdict } from './value.ts'

test('small samples are never read as evidence', () => {
  const v = verdict({ bets: 31, roi: 0.263, roi_ci: [-0.5, 1.1] })
  assert.equal(v.kind, 'small')
  assert.match(v.text, /too few/)
})

test('an interval entirely below zero is a loss', () => {
  assert.equal(verdict({ bets: 730, roi: -0.096, roi_ci: [-0.21, -0.02] }).kind, 'loses')
})

test('an interval spanning zero is unclear, a positive one is never called profitable', () => {
  assert.equal(verdict({ bets: MIN_BETS_FOR_VERDICT, roi: 0.02, roi_ci: [-0.08, 0.12] }).kind, 'unclear')
  const p = verdict({ bets: 900, roi: 0.05, roi_ci: [0.01, 0.09] })
  assert.equal(p.kind, 'positive')
  assert.doesNotMatch(p.text, /profitable/i)
  assert.match(p.text, /Not proof/)
})

test('no bets', () => {
  assert.equal(verdict({ bets: 0 }).kind, 'none')
  assert.equal(verdict(undefined).kind, 'none')
})

test('signed percentages', () => {
  assert.equal(signed(0.128), '+12.8%')
  assert.equal(signed(-0.096), '-9.6%')
  assert.equal(signed(null), '—')
})
