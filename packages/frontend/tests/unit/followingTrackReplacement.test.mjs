import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  enableFreePlacement,
  traceTrackPlan,
  transformFreeParts,
  groupTrackParts,
} from '../../../shared/src/index.js'
import { replaceFollowingTrack } from '../../../../addons/track-planner/src/components/followingTrackReplacement.js'
const straight = (n = 5) =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: n }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
const near = (a, b) => {
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
}
const samePose = (a, b) => {
  near(a.x, b.x)
  near(a.y, b.y)
  near(a.h, b.h)
}
test('catalogue replacement fixes incoming end and carries connected suffix through new geometry', () => {
  const base = straight(),
    snapshot = JSON.stringify(base),
    old = traceTrackPlan(base).segments
  const r = replaceFollowingTrack(base, 1, ['Kurve_1_60_rechts']),
    s = traceTrackPlan(r.plan).segments
  samePose(s[0].start, old[0].start)
  samePose(s[0].end, old[0].end)
  samePose(s[1].start, old[1].start)
  for (let i = 2; i < s.length; i++) samePose(s[i].start, s[i - 1].end)
  assert.equal(r.count, 3)
  assert.equal(r.moving.length, 3)
  assert.equal(JSON.stringify(base), snapshot)
  assert.notDeepEqual(s[4].end, old[4].end)
})
test('choosing a cut after insertion recomputes from original poses, preserving fixed suffix', () => {
  const base = straight(),
    old = traceTrackPlan(base).segments
  const r = replaceFollowingTrack(base, 1, ['Kurve_1_60_rechts'], 1),
    s = traceTrackPlan(r.plan).segments
  samePose(s[2].start, s[1].end)
  samePose(s[3].start, old[3].start)
  samePose(s[4].start, old[4].start)
  assert.equal(r.hasFixedNeighbour, true)
  const zero = replaceFollowingTrack(base, 1, ['Kurve_1_60_rechts'], 0)
  samePose(traceTrackPlan(zero.plan).segments[2].start, old[2].start)
  assert.deepEqual(
    replaceFollowingTrack(base, 1, ['Kurve_1_60_rechts'], 3).plan,
    replaceFollowingTrack(base, 1, ['Kurve_1_60_rechts']).plan
  )
})
test('follows physical connections with shuffled indices and leaves disconnected rails untouched', () => {
  let base = straight(4)
  base = {
    ...base,
    pieces: [
      base.pieces[2],
      base.pieces[0],
      base.pieces[3],
      base.pieces[1],
      { ...base.pieces[0], placement: { xMm: 0, yMm: 2000, headingDegrees: 0 } },
    ],
  }
  const r = replaceFollowingTrack(base, 3, ['Kurve_1_60_rechts']),
    s = traceTrackPlan(r.plan).segments
  assert.deepEqual(new Set(r.moving), new Set([0, 2]))
  samePose(s[0].start, s[3].end)
  samePose(s[2].start, s[0].end)
  assert.deepEqual(r.plan.pieces[4], base.pieces[4])
  assert.deepEqual(r.plan.pieces[1], base.pieces[1])
})
test('closed circuit wraps to selected incoming joint and offers a later chosen cut', () => {
  const base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 12 }, () => ({ type: 'Kurve_1_30_rechts', level: 0, jointDegrees: 0 })),
  })
  assert.equal(traceTrackPlan(base).connectivity.closed, true)
  const r = replaceFollowingTrack(base, 5, ['Standardgerade'])
  assert.equal(r.count, 11)
  assert.equal(r.hasFixedNeighbour, true)
  assert.equal(r.choices.length, 12)
  const short = replaceFollowingTrack(base, 5, ['Standardgerade'], 2)
  assert.deepEqual(new Set(short.moving), new Set([6, 7]))
  assert.deepEqual(short.plan.pieces[8], base.pieces[8])
})
test('multipart replacement remaps following rails, retains levels/extras and keeps groups whole', () => {
  let base = straight(5)
  base.pieces = base.pieces.map((p) => ({ ...p, level: 1 }))
  base.trackExtras = [
    {
      kind: 'single',
      anchor: 4,
      fuelBay: true,
      level: 1,
      paintOrder: 0,
      placement: { xMm: 0, yMm: 0, headingDegrees: 0 },
    },
  ]
  // A custom downstream group cannot be split by the cut selector.
  base = groupTrackParts(base, [2, 3])
  const r = replaceFollowingTrack(base, 1, ['DigitaleDoppelweiche_1', 'DigitaleDoppelweiche_2'])
  assert.equal(r.plan.pieces.length, 6)
  assert.ok(r.plan.pieces.every((p) => p.level === 1))
  assert.deepEqual(
    r.choices.map((c) => c.count),
    [0, 2, 3]
  )
  assert.equal(r.plan.trackExtras[0].anchor, 5)
  assert.throws(() => replaceFollowingTrack(base, 1, ['Standardgerade'], 1), /cut point/)
})
test('a backwards connected following rail follows with its end still attached', () => {
  let base = straight(3)
  base.pieces[2] = { ...base.pieces[2], placement: { xMm: 1035, yMm: 0, headingDegrees: 180 } }
  const r = replaceFollowingTrack(base, 1, ['Kurve_1_60_rechts']),
    s = traceTrackPlan(r.plan).segments
  near(s[2].end.x, s[1].end.x)
  near(s[2].end.y, s[1].end.y)
  assert.equal(r.count, 1)
})
