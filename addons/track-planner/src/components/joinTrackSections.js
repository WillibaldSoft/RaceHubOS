import {
  enableFreePlacement,
  traceTrackPlan,
  analyseTrackConnections,
  trackPorts,
  compatiblePorts,
  freeTrackSelection,
  transformFreeParts,
} from '@racehubos/shared'
const degrees = (a) => ((((a + 180) % 360) + 360) % 360) - 180

export function trackSectionJoinOptions(input, indices) {
  const selected = [...new Set(indices)].filter((i) => input.pieces[i])
  if (selected.length < 2) return { reason: 'selectTwo', pairs: [] }
  const plan = enableFreePlacement(input),
    segments = traceTrackPlan(plan).segments
  const graph = analyseTrackConnections(segments)
  function section(start) {
    const visited = new Set(),
      todo = [start]
    while (todo.length) {
      const i = todo.pop()
      if (visited.has(i)) continue
      visited.add(i)
      for (const end of [0, 1]) {
        const port = graph.links[i * 2 + end]
        if (port >= 0) todo.push(Math.floor(port / 2))
      }
      // Preserve whole movement groups and attached pit/catalogue assemblies.
      for (const j of freeTrackSelection(plan, i)) if (!visited.has(j)) todo.push(j)
    }
    return visited
  }
  const fixed = section(selected[0]),
    second = selected.find((i) => !fixed.has(i))
  if (second === undefined) return { reason: 'sameSection', pairs: [] }
  const moving = section(second)
  if ([...moving].some((i) => fixed.has(i))) return { reason: 'sameSection', pairs: [] }
  if (selected.some((i) => !fixed.has(i) && !moving.has(i))) return { reason: 'selectTwo', pairs: [] }
  const allPorts = trackPorts(segments)
  // Ambiguously coincident ports are not free connection targets.
  const open = graph.openPorts.filter((p) => !allPorts.some((q) => compatiblePorts(p, q)))
  const a = open.filter((p) => fixed.has(p.index)),
    b = open.filter((p) => moving.has(p.index))
  if (!a.length || !b.length) return { reason: 'noOpenPorts', pairs: [] }
  const pairs = a
    .flatMap((fixedPort) =>
      b
        .filter((p) => p.level === fixedPort.level)
        .map((movingPort) => ({
          key: `${fixedPort.index}:${fixedPort.end}/${movingPort.index}:${movingPort.end}`,
          fixed: fixedPort,
          moving: movingPort,
          distanceMm: Math.hypot(fixedPort.x - movingPort.x, fixedPort.y - movingPort.y),
          rotation: degrees(((fixedPort.h + Math.PI - movingPort.h) * 180) / Math.PI),
        }))
    )
    .sort(
      (p, q) => p.distanceMm - q.distanceMm || Math.abs(p.rotation) - Math.abs(q.rotation) || p.key.localeCompare(q.key)
    )
  return { reason: pairs.length ? null : 'differentLevels', pairs, fixed: [...fixed], moving: [...moving] }
}

export function joinTrackSections(input, indices, key = null) {
  const options = trackSectionJoinOptions(input, indices)
  const pair = key === null ? options.pairs[0] : options.pairs.find((p) => p.key === key)
  if (!pair) throw new Error(options.reason || 'Invalid connection pair')
  const plan = transformFreeParts(input, options.moving, {
    degrees: pair.rotation,
    pivotX: pair.moving.x,
    pivotY: pair.moving.y,
    dx: pair.fixed.x - pair.moving.x,
    dy: pair.fixed.y - pair.moving.y,
  })
  const ports = trackPorts(traceTrackPlan(plan).segments)
  if (!compatiblePorts(ports[pair.fixed.index * 2 + pair.fixed.end], ports[pair.moving.index * 2 + pair.moving.end]))
    throw new Error('Connection could not be aligned')
  return { plan, pair, fixed: options.fixed, moving: options.moving }
}
