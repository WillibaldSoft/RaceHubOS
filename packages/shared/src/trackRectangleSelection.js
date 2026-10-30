import { unitHousingPolygon } from './trackUnitGeometry.js';
import { traceTrackPlan } from './trackPlan.js';
import { roadPolygon, borderShapes } from './trackBorderGeometry.js';
import { softyExtraGeometry } from './softyExtraGeometry.js';
// A crossing rectangle selects the physical road or shoulder, including rails
// running in reverse. Bounding boxes alone incorrectly select the hole of a U.
export function trackRectangleSelection(plan, a, b, visibleLevel = null) {
  const minX = Math.min(a.x, b.x),
    maxX = Math.max(a.x, b.x),
    minY = Math.min(a.y, b.y),
    maxY = Math.max(a.y, b.y);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) throw new Error('Invalid selection rectangle');
  const corners = [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ],
    segments = traceTrackPlan(plan).segments;
  const inRect = (p) => p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY;
  const inside = (p, poly) => {
    let yes = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i],
        b = poly[j];
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes;
    }
    return yes;
  };
  const crosses = (a, b, c, d) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      vx = d[0] - c[0],
      vy = d[1] - c[1],
      det = ux * vy - uy * vx;
    if (Math.abs(det) < 1e-9) return false;
    const dx = c[0] - a[0],
      dy = c[1] - a[1],
      t = (dx * vy - dy * vx) / det,
      u = (dx * uy - dy * ux) / det;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  const hit = (poly) => {
    if (
      !poly.length ||
      Math.max(...poly.map((p) => p[0])) < minX ||
      Math.min(...poly.map((p) => p[0])) > maxX ||
      Math.max(...poly.map((p) => p[1])) < minY ||
      Math.min(...poly.map((p) => p[1])) > maxY
    )
      return false;
    if (poly.some(inRect) || corners.some((p) => inside(p, poly))) return true;
    return poly.some((p, i) =>
      corners.some((c, j) => crosses(p, poly[(i + 1) % poly.length], c, corners[(j + 1) % 4]))
    );
  };
  const found = new Set(),
    visible = (s) => visibleLevel === null || s.level === visibleLevel;
  for (const s of segments) if (visible(s) && (hit(roadPolygon(s)) || hit(unitHousingPolygon(s)))) found.add(s.index);
  for (const b of borderShapes(plan, segments)) if (visible(b) && hit(b.points)) found.add(b.index);
  for (const e of plan.trackExtras || [])
    if (
      !e.hidden &&
      e.anchor !== undefined &&
      visible(segments[e.anchor]) &&
      hit(softyExtraGeometry(e, segments).polygon)
    )
      found.add(e.anchor);
  return [...found].sort((a, b) => a - b);
}
