import { unitHousingPolygon } from './trackUnitGeometry.js';
import { softyExtraGeometry } from './softyExtraGeometry.js';
import { traceTrackPlan } from './trackPlan.js';
import { BORDER_WIDTH_MM, BORDER_END_LENGTH_MM, borderArticle } from './trackBorders.js';
function offset(s, j, n) {
  const p = s.points[0][j],
    h = s.start.h + ((s.end.h - s.start.h) * j) / 32;
  return [p[0] - Math.sin(h) * n, p[1] + Math.cos(h) * n];
}
export function roadPolygon(s) {
  if (s.roadOutline) return s.roadOutline;
  return [...s.points[0].map((_, j) => offset(s, j, -99)), ...s.points[0].map((_, j) => offset(s, j, 99)).reverse()];
}
export function borderShapes(plan, segments = traceTrackPlan(plan).segments) {
  const shapes = [];
  for (const s of segments)
    for (const side of ['left', 'right'])
      if (s.borders?.[side]) {
        const sign = side === 'left' ? -1 : 1,
          inner = 99 * sign,
          outer = (99 + BORDER_WIDTH_MM) * sign,
          config = s.borders[side];
        shapes.push({
          index: s.index,
          level: s.level,
          side,
          kind: 'strip',
          article: borderArticle(s.type, side),
          points: [
            ...s.points[0].map((_, j) => offset(s, j, inner)),
            ...s.points[0].map((_, j) => offset(s, j, outer)).reverse(),
          ],
        });
        for (const [key, j, dir] of [
          ['startCap', 0, -1],
          ['endCap', 32, 1],
        ])
          if (config[key]) {
            const h = j ? s.end.h : s.start.h,
              a = offset(s, j, inner),
              length = BORDER_END_LENGTH_MM,
              width = BORDER_WIDTH_MM;
            const local = [
              [0, 0],
              [0, width],
              ...Array.from({ length: 32 }, (_, i) => {
                const t = (i + 1) / 32,
                  g = 1 - t;
                return [
                  3 * g * g * t * length * 0.8 + 3 * g * t * t * length + t * t * t * length,
                  g * g * g * width + 3 * g * g * t * width + (3 * g * t * t * width) / 6,
                ];
              }),
            ];
            const points = local.map(([u, v]) => [
              a[0] + Math.cos(h) * dir * u - Math.sin(h) * sign * v,
              a[1] + Math.sin(h) * dir * u + Math.cos(h) * sign * v,
            ]);
            shapes.push({ index: s.index, level: s.level, side, kind: key, article: '20598', points });
          }
      }
  return shapes;
}
// Same feeder/split/merge centre lines as the double-box drawing.
export function pitRoadPolygons(plan, segments = traceTrackPlan(plan).segments) {
  if (plan.pit.native)
    return (plan.trackExtras || [])
      .filter((e) => !e.hidden)
      .map((e) => softyExtraGeometry(e, segments))
      .filter((e) => !e.border)
      .map((e) => e.polygon);
  if (!plan.pit.enabled) return [];
  const p = plan.pit,
    e = segments[p.entry]?.start,
    m = segments[p.merge]?.end;
  if (!e || !m) return [];
  const split = 345 + p.spacingMm,
    end = split + p.bayLengthMm,
    t = Math.min(345, p.bayLengthMm / 3),
    dx = m.x - e.x,
    dy = m.y - e.y,
    ex = dx * Math.cos(e.h) + dy * Math.sin(e.h),
    ey = -dx * Math.sin(e.h) + dy * Math.cos(e.h);
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
    [...cubic([0, 49.5], [115, 49.5], [230, 148.5], [345, 148.5]), [split, 148.5]],
    [
      [split, 148.5],
      [end, 148.5],
    ],
    [
      ...cubic([split, 148.5], [split + t / 3, 148.5], [split + (2 * t) / 3, 247.5], [split + t, 247.5]),
      [end - t, 247.5],
      ...cubic([end - t, 247.5], [end - (2 * t) / 3, 247.5], [end - t / 3, 148.5], [end, 148.5]),
    ],
    [
      [end, 148.5],
      [Math.max(end, ex - 345), 148.5],
      ...cubic([ex - 345, 148.5], [ex - 230, 148.5], [ex - 115, ey + 49.5], [ex, ey + 49.5]),
    ],
  ];
  return paths.map((path) => {
    const shifted = (n) =>
      path.map(([u, v], i) => {
        let a = path[Math.max(0, i - 1)],
          b = path[Math.min(path.length - 1, i + 1)];
        const h = Math.atan2(b[1] - a[1], b[0] - a[0]);
        u -= Math.sin(h) * n;
        v += Math.cos(h) * n;
        return [e.x + Math.cos(e.h) * u - Math.sin(e.h) * v, e.y + Math.sin(e.h) * u + Math.cos(e.h) * v];
      });
    return [...shifted(-49.5), ...shifted(49.5).reverse()];
  });
}
export function trackFootprint(plan, withBorders = true) {
  const segments = traceTrackPlan(plan).segments,
    points = segments.flatMap((s) => [...roadPolygon(s), ...unitHousingPolygon(s)]);
  if (withBorders) {
    for (const b of borderShapes(plan, segments)) for (const p of b.points) points.push(p);
  }
  for (const e of plan.trackExtras || []) {
    if (e.hidden) continue;
    const g = softyExtraGeometry(e, segments);
    if (withBorders || !g.border) points.push(...g.polygon);
  }
  for (const polygon of pitRoadPolygons(plan, segments)) for (const p of polygon) points.push(p);
  if (!points.length) return { x: 0, y: 0, width: 0, depth: 0 };
  let x = Infinity,
    y = Infinity,
    xmax = -Infinity,
    ymax = -Infinity;
  for (const p of points) {
    x = Math.min(x, p[0]);
    y = Math.min(y, p[1]);
    xmax = Math.max(xmax, p[0]);
    ymax = Math.max(ymax, p[1]);
  }
  return { x, y, width: xmax - x, depth: ymax - y };
}
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function inside(p, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function overlap(a, b) {
  const box = (p) => [
      Math.min(...p.map((v) => v[0])),
      Math.min(...p.map((v) => v[1])),
      Math.max(...p.map((v) => v[0])),
      Math.max(...p.map((v) => v[1])),
    ],
    aa = box(a),
    bb = box(b);
  if (aa[0] >= bb[2] - 0.01 || bb[0] >= aa[2] - 0.01 || aa[1] >= bb[3] - 0.01 || bb[1] >= aa[3] - 0.01) return false;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      if (
        orient(a[i], a[(i + 1) % a.length], b[j]) * orient(a[i], a[(i + 1) % a.length], b[(j + 1) % b.length]) <
          -0.01 &&
        orient(b[j], b[(j + 1) % b.length], a[i]) * orient(b[j], b[(j + 1) % b.length], a[(i + 1) % a.length]) < -0.01
      )
        return true;
  // Test interiors, not shared edges. A small inward shift avoids boundary-only warnings.
  const contained = (p, q) => {
    const center = p.reduce((r, v) => [r[0] + v[0] / p.length, r[1] + v[1] / p.length], [0, 0]);
    return p.some((v) => inside([v[0] * 0.999 + center[0] * 0.001, v[1] * 0.999 + center[1] * 0.001], q));
  };
  return contained(a, b) || contained(b, a);
}
export function borderConflicts(plan) {
  const seg = traceTrackPlan(plan).segments,
    shapes = borderShapes(plan, seg);
  if (!shapes.length) return [];
  const box = (p) => [
    Math.min(...p.map((v) => v[0])),
    Math.min(...p.map((v) => v[1])),
    Math.max(...p.map((v) => v[0])),
    Math.max(...p.map((v) => v[1])),
  ];
  // Tiny overlaps at physically adjusted rail joints are construction tolerance,
  // not a collision between unrelated sections. End caps remain checked.
  function joined(a, b) {
    const x = seg[a],
      y = seg[b],
      dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y),
      turn = (p, q) => Math.abs(((p.h - q.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return (
      (dist(x.end, y.start) <= 2 && turn(x.end, y.start) <= Math.PI / 180) ||
      (dist(y.end, x.start) <= 2 && turn(y.end, x.start) <= Math.PI / 180)
    );
  }
  const base = [
    ...seg.map((s) => ({ index: s.index, level: s.level, points: roadPolygon(s) })),
    ...pitRoadPolygons(plan, seg).map((points) => ({ index: plan.pit.entry, level: 0, pit: true, points })),
  ];
  const entries = [...base, ...shapes].map((s) => ({ ...s, box: box(s.points) })),
    bins = new Map(),
    issues = [];
  function cells(b) {
    const keys = [];
    for (let x = Math.floor(b[0] / 500); x <= Math.floor(b[2] / 500); x++)
      for (let y = Math.floor(b[1] / 500); y <= Math.floor(b[3] / 500); y++) keys.push(`${x}:${y}`);
    return keys;
  }
  entries.forEach((e, i) => {
    for (const key of cells(e.box)) {
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(i);
    }
  });
  for (let i = base.length; i < entries.length; i++) {
    const a = entries[i],
      near = new Set(cells(a.box).flatMap((k) => bins.get(k) || []));
    for (const j of near) {
      if (j >= i && j >= base.length) continue;
      const b = entries[j];
      if (
        a.index === b.index ||
        a.level !== b.level ||
        a.box[0] >= b.box[2] - 0.01 ||
        b.box[0] >= a.box[2] - 0.01 ||
        a.box[1] >= b.box[3] - 0.01 ||
        b.box[1] >= a.box[3] - 0.01
      )
        continue;
      if (!b.pit && a.kind === 'strip' && (!b.kind || b.kind === 'strip') && joined(a.index, b.index)) continue;
      if (overlap(a.points, b.points))
        issues.push({ border: a.index, other: b.index, ...(b.pit ? { otherPit: true } : {}) });
    }
  }
  return [...new Map(issues.map((v) => [`${Math.min(v.border, v.other)}:${Math.max(v.border, v.other)}`, v])).values()];
}
