import {
  CARRERA_MANUFACTURER_ARTICLES,
  EXTRA_TRACK_ASSEMBLIES,
  EXTRA_ASSEMBLY_ARTICLES,
  trackArticle,
} from './carreraTrackCatalog.js';
import { traceTrackPlan } from './trackPlan.js';
import { nativeFuelBayIndices } from './trackUnitGeometry.js';
import { SOFTY_EXTRAS } from './softyNativeCatalog.js';
import { CARRERA_BORDERS, borderArticle } from './trackBorders.js';
// Article identities checked against Carrera's own published track parts lists.
// Quantities are individual rails, except complete switch assemblies as labelled.
export const RAIL_INVENTORY_KEY = 'carreraRailInventory';
const modelledRails = [
  ['30373', 'chicane'],
  ['30350', 'narrowLeft'],
  ['30351', 'narrowRight'],
  ['20509', 'standard'],
  ['20611', 'third'],
  ['20612', 'quarter'],
  ['20577', 'k130'],
  ['20571', 'k160'],
  ['20572', 'k230'],
  ['20573', 'k330'],
  ['20578', 'k415'],
  ['20574', 'bank1'],
  ['20575', 'bank2'],
  ['20576', 'bank3'],
  ['20579', 'bank4'],
  ['30343', 'leftSwitch'],
  ['30345', 'rightSwitch'],
  ['30362', 'curvedLeftInOut'],
  ['30363', 'curvedLeftOutIn'],
  ['30364', 'curvedRightInOut'],
  ['30370', 'multistart'],
  ['30371', 'check'],
  ['30354', 'startlight'],
  ['30361', 'fuel'],
  ['30352', 'cu'],
  ['30347', 'double'],
  ['30365', 'curved'],
  ['30356', 'pit'],
  ['30341', 'single'],
  ['30360', 'adapter'],
]
  .map(([article, label]) => ({ article, label, ...(article === '20509' ? { aliases: ['20601'] } : {}) }))
  .concat(CARRERA_BORDERS);
