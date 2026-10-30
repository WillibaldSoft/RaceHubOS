import { SOFTY_EXTRAS } from './softyNativeCatalog.js';
const rad = (a) => (a * Math.PI) / 180;
const cubic = (a, b, c, d) =>
  Array.from({ length: 33 }, (_, i) => {
    const t = i / 32,
      g = 1 - t;
    return [
      g * g * g * a[0] + 3 * g * g * t * b[0] + 3 * g * t * t * c[0] + t * t * t * d[0],
      g * g * g * a[1] + 3 * g * g * t * b[1] + 3 * g * t * t * c[1] + t * t * t * d[1],
    ];
  });
export function extraWorldPose(extra, segments) {
  const p = extra.placement,
    a = segments[extra.anchor]?.start;
  if (extra.anchor === undefined || !a) return { ...p };
  const c = Math.cos(a.h),
    s = Math.sin(a.h);
  return {
    xMm: a.x + c * p.xMm - s * p.yMm,
    yMm: a.y + s * p.xMm + c * p.yMm,
    headingDegrees: p.headingDegrees + (a.h * 180) / Math.PI,
  };
}
export function softyExtraGeometry(extra, segments = []) {
  const spec = SOFTY_EXTRAS[extra.kind],
    pose = extraWorldPose(extra, segments),
    h = rad(pose.headingDegrees),
    c = Math.cos(h),
    s = Math.sin(h),
    world = ([x, y]) => [pose.xMm + c * x - s * y, pose.yMm + s * x + c * y];
  let polygon = [],
    slots = [];
  if (extra.kind === 'single') {
    polygon = [
      [-172.5, -49.5],
      [172.5, -49.5],
      [172.5, 49.5],
      [-172.5, 49.5],
    ];
    slots = [
      [
        [-172.5, 0],
        [172.5, 0],
      ],
    ];
  } else if (extra.kind === 'pitEntry') {
    polygon = [[-172.5, 99], [-172.5, -99], ...cubic([-172.5, -99], [0, -99], [0, 0], [172.5, 0]), [172.5, 99]];
    slots = [
      [
        [-172.5, 49.5],
        [172.5, 49.5],
      ],
      cubic([-172.5, -49.5], [0, -49.5], [0, 49.5], [172.5, 49.5]),
    ];
  } else if (extra.kind === 'pitExit') {
    polygon = [[-172.5, 99], [-172.5, 0], ...cubic([-172.5, 0], [0, 0], [0, -99], [172.5, -99]), [172.5, 99]];
    slots = [
      [
        [-172.5, 49.5],
        [172.5, 49.5],
      ],
      cubic([-172.5, 49.5], [0, 49.5], [0, -49.5], [172.5, -49.5]),
    ];
  } else if (spec.length) {
    const l = spec.length / 2;
    polygon = [
      [-l, -49.5],
      [l, -49.5],
      [l, 49.5],
      [-l, 49.5],
    ];
  } else if (spec.radius) {
    const r = spec.radius,
      offset = spec.outside ? 99 : -198,
      a = rad(spec.angle),
      arc = (n) =>
        Array.from({ length: 33 }, (_, i) => {
          const t = -a / 2 + (a * i) / 32;
          return [(r + n) * Math.sin(t), -(r + n) * Math.cos(t)];
        });
    polygon = [...arc(offset), ...arc(offset + 99).reverse()];
  } else if (spec.end) {
    const d = spec.end;
    polygon = [[0, 0], [0, -99], ...cubic([0, -99], [110.8 * d, -99], [138.5 * d, -16.5], [138.5 * d, 0])];
  } else if (extra.kind === 'pitBorderEntry') {
    polygon = [
      ...cubic([-172.5, -99], [0, -99], [0, 0], [172.5, 0]),
      ...cubic([172.5, 99], [0, 99], [0, 0], [-172.5, 0]),
    ];
  } else if (extra.kind === 'pitBorderExit') {
    polygon = [
      ...cubic([-172.5, 0], [0, 0], [0, -100], [172.5, -99]),
      ...cubic([172.5, 0], [0, 0], [0, 100], [-172.5, 99]),
    ];
  }
  return {
    polygon: polygon.map(world),
    slots: slots.map((p) => p.map(world)),
    border: !['single', 'pitEntry', 'pitExit'].includes(extra.kind),
    article: spec.article,
    pose,
  };
}
export function nativeExtraPoints(plan, segments) {
  return (plan.trackExtras || []).filter((e) => !e.hidden).flatMap((e) => softyExtraGeometry(e, segments).polygon);
}
