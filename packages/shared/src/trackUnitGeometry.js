// Original vector illustration geometry, nominal mm. Housing outlines are
// conservative planner approximations, not certified factory measurements.
export function unitHousingPolygon(segment) {
  const spec =
    segment.type === 'Control_unit'
      ? [0, -238, 345, -99]
      : segment.type === 'AdapterUnit'
        ? [75, -157, 270, -99]
        : null;
  if (!spec) return [];
  const [x0, y0, x1, y1] = spec,
    h = segment.start.h,
    c = Math.cos(h),
    s = Math.sin(h);
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ].map(([x, y]) => [segment.start.x + c * x - s * y, segment.start.y + s * x + c * y]);
}
export function switchGuidePaths(segment, profile = 'planner2022') {
  const type = segment.type,
    h = segment.start.h,
    c = Math.cos(h),
    s = Math.sin(h),
    world = ([x, y]) => [segment.start.x + c * x - s * y, segment.start.y + s * x + c * y];
  const single = /^Weiche_(links|rechts)_(1|2)$/.exec(type);
  if (single) {
    const n = single[1] === 'links' ? 1 : -1;
    return [
      (single[2] === '1'
        ? [
            [189.75, n * 49.5],
            [345, n * 9.9],
          ]
        : [
            [0, n * 9.9],
            [232.87, -n * 49.5],
          ]
      ).map(world),
    ];
  }
  const curved = /^Kurvenweiche_(links|rechts)_(ai|ia)_(1|2)$/.exec(type);
  if (curved && !(curved[1] === 'rechts' && curved[2] === 'ai')) {
    const local = switchGuidePaths(
        { type: `Kurvenweiche_rechts_ai_${curved[3]}`, start: { x: 0, y: 0, h: 0 } },
        profile
      )[0],
      r = profile === 'prototype' ? 297 : 299;
    return [
      local.map(([x, y]) => {
        if (curved[2] === 'ia') {
          if (curved[3] === '1') y = -y;
          else {
            const d = Math.hypot(x, y - r),
              f = (2 * r - d) / d;
            x *= f;
            y = r + (y - r) * f;
          }
        }
        return world([x, curved[1] === 'links' ? -y : y]);
      }),
    ];
  }
  if (type === 'DigitaleDoppelweiche_1')
    return [-1, 1].map((n) =>
      [
        [189.75, n * 49.5],
        [345, n * 9.9],
      ].map(world)
    );
  if (type === 'DigitaleDoppelweiche_2')
    return [-1, 1].map((n) =>
      [
        [0, n * 9.9],
        [232.87, -n * 49.5],
      ].map(world)
    );
  if (type === 'Kurvenweiche_rechts_ai_1')
    return [
      [
        [189.75, -49.5],
        [345, -9.9],
      ].map(world),
    ];
  if (type === 'Kurvenweiche_rechts_ai_2') {
    const r = profile === 'prototype' ? 297 : 299,
      phi = h + Math.PI / 6,
      center = { x: segment.start.x - Math.sin(h) * r, y: segment.start.y + Math.cos(h) * r },
      outer = r + 9.9,
      inner = r - 49.5;
    const q = [
      [-outer * 0.5, -outer * Math.cos(Math.PI / 6)],
      [(-44.25823056765408 * r) / 297, (-293.683858982785 * r) / 297],
      [(-20 * r) / 297, (-275 * r) / 297],
      [inner * Math.sin(Math.PI / 10), -inner * Math.cos(Math.PI / 10)],
    ];
    return [
      Array.from({ length: 33 }, (_, i) => {
        const t = i / 32,
          g = 1 - t,
          x = g * g * g * q[0][0] + 3 * g * g * t * q[1][0] + 3 * g * t * t * q[2][0] + t * t * t * q[3][0],
          y = g * g * g * q[0][1] + 3 * g * g * t * q[1][1] + 3 * g * t * t * q[2][1] + t * t * t * q[3][1];
        return [center.x + Math.cos(phi) * x - Math.sin(phi) * y, center.y + Math.sin(phi) * x + Math.cos(phi) * y];
      }),
    ];
  }
  return [];
}
// Resolve one FUEL position per parallel bay in the native double-box model.
// Rendering and material counts must use this same assignment. Native SBP uses
// a generic single-lane item: this is a model interpretation, not a guarantee
// that every imported single-lane rail physically contains a fuel sensor.
export function nativeFuelBayIndices(plan, segments) {
  if (!plan.pit.native || !plan.pit.enabled) return [];
  const singles = (plan.trackExtras || [])
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.kind === 'single' && !e.hidden);
  const pose = (e) => {
    const p = e.placement,
      a = segments[e.anchor]?.start;
    if (e.anchor === undefined) return { x: p.xMm, y: p.yMm, h: (p.headingDegrees * Math.PI) / 180 };
    return {
      x: a.x + Math.cos(a.h) * p.xMm - Math.sin(a.h) * p.yMm,
      y: a.y + Math.sin(a.h) * p.xMm + Math.cos(a.h) * p.yMm,
      h: a.h + (p.headingDegrees * Math.PI) / 180,
    };
  };
  const pairs = [];
  for (let i = 0; i < singles.length; i++)
    for (let j = i + 1; j < singles.length; j++) {
      const a = pose(singles[i].e),
        b = pose(singles[j].e),
        dx = b.x - a.x,
        dy = b.y - a.y;
      if (
        Math.abs(dx * Math.cos(a.h) + dy * Math.sin(a.h)) < 1 &&
        Math.abs(Math.abs(-dx * Math.sin(a.h) + dy * Math.cos(a.h)) - 99) < 1 &&
        Math.abs(Math.sin(a.h - b.h)) < 0.01
      )
        pairs.push([singles[i].i, singles[j].i]);
    }
  if (!pairs.length) return [];
  return pairs[Math.floor((pairs.length - 1) / 2)];
}
