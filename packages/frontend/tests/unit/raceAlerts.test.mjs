import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fuelWarning, normalizeAlerts, interruptionReason } from '../../src/lib/raceAlerts.mjs'
test('reserve and empty are announced once, survive unknown samples and rearm after real refuelling', () => {
  let state = {}
  for (const [raw, expected] of [
    [4, []],
    [3, ['reserve']],
    [3, []],
    [null, []],
    [2, []],
    [0, ['empty']],
    [0, []],
    [4, []],
    [5, []],
    [3, ['reserve']],
  ]) {
    const next = fuelWarning(state, raw, 3)
    state = next.state
    assert.deepEqual(next.events, expected)
  }
  assert.deepEqual(fuelWarning({}, 0, 3).events, ['empty'])
  assert.deepEqual(fuelWarning({}, -1, 3).events, [])
})
test('interruption display distinguishes actual paused clock from loss of telemetry or CU stop', () => {
  const active = { status: 'active' },
    live = { connectionState: 'live', cuStatus: { start: 0 } }
  assert.equal(interruptionReason(active, live), null)
  assert.equal(interruptionReason({ status: 'finished' }, {}), null)
  assert.equal(interruptionReason({ status: 'paused' }, {}).key, 'paused')
  assert.equal(interruptionReason(active, { connectionState: 'stale' }).key, 'connection')
  assert.equal(interruptionReason(active, { ...live, cuStatus: { start: 8 } }).key, 'cuStopped')
  for (const start of [1, 2, 3, 4, 5, 6, 7, 0])
    assert.equal(interruptionReason(active, { ...live, cuStatus: { start } }), null)
  assert.equal(normalizeAlerts({ threshold: 99, volume: -1, emptyColor: 'bad' }).threshold, 14)
  assert.equal(normalizeAlerts({ volume: -1 }).volume, 0)
})
