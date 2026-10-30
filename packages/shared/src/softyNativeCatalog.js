import { validateDrawLayer } from './trackDrawLayers.js';
// Numeric Carrera Evolution/Digital catalogue identities and functional geometry,
// checked against the visible Softyroyal catalogue; no external SVG is executed.
export const SOFTY_GUIDS = Object.freeze({
  straight: '4187668d-ee71-440a-9bb2-6e400e017416',
  third: '2d86d309-db83-4b6d-ab38-70bdb245a332',
  quarter: '13cc008b-a72f-457d-b9cb-a7fee76c2b1e',
  k130: 'e8ef2ee8-0e6b-4c09-93ef-81c3720daa97',
  k160: 'cc253612-a0cb-4b17-b940-18460c337acb',
  k2: '14ad43ad-002c-4499-b5c4-56076614499d',
  k3: '21e4eb5b-c300-445b-b25f-7d57bd7465f3',
  k4: 'c8ab5e58-e87f-4fb9-a71e-45687f44596e',
  double1: '114086b8-5cc0-431f-b965-f5c4b560e922',
  double2: '3ace141b-8a0e-4b6a-a6e8-e0126d80904f',
  curved1: 'ec739659-be97-4a2e-b88b-e424d611a204',
  curved2: '595c12af-49ba-4d6e-aa7d-ce3de949920f',
  cu: '6e7e4f2a-a8c6-40ed-b70c-a5441b257fc0',
  single: '5030736a-881d-45cc-b549-c765d5d66f10',
  pitEntry: 'd33c5415-691d-4941-9f6c-2dc1095279d6',
  pitExit: '3c1bd7b4-8587-4ac6-959d-e281c144718c',
  borderStandard: '572355ed-e23f-4ab4-949b-ba507dab1da9',
  borderThird: '98070b82-b131-499b-9fff-198e54db141f',
  borderQuarter: 'dd8ba261-6315-4147-9b06-7caca483dcdd',
  borderOuter130: '973b8e2d-2396-4b50-a3e3-c1c870ccb00d',
  borderInner130: '92e03903-9954-4455-b7dc-7bb92b135c9e',
  borderOuter160: '3c6d71a2-baac-455a-843d-38cc15f4f74f',
  borderInner160: '5834c549-9361-41fd-9b23-497f416ed222',
  borderOuter230: 'b18d7259-18f0-4a8d-98af-b28466d45b19',
  borderInner230: 'cd9ba0a6-a86a-4642-b3ad-6eeb873e34e1',
  borderOuter330: '60e5dbe5-6b87-4a7b-82a3-ad40a0223760',
  borderInner330: '972c811c-9b04-46b4-9bb2-b995c79afcf0',
  borderOuter415: 'aa97e287-ce3c-4636-8961-1977a82dc130',
  borderInner415: '922a48bb-adb1-4099-ae2d-dcb98f1774aa',
  borderEndRight: 'b3fdc4cb-cef4-4b36-bbda-82875d6ee69d',
  borderEndLeft: '3c887064-3041-4759-9205-39bf6ff34827',
  pitBorderEntry: '179fa6a1-4004-46e4-abf6-52d541c24c9c',
  pitBorderExit: '928b2b38-a861-43ae-a525-412388bd39aa',
});
export const SOFTY_EXTRAS = Object.freeze({
  single: { article: '30341' },
  pitEntry: { article: '30356' },
  pitExit: { article: '30356' },
  borderStandard: { article: '20560', length: 345 },
  borderThird: { article: '20588', length: 115 },
  borderQuarter: { article: '20589', length: 86.25 },
  ...Object.fromEntries(
    [
      [130, 297, 30, '20567', '20590'],
      [160, 297, 60, '20561', '20551'],
      [230, 495, 30, '20562', '20591'],
      [330, 693, 30, '20563', '20592'],
      [415, 891, 15, '20568', '20593'],
    ].flatMap(([k, radius, angle, outer, inner]) => [
      [`borderOuter${k}`, { article: outer, radius, angle, outside: true }],
      [`borderInner${k}`, { article: inner, radius, angle, outside: false }],
    ])
  ),
  borderEndRight: { article: '20598', end: 1 },
  borderEndLeft: { article: '20598', end: -1 },
  pitBorderEntry: { article: '20602' },
  pitBorderExit: { article: '20602' },
});
export const SOFTY_ROADS = Object.freeze({
  straight: 'Standardgerade',
  third: 'Drittelgerade',
  quarter: 'Viertelgerade',
  k130: 'Kurve_1_30_rechts',
  k160: 'Kurve_1_60_rechts',
  k2: 'Kurve_2_30_rechts',
  k3: 'Kurve_3_30_rechts',
  k4: 'Kurve_4_15_rechts',
  double1: 'DigitaleDoppelweiche_1',
  double2: 'DigitaleDoppelweiche_2',
  curved1: 'Kurvenweiche_rechts_ai_1',
  curved2: 'Kurvenweiche_rechts_ai_2',
  cu: 'Control_unit',
});
export const SOFTY_ALIASES = Object.freeze({ '888c36e0-3d78-482c-872c-7eee1259a90a': 'straight' });
export function validateTrackExtras(value, pieceCount) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 3000) throw new Error('Invalid native extra parts');
  return value.map((e) => {
    validateDrawLayer(e?.drawLayer);
    if (
      !e ||
      !Object.hasOwn(SOFTY_EXTRAS, e.kind) ||
      !e.placement ||
      ![e.placement.xMm, e.placement.yMm, e.placement.headingDegrees].every(Number.isFinite) ||
      Math.abs(e.placement.xMm) > 1000000 ||
      Math.abs(e.placement.yMm) > 1000000 ||
      Math.abs(e.placement.headingDegrees) > 360 ||
      ![0, 1, 2].includes(e.level) ||
      !Number.isInteger(e.paintOrder) ||
      e.paintOrder < 0 ||
      e.paintOrder > 12000 ||
      (e.anchor !== undefined && (!Number.isInteger(e.anchor) || e.anchor < 0 || e.anchor >= pieceCount)) ||
      (e.hidden !== undefined && typeof e.hidden !== 'boolean')
    )
      throw new Error('Invalid native extra part');
    return {
      ...(e.drawLayer !== undefined ? { drawLayer: e.drawLayer } : {}),
      kind: e.kind,
      placement: { xMm: e.placement.xMm, yMm: e.placement.yMm, headingDegrees: e.placement.headingDegrees },
      level: e.level,
      paintOrder: e.paintOrder,
      ...(e.anchor !== undefined ? { anchor: e.anchor } : {}),
      ...(e.hidden ? { hidden: true } : {}),
    };
  });
}
export function validateSoftyImport(value) {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value.paintOrder !== 'boolean' ||
    ![value.items, value.crossings, value.bays, value.unassigned].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 6000
    )
  )
    throw new Error('Invalid Softy import report');
  return {
    paintOrder: value.paintOrder,
    items: value.items,
    crossings: value.crossings,
    bays: value.bays,
    unassigned: value.unassigned,
  };
}
