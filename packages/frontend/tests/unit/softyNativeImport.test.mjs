import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  importSoftyRoyal,
  exportSoftyRoyal,
  traceTrackPlan,
  trackPlanFields,
  railRequirements,
  trackFootprint,
  transformFreeParts,
  softyExtraGeometry,
  extraWorldPose,
  editFreeParts,
  validateTrackPlan,
  SOFTY_GUIDS as G,
} from '../../../shared/src/index.js'
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`../fixtures/${name}.sbp`, import.meta.url)))
const full = () => fixture('softy-native-froehlichring')
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const item = (guid, x, y, rotation = 0) => ({ guid, position: { x, y }, rotation })
test('user native SBP reference imports without metadata and ignores preview content', () => {
  const value = fixture('softy-user-reference')
  value.preview = '<svg onload="throw 1"/>'
  const p = importSoftyRoyal(value)
  assert.equal(p.pieces[0].type, 'Standardgerade')
  assert.equal(p.geometryProfile, 'prototype')
  assert.equal(p.freePlacement, true)
  assert.deepEqual(traceTrackPlan(p).laneLengthsM, [0.345, 0.345])
  assert.equal(trackPlanFields(p).length, null)
  assert.equal(p.softyImport.items, 1)
  assert.ok(!JSON.stringify(p).includes('<svg'))
})
test('native Fröhlichring reconstructs shared entry, parallel bays, shared exit and crossing paint order', () => {
  const p = importSoftyRoyal(full()),
    r = traceTrackPlan(p),
    stock = railRequirements(p).counts
  assert.equal(p.pieces.length, 55)
  assert.equal(p.trackExtras.length, 9)
  assert.equal(p.softyImport.bays, 2)
  assert.ok(p.softyImport.crossings >= 2)
  assert.equal(p.pit.native, true)
  assert.equal(p.pit.enabled, true)
  assert.equal(p.softyImport.unassigned, 0)
  assert.equal(p.pieces[p.pit.entry].type, 'Pit_stop_weiche_anfang')
  assert.equal(p.pieces[p.pit.merge].type, 'Pit_stop_weiche_ende')
  for (const n of r.laneLengthsM) near(n, 16.86739972061398)
  assert.equal(stock['30356'], 2)
  assert.equal(stock['30341'], 1)
  assert.equal(stock['30361'], 2) // Same FUEL positions as the plan; hidden placeholders are not physical stock.
  assert.equal(stock['30365'], 1)
  assert.equal(stock['30347'], 2)
  assert.equal(p.measuredLaneLengthsM, null)
  assert.ok(p.pieces.some((p) => p.level === 1))
  const saved = JSON.parse(trackPlanFields(p).layout)
  assert.deepEqual(saved.trackExtras, p.trackExtras)
  assert.deepEqual(saved.softyImport, p.softyImport)
  assert.equal(exportSoftyRoyal(p).file.items.length, 62)
})
test('Softy editing invalidates old metadata and uses changed positions instead', () => {
  const source = importSoftyRoyal(full()),
    value = exportSoftyRoyal(source).file
  value.racehubos.plan.measuredLaneLengthsM = [999, 999]
  value.items[0].position.x += 17
  const p = importSoftyRoyal(value)
  assert.equal(p.measuredLaneLengthsM, null)
  assert.ok(p.softyImport)
  // No stale 999m measurement can leak into race speed.
  assert.ok(traceTrackPlan(p).laneLengthsM.every((n) => n < 20))
})
test('reordered native rails and globally rotated translated plans preserve geometry and route', () => {
  const value = full(),
    original = importSoftyRoyal(value)
  value.items = value.items
    .toReversed()
    .map((i) => ({ ...i, position: { x: 30000 - i.position.y, y: 20000 + i.position.x }, rotation: i.rotation + 90 }))
  const p = importSoftyRoyal(value)
  assert.equal(p.softyImport.bays, 2)
  assert.equal(p.pit.merge, original.pit.merge)
  assert.deepEqual(railRequirements(p), railRequirements(original))
  traceTrackPlan(p).laneLengthsM.forEach((n, i) => near(n, traceTrackPlan(original).laneLengthsM[i]))
})
test('all native shoulder/end outlines retain exact poses, material quantities and space', () => {
  const value = {
    file: 'sbp',
    version: 1,
    items: [
      item(G.straight, 0, 0),
      item(G.borderStandard, 0, -148.5),
      item(G.borderEndRight, 172.5, -99),
      item(G.borderEndLeft, -172.5, -99),
      item(G.pitBorderEntry, 900, 200),
    ],
  }
  const p = importSoftyRoyal(value),
    stock = railRequirements(p).counts,
    bounds = trackFootprint(p)
  assert.equal(stock['20560'], 1)
  assert.equal(stock['20598'], 2)
  assert.equal(stock['20602'], 1)
  assert.ok(bounds.width > 1000)
  assert.ok(bounds.depth >= 396)
  const cap = softyExtraGeometry(p.trackExtras[1], traceTrackPlan(p).segments)
  near(Math.max(...cap.polygon.map((p) => p[0])) - Math.min(...cap.polygon.map((p) => p[0])), 138.5)
  const exported = exportSoftyRoyal(p).file
  assert.equal(exported.items.length, value.items.length)
  const before = extraWorldPose(p.trackExtras[0], traceTrackPlan(p).segments),
    moved = transformFreeParts(p, [0], { dx: 100, dy: 50 }),
    after = extraWorldPose(moved.trackExtras[0], traceTrackPlan(moved).segments)
  near(after.xMm - before.xMm, 100)
  near(after.yMm - before.yMm, 50)
  const deleted = editFreeParts(p, 0, 'delete').plan
  assert.equal(deleted.pieces.length, 0)
  assert.ok(deleted.trackExtras.every((e) => e.anchor === undefined))
})
test('native curve circles are connected, with distinct lane lengths and stable border radii', () => {
  const value = {
    file: 'sbp',
    version: 1,
    items: Array.from({ length: 6 }, (_, i) => item(G.k160, 1000, 1000, 30 + i * 60)),
  }
  value.items.push(item(G.borderOuter160, 1000, 1000, 30))
  const p = importSoftyRoyal(value),
    r = traceTrackPlan(p)
  assert.equal(r.connectivity.closed, true)
  near(r.laneLengthsM[0], (2 * Math.PI * 346.5) / 1000)
  near(r.laneLengthsM[1], (2 * Math.PI * 247.5) / 1000)
  near(trackPlanFields(p).length, (2 * Math.PI * 297) / 1000)
  const g = softyExtraGeometry(p.trackExtras[0], r.segments),
    center = { x: 0, y: 297 }
  for (const q of g.polygon)
    assert.ok(
      Math.min(
        Math.abs(Math.hypot(q[0] - center.x, q[1] - center.y) - 396),
        Math.abs(Math.hypot(q[0] - center.x, q[1] - center.y) - 495)
      ) < 1e-6
    )
})
test('disconnected pit turnouts are retained without claiming two connected bays', () => {
  const value = full()
  const singles = value.items.filter((i) => i.guid === G.single)
  singles[2].position.y += 20
  const p = importSoftyRoyal(value)
  assert.notEqual(p.softyImport.bays, 2)
  assert.equal(p.trackExtras.length, 9)
})
test('unknown parts, invalid positions and unsafe persisted extra fields reject atomically', () => {
  const value = full(),
    before = JSON.stringify(value)
  assert.throws(
    () => importSoftyRoyal({ ...value, items: [...value.items, item('unknown', 0, 0)] }),
    /Unsupported SBP parts/
  )
  assert.equal(JSON.stringify(value), before)
  for (const n of [NaN, Infinity, 2000000])
    assert.throws(() => importSoftyRoyal({ file: 'sbp', version: 1, items: [item(G.straight, n, 0)] }), /placement/)
  const p = importSoftyRoyal(value)
  p.trackExtras[0].anchor = 9999
  assert.throws(() => validateTrackPlan(p), /extra/)
  assert.throws(() => importSoftyRoyal({ ...value, items: Array(5001).fill(item(G.straight, 0, 0)) }), /Invalid SBP/)
})
test('curve shoulders follow their matching arc; loose shoulders rotate with the complete plan', () => {
  const value = {
    file: 'sbp',
    version: 1,
    items: [
      item(G.straight, 1000, 1000),
      item(G.k160, 1000, 1000, 30),
      item(G.borderOuter160, 1000, 1000, 30),
      item(G.borderStandard, 5000, 5000),
    ],
  }
  const p = importSoftyRoyal(value),
    curve = p.pieces.findIndex((p) => p.type === 'Kurve_1_60_rechts'),
    border = p.trackExtras.find((e) => e.kind === 'borderOuter160'),
    loose = p.trackExtras.find((e) => e.kind === 'borderStandard')
  assert.equal(border.anchor, curve)
  assert.equal(loose.anchor, undefined)
  assert.equal(p.softyImport.unassigned, 1)
  const before = extraWorldPose(border, traceTrackPlan(p).segments),
    moved = transformFreeParts(p, [curve], { dx: 200, dy: 100 }),
    after = extraWorldPose(border, traceTrackPlan(moved).segments)
  near(after.xMm - before.xMm, 200)
  near(after.yMm - before.yMm, 100)
  const rotated = transformFreeParts(
      p,
      p.pieces.map((_, i) => i),
      { degrees: 90 }
    ),
    q = rotated.trackExtras.find((e) => e.kind === 'borderStandard').placement
  near(q.xMm, -loose.placement.yMm)
  near(q.yMm, loose.placement.xMm)
})
test('RaceHub attached shoulders and caps export as native Softy parts with unchanged footprint', () => {
  const p = fixture('softy-user-reference'),
    plan = importSoftyRoyal(p)
  plan.pieces[0].borders = { left: { startCap: true, endCap: true }, right: { startCap: true, endCap: true } }
  const exported = exportSoftyRoyal(plan).file
  delete exported.racehubos
  const restored = importSoftyRoyal(exported),
    a = trackFootprint(plan),
    b = trackFootprint(restored)
  assert.equal(exported.items.length, 7)
  assert.equal(railRequirements(restored).counts['20560'], 2)
  assert.equal(railRequirements(restored).counts['20598'], 4)
  near(a.width, b.width)
  near(a.depth, b.depth)
  for (const value of ['__proto__', 'constructor', 'toString'])
    assert.throws(() => importSoftyRoyal({ file: 'sbp', version: 1, items: [item(value, 0, 0)] }), /Unsupported/)
})
