// Drawing offsets change SVG stacking only, never physical geometry or lanes.
export const MIN_DRAW_LAYER = -20;
export const MAX_DRAW_LAYER = 20;
export function validateDrawLayer(value) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < MIN_DRAW_LAYER || value > MAX_DRAW_LAYER)
    throw new Error('Invalid drawing layer');
  return value;
}
export function trackDrawItems(plan, segments, shoulders = []) {
  const imported = plan.softyImport?.paintOrder,
    order = (s) => (imported ? (s.paintOrder ?? 12000) : s.index * 2);
  const items = segments.flatMap((s) => [
    ...(s.level > 0 ? [{ ...s, drawKind: 'shadow', drawLayer: s.drawLayer ?? 0, order: order(s), priority: -1 }] : []),
    { ...s, drawKind: 'rail', drawLayer: s.drawLayer ?? 0, order: order(s), priority: 1 },
  ]);
  for (const b of shoulders) {
    const s = segments[b.index];
    items.push({
      ...b,
      drawKind: 'border',
      drawLayer: plan.pieces[b.index].borders?.[b.side]?.drawLayer ?? s.drawLayer ?? 0,
      order: order(s),
      priority: 0,
    });
  }
  for (const [extraIndex, e] of (plan.trackExtras || []).entries())
    if (!e.hidden) {
      const a = segments[e.anchor],
        border = !['single', 'pitEntry', 'pitExit'].includes(e.kind);
      items.push({
        ...e,
        extra: true,
        extraIndex,
        drawKind: 'extra',
        level: a?.level ?? e.level,
        drawLayer: e.drawLayer ?? a?.drawLayer ?? 0,
        order: e.paintOrder ?? 12000,
        priority: border ? 0 : 1,
      });
    }
  if (plan.pit.enabled && !plan.pit.native)
    items.push({ drawKind: 'schematic', level: 0, drawLayer: plan.pit.drawLayer ?? 0, order: 12001, priority: 1 });
  return items.sort(
    (a, b) => a.level + a.drawLayer - (b.level + b.drawLayer) || a.order - b.order || a.priority - b.priority
  );
}
export function changeTrackDrawLayer(plan, { indices = [], target = 'rails', extraIndex } = {}, delta) {
  if (delta !== null && ![1, -1].includes(delta)) throw new Error('Invalid drawing step');
  const step = (object, inherited = 0) => {
    const next = { ...object };
    if (delta === null) delete next.drawLayer;
    else next.drawLayer = Math.max(MIN_DRAW_LAYER, Math.min(MAX_DRAW_LAYER, (object.drawLayer ?? inherited) + delta));
    return next;
  };
  if (target === 'extra') {
    const e = plan.trackExtras?.[extraIndex];
    if (!e) throw new Error('Invalid extra selection');
    return {
      ...plan,
      trackExtras: plan.trackExtras.map((p, i) =>
        i === extraIndex ? step(p, plan.pieces[p.anchor]?.drawLayer ?? 0) : p
      ),
    };
  }
  if (target === 'pit') return { ...plan, pit: step(plan.pit) };
  if (!['rails', 'left', 'right', 'borders'].includes(target)) throw new Error('Invalid drawing target');
  const selected = new Set(indices);
  return {
    ...plan,
    pieces: plan.pieces.map((p, i) => {
      if (!selected.has(i)) return p;
      if (target === 'rails') return step(p);
      if (!p.borders) return p;
      const borders = { ...p.borders };
      for (const side of ['left', 'right'])
        if ((target === 'borders' || target === side) && borders[side])
          borders[side] = step(borders[side], p.drawLayer ?? 0);
      return { ...p, borders };
    }),
  };
}