export const CARRERA_RAILS = Object.freeze([
  ...modelledRails,
  ...CARRERA_MANUFACTURER_ARTICLES.filter(
    (p) => !modelledRails.some((r) => r.article === p.article || (r.aliases || []).includes(p.article))
  ).map((p) => ({ article: p.article, label: `article${p.article}`, name: p.name })),
]);
export function emptyRailInventory() {
  return { version: 1, counts: Object.fromEntries(CARRERA_RAILS.map((p) => [p.article, 0])) };
}
export function validateRailInventory(value) {
  if (!value || value.version !== 1 || !value.counts || typeof value.counts !== 'object' || Array.isArray(value.counts))
    throw new Error('Invalid rail inventory');
  const result = emptyRailInventory();
  for (const [id, count] of Object.entries(value.counts)) {
    if (!Object.hasOwn(result.counts, id) || !Number.isInteger(count) || count < 0 || count > 2000)
      throw new Error('Invalid rail count');
    result.counts[id] = count;
  }
  return result;
}
export function railRequirements(plan) {
  const counts = emptyRailInventory().counts,
    unresolved = [];
  // The legacy Startampel name is a 345mm rail placeholder in these plans,
  // not evidence of an installed Startlight (user confirmed it was removed).
  const direct = {
    Standardgerade: '20509',
    Drittelgerade: '20611',
    Viertelgerade: '20612',
    Control_unit: '30352',
    AdapterUnit: '30360',
    Startampel_3spur_hinten: '20509',
  };
  for (let i = 0; i < plan.pieces.length; i++) {
    const type = plan.pieces[i].type,
      next = plan.pieces[i + 1]?.type;
    const assembly = Object.entries(EXTRA_TRACK_ASSEMBLIES).find(
      ([, types]) => types[0] === type && types.every((t, j) => plan.pieces[i + j]?.type === t)
    );
    if (assembly) {
      counts[EXTRA_ASSEMBLY_ARTICLES[assembly[0]]]++;
      i += assembly[1].length - 1;
      continue;
    }
    if (
      ['Schikane_30373', 'Engstelle_links_30350', 'Engstelle_rechts_30351'].includes(type) ||
      type.startsWith('Steilkurve_') ||
      ['Multistart', 'Check_lane'].includes(type)
    ) {
      counts[trackArticle(type)]++;
      continue;
    }
    if (direct[type]) {
      counts[direct[type]]++;
      continue;
    }
    const match = /^Kurve_(\d)_(\d+)_(links|rechts)$/.exec(type);
    if (match) {
      const id = { '1_30': '20577', '1_60': '20571', '2_30': '20572', '3_30': '20573', '4_15': '20578' }[
        `${match[1]}_${match[2]}`
      ];
      if (id) {
        counts[id]++;
        continue;
      }
    }
    if (type === 'DigitaleDoppelweiche_1' && next === 'DigitaleDoppelweiche_2') {
      counts['30347']++;
      i++;
      continue;
    }
    if (type === 'Kurvenweiche_rechts_ai_1' && next === 'Kurvenweiche_rechts_ai_2') {
      counts['30365']++;
      i++;
      continue;
    }
    if (plan.pit.enabled && [plan.pit.entry, plan.pit.merge].includes(i) && type.startsWith('Pit_stop_weiche_'))
      continue;
    unresolved.push(`${i + 1}: ${type}`);
  }
  for (const p of plan.pieces)
    for (const side of ['left', 'right'])
      if (p.borders?.[side]) {
        counts[borderArticle(p.type, side)]++;
        counts['20598'] += Number(!!p.borders[side].startCap) + Number(!!p.borders[side].endCap);
      }
  if (plan.pit.enabled && !plan.pit.native) {
    const p = plan.pit;
    if (
      plan.pieces[p.entry]?.type === 'Pit_stop_weiche_anfang' &&
      plan.pieces[p.merge]?.type === 'Pit_stop_weiche_ende' &&
      p.spacingMm % 345 === 0 &&
      p.bayLengthMm % 345 === 0 &&
      p.bayLengthMm >= 1035
    ) {
      counts['30356'] += 2; // Two entry/exit sets: shared route and parallel branch.
      // The schematic double-box plan draws exactly one FUEL unit per bay.
      // Replace two of its single-lane modules, do not add extra rail length.
      counts['30341'] += p.spacingMm / 345 + 2 * (p.bayLengthMm / 345 - 2);
      counts['30361'] += 2;
    } else unresolved.push('Pitlane');
  }
  // Use the same FUEL positions as the native double-box drawing.
  const fuelIndices = new Set(
    plan.pit.native && plan.pit.enabled ? nativeFuelBayIndices(plan, traceTrackPlan(plan).segments) : []
  );
  let entries = 0,
    exits = 0;
  for (const [index, e] of (plan.trackExtras || []).entries()) {
    if (e.hidden) continue;
    if (e.kind === 'pitEntry') entries++;
    else if (e.kind === 'pitExit') exits++;
    else counts[fuelIndices.has(index) ? '30361' : SOFTY_EXTRAS[e.kind].article]++;
  }
  counts['30356'] += Math.max(entries, exits);
  if (entries !== exits) unresolved.push('Pitlane: unmatched native entry/exit');
  return { counts, unresolved };
}
export function inventoryComparison(plan, inventory) {
  const stock = validateRailInventory(inventory).counts,
    required = railRequirements(plan);
  const quantitiesFit = CARRERA_RAILS.every((p) => required.counts[p.article] <= stock[p.article]);
  return {
    quantitiesFit,
    rows: CARRERA_RAILS.map((p) => ({
      ...p,
      required: required.counts[p.article],
      available: stock[p.article],
      remaining: stock[p.article] - required.counts[p.article],
    })),
    unresolved: required.unresolved,
    fits: !required.unresolved.length && quantitiesFit,
  };
}
// Equivalent catalogue substitutions only. Direction is irrelevant to ordinary
// curve stock; CU and switches remain distinct physical assemblies.
export function fitPlanToInventory(plan, inventory) {
  if (plan.pit.enabled) return null;
  if (plan.partGroups || plan.pieces.some((p) => p.borders))
    return inventoryComparison(plan, inventory).fits ? plan : null;
  const stock = validateRailInventory(inventory).counts;
  let sixty = stock['20571'];
  const pieces = [];
  for (let i = 0; i < plan.pieces.length;) {
    const p = plan.pieces[i];
    if (/^Kurve_1_30_/.test(p.type)) {
      let j = i + 1;
      while (
        j < plan.pieces.length &&
        plan.pieces[j].type === p.type &&
        plan.pieces[j].level === p.level &&
        !plan.pieces[j].jointDegrees
      )
        j++;
      let count = j - i,
        first = true;
      while (count) {
        const use60 = count >= 2 && sixty > 0;
        pieces.push({
          ...p,
          type: use60 ? p.type.replace('_30_', '_60_') : p.type,
          jointDegrees: first ? p.jointDegrees : 0,
        });
        if (use60) sixty--;
        count -= use60 ? 2 : 1;
        first = false;
      }
      i = j;
    } else {
      pieces.push({ ...p });
      i++;
    }
  }
  let candidate = { ...plan, pieces };
  const required = railRequirements(candidate);
  if (required.unresolved.length) return null;
  for (const id of Object.keys(stock)) if (id !== '20509' && required.counts[id] > stock[id]) return null;
  let missing = Math.max(0, required.counts['20509'] - stock['20509']);
  let doubles = stock['30347'] - required.counts['30347'],
    thirds = stock['20611'] - required.counts['20611'],
    quarters = stock['20612'] - required.counts['20612'];
  const fitted = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i],
      next = pieces[i + 1];
    if (p.type !== 'Standardgerade' || !missing) {
      fitted.push(p);
      continue;
    }
    if (doubles && next?.type === 'Standardgerade' && next.level === p.level && !next.jointDegrees) {
      fitted.push({ ...p, type: 'DigitaleDoppelweiche_1' }, { ...next, type: 'DigitaleDoppelweiche_2' });
      doubles--;
      missing = Math.max(0, missing - 2);
      i++;
    } else if (thirds >= 3 || (plan.geometryProfile === 'prototype' && quarters >= 4)) {
      const useThird = thirds >= 3,
        n = useThird ? 3 : 4;
      for (let j = 0; j < n; j++)
        fitted.push({ ...p, type: useThird ? 'Drittelgerade' : 'Viertelgerade', jointDegrees: j ? 0 : p.jointDegrees });
      if (useThird) thirds -= 3;
      else quarters -= 4;
      missing--;
    } else fitted.push(p);
  }
  candidate = { ...plan, pieces: fitted };
  return inventoryComparison(candidate, inventory).fits ? candidate : null;
}
