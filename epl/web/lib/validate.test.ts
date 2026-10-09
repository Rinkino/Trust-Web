import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, parseDemoRequest, parseHistoryFilter } from './validate.ts'
import { actualFor } from './format.ts'

test('demo request accepts only known modes', () => {
  assert.deepEqual(parseDemoRequest(undefined), { ok: true, mode: 'auto' })
  assert.deepEqual(parseDemoRequest({ mode: 'live' }), { ok: true, mode: 'live' })
  assert.equal(parseDemoRequest({ mode: 'drop table' }).ok, false)
  assert.equal(parseDemoRequest({ mode: 'live', seed: 'x' }).ok, false)
  assert.equal(parseDemoRequest([1]).ok, false)
  assert.equal(parseDemoRequest('live').ok, false)
})

test('history filters drop anything unexpected', () => {
  const f = parseHistoryFilter({ season: '2025-26', team: "Nott'm Forest", model: 'glm', target: 'btts', page: '3' }, ['btts'])
  assert.deepEqual(f, { season: '2025-26', team: "Nott'm Forest", model: 'glm', target: 'btts', page: 3 })
  const g = parseHistoryFilter({ season: "2025'; drop", team: '<script>', model: 'evil', target: 'nope', page: '-4' }, ['btts'])
  assert.deepEqual(g, { season: undefined, team: undefined, model: 'selected', target: undefined, page: 1 })
})

test('csv cells are escaped and formula-safe', () => {
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell(-1.5), '-1.5')
  assert.equal(csvCell(null), '')
})

test('actual values mirror the python definitions', () => {
  const m = { fthg: 2, ftag: 1, hc: 6, ac: 4, hy: 2, ay: 2, hr: 0, ar: 1, hs: 10, as: 8, hst: 4, ast: 3 }
  assert.equal(actualFor('goals_total', m), 3)
  assert.equal(actualFor('goals_over_2_5', m), 1)
  assert.equal(actualFor('corners_over_9_5', m), 1)
  assert.equal(actualFor('yellows_at_least_4', m), 1)
  assert.equal(actualFor('btts', m), 1)
  assert.equal(actualFor('red_away', m), 1)
  assert.equal(actualFor('outcome', m), 0)
})
