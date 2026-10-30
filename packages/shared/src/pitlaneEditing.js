import { validateTrackPlan, traceTrackPlan } from './trackPlan.js';
import { extraWorldPose } from './softyExtraGeometry.js';
const pitKinds = { Pit_stop_weiche_anfang: 'pitEntry', Pit_stop_weiche_ende: 'pitExit' };
// Auxiliary SBP rails are separate pieces, even though they follow a carrier
// for movement. Replacing one must not replace the two-lane carrier beside it.
export function replacePitlaneSwitch(input, extraIndex, type) {
  const plan = validateTrackPlan(input),
    extra = plan.trackExtras?.[extraIndex],
    kind = pitKinds[type];
  if (!extra || !['pitEntry', 'pitExit'].includes(extra.kind) || !kind)
    throw new Error('Select a pitlane switch and a compatible pitlane replacement');
  if (plan.partGroups?.groups.some((g) => g.includes(extra.anchor))) throw new Error('Release the combination first');
  const segment = traceTrackPlan(plan).segments[extra.anchor],
    pose = extraWorldPose(extra, traceTrackPlan(plan).segments),
    a = segment?.start;
  const carrierSwitch =
    a &&
    Math.hypot(
      pose.xMm - (a.x + Math.cos(a.h) * 172.5 - Math.sin(a.h) * 99),
      pose.yMm - (a.y + Math.sin(a.h) * 172.5 + Math.cos(a.h) * 99)
    ) < 1;
  const pieces = plan.pieces.map((p, i) =>
    carrierSwitch &&
    i === extra.anchor &&
    ['entry', 'merge'].some((key) => plan.pit[key] === i) &&
    p.type.startsWith('Pit_stop_weiche_')
      ? { ...p, type }
      : p
  );
  return validateTrackPlan({
    ...plan,
    pieces,
    trackExtras: plan.trackExtras.map((e, i) => (i === extraIndex ? { ...e, kind } : e)),
  });
}
export function rotatePitlaneSwitch(input, extraIndex) {
  const plan = validateTrackPlan(input),
    extra = plan.trackExtras?.[extraIndex];
  if (!extra || !['pitEntry', 'pitExit'].includes(extra.kind)) throw new Error('Select a native pitlane switch');
  if (plan.partGroups?.groups.some((g) => g.includes(extra.anchor))) throw new Error('Release the combination first');
  return validateTrackPlan({
    ...plan,
    trackExtras: plan.trackExtras.map((e, i) =>
      i === extraIndex
        ? { ...e, placement: { ...e.placement, headingDegrees: ((e.placement.headingDegrees + 360) % 360) - 180 } }
        : e
    ),
  });
}
// Expand only the legacy schematic box; the traced main circuit is untouched.
export function editablePitlane(input) {
  const plan = validateTrackPlan(input);
  if (plan.pit.native || !plan.pit.enabled) return { plan, ids: {} };
  const p = plan.pit,
    split = 345 + p.spacingMm,
    end = split + p.bayLengthMm,
    n = p.bayLengthMm / 345;
  if (p.spacingMm % 345 || p.bayLengthMm % 345 || n < 3) throw new Error('Pitlane requires standard 345 mm modules');
  const extras = [...(plan.trackExtras || [])],
    ids = {},
    segments = traceTrackPlan(plan).segments,
    a = segments[p.entry].start;
  const add = (id, kind, u, v, anchor = p.entry) => {
    const b = segments[anchor].start,
      x = a.x + Math.cos(a.h) * u - Math.sin(a.h) * v - b.x,
      y = a.y + Math.sin(a.h) * u + Math.cos(a.h) * v - b.y;
    ids[id] = extras.length;
    extras.push({
      kind,
      anchor,
      placement: {
        xMm: Math.cos(b.h) * x + Math.sin(b.h) * y,
        yMm: -Math.sin(b.h) * x + Math.cos(b.h) * y,
        headingDegrees: ((((a.h - b.h) * 180) / Math.PI + (kind === 'single' ? 0 : 180) + 540) % 360) - 180,
      },
      level: segments[anchor].level,
      paintOrder: Math.min(12000, (plan.pieces[anchor].paintOrder ?? anchor * 2) + 1),
    });
  };
  for (let i = 0; i < p.spacingMm / 345; i++) add(`pit-common-${i}`, 'single', 345 + i * 345 + 172.5, 148.5);
  for (let lane = 0; lane < 2; lane++)
    for (let i = 1; i < n - 1; i++) add(`pit-bay-${lane}-${i}`, 'single', split + i * 345 + 172.5, 148.5 + lane * 99);
  add('pit-entry', 'pitEntry', 172.5, 99);
  add('pit-second-entry', 'pitEntry', split + 172.5, 198);
  add('pit-merge', 'pitExit', end - 172.5, 198);
  const b = segments[p.merge].end,
    ex = (b.x - a.x) * Math.cos(a.h) + (b.y - a.y) * Math.sin(a.h);
  add('pit-exit', 'pitExit', ex - 172.5, 99, p.merge);
  return { plan: validateTrackPlan({ ...plan, trackExtras: extras, pit: { ...p, native: true } }), ids };
}
