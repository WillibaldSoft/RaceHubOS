import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  replacePitlaneSwitch,
  rotatePitlaneSwitch,
  traceTrackPlan,
  editablePitlane,
} from '../../../shared/src/index.js'
const fixture = () => JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url)))
test('secondary native switch replacement preserves carrier, all other pieces and lane lengths', () => {
  const p = fixture(),
    n = replacePitlaneSwitch(p, 3, 'Pit_stop_weiche_ende')
  assert.equal(n.trackExtras[3].kind, 'pitExit')
  assert.deepEqual(n.pieces, p.pieces)
  assert.deepEqual(
    n.trackExtras.filter((_, i) => i !== 3),
    p.trackExtras.filter((_, i) => i !== 3)
  )
  assert.deepEqual(traceTrackPlan(n).laneLengthsM, traceTrackPlan(p).laneLengthsM)
  assert.equal(
    rotatePitlaneSwitch(rotatePitlaneSwitch(p, 3), 3).trackExtras[3].placement.headingDegrees,
    p.trackExtras[3].placement.headingDegrees
  )
  assert.throws(() => replacePitlaneSwitch(p, 4, 'Pit_stop_weiche_ende'))
})
test('paired root carrier follows replacement; grouped components require release', () => {
  const p = fixture()
  assert.equal(replacePitlaneSwitch(p, 0, 'Pit_stop_weiche_ende').pieces[0].type, 'Pit_stop_weiche_ende')
  p.partGroups = { groups: [[0, 1]], nextId: 1 }
  assert.throws(() => replacePitlaneSwitch(p, 0, 'Pit_stop_weiche_ende'))
})

test('legacy boxes become independently replaceable without changing the main circuit', () => {
  const p = JSON.parse(
    fs.readFileSync(new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const { plan: n, ids } = editablePitlane(p)
  assert.equal(n.pit.native, true)
  assert.deepEqual(n.pieces, p.pieces)
  assert.deepEqual(traceTrackPlan(n).laneLengthsM, traceTrackPlan(p).laneLengthsM)
  assert.equal(n.trackExtras[ids['pit-entry']].kind, 'pitEntry')
  assert.equal(n.trackExtras[ids['pit-exit']].kind, 'pitExit')
  assert.equal(n.trackExtras.filter((e) => e.kind === 'pitEntry').length, 2)
  assert.equal(n.trackExtras.filter((e) => e.kind === 'pitExit').length, 2)
})
