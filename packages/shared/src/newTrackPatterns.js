import { TRACK_PARTS } from './trackPlan.js';

const piece = (type) => ({ type, level: 0, jointDegrees: 0 });
// A new two-lobe crossing circuit, assembled from catalogue corners and straights.
// The reference contributes only its complete CU/double-pit straight, not its loops.
export function newCrossingPattern(source, rand) {
  const pitPieces = [];
  for (let i = source.pit.entry, n = 0; n < source.pieces.length; n++, i = (i + 1) % source.pieces.length) {
    pitPieces.push({ type: source.pieces[i].type, level: 0, jointDegrees: 0 });
    if (i === source.pit.merge) break;
  }
  const quarters = [
    ['Kurve_1_60', 'Kurve_2_30'],
    ['Kurve_1_60', 'Kurve_3_30'],
    ['Kurve_2_30', 'Kurve_1_60'],
    ['Kurve_3_30', 'Kurve_1_60'],
    ['Kurve_1_60', 'Kurve_4_15', 'Kurve_4_15'],
    ['Kurve_2_30', 'Kurve_3_30', 'Kurve_3_30'],
    ['Kurve_3_30', 'Kurve_2_30', 'Kurve_2_30'],
    ['Kurve_4_15', 'Kurve_4_15', 'Kurve_3_30', 'Kurve_2_30'],
    Array(6).fill('Kurve_4_15'),
  ];
  const tails = [
    ['Kurve_1_60'],
    ['Kurve_2_30', 'Kurve_2_30'],
    ['Kurve_3_30', 'Kurve_3_30'],
    Array(4).fill('Kurve_4_15'),
  ];
  const pattern = [
    quarters[rand(quarters.length)],
    quarters[rand(quarters.length)],
    rand(2) ? quarters[rand(quarters.length)] : tails[rand(tails.length)],
  ];
  const extensions = [rand(3), rand(3)],
    chicane = rand(3) === 0;
  function loop(side) {
    const opposite = side === 'rechts' ? 'links' : 'rechts';
    return pattern.flatMap((q, i) => [
      ...q.map((t) => piece(`${t}_${side}`)),
      ...(chicane && i === 0 ? [piece(`Kurve_4_15_${opposite}`), piece(`Kurve_4_15_${side}`)] : []),
      ...Array.from({ length: extensions[i] || 0 }, () => piece('Standardgerade')),
    ]);
  }
  const connector = [];
  const pairs = rand(3);
  for (let i = 0; i < pairs; i++) connector.push(piece('DigitaleDoppelweiche_1'), piece('DigitaleDoppelweiche_2'));
  while (connector.length < pitPieces.length) connector.push(piece('Standardgerade'));
  const p = {
    ...source,
    freePlacement: false,
    pieces: [...pitPieces, ...loop('rechts'), ...connector, ...loop('links')],
    pit: { ...source.pit, entry: 0, merge: pitPieces.length - 1 },
    measuredLaneLengthsM: null,
    startHeadingDegrees: 0,
  };
  delete p.partGroups;
  delete p.roomPlan;
  delete p.trackExtras;
  delete p.softyImport;
  delete p.pit.native;
  // Paint the central straight as the upper crossing. Ramps are reserved from
  // the adjacent non-pit rail runs by the caller after collision checks.
  const highStart = pitPieces.length + loop('rechts').length;
  for (let i = highStart; i < highStart + connector.length; i++) p.pieces[i].level = 1;
  return {
    plan: p,
    joints: p.pieces.flatMap((s, i) => (i >= pitPieces.length && TRACK_PARTS[s.type].angle ? [i] : [])),
  };
}
