const angle = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
export function trackPorts(segments) {
  return segments.flatMap((s) => [
    { index: s.index, end: 0, x: s.start.x, y: s.start.y, h: s.start.h + Math.PI, level: s.level },
    { index: s.index, end: 1, x: s.end.x, y: s.end.y, h: s.end.h, level: s.level },
  ]);
}
// Levels are drawing/ramp bands, not surveyed endpoint heights. Existing
// ramp transitions may meet across bands; interactive snapping separately
// requires the same band to avoid attracting an elevated rail while dragging.
export function compatiblePorts(a, b, tolerance = 1) {
  return (
    a.index !== b.index &&
    Math.hypot(a.x - b.x, a.y - b.y) <= tolerance &&
    Math.abs(angle(a.h - b.h - Math.PI)) <= (Math.PI / 180) * 1.01
  );
}
export function analyseTrackConnections(segments) {
  const ports = trackPorts(segments),
    bins = new Map(),
    matches = ports.map(() => []);
  ports.forEach((p, i) => {
    const key = `${Math.floor(p.x)},${Math.floor(p.y)}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(i);
  });
  ports.forEach((p, i) => {
    const x = Math.floor(p.x),
      y = Math.floor(p.y);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of bins.get(`${x + dx},${y + dy}`) || []) if (compatiblePorts(p, ports[j])) matches[i].push(j);
  });
  const links = matches.map((m, i) => (m.length === 1 && matches[m[0]].length === 1 ? m[0] : -1));
  const openPorts = links.flatMap((n, i) => (n < 0 ? [ports[i]] : [])),
    route = [],
    visited = new Set();
  let current = 0,
    enter = 0;
  while (segments.length && !visited.has(current)) {
    visited.add(current);
    route.push({ index: current, reverse: enter === 1 });
    const next = links[current * 2 + (enter === 0 ? 1 : 0)];
    if (next < 0) break;
    current = ports[next].index;
    enter = ports[next].end;
  }
  const componentsVisited = new Set();
  let components = 0;
  for (let i = 0; i < segments.length; i++)
    if (!componentsVisited.has(i)) {
      components++;
      const todo = [i];
      while (todo.length) {
        const j = todo.pop();
        if (componentsVisited.has(j)) continue;
        componentsVisited.add(j);
        for (const port of [j * 2, j * 2 + 1]) if (links[port] >= 0) todo.push(ports[links[port]].index);
      }
    }
  const closed =
    segments.length > 0 && !openPorts.length && visited.size === segments.length && current === 0 && enter === 0;
  return { closed, components, openPorts, ambiguousPorts: matches.filter((m) => m.length > 1).length, route, links };
}
