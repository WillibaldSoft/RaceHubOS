import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import addonsRouter from '../routes/addons.js';
import preferencesRouter from '../routes/preferences.js';
import { readAddonInstallation, validateAddonManifest } from '../lib/addons.js';
import { installAddon } from '../../../../scripts/addons.mjs';
import { prisma } from './setup.js';
let root, packageFile, pkg, oldDirectory;
const app = express();
app.use(express.json());
app.use('/api/addons', addonsRouter);
app.use('/api/preferences', preferencesRouter);
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'racehub-addon-test-'));
  oldDirectory = process.env.RACEHUBOS_ADDONS_DIR;
  process.env.RACEHUBOS_ADDONS_DIR = path.join(root, '.local', 'installed');
  const data = Buffer.from('<!doctype html><title>Test planner</title>');
  pkg = {
    manifest: {
      id: 'track-planner',
      hostApi: 1,
      version: '1.0.0',
      entry: 'index.html',
      files: { 'index.html': createHash('sha256').update(data).digest('hex') },
    },
    files: { 'index.html': data.toString('base64') },
  };
  packageFile = path.join(root, 'test.racehub-addon.json');
  await fs.writeFile(packageFile, JSON.stringify(pkg));
  await prisma.preference.deleteMany({
    where: {
      key: { in: ['addon:track-planner:enabled', 'race:speed-display'] },
    },
  });
});
afterEach(async () => {
  if (oldDirectory === undefined) delete process.env.RACEHUBOS_ADDONS_DIR;
  else process.env.RACEHUBOS_ADDONS_DIR = oldDirectory;
  await fs.rm(root, { recursive: true, force: true });
});
test('missing plugin does not activate or serve editor assets', async () => {
  expect((await request(app).get('/api/addons/track-planner')).body.data).toMatchObject({
    installed: false,
    enabled: false,
  });
  expect((await request(app).put('/api/addons/track-planner').send({ enabled: true })).status).toBe(409);
  expect((await request(app).get('/api/addons/track-planner/assets/index.html')).status).toBe(404);
});
test('local install starts disabled, activation serves it, disabling preserves files', async () => {
  await installAddon(packageFile);
  expect((await request(app).get('/api/addons/track-planner')).body.data).toMatchObject({
    installed: true,
    compatible: true,
    enabled: false,
  });
  expect((await request(app).get('/api/addons/track-planner/assets/index.html')).status).toBe(404);
  expect((await request(app).put('/api/addons/track-planner').send({ enabled: true })).status).toBe(200);
  expect((await request(app).get('/api/addons/track-planner/assets/index.html')).text).toContain('Test planner');
  expect((await request(app).get('/api/addons/track-planner/assets/manifest.json')).status).toBe(404);
  await request(app).put('/api/addons/track-planner').send({ enabled: false });
  expect((await readAddonInstallation()).compatible).toBe(true);
  expect((await request(app).get('/api/addons/track-planner/assets/index.html')).status).toBe(404);
});
test('bad checksums, incompatible host APIs and path traversal are rejected before installation', async () => {
  pkg.files['index.html'] = Buffer.from('changed').toString('base64');
  await fs.writeFile(packageFile, JSON.stringify(pkg));
  await expect(installAddon(packageFile)).rejects.toThrow('checksum');
  expect(() => validateAddonManifest({ ...pkg.manifest, hostApi: 2 })).toThrow();
  for (const name of ['../outside', '/absolute', 'a//b', 'a/./b', 'a\\b'])
    expect(() =>
      validateAddonManifest({
        ...pkg.manifest,
        files: { ...pkg.manifest.files, [name]: '0'.repeat(64) },
      })
    ).toThrow();
});
test('existing installation is never overwritten, damaged or linked assets fail closed', async () => {
  const destination = await installAddon(packageFile);
  await expect(installAddon(packageFile)).rejects.toThrow('already installed');
  await fs.writeFile(path.join(destination, 'index.html'), 'changed');
  expect((await readAddonInstallation()).compatible).toBe(false);
  await fs.rm(path.join(destination, 'index.html'));
  await fs.symlink(packageFile, path.join(destination, 'index.html'));
  expect((await readAddonInstallation()).compatible).toBe(false);
});
test('activation and speed preferences validate input and cannot bypass the add-on endpoint', async () => {
  expect((await request(app).put('/api/addons/track-planner').send({ enabled: 'true' })).status).toBe(400);
  expect((await request(app).put('/api/preferences/addon:track-planner:enabled').send({ value: true })).status).toBe(
    400
  );
  expect(
    (
      await request(app)
        .put('/api/preferences/race:speed-display')
        .send({ value: { mode: 'scale', defaultScale: '1:24' } })
    ).status
  ).toBe(200);
  expect((await request(app).get('/api/preferences/race:speed-display')).body.data).toEqual({
    mode: 'scale',
    defaultScale: '1:24',
  });
  expect(
    (
      await request(app)
        .put('/api/preferences/race:speed-display')
        .send({ value: { mode: 'scale', defaultScale: '1:43' } })
    ).status
  ).toBe(400);
});
