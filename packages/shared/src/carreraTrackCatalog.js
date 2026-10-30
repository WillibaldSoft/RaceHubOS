// Additional nominal 2D geometries. Existing planner2022/prototype dimensions
// remain untouched. Banked rails use a flat projection, not surveyed 3D lengths.
export const EXTRA_TRACK_PARTS = Object.freeze({
  ...Object.fromEntries(
    [
      [1, 30],
      [2, 30],
      [3, 30],
      [4, 15],
    ].flatMap(([k, a]) =>
      ['links', 'rechts'].map((side) => [
        `Steilkurve_${k}_${a}_${side}`,
        { radius: 299 + (k - 1) * 198, angle: side === 'links' ? -a : a, banked: true },
      ])
    )
  ),
  ...Object.fromEntries(
    ['links', 'rechts'].flatMap((side) => [1, 2].map((i) => [`Weiche_${side}_${i}`, { length: 345 }]))
  ),
  ...Object.fromEntries(
    [
      ['links', 'ai'],
      ['links', 'ia'],
      ['rechts', 'ia'],
    ].flatMap(([side, route]) => [
      [`Kurvenweiche_${side}_${route}_1`, { length: 345 }],
      [`Kurvenweiche_${side}_${route}_2`, { radius: 299, angle: side === 'links' ? -60 : 60 }],
    ])
  ),
  Multistart: { length: 345 },
  Schikane_30373: { length: 1035, special: 'chicane', modules: 3, approximateSlots: true },
  Engstelle_links_30350: { length: 1380, special: 'narrow', side: -1, modules: 4 },
  Engstelle_rechts_30351: { length: 1380, special: 'narrow', side: 1, modules: 4 },
});
export const EXTRA_TRACK_ASSEMBLIES = Object.freeze({
  leftSwitch: ['Weiche_links_1', 'Weiche_links_2'],
  rightSwitch: ['Weiche_rechts_1', 'Weiche_rechts_2'],
  curvedLeftOutIn: ['Kurvenweiche_links_ai_1', 'Kurvenweiche_links_ai_2'],
  curvedLeftInOut: ['Kurvenweiche_links_ia_1', 'Kurvenweiche_links_ia_2'],
  curvedRightInOut: ['Kurvenweiche_rechts_ia_1', 'Kurvenweiche_rechts_ia_2'],
});
export const EXTRA_ASSEMBLY_ARTICLES = Object.freeze({
  leftSwitch: '30343',
  rightSwitch: '30345',
  curvedLeftOutIn: '30363',
  curvedLeftInOut: '30362',
  curvedRightInOut: '30364',
});
export function trackArticle(type) {
  const curve = /^(Kurve|Steilkurve)_(\d)_(\d+)_/.exec(type);
  if (curve)
    return (
      curve[1] === 'Steilkurve'
        ? { '1_30': '20574', '2_30': '20575', '3_30': '20576', '4_15': '20579' }
        : { '1_30': '20577', '1_60': '20571', '2_30': '20572', '3_30': '20573', '4_15': '20578' }
    )[`${curve[2]}_${curve[3]}`];
  for (const [id, types] of Object.entries(EXTRA_TRACK_ASSEMBLIES))
    if (types.includes(type)) return EXTRA_ASSEMBLY_ARTICLES[id];
  return {
    Startampel_3spur_hinten: '20509',
    Schikane_30373: '30373',
    Engstelle_links_30350: '30350',
    Engstelle_rechts_30351: '30351',
    Standardgerade: '20509',
    Drittelgerade: '20611',
    Viertelgerade: '20612',
    Control_unit: '30352',
    AdapterUnit: '30360',
    Check_lane: '30371',
    Multistart: '30370',
    DigitaleDoppelweiche_1: '30347',
    DigitaleDoppelweiche_2: '30347',
    Kurvenweiche_rechts_ai_1: '30365',
    Kurvenweiche_rechts_ai_2: '30365',
    Pit_stop_weiche_anfang: '30356',
    Pit_stop_weiche_ende: '30356',
  }[type];
}

