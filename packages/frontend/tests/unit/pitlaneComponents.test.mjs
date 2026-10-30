import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { traceTrackPlan, railRequirements } from '../../../shared/src/index.js'
import { pitlaneComponents, pitlaneLegend } from '../../src/components/tracks/pitlaneComponents.js'
test('native pit components retain their own identity instead of the main-road carrier', () => {
  const p = JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url))),
    before = JSON.stringify(p),
    trace = traceTrackPlan(p),
    parts = pitlaneComponents(p, trace.segments)
  assert.equal(parts.find((p) => p.id === 'extra-2').kind, 'single')
  assert.equal(parts.find((p) => p.id === 'extra-2').short, 'ESG')
  assert.equal(parts.find((p) => p.id === 'extra-2').article, '30341')
  for (const i of [4, 5]) assert.equal(parts.find((p) => p.id === `extra-${i}`).article, '30361')
  assert.ok(!parts.some((p) => p.extraIndex === 1 || p.extraIndex === 8))
  assert.equal(new Set(parts.map((p) => p.id)).size, parts.length)
  const legend = pitlaneLegend(p, trace.segments),
    r = railRequirements(p)
  for (const [kind, article] of [
    ['single', '30341'],
    ['fuel', '30361'],
  ])
    assert.equal(legend.find((p) => p.kind === kind).count, r.counts[article])
  assert.equal(JSON.stringify(p), before)
})
test('schematic box has separately identifiable single-lane modules, fuel rails and turnouts', () => {
  const p = JSON.parse(
      fs.readFileSync(
        new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)
      )
    ),
    before = JSON.stringify(p),
    parts = pitlaneComponents(p, traceTrackPlan(p).segments)
  assert.equal(parts.filter((p) => p.kind === 'single').length, 3)
  assert.equal(parts.filter((p) => p.kind === 'fuel').length, 2)
  assert.equal(parts.filter((p) => p.kind === 'entry').length, 2)
  assert.equal(parts.filter((p) => p.kind === 'exit').length, 2)
  assert.ok(parts.every((p) => Object.values(p.pose).every(Number.isFinite)))
  assert.equal(JSON.stringify(p), before)
})

test('unassigned single-lane extras remain identifiable even without an enabled pit', () => {
  const p = JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url)))
  p.pit.enabled = false
  const parts = pitlaneComponents(p, traceTrackPlan(p).segments)
  assert.equal(parts.filter((p) => p.kind === 'single').length, 3)
  assert.equal(parts.filter((p) => p.kind === 'fuel').length, 0)
})
