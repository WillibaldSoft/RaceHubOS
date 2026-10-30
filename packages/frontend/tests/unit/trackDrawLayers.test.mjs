import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  traceTrackPlan,
  trackDrawItems,
  borderShapes,
  changeTrackDrawLayer,
  serializeTrackPlan,
  readTrackPlan,
  railRequirements,
  trackFootprint,
  validateTrackPlan,
  editFreeParts,
  applyTrackBorders,
} from '../../../shared/src/index.js'
const native = () => JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url)))
const classic = () =>
  JSON.parse(
    fs.readFileSync(new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
const items = (p) => {
  const t = traceTrackPlan(p)
  return trackDrawItems(p, t.segments, borderShapes(p, t.segments))
}
const geometry = (p) => {
  const t = traceTrackPlan(p)
  return {
    points: t.segments.map((s) => s.points),
    lanes: t.laneLengthsM,
    footprint: trackFootprint(p),
    counts: railRequirements(p),
  }
}
test('physical layers precede import paint order; schematic pit stays below the bridge', () => {
  const p = native()
  p.pieces[0].level = 1
  p.pieces[0].paintOrder = 0
  p.pieces[1].level = 0
  p.pieces[1].paintOrder = 12000
  const a = items(p)
  assert.ok(
    a.findIndex((s) => s.drawKind === 'rail' && s.index === 1) <
      a.findIndex((s) => s.drawKind === 'rail' && s.index === 0)
  )
  const c = classic(),
    b = items(c),
    pit = b.findIndex((s) => s.drawKind === 'schematic')
  assert.ok(pit >= 0)
  assert.ok(b.every((s, i) => s.level !== 1 || i > pit))
})
test('rail, native component and independent shoulder offsets persist without geometry or stock changes', () => {
  const p = native(),
    before = JSON.stringify(p),
    g = geometry(p)
  let q = changeTrackDrawLayer(p, { indices: [3] }, 1)
  q = changeTrackDrawLayer(q, { target: 'extra', extraIndex: 7 }, -1)
  q = changeTrackDrawLayer(q, { indices: [0], target: 'left' }, -1)
  assert.equal(q.pieces[3].drawLayer, 1)
  assert.equal(q.trackExtras[7].drawLayer, -1)
  assert.equal(q.pieces[0].borders.left.drawLayer, -1)
  assert.deepEqual(geometry(q), g)
  assert.equal(JSON.stringify(p), before)
  const r = readTrackPlan(serializeTrackPlan(q))
  assert.equal(r.trackExtras[7].drawLayer, -1)
  assert.equal(r.pieces[0].borders.left.drawLayer, -1)
  const order = items(r)
  assert.ok(
    order.findIndex((s) => s.drawKind === 'border' && s.index === 0 && s.side === 'left') <
      order.findIndex((s) => s.drawKind === 'rail' && s.index === 0)
  )
  assert.equal(changeTrackDrawLayer(r, { indices: [3] }, null).pieces[3].drawLayer, undefined)
  assert.equal(editFreeParts(r, 3, 'replace', ['Standardgerade']).plan.pieces[3].drawLayer, 1)
  assert.equal(applyTrackBorders(r, [0], 'both').pieces[0].borders.left.drawLayer, -1)
})
test('offset validation is bounded and does not accept untrusted non-integer data', () => {
  for (const bad of [NaN, Infinity, '1', 1.5, -21, 21]) {
    const p = native()
    p.pieces[0].drawLayer = bad
    assert.throws(() => validateTrackPlan(p))
    const q = native()
    q.trackExtras[0].drawLayer = bad
    assert.throws(() => validateTrackPlan(q))
    const r = native()
    r.pieces[0].borders.left.drawLayer = bad
    assert.throws(() => validateTrackPlan(r))
  }
  const p = classic(),
    q = changeTrackDrawLayer(p, { target: 'pit' }, -1)
  assert.equal(readTrackPlan(serializeTrackPlan(q)).pit.drawLayer, -1)
  assert.deepEqual(geometry(p), geometry(q))
})
