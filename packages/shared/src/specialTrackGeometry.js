// Own functional geometry in mm. Engstelle endpoint/slot dimensions checked
// against Carrera instructions and Softyroyal's published Digital system data.
// Chicane internal 33mm spacing and easing are explicit planning approximations;
// Carrera confirms the 3x345mm assembly, not a dimensioned slot centreline.
const bezier = (a, b, c, d, t) => {
  const g = 1 - t;
  return [
    g * g * g * a[0] + 3 * g * g * t * b[0] + 3 * g * t * t * c[0] + t * t * t * d[0],
    g * g * g * a[1] + 3 * g * g * t * b[1] + 3 * g * t * t * c[1] + t * t * t * d[1],
  ];
};
const length = (pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
export function specialTrackGeometry(spec, start) {
  const l = spec.length,
    side = spec.side ?? -1;
  const branch = (x) => {
    const t = x < 345 ? x / 345 : x > 690 ? (1035 - x) / 345 : 1;
    return 49.5 - 66 * t * t * (3 - 2 * t);
  };
  // Sample cubic sections parametrically: x is not linear along a Bezier.
  const curved = (a, b, c, d) => Array.from({ length: 129 }, (_, i) => bezier(a, b, c, d, i / 128));
  let branchPoints;
  if (spec.special === 'narrow')
    branchPoints = [
      ...curved([0, 49.5], [172.5, 49.5], [172.5, 49.5], [345, -16.5]),
      [460, -49.5],
      [920, -49.5],
      [1035, -16.5],
      ...curved([1035, -16.5], [1207.5, 49.5], [1207.5, 49.5], [1380, 49.5]).slice(1),
    ];
  else
    branchPoints = Array.from({ length: 385 }, (_, i) => {
      const x = (l * i) / 384;
      return [x, branch(x)];
    });
  let edgePoints =
    spec.special === 'narrow'
      ? [
          ...curved([0, 99], [172.5, 99], [172.5, 99], [345, 33]),
          ...curved([345, 33], [517.5, 0], [517.5, 0], [690, 0]).slice(1),
          ...curved([690, 0], [862.5, 0], [862.5, 0], [1035, 33]).slice(1),
          ...curved([1035, 33], [1207.5, 99], [1207.5, 99], [1380, 99]).slice(1),
        ]
      : branchPoints.map(([x, y]) => [x, y + 49.5]);
  // Mirror left/right without exchanging endpoint lane identities.
  if (side === 1) {
    branchPoints = branchPoints.map(([x, y]) => [x, -y]);
    edgePoints = edgePoints.map(([x, y]) => [x, -y]);
  }
  const straight = [
      [0, side * 49.5],
      [l, side * 49.5],
    ],
    slots = side === -1 ? [straight, branchPoints] : [branchPoints, straight];
  const polygon =
    side === -1 ? [[0, -99], [l, -99], ...edgePoints.toReversed()] : [[0, 99], [l, 99], ...edgePoints.toReversed()];
  const c = Math.cos(start.h),
    s = Math.sin(start.h),
    world = ([x, y]) => [start.x + c * x - s * y, start.y + s * x + c * y];
  return {
    points: [Array.from({ length: 33 }, (_, i) => world([(l * i) / 32, 0])), ...slots.map((pts) => pts.map(world))],
    roadOutline: polygon.map(world),
    laneLengthsM: slots.map((pts) => length(pts) / 1000),
  };
}
