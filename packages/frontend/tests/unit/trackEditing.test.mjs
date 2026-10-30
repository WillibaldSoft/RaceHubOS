import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { editTrackPieces, trackSelection, TRACK_ASSEMBLIES } from '../../../shared/src/trackEditing.js'
import { emptyTrackPlan, traceTrackPlan } from '../../../shared/src/trackPlan.js'
const source = JSON.parse(
  fs.readFileSync(new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
)
test('graphical insertion remaps both pit anchors and clears stale measured lengths without mutating source', () => {
  const original = JSON.stringify(source),
    p = { ...source, measuredLaneLengthsM: [17, 18] }
  const a = editTrackPieces(p, 0, 'before', ['Standardgerade'])
  assert.equal(a.plan.pit.entry, source.pit.entry + 1)
  assert.equal(a.plan.pit.merge, source.pit.merge + 1)
  assert.equal(a.plan.pit.enabled, true)
  assert.equal(a.plan.measuredLaneLengthsM, null)
  assert.equal(JSON.stringify(source), original)
  const b = editTrackPieces(source, 10, 'delete')
  assert.equal(b.plan.pit.entry, source.pit.entry - 1)
  assert.equal(b.plan.pit.merge, source.pit.merge)
  assert.equal(b.plan.pit.enabled, true)
  const c = editTrackPieces(source, source.pit.entry, 'replace', ['Standardgerade'])
  assert.equal(c.plan.pit.enabled, false)
})
test('complete switch assemblies select, replace and delete together; adjoining rails remain present', () => {
  const i = source.pieces.findIndex((p) => p.type === 'DigitaleDoppelweiche_1')
  assert.deepEqual(trackSelection(source, i + 1), [i, i + 1])
  const a = editTrackPieces(source, i + 1, 'replace', TRACK_ASSEMBLIES.curved)
  assert.deepEqual(
    a.plan.pieces.slice(i, i + 2).map((p) => p.type),
    TRACK_ASSEMBLIES.curved
  )
  assert.equal(a.plan.pieces[i + 2].type, source.pieces[i + 2].type)
  const b = editTrackPieces(a.plan, i, 'delete')
  assert.equal(b.plan.pieces.length, source.pieces.length - 2)
})
test('placing the first and following rails produces real catalogue lengths; all edits validate', () => {
  const a = editTrackPieces(emptyTrackPlan(), -1, 'after', ['Standardgerade'])
  const b = editTrackPieces(a.plan, 0, 'after', ['Standardgerade'])
  assert.deepEqual(traceTrackPlan(b.plan).laneLengthsM, [0.69, 0.69])
  assert.throws(() => editTrackPieces(b.plan, 0, 'replace', ['invented']))
})
