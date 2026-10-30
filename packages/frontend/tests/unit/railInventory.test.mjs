import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  emptyRailInventory,
  validateRailInventory,
  railRequirements,
  inventoryComparison,
  fitPlanToInventory,
} from '../../../shared/src/railInventory.js'
import { emptyTrackPlan, traceTrackPlan, trackPlanFields, readTrackPlan } from '../../../shared/src/trackPlan.js'
import { DEFAULT_ROOM, planRoom } from '../../../shared/src/roomPlanner.js'
const stock = (counts) => ({
  ...emptyRailInventory(),
  counts: { ...emptyRailInventory().counts, ...counts },
})
const plan = (types) => ({
  ...emptyTrackPlan(),
  geometryProfile: 'prototype',
  pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
})
test('strict integer stock and shared left/right curve identities', () => {
  assert.equal(railRequirements(plan(['Kurve_1_60_links', 'Kurve_1_60_rechts'])).counts['20571'], 2)
  for (const n of [-1, 1.5, 2001, NaN]) assert.throws(() => validateRailInventory(stock({ 20509: n })))
  assert.throws(() => validateRailInventory(stock({ unknown: 1 })))
  assert.equal(inventoryComparison(plan(['Control_unit']), stock({})).fits, false)
})
test('assemblies count once, partial assemblies and accessory placeholders remain explicit', () => {
  const r = railRequirements(
    plan([
      'DigitaleDoppelweiche_1',
      'DigitaleDoppelweiche_2',
      'Kurvenweiche_rechts_ai_1',
      'Kurvenweiche_rechts_ai_2',
      'Check_lane',
    ])
  )
  assert.equal(r.counts['30347'], 1)
  assert.equal(r.counts['30365'], 1)
  assert.equal(r.unresolved.length, 0)
  assert.equal(r.counts['30371'], 1)
  assert.equal(railRequirements(plan(['DigitaleDoppelweiche_1'])).unresolved.length, 1)
  const photo = readTrackPlan(
    fs.readFileSync(
      new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  const requirements = railRequirements(photo)
  assert.equal(requirements.counts['30356'], 2)
  assert.equal(requirements.counts['30341'], 3)
  assert.equal(requirements.counts['30361'], 2)
  assert.equal(requirements.unresolved.length, 0)
  assert.equal(requirements.counts['30347'], 2)
  assert.equal(requirements.counts['30352'], 1)
})
test('exact straight and curve substitutions keep closure and actual stock limits', () => {
  const types = [
    ...Array(6).fill('Kurve_1_30_rechts'),
    'Standardgerade',
    ...Array(6).fill('Kurve_1_30_rechts'),
    'Control_unit',
  ]
  const p = plan(types),
    inv = stock({ 20571: 6, 30352: 1, 20611: 3 })
  const result = fitPlanToInventory(p, inv)
  assert.ok(result)
  assert.equal(result.pieces.filter((p) => p.type === 'Kurve_1_60_rechts').length, 6)
  assert.equal(railRequirements(result).counts['20611'], 3)
  assert.ok(traceTrackPlan(result).gapMm < 1e-6)
  assert.ok(Math.abs(traceTrackPlan(result).laneLengthsM[0] - traceTrackPlan(p).laneLengthsM[0]) < 1e-10)
  assert.equal(fitPlanToInventory(p, stock({ 20571: 5, 30352: 1, 20611: 3 })), null)
  const switched = fitPlanToInventory(
    plan(['Control_unit', 'Standardgerade', 'Standardgerade']),
    stock({ 30352: 1, 30347: 1 })
  )
  assert.equal(railRequirements(switched).counts['30347'], 1)
})
test('automatic variants respect both stock and space, persist the snapshot and report infeasible inventory', () => {
  const room = {
    ...DEFAULT_ROOM,
    inventory: stock({ 20571: 6, 20509: 5, 30352: 1 }),
  }
  const result = planRoom(room)
  assert.ok(result.proposals.length)
  for (const p of result.proposals) {
    assert.ok(inventoryComparison(p.plan, room.inventory).fits)
    assert.ok(traceTrackPlan(p.plan).gapMm < 1e-6)
    assert.deepEqual(readTrackPlan(trackPlanFields(p.plan).layout).roomPlan.inventory, room.inventory)
  }
  assert.equal(planRoom({ ...room, inventory: stock({}) }).reason, 'inventory')
})

test('mixed stock from the Fröhlichring generates three bounded variants with no invented inventory', () => {
  const photo = readTrackPlan(
    fs.readFileSync(
      new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  const inventory = { version: 1, counts: railRequirements(photo).counts }
  const result = planRoom({
    ...DEFAULT_ROOM,
    reference: { name: 'Fröhlichring', widthM: 4.02, depthM: 2.63 },
    inventory,
  })
  assert.equal(result.proposals.length, 3)
  for (const p of result.proposals) {
    assert.ok(inventoryComparison(p.plan, inventory).fits)
    assert.ok(p.bounds.width <= 4020)
    assert.ok(p.bounds.depth <= 2630)
    assert.ok(traceTrackPlan(p.plan).gapMm < 1e-6)
  }
})

test('incomplete assemblies still require review without claiming known stock quantities are missing', () => {
  const comparison = inventoryComparison(plan(['Weiche_links_2']), stock({}))
  assert.equal(comparison.quantitiesFit, true)
  assert.equal(comparison.fits, false)
  assert.equal(comparison.unresolved.length, 1)
})

test('room template planning can allow extra catalogue parts without modifying inventory', () => {
  const inventory = stock({}),
    before = JSON.stringify(inventory)
  assert.equal(planRoom({ ...DEFAULT_ROOM, inventory }).proposals.length, 0)
  const result = planRoom({
    ...DEFAULT_ROOM,
    inventory,
    allowAdditionalParts: true,
  })
  assert.ok(result.proposals.length)
  assert.equal(JSON.stringify(inventory), before)
  assert.ok(result.proposals.every((p) => p.plan.roomPlan.allowAdditionalParts === true))
})

test('legacy straight placeholder and fuel units are counted without inventing a startlight, independently of track name', () => {
  const light = railRequirements(plan(['Startampel_3spur_hinten']))
  assert.equal(light.counts['30354'], 0)
  assert.equal(light.counts['20509'], 1)
  assert.deepEqual(light.unresolved, [])
  const p = readTrackPlan(
      fs.readFileSync(
        new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
        'utf8'
      )
    ),
    before = JSON.stringify(p)
  const r = railRequirements(p)
  assert.equal(r.counts['30361'], 2)
  assert.equal(r.counts['30341'], 3)
  assert.equal(r.counts['30354'], 0)
  assert.deepEqual(r.unresolved, [])
  assert.deepEqual(railRequirements({ ...p, name: 'Unrelated circuit' }), r)
  assert.equal(JSON.stringify(p), before)
  assert.equal(inventoryComparison(p, { version: 1, counts: r.counts }).fits, true)
  const noPit = railRequirements({ ...p, pit: { ...p.pit, enabled: false } })
  assert.equal(noPit.counts['30361'], 0)
})
