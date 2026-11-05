import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  enableFreePlacement,
  traceTrackPlan,
  validateTrackPlan,
  placeControlUnit,
  createPitAssembly,
  appendTrackTemplate,
  replaceWithPitAssembly,
  openTrackPorts,
  extractTrackTemplate,
  deleteTrackSelection,
  deletePitComponent,
  ungroupTrackParts,
  nearestTrackConnection,
  inspectTrackBuild,
  nativeFuelBayIndices,
  railRequirements,
  emptyRailInventory,
  transformFreeParts,
  groupTrackParts,
  exportSoftyRoyal,
  importSoftyRoyalExport,
} from '../../../shared/src/index.js'
const straights = (count = 6) =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: count }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
test('CU replacement retains geometry and grouping, rejects duplicates and curves', () => {
  const p = groupTrackParts(straights(), [0, 1]),
    q = placeControlUnit(p, 2)
  assert.equal(q.pieces[2].type, 'Control_unit')
  assert.deepEqual(q.pieces[2].placement, p.pieces[2].placement)
  assert.deepEqual(q.partGroups, p.partGroups)
  assert.deepEqual(traceTrackPlan(q).laneLengthsM, traceTrackPlan(p).laneLengthsM)
  assert.throws(() => placeControlUnit(q, 1), /cuExists/)
  assert.throws(() => placeControlUnit(q, -1), /cuStraight/)
})
test('single/double pit templates use explicit fuel units, balanced switches and accurate material counts', () => {
  for (const bays of [1, 2]) {
    const p = createPitAssembly({ bays })
    assert.equal(nativeFuelBayIndices(p, traceTrackPlan(p).segments).length, bays)
    const appended = appendTrackTemplate(emptyTrackPlan(), p)
    assert.equal(nativeFuelBayIndices(appended, traceTrackPlan(appended).segments).length, bays)
    assert.equal(railRequirements(appended).counts['30361'], bays)
    assert.deepEqual(railRequirements(appended).unresolved, [])
    assert.equal(openTrackPorts(appended).length, 2)
    assert.equal(inspectTrackBuild(appended).conflicts.length, 0)
    assert.equal(inspectTrackBuild(appended).auxiliaryPorts.length, 0)
    const exchange = exportSoftyRoyal(appended).file
    assert.equal(exchange.items.length, bays === 1 ? 10 : 11)
    assert.equal(importSoftyRoyalExport(exchange).trackExtras.filter((e) => e.fuelBay).length, bays)
  }
})
test('pit attaches to a genuine open end on both sides, without disturbing the source', () => {
  const p = straights(1),
    port = openTrackPorts(p).find((p) => p.end === 1),
    before = JSON.stringify(p)
  for (const otherSide of [false, true]) {
    const q = appendTrackTemplate(p, createPitAssembly(), port, otherSide)
    assert.equal(q.pieces.length, 7)
    assert.equal(openTrackPorts(q).length, 2)
    assert.equal(traceTrackPlan(q).connectivity.components, 1)
    assert.deepEqual(q.pieces[0], p.pieces[0])
    const pose = q.trackExtras.find((p) => p.kind === 'single').placement
    assert.ok(Number.isFinite(pose.yMm))
  }
  assert.equal(JSON.stringify(p), before)
  assert.throws(() => appendTrackTemplate(straights(2), createPitAssembly(), { index: 0, end: 1 }), /openPort/)
})
test('replace six straight modules preserves neighbours and a pre-existing CU; refuses protected and curved areas', () => {
  const p = placeControlUnit(straights(8), 3)
  for (const otherSide of [false, true]) {
    const q = replaceWithPitAssembly(p, 1, { bays: 1, otherSide })
    assert.equal(q.pieces.length, 8)
    assert.deepEqual(q.pieces[0], p.pieces[0])
    assert.deepEqual(q.pieces[7], p.pieces[7])
    assert.equal(q.pieces.filter((p) => p.type === 'Control_unit').length, 1)
    assert.equal(openTrackPorts(q).length, 2)
    assert.equal(traceTrackPlan(q).connectivity.components, 1)
  }
  assert.throws(() => replaceWithPitAssembly(straights(5), 0), /sixStraights/)
  assert.throws(() => replaceWithPitAssembly(groupTrackParts(straights(), [0, 1]), 0), /protectedParts/)
})
test('normalized templates retain AKS, native pit fuel and anchors across repeated insertion', () => {
  let p = createPitAssembly({ includeCU: true })
  p = { ...p, trackExtras: p.trackExtras.map((e, i) => (i === 3 ? { ...e, antiCollision: true } : e)) }
  // Attach AKS only to a switch, not an arbitrary single-lane rail.
  p = {
    ...p,
    trackExtras: p.trackExtras.map(({ antiCollision, ...e }) =>
      e.kind === 'pitEntry' ? { ...e, antiCollision: true } : e
    ),
  }
  p = transformFreeParts(
    p,
    p.pieces.map((_, i) => i),
    { degrees: 45, dx: 300, dy: 500 }
  )
  const template = extractTrackTemplate(p, [0])
  assert.equal(template.pieces[0].placement.xMm, 0)
  assert.equal(template.pieces[0].placement.yMm, 0)
  assert.ok(Math.abs(template.pieces[0].placement.headingDegrees) < 1e-8)
  const once = appendTrackTemplate(emptyTrackPlan(), template)
  const twice = appendTrackTemplate(
    once,
    template,
    openTrackPorts(once).find((p) => p.end === 1)
  )
  assert.equal(twice.pieces.length, 12)
  assert.equal(nativeFuelBayIndices(twice, traceTrackPlan(twice).segments).length, 4)
  assert.equal(twice.trackExtras.filter((e) => e.antiCollision).length, 4)
  assert.deepEqual(railRequirements(twice).unresolved, [])
  assert.equal(validateTrackPlan(JSON.parse(JSON.stringify(twice))).trackExtras.length, twice.trackExtras.length)
})
test('deleting an assembly remaps attached extras and preserves unrelated groups', () => {
  let p = groupTrackParts(straights(3), [0, 1])
  p = appendTrackTemplate(
    p,
    createPitAssembly(),
    openTrackPorts(p).find((p) => p.end === 1)
  )
  const q = deleteTrackSelection(p, [3])
  assert.equal(q.pieces.length, 3)
  assert.equal(q.trackExtras.length, 0)
  assert.deepEqual(q.partGroups.groups, [[0, 1]])
})
test('connection hint reports remaining distance, heading mismatch and level compatibility', () => {
  let p = straights(2)
  p = transformFreeParts(p, [1], { dx: 30, dy: 10 })
  const hint = nearestTrackConnection(p, [1])
  assert.ok(Math.abs(hint.distanceMm - Math.hypot(30, 10)) < 1e-8)
  assert.equal(hint.compatible, true)
  assert.equal(
    nearestTrackConnection({ ...p, pieces: p.pieces.map((p, i) => (i ? { ...p, level: 1 } : p)) }, [1]).compatible,
    false
  )
})
test('build check distinguishes touching rails from same-level overlap and provides inventory deficits', () => {
  const p = straights(2)
  assert.equal(inspectTrackBuild(p).conflicts.length, 0)
  const overlap = transformFreeParts(p, [1], { dx: -100 })
  assert.ok(inspectTrackBuild(overlap).conflicts.length > 0)
  const upper = { ...overlap, pieces: overlap.pieces.map((p, i) => (i ? { ...p, level: 1 } : p)) }
  assert.equal(inspectTrackBuild(upper).conflicts.length, 0)
  assert.equal(inspectTrackBuild(p, emptyRailInventory()).missing.find((p) => p.article === '20509').required, 2)
  assert.equal(inspectTrackBuild(p).missing, null)
})

