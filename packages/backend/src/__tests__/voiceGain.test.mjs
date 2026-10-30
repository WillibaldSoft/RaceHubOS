import test from 'node:test';
import assert from 'node:assert/strict';
import { amplifyVoice } from '../lib/voiceGain.js';
function wav() {
  const b = Buffer.alloc(44 + 2000);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(22050, 24);
  b.writeUInt32LE(44100, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(2000, 40);
  for (let i = 44; i < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i) * 4000), i);
  return b;
}
test('speech gain increases average level without wrapping/clipping or changing length/header/source', () => {
  const original = wav(),
    copy = Buffer.from(original),
    amplified = amplifyVoice(original, 4);
  assert.deepEqual(original, copy);
  assert.equal(amplified.length, original.length);
  assert.deepEqual(amplified.subarray(0, 44), original.subarray(0, 44));
  let before = 0,
    after = 0;
  for (let i = 44; i < original.length; i += 2) {
    before += original.readInt16LE(i) ** 2;
    after += amplified.readInt16LE(i) ** 2;
    assert.ok(Math.abs(amplified.readInt16LE(i)) < 32767);
  }
  assert.ok(after > before * 10);
  assert.deepEqual(amplifyVoice(original, 1), original);
  assert.throws(() => amplifyVoice(original, 5));
  assert.throws(() => amplifyVoice(Buffer.from('broken'), 2));
});
