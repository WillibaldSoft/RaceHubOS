import { EXTRA_TRACK_PARTS } from './carreraTrackCatalog.js';
import { validateTrackPlan, traceTrackPlan, TRACK_PARTS } from './trackPlan.js';
// GUIDs and native shapes read from Softyroyal's visible Carrera catalogue,
// format verified against a user-exported SBP v1 reference (2026-10-23).
import { SOFTY_GUIDS as G } from './softyNativeCatalog.js';
import { extraWorldPose } from './softyExtraGeometry.js';
const deg = (r) => (r * 180) / Math.PI;
export function exportSoftyRoyal(input, name = 'Streckenplan') {
  const plan = validateTrackPlan(input);
  if (!plan.pieces.length) throw new Error('Empty plan');
  if (plan.pieces.some((p) => Object.hasOwn(EXTRA_TRACK_PARTS, p.type)))
    throw new Error('New catalogue geometry requires RaceHubOS JSON export; native SBP mapping not verified.');
  // Softyroyal uses native R297/495/693/891 and a86.25mm quarter.
  const traced = traceTrackPlan({ ...plan, geometryProfile: 'prototype' });
  const items = [],
    notices = new Set();
  const add = (guid, x, y, rotation, level = 0, order = 12000) =>
    items.push({
      guid,
      position: { x: x + 5000, y: y + 5000 },
      rotation: ((rotation % 360) + 360) % 360,
      _level: level,
      _order: order,
    });
  if (plan.geometryProfile !== 'prototype')
    notices.add(
      'Softyroyal-native radii297/495/693/891mm and quarter86.25mm used; export geometry may differ from the original-planner profile.'
    );
  let pitFrame = null;
  if (plan.pit.enabled && !plan.pit.native) {
    const { entry, merge, spacingMm, bayLengthMm } = plan.pit;
    const a = traced.segments[entry],
      b = traced.segments[merge];
    if (
      a.type !== 'Pit_stop_weiche_anfang' ||
      b.type !== 'Pit_stop_weiche_ende' ||
      spacingMm % 345 !== 0 ||
      bayLengthMm % 345 !== 0 ||
      bayLengthMm < 1035
    )
      throw new Error('Pit requires native345mm parts and entry/exit switches');
    const dx = b.end.x - a.start.x,
      dy = b.end.y - a.start.y,
      h = a.start.h;
    const extent = dx * Math.cos(h) + dy * Math.sin(h),
      cross = -dx * Math.sin(h) + dy * Math.cos(h);
    if (
      Math.abs(cross) > 0.01 ||
      Math.abs(Math.sin(b.end.h - h)) > 1e-6 ||
      Math.abs(extent - (345 + spacingMm + bayLengthMm + 345)) > 0.01
    )
      throw new Error('Pit connections do not fit a straight native rail sequence');
    pitFrame = { h, extent, split: 345 + spacingMm, end: 345 + spacingMm + bayLengthMm, origin: a.start };
  }
  for (const s of traced.segments) {
    const spec = TRACK_PARTS[s.type],
      h = s.start.h,
      level = s.level;
    if (
      (pitFrame || plan.pit.native) &&
      s.type.startsWith('Pit_stop_') &&
      [plan.pit.entry, plan.pit.merge].includes(s.index)
    )
      continue;
    if (spec.radius) {
      const angle = spec.angle,
        right = angle > 0,
        radius = spec.radius - 2;
      const match = /^Kurve_(\d)_(\d+)_/.exec(s.type);
      const guid =
        s.type === 'Kurvenweiche_rechts_ai_2' ? G.curved2 : G[match[1] === '1' ? `k1${match[2]}` : `k${match[1]}`];
      add(
        guid,
        s.start.x - (right ? 1 : -1) * Math.sin(h) * radius,
        s.start.y + (right ? 1 : -1) * Math.cos(h) * radius,
        deg(h) + (right ? angle / 2 : 180 + angle / 2),
        level,
        s.paintOrder
      );
    } else {
      const length = s.type === 'Viertelgerade' ? 86.25 : spec.length;
      const guid =
        {
          Drittelgerade: G.third,
          Viertelgerade: G.quarter,
          Control_unit: G.cu,
          DigitaleDoppelweiche_1: G.double1,
          DigitaleDoppelweiche_2: G.double2,
          Kurvenweiche_rechts_ai_1: G.curved1,
        }[s.type] || G.straight;
      if (['AdapterUnit', 'Check_lane', 'Startampel_3spur_hinten'].includes(s.type))
        notices.add(`${s.type}: native345mm standard straight as geometric replacement; accessory not represented.`);
      if (s.type.startsWith('Pit_stop') && !pitFrame) throw new Error('Pit switches require a configured pit lane');
      add(
        guid,
        s.start.x + (Math.cos(h) * length) / 2,
        s.start.y + (Math.sin(h) * length) / 2,
        deg(h) + (s.type === 'Control_unit' ? 180 : 0),
        level,
        s.paintOrder
      );
    }
  }
  if (pitFrame) {
    const { h, extent, split, end, origin } = pitFrame;
    const place = (guid, u, v, reverse = false) =>
      add(
        guid,
        origin.x + Math.cos(h) * u - Math.sin(h) * v,
        origin.y + Math.sin(h) * u + Math.cos(h) * v,
        deg(h) + (reverse ? 180 : 0)
      );
    place(G.pitEntry, 172.5, 99, true);
    place(G.single, 172.5, -49.5);
    for (let u = 517.5; u < split; u += 345) place(G.single, u, 148.5);
    place(G.pitEntry, split + 172.5, 198, true);
    for (let u = split + 517.5; u < end - 345; u += 345) {
      place(G.single, u, 148.5);
      place(G.single, u, 247.5);
    }
    place(G.pitExit, end - 172.5, 198, true);
    place(G.pitExit, extent - 172.5, 99, true);
    place(G.single, extent - 172.5, -49.5);
  }
  for (const extra of plan.trackExtras || []) {
    const p = extraWorldPose(extra, traced.segments);
    add(
      G[extra.kind],
      p.xMm,
      p.yMm,
      p.headingDegrees,
      extra.anchor === undefined ? extra.level : (traced.segments[extra.anchor]?.level ?? extra.level),
      extra.paintOrder
    );
  }
  for (const s of traced.segments)
    for (const side of ['left', 'right'])
      if (s.borders?.[side]) {
        const spec = TRACK_PARTS[s.type],
          h = s.start.h,
          n = side === 'left' ? -1 : 1,
          config = s.borders[side];
        if (spec.radius) {
          const sign = Math.sign(spec.angle),
            r = spec.radius - 2,
            match = /^Kurve_(\d)_(\d+)_/.exec(s.type),
            key = match ? `${match[1]}${match[2]}` : '160',
            outside = n !== sign;
          add(
            G[`border${outside ? 'Outer' : 'Inner'}${key}`],
            s.start.x - sign * Math.sin(h) * r,
            s.start.y + sign * Math.cos(h) * r,
            deg(h) + (sign > 0 ? spec.angle / 2 : 180 + spec.angle / 2),
            s.level,
            s.paintOrder
          );
        } else {
          const len = s.type === 'Viertelgerade' ? 86.25 : spec.length,
            guid =
              G[
                s.type === 'Drittelgerade'
                  ? 'borderThird'
                  : s.type === 'Viertelgerade'
                    ? 'borderQuarter'
                    : 'borderStandard'
              ];
          add(
            guid,
            s.start.x + (Math.cos(h) * len) / 2 - Math.sin(h) * n * 148.5,
            s.start.y + (Math.sin(h) * len) / 2 + Math.cos(h) * n * 148.5,
            deg(h),
            s.level,
            s.paintOrder
          );
        }
        for (const [key, p, isEnd] of [
          ['startCap', s.start, false],
          ['endCap', s.end, true],
        ])
          if (config[key])
            add(
              G[(side === 'left') === isEnd ? 'borderEndRight' : 'borderEndLeft'],
              p.x - Math.sin(p.h) * n * 99,
              p.y + Math.cos(p.h) * n * 99,
              deg(p.h) + (side === 'right' ? 180 : 0),
              s.level,
              s.paintOrder
            );
      }
  // SVG/plan paint order represents the photo-confirmed overpass. SBP v1
  // reference exposes no surveyed height, so no invented ramp heights are added.
  items.sort((a, b) => (plan.softyImport?.paintOrder ? a._order - b._order : a._level - b._level));
  const plain = items.map(({ _level, _order, ...item }) => item);
  const xs = items.map((i) => i.position.x),
    ys = items.map((i) => i.position.y);
  const xmin = Math.min(...xs) - 1000,
    xmax = Math.max(...xs) + 1000,
    ymin = Math.min(...ys) - 1000,
    ymax = Math.max(...ys) + 1000;
  return {
    file: {
      file: 'sbp',
      version: 1,
      preview: '',
      racehubos: { version: 1, plan },
      name: name.trim() || 'Streckenplan',
      'last-change': new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
      items: plain,
      floor: [
        { x: xmin, y: ymin },
        { x: xmax, y: ymin },
        { x: xmax, y: ymax },
        { x: xmin, y: ymax },
      ],
      systems: [{ guid: '4af99ff1-11cd-4969-bb2d-d6ddb5f1c8aa', names: { de: 'Carrera Evolution' } }],
      size: { width: xmax - xmin, height: ymax - ymin },
    },
    notices: [...notices],
    mainLaneLengthsM: traced.laneLengthsM,
  };
}

// A checked round trip for files made by RaceHubOS. A general importer for
// arbitrary external Softy plans needs connection/layer inference separately.
export function importSoftyRoyalExport(value) {
  if (!value || value.file !== 'sbp' || value.version !== 1 || value.racehubos?.version !== 1)
    throw new Error('SBP requires RaceHubOS export metadata');
  const plan = validateTrackPlan(value.racehubos.plan);
  const expected = exportSoftyRoyal(plan).file.items;
  if (!Array.isArray(value.items) || value.items.length !== expected.length) throw new Error('SBP rails changed');
  expected.forEach((part, i) => {
    const other = value.items[i];
    if (
      !other ||
      part.guid !== other.guid ||
      !Number.isFinite(other.rotation) ||
      !Number.isFinite(other.position?.x) ||
      !Number.isFinite(other.position?.y) ||
      Math.abs(part.rotation - other.rotation) > 1e-6 ||
      Math.abs(part.position.x - other.position.x) > 1e-6 ||
      Math.abs(part.position.y - other.position.y) > 1e-6
    )
      throw new Error('SBP rails changed');
  });
  return plan;
}
