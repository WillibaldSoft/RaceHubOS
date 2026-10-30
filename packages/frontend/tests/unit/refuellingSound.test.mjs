import test from 'node:test'
import assert from 'node:assert/strict'
import { refuellingSound } from '../../src/lib/refuellingSound.mjs'

function setup() {
  let state = {},
    at = 10000
  return (raw, pit = true, changes = {}) => {
    at += 500
    const device = {
      connected: true,
      socketConnected: true,
      deviceAddress: 'cu',
      lastStatusAt: at,
      cuStatus: { mode: 5, fuel: [raw], pit: [pit] },
      ...changes.device,
    }
    const result = refuellingSound(state, {
      sessionId: 'free',
      running: true,
      controllers: [0],
      now: at,
      ...changes,
      device,
    })
    state = result.state
    return result
  }
}
test('pit entry is silent; first fuel rise fires once until the car leaves the pits', () => {
  const step = setup()
  assert.equal(step(3, false).fire, false)
  assert.equal(step(3).fire, false)
  assert.equal(step(4).fire, true)
  assert.equal(step(5).fire, false)
  assert.equal(step(6).active, true)
  assert.equal(step(6, false).active, false)
  assert.equal(step(5).fire, false)
  assert.equal(step(6).fire, true)
})
test('full tank and interrupted fuel progress stop the effect without restarting it in the same visit', () => {
  const step = setup()
  step(3)
  assert.equal(step(4).active, true)
  for (let i = 0; i < 6; i++) assert.equal(step(4).fire, false)
  assert.equal(step(4).active, false)
  assert.equal(step(5).fire, false)
  assert.equal(step(5).active, true)
  assert.equal(step(15).active, false)
})
test('no inferred refuelling across stale, disabled, missing or disconnected telemetry', () => {
  for (const device of [
    { connected: false },
    { socketConnected: false },
    { lastStatusAt: 1 },
    { cuStatus: { mode: 4, fuel: [4], pit: [true] } },
    { cuStatus: { mode: 1, fuel: [4], pit: [true] } },
    { cuStatus: { mode: 5, fuel: [], pit: [true] } },
  ]) {
    const step = setup()
    step(3)
    assert.equal(step(4, true, { device }).active, false)
    assert.equal(step(5).fire, false, 'first restored sample is only a baseline')
    assert.equal(step(6).fire, true)
  }
})
test('session changes, CU replacement and pause clear comparison; unassigned controllers are ignored', () => {
  for (const changes of [
    { sessionId: 'other' },
    { device: { deviceAddress: 'other' } },
    { running: false },
    { controllers: [] },
  ]) {
    const step = setup()
    step(3)
    const result = step(4, true, changes)
    assert.equal(result.fire, false)
    assert.equal(result.active, false)
  }
})
test('fuel rises on the track and repeated telemetry never trigger a pit effect', () => {
  const step = setup()
  step(3, false)
  assert.equal(step(4, false).fire, false)
  assert.equal(step(5, true, { device: { lastStatusAt: 11000 } }).fire, false)
})
test('parallel refuelling is handled per controller and produces one combined trigger', () => {
  const sample = (previous, fuel, pit, at) =>
    refuellingSound(previous, {
      sessionId: 'free',
      running: true,
      controllers: [0, 1],
      now: at,
      device: { connected: true, socketConnected: true, lastStatusAt: at, cuStatus: { mode: 5, fuel, pit } },
    })
  let result = sample({}, [3, 4], [true, true], 10000)
  result = sample(result.state, [4, 5], [true, true], 10500)
  assert.equal(result.fire, true)
  result = sample(result.state, [5, 6], [false, true], 11000)
  assert.equal(result.fire, false)
  assert.equal(result.active, true)
})
