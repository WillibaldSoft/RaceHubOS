import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { originalNavigation } from '../../packages/frontend/src/lib/navigationAppearance.mjs';
import { emptyTrackPlan, trackPlanFields } from '../../packages/shared/src/trackPlan.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !output.includes('screenshot-demo'))
  throw new Error('Use a separate screenshot-demo directory.');
fs.mkdirSync(output, { recursive: true });
const filename = path.join(output, 'test.db');
if (fs.existsSync(filename)) throw new Error('Refusing to overwrite an existing database.');
const Database = createRequire(import.meta.url)('better-sqlite3');
const db = new Database(filename);
const migrations = path.join(root, 'packages/backend/prisma/migrations');
for (const name of fs.readdirSync(migrations).sort()) {
  const file = path.join(migrations, name, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.exec('BEGIN');
const now = Date.UTC(2026, 9, 30, 12);
const put = (table, row) => {
  const keys = Object.keys(row);
  db.prepare(
    `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`
  ).run(...Object.values(row));
};
const plan = emptyTrackPlan();
plan.pieces = [
  ...Array(3).fill('Standardgerade'),
  ...Array(3).fill('Kurve_1_60_rechts'),
  ...Array(3).fill('Standardgerade'),
  ...Array(3).fill('Kurve_1_60_rechts'),
].map((type) => ({ type, turn: 1, level: 0 }));
let layout = null;
try {
  layout = trackPlanFields(plan).layout;
} catch {
  /* A plain demo track is sufficient if the catalogue changes. */
}
put('Track', {
  id: 'demo-ring',
  name: 'Demo-Ring',
  length: 23.03,
  layout,
  color: '#2563eb',
  bestLap: 8421,
  bestLapBy: 'Demo Fahrer 1',
  createdAt: now,
  updatedAt: now,
});
put('Track', {
  id: 'demo-sprint',
  name: 'Demo Sprint Circuit',
  length: 18.4,
  color: '#d97706',
  createdAt: now,
  updatedAt: now,
});
for (const [id, name, color] of [
  ['demo-team-a', 'Team Blau', '#2563eb'],
  ['demo-team-b', 'Team Orange', '#ea580c'],
])
  put('Team', { id, name, color, createdAt: now, updatedAt: now });
const colors = ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#dc2626', '#0891b2'];
const models = [
  ['Porsche', '911 GT3 R'],
  ['BMW', 'M4 GT3'],
  ['Mercedes-AMG', 'GT3'],
  ['Audi', 'R8 LMS GT3'],
  ['Ferrari', '296 GT3'],
  ['Aston Martin', 'Vantage GT3'],
];
for (let i = 0; i < 6; i++) {
  put('Driver', {
    id: `demo-driver-${i}`,
    name: `Demo Fahrer ${i + 1}`,
    number: i + 1,
    color: colors[i],
    teamId: i % 2 ? 'demo-team-b' : 'demo-team-a',
    totalRaces: 3,
    wins: i === 0 ? 2 : i === 1 ? 1 : 0,
    podiums: i < 3 ? 3 : 0,
    bestLap: 8421 + i * 97,
    createdAt: now,
    updatedAt: now,
  });
  put('Car', {
    id: `demo-car-${i}`,
    brand: models[i][0],
    model: models[i][1],
    color: colors[i],
    maxSpeed: 12,
    brakeForce: 8,
    fuelCapacity: 10,
    scale: '1:32',
    totalRaces: 3,
    bestLap: 8421 + i * 97,
    createdAt: now,
    updatedAt: now,
  });
}
put('Championship', {
  id: 'demo-cup',
  name: 'Demo GT Cup',
  season: '2026',
  status: 'finished',
  mode: 'manual',
  trackId: 'demo-ring',
  createdAt: now,
  updatedAt: now,
});
for (let i = 0; i < 6; i++)
  put('ChampionshipParticipant', {
    id: `demo-participant-${i}`,
    championshipId: 'demo-cup',
    driverId: `demo-driver-${i}`,
    createdAt: now,
  });
for (const [id, name, type, championshipId, status, day] of [
  ['demo-qualif', 'Demo Qualifikation', 'qualif', 'demo-cup', 'finished', 2],
  ['demo-race', 'Demo GT Finale', 'race', 'demo-cup', 'finished', 1],
  ['demo-free', 'Freies Training', 'practice', null, 'draft', 0],
]) {
  const startedAt = now - day * 86400000;
  put('Session', {
    id,
    name,
    type,
    championshipId,
    trackId: 'demo-ring',
    status,
    fuelMode: 'OFF',
    maxLaps: type === 'race' ? 30 : null,
    maxDuration: 300000,
    gracePeriod: 30000,
    startedAt: status === 'finished' ? startedAt : null,
    finishedAt: status === 'finished' ? startedAt + 285000 : null,
    createdAt: startedAt,
    updatedAt: startedAt,
  });
  for (let i = 0; i < 6; i++) {
    const laps = status === 'finished' ? 30 - Math.floor(i / 3) : 0;
    put('SessionDriver', {
      id: `${id}-driver-${i}`,
      sessionId: id,
      driverId: `demo-driver-${i}`,
      carId: `demo-car-${i}`,
      controller: i,
      position: i + 1,
      gridPos: i + 1,
      finalPos: status === 'finished' ? i + 1 : null,
      totalLaps: laps,
      totalTime: laps ? 272490 + i * 1520 : 0,
      bestLapTime: laps ? 8421 + i * 97 : null,
      lastLapTime: laps ? 8650 + i * 110 : null,
      isDNF: 0,
    });
    for (let lap = 1; lap <= laps; lap++)
      put('Lap', {
        id: `${id}-${i}-${lap}`,
        sessionId: id,
        trackId: 'demo-ring',
        driverId: `demo-driver-${i}`,
        carId: `demo-car-${i}`,
        controller: i,
        phase: type,
        lapNumber: lap,
        lapTime: 8421 + i * 97 + (lap % 7) * 83,
        sector1: 2800 + i * 25,
        sector2: 2700 + i * 30,
        sector3: 2921 + i * 42 + (lap % 7) * 83,
        timestamp: startedAt + lap * 9000,
      });
  }
}
for (let i = 0; i < 6; i++)
  put('TrackRecord', {
    id: `demo-record-${i}`,
    trackId: 'demo-ring',
    driverId: `demo-driver-${i}`,
    carId: `demo-car-${i}`,
    lapTime: 8421 + i * 97,
    sessionId: 'demo-race',
    setAt: now - 86400000,
  });
for (const [key, value] of Object.entries({
  navigationAppearance: originalNavigation(),
  autoConnect: false,
  'bestLapVoice:enabled': false,
  'podiumVoice:enabled': false,
  raceSounds: { enabled: false },
  'viewMode:default': 'grid',
}))
  put('Preference', { key, value: JSON.stringify(value), updatedAt: now });
put('Device', {
  id: 'demo-simulator',
  address: 'SIMULATOR',
  name: 'Demo-Simulator',
  type: 'simulator',
  createdAt: now,
  updatedAt: now,
});
db.exec('COMMIT');
db.close();
console.log(filename);
