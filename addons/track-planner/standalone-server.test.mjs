import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStandaloneServer } from './standalone-server.mjs';
test('standalone server saves, reopens and backs up independently; bad requests do not poison later writes', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'racehub-standalone-'));
  const publicDir = path.join(dataDir, 'web');
  await fs.mkdir(publicDir);
  await fs.writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>Planner</title>');
  let server = await createStandaloneServer({ dataDir, publicDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let api = `http://127.0.0.1:${server.address().port}`;
  const body = {
    name: 'Separater Rechner',
    layout: JSON.stringify({
      kind: 'racehubos.track-plan',
      version: 1,
      pieces: [{ type: 'Standardgerade', level: 0 }],
    }),
    length: 0.345,
    corners: 0,
  };
  const write = (url, data, method = 'POST') =>
    fetch(api + url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  try {
    assert.equal((await fetch(api)).status, 200);
    assert.equal((await fetch(api + '/api/tracks')).status, 200);
    let r = await write('/api/tracks', body);
    assert.equal(r.status, 200);
    const created = (await r.json()).data;
    r = await write('/api/tracks/' + created.id, { ...body, name: 'Gespeichert' }, 'PUT');
    assert.equal(r.status, 200);
    assert.equal((await fs.readdir(path.join(dataDir, 'backups'))).length, 1);
    assert.equal((await write('/api/tracks', { ...body, layout: 'bad json' })).status, 400);
    assert.equal((await write('/api/tracks', { ...body, name: 'Nach Fehler' })).status, 200);
    assert.equal(
      (
        await fetch(api + '/api/tracks', {
          method: 'POST',
          headers: {
            Origin: 'https://example.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      ).status,
      403
    );
    assert.equal(
      await new Promise((resolve, reject) => {
        http
          .get(api + '/api/tracks', { headers: { Host: 'example.com' } }, (response) => {
            response.resume();
            resolve(response.statusCode);
          })
          .on('error', reject);
      }),
      403
    );
    assert.equal(
      (await write('/api/preferences/carreraRailInventory', { value: { counts: { 20509: 20 } } }, 'PUT')).status,
      200
    );
    await new Promise((resolve) => server.close(resolve));
    server = await createStandaloneServer({ dataDir, publicDir });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    api = `http://127.0.0.1:${server.address().port}`;
    const rows = (await (await fetch(api + '/api/tracks')).json()).data;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'Gespeichert');
    assert.equal((await (await fetch(api + '/api/preferences/carreraRailInventory')).json()).data.counts['20509'], 20);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
