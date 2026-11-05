import { emptyTrackPlan, validateTrackPlan, traceTrackPlan } from './trackPlan.js';
import { enableFreePlacement, transformFreeParts, editFreeParts, freeTrackSelection } from './freeTrackEditing.js';
import { analyseTrackConnections, trackPorts, compatiblePorts } from './trackConnections.js';
import { editablePitlane } from './pitlaneEditing.js';
import { softyExtraGeometry } from './softyExtraGeometry.js';
import { nativeFuelBayIndices, unitHousingPolygon } from './trackUnitGeometry.js';
import { inventoryComparison, railRequirements } from './railInventory.js';
const degrees = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

export function placeControlUnit(input, index) {
  const plan = validateTrackPlan(input);
  if (plan.pieces[index]?.type !== 'Standardgerade') throw new Error('cuStraight');
  if (plan.pieces.some((p) => p.type === 'Control_unit')) throw new Error('cuExists');
  return validateTrackPlan({
    ...plan,
    pieces: plan.pieces.map((p, i) => (i === index ? { ...p, type: 'Control_unit' } : p)),
  });
}

// Explicit fuel metadata also supports a single bay and multiple independent boxes.
export function createPitAssembly({ bays = 2, includeCU = false } = {}) {
  if (![1, 2].includes(bays)) throw new Error('invalidBays');
  const base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: [
      'Pit_stop_weiche_anfang',
      'Standardgerade',
      includeCU ? 'Control_unit' : 'Standardgerade',
      'Standardgerade',
      'Standardgerade',
      'Pit_stop_weiche_ende',
    ].map((type) => ({ type, level: 0, jointDegrees: 0 })),
    pit: { enabled: true, entry: 0, merge: 5, spacingMm: 345, bayLengthMm: 1035 },
  });
  let plan = editablePitlane(base).plan;
  if (bays === 1) {
    const extras = [];
    const add = (kind, x, y, heading = 0, fuelBay = false, anchor = 0) => {
      const s = traceTrackPlan(plan).segments[anchor].start;
      extras.push({
        kind,
        anchor,
        level: 0,
        paintOrder: extras.length + 1,
        ...(kind === 'single' ? { fuelBay } : {}),
        placement: { xMm: x - s.x, yMm: y - s.y, headingDegrees: heading },
      });
    };
    add('pitEntry', 172.5, 99, 180);
    for (let i = 1; i < 5; i++) add('single', i * 345 + 172.5, 148.5, 0, i === 3);
    add('pitExit', 1897.5, 99, 180, false, 5);
    plan = { ...plan, trackExtras: extras };
  } else {
    const fuel = new Set(nativeFuelBayIndices(plan, traceTrackPlan(plan).segments));
    plan = {
      ...plan,
      trackExtras: plan.trackExtras.map((p, i) => (p.kind === 'single' ? { ...p, fuelBay: fuel.has(i) } : p)),
    };
  }
  return validateTrackPlan({ ...plan, partGroups: { groups: [[0, 1, 2, 3, 4, 5]], released: [] } });
}

export function openTrackPorts(input) {
  return analyseTrackConnections(traceTrackPlan(input).segments).openPorts;
}

export function extractTrackTemplate(input, indices) {
  let plan = enableFreePlacement(input);
  const chosen = [...new Set(indices.flatMap((i) => freeTrackSelection(plan, i)))].sort((a, b) => a - b);
  if (!chosen.length) throw new Error('selectParts');
  if (plan.pit.enabled && !plan.pit.native) plan = editablePitlane(plan).plan;
  const fuel = new Set(nativeFuelBayIndices(plan, traceTrackPlan(plan).segments));
  const map = new Map(chosen.map((n, i) => [n, i]));
  const origin = plan.pieces[chosen[0]].placement;
  const subset = validateTrackPlan({
    ...emptyTrackPlan(),
    freePlacement: true,
    geometryProfile: plan.geometryProfile,
    showAntiCollision: plan.showAntiCollision,
    pieces: chosen.map((i) => plan.pieces[i]),
    partGroups: { groups: chosen.length > 1 ? [chosen.map((_, i) => i)] : [], released: [] },
    trackExtras: (plan.trackExtras || []).flatMap((p, i) => {
      if (!map.has(p.anchor) && !(p.anchor === undefined && chosen.length === plan.pieces.length)) return [];
      return [
        {
          ...p,
          ...(p.kind === 'single' ? { fuelBay: fuel.has(i) } : {}),
          ...(p.anchor !== undefined ? { anchor: map.get(p.anchor) } : {}),
        },
      ];
    }),
  });
  const moved = transformFreeParts(
    subset,
    subset.pieces.map((_, i) => i),
    { dx: -origin.xMm, dy: -origin.yMm }
  );
  return transformFreeParts(
    moved,
    moved.pieces.map((_, i) => i),
    { degrees: -origin.headingDegrees }
  );
}

