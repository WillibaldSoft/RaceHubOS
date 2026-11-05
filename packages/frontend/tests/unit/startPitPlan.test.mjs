import test from 'node:test'
import assert from 'node:assert/strict'
import { createStartPitPlan } from '../../../../addons/track-planner/src/components/startPitPlan.js'
import {
  validateTrackPlan,
  emptyTrackPlan,
  traceTrackPlan,
  freeTrackSelection,
  exportSoftyRoyal,
  importSoftyRoyalExport,
  editablePitlane,
  transformFreeParts,
} from '../../../shared/src/index.js'
test('start setup preserves room, fits the modular pit, exports and groups all six rails', () => {
  const source = emptyTrackPlan(),
    before = JSON.stringify(source)
  const plan = createStartPitPlan(source)
  assert.equal(JSON.stringify(source), before)
  assert.equal(validateTrackPlan(plan).pieces.length, 6)
  assert.deepEqual(freeTrackSelection(plan, 2), [0, 1, 2, 3, 4, 5])
  const trace = traceTrackPlan(plan)
  assert.equal(trace.segments[5].end.x - trace.segments[0].start.x, 2070)
  assert.equal(plan.pieces[2].type, 'Control_unit')
  const imported = importSoftyRoyalExport(exportSoftyRoyal(plan).file)
  assert.equal(imported.pieces.length, 6)
  assert.throws(() => createStartPitPlan(plan), /empty/)
})

test('anti-collision metadata is opt-in, validated and survives native JSON and SBP exchange', () => {
  let plan = createStartPitPlan()
  plan = {
    ...plan,
    showAntiCollision: true,
    pieces: plan.pieces.map((p, i) => (i === 0 ? { ...p, antiCollision: true } : p)),
  }
  assert.equal(validateTrackPlan(JSON.parse(JSON.stringify(plan))).pieces[0].antiCollision, true)
  assert.equal(importSoftyRoyalExport(exportSoftyRoyal(plan).file).pieces[0].antiCollision, true)
  assert.equal(validateTrackPlan({ ...plan, showAntiCollision: false }).pieces[0].antiCollision, true)
  assert.throws(() => validateTrackPlan({ ...plan, showAntiCollision: 'yes' }), /display/)
  assert.throws(
    () => validateTrackPlan({ ...plan, pieces: [{ type: 'Standardgerade', antiCollision: true }] }),
    /anti-collision/
  )
})

test('native pit switch metadata survives validation and moving the complete assembly', () => {
  const source = editablePitlane(createStartPitPlan()).plan
  const index = source.trackExtras.findIndex((p) => p.kind === 'pitEntry')
  const plan = {
    ...source,
    trackExtras: source.trackExtras.map((p, i) => (i === index ? { ...p, antiCollision: true } : p)),
  }
  const moved = transformFreeParts(plan, [0, 1, 2, 3, 4, 5], { dx: 100 })
  assert.equal(validateTrackPlan(moved).trackExtras[index].antiCollision, true)
  assert.throws(
    () => validateTrackPlan({ ...plan, trackExtras: [{ ...plan.trackExtras[index], antiCollision: 1 }] }),
    /anti-collision/
  )
})
