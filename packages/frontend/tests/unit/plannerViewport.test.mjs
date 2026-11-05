import test from 'node:test'
import assert from 'node:assert/strict'
import { trackViewport } from '../../../../addons/track-planner/src/components/trackViewport.js'
import {
  repeatedTrackPreview,
  placeRepeatedTrackPart,
} from '../../../../addons/track-planner/src/components/repeatTrackPlacement.js'
import { emptyTrackPlan, enableFreePlacement, traceTrackPlan } from '../../../shared/src/index.js'
test('fit contains the entire footprint at wide, square and portrait canvas sizes', () => {
  const bounds = { x: -900, y: -1700, width: 8200, depth: 3600 }
  for (const viewport of [
    { width: 1100, height: 560 },
    { width: 580, height: 550 },
    { width: 360, height: 400 },
    { width: 700, height: 200 },
  ]) {
    const [x, y, w, h] = trackViewport(bounds, viewport)
    assert.ok(x <= bounds.x && y <= bounds.y)
    assert.ok(x + w >= bounds.x + bounds.width && y + h >= bounds.y + bounds.depth)
    assert.ok(Math.abs(w / h - viewport.width / viewport.height) < 1e-10)
  }
})
test('zoom and pan retain the same centre and viewport proportions', () => {
  const b = { x: 0, y: 0, width: 3000, depth: 700 },
    v = { width: 800, height: 420 }
  const a = trackViewport(b, v),
    z = trackViewport(b, v, 2, { x: 120, y: -70 })
  assert.equal(z[2], a[2] / 2)
  assert.equal(z[3], a[3] / 2)
  assert.equal(z[0] + z[2] / 2, a[0] + a[2] / 2 + 120)
  assert.equal(z[1] + z[3] / 2, a[1] + a[3] / 2 - 70)
})
test('repeat placement snaps to open ends, preserves the source and refuses exact duplicate stamps', () => {
  const p = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }],
  })
  const before = JSON.stringify(p),
    preview = repeatedTrackPreview(p, ['Standardgerade'], { x: 350, y: 4 })
  assert.equal(preview.snapped, true)
  assert.equal(preview.pose.xMm, 345)
  assert.equal(preview.pose.yMm, 0)
  const q = placeRepeatedTrackPart(p, ['Standardgerade'], preview)
  assert.equal(q.placed, true)
  assert.equal(q.plan.pieces.length, 2)
  assert.equal(JSON.stringify(p), before)
  assert.equal(traceTrackPlan(q.plan).connectivity.openPorts.length, 2)
  const duplicate = repeatedTrackPreview(q.plan, ['Standardgerade'], { x: 345, y: 0 }, { snap: false })
  assert.equal(duplicate.occupied, true)
  assert.equal(placeRepeatedTrackPart(q.plan, ['Standardgerade'], duplicate).placed, false)
})
test('repeat placement stamps complete switch assemblies and inherits level and rotation', () => {
  const preview = repeatedTrackPreview(
    emptyTrackPlan(),
    ['DigitaleDoppelweiche_1', 'DigitaleDoppelweiche_2'],
    { x: 400, y: 300 },
    { headingDegrees: 90, level: 1, snap: false }
  )
  const result = placeRepeatedTrackPart(emptyTrackPlan(), ['DigitaleDoppelweiche_1', 'DigitaleDoppelweiche_2'], preview)
  assert.equal(result.plan.pieces.length, 2)
  assert.deepEqual(
    result.plan.pieces.map((p) => p.level),
    [1, 1]
  )
  assert.equal(result.plan.pieces[0].placement.headingDegrees, 90)
  assert.equal(result.plan.pieces[0].placement.xMm, 400)
  assert.ok(Math.abs(result.plan.pieces[1].placement.yMm - 645) < 1e-8)
})