export function appendTrackTemplate(input, templateInput, port = null, otherSide = false) {
  const plan = enableFreePlacement(input);
  const template = extractTrackTemplate(
    templateInput,
    templateInput.pieces.map((_, i) => i)
  );
  if (plan.pieces.length + template.pieces.length > 2000) throw new Error('tooMany');
  if (port) {
    const actual = openTrackPorts(plan).find((p) => p.index === port.index && p.end === port.end);
    if (!actual) throw new Error('openPort');
    port = actual;
  }
  const all = template.pieces.map((_, i) => i);
  const levelDelta = port ? port.level - template.pieces[0].level : 0;
  if (
    [...template.pieces, ...(template.trackExtras || [])].some(
      (p) => p.level + levelDelta < 0 || p.level + levelDelta > 2
    )
  )
    throw new Error('levelRange');
  let placed = template;
  let x = port?.x ?? 0,
    y = port?.y ?? 0;
  let heading = port ? (port.h * 180) / Math.PI : 0;
  if (otherSide) {
    // Real, unmirrored Carrera modules: attach the far end, reversing box travel.
    const end = traceTrackPlan(template).segments.at(-1).end;
    const h = (heading * Math.PI) / 180;
    x += Math.cos(h) * end.x - Math.sin(h) * end.y;
    y += Math.sin(h) * end.x + Math.cos(h) * end.y;
    heading += 180;
  }
  placed = transformFreeParts(placed, all, { degrees: degrees(heading), dx: x, dy: y });
  const offset = plan.pieces.length;
  return validateTrackPlan({
    ...plan,
    measuredLaneLengthsM: null,
    pieces: [...plan.pieces, ...placed.pieces.map((p) => ({ ...p, level: p.level + levelDelta }))],
    trackExtras: [
      ...(plan.trackExtras || []),
      ...(placed.trackExtras || []).map((p) => ({
        ...p,
        level: p.level + levelDelta,
        ...(p.anchor !== undefined ? { anchor: p.anchor + offset } : {}),
      })),
    ],
    partGroups: {
      groups: [...(plan.partGroups?.groups || []), ...(all.length > 1 ? [all.map((i) => i + offset)] : [])],
      released: plan.partGroups?.released || [],
    },
  });
}

export function replaceWithPitAssembly(input, index, options = {}) {
  const plan = enableFreePlacement(input),
    segments = traceTrackPlan(plan).segments;
  const count = 6;
  const source = segments[index];
  if (!source || index + count > plan.pieces.length) throw new Error('sixStraights');
  if ([plan.pieces[index], plan.pieces[index + count - 1]].some((p) => p.type === 'Control_unit'))
    throw new Error('cuAtPitEnd');
  for (let n = 0; n < count; n++) {
    const s = segments[index + n];
    const x = source.start.x + n * 345 * Math.cos(source.start.h),
      y = source.start.y + n * 345 * Math.sin(source.start.h);
    if (
      !['Standardgerade', 'Control_unit'].includes(s.type) ||
      s.level !== source.level ||
      Math.hypot(s.start.x - x, s.start.y - y) > 0.1 ||
      Math.abs(degrees(((s.start.h - source.start.h) * 180) / Math.PI)) > 0.01
    )
      throw new Error('sixStraights');
    if (
      plan.pieces[index + n].borders ||
      (plan.trackExtras || []).some((e) => e.anchor === index + n) ||
      plan.partGroups?.groups.some((g) => g.includes(index + n))
    )
      throw new Error('protectedParts');
  }
  if (
    plan.pit.enabled &&
    Array.from({ length: count }, (_, n) => index + n).some((i) =>
      freeTrackSelection(plan, i).some((j) => j < index || j >= index + count)
    )
  )
    throw new Error('protectedParts');
  if (plan.pit.enabled && index <= plan.pit.merge && index + count > plan.pit.entry) throw new Error('protectedParts');
  let template = createPitAssembly({ bays: options.bays, includeCU: false });
  let target = { x: source.start.x, y: source.start.y, h: source.start.h, level: source.level };
  const placed = appendTrackTemplate(emptyTrackPlan(), template, null, false);
  let assembly = transformFreeParts(
    placed,
    placed.pieces.map((_, i) => i),
    { degrees: (source.start.h * 180) / Math.PI, dx: target.x, dy: target.y }
  );
  if (options.otherSide) {
    const end = segments[index + count - 1].end;
    assembly = transformFreeParts(
      placed,
      placed.pieces.map((_, i) => i),
      { degrees: degrees((source.start.h * 180) / Math.PI + 180), dx: end.x, dy: end.y }
    );
  }
  // Match original array positions to the physical six modules, even for reverse travel.
  const order = options.otherSide ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
  const inverse = new Map(order.map((old, i) => [old, index + i]));
  const newPieces = order.map((i, n) => {
    const original = plan.pieces[index + n];
    return {
      ...assembly.pieces[i],
      level: source.level,
      ...(original.type === 'Control_unit' ? { type: 'Control_unit' } : {}),
    };
  });
  return validateTrackPlan({
    ...plan,
    measuredLaneLengthsM: null,
    pieces: [...plan.pieces.slice(0, index), ...newPieces, ...plan.pieces.slice(index + count)],
    trackExtras: [
      ...(plan.trackExtras || []),
      ...assembly.trackExtras.map((e) => ({ ...e, level: source.level, anchor: inverse.get(e.anchor) })),
    ],
    partGroups: {
      groups: [...(plan.partGroups?.groups || []), order.map((_, i) => index + i)],
      released: (plan.partGroups?.released || []).filter((i) => i < index || i >= index + count),
    },
  });
}

