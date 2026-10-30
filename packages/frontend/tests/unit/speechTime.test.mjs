import { test } from 'node:test'
import assert from 'node:assert/strict'
import { speechTimeParts, speechRate } from '../../src/lib/speechTime.mjs'
test('German speech rounds to hundredths and carries to the next minute', () => {
  assert.deepEqual(speechTimeParts(8234), { minutes: 0, seconds: '8,23' })
  assert.deepEqual(speechTimeParts(59999), { minutes: 1, seconds: '0' })
  assert.deepEqual(speechTimeParts(75129), { minutes: 1, seconds: '15,13' })
  assert.deepEqual(speechTimeParts(8234, 'en'), { minutes: 0, seconds: '8.23' })
  assert.equal(speechTimeParts(null), null)
})
test('Speech rate has a calm default and bounded user settings', () => {
  assert.equal(speechRate(NaN), 0.95)
  assert.equal(speechRate(0.9), 0.9)
  assert.equal(speechRate(20), 1.2)
  assert.equal(speechRate(-1), 0.8)
})