// Official article index, checked 2026-10-24. Reference-only entries have no
// invented road geometry. They remain available as catalogue information.
export const CARRERA_MANUFACTURER_ARTICLES = Object.freeze([
  {
    'article': '20509',
    'source': 'https://carrera-toys.com/en/products/20020509-standard-straights-4',
    'name': 'standard straights 4',
  },
  {
    'article': '20517',
    'source': 'https://carrera-toys.com/en/products/20020517-lane-change-section-2',
    'name': 'Mechanischer Spurwechsel (2 × 345 mm)',
  },
  {
    'article': '20551',
    'source': 'https://carrera-toys.com/en/products/20020551-inside-shoulder-curve-1-60-3-end-piece-2',
    'name': 'inside shoulder curve 1 60 3 end piece 2',
  },
  {
    'article': '20560',
    'source': 'https://carrera-toys.com/en/products/20020560-outside-shoulder-for-straight-6',
    'name': 'outside shoulder for straight 6',
  },
  {
    'article': '20561',
    'source': 'https://carrera-toys.com/en/products/20020561-outside-shoulder-for-curve-1-60-3-end-piece-2',
    'name': 'outside shoulder for curve 1 60 3 end piece 2',
  },
  {
    'article': '20563',
    'source': 'https://carrera-toys.com/en/products/20020563-outside-shoulder-for-curve-3-30-6-end-piece-2',
    'name': 'outside shoulder for curve 3 30 6 end piece 2',
  },
  {
    'article': '20564',
    'source': 'https://carrera-toys.com/en/products/20020564-outside-shoulder-for-high-banked-curve-1-30-6-end-piece-2',
    'name': 'outside shoulder for high banked curve 1 30 6 end piece 2',
  },
  {
    'article': '20565',
    'source': 'https://carrera-toys.com/en/products/20020565-outside-shoulder-for-high-banked-curve-2-30-6-end-piece-2',
    'name': 'outside shoulder for high banked curve 2 30 6 end piece 2',
  },
  {
    'article': '20566',
    'source': 'https://carrera-toys.com/en/products/20020566-outside-shoulder-for-high-banked-curve-3-30-6-end-piece-2',
    'name': 'outside shoulder for high banked curve 3 30 6 end piece 2',
  },
  {
    'article': '20567',
    'source': 'https://carrera-toys.com/en/products/20020567-outside-shoulder-for-curve-1-30-6-end-piece-2',
    'name': 'outside shoulder for curve 1 30 6 end piece 2',
  },
  {
    'article': '20568',
    'source': 'https://carrera-toys.com/en/products/20020568-outside-shoulder-for-curve-4-15-12-end-piece-2',
    'name': 'outside shoulder for curve 4 15 12 end piece 2',
  },
  {
    'article': '20569',
    'source': 'https://carrera-toys.com/en/products/20020569-inside-shoulder-for-high-banked-curve-1-30-6-end-piece-2',
    'name': 'inside shoulder for high banked curve 1 30 6 end piece 2',
  },
  {
    'article': '20571',
    'source': 'https://carrera-toys.com/en/products/20020571-curve-1-60-3',
    'name': 'curve 1 60 3',
  },
  {
    'article': '20572',
    'source': 'https://carrera-toys.com/en/products/20020572-curve-2-30-6',
    'name': 'curve 2 30 6',
  },
  {
    'article': '20573',
    'source': 'https://carrera-toys.com/en/products/20020573-curve-3-30-6',
    'name': 'curve 3 30 6',
  },
  {
    'article': '20574',
    'source': 'https://carrera-toys.com/en/products/20020574-high-banked-curve-1-30-6',
    'name': 'high banked curve 1 30 6',
  },
  {
    'article': '20575',
    'source': 'https://carrera-toys.com/en/products/20020575-high-banked-curve-2-30-6',
    'name': 'high banked curve 2 30 6',
  },
  {
    'article': '20576',
    'source': 'https://carrera-toys.com/en/products/20020576-high-banked-curve-3-30-6',
    'name': 'high banked curve 3 30 6',
  },
  {
    'article': '20577',
    'name': 'Kurve K1 / 30°',
    'source': 'https://carrera-toys.com/en/products/20020577-curve-1-30-6',
  },
  {
    'article': '20578',
    'source': 'https://carrera-toys.com/en/products/20020578-curve-4-15-12',
    'name': 'curve 4 15 12',
  },
  {
    'article': '20579',
    'source': 'https://carrera-toys.com/en/products/20020579-high-banked-curve-4-15-12',
    'name': 'high banked curve 4 15 12',
  },
  {
    'article': '20580',
    'source':
      'https://carrera-toys.com/en/products/20020580-outside-shoulder-for-high-banked-curve-4-15-12-end-piece-2',
    'name': 'outside shoulder for high banked curve 4 15 12 end piece 2',
  },
  {
    'article': '20587',
    'source': 'https://carrera-toys.com/en/products/20020587-crossing-4',
    'name': 'Überfahrt (4 Schienenteile)',
  },
  {
    'article': '20588',
    'source': 'https://carrera-toys.com/en/products/20020588-shoulders-1-3-straight-4',
    'name': 'shoulders 1 3 straight 4',
  },
  {
    'article': '20589',
    'source': 'https://carrera-toys.com/en/products/20020589-shoulders-1-4-straight-4',
    'name': 'shoulders 1 4 straight 4',
  },
  {
    'article': '20590',
    'source': 'https://carrera-toys.com/en/products/20020590-inside-shoulder-for-curve-1-30-6-end-piece-2',
    'name': 'inside shoulder for curve 1 30 6 end piece 2',
  },
  {
    'article': '20593',
    'source': 'https://carrera-toys.com/en/products/20020593-inside-shoulder-for-curve-4-15-12-end-piece-2',
    'name': 'inside shoulder for curve 4 15 12 end piece 2',
  },
  {
    'article': '20594',
    'source': 'https://carrera-toys.com/en/products/20020594-inside-shoulder-for-high-banked-curve-2-30-6-end-piece-2',
    'name': 'inside shoulder for high banked curve 2 30 6 end piece 2',
  },
  {
    'article': '20595',
    'name': 'Innenrand Steilkurve K3 / 30°',
    'source': 'https://carrera-toys.com/en/products/20020595-inside-shoulder-for-high-banked-curve-3-30-6-end-piece-2',
  },
  {
    'article': '20596',
    'source': 'https://carrera-toys.com/en/products/20020596-inside-shoulder-for-high-banked-curve-4-15-12-end-piece-2',
    'name': 'inside shoulder for high banked curve 4 15 12 end piece 2',
  },
  {
    'article': '20598',
    'source': 'https://carrera-toys.com/en/products/20020598-endpiece-for-outside-shoulder-4-wide',
    'name': 'endpiece for outside shoulder 4 wide',
  },
  {
    'article': '20599',
    'source': 'https://carrera-toys.com/en/products/20020599-endpiece-for-inside-shoulder-high-banked-curve-4-narrow',
    'name': 'Schmales Endstück für Steilkurven-Innenrand',
  },
  {
    'article': '20600',
    'source':
      'https://carrera-toys.com/en/products/20020600-connecting-track-4-for-inside-shoulder-and-high-banked-curve',
    'name': 'Verbindung für Steilkurven-Innenrand',
  },
  {
    'article': '20601',
    'source': 'https://carrera-toys.com/en/products/20020601-standard-straights-2',
    'name': 'standard straights 2',
  },
  {
    'article': '20602',
    'source': 'https://carrera-toys.com/en/products/20020602-outside-shoulder-for-pit-stop-lane-4',
    'name': 'outside shoulder for pit stop lane 4',
  },
  {
    'article': '20603',
    'source': 'https://carrera-toys.com/en/products/20020603-shoulders-for-digital-narrow-section-6',
    'name': 'Randstreifen-Set für digitale Engstelle',
  },
  {
    'article': '20604',
    'source': 'https://carrera-toys.com/en/products/20020604-shoulders-for-chicane-3',
    'name': 'Randstreifen-Set für Schikane',
  },
  {
    'article': '20611',
    'source': 'https://carrera-toys.com/en/products/20020611-1-3-straights-2',
    'name': '1 3 straights 2',
  },
  {
    'article': '20612',
    'source': 'https://carrera-toys.com/en/products/20020612-1-4-straights-2',
    'name': '1 4 straights 2',
  },
  {
    'article': '30341',
    'source': 'https://carrera-toys.com/en/products/20030341-single-lane-track-section-for-pit-stop-extension',
    'name': 'Einspurgerade / Pitlane-Verlängerung',
  },
  {
    'article': '30343',
    'source': 'https://carrera-toys.com/en/products/20030343-lane-change-section-left',
    'name': 'lane change section left',
  },
  {
    'article': '30345',
    'source': 'https://carrera-toys.com/en/products/20030345-lane-change-section-right',
    'name': 'lane change section right',
  },
  {
    'article': '30347',
    'source': 'https://carrera-toys.com/en/products/20030347-double-lane-change-section',
    'name': 'double lane change section',
  },
  {
    'article': '30350',
    'source': 'https://carrera-toys.com/en/products/20030350-digital-narrow-section-left',
    'name': 'Digitale Engstelle links (4 Schienenteile)',
  },
  {
    'article': '30351',
    'source': 'https://carrera-toys.com/en/products/20030351-digital-narrow-section-right',
    'name': 'Digitale Engstelle rechts (4 Schienenteile)',
  },
  {
    'article': '30352',
    'source': 'https://carrera-toys.com/en/products/20030352-control-unit',
    'name': 'control unit',
  },
  {
    'article': '30353',
    'source': 'https://carrera-toys.com/en/products/20030353-driver-display',
    'name': 'Driver Display',
  },
  {
    'article': '30354',
    'source': 'https://carrera-toys.com/en/products/20030354-startlight',
    'name': 'Startlight / Startampel',
  },
  {
    'article': '30355',
    'source': 'https://carrera-toys.com/en/products/20030355-lap-counter',
    'name': 'Digitaler Rundenzähler',
  },
  {
    'article': '30356',
    'name': 'Pit Lane',
    'source': 'https://carrera-toys.com/en/products/20030356-pit-lane',
  },
  {
    'article': '30357',
    'source': 'https://carrera-toys.com/en/products/20030357-position-tower',
    'name': 'Position Tower',
  },
  {
    'article': '30358',
    'source': 'https://carrera-toys.com/en/products/20030358-shoulder-connecting-section',
    'name': 'Randstreifen-Anschlussstück',
  },
  {
    'article': '30359',
    'source': 'https://carrera-toys.com/en/products/20030359-shoulder-complement',
    'name': 'Randstreifen-Ausgleichsstück (172,5 mm)',
  },
  {
    'article': '30360',
    'source': 'https://carrera-toys.com/en/products/20030360-adapter-unit',
    'name': 'adapter unit',
  },
  {
    'article': '30361',
    'source': 'https://carrera-toys.com/en/products/20030361-pit-stop-adapter-unit',
    'name': 'Pit Stop Adapter Unit / Tankschiene',
  },
  {
    'article': '30362',
    'name': 'Kurvenweiche links · innen → außen',
    'source': 'https://carrera-toys.com/en/products/20030362-lane-change-curve-left-in-to-out',
  },
  {
    'article': '30363',
    'source': 'https://carrera-toys.com/en/products/20030363-lane-change-curve-left-out-to-in',
    'name': 'lane change curve left out to in',
  },
  {
    'article': '30364',
    'source': 'https://carrera-toys.com/en/products/20030364-lane-change-curve-right-in-to-out',
    'name': 'lane change curve right in to out',
  },
  {
    'article': '30365',
    'name': 'Kurvenweiche rechts · außen → innen',
    'source': 'https://carrera-toys.com/en/products/20030365-lane-change-curve-right-out-to-in',
  },
  {
    'article': '30368',
    'source': 'https://carrera-toys.com/en/products/20030368-single-lane-adapter-unit',
    'name': 'Einspur-Adapter Unit (345 mm)',
  },
  {
    'article': '30370',
    'source': 'https://carrera-toys.com/en/products/20030370-multistart-lane',
    'name': 'multistart lane',
  },
  {
    'article': '30371',
    'source': 'https://carrera-toys.com/en/products/20030371-check-lane',
    'name': 'check lane',
  },
  {
    'article': '30373',
    'source': 'https://carrera-toys.com/en/products/20030373-chicane-for-digital-124-132',
    'name': 'Schikane (3 × 345 mm)',
  },
  {
    'article': '30374',
    'name': 'Pit Lane mit Randstreifen',
    'source': 'https://carrera-toys.com/en/products/20030374-pit-lane-with-shoulder',
  },
]);

// Verified facts only. Module length is not the curved slot's travelled length.
export const SPECIAL_GEOMETRY_AUDIT = Object.freeze({
  '30373': { modules: 3, moduleLengthMm: 345, nominalTotalMm: 1035, note: 'chicane', placeable: true },
  '30350': {
    modules: 4,
    moduleLengthMm: 345,
    nominalTotalMm: 1380,
    catalogue2018ConflictMm: 690,
    note: 'narrow',
    placeable: true,
  },
  '30351': {
    modules: 4,
    moduleLengthMm: 345,
    nominalTotalMm: 1380,
    catalogue2018ConflictMm: 690,
    note: 'narrow',
    placeable: true,
  },
  '20587': { modules: 4, note: 'bridge', placeable: false },
  '20517': { modules: 2, moduleLengthMm: 345, note: 'fixedCross', placeable: false },
});
