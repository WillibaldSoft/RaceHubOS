import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizedCarScale, scaleVoltageHint } from '../../../shared/src/carScale.js'
test('scale classification accepts common spellings, keeps unknown separate and displays both voltages without guessing a mixed value', () => {
  for (const value of ['1:32', '1 / 32', 'DIGITAL 132', 'D132', 'EVOLUTION'])
    assert.equal(normalizedCarScale(value), '1:32')
  for (const value of ['1:24', '1 / 24', 'DIGITAL124', 'D124']) assert.equal(normalizedCarScale(value), '1:24')
  assert.equal(normalizedCarScale(null), null)
  assert.equal(normalizedCarScale('1:43'), null)
  assert.match(scaleVoltageHint('132'), /14,8 V/)
  assert.match(scaleVoltageHint('124'), /18 V/)
  assert.match(scaleVoltageHint('all'), /14,8 V.*18 V/)
})
