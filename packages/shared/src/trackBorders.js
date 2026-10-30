import { validateDrawLayer } from './trackDrawLayers.js';
// Flat Carrera 124/132/Evolution shoulders. Article identities: Carrera catalogues
// 2013 pp90–91 / 2020 shoulder table. 99mm is the nominal planning width.
// Wide end piece 20598: Softyroyal visible Carrera Evolution geometry,
// checked 2026-10-24, 138.5 x 99mm; not a certified factory drawing.
export const BORDER_WIDTH_MM = 99;
export const BORDER_END_LENGTH_MM = 138.5;
export const CARRERA_BORDERS = Object.freeze(
  [
    ['20564', 'bankOuter1'],
    ['20565', 'bankOuter2'],
    ['20566', 'bankOuter3'],
    ['20580', 'bankOuter4'],
    ['20569', 'bankInner1'],
    ['20594', 'bankInner2'],
    ['20595', 'bankInner3'],
    ['20596', 'bankInner4'],
    ['20560', 'borderStandard'],
    ['20588', 'borderThird'],
    ['20589', 'borderQuarter'],
    ['20567', 'borderOuter130'],
    ['20561', 'borderOuter160'],
    ['20562', 'borderOuter230'],
    ['20563', 'borderOuter330'],
    ['20568', 'borderOuter415'],
    ['20590', 'borderInner130'],
    ['20551', 'borderInner160'],
    ['20591', 'borderInner230'],
    ['20592', 'borderInner330'],
    ['20593', 'borderInner415'],
    ['20598', 'borderEnd'],
    ['20602', 'pitBorder'],
  ].map(([article, label]) => ({ article, label }))
);
export function borderArticle(type, side) {
  if (/^(Schikane|Engstelle)_/.test(type)) return undefined;
  const bank = /^Steilkurve_(\d)_\d+_(links|rechts)$/.exec(type);
  if (bank) {
    const inner = side === (bank[2] === 'links' ? 'left' : 'right');
    return (
      inner ? { 1: '20569', 2: '20594', 3: '20595', 4: '20596' } : { 1: '20564', 2: '20565', 3: '20566', 4: '20580' }
    )[bank[1]];
  }
  const match = /^Kurve_(\d)_(\d+)_(links|rechts)$/.exec(type);
  const curved = /^Kurvenweiche_(links|rechts)_(ai|ia)_2$/.exec(type);
  if (match || curved) {
    const [k, a, direction] = match ? match.slice(1) : ['1', '60', curved[1]],
      inner = side === direction.replace('links', 'left').replace('rechts', 'right');
    return (
      inner
        ? { '1_30': '20590', '1_60': '20551', '2_30': '20591', '3_30': '20592', '4_15': '20593' }
        : { '1_30': '20567', '1_60': '20561', '2_30': '20562', '3_30': '20563', '4_15': '20568' }
    )[`${k}_${a}`];
  }
  return type === 'Drittelgerade' ? '20588' : type === 'Viertelgerade' ? '20589' : '20560';
}
export function validateBorders(value, type) {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !['left', 'right'].includes(k))
  )
    throw new Error('Invalid shoulders');
  if (type.startsWith('Steilkurve_') && Object.values(value).some((s) => s?.startCap || s?.endCap))
    throw new Error('Banked shoulder cap geometry is not verified');
  const result = {};
  for (const side of ['left', 'right'])
    if (value[side] !== undefined) {
      const s = value[side];
      if (
        !s ||
        typeof s !== 'object' ||
        Array.isArray(s) ||
        Object.keys(s).some((k) => !['startCap', 'endCap', 'drawLayer'].includes(k)) ||
        Object.entries(s).some(([k, v]) => k !== 'drawLayer' && typeof v !== 'boolean') ||
        !borderArticle(type, side)
      )
        throw new Error('Invalid shoulder side');
      validateDrawLayer(s.drawLayer);
      result[side] = {
        ...(s.drawLayer !== undefined ? { drawLayer: s.drawLayer } : {}),
        startCap: s.startCap ?? false,
        endCap: s.endCap ?? false,
      };
    }
  return Object.keys(result).length ? result : undefined;
}
export function pitBorderSideBlocked(plan, index, side) {
  if (!plan.pit.enabled || side !== 'right') return false;
  for (let i = plan.pit.entry, n = 0; n < plan.pieces.length; n++, i = (i + 1) % plan.pieces.length) {
    if (i === index) return true;
    if (i === plan.pit.merge) break;
  }
  return false;
}
export function applyTrackBorders(plan, indices, mode) {
  const set = new Set(indices);
  return {
    ...plan,
    pieces: plan.pieces.map((p, i) => {
      if (!set.has(i)) return p;
      const { borders, ...plain } = p;
      void borders;
      const next = {};
      for (const side of ['left', 'right'])
        if (
          (mode === 'both' ||
            mode === side ||
            (mode === 'outside' && side === (p.type.endsWith('links') ? 'right' : 'left'))) &&
          !pitBorderSideBlocked(plan, i, side) &&
          borderArticle(p.type, side)
        )
          next[side] = {
            ...(p.borders?.[side]?.drawLayer !== undefined ? { drawLayer: p.borders[side].drawLayer } : {}),
            startCap: false,
            endCap: false,
          };
      return Object.keys(next).length ? { ...plain, borders: next } : plain;
    }),
  };
}
