import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  emptyTrackPlan,
  traceTrackPlan,
  validateTrackPlan,
  trackPlanFields,
  readTrackPlan,
  trackSpeedKmh,
  trackLapDistanceM,
  importTrackTrk,
} from '../../../shared/src/trackPlan.js'
const plan = (types) => ({
  ...emptyTrackPlan(),
  pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
})
test('closed K1 circle has exact separate inner/outer lengths and no fitted geometry', () => {
  const p = plan(Array(6).fill('Kurve_1_60_rechts')),
    r = traceTrackPlan(p)
  assert.ok(r.gapMm < 1e-9)
  assert.ok(Math.abs(r.laneLengthsM[0] - (2 * Math.PI * 348.5) / 1000) < 1e-12)
  assert.ok(Math.abs(r.laneLengthsM[1] - (2 * Math.PI * 249.5) / 1000) < 1e-12)
  const left = traceTrackPlan(plan(Array(6).fill('Kurve_1_60_links')))
  assert.deepEqual(left.laneLengthsM, r.laneLengthsM.toReversed())
})
test('server fields recompute lengths, preserve measured provenance and round trip pit', () => {
  const p = plan(['Standardgerade', 'Control_unit'])
  p.pit.enabled = true
  p.pit.merge = 1
  const saved = trackPlanFields(p),
    loaded = readTrackPlan(saved.layout)
  assert.equal(saved.length, 0.69)
  assert.deepEqual(traceTrackPlan(loaded).laneLengthsM, [0.69, 0.69])
  assert.equal(loaded.pit.enabled, true)
  const tampered = JSON.parse(saved.layout)
  tampered.laneLengthsM = [999, 999]
  assert.equal(trackPlanFields(tampered).length, 0.69)
  p.measuredLaneLengthsM = [10, 11]
  assert.equal(trackPlanFields(p).length, 10.5)
  assert.equal(trackSpeedKmh(10, 10000), 3.6)
  assert.equal(trackSpeedKmh(10, 0), null)
})
test('original quarter and curved switch dimensions; unknown parts are rejected', () => {
  assert.deepEqual(traceTrackPlan(plan(['Viertelgerade'])).laneLengthsM, [0.087, 0.087])
  const r = traceTrackPlan(plan(['Kurvenweiche_rechts_ai_1', 'Kurvenweiche_rechts_ai_2']))
  assert.ok(Math.abs(r.segments[1].end.x - (345 + 299 * Math.sin(Math.PI / 3))) < 1e-9)
  assert.throws(() => validateTrackPlan(plan(['unknown'])))
  assert.equal(readTrackPlan('legacy layout A'), null)
  const bad = plan(['Standardgerade'])
  bad.pieces[0].jointDegrees = Infinity
  assert.throws(() => validateTrackPlan(bad))
})
test('Fröhlichring template preserves the closed prototype mainline and double pit', () => {
  const p = readTrackPlan(
    fs.readFileSync(
      new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  assert.equal(p.pieces.length, 55)
  assert.ok(p.pit.enabled)
  assert.ok(traceTrackPlan(p).gapMm < 0.001)
  const curve = p.pieces.findIndex((p) => p.type === 'Kurvenweiche_rechts_ai_2')
  assert.equal(p.pieces[curve + 1].type, 'Kurve_1_60_rechts')
  assert.equal(p.pieces[curve + 2].type, 'AdapterUnit')
  assert.equal(p.pieces[curve + 3].type, 'Pit_stop_weiche_anfang')
})
test('TRK first sequence imports strictly and rejects unsupported data', () => {
  assert.equal(
    importTrackTrk('Bahnsystem=Digital 132&ItemNumber_1=1&teile_Typ_1=Startteil;Standardgerade').pieces.length,
    1
  )
  assert.throws(() => importTrackTrk('Bahnsystem=Digital 132&ItemNumber_1=1&teile_Typ_1=Startteil;unknown'))
})
test('photo sequence: separated entry switches, bays alongside CU, then merge and shared exit', () => {
  const p = readTrackPlan(
    fs.readFileSync(
      new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  const { segments } = traceTrackPlan(p),
    entry = segments[p.pit.entry].start
  const project = (point) => (point.x - entry.x) * Math.cos(entry.h) + (point.y - entry.y) * Math.sin(entry.h)
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)
  const afterEntry = p.pieces.slice(p.pit.entry).map((p) => p.type)
  assert.deepEqual(afterEntry, ['Pit_stop_weiche_anfang', 'Standardgerade', 'Standardgerade', 'Control_unit'])
  const cu = segments.find((s) => s.type === 'Control_unit')
  const split = 345 + p.pit.spacingMm,
    transition = 345,
    mergeEnd = split + p.pit.bayLengthMm
  close(split, 690)
  close(split + transition, project(cu.start))
  close(mergeEnd - transition, project(cu.end))
  close(mergeEnd, 1725)
  close(project(segments[p.pit.merge].start), mergeEnd)
  close(project(segments[p.pit.merge].end), mergeEnd + 345)
  // 99mm single-lane surfaces touch the two-lane 198mm road, then each other.
  close(148.5 - 49.5, 198 / 2)
  close(247.5 - 49.5, 148.5 + 49.5)
})

test('round speed uses the mean of saved lanes and actual milliseconds, not a controller lane', () => {
  const p = plan(['Standardgerade'])
  p.measuredLaneLengthsM = [16, 18]
  const track = { layout: trackPlanFields(p).layout, length: null }
  assert.equal(trackLapDistanceM(track), 17)
  assert.equal(trackSpeedKmh(trackLapDistanceM(track), 10000), 6.12)
  assert.equal(trackSpeedKmh(trackLapDistanceM(track), 5000), 12.24)
  assert.equal(trackLapDistanceM({ ...track, length: 20 }), 20) // Explicit manual measurement overrides the plan estimate.
})
test('round speed handles legacy distances and absent/invalid data safely', () => {
  assert.equal(trackLapDistanceM({ length: 20 }), 20)
  for (const track of [null, {}, { length: 0 }, { length: -1 }, { length: Infinity }, { length: '20' }])
    assert.equal(trackLapDistanceM(track), null)
  for (const ms of [0, -1, Infinity, NaN, null, undefined]) assert.equal(trackSpeedKmh(17, ms), null)
  assert.equal(trackLapDistanceM({ layout: trackPlanFields(plan([])).layout }), null)
})
