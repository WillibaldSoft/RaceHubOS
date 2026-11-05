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
