import { assemblySelection } from './trackAssemblies.js';
import { traceTrackPlan, validateTrackPlan } from './trackPlan.js';
import { trackSelection, editTrackPieces } from './trackEditing.js';
import { trackPorts, compatiblePorts } from './trackConnections.js';
const degrees = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
export function enableFreePlacement(input) {
  const plan = validateTrackPlan(input);
  if (plan.freePlacement) return plan;
  const segments = traceTrackPlan(plan).segments;
  return {
    ...plan,
    freePlacement: true,
    pieces: plan.pieces.map((p, i) => ({
      ...p,
      placement: {
        xMm: segments[i].start.x,
        yMm: segments[i].start.y,
        headingDegrees: degrees((segments[i].start.h * 180) / Math.PI),
      },
    })),
  };
}
export const freeTrackSelection = assemblySelection;
export function transformFreeParts(input, indices, { dx = 0, dy = 0, degrees: turn = 0, pivotX = 0, pivotY = 0 }) {
  const plan = enableFreePlacement(input),
    set = new Set(indices),
    r = (turn * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return validateTrackPlan({
    ...plan,
    ...(plan.trackExtras && set.size === plan.pieces.length
      ? {
          trackExtras: plan.trackExtras.map((e) => {
            if (e.anchor !== undefined) return e;
            const q = e.placement,
              x = q.xMm - pivotX,
              y = q.yMm - pivotY;
            return {
              ...e,
              placement: {
                xMm: pivotX + c * x - s * y + dx,
                yMm: pivotY + s * x + c * y + dy,
                headingDegrees: degrees(q.headingDegrees + turn),
              },
            };
          }),
        }
      : {}),
    measuredLaneLengthsM: null,
    pieces: plan.pieces.map((p, i) => {
      if (!set.has(i)) return p;
      const q = p.placement,
        x = q.xMm - pivotX,
        y = q.yMm - pivotY;
      return {
        ...p,
        placement: {
          xMm: pivotX + c * x - s * y + dx,
          yMm: pivotY + s * x + c * y + dy,
          headingDegrees: degrees(q.headingDegrees + turn),
        },
      };
    }),
  });
}
export function snapFreeParts(input, indices, { distanceMm = 55, angleDegrees = 30 } = {}) {
  const plan = enableFreePlacement(input),
    ports = trackPorts(traceTrackPlan(plan).segments),
    set = new Set(indices),
    moving = ports.filter((p) => set.has(p.index)),
    fixed = ports.filter((p) => !set.has(p.index));
  const boundary = (p, all) => !all.some((q) => compatiblePorts(p, q));
  const movingEnds = moving.filter((p) => boundary(p, moving)),
    fixedEnds = fixed.filter((p) => boundary(p, fixed));
  let best = null;
  for (const a of movingEnds)
    for (const b of fixedEnds) {
      const d = Math.hypot(a.x - b.x, a.y - b.y),
        rotation = degrees(((b.h + Math.PI - a.h) * 180) / Math.PI);
      if (
        a.level === b.level &&
        d <= distanceMm &&
        Math.abs(rotation) <= angleDegrees &&
        (!best || d < best.distanceMm)
      )
        best = { a, b, distanceMm: d, rotation };
    }
  if (!best) return { plan, snap: null };
  return {
    plan: transformFreeParts(plan, indices, {
      degrees: best.rotation,
      pivotX: best.a.x,
      pivotY: best.a.y,
      dx: best.b.x - best.a.x,
      dy: best.b.y - best.a.y,
    }),
    snap: { ...best.b },
  };
}
export function editFreeParts(input, index, action, types = [], position = null) {
  const plan = enableFreePlacement(input),
    selection = trackSelection(plan, index),
    segments = traceTrackPlan(plan).segments;
  const anchor =
    action === 'before'
      ? segments[selection[0]]?.start
      : action === 'replace'
        ? segments[selection[0]]?.start
        : (segments[selection.at(-1)]?.end ?? segments.at(-1)?.end);
  // Reuse the proven index/pit remapping on a temporary sequential copy.
  const sequential = {
    ...plan,
    freePlacement: false,
    pieces: plan.pieces.map(({ placement, ...p }) => {
      void placement;
      return p;
    }),
  };
  const edit = editTrackPieces(sequential, index, action, types),
    at = selection.length ? (action === 'after' ? selection.at(-1) + 1 : selection[0]) : plan.pieces.length,
    remove = ['replace', 'delete'].includes(action) ? selection.length : 0;
  const pieces = [...plan.pieces];
  let inserted = [];
  if (action !== 'delete') {
    const local = traceTrackPlan({
      ...sequential,
      partGroups: undefined,
      trackExtras: [],
      pieces: types.map((type) => ({ type, level: plan.pieces[index]?.level ?? 0, jointDegrees: 0 })),
      pit: { ...plan.pit, enabled: false, entry: 0, merge: 0 },
      startHeadingDegrees: position?.headingDegrees ?? (anchor ? degrees((anchor.h * 180) / Math.PI) : 0),
    }).segments;
    const before = action === 'before' && !position ? local.at(-1)?.end : null;
    inserted = local.map((s, i) => ({
      ...edit.plan.pieces[at + i],
      jointDegrees: 0,
      placement: {
        xMm: (position?.xMm ?? anchor?.x ?? 0) + s.start.x - (before?.x ?? 0),
        yMm: (position?.yMm ?? anchor?.y ?? 0) + s.start.y - (before?.y ?? 0),
        headingDegrees: degrees((s.start.h * 180) / Math.PI),
      },
    }));
  }
  pieces.splice(at, remove, ...inserted);
  return {
    plan: validateTrackPlan({ ...edit.plan, freePlacement: true, pieces, measuredLaneLengthsM: null }),
    selected: edit.selected,
  };
}
export function rotateTrackPlan(plan, delta) {
  return plan.freePlacement
    ? {
        ...transformFreeParts(
          plan,
          plan.pieces.map((_, i) => i),
          { degrees: delta }
        ),
        startHeadingDegrees: degrees(plan.startHeadingDegrees + delta),
      }
    : { ...plan, startHeadingDegrees: degrees(plan.startHeadingDegrees + delta) };
}
