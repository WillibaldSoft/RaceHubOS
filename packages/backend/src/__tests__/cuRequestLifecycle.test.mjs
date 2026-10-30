import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { ControlUnit } from '../services/controlUnit.js';
import { SessionService } from '../services/SessionService.js';
function cuSetup() {
  const ble = new EventEmitter();
  ble.send = async () => {};
  const cu = new ControlUnit({ ble });
  cu.on('error', () => {});
  ble.emit('ready');
  return { cu, ble };
}
test('CU requests run in FIFO and a send failure clears the waiter instead of blocking later commands', async () => {
  const { cu, ble } = cuSetup();
  const calls = [];
  ble.send = async (b) => {
    calls.push(b.toString());
    if (b.toString() === 'A') throw Error('send failed');
    setTimeout(() => ble.emit('data', Buffer.from('B')), 1);
  };
  const a = cu.request(Buffer.from('A'), 100),
    b = cu.request(Buffer.from('B'), 100);
  await assert.rejects(a, /send failed/);
  assert.equal((await b).toString(), 'B');
  assert.deepEqual(calls, ['A', 'B']);
  assert.equal(cu.waitingForResponse, null);
  assert.equal(cu._requestBusy, false);
});
test('disconnect promptly rejects current request and queued commands are never replayed after reconnect', async () => {
  const { cu, ble } = cuSetup();
  const sent = [];
  ble.send = async (b) => sent.push(b.toString());
  const a = cu.request(Buffer.from('A'), 500),
    b = cu.request(Buffer.from('B'), 500);
  const resultA = assert.rejects(a, /unterbrochen/),
    resultB = assert.rejects(b, /Not connected/);
  await wait(1);
  ble.emit('disconnect');
  ble.emit('ready');
  await Promise.all([resultA, resultB]);
  assert.deepEqual(sent, ['A']);
  assert.equal(cu.waitingForResponse, null);
});
test('a timed-out waiter cannot resolve or clear a newer request', async () => {
  const { cu, ble } = cuSetup();
  const a = cu.request(Buffer.from('A'), 5);
  await wait(1);
  const stale = cu.waitingForResponse;
  await assert.rejects(a, /timeout/);
  ble.send = async () => {};
  const b = cu.request(Buffer.from('B'), 100);
  await wait(1);
  stale.resolve(Buffer.from('A'));
  assert.equal(cu.waitingForResponse.expectedPrefix, 66);
  ble.emit('data', Buffer.from('B'));
  await b;
});
test('reset is single-flight and retains active RAM/DB state when hardware stop fails', async () => {
  const s = Object.create(SessionService.prototype);
  let stops = 0,
    clears = 0,
    updates = 0;
  Object.assign(s, {
    activeSessionId: 'one',
    prisma: {
      session: {
        findUnique: async () => ({ id: 'one' }),
        update: async () => {
          updates++;
        },
      },
      lap: {
        updateMany: async () => {
          updates++;
        },
      },
      sessionDriver: {
        updateMany: async () => {
          updates++;
        },
      },
    },
    syncService: {
      stopRace: async () => {
        stops++;
        await wait(5);
        throw Error('CU unavailable');
      },
    },
    resetForNewSession: async () => {
      clears++;
      s.activeSessionId = null;
    },
  });
  const a = s.resetSession('one'),
    b = s.resetSession('one');
  assert.equal(a, b);
  await assert.rejects(a, /CU unavailable/);
  assert.equal(stops, 1);
  assert.equal(clears, 0);
  assert.equal(updates, 0);
  assert.equal(s.activeSessionId, 'one');
  s.syncService.stopRace = async () => {
    stops++;
  };
  await s.resetSession('one');
  assert.equal(stops, 2);
  assert.equal(clears, 1);
  assert.equal(updates, 3);
});
test('failed hardware timer reset leaves live session and heartbeat intact', async () => {
  const s = Object.create(SessionService.prototype);
  let stopped = 0;
  Object.assign(s, {
    activeSessionId: 'one',
    stopHeartbeat: () => {
      stopped++;
    },
    syncService: {
      reset: async () => {
        throw Error('timeout');
      },
    },
  });
  await assert.rejects(s.resetForNewSession(), /timeout/);
  assert.equal(s.activeSessionId, 'one');
  assert.equal(stopped, 0);
});
