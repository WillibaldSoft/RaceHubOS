import { unitHousingPolygon } from './trackUnitGeometry.js';
import { nativeExtraPoints } from './softyExtraGeometry.js';
import { borderShapes, borderConflicts } from './trackBorderGeometry.js';
import { applyTrackBorders } from './trackBorders.js';
import { analyseCurveDynamics, curveDynamicsScore } from './curveDynamics.js';
import { fitPlanToInventory, railRequirements } from './railInventory.js';
import { emptyTrackPlan, traceTrackPlan, validateTrackPlan } from './trackPlan.js';

import { validateRoom, roomTrackArea } from './roomConfiguration.js';
export { DEFAULT_ROOM, validateRoom, roomTrackArea } from './roomConfiguration.js';
export function trackBounds(plan) {
  const segments = traceTrackPlan(plan).segments;
  const pts = segments.flatMap((s) => s.points[0]);
  const entry = segments[plan.pit.entry]?.start;
  if (plan.pit.enabled && !plan.pit.native && entry) {
    const split = 345 + plan.pit.spacingMm,
      end = split + plan.pit.bayLengthMm;
    for (const [u, v] of [
      [345, 148.5],
      [split, 148.5],
      [split + Math.min(345, plan.pit.bayLengthMm / 3), 247.5],
      [end, 148.5],
    ])
      pts.push([
        entry.x + Math.cos(entry.h) * u - Math.sin(entry.h) * v,
        entry.y + Math.sin(entry.h) * u + Math.cos(entry.h) * v,
      ]);
  }
  if (!pts.length) return { x: 0, y: 0, width: 0, depth: 0 };
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  // 99 mm half road width plus 100 mm reserved borders on each side.
  const x = Math.min(...xs) - 199,
    y = Math.min(...ys) - 199;
  const borderPoints = [
    ...borderShapes(plan, segments).flatMap((s) => s.points),
    ...nativeExtraPoints(plan, segments),
    ...segments.flatMap(unitHousingPolygon),
  ];
  let bx = x,
    by = y,
    xmax = Math.max(...xs) + 199,
    ymax = Math.max(...ys) + 199;
  for (const p of borderPoints) {
    bx = Math.min(bx, p[0] - 100);
    by = Math.min(by, p[1] - 100);
    xmax = Math.max(xmax, p[0] + 100);
    ymax = Math.max(ymax, p[1] + 100);
  }
  return { x: bx, y: by, width: xmax - bx, depth: ymax - by };
}
const piece = (type, level = 0) => ({ type, level, jointDegrees: 0 });
const straight = (n) => Array.from({ length: n }, () => piece('Standardgerade'));
const arc = (k, degrees, side) => {
  const angle = k === 1 ? 30 : k === 4 ? 15 : 30;
  return Array.from({ length: degrees / angle }, () => piece(`Kurve_${k}_${angle}_${side}`));
};
function oval(k, a, b, corner = null) {
  const quarter = corner || arc(k, 90, 'rechts');
  const pieces = [
    ...straight(a),
    ...quarter,
    ...straight(b),
    ...quarter,
    ...straight(a),
    ...quarter,
    ...straight(b),
    ...quarter,
  ].map((p) => ({ ...p }));
  pieces[0].type = 'Control_unit';
  return { ...emptyTrackPlan(), geometryProfile: 'prototype', pieces };
}
function bridge(k) {
  const radius = 297 + (k - 1) * 198;
  let connector = null,
    error = Infinity;
  for (let n = 1; n <= 10; n++)
    for (let d = 0; d <= 2; d++)
      for (let q = 0; q <= 3; q++) {
        const delta = Math.abs(n * 345 + d * 115 + q * 86.25 - radius * 2);
        if (delta < error) {
          error = delta;
          connector = [
            ...straight(n),
            ...Array.from({ length: d }, () => piece('Drittelgerade')),
            ...Array.from({ length: q }, () => piece('Viertelgerade')),
          ];
        }
      }
  const right = arc(k, 270, 'rechts'),
    left = arc(k, 270, 'links');
  const pieces = [...right, ...connector, ...left, ...connector].map((p) => ({ ...p }));
  const first = right.length,
    second = first + connector.length,
    last = second + left.length;
  pieces[last].type = 'Control_unit';
  // Fit only connector tangents; retain every catalogue radius and straight length.
  const plan = { ...emptyTrackPlan(), geometryProfile: 'prototype', pieces };
  const end = (a, b) => {
    pieces[first].jointDegrees = a;
    pieces[second].jointDegrees = b;
    pieces[last].jointDegrees = -a - b;
    return traceTrackPlan(plan).segments.at(-1).end;
  };
  let a = 0,
    b = 0;
  for (let i = 0; i < 8; i++) {
    const p = end(a, b),
      pa = end(a + 0.001, b),
      pb = end(a, b + 0.001);
    const ax = (pa.x - p.x) / 0.001,
      ay = (pa.y - p.y) / 0.001,
      bx = (pb.x - p.x) / 0.001,
      by = (pb.y - p.y) / 0.001,
      det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-8) return null;
    a += (-p.x * by + p.y * bx) / det;
    b += (p.x * ay - p.y * ax) / det;
  }
  end(a, b);
  const joint = Math.max(...pieces.map((p) => Math.abs(p.jointDegrees)));
  if (joint > 1 || traceTrackPlan(plan).gapMm > 0.1) return null;
  for (let i = Math.floor(right.length / 2); i < second + Math.ceil(left.length / 2); i++) pieces[i].level = 1;
  return { plan, joint, rampRunMm: radius * Math.PI * 0.75 };
}
export function planRoom(input) {
  const room = validateRoom(input);
  const available = roomTrackArea(room);
  if (room.drivers * room.driverWidthM > room.widthM - 2 * room.edgeM || available.depth <= 0)
    return { room, proposals: [], reason: 'people' };
  const proposals = [];
  let stockRejected = false;
  function consider(plan, kind, extra = {}) {
    if (room.borderMode)
      plan = applyTrackBorders(
        plan,
        plan.pieces.map((_, i) => i),
        room.borderMode
      );
    if (room.inventory && !room.allowAdditionalParts) {
      const fitted = fitPlanToInventory(plan, room.inventory);
      if (!fitted) {
        stockRejected = true;
        return;
      }
      plan = fitted;
    }
    for (const rotation of [0, 90]) {
      const rotated = validateTrackPlan({ ...plan, startHeadingDegrees: rotation });
      const bounds = trackBounds(rotated);
      if (bounds.width > available.width || bounds.depth > available.depth) continue;
      if (kind === 'bridge' && rotated.pieces.some((p) => p.borders) && borderConflicts(rotated).length) continue;
      const trace = traceTrackPlan(rotated);
      if (trace.gapMm > 0.1 || Math.abs(trace.headingErrorDegrees) > 0.01) continue;
      proposals.push({
        plan: { ...rotated, roomPlan: room },
        kind,
        dynamics: analyseCurveDynamics(rotated),
        bounds,
        lengthsM: trace.laneLengthsM,
        requirements: railRequirements(rotated),
        ...extra,
      });
      break;
    }
  }
  // Discrete standard-rail templates, no arbitrary stretched track surfaces.
  for (let k = 1; k <= 4; k++)
    for (let a = 1; a <= 24; a++)
      for (let b = 0; b <= 16; b++) {
        const radius = 297 + (k - 1) * 198;
        if (
          (a * 345 + 2 * radius + 398 > available.width || b * 345 + 2 * radius + 398 > available.depth) &&
          (a * 345 + 2 * radius + 398 > available.depth || b * 345 + 2 * radius + 398 > available.width)
        )
          continue;
        consider(oval(k, a, b), 'oval');
      }
  // Mixed-radius 90° corners let an existing mixed Carrera collection produce
  // new closed variants without requiring a full circle of any single radius.
  if (room.inventory) {
    const patterns = [
      ['Kurve_1_60_rechts', 'Kurve_2_30_rechts'],
      ['Kurve_1_60_rechts', 'Kurve_3_30_rechts'],
      ['Kurve_2_30_rechts', 'Kurve_1_60_rechts'],
      ['Kurve_3_30_rechts', 'Kurve_1_60_rechts'],
      ['Kurve_1_60_rechts', 'Kurve_4_15_rechts', 'Kurve_4_15_rechts'],
      ['Kurve_1_30_rechts', 'Kurve_2_30_rechts', 'Kurve_3_30_rechts'],
      ['Kurve_2_30_rechts', 'Kurve_3_30_rechts', 'Kurve_4_15_rechts', 'Kurve_4_15_rechts'],
    ];
    for (const types of patterns) {
      const corner = types.map((type) => piece(type));
      const end = traceTrackPlan({ ...emptyTrackPlan(), geometryProfile: 'prototype', pieces: corner }).segments.at(
        -1
      ).end;
      const span = end.x + end.y + 398;
      for (let a = 1; a <= 24; a++)
        for (let b = 0; b <= 16; b++) {
          const w = a * 345 + span,
            d = b * 345 + span;
          if ((w > available.width || d > available.depth) && (w > available.depth || d > available.width)) continue;
          consider(oval(1, a, b, corner), 'oval');
        }
    }
  }
  if (room.maxLevels >= 2)
    for (let k = 1; k <= 4; k++) {
      const candidate = bridge(k);
      if (!candidate || (room.levelHeightMm / candidate.rampRunMm) * 100 > room.maxGradePercent) continue;
      consider(candidate.plan, 'bridge', { maxJointDegrees: candidate.joint, rampRunMm: candidate.rampRunMm });
    }
  const missing = (p) =>
    room.inventory
      ? Object.entries(p.requirements.counts).reduce(
          (n, [id, count]) => n + Math.max(0, count - room.inventory.counts[id]),
          0
        )
      : 0;
  proposals.sort(
    (a, b) =>
      (room.allowAdditionalParts ? missing(a) - missing(b) : 0) ||
      curveDynamicsScore(b.dynamics, room.curveStyle) - curveDynamicsScore(a.dynamics, room.curveStyle) ||
      b.lengthsM[0] + b.lengthsM[1] - (a.lengthsM[0] + a.lengthsM[1])
  );
  const bestOvals = [],
    seen = new Set();
  for (const p of proposals.filter((p) => p.kind === 'oval')) {
    const signature = JSON.stringify([Math.round(p.bounds.width), Math.round(p.bounds.depth), p.requirements.counts]);
    if (seen.has(signature)) continue;
    bestOvals.push(p);
    seen.add(signature);
    if (bestOvals.length >= (room.inventory ? 3 : 1)) break;
  }
  const bestBridge = proposals.find((p) => p.kind === 'bridge');
  return {
    room,
    proposals: [...bestOvals, bestBridge].filter(Boolean),
    reason: proposals.length ? null : stockRejected ? 'inventory' : 'space',
  };
}
