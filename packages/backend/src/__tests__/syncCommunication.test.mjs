import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { SyncService } from '../services/SyncService.js';
function setup() {
  const events = [];
  const service = new SyncService({ emit: (name, data) => events.push({ name, data }) });
  const device = new EventEmitter();
  device.address = 'test';
  device.isConnected = () => true;
  service.setDevice(device);
  return { service, device, events };
}
test('setDevice and disconnect publish complete authoritative state; no cached fuel after disconnect', () => {
  const { service, device, events } = setup();
  assert.equal(events[0].name, 'cu:device');
  assert.equal(events[0].data.deviceAddress, 'test');
  service.handleStatus({ fuel: [14], start: 0, mode: 5, pit: [false] });
  assert.ok(service.getDeviceSnapshot().lastStatusAt);
  device.isConnected = () => false;
  device.emit('disconnected');
  const snap = service.getDeviceSnapshot();
  assert.equal(snap.connected, false);
  assert.equal(snap.lastStatus, null);
  assert.equal(snap.lastStatusAt, null);
  service.close();
});
test('unchanged status is coalesced; fuel changes and periodic heartbeats are sent', () => {
  const { service, events } = setup();
  const status = { fuel: [14], start: 0, mode: 5, pit: [false] };
  service.handleStatus(status);
  service.handleStatus(status);
  assert.equal(events.filter((e) => e.name === 'cu:status').length, 1);
  service.handleStatus({ ...status, fuel: [13] });
  assert.equal(events.filter((e) => e.name === 'cu:status').length, 2);
  service._lastStatusBroadcastAt -= 2100;
  service.handleStatus({ ...status, fuel: [13] });
  assert.equal(events.filter((e) => e.name === 'cu:status').length, 3);
  service.close();
});
test('stop/restart during an outstanding poll never creates concurrent requests or resurrects a stopped loop', async () => {
  const { service, device } = setup();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  device.poll = async () => {
    calls++;
    active++;
    maxActive = Math.max(maxActive, active);
    await gate;
    active--;
    return { type: 'status' };
  };
  service.setPollInterval(10);
  service.startPolling();
  service.startPolling();
  await wait(5);
  service.stopPolling();
  service.startPolling();
  await wait(5);
  assert.equal(calls, 1);
  service.setPollInterval(15);
  release();
  await wait(8);
  assert.equal(maxActive, 1);
  service.stopPolling();
  const stopped = calls;
  await wait(30);
  assert.equal(calls, stopped);
  service.close();
});
test('timer events drain in order; a stopped generation does not resume after a slow timer handler', async () => {
  const { service, device } = setup();
  const handled = [];
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  service.handleTimerEvent = async (e) => {
    if (e.timestamp === 1) await gate;
    handled.push(e.timestamp);
  };
  let calls = 0;
  device.poll = async () => {
    calls++;
    device.emit('timer', { timestamp: calls });
    return { type: 'timer' };
  };
  service.startPolling();
  await wait(5);
  assert.equal(calls, 1);
  service.stopPolling();
  release();
  await wait(10);
  assert.deepEqual(handled, [1]);
  assert.equal(calls, 1);
  service.close();
});
test('physical CU START never writes reset/position commands and starts the clock exactly once at GO', () => {
  const { service, device, events } = setup();
  let commands = 0,
    starts = 0;
  device.reset = () => {
    commands++;
  };
  device.clearPosition = () => {
    commands++;
  };
  service.setSessionService({
    onRaceStart: () => {
      starts++;
    },
  });
  service.lastTimestamps.set(0, 1234);
  for (const start of [0, 1, 2, 3, 4, 5, 6, 7, 0]) service.handleStatus({ fuel: [14], start, mode: 5, pit: [false] });
  assert.equal(commands, 0);
  assert.equal(starts, 1);
  assert.equal(service.lastTimestamps.size, 0);
  assert.equal(events.filter((e) => e.name === 'cu:reset').length, 1);
  assert.equal(service.pollInterval, 500);
  service.close();
});
test('GO may be missed over BLE; the first racing sample still starts once, but reconnecting in racing does not', () => {
  const { service } = setup();
  let starts = 0;
  service.setSessionService({
    onRaceStart: () => {
      starts++;
    },
  });
  for (const start of [0, 0, 1, 2, 3, 4, 5, 6, 0, 0]) service.handleStatus({ start });
  assert.equal(starts, 1);
  service.close();
});
test('car configuration completes before arming the CU, so physical countdown has no pending profile writes', async () => {
  const { SessionService } = await import('../services/SessionService.js');
  const calls = [];
  const session = Object.create(SessionService.prototype);
  Object.assign(session, {
    syncService: {
      isConnected: () => true,
      reset: async () => calls.push('reset'),
      startPolling: () => calls.push('poll'),
      prepareRace: async () => calls.push('ready'),
    },
    prisma: { session: { update: async () => {} } },
    loadSession: async () => {},
    applyCarConfigs: async () => {
      calls.push('profiles');
      await Promise.resolve();
      calls.push('profiles-done');
    },
    startHeartbeat: () => {},
    emit: () => {},
    emitStatusChanged: () => {},
    getState: () => ({}),
  });
  await session.startSession('test');
  assert.ok(calls.indexOf('profiles-done') < calls.indexOf('ready'));
});
