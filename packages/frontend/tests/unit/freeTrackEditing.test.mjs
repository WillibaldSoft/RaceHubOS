import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  emptyTrackPlan,
  traceTrackPlan,
  validateTrackPlan,
  serializeTrackPlan,
  trackPlanFields,
  trackLapDistanceM,
} from '../../../shared/src/trackPlan.js'
import {
  enableFreePlacement,
  transformFreeParts,
  snapFreeParts,
  editFreeParts,
  freeTrackSelection,
} from '../../../shared/src/freeTrackEditing.js'
const straight = () => ({
  ...emptyTrackPlan(),
  pieces: [0, 1].map(() => ({
    type: 'Standardgerade',
    level: 0,
    jointDegrees: 0,
  })),
})
const circle = () => ({
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 6 }, () => ({
    type: 'Kurve_1_60_rechts',
    level: 0,
    jointDegrees: 0,
  })),
})
test('free conversion preserves old drawing; moving and rotating one part leaves neighbours in place and serializes coordinates', () => {
  const old = straight(),
    original = JSON.stringify(old),
    free = enableFreePlacement(old)
  assert.deepEqual(traceTrackPlan(free).segments[0].points, traceTrackPlan(old).segments[0].points)
  const moved = transformFreeParts(free, [1], {
    dx: 100,
    dy: 80,
    degrees: 15,
    pivotX: 345,
    pivotY: 0,
  })
  assert.deepEqual(moved.pieces[0], free.pieces[0])
  assert.equal(moved.pieces[1].placement.headingDegrees, 15)
  assert.equal(moved.pieces[1].placement.xMm, 445)
  assert.deepEqual(validateTrackPlan(JSON.parse(serializeTrackPlan(moved))).pieces, moved.pieces)
  assert.equal(JSON.stringify(old), original)
  assert.equal(trackPlanFields(moved).length, null)
  assert.equal(trackLapDistanceM({ layout: serializeTrackPlan(moved), length: 42 }), null)
})
test('compatible nearby connectors snap to the exact point and angle; occupied and other-level connectors do not attract', () => {
  const free = enableFreePlacement(straight()),
    moved = transformFreeParts(free, [1], {
      dx: 20,
      dy: 25,
      degrees: 12,
      pivotX: 345,
      pivotY: 0,
    })
  const snapped = snapFreeParts(moved, [1])
  assert.ok(snapped.snap)
  assert.ok(Math.abs(snapped.plan.pieces[1].placement.xMm - 345) < 1e-8)
  assert.ok(Math.abs(snapped.plan.pieces[1].placement.yMm) < 1e-8)
  assert.equal(snapped.plan.pieces[1].placement.headingDegrees, 0)
  const high = structuredClone(moved)
  high.pieces[1].level = 1
  assert.equal(snapFreeParts(high, [1]).snap, null)
  assert.equal(snapFreeParts(transformFreeParts(free, [1], { dx: 1000, dy: 1000 }), [1]).snap, null)
  const three = {
      ...straight(),
      pieces: Array.from({ length: 3 }, () => ({
        type: 'Standardgerade',
        level: 0,
        jointDegrees: 0,
      })),
    },
    four = editFreeParts(three, -1, 'after', ['Standardgerade'], {
      xMm: 350,
      yMm: 20,
      headingDegrees: 0,
    })
  assert.equal(snapFreeParts(four.plan, [3]).snap, null)
})
test('closed circuit uses geometric connectivity and reverse traversal for both slots', () => {
  const old = circle(),
    free = enableFreePlacement(old),
    trace = traceTrackPlan(free)
  assert.equal(trace.connectivity.closed, true)
  const reversed = structuredClone(free),
    s = trace.segments[1]
  reversed.pieces[1] = {
    ...reversed.pieces[1],
    type: 'Kurve_1_60_links',
    placement: {
      xMm: s.end.x,
      yMm: s.end.y,
      headingDegrees: (((s.end.h * 180) / Math.PI + 360) % 360) - 180,
    },
  }
  const actual = traceTrackPlan(reversed)
  assert.equal(actual.connectivity.closed, true)
  assert.ok(actual.connectivity.route.some((p) => p.reverse))
  actual.laneLengthsM.forEach((n, i) => assert.ok(Math.abs(n - trace.laneLengthsM[i]) < 1e-8))
  const detached = transformFreeParts(free, [1], { dx: 500 })
  assert.equal(traceTrackPlan(detached).connectivity.closed, false)
  assert.equal(trackPlanFields(detached).length, null)
})
test('disconnected closed loops and ambiguous endpoints are not a race circuit', () => {
  const free = enableFreePlacement(circle()),
    second = transformFreeParts(free, [0, 1, 2, 3, 4, 5], { dx: 3000 })
  const two = { ...free, pieces: [...free.pieces, ...second.pieces] }
  const t = traceTrackPlan(two)
  assert.equal(t.connectivity.components, 2)
  assert.equal(t.connectivity.closed, false)
  assert.equal(trackPlanFields(two).length, null)
  const duplicate = {
    ...free,
    pieces: [...free.pieces, { ...free.pieces[0] }],
  }
  assert.ok(traceTrackPlan(duplicate).connectivity.ambiguousPorts > 0)
  assert.equal(traceTrackPlan(duplicate).connectivity.closed, false)
})
test('new pieces can be dropped anywhere and complete pit assembly moves rigidly', () => {
  const placed = editFreeParts(emptyTrackPlan(), -1, 'after', ['Standardgerade'], {
    xMm: 1200,
    yMm: 900,
    headingDegrees: 90,
  })
  assert.deepEqual(placed.plan.pieces[0].placement, {
    xMm: 1200,
    yMm: 900,
    headingDegrees: 90,
  })
  const photo = JSON.parse(
      fs.readFileSync(
        new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)
      )
    ),
    selection = freeTrackSelection(photo, photo.pit.entry)
  assert.ok(selection.includes(photo.pit.merge))
  assert.ok(selection.some((i) => photo.pieces[i].type === 'Control_unit'))
  const free = enableFreePlacement(photo),
    moved = transformFreeParts(free, selection, { dx: 500, dy: 100 })
  for (const i of selection) {
    assert.ok(Math.abs(moved.pieces[i].placement.xMm - free.pieces[i].placement.xMm - 500) < 1e-7)
  }
  assert.throws(() =>
    validateTrackPlan({
      ...free,
      pieces: [
        {
          ...free.pieces[0],
          placement: { xMm: NaN, yMm: 0, headingDegrees: 0 },
        },
      ],
    })
  )
})
test('free insertion and replacement retain every other absolute pose; exports preserve coordinates', async () => {
  const plan = enableFreePlacement(straight()),
    before = editFreeParts(plan, 1, 'before', ['Drittelgerade'])
  assert.deepEqual(before.plan.pieces[0], plan.pieces[0])
  assert.deepEqual(before.plan.pieces[2], plan.pieces[1])
  assert.equal(before.plan.pieces[1].placement.xMm, 230)
  const replaced = editFreeParts(plan, 0, 'replace', ['Kurve_4_15_rechts'])
  assert.deepEqual(replaced.plan.pieces[1], plan.pieces[1])
  assert.deepEqual(replaced.plan.pieces[0].placement, plan.pieces[0].placement)
  const { exportSoftyRoyal, importSoftyRoyalExport } = await import('../../../shared/src/softyRoyal.js'),
    { exportAutorennbahnTrk } = await import('../../../shared/src/trackTrk.js')
  const moved = transformFreeParts(plan, [1], {
    dx: 200,
    dy: 400,
    degrees: 15,
  })
  assert.deepEqual(importSoftyRoyalExport(exportSoftyRoyal(moved).file).pieces, moved.pieces)
  assert.throws(() => exportAutorennbahnTrk(moved), /Free placement/)
})
