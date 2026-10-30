import { borderConflicts } from './trackBorderGeometry.js';
import { applyTrackBorders } from './trackBorders.js';
import { analyseCurveDynamics, curveDynamicsScore } from './curveDynamics.js';
import { newCrossingPattern } from './newTrackPatterns.js';
import { TRACK_PARTS, validateTrackPlan, traceTrackPlan } from './trackPlan.js';
import { validateRoom, roomTrackArea } from './roomConfiguration.js';
import { trackBounds } from './roomPlanner.js';
import { railRequirements } from './railInventory.js';

function endpoint(plan) {
  let x = 0,
    y = 0,
    h = (plan.startHeadingDegrees * Math.PI) / 180;
  for (const p of plan.pieces) {
    h += (p.jointDegrees * Math.PI) / 180;
    const s = TRACK_PARTS[p.type],
      a = ((s.angle || 0) * Math.PI) / 180;
    if (a) {
      const r = s.radius - (plan.geometryProfile === 'prototype' ? 2 : 0);
      x += Math.sign(a) * r * (Math.sin(h + a) - Math.sin(h));
      y += Math.sign(a) * r * (Math.cos(h) - Math.cos(h + a));
      h += a;
    } else {
      const l = p.type === 'Viertelgerade' && plan.geometryProfile === 'prototype' ? 86.25 : s.length;
      x += l * Math.cos(h);
      y += l * Math.sin(h);
    }
  }
  return [x, y, ((((((h * 180) / Math.PI - plan.startHeadingDegrees) % 360) + 540) % 360) - 180) * 10];
}
function solve(m, b) {
  m = m.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let j = i + 1; j < 3; j++) if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    const d = m[i][i];
    if (Math.abs(d) < 1e-12) return null;
    for (let k = i; k < 4; k++) m[i][k] /= d;
    for (let j = 0; j < 3; j++)
      if (i !== j) {
        const f = m[j][i];
        for (let k = i; k < 4; k++) m[j][k] -= f * m[i][k];
      }
  }
  return m.map((r) => r[3]);
}
function fit(p, joints, maxJoint) {
  for (let iter = 0; iter < 10; iter++) {
    const e = endpoint(p);
    if (Math.hypot(...e) < 1e-6) return true;
    const cols = joints.map((i) => {
      p.pieces[i].jointDegrees += 0.001;
      const a = endpoint(p);
      p.pieces[i].jointDegrees -= 0.001;
      return a.map((v, k) => (v - e[k]) / 0.001);
    });
    const m = Array.from({ length: 3 }, (_, a) =>
        Array.from({ length: 3 }, (_, b) => cols.reduce((s, c) => s + c[a] * c[b], 0))
      ),
      v = solve(
        m,
        e.map((n) => -n)
      );
    if (!v) return false;
    for (let k = 0; k < joints.length; k++) {
      p.pieces[joints[k]].jointDegrees += cols[k].reduce((s, c, a) => s + c * v[a], 0);
      if (Math.abs(p.pieces[joints[k]].jointDegrees) > maxJoint) return false;
    }
  }
  return Math.hypot(...endpoint(p)) < 0.001;
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function pointDistance(p, a, b) {
  const x = b[0] - a[0],
    y = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y || 1)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
function distance(a, b, c, d) {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b));
}
export function checkDetailedGeometry(plan) {
  const segments = traceTrackPlan(plan).segments;
  const boxes = segments.map((s) => {
    const p = s.points[0];
    return [
      Math.min(...p.map((p) => p[0])),
      Math.min(...p.map((p) => p[1])),
      Math.max(...p.map((p) => p[0])),
      Math.max(...p.map((p) => p[1])),
    ];
  });
  const overlaps = [],
    crossings = [];
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      if (Math.min(j - i, segments.length - (j - i)) <= 2) continue;
      const aa = boxes[i],
        bb = boxes[j];
      if (aa[0] - bb[2] > 198 || bb[0] - aa[2] > 198 || aa[1] - bb[3] > 198 || bb[1] - aa[3] > 198) continue;
      const a = segments[i],
        b = segments[j],
        pa = a.points[0],
        pb = b.points[0];
      let min = Infinity;
      for (let u = 1; u < pa.length; u++)
        for (let v = 1; v < pb.length; v++) min = Math.min(min, distance(pa[u - 1], pa[u], pb[v - 1], pb[v]));
      if (min < 0.01) crossings.push({ rails: [i, j], levels: [a.level, b.level] });
      if (a.level === b.level && min < 195) overlaps.push({ rails: [i, j], distanceMm: min });
    }
  if (plan.pit.enabled) {
    const protectedParts = pitProtected(plan),
      entry = segments[plan.pit.entry].start,
      exit = segments[plan.pit.merge].end;
    protectedParts.add((plan.pit.entry - 1 + segments.length) % segments.length);
    protectedParts.add((plan.pit.merge + 1) % segments.length);
    const split = 345 + plan.pit.spacingMm,
      end = split + plan.pit.bayLengthMm,
      t = Math.min(345, plan.pit.bayLengthMm / 3),
      dx = exit.x - entry.x,
      dy = exit.y - entry.y,
      ex = dx * Math.cos(entry.h) + dy * Math.sin(entry.h),
      ey = -dx * Math.sin(entry.h) + dy * Math.cos(entry.h);
    const cubic = (a, b, c, d) =>
      Array.from({ length: 33 }, (_, i) => {
        const f = i / 32,
          g = 1 - f;
        return [
          g * g * g * a[0] + 3 * g * g * f * b[0] + 3 * g * f * f * c[0] + f * f * f * d[0],
          g * g * g * a[1] + 3 * g * g * f * b[1] + 3 * g * f * f * c[1] + f * f * f * d[1],
        ];
      });
    const paths = [
      [
        ...cubic([0, 49.5], [115, 49.5], [230, 148.5], [345, 148.5]),
        [split, 148.5],
        [end, 148.5],
        [ex - 345, 148.5],
        ...cubic([ex - 345, 148.5], [ex - 230, 148.5], [ex - 115, ey + 49.5], [ex, ey + 49.5]),
      ],
      [
        ...cubic([split, 148.5], [split + t / 3, 148.5], [split + (2 * t) / 3, 247.5], [split + t, 247.5]),
        [end - t, 247.5],
        ...cubic([end - t, 247.5], [end - (2 * t) / 3, 247.5], [end - t / 3, 148.5], [end, 148.5]),
      ],
    ].map((path) =>
      path.map(([u, v]) => [
        entry.x + Math.cos(entry.h) * u - Math.sin(entry.h) * v,
        entry.y + Math.sin(entry.h) * u + Math.cos(entry.h) * v,
      ])
    );
    for (let i = 0; i < segments.length; i++)
      if (!protectedParts.has(i) && segments[i].level === 0)
        for (let branch = 0; branch < paths.length; branch++) {
          const pa = segments[i].points[0],
            pb = paths[branch],
            aa = boxes[i],
            bb = [
              Math.min(...pb.map((p) => p[0])),
              Math.min(...pb.map((p) => p[1])),
              Math.max(...pb.map((p) => p[0])),
              Math.max(...pb.map((p) => p[1])),
            ];
          if (aa[0] - bb[2] > 149 || bb[0] - aa[2] > 149 || aa[1] - bb[3] > 149 || bb[1] - aa[3] > 149) continue;
          let min = Infinity;
          for (let u = 1; u < pa.length; u++)
            for (let v = 1; v < pb.length; v++) min = Math.min(min, distance(pa[u - 1], pa[u], pb[v - 1], pb[v]));
          if (min < 145.5) overlaps.push({ rails: [i], pitBranch: branch, distanceMm: min });
        }
  }
  return { overlaps, crossings };
}
function pitProtected(p) {
  const set = new Set();
  let i = p.pit.entry;
  for (let n = 0; n < p.pieces.length; n++) {
    set.add(i);
    if (i === p.pit.merge) break;
    i = (i + 1) % p.pieces.length;
  }
  return set;
}
function rampsFit(p, room) {
  const elevated = p.pieces.flatMap((p, i) => (p.level > 0 ? [i] : []));
  if (!elevated.length) return null;
  const lo = elevated[0],
    hi = elevated.at(-1),
    protectedParts = pitProtected(p);
  if (elevated.length !== hi - lo + 1 || p.pieces.some((p) => p.level > 1)) return null;
  const trace = traceTrackPlan(p),
    crossingRails = new Set(checkDetailedGeometry(p).crossings.flatMap((c) => c.rails));
  // Reserve a continuous approach on ordinary rails, including curved ramps.
  // Never run a ramp through the CU/pit, a switch, or another crossing.
  function reserve(start, step) {
    let length = 0;
    for (let i = start; i >= 0 && i < p.pieces.length; i += step) {
      const rail = p.pieces[i];
      if (
        protectedParts.has(i) ||
        rail.level ||
        crossingRails.has(i) ||
        !(rail.type === 'Standardgerade' || rail.type.startsWith('Kurve_'))
      )
        break;
      const s = trace.segments[i],
        points = s.points[0];
      length += points.slice(1).reduce((sum, p, j) => sum + Math.hypot(p[0] - points[j][0], p[1] - points[j][1]), 0);
      if (length >= (room.levelHeightMm / room.maxGradePercent) * 100) break;
    }
    return length;
  }
  const runs = [reserve(lo - 1, -1), reserve(hi + 1, 1)];
  return runs.every((n) => n > 0 && (room.levelHeightMm / n) * 100 <= room.maxGradePercent) ? runs : null;
}
function orient(p, area) {
  const original = p.startHeadingDegrees;
  for (const offset of Array.from({ length: 72 }, (_, i) => i * 2.5)) {
    p.startHeadingDegrees = ((((original + offset + 180) % 360) + 360) % 360) - 180;
    const b = trackBounds(p);
    if (b.width <= area.width && b.depth <= area.depth) return b;
  }
  return null;
}
// Compare 96 equal-distance positions on the course in a fixed heading.
// Different piece counts remain comparable; a rotated drawing is not a new route.
function shape(plan) {
  const start = plan.pit.enabled ? plan.pit.entry : 0,
    pieces = [...plan.pieces.slice(start), ...plan.pieces.slice(0, start)];
  const pts = traceTrackPlan({ ...plan, pieces, startHeadingDegrees: 0 }).segments.flatMap((s) => s.points[0]);
  const cumulative = [0];
  for (let i = 1; i < pts.length; i++)
    cumulative.push(cumulative.at(-1) + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  let j = 1;
  return Array.from({ length: 96 }, (_, i) => {
    const target = (cumulative.at(-1) * i) / 96;
    while (j < cumulative.length - 1 && cumulative[j] < target) j++;
    const t = (target - cumulative[j - 1]) / (cumulative[j] - cumulative[j - 1] || 1);
    return pts[j - 1].map((v, k) => v + t * (pts[j][k] - v));
  });
}
export function detailedShapeDistance(a, b) {
  const pa = shape(a),
    pb = shape(b);
  return Math.sqrt(pa.reduce((sum, p, i) => sum + (p[0] - pb[i][0]) ** 2 + (p[1] - pb[i][1]) ** 2, 0) / pa.length);
}
export const MIN_VARIANT_DISTANCE_MM = 100;
/** Deterministic, bounded catalogue search, consumed in a browser Worker.
 * New loop sequences are built from inventory; only the pit assembly is retained.
 * All progress/result data are plain JSON; there is no network or AI dependency.
 */
export function* searchDetailedTrackVariants(input, options = {}) {
  const room = validateRoom(input),
    config = room.detailedSearch || {},
    attempts = config.attempts ?? 800,
    maxJoint = config.jointDegrees ?? 0.5;
  const source = validateTrackPlan(options.sourcePlan);
  if (
    source.pieces.length > 150 ||
    source.pieces.length < 10 ||
    !source.pit.enabled ||
    source.pit.spacingMm % 345 !== 0 ||
    source.pit.bayLengthMm % 345 !== 0 ||
    source.pit.bayLengthMm < 1035 ||
    source.pieces.filter((p) => p.type === 'Control_unit').length !== 1 ||
    source.pieces[source.pit.entry]?.type !== 'Pit_stop_weiche_anfang' ||
    source.pieces[source.pit.merge]?.type !== 'Pit_stop_weiche_ende'
  )
    return { room, proposals: [], reason: 'source' };
  if (room.maxLevels < 2) return { room, proposals: [], reason: 'levels' };
  const area = roomTrackArea(room);
  if (room.drivers * room.driverWidthM > room.widthM - 2 * room.edgeM || area.depth <= 0)
    return { room, proposals: [], reason: 'people' };
  const stock = room.inventory?.counts;
  if (!stock) return { room, proposals: [], reason: 'inventory' };
  const protectedParts = pitProtected(source);
  if (![...protectedParts].some((i) => source.pieces[i].type === 'Control_unit'))
    return { room, proposals: [], reason: 'source' };
  const pitStock = railRequirements({
    ...source,
    pieces: [...protectedParts].map((i) => source.pieces[i]),
    pit: { ...source.pit, entry: 0, merge: protectedParts.size - 1 },
  }).counts;
  if (!room.allowAdditionalParts && Object.keys(pitStock).some((id) => pitStock[id] > (stock[id] || 0)))
    return { room, proposals: [], reason: 'inventory' };
  if ([...protectedParts].some((i) => TRACK_PARTS[source.pieces[i].type].angle || source.pieces[i].level > 0))
    return { room, proposals: [], reason: 'source' };
  const seen = new Set(),
    best = [];
  let seed = config.seed ?? 87654321,
    accepted = 0;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  };
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt % 10 === 0) yield { progress: attempt / attempts, attempt, accepted };
    const { plan: p, joints } = newCrossingPattern(source, rand);
    let requirements = railRequirements(p);
    if (
      !room.allowAdditionalParts &&
      Object.keys(requirements.counts).some((id) => requirements.counts[id] > (stock[id] || 0))
    )
      continue;
    const key = p.pieces.map((p) => p.type).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    if (!fit(p, joints, maxJoint)) continue;
    if (room.borderMode)
      Object.assign(
        p,
        applyTrackBorders(
          p,
          p.pieces.map((_, i) => i),
          room.borderMode
        )
      );
    requirements = railRequirements(p);
    if (
      !room.allowAdditionalParts &&
      Object.keys(requirements.counts).some((id) => requirements.counts[id] > (stock[id] || 0))
    )
      continue;
    const bounds = orient(p, area);
    if (!bounds) continue;
    const geometry = checkDetailedGeometry(p);
    if (
      geometry.overlaps.length ||
      !geometry.crossings.length ||
      geometry.crossings.some((c) => c.levels[0] === c.levels[1])
    )
      continue;
    if (p.pieces.some((p) => p.borders) && borderConflicts(p).length) continue;
    const rampRuns = rampsFit(p, room);
    if (!rampRuns) continue;
    const trace = traceTrackPlan(p);
    if (trace.gapMm > 0.01 || Math.abs(trace.headingErrorDegrees) > 0.001) continue;
    // Native pit checks include straight alignment and the full two-bay route.
    const entry = trace.segments[p.pit.entry].start,
      exit = trace.segments[p.pit.merge].end,
      dx = exit.x - entry.x,
      dy = exit.y - entry.y;
    if (
      Math.abs(-dx * Math.sin(entry.h) + dy * Math.cos(entry.h)) > 0.01 ||
      Math.abs(dx * Math.cos(entry.h) + dy * Math.sin(entry.h) - (690 + p.pit.spacingMm + p.pit.bayLengthMm)) > 0.01
    )
      continue;
    const joint = Math.max(...p.pieces.map((p) => Math.abs(p.jointDegrees)));
    if (joint > maxJoint + 1e-9) continue;
    const changed = p.pieces.filter((rail, i) => rail.type !== source.pieces[i]?.type).length;
    const additionalCount = Object.entries(requirements.counts).reduce(
      (n, [id, count]) => n + Math.max(0, count - (stock[id] || 0)),
      0
    );
    const dynamics = analyseCurveDynamics(p);
    const score =
      curveDynamicsScore(dynamics, room.curveStyle) +
      trace.laneLengthsM[0] * 5 -
      additionalCount * 20 -
      joint * 80 +
      (area.width * area.depth - bounds.width * bounds.depth) / 100000;
    accepted++;
    if (detailedShapeDistance(p, source) < MIN_VARIANT_DISTANCE_MM) continue;
    const similar = best.filter((candidate) => detailedShapeDistance(candidate.plan, p) < MIN_VARIANT_DISTANCE_MM);
    if (similar.some((candidate) => candidate.score >= score)) continue;
    for (const candidate of similar) best.splice(best.indexOf(candidate), 1);
    best.push({
      plan: { ...p, roomPlan: room },
      kind: 'detailed',
      dynamics,
      bounds,
      lengthsM: trace.laneLengthsM,
      requirements: railRequirements(p),
      maxJointDegrees: joint,
      changedRails: changed,
      rampRunsMm: rampRuns,
      crossings: geometry.crossings,
      score,
      accessoriesReused: requirements.unresolved,
      pattern: 'new-crossing',
    });
    best.sort((a, b) => b.score - a.score);
    best.splice(30);
  }
  return { room, proposals: best.slice(0, 3), reason: best.length ? null : 'search', attempts, accepted };
}
export function runDetailedTrackSearch(room, options) {
  const generator = searchDetailedTrackVariants(room, options);
  let next;
  do {
    next = generator.next();
  } while (!next.done);
  return next.value;
}
