// Experimental Windows setup. Never writes to an existing RaceHubOS profile.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const INSTALLER_VERSION = 1;
void INSTALLER_VERSION;
const root = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(root, 'RaceHubOS');
const base = path.join(process.env.LOCALAPPDATA || '', 'racehubos-experimental');
const data = path.join(base, 'data');
const port = Number(process.env.RACEHUBOS_PORT || 3002);
const url = `http://127.0.0.1:${port}`;
if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new Error('Windows x64 required');
fs.mkdirSync(data, { recursive: true });
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'production',
  FRONTEND_URL: url,
  DATABASE_URL: 'file:' + path.join(data, 'racehubos.db').replaceAll('\\', '/'),
  RACEHUBOS_BACKUP_DIR: path.join(base, 'backups'),
  RACEHUBOS_ADDONS_DIR: path.join(process.env.LOCALAPPDATA, 'Programs', 'RaceHubOS-Experimental-Addons'),
  RACEHUBOS_PIPER_HOME: path.join(process.env.LOCALAPPDATA, 'Programs', 'RaceHubOS-Piper'),
  PATH: path.join(root, 'runtime') + path.delimiter + process.env.PATH,
};
// Refuse a busy port instead of attaching to an unrelated running application.
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', () => reject(new Error(`Port ${port} ist belegt. Vorhandenen Server zuerst beenden.`)));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
const lockHash = createHash('sha256')
  .update(fs.readFileSync(path.join(app, 'package-lock.json')))
  .digest('hex');
const receipt = path.join(app, '.windows-setup-receipt');
if (!fs.existsSync(receipt) || fs.readFileSync(receipt, 'utf8') !== lockHash) {
  console.log(
    'EXPERIMENTELL: Einmalige Online-Einrichtung. Python 3 und Visual Studio C++ Build Tools werden fuer Bluetooth benoetigt.'
  );
  const npmCli = path.join(root, 'runtime/node_modules/npm/bin/npm-cli.js');
  const result = spawnSync(process.execPath, [npmCli, 'ci', '--include=dev'], { cwd: app, env, stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error(
      'Einrichtung fehlgeschlagen. Internet, Python 3 und Visual Studio C++ Build Tools pruefen. Keine vorhandenen Renndaten wurden veraendert.'
    );
  const prismaCli = path.join(app, 'node_modules/prisma/build/index.js');
  const generated = spawnSync(process.execPath, [prismaCli, 'generate'], {
    cwd: path.join(app, 'packages/backend'),
    env,
    stdio: 'inherit',
  });
  if (generated.status !== 0) throw new Error('Prisma-Einrichtung fehlgeschlagen. Bitte das Protokoll pruefen.');
  fs.writeFileSync(receipt, lockHash);
}
const db = path.join(data, 'racehubos.db');
if (!fs.existsSync(db)) fs.copyFileSync(path.join(root, 'empty.db'), db, fs.constants.COPYFILE_EXCL);
const uploadDir = path.join(data, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const uploads = path.join(app, 'packages/backend/public/uploads');
if (!fs.existsSync(uploads)) fs.symlinkSync(uploadDir, uploads, 'junction');
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(app, 'packages/backend'),
  env,
  stdio: 'inherit',
});
child.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code || 0;
});
for (let i = 0; i < 120 && child.exitCode === null; i++) {
  try {
    const response = await fetch(url + '/health', { signal: AbortSignal.timeout(500) });
    if (response.ok && (await response.json()).status === 'ok') {
      console.log(url);
      spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
