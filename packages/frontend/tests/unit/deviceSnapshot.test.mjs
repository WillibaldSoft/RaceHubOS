import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyDevice, applyDeviceSnapshot, deviceConnectionState } from '../../src/lib/deviceSnapshot.mjs'
const snap = (patch = {}) => ({
  connected: true,
  deviceType: 'controlUnit',
  deviceAddress: 'test',
  lastStatus: { fuel: [14], start: 0, mode: 5, pit: [false] },
  serverId: 'a',
  revision: 3,
  serverTime: 10000,
  lastStatusAt: 9900,
  ...patch,
})
test('an HTTP read cannot overwrite a more recent socket revision', () => {
  const live = applyDeviceSnapshot(emptyDevice(), snap(), 20000)
  assert.equal(live.lastStatusAt, 19900)
  assert.equal(applyDeviceSnapshot(live, snap({ revision: 2, connected: false }), 20100), live)
})
test('a repeated old reading ages instead of being marked fresh by a new HTTP request', () => {
  const d = applyDeviceSnapshot(emptyDevice(), snap({ serverTime: 20000, lastStatusAt: 9000 }), 50000)
  assert.equal(d.lastStatusAt, 39000)
  assert.equal(deviceConnectionState(d, true, 50000), 'stale')
})
test('server restart accepts its new revision; complete snapshot restores identity and fuel', () => {
  const a = applyDeviceSnapshot(emptyDevice(), snap(), 20000)
  const b = applyDeviceSnapshot(a, snap({ serverId: 'new', revision: 0 }), 20100)
  assert.equal(b.serverId, 'new')
  assert.equal(b.deviceAddress, 'test')
  assert.equal(b.cuStatus.fuel[0], 14)
})
test('connection labels distinguish transport, CU, initial data and expired data', () => {
  const d = applyDeviceSnapshot(emptyDevice(), snap(), 20000)
  assert.equal(deviceConnectionState(d, false, 20000), 'serverDisconnected')
  assert.equal(deviceConnectionState(emptyDevice(), true, 20000), 'cuDisconnected')
  assert.equal(deviceConnectionState({ ...d, lastStatusAt: null }, true, 20000), 'waiting')
  assert.equal(deviceConnectionState(d, true, 20000), 'live')
  assert.equal(deviceConnectionState(d, true, 26000), 'stale')
  const off = applyDeviceSnapshot(d, snap({ revision: 4, connected: false }), 20001)
  assert.equal(off.cuStatus, null)
  assert.equal(off.lastStatusAt, null)
})
