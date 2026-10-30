import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXTRA_TRACK_ASSEMBLIES,
  EXTRA_ASSEMBLY_ARTICLES,
  EXTRA_TRACK_PARTS,
  CARRERA_MANUFACTURER_ARTICLES,
  trackArticle,
  emptyTrackPlan,
  traceTrackPlan,
  railRequirements,
  validateRailInventory,
  readTrackPlan,
  serializeTrackPlan,
  freeTrackSelection,
  enableFreePlacement,
  switchGuidePaths,
  applyTrackBorders,
  setFreeBorderEnds,
  borderArticle,
  exportSoftyRoyal,
  exportAutorennbahnTrk,
} from '../../../shared/src/index.js'
const plan = (types) => ({
  ...emptyTrackPlan(),
  geometryProfile: 'prototype',
  pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
})
test('all added switches have matching slots and complete assembly stock identities', () => {
  for (const [key, types] of Object.entries(EXTRA_TRACK_ASSEMBLIES)) {
    for (const profile of ['prototype', 'planner2022']) {
      const p = { ...plan(types), geometryProfile: profile },
        segments = traceTrackPlan(p).segments
      const a = switchGuidePaths(segments[0], profile)[0],
        b = switchGuidePaths(segments[1], profile)[0]
      assert.ok(Math.hypot(a.at(-1)[0] - b[0][0], a.at(-1)[1] - b[0][1]) < 1e-8, key)
    }
    const p = enableFreePlacement(plan(types))
    assert.deepEqual(freeTrackSelection(p, 0), [0, 1])
    assert.equal(railRequirements(p).counts[EXTRA_ASSEMBLY_ARTICLES[key]], 1)
    assert.equal(railRequirements(plan([types[0]])).unresolved.length, 1)
  }
})
test('banked curves keep separate articles, turn direction and bank-specific shoulders', () => {
  for (const type of Object.keys(EXTRA_TRACK_PARTS).filter((t) => t.startsWith('Steilkurve_'))) {
    const p = plan([type]),
      s = traceTrackPlan(p).segments[0],
      k = Number(type.split('_')[1])
    assert.equal(railRequirements(p).counts[trackArticle(type)], 1)
    assert.equal(Math.sign(s.end.h), type.endsWith('links') ? -1 : 1)
    const bordered = setFreeBorderEnds(applyTrackBorders(p, [0], 'both'), [0])
    assert.equal(bordered.pieces[0].borders.left.startCap, false)
    assert.equal(
      borderArticle(type, type.endsWith('links') ? 'left' : 'right'),
      { 1: '20569', 2: '20594', 3: '20595', 4: '20596' }[k]
    )
  }
})
test('new parts survive JSON; missing native mappings fail without silent substitution', () => {
  const p = plan(Object.keys(EXTRA_TRACK_PARTS))
  assert.deepEqual(readTrackPlan(serializeTrackPlan(p)).pieces, p.pieces)
  assert.throws(() => exportSoftyRoyal(p), /JSON/)
  assert.throws(() => exportAutorennbahnTrk(p), /JSON/)
  const stock = validateRailInventory({ version: 1, counts: { '20509': 2 } })
  assert.equal(stock.counts['20574'], 0)
  assert.equal(stock.counts['30363'], 0)
})
test('manufacturer index contains special rails and official source links', () => {
  for (const article of ['30373', '30350', '30351', '30361', '30368', '20517', '20587'])
    assert.ok(
      CARRERA_MANUFACTURER_ARTICLES.some(
        (p) => p.article === article && p.source.startsWith('https://carrera-toys.com/')
      )
    )
  assert.equal(new Set(CARRERA_MANUFACTURER_ARTICLES.map((p) => p.article)).size, CARRERA_MANUFACTURER_ARTICLES.length)
})
