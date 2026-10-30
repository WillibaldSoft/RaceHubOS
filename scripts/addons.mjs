#!/usr/bin/env node
// Local, explicit installation only. Packages are executable UI code: install trusted files.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { addonsDirectory, validateAddonManifest, TRACK_PLANNER_ID } from '../packages/backend/src/lib/addons.js';
export async function installAddon(packageFile, root = addonsDirectory()) {
  if ((await fs.stat(packageFile)).size > 20_000_000) throw new Error('Add-on package too large');
  const pkg = JSON.parse(await fs.readFile(packageFile, 'utf8'));
  const manifest = validateAddonManifest(pkg.manifest);
  if (Object.keys(pkg.files || {}).length !== Object.keys(manifest.files).length)
    throw new Error('Unexpected package files');
  const buffers = new Map();
  let bytes = 0;
  for (const [name, hash] of Object.entries(manifest.files)) {
    if (typeof pkg.files[name] !== 'string') throw new Error('Missing package asset');
    const data = Buffer.from(pkg.files[name], 'base64');
    bytes += data.length;
    if (bytes > 15_000_000 || createHash('sha256').update(data).digest('hex') !== hash)
      throw new Error('Invalid package checksum');
    buffers.set(name, data);
  }
  await fs.mkdir(root, { recursive: true });
  const destination = path.join(root, TRACK_PLANNER_ID);
  try {
    await fs.lstat(destination);
    throw new Error('Add-on already installed; remove it explicitly before replacing it');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const staging = await fs.mkdtemp(path.join(root, '.track-planner-'));
  try {
    for (const [name, data] of buffers) {
      const target = path.join(staging, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data, { flag: 'wx' });
    }
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await fs.rename(staging, destination);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
  return destination;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'install' || !process.argv[3]) {
    console.error('Usage: node scripts/addons.mjs install <trusted.racehub-addon.json>');
    process.exitCode = 1;
  } else
    try {
      console.log(await installAddon(path.resolve(process.argv[3])));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
}
