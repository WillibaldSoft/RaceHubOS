import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { cockpitPlan as buildCockpitPlan, cockpitSummary as summary, cockpitSignature } from '../lib/cockpitPlan.js';
import { readCockpitArchive } from '../lib/cockpitHistory.js';
import { getDatabasePath } from '../lib/database-url.js';
import { createBackup, validateBackup, restoreBackup } from '../lib/dataBackup.js';
import { insertCockpitData } from '../lib/cockpitData.js';

export const dataDirectory =
  process.env.RACEHUBOS_BACKUP_DIR ||
  fileURLToPath(new URL('../../../../../installation/datensicherungen/', import.meta.url));
const uploads = fileURLToPath(new URL('../../public/uploads/', import.meta.url));
const prepared = fileURLToPath(
  new URL('../../../../../installation/cockpit-uebernahme/import-vorschau.json', import.meta.url)
);
const converter = fileURLToPath(new URL('../../scripts/cockpit_import.py', import.meta.url));
const router = express.Router(),
  previews = new Map();
let service, socket;
export function setDataServices(sessionService, io) {
  service = sessionService;
  socket = io;
}
router.use((req, res, next) => {
  const address = req.socket.remoteAddress,
    origin = req.get('origin');
  if (
    !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) ||
    (origin && origin !== `${req.protocol}://${req.get('host')}`)
  )
    return res.status(403).json({ success: false, error: 'Datensicherung nur lokal auf diesem Rechner öffnen.' });
  res.set('Cache-Control', 'no-store');
  next();
});
const backupName = /^racehubos-[a-z0-9-]+\.json$/;
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fingerprint = (backup) => digest({ tables: backup.payload.tables, images: backup.payload.images });
function checkIdle() {
  if (service?.isActive()) throw new Error('Bitte die laufende oder pausierte Sitzung zuerst beenden.');
}
export function saveLocalBackup(prefix = 'sicherung') {
  checkIdle();
  const backup = createBackup(getDatabasePath(), uploads);
  fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const id = `racehubos-${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.json`;
  fs.writeFileSync(path.join(dataDirectory, id), JSON.stringify(backup), { mode: 0o600 });
  return { id, backup };
}
function remember(value) {
  for (const [id, entry] of previews) if (entry.expires < Date.now()) previews.delete(id);
  while (previews.size >= 3) previews.delete(previews.keys().next().value);
  const id = randomUUID();
  previews.set(id, { ...value, expires: Date.now() + 30 * 60000 });
  return id;
}
function entry(id, kind) {
  const value = previews.get(id);
  if (!value || value.kind !== kind || value.expires < Date.now())
    throw new Error('Vorschau abgelaufen. Bitte erneut prüfen.');
  return value;
}
function fail(res, error) {
  return res.status(400).json({ success: false, error: error.message || 'Vorgang fehlgeschlagen.' });
}
router.get('/backups', (req, res) => {
  try {
    fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
    res.json({
      success: true,
      data: fs
        .readdirSync(dataDirectory)
        .filter((name) => backupName.test(name))
        .sort()
        .reverse(),
    });
  } catch (e) {
    fail(res, e);
  }
});
router.post('/backup', (req, res) => {
  try {
    const { id, backup } = saveLocalBackup();
    res.json({ success: true, id, summary: validateBackup(getDatabasePath(), backup) });
  } catch (e) {
    fail(res, e);
  }
});
router.get('/download/:id', (req, res) => {
  if (!backupName.test(req.params.id)) return res.status(400).end();
  res.download(path.join(dataDirectory, req.params.id), req.params.id, (e) => {
    if (e && !res.headersSent) res.status(404).json({ success: false, error: 'Sicherung nicht gefunden.' });
  });
});
router.post('/restore/preview', (req, res) => {
  try {
    checkIdle();
    const backup = req.body.backup,
      summary = validateBackup(getDatabasePath(), backup);
    const current = createBackup(getDatabasePath(), uploads);
    res.json({ success: true, id: remember({ kind: 'restore', backup, before: fingerprint(current) }), summary });
  } catch (e) {
    fail(res, e);
  }
});
router.post('/restore', (req, res) => {
  try {
    checkIdle();
    if (req.body.confirmed !== true) throw new Error('Bitte das Ersetzen des Datenbestands ausdrücklich bestätigen.');
    const value = entry(req.body.id, 'restore'),
      current = createBackup(getDatabasePath(), uploads);
    if (fingerprint(current) !== value.before)
      throw new Error('Daten wurden seit der Vorschau geändert. Bitte Sicherung erneut prüfen.');
    const previous = saveLocalBackup('vor-ruecksicherung');
    restoreBackup(getDatabasePath(), uploads, value.backup);
    previews.delete(req.body.id);
    service?.clearAfterDataRestore();
    socket?.emit('data:restored');
    res.json({ success: true, previous: previous.id });
  } catch (e) {
    fail(res, e);
  }
});

