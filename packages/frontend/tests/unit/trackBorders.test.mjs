import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, validateTrackPlan, serializeTrackPlan, traceTrackPlan } from '../../../shared/src/trackPlan.js'
import { applyTrackBorders, borderArticle } from '../../../shared/src/trackBorders.js'
import { borderShapes, trackFootprint, borderConflicts } from '../../../shared/src/trackBorderGeometry.js'
import { trackBounds, planRoom } from '../../../shared/src/roomPlanner.js'
import { railRequirements, validateRailInventory, emptyRailInventory } from '../../../shared/src/railInventory.js'
import { enableFreePlacement, transformFreeParts } from '../../../shared/src/freeTrackEditing.js'
const straight = () => ({ ...emptyTrackPlan(), pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }] })
test('legacy plans and inventory remain unchanged; shoulders round-trip without changing lanes', () => {
  const p = straight(),
    before = JSON.stringify(p),
    old = traceTrackPlan(p),
    fitted = applyTrackBorders(p, [0], 'both')
  assert.equal(JSON.stringify(p), before)
  assert.equal(validateTrackPlan(p).pieces[0].borders, undefined)
  assert.deepEqual(traceTrackPlan(fitted).laneLengthsM, old.laneLengthsM)
  assert.deepEqual(validateTrackPlan(JSON.parse(serializeTrackPlan(fitted))), validateTrackPlan(fitted))
  const oldStock = validateRailInventory({ version: 1, counts: { '20509': 10 } })
  assert.equal(oldStock.counts['20560'], 0)
  assert.equal(railRequirements(fitted).counts['20560'], 2)
  assert.equal(railRequirements(p).counts['20560'], 0)
  assert.equal(emptyRailInventory().counts['20598'], 0)
  assert.throws(() => validateTrackPlan({ ...p, pieces: [{ ...p.pieces[0], borders: { left: { startCap: 'yes' } } }] }))
})
test('curve shoulders match radius, angle and inner/outer direction including curved switch', () => {
  for (const [k, a, outer, inner] of [
    [1, 30, '20567', '20590'],
    [1, 60, '20561', '20551'],
    [2, 30, '20562', '20591'],
    [3, 30, '20563', '20592'],
    [4, 15, '20568', '20593'],
  ])
    for (const d of ['links', 'rechts']) {
      const type = `Kurve_${k}_${a}_${d}`
      assert.equal(borderArticle(type, d === 'rechts' ? 'left' : 'right'), outer)
      assert.equal(borderArticle(type, d === 'rechts' ? 'right' : 'left'), inner)
    }
  assert.equal(borderArticle('Kurvenweiche_rechts_ai_2', 'left'), '20561')
  assert.equal(borderArticle('Drittelgerade', 'left'), '20588')
  assert.equal(borderArticle('Viertelgerade', 'right'), '20589')
})
test('physical footprint and room reserve grow by actual shoulders and rounded end-piece dimensions', () => {
  const p = straight(),
    both = applyTrackBorders(p, [0], 'both')
  assert.equal(trackFootprint(p).depth, 198)
  assert.equal(trackFootprint(both).depth, 396)
  assert.equal(trackBounds(p).depth, 398)
  assert.equal(trackBounds(both).depth, 596)
  both.pieces[0].borders.left.startCap = true
  both.pieces[0].borders.right.endCap = true
  assert.equal(trackFootprint(both).width, 622)
  assert.equal(railRequirements(both).counts['20598'], 2)
  const free = enableFreePlacement(both),
    moved = transformFreeParts(free, [0], { dx: 500, dy: 200, degrees: 90 })
  assert.equal(borderShapes(moved).length, 4)
  assert.ok(Math.abs(trackFootprint(moved).depth - 622) < 1e-6)
  assert.equal(railRequirements(moved).counts['20598'], 2)
})
test('shoulder collisions are detected on the same level, while the bridge stays separate', () => {
  const p = enableFreePlacement(straight())
  p.pieces.push({ ...p.pieces[0], placement: { xMm: 0, yMm: 250, headingDegrees: 0 } })
  assert.equal(borderConflicts(p).length, 0)
  const withBorder = applyTrackBorders(p, [0], 'both')
  assert.equal(borderConflicts(withBorder).length, 1)
  withBorder.pieces[1].level = 1
  assert.equal(borderConflicts(withBorder).length, 0)
  const joined = enableFreePlacement({ ...straight(), pieces: Array.from({ length: 2 }, () => straight().pieces[0]) })
  assert.equal(borderConflicts(applyTrackBorders(joined, [0, 1], 'both')).length, 0)
  const adjusted = applyTrackBorders(
    {
      ...straight(),
      pieces: [
        { type: 'Kurve_3_30_links', level: 0 },
        { type: 'Kurve_4_15_links', level: 0, jointDegrees: 0.1 },
      ],
    },
    [0, 1],
    'both'
  )
  assert.equal(borderConflicts(adjusted).length, 0)
})
test('double-pit occupied side is omitted and room proposals include shoulder stock and dimensions', () => {
  const p = {
    ...straight(),
    pieces: [
      { type: 'Pit_stop_weiche_anfang', level: 0 },
      { type: 'Control_unit', level: 0 },
      { type: 'Pit_stop_weiche_ende', level: 0 },
    ],
    pit: { ...straight().pit, enabled: true, entry: 0, merge: 2 },
  }
  assert.ok(applyTrackBorders(p, [0, 1, 2], 'both').pieces.every((p) => p.borders.left && !p.borders.right))
  const result = planRoom({ widthM: 7, depthM: 6, drivers: 1, borderMode: 'both' })
  assert.ok(result.proposals.length)
  for (const v of result.proposals) {
    assert.ok(v.plan.pieces.every((p) => p.borders.left && p.borders.right))
    assert.ok(v.requirements.counts['20560'] > 0)
    assert.ok(v.bounds.width <= 6550)
    assert.equal(borderConflicts(v.plan).length, 0)
  }
})
test('foreign shoulders are checked against the actual parallel pit road, not only the main course', () => {
  const p = enableFreePlacement({
    ...straight(),
    pieces: Array.from({ length: 6 }, (_, i) => ({
      type: i === 0 ? 'Pit_stop_weiche_anfang' : i === 5 ? 'Pit_stop_weiche_ende' : 'Standardgerade',
      level: 0,
    })),
    pit: { ...straight().pit, enabled: true, entry: 0, merge: 5, spacingMm: 345, bayLengthMm: 1035 },
  })
  p.pieces.push({
    type: 'Standardgerade',
    level: 0,
    jointDegrees: 0,
    placement: { xMm: 900, yMm: 450, headingDegrees: 0 },
  })
  const equipped = applyTrackBorders(p, [6], 'left')
  assert.ok(borderConflicts(equipped).some((c) => c.otherPit))
  equipped.pieces[6].level = 1
  assert.equal(borderConflicts(equipped).length, 0)
})

test('20598 has a 138.5mm rounded run-out, mirrored start/end and left/right outlines', () => {
  const p = applyTrackBorders(straight(), [0], 'both')
  p.pieces[0].borders.left.startCap = true
  p.pieces[0].borders.right.startCap = true
  const ends = borderShapes(p).filter((s) => s.kind === 'startCap')
  assert.equal(ends.length, 2)
  assert.equal(ends[0].points.length, 34)
  assert.deepEqual(ends[0].points.at(-1), [-138.5, -99])
  assert.deepEqual(ends[1].points.at(-1), [-138.5, 99])
  assert.ok(Math.abs(ends[0].points[17][0] + 110.8) < 1e-8)
  assert.ok(Math.abs(ends[0].points[17][1] + 154.6875) < 1e-8)
  const bounds = trackBounds(p)
  assert.equal(bounds.x, -238.5)
  assert.equal(trackFootprint(p).width, 483.5)
})
