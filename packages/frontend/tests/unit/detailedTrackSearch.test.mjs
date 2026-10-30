import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  runDetailedTrackSearch,
  searchDetailedTrackVariants,
  checkDetailedGeometry,
  detailedShapeDistance,
  MIN_VARIANT_DISTANCE_MM,
} from '../../../shared/src/detailedTrackSearch.js'
import { DEFAULT_ROOM, validateRoom } from '../../../shared/src/roomConfiguration.js'
import { railRequirements } from '../../../shared/src/railInventory.js'
import { traceTrackPlan, trackPlanFields, readTrackPlan, TRACK_PARTS } from '../../../shared/src/trackPlan.js'
const source = JSON.parse(
  fs.readFileSync(new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
)
const room = {
  ...DEFAULT_ROOM,
  curveStyle: 'balanced',
  maxLevels: 2,
  reference: { name: 'Fröhlichring', widthM: 4.02, depthM: 2.63 },
  inventory: { version: 1, counts: railRequirements(source).counts },
  detailedSearch: {
    enabled: true,
    attempts: 100,
    seed: 87654321,
    jointDegrees: 0.5,
  },
}
const pitAssembly = (p) => {
  const rails = []
  for (let i = p.pit.entry, n = 0; n < p.pieces.length; n++, i = (i + 1) % p.pieces.length) {
    rails.push(p.pieces[i].type)
    if (i === p.pit.merge) break
  }
  return rails
}
const turns = (p) =>
  p.pieces.reduce((runs, rail) => {
    const a = TRACK_PARTS[rail.type].angle || 0
    if (a) {
      if (Math.sign(runs.at(-1)) === Math.sign(a)) runs[runs.length - 1] += a
      else runs.push(a)
    }
    return runs
  }, [])
test('offline search is repeatable, builds a new topology within stock and preserves the full double pit, closes and checks all crossings', () => {
  const original = JSON.stringify(source),
    a = runDetailedTrackSearch(room, { sourcePlan: source }),
    b = runDetailedTrackSearch(room, { sourcePlan: source })
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify(source), original)
  assert.ok(a.proposals.length > 0)
  assert.ok(a.proposals.length <= 3)
  for (const p of a.proposals) {
    assert.ok(detailedShapeDistance(p.plan, source) >= MIN_VARIANT_DISTANCE_MM)
    for (const q of a.proposals)
      if (q !== p) assert.ok(detailedShapeDistance(p.plan, q.plan) >= MIN_VARIANT_DISTANCE_MM)
    assert.notDeepEqual(turns(p.plan), turns(source))
    assert.ok([2, 6].includes(turns(p.plan).length))
    assert.deepEqual(pitAssembly(p.plan), pitAssembly(source))
    for (const k of ['enabled', 'spacingMm', 'bayLengthMm']) assert.equal(p.plan.pit[k], source.pit[k])
    for (const [id, n] of Object.entries(railRequirements(p.plan).counts)) assert.ok(n <= room.inventory.counts[id])
    assert.equal(p.plan.pieces.filter((r) => r.type === 'Control_unit').length, 1)
    assert.ok(p.changedRails >= 2)
    assert.ok(p.maxJointDegrees <= 0.5)
    assert.ok(p.bounds.width <= 4020 && p.bounds.depth <= 2630)
    assert.ok(traceTrackPlan(p.plan).gapMm < 0.01)
    const check = checkDetailedGeometry(p.plan)
    assert.equal(check.overlaps.length, 0)
    assert.ok(check.crossings.length)
    assert.ok(check.crossings.every((c) => c.levels[0] !== c.levels[1]))
    assert.ok(p.rampRunsMm.every((n) => (150 / n) * 100 <= 15))
    assert.deepEqual(readTrackPlan(trackPlanFields(p.plan).layout).roomPlan.detailedSearch, room.detailedSearch)
  }
})
test('impossible stock, ramps, levels and source are rejected without mutation or false proposals', () => {
  const stock = structuredClone(room)
  stock.inventory.counts['30352'] = 0
  for (const [input, reason] of [
    [stock, 'inventory'],
    [{ ...room, maxLevels: 1 }, 'levels'],
    [{ ...room, levelHeightMm: 500, maxGradePercent: 1 }, 'search'],
  ])
    assert.equal(runDetailedTrackSearch(input, { sourcePlan: source }).reason, reason)
  assert.equal(
    runDetailedTrackSearch(room, {
      sourcePlan: { ...source, pit: { ...source.pit, enabled: false } },
    }).reason,
    'source'
  )
  const tight = runDetailedTrackSearch(
    { ...room, reference: { name: 'small', widthM: 1, depthM: 1 } },
    { sourcePlan: source }
  )
  assert.equal(tight.proposals.length, 0)
  for (const search of [
    { ...room.detailedSearch, attempts: 1 },
    { ...room.detailedSearch, seed: NaN },
    { ...room.detailedSearch, jointDegrees: 2 },
  ])
    assert.throws(() => validateRoom({ ...room, detailedSearch: search }))
})
test('generator exposes bounded progress and can be stopped before more work', () => {
  const g = searchDetailedTrackVariants(room, { sourcePlan: source })
  const first = g.next()
  assert.equal(first.done, false)
  assert.equal(first.value.progress, 0)
  g.return()
  assert.equal(g.next().done, true)
})