export function deleteTrackSelection(input, indices) {
  let plan = enableFreePlacement(input);
  const chosen = [...new Set(indices.flatMap((i) => freeTrackSelection(plan, i)))].sort((a, b) => b - a);
  plan = { ...plan, partGroups: { groups: [], released: plan.pieces.map((_, i) => i) } };
  // Existing index remapping removes attached extras with their carrier.
  for (const i of chosen) plan = editFreeParts(plan, i, 'delete').plan;
  // Restore surviving custom groups using a precise old-to-new map.
  const removed = new Set(chosen),
    map = new Map();
  let n = 0;
  input.pieces.forEach((_, i) => {
    if (!removed.has(i)) map.set(i, n++);
  });
  return validateTrackPlan({
    ...plan,
    partGroups: {
      groups: (input.partGroups?.groups || [])
        .map((g) => g.filter((i) => !removed.has(i)).map((i) => map.get(i)))
        .filter((g) => g.length > 1),
      released: (input.partGroups?.released || []).filter((i) => !removed.has(i)).map((i) => map.get(i)),
    },
  });
}

export function deletePitComponent(input, index) {
  const plan = validateTrackPlan(input),
    extra = plan.trackExtras?.[index];
  if (!extra) throw new Error('selectParts');
  if (plan.partGroups?.groups.some((g) => g.includes(extra.anchor))) throw new Error('protectedParts');
  const carrier = plan.pieces[extra.anchor];
  const replaceCarrier =
    carrier?.type.startsWith('Pit_stop_weiche_') &&
    ['pitEntry', 'pitExit'].includes(extra.kind) &&
    Math.abs(extra.placement.xMm - 172.5) < 1 &&
    Math.abs(extra.placement.yMm - 99) < 1;
  return validateTrackPlan({
    ...plan,
    measuredLaneLengthsM: null,
    pieces: plan.pieces.map((p, i) => {
      if (!replaceCarrier || i !== extra.anchor) return p;
      const { antiCollision, ...rest } = p;
      void antiCollision;
      return { ...rest, type: 'Standardgerade' };
    }),
    trackExtras: plan.trackExtras.filter((_, i) => i !== index),
  });
}

