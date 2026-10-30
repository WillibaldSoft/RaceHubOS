import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan } from '../../../shared/src/trackPlan.js'
import { applyTrackBorders } from '../../../shared/src/trackBorders.js'
import { setFreeBorderEnds, borderEndConnections } from '../../../shared/src/trackBorderConnections.js'
import { enableFreePlacement, transformFreeParts } from '../../../shared/src/freeTrackEditing.js'
import { railRequirements } from '../../../shared/src/railInventory.js'
const row = (n) => ({
  ...emptyTrackPlan(),
  pieces: Array.from({ length: n }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
})
test('a continuous selection gets only its two outer caps per side; old plans are not modified', () => {
  const plan = applyTrackBorders(row(3), [0, 1, 2], 'both')
  for (const p of plan.pieces) for (const side of ['left', 'right']) p.borders[side] = { startCap: true, endCap: true }
  const original = JSON.stringify(plan),
    next = setFreeBorderEnds(plan, [0, 1, 2])
  for (const side of ['left', 'right']) {
    assert.deepEqual(next.pieces[0].borders[side], { startCap: true, endCap: false })
    assert.deepEqual(next.pieces[1].borders[side], { startCap: false, endCap: false })
    assert.deepEqual(next.pieces[2].borders[side], { startCap: false, endCap: true })
  }
  assert.equal(railRequirements(next).counts['20598'], 4)
  assert.equal(JSON.stringify(plan), original)
})
test('existing adjoining shoulders outside the selection prevent caps at selection boundaries', () => {
  const p = applyTrackBorders(row(3), [0, 1, 2], 'left'),
    next = setFreeBorderEnds(p, [1])
  assert.deepEqual(next.pieces[1].borders.left, { startCap: false, endCap: false })
  assert.deepEqual(next.pieces[0], p.pieces[0])
  assert.deepEqual(next.pieces[2], p.pieces[2])
  const interrupted = applyTrackBorders(row(3), [0, 2], 'left')
  assert.equal(railRequirements(setFreeBorderEnds(interrupted, [0, 2])).counts['20598'], 4)
})
test('curves and reversed free rails join the correct shoulder side', () => {
  const p = enableFreePlacement(row(2))
  p.pieces[0].borders = { left: { startCap: false, endCap: false } }
  p.pieces[1] = {
    ...p.pieces[1],
    placement: { xMm: 690, yMm: 0, headingDegrees: 180 },
    borders: { right: { startCap: false, endCap: false } },
  }
  const n = setFreeBorderEnds(p, [0, 1])
  assert.equal(n.pieces[0].borders.left.endCap, false)
  assert.equal(n.pieces[1].borders.right.endCap, false)
  assert.equal(railRequirements(n).counts['20598'], 2)
  const curve = applyTrackBorders(
    {
      ...row(2),
      pieces: [
        { type: 'Kurve_1_60_rechts', level: 0 },
        { type: 'Kurve_2_30_rechts', level: 0 },
      ],
    },
    [0, 1],
    'both'
  )
  assert.equal(railRequirements(setFreeBorderEnds(curve, [0, 1])).counts['20598'], 4)
})
test('closed shoulder loops have no caps; detached parts and height-separated free endpoints remain open', () => {
  const loop = applyTrackBorders(
    { ...row(6), pieces: Array.from({ length: 6 }, () => ({ type: 'Kurve_1_60_rechts', level: 0 })) },
    [0, 1, 2, 3, 4, 5],
    'both'
  )
  assert.equal(railRequirements(setFreeBorderEnds(loop, [0, 1, 2, 3, 4, 5])).counts['20598'], 0)
  const p = applyTrackBorders(enableFreePlacement(row(2)), [0, 1], 'left')
  p.pieces[1].level = 1
  assert.equal(railRequirements(setFreeBorderEnds(p, [0, 1])).counts['20598'], 4)
  const detached = transformFreeParts({ ...p, pieces: p.pieces.map((v) => ({ ...v, level: 0 })) }, [1], { dx: 100 })
  assert.ok(borderEndConnections(detached).every((v) => !v.connected))
  const ramp = applyTrackBorders(row(2), [0, 1], 'left')
  ramp.pieces[1].level = 1
  assert.equal(railRequirements(setFreeBorderEnds(ramp, [0, 1])).counts['20598'], 2)
})
test('multi-selection start/end toggles also remove internal caps and leave the other side untouched', () => {
  const p = applyTrackBorders(row(3), [0, 1, 2], 'both'),
    start = setFreeBorderEnds(p, [0, 1, 2], { side: 'left', edge: 'startCap' })
  assert.equal(railRequirements(start).counts['20598'], 1)
  assert.equal(start.pieces[0].borders.left.startCap, true)
  assert.equal(start.pieces[1].borders.left.startCap, false)
  const end = setFreeBorderEnds(start, [0, 1, 2], { side: 'left', edge: 'endCap' })
  assert.equal(railRequirements(end).counts['20598'], 2)
  const cleared = setFreeBorderEnds(end, [0, 1, 2], { side: 'left', enabled: false })
  assert.equal(railRequirements(cleared).counts['20598'], 0)
})
