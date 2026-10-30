import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { createFrontendRouter } from '../lib/frontendRouter.js';
let directory, app;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'racehub-frontend-'));
  const dist = path.join(directory, '.local', 'frontend', 'dist');
  await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
  await fs.writeFile(path.join(dist, 'index.html'), '<!doctype html><title>RaceHubOS test</title>');
  await fs.writeFile(path.join(dist, 'assets', 'app.js'), 'window.test = true;');
  await fs.writeFile(path.join(dist, '.secret'), 'must stay private');
  app = express();
  app.use(createFrontendRouter(dist));
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});
test('deep links work from hidden parent directories and remain uncached', async () => {
  for (const route of ['/', '/settings', '/tracks/example']) {
    const response = await request(app).get(route);
    expect(response.status).toBe(200);
    expect(response.text).toContain('RaceHubOS test');
    expect(response.headers['cache-control']).toBe('no-store');
  }
});
test('real assets are served, missing chunks never get SPA HTML, and dotfiles stay private', async () => {
  expect((await request(app).get('/assets/app.js')).text).toContain('window.test');
  const missing = await request(app).get('/assets/missing.js');
  expect(missing.status).toBe(404);
  expect(missing.text).not.toContain('RaceHubOS test');
  expect((await request(app).get('/.secret')).text).not.toContain('must stay private');
});