const cockpitPlan = (data, options) => buildCockpitPlan(getDatabasePath(), uploads, data, options);
router.get('/cockpit/history', (req, res) => {
  const db = new Database(getDatabasePath(), { readonly: true });
  try {
    res.json({ success: true, data: readCockpitArchive(db) });
  } catch (e) {
    fail(res, e);
  } finally {
    db.close();
  }
});
router.get('/cockpit/prepared', (req, res) => res.json({ success: true, available: fs.existsSync(prepared) }));
router.post('/cockpit/prepared', (req, res) => {
  try {
    checkIdle();
    const data = JSON.parse(fs.readFileSync(prepared, 'utf8')),
      plan = cockpitPlan(data, req.body.options);
    res.json({
      success: true,
      id: remember({ kind: 'cockpit', data, options: req.body.options, before: digest(cockpitSignature(plan)) }),
      summary: summary(plan),
    });
  } catch (e) {
    fail(res, e);
  }
});
const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'racehub-data-'));
const upload = multer({ dest: uploadDirectory, limits: { fileSize: 180 * 1024 * 1024, files: 1 } });
router.post('/cockpit/preview', upload.single('file'), async (req, res) => {
  try {
    checkIdle();
    if (!req.file) throw new Error('Bitte eine Cockpit-XP-ZIP-Sicherung auswählen.');
    const { stdout } = await promisify(execFile)('python3', [converter, req.file.path], {
      timeout: 60000,
      maxBuffer: 45 * 1024 * 1024,
    });
    const data = JSON.parse(stdout);
    data.source = req.file.originalname;
    const options = JSON.parse(req.body.options || '{}'),
      plan = cockpitPlan(data, options);
    res.json({
      success: true,
      id: remember({ kind: 'cockpit', data, options, before: digest(cockpitSignature(plan)) }),
      summary: summary(plan),
    });
  } catch (e) {
    fail(res, new Error(e.stderr?.trim() || e.message));
  } finally {
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
  }
});
router.post('/cockpit/import', (req, res) => {
  try {
    checkIdle();
    if (req.body.confirmed !== true) throw new Error('Datenübernahme bitte bestätigen.');
    const value = entry(req.body.id, 'cockpit'),
      plan = cockpitPlan(value.data, value.options);
    if (!Object.values(summary(plan).counts).some((n) => n > 0))
      throw new Error(
        'Keine neuen zuordenbaren Daten vorhanden. Bereits importierte Daten werden nicht doppelt übernommen.'
      );
    if (digest(cockpitSignature(plan)) !== value.before)
      throw new Error('Daten wurden seit der Vorschau geändert. Bitte erneut prüfen.');
    const previous = saveLocalBackup('vor-cockpit-import');
    insertCockpitData(getDatabasePath(), uploads, plan);
    previews.delete(req.body.id);
    socket?.emit('data:restored');
    res.json({ success: true, previous: previous.id, summary: summary(plan) });
  } catch (e) {
    fail(res, e);
  }
});
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  fail(res, new Error(error.code === 'LIMIT_FILE_SIZE' ? 'Datei zu groß. Maximal 180 MB.' : error.message));
});
export default router;
