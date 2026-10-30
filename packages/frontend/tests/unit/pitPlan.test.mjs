import test from 'node:test'
import assert from 'node:assert/strict'
import { pitPlan } from '../../src/lib/pitPlan.mjs'
const entries = [
  { controller: 0, driver: { name: 'Andi' } },
  { controller: 1, driver: { name: 'Felix' } },
  { controller: 2, driver: { name: 'Jan' } },
]
const device = {
  connected: true,
  socketConnected: true,
  lastStatusAt: 10000,
  cuStatus: { mode: 5, fuel: [3, 1, 12], pit: [false, false, true] },
}
test('parallel pit advice orders low fuel first and reports cars in pit without claiming slot occupancy', () => {
  const p = pitPlan(entries, device, { pitPlaces: 2 }, 10000)
  assert.match(p, /2 Tankplätze · 1 Auto in Boxengasse/)
  assert.ok(p.indexOf('Felix') < p.indexOf('Andi'))
  assert.match(p, /Felix.*links \(1× Weichentaste\)/)
  assert.match(p, /Andi.*rechts \(2× oder lange drücken\)/)
  assert.doesNotMatch(p, /frei|belegt/)
  assert.match(pitPlan(entries, { ...device, lastStatusAt: 0 }, {}, 10000), /aktuelle Tankdaten/)
  assert.equal(pitPlan(entries, device, { pitPlan: false }, 10000), null)
})
