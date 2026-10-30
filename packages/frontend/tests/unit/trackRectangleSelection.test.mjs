import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, enableFreePlacement, trackRectangleSelection } from '../../../shared/src/index.js'
const plan = (types) =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    geometryProfile: 'prototype',
    pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
  })
test('selection touches rail edges, crosses polygons and works in either drag direction', () => {
  const p = plan(['Standardgerade', 'Standardgerade'])
  assert.deepEqual(trackRectangleSelection(p, { x: 20, y: -50 }, { x: 100, y: 50 }), [0])
  assert.deepEqual(trackRectangleSelection(p, { x: 500, y: 110 }, { x: 300, y: 90 }), [0, 1])
  assert.deepEqual(trackRectangleSelection(p, { x: 160, y: -200 }, { x: 180, y: 200 }), [0])
  assert.deepEqual(trackRectangleSelection(p, { x: -200, y: 200 }, { x: -100, y: 300 }), [])
})
test('shoulder and cap hits select their owner; visible layer filters hidden rails', () => {
  const p = plan(['Standardgerade', 'Standardgerade'])
  p.pieces[0].borders = { left: { endCap: true } }
  p.pieces[1].level = 1
  assert.deepEqual(trackRectangleSelection(p, { x: 10, y: -190 }, { x: 20, y: -150 }), [0])
  assert.deepEqual(trackRectangleSelection(p, { x: 380, y: -160 }, { x: 400, y: -130 }), [0])
  assert.deepEqual(trackRectangleSelection(p, { x: -100, y: -300 }, { x: 800, y: 300 }, 0), [0])
  assert.deepEqual(trackRectangleSelection(p, { x: -100, y: -300 }, { x: 800, y: 300 }), [0, 1])
})
test('an empty curved infield is not selected merely because it lies in the rail bounding box', () => {
  const p = plan(['Kurve_1_60_rechts'])
  assert.deepEqual(trackRectangleSelection(p, { x: 10, y: 150 }, { x: 20, y: 170 }), [])
  assert.throws(() => trackRectangleSelection(p, { x: NaN, y: 0 }, { x: 100, y: 100 }), /rectangle/)
})
test('native pit shoulders select the anchor even outside the main road', () => {
  const p = plan(['Standardgerade'])
  p.trackExtras = [
    {
      kind: 'borderStandard',
      anchor: 0,
      level: 0,
      paintOrder: 0,
      placement: { xMm: 172.5, yMm: -350, headingDegrees: 0 },
    },
  ]
  assert.deepEqual(trackRectangleSelection(p, { x: 10, y: -380 }, { x: 20, y: -360 }), [0])
})
