import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PROP_KEY, buildProps, compare, convolve, mean, over, settle, suggestions } from './props.ts'

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

test('distribution arithmetic', () => {
  const p = [0.2, 0.5, 0.3]
  close(mean(p), 1.1)
  close(over(p, 0.5), 0.8)
  close(over(p, 1.5), 0.3)
  const c = compare([0.5, 0.5], [1, 0])        // home 0 or 1, away always 0
  close(c.home, 0.5); close(c.level, 0.5); close(c.away, 0)
  close(convolve([0.5, 0.5], [0.5, 0.5]).reduce((a, b) => a + b, 0), 1)
  close(convolve([0.5, 0.5], [0.5, 0.5])[1], 0.5)
})

test('stored lists cut short of 100% are scaled before use', () => {
  close(over([0.4, 0.4, 0.1995], 0.5), 0.5995 / 0.9995)
})

const input = {
  home: 'Arsenal', away: 'Leeds',
  sides: { corners: { home: [0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05], away: [0.1, 0.2, 0.3, 0.2, 0.1, 0.1] } },
  outcome: [0.67, 0.2, 0.13], btts: 0.45,
  reliable: (t: string) => t !== 'btts' && t !== 'corners_total',
}

test('propositions cover result, team lines, totals and comparisons, with consistent pairs', () => {
  const props = buildProps(input)
  const by = (k: string) => props.find(p => p.key === k)!
  close(by('dc:HD').p, 0.87)
  close(by('tot:corners:over:6.5').p + by('tot:corners:under:6.5').p, 1)
  assert.ok(by('cmp:corners:home').p > by('cmp:corners:away').p)
  assert.equal(by('cmp:corners:home').label, 'Arsenal more corners than Leeds')
  assert.equal(by('tot:corners:over:9.5').reliable, false)
  assert.equal(by('cmp:corners:home').reliable, true)
  assert.equal(by('btts:yes').reliable, false)
  for (const p of props) {
    assert.match(p.key, PROP_KEY)
    assert.ok(p.p >= -1e-9 && p.p <= 1 + 1e-9)
  }
})

test('suggestions: likely but not near-certain, reliable first, varied', () => {
  const s = suggestions(buildProps(input))
  assert.ok(s.length >= 3 && s.length <= 5)
  assert.ok(s.every(p => p.p >= 0.6 && p.p <= 0.85))
  assert.ok(s.some(p => p.key.startsWith('cmp:')), 'includes a team-against-team pick')
  const fam = s.map(p => p.family)
  assert.equal(new Set(fam).size, fam.length)
  const firstUnreliable = s.findIndex(p => !p.reliable)
  if (firstUnreliable >= 0) assert.ok(s.slice(firstUnreliable).every(p => !p.reliable))
})

test('settling saved predictions against final statistics', () => {
  const m = { fthg: 2, ftag: 1, hc: 7, ac: 3, hy: 1, ay: 2, hs: 15, as: 8, hst: 6, ast: 2 }
  assert.equal(settle('res:H', m), true)
  assert.equal(settle('dc:DA', m), false)
  assert.equal(settle('btts:yes', m), true)
  assert.equal(settle('tot:goals:over:2.5', m), true)
  assert.equal(settle('tot:corners:under:9.5', m), false)
  assert.equal(settle('team:away:yellows:over:1.5', m), true)
  assert.equal(settle('cmp:corners:home', m), true)
  assert.equal(settle('cmp:shots:away', m), false)
  assert.equal(settle('tot:corners:over:9.5', { fthg: 1, ftag: 0, hc: null, ac: 3 }), null)
})
