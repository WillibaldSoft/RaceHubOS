import { validateRailInventory } from './railInventory.js';
export const DEFAULT_ROOM = Object.freeze({
  curveStyle: 'dynamic',
  widthM: 6,
  depthM: 5,
  drivers: 4,
  driverWidthM: 0.8,
  driverDepthM: 0.8,
  aisleM: 0.8,
  edgeM: 0.15,
  maxLevels: 1,
  levelHeightMm: 150,
  maxGradePercent: 15,
});
export function validateRoom(room) {
  const r = { ...DEFAULT_ROOM, ...room };
  const ranges = {
    widthM: [1, 30],
    depthM: [1, 30],
    drivers: [1, 6],
    driverWidthM: [0.4, 2],
    driverDepthM: [0.4, 3],
    aisleM: [0.4, 3],
    edgeM: [0.1, 2],
    maxLevels: [1, 3],
    levelHeightMm: [100, 500],
    maxGradePercent: [1, 25],
  };
  for (const [key, [min, max]] of Object.entries(ranges))
    if (!Number.isFinite(r[key]) || r[key] < min || r[key] > max) throw new Error('Invalid room');
  if (!Number.isInteger(r.drivers) || !Number.isInteger(r.maxLevels)) throw new Error('Invalid room');
  const result = Object.fromEntries(Object.keys(ranges).map((k) => [k, r[k]]));
  if (r.reference) {
    const ref = r.reference;
    if (
      typeof ref.name !== 'string' ||
      ref.name.length > 200 ||
      ![ref.widthM, ref.depthM].every((n) => Number.isFinite(n) && n > 0 && n <= 1000)
    )
      throw new Error('Invalid reference');
    result.reference = { name: ref.name, widthM: ref.widthM, depthM: ref.depthM };
  }
  if (r.allowAdditionalParts !== undefined) {
    if (typeof r.allowAdditionalParts !== 'boolean') throw new Error('Invalid parts mode');
    result.allowAdditionalParts = r.allowAdditionalParts;
  }
  if (r.curveStyle !== undefined) {
    if (!['dynamic', 'balanced', 'flowing', 'technical'].includes(r.curveStyle)) throw new Error('Invalid curve style');
    result.curveStyle = r.curveStyle;
  }
  if (r.borderMode !== undefined) {
    if (!['none', 'outside', 'both'].includes(r.borderMode)) throw new Error('Invalid shoulder mode');
    result.borderMode = r.borderMode;
  }
  if (r.inventory) result.inventory = validateRailInventory(r.inventory);
  if (r.detailedSearch) {
    const s = r.detailedSearch;
    if (
      typeof s.enabled !== 'boolean' ||
      !Number.isInteger(s.attempts) ||
      s.attempts < 100 ||
      s.attempts > 5000 ||
      !Number.isInteger(s.seed) ||
      s.seed < 1 ||
      s.seed > 4294967295 ||
      !Number.isFinite(s.jointDegrees) ||
      s.jointDegrees < 0 ||
      s.jointDegrees > 1
    )
      throw new Error('Invalid search configuration');
    result.detailedSearch = { enabled: s.enabled, attempts: s.attempts, seed: s.seed, jointDegrees: s.jointDegrees };
  }
  return result;
}

export function roomTrackArea(room) {
  return {
    width: Math.min((room.widthM - 2 * room.edgeM) * 1000, (room.reference?.widthM ?? Infinity) * 1000),
    depth: Math.min(
      (room.depthM - 2 * room.edgeM - room.driverDepthM - room.aisleM) * 1000,
      (room.reference?.depthM ?? Infinity) * 1000
    ),
  };
}
