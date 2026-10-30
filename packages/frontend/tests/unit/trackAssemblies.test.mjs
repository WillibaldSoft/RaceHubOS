import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  readTrackPlan,
  traceTrackPlan,
  groupTrackParts,
  ungroupTrackParts,
  freeTrackSelection,
  transformFreeParts,
  editFreeParts,
  validateTrackPlan,
  emptyTrackPlan,
  enableFreePlacement,
  switchGuidePaths,
  unitHousingPolygon,
  trackFootprint,
  trackRectangleSelection,
  nativeFuelBayIndices,
  exportSoftyRoyal,
  importSoftyRoyalExport,
} from '../../../shared/src/index.js'
const native = () =>
  readTrackPlan(JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url))))
test('CU/pit assembly releases without geometry changes, then arbitrary rails regroup and persist', () => {
  const p = native(),
    cu = p.pieces.findIndex((p) => p.type === 'Control_unit'),
    original = traceTrackPlan(p),
    members = freeTrackSelection(p, cu)
  assert.equal(members.length, 6)
  const released = ungroupTrackParts(p, [cu])
  assert.deepEqual(freeTrackSelection(released, cu), [cu])
  assert.deepEqual(released.pieces, p.pieces)
  assert.deepEqual(released.trackExtras, p.trackExtras)
  assert.deepEqual(released.pit, p.pit)
  const moved = transformFreeParts(released, [cu], { dx: 100 })
  assert.equal(moved.pieces[cu].placement.xMm, p.pieces[cu].placement.xMm + 100)
  for (let i = 0; i < p.pieces.length; i++) if (i !== cu) assert.deepEqual(moved.pieces[i], p.pieces[i])
  assert.deepEqual(moved.trackExtras, p.trackExtras)
  const grouped = groupTrackParts(released, members)
  assert.deepEqual(freeTrackSelection(grouped, cu), members)
  assert.deepEqual(validateTrackPlan(grouped).partGroups, grouped.partGroups)
  assert.deepEqual(traceTrackPlan(grouped).laneLengthsM, original.laneLengthsM)
  const exported = exportSoftyRoyal(grouped).file
  assert.deepEqual(importSoftyRoyalExport(exported).partGroups, grouped.partGroups)
})
test('noncontiguous user group, reverse group removal and index shifts survive editing', () => {
  let p = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
  p = groupTrackParts(p, [0, 3])
  assert.deepEqual(freeTrackSelection(p, 3), [0, 3])
  const inserted = editFreeParts(p, 1, 'after', ['Drittelgerade']).plan
  assert.deepEqual(inserted.partGroups.groups, [[0, 4]])
  const removed = editFreeParts(inserted, 0, 'delete').plan
  assert.deepEqual(removed.partGroups.groups, [])
  assert.equal(removed.pieces.length, 5)
  assert.throws(() => groupTrackParts(p, [1]), /two/)
})
test('catalogue double switch may be separated, single half replaced, and recombined', () => {
  const p = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: ['DigitaleDoppelweiche_1', 'DigitaleDoppelweiche_2'].map((type) => ({ type, level: 0, jointDegrees: 0 })),
  })
  assert.deepEqual(freeTrackSelection(p, 0), [0, 1])
  const q = ungroupTrackParts(p, [0])
  assert.deepEqual(freeTrackSelection(q, 1), [1])
  assert.equal(editFreeParts(q, 0, 'replace', ['Standardgerade']).plan.pieces[1].type, 'DigitaleDoppelweiche_2')
  assert.deepEqual(freeTrackSelection(groupTrackParts(q, [0, 1]), 1), [0, 1])
})
test('group validator rejects overlapping, duplicate and out-of-range indices', () => {
  const p = native()
  for (const partGroups of [
    {
      groups: [
        [0, 1],
        [1, 2],
      ],
      released: [],
    },
    { groups: [[0, 0]], released: [] },
    { groups: [], released: [99999] },
    { groups: [[0]], released: [] },
    { groups: [], released: [1, 1] },
  ])
    assert.throws(() => validateTrackPlan({ ...p, partGroups }), /group|released|Duplicate/)
})
test('double switch guide halves meet exactly; curved switch meets lead-in and inner slot', () => {
  const p = enableFreePlacement({
      ...emptyTrackPlan(),
      geometryProfile: 'prototype',
      pieces: [
        'DigitaleDoppelweiche_1',
        'DigitaleDoppelweiche_2',
        'Kurvenweiche_rechts_ai_1',
        'Kurvenweiche_rechts_ai_2',
      ].map((type) => ({ type, level: 0, jointDegrees: 0 })),
    }),
    s = traceTrackPlan(p).segments
  const a = switchGuidePaths(s[0]),
    b = switchGuidePaths(s[1])
  for (let i = 0; i < 2; i++) assert.ok(Math.hypot(a[i].at(-1)[0] - b[i][0][0], a[i].at(-1)[1] - b[i][0][1]) < 1e-9)
  const lead = switchGuidePaths(s[2])[0].at(-1),
    curve = switchGuidePaths(s[3], 'prototype')[0]
  assert.ok(Math.hypot(lead[0] - curve[0][0], lead[1] - curve[0][1]) < 1e-8)
  assert.equal(curve.length, 33)
  const center = { x: s[3].start.x, y: s[3].start.y + 297 }
  assert.ok(Math.abs(Math.hypot(curve.at(-1)[0] - center.x, curve.at(-1)[1] - center.y) - 247.5) < 1e-8)
})
test('CU housing participates in selection and footprint; two native fuel bays inferred without changing source', () => {
  const p = enableFreePlacement({ ...emptyTrackPlan(), pieces: [{ type: 'Control_unit', level: 0, jointDegrees: 0 }] }),
    s = traceTrackPlan(p).segments[0]
  assert.equal(unitHousingPolygon(s).length, 4)
  assert.equal(trackFootprint(p).depth, 337)
  assert.deepEqual(trackRectangleSelection(p, { x: 50, y: -210 }, { x: 80, y: -180 }), [0])
  const n = native(),
    json = JSON.stringify(n)
  assert.deepEqual(nativeFuelBayIndices(n, traceTrackPlan(n).segments), [4, 5])
  assert.equal(JSON.stringify(n), json)
})
