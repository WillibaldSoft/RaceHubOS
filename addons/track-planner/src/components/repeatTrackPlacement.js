import {
  emptyTrackPlan,
  enableFreePlacement,
  traceTrackPlan,
  analyseTrackConnections,
  transformFreeParts,
  editFreeParts,
  validateTrackPlan,
} from '@racehubos/shared'
const degrees = (a) => ((((a + 180) % 360) + 360) % 360) - 180
export function repeatedTrackPreview(
  input,
  types,
  point,
  { headingDegrees = 0, level = 0, snap = true, distanceMm = 55 } = {}
) {
  if (!point || !types.length || input.pieces.length + types.length > 2000) return null
  const trace = traceTrackPlan(input)
  const ports = snap ? analyseTrackConnections(trace.segments).openPorts.filter((p) => p.level === level) : []
  const nearest = ports
    .map((p) => ({ ...p, distance: Math.hypot(p.x - point.x, p.y - point.y) }))
    .filter((p) => p.distance <= distanceMm)
    .sort((a, b) => a.distance - b.distance)[0]
  const pose = {
    xMm: nearest?.x ?? point.x,
    yMm: nearest?.y ?? point.y,
    headingDegrees: degrees(nearest ? (nearest.h * 180) / Math.PI : headingDegrees),
  }
  const local = enableFreePlacement({
    ...emptyTrackPlan(),
    geometryProfile: input.geometryProfile,
    pieces: types.map((type) => ({ type, level, jointDegrees: 0 })),
  })
  const preview = transformFreeParts(
    local,
    local.pieces.map((_, i) => i),
    { degrees: pose.headingDegrees, dx: pose.xMm, dy: pose.yMm }
  )
  const expected = traceTrackPlan(preview).segments
  const occupied = expected.every((p) =>
    trace.segments.some(
      (s) =>
        s.type === p.type &&
        s.level === p.level &&
        Math.hypot(s.start.x - p.start.x, s.start.y - p.start.y) < 1 &&
        Math.abs(degrees(((s.start.h - p.start.h) * 180) / Math.PI)) < 1
    )
  )
  return { plan: preview, pose, level, occupied, snapped: !!nearest }
}
export function placeRepeatedTrackPart(input, types, preview) {
  if (!preview || preview.occupied || input.pieces.length + types.length > 2000)
    return { plan: input, selected: -1, placed: false }
  const offset = input.pieces.length
  const result = editFreeParts(input, -1, 'after', types, preview.pose)
  return {
    ...result,
    placed: true,
    plan: validateTrackPlan({
      ...result.plan,
      pieces: result.plan.pieces.map((p, i) => (i >= offset ? { ...p, level: preview.level } : p)),
    }),
  }
}
