import { test } from 'node:test'
import assert from 'node:assert/strict'
import { binLabel, binProbs, BINS, resultPicks, scorePicks, totalPicks } from './outcomes.ts'

test('ranges cover every total exactly once and their chances add up to 1', () => {
  for (const { bins } of Object.values(BINS)) {
    assert.equal(bins[0][0], 0)
    for (let i = 1; i < bins.length; i++) assert.equal(bins[i][0], (bins[i - 1][1] as number) + 1)
    assert.equal(bins[bins.length - 1][1], null)
  }
  const pmf = [0.05, 0.15, 0.25, 0.25, 0.15, 0.1, 0.04] // cut before the tail (sums to 0.99)
  const probs = binProbs(pmf, BINS.goals.bins)
  assert.ok(Math.abs(probs.reduce((a, b) => a + b, 0) - 1) < 1e-9)
  assert.ok(Math.abs(probs[5] - (1 - 0.85)) < 1e-9) // "5 or more" takes the cut-off tail
})

test('top three outcomes are the three most likely, best first', () => {
  const t = totalPicks('goals', [0.08, 0.2, 0.27, 0.22, 0.13, 0.06, 0.03, 0.01])!
  assert.deepEqual(t.map(x => x.label), ['2 goals', '3 goals', '1 goal'])
  assert.ok(t[0].p >= t[1].p && t[1].p >= t[2].p)
  assert.equal(totalPicks('goals', undefined), null)
  assert.equal(totalPicks('saves', [0.5, 0.5]), null) // no saves data: nothing to show
})

test('labels read naturally', () => {
  assert.equal(binLabel([0, 5], BINS.corners.unit), '5 or fewer corners')
  assert.equal(binLabel([8, 9], BINS.corners.unit), '8–9 corners')
  assert.equal(binLabel([14, null], BINS.corners.unit), '14 or more corners')
  assert.equal(binLabel([1, 1], BINS.goals.unit), '1 goal')
  assert.equal(binLabel([0, 0], BINS.goals.unit), '0 goals')
})

test('result and score picks keep the model numbers', () => {
  assert.deepEqual(resultPicks([0.2, 0.3, 0.5], 'A', 'B')!.map(x => x.label), ['B win', 'Draw', 'A win'])
  assert.deepEqual(scorePicks([[1, 1, 0.12], [2, 1, 0.1], [1, 0, 0.09], [0, 0, 0.08]], 'A', 'B')!.map(x => x.label),
    ['A 1–1 B', 'A 2–1 B', 'A 1–0 B'])
})
