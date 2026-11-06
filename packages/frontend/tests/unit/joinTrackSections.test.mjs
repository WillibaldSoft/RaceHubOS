import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  enableFreePlacement,
  traceTrackPlan,
  transformFreeParts,
  groupTrackParts,
} from '../../../shared/src/index.js'
import {
  trackSectionJoinOptions,
  joinTrackSections,
} from '../../../../addons/track-planner/src/components/joinTrackSections.js'
const fixture = () =>
  transformFreeParts(
    enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
    }),
    [2, 3, 4],
    { degrees: 60, dx: 800, dy: 400 }
  )
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
test('joins whole distant sections, preserving fixed section and internal geometry', () => {
  const base = fixture(),
    snapshot = JSON.stringify(base),
    before = traceTrackPlan(base).segments
  const r = joinTrackSections(base, [0, 3]),
    after = traceTrackPlan(r.plan).segments
  assert.deepEqual(r.fixed, [0, 1])
  assert.deepEqual(new Set(r.moving), new Set([2, 3, 4]))
  assert.deepEqual(r.plan.pieces.slice(0, 2), base.pieces.slice(0, 2))
  assert.equal(traceTrackPlan(r.plan).connectivity.components, 1)
  near(after[2].start.x, after[1].end.x)
  near(after[2].start.y, after[1].end.y)
  near(after[4].end.x - after[2].start.x, 1035)
  near(after[4].end.y - after[2].start.y, 0)
  assert.equal(JSON.stringify(base), snapshot)
  assert.notDeepEqual(after[4].end, before[4].end)
})
test('selection order decides which complete section remains fixed', () => {
  const base = fixture(),
    r = joinTrackSections(base, [3, 0])
  assert.deepEqual(r.plan.pieces.slice(2), base.pieces.slice(2))
  assert.equal(traceTrackPlan(r.plan).connectivity.components, 1)
})
test('explicit start-to-start connection rotates the moving section by 180 degrees', () => {
  let base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: [
      { type: 'Standardgerade', level: 0, jointDegrees: 0 },
      { type: 'Standardgerade', level: 0, jointDegrees: 0 },
    ],
  })
  base = transformFreeParts(base, [1], { dx: 700, dy: 500 })
  const r = joinTrackSections(base, [0, 1], '0:0/1:0'),
    s = traceTrackPlan(r.plan).segments
  near(s[1].start.x, s[0].start.x)
  near(s[1].start.y, s[0].start.y)
  near(Math.abs(s[1].start.h - s[0].start.h), Math.PI)
  assert.equal(traceTrackPlan(r.plan).connectivity.components, 1)
})
test('rejects same section, three sections, wrong levels and unknown pairs', () => {
  const base = fixture()
  assert.equal(trackSectionJoinOptions(base, [0, 1]).reason, 'sameSection')
  assert.throws(() => joinTrackSections(base, [0, 3], 'missing'))
  const raised = { ...base, pieces: base.pieces.map((p, i) => ({ ...p, level: i >= 2 ? 1 : 0 })) }
  assert.equal(trackSectionJoinOptions(raised, [0, 3]).reason, 'differentLevels')
  const extra = {
    ...base,
    pieces: [...base.pieces, { ...base.pieces[0], placement: { xMm: 2000, yMm: 2000, headingDegrees: 0 } }],
  }
  assert.equal(trackSectionJoinOptions(extra, [0, 3, 5]).reason, 'selectTwo')
})
test('groups remain rigid, anchored extras and rail metadata survive joining', () => {
  let base = fixture()
  base.trackExtras = [
    {
      kind: 'single',
      fuelBay: true,
      anchor: 4,
      level: 0,
      paintOrder: 0,
      placement: { xMm: 0, yMm: 100, headingDegrees: 0 },
    },
  ]
  base = groupTrackParts(base, [3, 4])
  const r = joinTrackSections(base, [0, 3])
  assert.deepEqual(r.plan.partGroups, base.partGroups)
  assert.deepEqual(r.plan.trackExtras, base.trackExtras)
  assert.equal(traceTrackPlan(r.plan).connectivity.components, 1)
  const locked = groupTrackParts(fixture(), [0, 3])
  assert.equal(trackSectionJoinOptions(locked, [0, 3]).reason, 'sameSection')
})
test('several marked rails in exactly two sections can be joined together', () => {
  const r = joinTrackSections(fixture(), [0, 1, 3, 4])
  assert.equal(traceTrackPlan(r.plan).connectivity.components, 1)
})

test('joining two displaced semicircles closes both ends when their geometry matches', () => {
  const original = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 12 }, () => ({ type: 'Kurve_1_30_rechts', level: 0, jointDegrees: 0 })),
  })
  const base = transformFreeParts(original, [6, 7, 8, 9, 10, 11], { degrees: 45, dx: 1200, dy: 800 })
  assert.equal(traceTrackPlan(base).connectivity.components, 2)
  const r = joinTrackSections(base, [0, 6], '5:1/6:0')
  assert.equal(traceTrackPlan(r.plan).connectivity.closed, true)
  assert.deepEqual(r.plan.pieces.slice(0, 6), base.pieces.slice(0, 6))
})
