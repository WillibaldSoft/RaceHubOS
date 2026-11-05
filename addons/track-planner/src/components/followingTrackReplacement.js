import {
  enableFreePlacement,
  traceTrackPlan,
  trackSelection,
  freeTrackSelection,
  analyseTrackConnections,
  editFreeParts,
  transformFreeParts,
} from '@racehubos/shared'

// Follow physical, unambiguous connections rather than array order. Imported
// layouts may contain unrelated rails or rails traversed in reverse.
export function replaceFollowingTrack(input, index, types, cutAfter = null) {
  const base = enableFreePlacement(input)
  const selection = trackSelection(base, index)
  if (!selection.length || !types.length || base.pieces.length - selection.length + types.length > 2000)
    throw new Error('Invalid replacement')
  const first = selection[0],
    last = selection.at(-1)
  if (base.partGroups?.groups.some((g) => g.some((i) => selection.includes(i))))
    throw new Error('Release the selected movement group before replacement')
  const segments = traceTrackPlan(base).segments
  const { links } = analyseTrackConnections(segments)
  // Catalogue assemblies must still form a continuous forward assembly.
  for (let i = 1; i < selection.length; i++)
    if (links[selection[i - 1] * 2 + 1] !== selection[i] * 2) throw new Error('Disconnected assembly')
  const visited = new Set(selection),
    route = []
  let exit = last * 2 + 1
  while (links[exit] >= 0) {
    const port = links[exit],
      next = Math.floor(port / 2),
      reverse = port % 2 === 1
    if (visited.has(next)) break
    visited.add(next)
    route.push({ index: next, reverse })
    exit = next * 2 + (reverse ? 0 : 1)
  }
  const choices = []
  const positions = new Map(route.map((r, i) => [r.index, i]))
  const blocked = new Int32Array(route.length + 2),
    checked = new Set()
  // Mark invalid cut intervals once per assembly, rather than rechecking each
  // growing prefix. This also keeps large imported plans responsive.
  for (const { index: i } of route) {
    const group = freeTrackSelection(base, i)
    const key = group.join(',')
    if (checked.has(key)) continue
    checked.add(key)
    const present = group.filter((j) => positions.has(j)).map((j) => positions.get(j))
    const from = Math.min(...present) + 1
    const until = present.length === group.length ? Math.max(...present) : route.length
    if (from <= until) {
      blocked[from]++
      blocked[until + 1]--
    }
  }
  let invalid = 0
  for (let n = 0; n <= route.length; n++) {
    invalid += blocked[n]
    if (!invalid) choices.push({ count: n, index: n ? route[n - 1].index : last })
  }
  const count = cutAfter ?? choices.at(-1).count
  if (!choices.some((c) => c.count === count)) throw new Error('Invalid cut point')
  const result = editFreeParts(base, index, 'replace', types)
  const delta = types.length - selection.length
  const remap = (i) => (i < first ? i : i > last ? i + delta : first)
  const before = segments[last].end
  const newSegments = traceTrackPlan(result.plan).segments
  const after = newSegments[first + types.length - 1].end
  const rotation = ((after.h - before.h) * 180) / Math.PI
  const indices = route.slice(0, count).map((r) => remap(r.index))
  const plan = indices.length
    ? transformFreeParts(result.plan, indices, {
        degrees: rotation,
        pivotX: before.x,
        pivotY: before.y,
        dx: after.x - before.x,
        dy: after.y - before.y,
      })
    : result.plan
  const traced = traceTrackPlan(plan).segments
  const tail = count ? route[count - 1] : null
  const boundary = tail ? traced[remap(tail.index)][tail.reverse ? 'start' : 'end'] : after
  const fixed = tail ? segments[tail.index][tail.reverse ? 'start' : 'end'] : before
  const nextPort = tail ? tail.index * 2 + (tail.reverse ? 0 : 1) : last * 2 + 1
  return {
    plan,
    selected: result.selected,
    count,
    choices: choices.map((c) => ({ ...c, index: c.count ? remap(c.index) : first + types.length - 1 })),
    moving: indices,
    boundary,
    fixed,
    hasFixedNeighbour: links[nextPort] >= 0,
  }
}
