import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const ADDON_API_VERSION = 1;
export const TRACK_PLANNER_ID = 'track-planner';
export const ADDON_ENABLED_KEY = 'addon:track-planner:enabled';
const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function addonsDirectory() {
  return path.resolve(process.env.RACEHUBOS_ADDONS_DIR || path.join(backend, 'addons'));
}
export function validateAddonManifest(manifest) {
  if (
    manifest?.id !== TRACK_PLANNER_ID ||
    manifest.hostApi !== ADDON_API_VERSION ||
    typeof manifest.version !== 'string' ||
    manifest.entry !== 'index.html' ||
    !manifest.files ||
    typeof manifest.files !== 'object' ||
    Array.isArray(manifest.files)
  )
    throw new Error('Incompatible add-on manifest');
  const files = Object.entries(manifest.files);
  if (!files.length || files.length > 300 || !Object.hasOwn(manifest.files, manifest.entry))
    throw new Error('Invalid add-on files');
  for (const [name, hash] of files) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(name) ||
      name.split('/').some((p) => !p || p === '.' || p === '..') ||
      name === 'manifest.json' ||
      !/^[a-f0-9]{64}$/.test(hash)
    )
      throw new Error('Invalid add-on file');
  }
  return manifest;
}
export async function readAddonInstallation(root = addonsDirectory()) {
  const directory = path.join(root, TRACK_PLANNER_ID);
  let exists = false;
  try {
    await fs.lstat(directory);
    exists = true;
    if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Linked add-on directory');
    const manifestFile = path.join(directory, 'manifest.json');
    if (!(await fs.lstat(manifestFile)).isFile()) throw new Error('Invalid manifest file');
    const manifest = validateAddonManifest(JSON.parse(await fs.readFile(manifestFile, 'utf8')));
    for (const [name, hash] of Object.entries(manifest.files)) {
      // Every component must be a real directory/file, never a symlink.
      let current = directory;
      for (const part of name.split('/')) {
        current = path.join(current, part);
        if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Linked add-on asset');
      }
      if (
        createHash('sha256')
          .update(await fs.readFile(current))
          .digest('hex') !== hash
      )
        throw new Error('Damaged add-on asset');
    }
    return {
      installed: true,
      compatible: true,
      version: manifest.version,
      directory,
      manifest,
    };
  } catch (error) {
    return { installed: exists || error.code !== 'ENOENT', compatible: false };
  }
}
