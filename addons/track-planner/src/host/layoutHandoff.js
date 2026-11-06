import { readTrackPlan, traceTrackPlan } from '@racehubos/shared'

// A planner-owned proposal for exchanging a completed layout. No claim that a
// RaceHubOS release consumes it; the maintainer's plugin contract is pending.
export function createLayoutHandoff(input, { name = '', sectors = [] } = {}) {
  const plan = readTrackPlan(input)
  if (!plan || typeof name !== 'string' || name.length > 150 || !Array.isArray(sectors) || sectors.length > 100)
    throw new Error('Invalid layout handoff')
  const trace = traceTrackPlan(plan),
    ids = new Set()
  return {
    schema: 'carrera-track-layout/v1',
    name,
    plan,
    geometry: {
      units: 'mm',
      laneLengthsM: trace.laneLengthsM,
      rails: trace.segments.map((s) => ({
        index: s.index,
        type: s.type,
        level: s.level,
        start: { xMm: s.start.x, yMm: s.start.y, headingDegrees: (s.start.h * 180) / Math.PI },
        end: { xMm: s.end.x, yMm: s.end.y, headingDegrees: (s.end.h * 180) / Math.PI },
      })),
    },
    sectors: sectors.map((s) => {
      if (
        !s ||
        typeof s.id !== 'string' ||
        !s.id.length ||
        s.id.length > 80 ||
        ids.has(s.id) ||
        typeof s.label !== 'string' ||
        s.label.length > 150 ||
        !Number.isInteger(s.railIndex) ||
        !trace.segments[s.railIndex] ||
        ![0, 1].includes(s.end)
      )
        throw new Error('Invalid sector anchor')
      ids.add(s.id)
      const p = trace.segments[s.railIndex][s.end ? 'end' : 'start']
      return {
        id: s.id,
        label: s.label,
        railIndex: s.railIndex,
        end: s.end,
        position: { xMm: p.x, yMm: p.y, headingDegrees: (p.h * 180) / Math.PI },
      }
    }),
  }
}
