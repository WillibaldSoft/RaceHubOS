import { emptyTrackPlan, validateTrackPlan, traceTrackPlan, TRACK_PARTS } from './trackPlan.js';
import { SOFTY_GUIDS, SOFTY_ROADS, SOFTY_EXTRAS, SOFTY_ALIASES } from './softyNativeCatalog.js';
import { importSoftyRoyalExport } from './softyRoyal.js';
const rad = (d) => (d * Math.PI) / 180,
  deg = (r) => (r * 180) / Math.PI;
const norm = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = (p, x, y) => ({
  x: p.x + Math.cos(p.h) * x - Math.sin(p.h) * y,
  y: p.y + Math.sin(p.h) * x + Math.cos(p.h) * y,
});
const axis = (a, b) => Math.abs(norm(a - b)) < 1 || Math.abs(Math.abs(norm(a - b)) - 180) < 1;
const keys = new Map(Object.entries(SOFTY_GUIDS).map(([k, v]) => [v, k]));
// SBP positions and rotations are the source of truth. Never execute embedded
// SVG/preview content or trust stale RaceHubOS metadata after a Softy edit.
export function importSoftyRoyal(value) {
  try {
    return importSoftyRoyalExport(value);
  } catch {
    /* native reconstruction below */
  }
  if (
    !value ||
    value.file !== 'sbp' ||
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    !value.items.length ||
    value.items.length > 5000
  )
    throw new Error('Invalid SBP v1');
  const unknown = new Set();
  const native = value.items.map((i, index) => {
    if (
      !i ||
      typeof i.guid !== 'string' ||
      ![i.rotation, i.position?.x, i.position?.y].every(Number.isFinite) ||
      Math.abs(i.position.x) > 1e6 ||
      Math.abs(i.position.y) > 1e6 ||
      Math.abs(i.rotation) > 1e6
    )
      throw new Error('Invalid SBP placement');
    const kind = keys.get(i.guid) || (Object.hasOwn(SOFTY_ALIASES, i.guid) ? SOFTY_ALIASES[i.guid] : undefined);
    if (!kind) unknown.add(i.guid.slice(0, 80));
    return { kind, index, x: i.position.x, y: i.position.y, h: rad(norm(i.rotation)), rotation: norm(i.rotation) };
  });
  if (unknown.size) throw new Error(`Unsupported SBP parts: ${[...unknown].slice(0, 8).join(', ')}`);
  const pieces = [],
    extras = [],
    paired = new Set(),
    roots = [];
  const addRoad = (type, item, center = item, h = item.h) => {
    const spec = TRACK_PARTS[type],
      r = spec.radius ? spec.radius - 2 : 0,
      l = type === 'Viertelgerade' ? 86.25 : spec.length;
    const start = r
      ? { x: center.x + r * Math.sin(h), y: center.y - r * Math.cos(h) }
      : point({ ...center, h }, -l / 2, 0);
    pieces.push({
      type,
      level: 0,
      jointDegrees: 0,
      paintOrder: item.index * 2,
      placement: { xMm: start.x, yMm: start.y, headingDegrees: norm(deg(h)) },
    });
    return pieces.length - 1;
  };
  // A native pit turnout occupies one-and-a-half lanes. The adjacent single
  // identifies its main-course position; inner double-box turnouts have no mate.
  for (const item of native.filter((i) => i.kind === 'pitEntry' || i.kind === 'pitExit')) {
    const expected = point(item, 0, 148.5),
      mate = native.find(
        (i) =>
          i.kind === 'single' && !paired.has(i.index) && distance(i, expected) < 2 && axis(i.rotation, item.rotation)
      );
    if (!mate) continue;
    paired.add(mate.index);
    const anchor = addRoad(
      item.kind === 'pitEntry' ? 'Pit_stop_weiche_anfang' : 'Pit_stop_weiche_ende',
      item,
      point(item, 0, 99),
      item.h + Math.PI
    );
    roots.push({ item, mate, anchor });
  }
  for (const item of native) {
    if (SOFTY_ROADS[item.kind]) {
      const type = SOFTY_ROADS[item.kind],
        spec = TRACK_PARTS[type];
      addRoad(type, item, item, item.h - (spec.angle ? rad(spec.angle) / 2 : 0) - (item.kind === 'cu' ? Math.PI : 0));
    } else if (SOFTY_EXTRAS[item.kind])
      extras.push({
        kind: item.kind,
        level: 0,
        paintOrder: item.index * 2 + 1,
        placement: { xMm: item.x, yMm: item.y, headingDegrees: item.rotation },
        ...(paired.has(item.index) ? { hidden: true } : {}),
        _source: item,
      });
  }
  if (!pieces.length || pieces.length > 2000 || extras.length > 3000)
    throw new Error('SBP contains no supported main course or too many parts');
  let plan = { ...emptyTrackPlan(), geometryProfile: 'prototype', freePlacement: true, pieces, trackExtras: extras };
  let segments = traceTrackPlan(plan).segments;
  // Order rails by physical connections, not SBP painting order. Orientation is
  // kept native; connection analysis handles reverse traversal and lane swaps.
  const ports = segments.flatMap((s) => [
    { ...s.start, index: s.index, end: 0 },
    { ...s.end, index: s.index, end: 1 },
  ]);
  const neighbours = new Map();
  for (let i = 0; i < ports.length; i++) {
    const a = ports[i],
      matches = ports.filter((b) => b.index !== a.index && distance(a, b) < 2 && axis(deg(a.h), deg(b.h)));
    if (matches.length === 1) neighbours.set(`${a.index}:${a.end}`, matches[0]);
  }
  const order = [],
    seen = new Set();
  let current =
    roots.find((r) => r.item.kind === 'pitEntry')?.anchor ?? pieces.findIndex((p) => p.type === 'Control_unit');
  if (current < 0) current = 0;
  let enter = 0;
  while (!seen.has(current)) {
    seen.add(current);
    order.push(current);
    const next = neighbours.get(`${current}:${1 - enter}`);
    if (!next) break;
    current = next.index;
    enter = next.end;
  }
  for (let i = 0; i < pieces.length; i++) if (!seen.has(i)) order.push(i);
  const remap = new Map(order.map((old, i) => [old, i]));
  plan.pieces = order.map((i) => pieces[i]);
  segments = traceTrackPlan(plan).segments;
  // Native drawing order specifies which rail covers the other at a crossing.
  // Levels here are inferred display layers, never surveyed bridge heights.
  let crossings = 0,
    intersectionChecks = 0;
  const cross = (a, b, c, d) => {
    const v = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return v(a, b, c) * v(a, b, d) < -1e-5 && v(c, d, a) * v(c, d, b) < -1e-5;
  };
  const boxes = segments.map((s) => [
    Math.min(...s.points[0].map((p) => p[0])),
    Math.min(...s.points[0].map((p) => p[1])),
    Math.max(...s.points[0].map((p) => p[0])),
    Math.max(...s.points[0].map((p) => p[1])),
  ]);
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i],
        b = segments[j],
        x = boxes[i],
        y = boxes[j];
      if (
        x[0] > y[2] ||
        y[0] > x[2] ||
        x[1] > y[3] ||
        y[1] > x[3] ||
        [a.start, a.end].some((p) => [b.start, b.end].some((q) => distance(p, q) < 2))
      )
        continue;
      let intersects = false;
      for (let k = 1; k < 33 && !intersects; k++)
        for (let l = 1; l < 33; l++)
          if (++intersectionChecks > 5000000) throw new Error('SBP crossing analysis limit');
          else if (cross(a.points[0][k - 1], a.points[0][k], b.points[0][l - 1], b.points[0][l])) {
            intersects = true;
            break;
          }
      if (intersects) {
        crossings++;
        plan.pieces[a.paintOrder > b.paintOrder ? i : j].level = 1;
      }
    }
  // Build the single-lane branch graph and count actual routes from shared
  // entry to shared exit. Four isolated turnouts do not establish a double box.
  const aux = native.filter((i) => ['single', 'pitEntry', 'pitExit'].includes(i.kind) && !paired.has(i.index));
  const auxPorts = aux.map((i) =>
    i.kind === 'single'
      ? [
          [-172.5, 0],
          [172.5, 0],
        ]
      : i.kind === 'pitEntry'
        ? [
            [172.5, 49.5],
            [-172.5, 49.5],
            [-172.5, -49.5],
          ]
        : [
            [-172.5, 49.5],
            [172.5, 49.5],
            [172.5, -49.5],
          ]
  );
  const links = new Map();
  for (let i = 0; i < aux.length; i++)
    for (let p = 0; p < auxPorts[i].length; p++) {
      const a = point(aux[i], ...auxPorts[i][p]),
        matches = [];
      for (let j = 0; j < aux.length; j++)
        if (i !== j && axis(aux[i].rotation, aux[j].rotation))
          for (let q = 0; q < auxPorts[j].length; q++)
            if (distance(a, point(aux[j], ...auxPorts[j][q])) < 2) matches.push([j, q]);
      if (matches.length === 1) links.set(`${i}:${p}`, matches[0]);
    }
  if (roots.length)
    plan.pit = { ...plan.pit, native: true, entry: remap.get(roots[0].anchor), merge: remap.get(roots.at(-1).anchor) };
  const entry = roots.find((r) => r.item.kind === 'pitEntry'),
    exit = roots.find((r) => r.item.kind === 'pitExit');
  let bays = 0,
    steps = 0;
  const pitMembers = new Set();
  if (entry && exit) {
    const start = aux.findIndex((i) => i.index === entry.item.index),
      finish = aux.findIndex((i) => i.index === exit.item.index);
    const visit = (i, p, path) => {
      if (++steps > 20000) throw new Error('Ambiguous SBP pit graph');
      if (path.size > aux.length * 3 || bays >= 6) return;
      const key = `${i}:${p}`;
      if (path.has(key)) return;
      const nextPath = new Set(path).add(key);
      pitMembers.add(aux[i].index);
      if (i === finish && p === 2) {
        bays++;
        return;
      }
      const targets = aux[i].kind === 'single' ? [1 - p] : p === 0 ? [1, 2] : [0];
      for (const q of targets) {
        const link = links.get(`${i}:${q}`);
        if (link) visit(...link, nextPath);
      }
    };
    const first = links.get(`${start}:2`);
    if (first) visit(...first, new Set());
    if (bays)
      plan.pit = {
        enabled: true,
        native: true,
        entry: remap.get(entry.anchor),
        merge: remap.get(exit.anchor),
        spacingMm: 345,
        bayLengthMm: 1035,
      };
  }
  const origin = segments[0].start;
  for (const p of plan.pieces) {
    p.placement.xMm -= origin.x;
    p.placement.yMm -= origin.y;
  }
  segments = traceTrackPlan({ ...plan, trackExtras: [] }).segments;
  let unassigned = 0;
  for (const e of extras) {
    const src = e._source,
      root = roots.find((r) => r.item.index === src.index || r.mate.index === src.index);
    let anchor = root
      ? remap.get(root.anchor)
      : pitMembers.has(src.index) && entry
        ? remap.get(entry.anchor)
        : undefined;
    // Only geometrically matching shoulders become editor attachments. A loose
    // shoulder remains loose instead of following an unrelated nearby loop.
    if (anchor === undefined && e.kind.startsWith('pitBorder') && entry) anchor = remap.get(entry.anchor);
    if (anchor === undefined && e.kind.startsWith('border')) {
      const border = SOFTY_EXTRAS[e.kind],
        pos = { x: src.x - origin.x, y: src.y - origin.y };
      for (const s of segments) {
        const road = TRACK_PARTS[s.type],
          h = s.start.h;
        let matches = false;
        if (
          border.radius &&
          road.radius &&
          Math.abs(border.radius - (road.radius - 2)) < 0.01 &&
          border.angle === Math.abs(road.angle)
        ) {
          const center = {
            x: s.start.x - Math.sin(h) * (road.radius - 2),
            y: s.start.y + Math.cos(h) * (road.radius - 2),
          };
          matches = distance(pos, center) < 2 && Math.abs(norm(src.rotation - deg(h) - road.angle / 2)) < 1;
        } else if (
          border.length &&
          !road.radius &&
          Math.abs(border.length - (s.type === 'Viertelgerade' ? 86.25 : road.length)) < 1 &&
          axis(src.rotation, deg(h))
        ) {
          const mid = { x: (s.start.x + s.end.x) / 2, y: (s.start.y + s.end.y) / 2 };
          matches = [-148.5, 148.5].some(
            (n) => distance(pos, { x: mid.x - Math.sin(h) * n, y: mid.y + Math.cos(h) * n }) < 2
          );
        } else if (border.end) {
          matches = [s.start, s.end].some(
            (p) =>
              axis(src.rotation, deg(p.h)) &&
              [-99, 99].some((n) => distance(pos, { x: p.x - Math.sin(p.h) * n, y: p.y + Math.cos(p.h) * n }) < 2)
          );
        }
        if (matches) {
          anchor = s.index;
          break;
        }
      }
    }
    e.placement.xMm -= origin.x;
    e.placement.yMm -= origin.y;
    if (anchor !== undefined) {
      const a = segments[anchor].start,
        dx = e.placement.xMm - a.x,
        dy = e.placement.yMm - a.y;
      e.anchor = anchor;
      e.placement = {
        xMm: Math.cos(a.h) * dx + Math.sin(a.h) * dy,
        yMm: -Math.sin(a.h) * dx + Math.cos(a.h) * dy,
        headingDegrees: norm(e.placement.headingDegrees - deg(a.h)),
      };
      e.level = plan.pieces[anchor].level;
    } else unassigned++;
    delete e._source;
  }
  plan.softyImport = { paintOrder: true, items: native.length, crossings, bays, unassigned };
  return validateTrackPlan(plan);
}
