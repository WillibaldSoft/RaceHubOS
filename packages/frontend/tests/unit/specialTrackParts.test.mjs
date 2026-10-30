import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  emptyTrackPlan,
  traceTrackPlan,
  serializeTrackPlan,
  readTrackPlan,
  railRequirements,
  emptyRailInventory,
  transferRailRequirements,
  enableFreePlacement,
  snapFreeParts,
  transformFreeParts,
  applyTrackBorders,
  trackFootprint,
  exportSoftyRoyal,
  exportAutorennbahnTrk,
  CARRERA_MANUFACTURER_ARTICLES,
  CARRERA_RAILS,
} from '../../../shared/src/index.js'
const plan = (types) => ({ ...emptyTrackPlan(), pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })) })
test('narrow complete modules merge onto one shared slot and return to nominal two-lane ports', () => {
  for (const side of ['links', 'rechts']) {
    const p = plan([`Engstelle_${side}_${side === 'links' ? '30350' : '30351'}`]),
      s = traceTrackPlan(p).segments[0],
      branch = s.points[side === 'links' ? 2 : 1],
      straight = s.points[side === 'links' ? 1 : 2],
      sign = side === 'links' ? 1 : -1
    assert.deepEqual(s.end, { x: 1380, y: 0, h: 0 })
    assert.equal(s.modules, 4)
    assert.equal(branch[0][1], 49.5 * sign)
    assert.equal(branch.at(-1)[1], 49.5 * sign)
    assert.ok(branch.some(([x, y]) => x === 345 && y === -16.5 * sign))
    assert.ok(branch.some(([x, y]) => x === 460 && y === -49.5 * sign))
    assert.ok(branch.some(([x, y]) => x === 920 && y === -49.5 * sign))
    assert.equal(straight[0][1], -49.5 * sign)
    assert.equal(s.laneLengthsM[side === 'links' ? 0 : 1], 1.38)
    assert.ok(s.laneLengthsM[side === 'links' ? 1 : 0] > 1.39)
    const bounds = trackFootprint(p, false)
    assert.equal(bounds.width, 1380)
    assert.equal(bounds.depth, 198)
    assert.deepEqual(readTrackPlan(serializeTrackPlan(p)).pieces, p.pieces)
  }
})
test('chicane remains two separate slots, with declared approximate internal curve and three module length', () => {
  const s = traceTrackPlan(plan(['Schikane_30373'])).segments[0]
  assert.equal(s.end.x, 1035)
  assert.equal(s.modules, 3)
  assert.equal(s.approximateSlots, true)
  assert.equal(s.laneLengthsM[0], 1.035)
  assert.ok(s.laneLengthsM[1] > 1.035)
  assert.equal(Math.min(...s.points[2].map((p) => p[1])), -16.5)
  assert.equal(s.points[2][0][1], 49.5)
  assert.equal(s.points[2].at(-1)[1], 49.5)
})
test('special assemblies snap at ordinary two-lane ends and reject fake standard shoulders and exports', () => {
  const p = enableFreePlacement(plan(['Engstelle_links_30350', 'Standardgerade']))
  const moved = transformFreeParts(p, [1], { dx: 12, dy: 8 }),
    snapped = snapFreeParts(moved, [1]).plan,
    s = traceTrackPlan(snapped).segments
  assert.ok(Math.hypot(s[1].start.x - s[0].end.x, s[1].start.y - s[0].end.y) < 1e-8)
  assert.equal(applyTrackBorders(p, [0], 'both').pieces[0].borders, undefined)
  assert.throws(() => exportSoftyRoyal(p), /JSON/)
  assert.throws(() => exportAutorennbahnTrk(p), /JSON/)
})
test('inventory transfer supports replace and add, counts complete assemblies, validates overflow and preserves plan', () => {
  const p = plan(['Schikane_30373', 'Engstelle_links_30350', 'Engstelle_rechts_30351', 'Standardgerade']),
    before = JSON.stringify(p),
    stock = emptyRailInventory()
  stock.counts['20509'] = 5
  const replace = transferRailRequirements(stock, p, 'replace').inventory,
    add = transferRailRequirements(stock, p, 'add').inventory
  assert.equal(replace.counts['20509'], 1)
  assert.equal(add.counts['20509'], 6)
  for (const id of ['30373', '30350', '30351']) assert.equal(add.counts[id], 1)
  assert.equal(stock.counts['20509'], 5)
  assert.equal(JSON.stringify(p), before)
  assert.throws(() => transferRailRequirements(stock, p, 'bad'))
  stock.counts['20509'] = 2000
  assert.throws(() => transferRailRequirements(stock, p, 'add'))
  for (const p of CARRERA_MANUFACTURER_ARTICLES)
    assert.ok(CARRERA_RAILS.some((r) => r.article === p.article || (r.aliases || []).includes(p.article)))
})
test('existing Froehlichring geometry and hidden placeholders are preserved without phantom stock', () => {
  const p = JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url))),
    before = JSON.stringify(p)
  assert.deepEqual(traceTrackPlan(p).laneLengthsM, [16.867399720613978, 16.86739972061398])
  assert.equal(railRequirements(p).counts['30341'], 1)
  assert.equal(railRequirements(p).counts['30361'], 2)
  assert.equal(JSON.stringify(p), before)
})
