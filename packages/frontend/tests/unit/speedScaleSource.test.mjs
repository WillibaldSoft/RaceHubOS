import test from 'node:test'
import assert from 'node:assert/strict'
import {
  lapDisplaySpeed,
  validateSpeedDisplay,
  SPEED_SCALE_SOURCES,
  validateSpeedScaleSource,
  normalizedSpeedScaleSource,
} from '../../../shared/src/speedDisplay.js'
test('each selected car supplies its scale in a mixed grid; missing values use the fallback', () => {
  const settings = { mode: 'scale', defaultScale: '1:32', scaleSource: SPEED_SCALE_SOURCES.CAR }
  assert.equal(lapDisplaySpeed(20, 10000, '1:24', settings).speed, 172.8)
  assert.equal(lapDisplaySpeed(20, 10000, 'D132', settings).speed, 230.4)
  for (const value of [null, '', '1:43']) assert.equal(lapDisplaySpeed(20, 10000, value, settings).scale, '1:32')
})
test('global selection overrides the car, while actual speed ignores both sources', () => {
  const settings = { mode: 'scale', defaultScale: '1:32', scaleSource: SPEED_SCALE_SOURCES.GLOBAL }
  assert.equal(lapDisplaySpeed(20, 10000, '1:24', settings).speed, 230.4)
  for (const scaleSource of Object.values(SPEED_SCALE_SOURCES))
    assert.equal(lapDisplaySpeed(20, 10000, '1:24', { ...settings, mode: 'actual', scaleSource }).speed, 7.2)
})
test('legacy settings keep car priority and the new source is validated separately', () => {
  const legacy = validateSpeedDisplay({ mode: 'scale', defaultScale: '1:32' })
  assert.deepEqual(legacy, { mode: 'scale', defaultScale: '1:32' })
  assert.equal(lapDisplaySpeed(20, 10000, '1:24', legacy).scale, '1:24')
  assert.equal(normalizedSpeedScaleSource(null), SPEED_SCALE_SOURCES.CAR)
  assert.equal(normalizedSpeedScaleSource('unknown'), SPEED_SCALE_SOURCES.CAR)
  assert.throws(() => validateSpeedScaleSource('unknown'))
})