test('larger search finds three geometrically separated proposals, independent of drawing rotation', () => {
  const a = runDetailedTrackSearch(
    { ...room, detailedSearch: { ...room.detailedSearch, attempts: 800 } },
    { sourcePlan: source }
  )
  assert.equal(a.proposals.length, 3)
  assert.ok(a.proposals.some((p) => turns(p.plan).length === 2))
  assert.ok(a.proposals.some((p) => turns(p.plan).length === 6))
  assert.ok(
    detailedShapeDistance(source, {
      ...source,
      startHeadingDegrees: source.startHeadingDegrees + 90,
    }) < 1e-8
  )
  for (const p of a.proposals) {
    assert.ok(detailedShapeDistance(source, p.plan) >= 100)
    for (const q of a.proposals) if (q !== p) assert.ok(detailedShapeDistance(p.plan, q.plan) >= 100)
  }
})

test('new routes do not depend on the reference loop order or its radii', () => {
  const altered = structuredClone(source)
  for (const rail of altered.pieces) {
    if (rail.type.startsWith('Kurve_')) rail.type = 'Kurve_4_15_links'
    rail.level = 0
    rail.jointDegrees = 0
  }
  const a = runDetailedTrackSearch(room, { sourcePlan: source }),
    b = runDetailedTrackSearch(room, { sourcePlan: altered })
  assert.deepEqual(
    a.proposals.map((p) => p.plan),
    b.proposals.map((p) => p.plan)
  )
})

test('unused reference rails are optional and unavailable curve stock cannot be invented', () => {
  const input = structuredClone(room)
  input.inventory.counts['30365'] = 0
  input.inventory.counts['30360'] = 0
  assert.ok(runDetailedTrackSearch(input, { sourcePlan: source }).proposals.length > 0)
  for (const id of ['20577', '20571', '20572', '20573', '20578']) input.inventory.counts[id] = 0
  assert.equal(runDetailedTrackSearch(input, { sourcePlan: source }).proposals.length, 0)
})

test('additional parts mode permits missing stock, keeps geometry checks, persists its choice and leaves stock intact', () => {
  const input = structuredClone(room)
  for (const id of ['30352', '20577', '20571', '20572', '20573', '20578']) input.inventory.counts[id] = 0
  const before = JSON.stringify(input.inventory)
  assert.equal(runDetailedTrackSearch(input, { sourcePlan: source }).proposals.length, 0)
  input.allowAdditionalParts = true
  const result = runDetailedTrackSearch(input, { sourcePlan: source })
  assert.ok(result.proposals.length)
  for (const p of result.proposals) {
    assert.equal(p.requirements.counts['30352'], 1)
    assert.ok(Object.entries(p.requirements.counts).some(([id, n]) => n > input.inventory.counts[id]))
    assert.equal(checkDetailedGeometry(p.plan).overlaps.length, 0)
    assert.equal(readTrackPlan(trackPlanFields(p.plan).layout).roomPlan.allowAdditionalParts, true)
  }
  assert.equal(JSON.stringify(input.inventory), before)
  assert.throws(() => validateRoom({ ...room, allowAdditionalParts: 'yes' }))
})