export function nearestTrackConnection(input, indices) {
  const ports = trackPorts(traceTrackPlan(input).segments),
    selected = new Set(indices);
  const moving = ports.filter((p) => selected.has(p.index)),
    fixed = ports.filter((p) => !selected.has(p.index));
  const boundary = (p, all) => !all.some((q) => compatiblePorts(p, q));
  let best = null;
  for (const a of moving.filter((p) => boundary(p, moving)))
    for (const b of fixed.filter((p) => boundary(p, fixed))) {
      const distanceMm = Math.hypot(a.x - b.x, a.y - b.y);
      const rotation = degrees(((b.h + Math.PI - a.h) * 180) / Math.PI);
      if (!best || distanceMm < best.distanceMm)
        best = { a, b, distanceMm, rotation, compatible: a.level === b.level && Math.abs(rotation) <= 30 };
    }
  return best;
}

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function inside(p, poly) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j],
      b = poly[i];
    if (
      Math.abs(cross(a, b, p)) < 0.01 &&
      p[0] >= Math.min(a[0], b[0]) - 0.01 &&
      p[0] <= Math.max(a[0], b[0]) + 0.01 &&
      p[1] >= Math.min(a[1], b[1]) - 0.01 &&
      p[1] <= Math.max(a[1], b[1]) + 0.01
    )
      return false;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function overlap(a, b) {
  if (a.some((p) => inside(p, b)) || b.some((p) => inside(p, a))) return true;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const p = a[i],
        q = a[(i + 1) % a.length],
        r = b[j],
        s = b[(j + 1) % b.length];
      if (cross(p, q, r) * cross(p, q, s) < -0.01 && cross(r, s, p) * cross(r, s, q) < -0.01) return true;
    }
  const midpoints = (poly) =>
    poly.map((p, i) => [(p[0] + poly[(i + 1) % poly.length][0]) / 2, (p[1] + poly[(i + 1) % poly.length][1]) / 2]);
  if (midpoints(a).some((p) => inside(p, b)) || midpoints(b).some((p) => inside(p, a))) return true;
  // Identical or aligned rectangles can overlap without strict edge crossings.
  const center = (poly) => [
    poly.reduce((v, p) => v + p[0], 0) / poly.length,
    poly.reduce((v, p) => v + p[1], 0) / poly.length,
  ];
  return (inside(center(a), a) && inside(center(a), b)) || (inside(center(b), b) && inside(center(b), a));
}
function auxiliaryOpenPorts(plan, segments) {
  const all = segments.flatMap((s) =>
    [1, 2].flatMap((lane) =>
      [s.points[lane][0], s.points[lane].at(-1)].map(([x, y]) => ({ id: `rail-${s.index}`, x, y, level: s.level }))
    )
  );
  const auxiliary = [];
  for (const [extraIndex, e] of (plan.trackExtras || []).entries()) {
    if (e.hidden) continue;
    const geometry = softyExtraGeometry(e, segments);
    if (geometry.border) continue;
    const points = [];
    for (const path of geometry.slots)
      for (const p of [path[0], path.at(-1)])
        if (!points.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01)) points.push(p);
    for (const [x, y] of points)
      auxiliary.push({
        id: `extra-${extraIndex}`,
        extraIndex,
        index: e.anchor,
        x,
        y,
        level: segments[e.anchor]?.level ?? e.level,
      });
  }
  all.push(...auxiliary);
  const bins = new Map(),
    key = (x, y, level) => `${x},${y},${level}`;
  for (const p of all) {
    const k = key(Math.floor(p.x), Math.floor(p.y), p.level);
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(p);
  }
  return auxiliary.filter((p) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (
          (bins.get(key(Math.floor(p.x) + dx, Math.floor(p.y) + dy, p.level)) || []).some(
            (q) => q.id !== p.id && Math.hypot(p.x - q.x, p.y - q.y) <= 1
          )
        )
          return false;
    return true;
  });
}

export function inspectTrackBuild(input, stock = null) {
  const clean = validateTrackPlan(input);
  const plan = clean.pit.enabled && !clean.pit.native ? editablePitlane(clean).plan : clean;
  const segments = traceTrackPlan(plan).segments;
  const shapes = [];
  for (const s of segments) {
    const poly = s.roadOutline || [
      ...s.points[0].map((p, i) => [p[0] + 2 * (s.points[1][i][0] - p[0]), p[1] + 2 * (s.points[1][i][1] - p[1])]),
      ...s.points[0]
        .map((p, i) => [p[0] + 2 * (s.points[2][i][0] - p[0]), p[1] + 2 * (s.points[2][i][1] - p[1])])
        .reverse(),
    ];
    shapes.push({ id: `rail-${s.index}`, index: s.index, level: s.level, poly });
    const housing = unitHousingPolygon(s);
    if (housing.length) shapes.push({ id: `unit-${s.index}`, index: s.index, level: s.level, poly: housing });
  }
  for (const [i, e] of (plan.trackExtras || []).entries()) {
    if (e.hidden) continue;
    const g = softyExtraGeometry(e, segments);
    if (g.border) continue;
    shapes.push({ id: `extra-${i}`, index: e.anchor, extraIndex: i, level: e.level, poly: g.polygon });
  }
  for (const a of shapes) {
    const xs = a.poly.map((p) => p[0]),
      ys = a.poly.map((p) => p[1]);
    a.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  shapes.sort((a, b) => a.box[0] - b.box[0]);
  const conflicts = [];
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length && shapes[j].box[0] < shapes[i].box[2] - 0.01; j++) {
      const a = shapes[i],
        b = shapes[j];
      if (
        a.level !== b.level ||
        (Number.isInteger(a.index) &&
          a.index === b.index &&
          (a.extraIndex === undefined || b.extraIndex === undefined)) ||
        a.box[3] <= b.box[1] + 0.01 ||
        b.box[3] <= a.box[1] + 0.01
      )
        continue;
      if (overlap(a.poly, b.poly))
        conflicts.push({ a: a.id, b: b.id, indices: [...new Set([a.index, b.index].filter(Number.isInteger))] });
    }
  const connectivity = analyseTrackConnections(segments);
  const comparison = stock ? inventoryComparison(plan, stock) : null;
  return {
    ...connectivity,
    auxiliaryPorts: auxiliaryOpenPorts(plan, segments),
    conflicts,
    missing: comparison?.rows.filter((r) => r.remaining < 0) ?? null,
    unresolved: comparison?.unresolved ?? railRequirements(plan).unresolved,
  };
}
