import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPiperInstallation } from '../lib/piperPaths.js';

test('voice discovery preserves local installation and accepts a complete independent package', () => {
  const complete = (root) =>
    new Set([
      root + '/venv/bin/python3',
      root + '/worker.py',
      root + '/voices/de_DE-thorsten-medium.onnx',
      root + '/voices/de_DE-thorsten-medium.onnx.json',
    ]);
  const system = complete('/opt/racehubos-piper');
  assert.equal(
    findPiperInstallation([undefined, '/missing', '/opt/racehubos-piper'], (p) => system.has(p)).home,
    '/opt/racehubos-piper'
  );
  const both = new Set([...system, ...complete('/local')]);
  assert.equal(findPiperInstallation(['/local', '/opt/racehubos-piper'], (p) => both.has(p)).home, '/local');
  system.delete('/opt/racehubos-piper/voices/de_DE-thorsten-medium.onnx.json');
  assert.equal(
    findPiperInstallation(['/opt/racehubos-piper'], (p) => system.has(p)),
    null
  );
});
