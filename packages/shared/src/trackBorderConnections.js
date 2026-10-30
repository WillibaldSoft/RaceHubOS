import { traceTrackPlan } from './trackPlan.js';
import { BORDER_WIDTH_MM } from './trackBorders.js';
const angle = (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
// Match the actual shoulder band, not the rail's array order. Reversed rails
// can therefore continue a left shoulder with a right shoulder.
export function borderEndConnections(plan) {
  const segments = traceTrackPlan(plan).segments,
    ports = [];
  for (const s of segments)
    for (const side of ['left', 'right'])
      if (s.borders?.[side])
        for (const [key, end] of [
          ['startCap', s.start],
          ['endCap', s.end],
        ]) {
          const offset = (99 + BORDER_WIDTH_MM / 2) * (side === 'left' ? -1 : 1);
          ports.push({
            index: s.index,
            side,
            key,
            level: s.level,
            x: end.x - Math.sin(end.h) * offset,
            y: end.y + Math.cos(end.h) * offset,
            h: end.h + (key === 'startCap' ? Math.PI : 0),
          });
        }
  const bins = new Map(),
    size = 3;
  ports.forEach((p, i) => {
    const k = `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(i);
  });
  return ports.map((p) => {
    let connected = false;
    const x = Math.floor(p.x / size),
      y = Math.floor(p.y / size);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of bins.get(`${x + dx}:${y + dy}`) || []) {
          const q = ports[i];
          // Sequential legacy plans describe ramp bands by paint level. Their
          // adjoining end/start ports remain continuous across a band transition.
          const adjacent =
            !plan.freePlacement &&
            ((p.key === 'endCap' && q.key === 'startCap' && (p.index + 1) % segments.length === q.index) ||
              (q.key === 'endCap' && p.key === 'startCap' && (q.index + 1) % segments.length === p.index));
          if (
            p.index !== q.index &&
            (p.level === q.level || adjacent) &&
            Math.hypot(p.x - q.x, p.y - q.y) <= 2 &&
            Math.abs(angle(p.h - q.h - Math.PI)) <= Math.PI / 180
          )
            connected = true;
        }
    return { ...p, connected };
  });
}
export function setFreeBorderEnds(plan, indices, { side = null, edge = null, enabled = true } = {}) {
  const selected = new Set(indices),
    connections = new Map(borderEndConnections(plan).map((p) => [`${p.index}:${p.side}:${p.key}`, p.connected]));
  return {
    ...plan,
    pieces: plan.pieces.map((p, i) => {
      if (!selected.has(i) || !p.borders) return p;
      const borders = { ...p.borders };
      for (const s of ['left', 'right'])
        if ((!side || side === s) && borders[s]) {
          const next = { ...borders[s] };
          for (const key of ['startCap', 'endCap']) {
            const joined = connections.get(`${i}:${s}:${key}`);
            if (!edge || key === edge || joined) next[key] = enabled && !joined && !p.type.startsWith('Steilkurve_');
          }
          borders[s] = next;
        }
      return { ...p, borders };
    }),
  };
}
