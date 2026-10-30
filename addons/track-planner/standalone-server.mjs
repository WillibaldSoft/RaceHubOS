#!/usr/bin/env node
// The standalone planner has its own data store. Never reads a RaceHubOS database.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const defaultData = () =>
  path.join(
    process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
    'racehubos-track-planner'
  );
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
export async function createStandaloneServer({
  dataDir = process.env.RACEHUBOS_PLANNER_DATA_DIR || defaultData(),
  publicDir = path.join(here, 'dist'),
} = {}) {
  await fs.mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, 'plans.json');
  let store;
  try {
    store = JSON.parse(await fs.readFile(file, 'utf8'));
    if (store.version !== 1 || !Array.isArray(store.tracks) || !store.preferences)
      throw new Error('Unsupported planner data');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    store = { version: 1, tracks: [], preferences: {} };
  }
  let queue = Promise.resolve();
  async function persist(next) {
    const backup = path.join(dataDir, 'backups');
    await fs.mkdir(backup, { recursive: true });
    try {
      await fs.copyFile(file, path.join(backup, `${Date.now()}-${randomUUID()}.json`));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const temporary = path.join(dataDir, `.plans-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify(next, null, 2), {
        flag: 'wx',
      });
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    store = next;
    const old = (await fs.readdir(backup)).filter((name) => name.endsWith('.json')).sort();
    for (const name of old.slice(0, -10)) await fs.rm(path.join(backup, name));
  }
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(data));
    };
    try {
      const allowed = new Set([`localhost:${server.address().port}`, `127.0.0.1:${server.address().port}`]);
      if (!allowed.has(req.headers.host)) return json(403, { success: false, error: 'Local host required' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (['POST', 'PUT'].includes(req.method)) {
        if (req.headers.origin && req.headers.origin !== url.origin)
          return json(403, { success: false, error: 'Same origin required' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { success: false });
        let size = 0,
          chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4_000_000) return json(413, { success: false });
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const operation = async () => {
          const next = structuredClone(store);
          if (url.pathname.startsWith('/api/preferences/') && req.method === 'PUT') {
            const key = decodeURIComponent(url.pathname.slice('/api/preferences/'.length));
            if (!['carreraRailInventory'].includes(key)) return json(400, { success: false });
            next.preferences[key] = body.value;
            await persist(next);
            return json(200, { success: true, data: body.value });
          }
          if (
            (url.pathname === '/api/tracks' && req.method === 'POST') ||
            (/^\/api\/tracks\/[a-f0-9-]+$/.test(url.pathname) && req.method === 'PUT')
          ) {
            if (
              typeof body.name !== 'string' ||
              !body.name.trim() ||
              body.name.length > 150 ||
              typeof body.layout !== 'string'
            )
              return json(400, { success: false });
            const plan = JSON.parse(body.layout);
            if (
              plan.kind !== 'racehubos.track-plan' ||
              plan.version !== 1 ||
              !Array.isArray(plan.pieces) ||
              !plan.pieces.length ||
              plan.pieces.length > 2500
            )
              return json(400, { success: false });
            const id = req.method === 'POST' ? randomUUID() : url.pathname.split('/').at(-1);
            const index = next.tracks.findIndex((row) => row.id === id);
            if (req.method === 'PUT' && index < 0) return json(404, { success: false });
            const track = {
              id,
              name: body.name.trim(),
              layout: body.layout,
              length: Number.isFinite(body.length) && body.length > 0 ? body.length : null,
              corners: Number.isInteger(body.corners) ? body.corners : null,
            };
            if (index >= 0) next.tracks[index] = track;
            else next.tracks.push(track);
            await persist(next);
            return json(200, { success: true, data: track });
          }
          return json(404, { success: false });
        };
        queue = queue.then(operation);
        await queue;
        return;
      }
      if (req.method !== 'GET') return json(405, { success: false });
      await queue;
      if (url.pathname === '/api/planner-info')
        return json(200, {
          application: 'racehubos-track-planner',
          version: 1,
        });
      if (url.pathname === '/api/tracks') {
        const offset = Math.max(0, parseInt(url.searchParams.get('offset')) || 0),
          limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 100));
        return json(200, {
          success: true,
          data: store.tracks.slice(offset, offset + limit),
          hasMore: offset + limit < store.tracks.length,
          total: store.tracks.length,
        });
      }
      if (url.pathname.startsWith('/api/preferences/'))
        return json(200, {
          success: true,
          data: store.preferences[decodeURIComponent(url.pathname.slice('/api/preferences/'.length))] ?? null,
        });
      const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      if (name.includes('\\') || name.split('/').includes('..')) return json(404, { success: false });
      const asset = path.resolve(publicDir, '.' + name);
      if (!asset.startsWith(path.resolve(publicDir) + path.sep)) return json(404, { success: false });
      const data = await fs.readFile(asset);
      res.writeHead(200, {
        'Content-Type': types[path.extname(asset)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch (error) {
      queue = queue.catch(() => {});
      if (!res.headersSent)
        json(error instanceof SyntaxError ? 400 : error.code === 'ENOENT' ? 404 : 500, {
          success: false,
          error: 'Planner request failed',
        });
      else res.end();
    }
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = await createStandaloneServer();
    server.listen(Number(process.env.PORT) || 3180, '127.0.0.1', () =>
      console.log(`RaceHubOS Track Planner: http://localhost:${server.address().port}`)
    );
    server.on('error', (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
