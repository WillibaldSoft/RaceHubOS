import { test } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import { CuRecovery } from '../services/CuRecovery.js';
import { explainCuError } from '../lib/cuDiagnosis.js';

function setup() {
  let now = 1000;
  const cu = new EventEmitter();
  cu.ble = new EventEmitter();
  cu.ble.connecting = false;
  cu.connected = false;
  cu.isConnected = () => cu.connected;
  cu.disconnect = async () => {
    const was = cu.connected;
    cu.connected = false;
    if (was) cu.emit('disconnected');
  };
  cu.connect = async () => {
    cu.connected = true;
    cu.emit('connected');
  };
  const sync = {
    source: null,
    lastStatusAt: null,
    stopPolling() {},
    startPolling() {
      this.polls = (this.polls || 0) + 1;
    },
    setDevice(d) {
      this.source = d;
    },
    getDevice() {
      return this.source;
    },
  };
  const recovery = new CuRecovery(cu, sync, null, { now: () => now, interval: 1000000 });
  return {
    cu,
    sync,
    recovery,
    advance: (n) => {
      now += n;
      return now;
    },
  };
}
test('failed startup retries automatically, reports cause, and stops when manually disconnected', async () => {
  const s = setup();
  let calls = 0;
  s.cu.connect = async () => {
    if (++calls === 1) throw new Error('Timeout waiting for peripheral');
    s.cu.connected = true;
    s.cu.emit('connected');
  };
  try {
    await assert.rejects(s.recovery.connect('CU'));
    assert.equal(s.recovery.diagnosis.code, 'not_found');
    s.advance(5001);
    await s.recovery.check();
    assert.equal(calls, 2);
    assert.equal(s.sync.polls, 1);
    s.sync.lastStatusAt = s.advance(1);
    s.cu.emit('status', {});
    await s.recovery.check();
    assert.equal(s.recovery.snapshot().code, 'live');
    s.recovery.stop();
    s.cu.connected = false;
    s.cu.emit('disconnected');
    s.advance(100000);
    await s.recovery.check();
    assert.equal(calls, 2);
    assert.equal(s.recovery.snapshot().code, 'manual');
  } finally {
    s.recovery.close();
  }
});
test('only one connection attempt runs and cancellation cannot start polling later', async () => {
  const s = setup();
  let resolve;
  s.cu.connect = () =>
    new Promise((r) => {
      resolve = r;
    });
  try {
    const first = s.recovery.connect('CU');
    assert.equal(s.recovery.connect('CU'), first);
    while (!resolve) await Promise.resolve();
    s.recovery.stop();
    resolve();
    await assert.rejects(first, /cancelled/);
    assert.equal(s.sync.polls, undefined);
    assert.equal(s.recovery.snapshot().code, 'manual');
  } finally {
    s.recovery.close();
  }
});
test('stale status initiates a bounded reconnect without any race-control commands', async () => {
  const s = setup();
  try {
    await s.recovery.connect('CU');
    s.sync.lastStatusAt = 1000;
    s.advance(13000);
    await s.recovery.check();
    assert.equal(s.recovery.diagnosis.code, 'data_timeout');
    s.advance(5001);
    await s.recovery.check();
    assert.equal(s.sync.polls, 2);
  } finally {
    s.recovery.close();
  }
});
test('hardware errors produce concrete German next steps', () => {
  assert.equal(explainCuError(new Error('Could not find all requested services')).code, 'appconnect');
  assert.match(explainCuError(new Error('AppConnect discovery timed out')).message, /fünf Sekunden/);
  assert.equal(explainCuError(new Error('Operation not permitted')).code, 'permission');
  assert.equal(explainCuError(new Error('Bluetooth adapter not ready')).code, 'adapter');
});
