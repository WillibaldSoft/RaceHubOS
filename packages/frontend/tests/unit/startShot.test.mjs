import test from 'node:test'
import assert from 'node:assert/strict'
import { startShotTransition } from '../../src/lib/startShot.mjs'
function run(sequence, changes = {}) {
  let state = {},
    shots = 0
  for (const start of sequence) {
    const next = startShotTransition(state, { sessionId: 'race', active: true, connected: true, start, ...changes })
    state = next.state
    shots += Number(next.fire)
  }
  return shots
}
test('normal CU countdown fires one shot at GO, never again at racing or repeated samples', () => {
  assert.equal(run([0, 1, 2, 3, 4, 5, 6, 7, 7, 0, 0]), 1)
  assert.equal(run([1, 2, 3, 4, 5, 6, 0, 0]), 1)
  assert.equal(run([0, 0, 7, 7]), 0)
  assert.equal(run([1, 0]), 0)
  assert.equal(run([1, 2, 3, 8, 0]), 0)
  assert.equal(run([1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 0]), 2)
})
test('inactive sessions, disconnects and session switches cannot trigger a stale shot', () => {
  assert.equal(run([1, 2, 3, 4, 5, 6, 7, 0], { active: false }), 0)
  assert.equal(run([1, 2, 3, 4, 5, 6, 7, 0], { connected: false }), 0)
  const armed = startShotTransition({}, { sessionId: 'one', active: true, connected: true, start: 6 }).state
  assert.equal(startShotTransition(armed, { sessionId: 'two', active: true, connected: true, start: 7 }).fire, false)
  const lost = startShotTransition(armed, { sessionId: 'one', active: true, connected: false, start: 6 }).state
  assert.equal(startShotTransition(lost, { sessionId: 'one', active: true, connected: true, start: 7 }).fire, false)
})
