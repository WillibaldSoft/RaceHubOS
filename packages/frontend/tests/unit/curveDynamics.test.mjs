import test from 'node:test'
import assert from 'node:assert/strict'
import { analyseCurveDynamics, curveDynamicsScore } from '../../../shared/src/curveDynamics.js'
import { emptyTrackPlan } from '../../../shared/src/trackPlan.js'
import { validateRoom } from '../../../shared/src/roomConfiguration.js'
const plan = (types) => ({
  ...emptyTrackPlan(),
  geometryProfile: 'prototype',
  pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
})
test('flowing scoring penalises abrupt radius and direction changes, including the lap join', () => {
  const flowing = analyseCurveDynamics(plan(['Kurve_4_15_rechts', 'Kurve_3_30_rechts']))
  const sharp = analyseCurveDynamics(plan(['Kurve_4_15_rechts', 'Kurve_1_60_links']))
  assert.equal(flowing.minRadiusMm, 693)
  assert.equal(flowing.maxRadiusMm, 891)
  assert.equal(flowing.openingTransitions, 1)
  assert.equal(flowing.tighteningTransitions, 1)
  assert.ok(curveDynamicsScore(flowing, 'dynamic') > curveDynamicsScore(sharp, 'dynamic'))
  assert.equal(validateRoom({}).curveStyle, 'dynamic')
  assert.equal(flowing.directReversals, 0)
  assert.equal(sharp.directReversals, 2)
  assert.ok(curveDynamicsScore(flowing, 'flowing') > curveDynamicsScore(sharp, 'flowing'))
  assert.ok(curveDynamicsScore(sharp, 'technical') > curveDynamicsScore(flowing, 'technical'))
  assert.equal(curveDynamicsScore(sharp, 'balanced'), 0)
  assert.throws(() => validateRoom({ curveStyle: 'magic' }))
})
test('straight course has no invented curve radii or direction changes', () => {
  const d = analyseCurveDynamics(plan(['Standardgerade', 'Control_unit']))
  assert.equal(d.minRadiusMm, null)
  assert.equal(d.directReversals, 0)
  assert.equal(d.transitionCost, 0)
})