test('templates keep relative bridge levels and reject impossible level shifts', () => {
  const p = straights(2)
  const bridge = { ...p, pieces: p.pieces.map((p, i) => ({ ...p, level: i })) }
  const q = appendTrackTemplate(emptyTrackPlan(), bridge)
  assert.deepEqual(
    q.pieces.map((p) => p.level),
    [0, 1]
  )
  const raised = { ...straights(1), pieces: straights(1).pieces.map((p) => ({ ...p, level: 2 })) }
  assert.throws(
    () =>
      appendTrackTemplate(
        raised,
        bridge,
        openTrackPorts(raised).find((p) => p.end === 1)
      ),
    /levelRange/
  )
  assert.throws(() => replaceWithPitAssembly(placeControlUnit(straights(), 0), 0), /cuAtPitEnd/)
})

test('deleting an auxiliary pit entry cannot bypass its group and does not resurrect a carrier switch', () => {
  const p = createPitAssembly(),
    i = p.trackExtras.findIndex((e) => e.kind === 'pitEntry' && e.anchor === 0)
  assert.throws(() => deletePitComponent(p, i), /protectedParts/)
  const released = ungroupTrackParts(p, [0])
  const q = deletePitComponent(released, i)
  assert.equal(q.pieces[0].type, 'Standardgerade')
  assert.equal(q.trackExtras.length, p.trackExtras.length - 1)
  assert.ok(railRequirements(q).unresolved.length > 0)
  assert.ok(inspectTrackBuild(q).auxiliaryPorts.length > 0)
  assert.ok(inspectTrackBuild(q).unresolved.length > 0)
})
