import test from 'node:test'
import assert from 'node:assert/strict'
import { planRoom, DEFAULT_ROOM, validateRoom } from '../../../shared/src/roomPlanner.js'
import { TRACK_PARTS, trackPlanFields, readTrackPlan, traceTrackPlan } from '../../../shared/src/trackPlan.js'

test('room proposals close, contain one CU, respect borders and leave a separate driver row and aisle', () => {
  const { room, proposals } = planRoom(DEFAULT_ROOM)
  assert.ok(proposals.length)
  for (const p of proposals) {
    assert.ok(p.bounds.width <= (room.widthM - 2 * room.edgeM) * 1000)
    assert.ok(p.bounds.depth <= (room.depthM - 2 * room.edgeM - room.driverDepthM - room.aisleM) * 1000)
    assert.equal(p.plan.pieces.filter((p) => p.type === 'Control_unit').length, 1)
    assert.ok(p.plan.pieces.every((p) => TRACK_PARTS[p.type] && p.level === 0 && p.jointDegrees === 0))
    const trace = traceTrackPlan(p.plan)
    assert.ok(trace.gapMm < 1e-6)
    assert.ok(Math.abs(trace.headingErrorDegrees) < 1e-6)
    assert.ok(trace.laneLengthsM.every((n) => n > 0))
    assert.deepEqual(readTrackPlan(trackPlanFields(p.plan).layout).roomPlan, room)
  }
})
test('two-level option creates an overpass with bounded tangent adjustment and sufficient ramp reserve', () => {
  const room = { ...DEFAULT_ROOM, depthM: 6, maxLevels: 2 }
  const p = planRoom(room).proposals.find((p) => p.kind === 'bridge')
  assert.ok(p)
  assert.deepEqual([...new Set(p.plan.pieces.map((p) => p.level))].sort(), [0, 1])
  assert.ok(p.maxJointDegrees <= 1)
  assert.ok((room.levelHeightMm / p.rampRunMm) * 100 <= room.maxGradePercent)
  assert.ok(traceTrackPlan(p.plan).gapMm < 1e-6)
  assert.ok(!planRoom({ ...room, maxLevels: 1 }).proposals.some((p) => p.kind === 'bridge'))
  assert.ok(!planRoom({ ...room, levelHeightMm: 500, maxGradePercent: 1 }).proposals.some((p) => p.kind === 'bridge'))
})
test('insufficient driver space, undersized rooms, and invalid dimensions produce no misleading fit', () => {
  assert.equal(planRoom({ ...DEFAULT_ROOM, widthM: 2 }).reason, 'people')
  assert.equal(
    planRoom({ ...DEFAULT_ROOM, widthM: 2, depthM: 2, drivers: 1, driverDepthM: 0.4, aisleM: 0.4 }).reason,
    'space'
  )
  for (const bad of [{ drivers: 7 }, { widthM: NaN }, { maxLevels: 0 }, { edgeM: -1 }, { drivers: 1.5 }])
    assert.throws(() => validateRoom(bad))
})

test('a saved track reference constrains width and depth in addition to room and people space', () => {
  const room = { ...DEFAULT_ROOM, widthM: 10, depthM: 10, reference: { name: 'Basis', widthM: 3.9, depthM: 2.5 } }
  const result = planRoom(room)
  assert.ok(result.proposals.length)
  for (const p of result.proposals) {
    assert.ok(p.bounds.width <= 3900)
    assert.ok(p.bounds.depth <= 2500)
    assert.deepEqual(readTrackPlan(trackPlanFields(p.plan).layout).roomPlan.reference, room.reference)
  }
  assert.throws(() => validateRoom({ ...room, reference: { name: 'x', widthM: -1, depthM: 2 } }))
})
