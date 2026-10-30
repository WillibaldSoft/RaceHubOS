import { validateDrawLayer } from './trackDrawLayers.js';
import { specialTrackGeometry } from './specialTrackGeometry.js';
import { EXTRA_TRACK_PARTS } from './carreraTrackCatalog.js';
import { validatePartGroups } from './trackAssemblies.js';
import { validateTrackExtras, validateSoftyImport } from './softyNativeCatalog.js';
import { validateBorders } from './trackBorders.js';
import { analyseTrackConnections } from './trackConnections.js';
import { validateRoom } from './roomConfiguration.js';
// Millimetres and degrees. Original Autorennbahnplaner 2022 centre radii;
// catalogue dimensions are nominal, not a survey of a physically adjusted track.
export const TRACK_PLAN_KIND = 'racehubos.track-plan';
export const TRACK_PARTS = Object.freeze({
  ...EXTRA_TRACK_PARTS,
  Standardgerade: { length: 345 },
  Drittelgerade: { length: 115 },
  Viertelgerade: { length: 87 },
  AdapterUnit: { length: 345 },
  Control_unit: { length: 345 },
  Check_lane: { length: 345 },
  Startampel_3spur_hinten: { length: 345 },
  Pit_stop_weiche_anfang: { length: 345 },
  Pit_stop_weiche_ende: { length: 345 },
  DigitaleDoppelweiche_1: { length: 345 },
  DigitaleDoppelweiche_2: { length: 345 },
  Kurvenweiche_rechts_ai_1: { length: 345 },
  Kurvenweiche_rechts_ai_2: { radius: 299, angle: 60 },
  ...Object.fromEntries(
    [
      [1, [30, 60]],
      [2, [30]],
      [3, [30]],
      [4, [15]],
    ].flatMap(([k, angles]) =>
      angles.flatMap((angle) =>
        ['links', 'rechts'].map((side) => [
          `Kurve_${k}_${angle}_${side}`,
          {
            radius: 299 + (k - 1) * 198,
            angle: angle * (side === 'links' ? -1 : 1),
          },
        ])
      )
    )
  ),
});
export function emptyTrackPlan() {
  return {
    kind: TRACK_PLAN_KIND,
    version: 1,
    pieces: [],
    pit: {
      enabled: false,
      entry: 0,
      merge: 0,
      spacingMm: 345,
      bayLengthMm: 690,
    },
    measuredLaneLengthsM: null,
    geometryProfile: 'planner2022',
    startHeadingDegrees: 0,
  };
}
export function validateTrackPlan(value) {
  if (
    !value ||
    value.kind !== TRACK_PLAN_KIND ||
    value.version !== 1 ||
    !Array.isArray(value.pieces) ||
    value.pieces.length > 2000
  )
    throw new Error('Invalid track plan');
  if (
    !['planner2022', 'prototype'].includes(value.geometryProfile ?? 'planner2022') ||
    !Number.isFinite(value.startHeadingDegrees ?? 0) ||
    Math.abs(value.startHeadingDegrees ?? 0) > 360
  )
    throw new Error('Invalid geometry profile');
  const pieces = value.pieces.map((p) => {
    if (
      !p ||
      !Object.hasOwn(TRACK_PARTS, p.type) ||
      ![0, 1, 2].includes(p.level ?? 0) ||
      !Number.isFinite(p.jointDegrees ?? 0) ||
      Math.abs(p.jointDegrees ?? 0) > 5
    )
      throw new Error('Invalid track piece');
    if (p.paintOrder !== undefined && (!Number.isInteger(p.paintOrder) || p.paintOrder < 0 || p.paintOrder > 12000))
      throw new Error('Invalid paint order');
    validateDrawLayer(p.drawLayer);
    const borders = validateBorders(p.borders, p.type);
    let placement;
    if (p.placement) {
      const q = p.placement;
      if (
        ![q.xMm, q.yMm, q.headingDegrees].every(Number.isFinite) ||
        Math.abs(q.xMm) > 1000000 ||
        Math.abs(q.yMm) > 1000000 ||
        Math.abs(q.headingDegrees) > 360
      )
        throw new Error('Invalid placement');
      placement = { xMm: q.xMm, yMm: q.yMm, headingDegrees: q.headingDegrees };
    }
    if (value.freePlacement === true && !placement) throw new Error('Missing free placement');
    if (placement && value.freePlacement !== true) throw new Error('Unexpected placement');
    return {
      ...(p.drawLayer !== undefined ? { drawLayer: p.drawLayer } : {}),
      ...(p.paintOrder !== undefined ? { paintOrder: p.paintOrder } : {}),
      ...(borders ? { borders } : {}),
      ...(placement ? { placement } : {}),
      type: p.type,
      level: p.level ?? 0,
      jointDegrees: p.jointDegrees ?? 0,
    };
  });
  if (value.freePlacement !== undefined && typeof value.freePlacement !== 'boolean')
    throw new Error('Invalid placement mode');
  const pit = { ...emptyTrackPlan().pit, ...value.pit };
  if (
    typeof pit.enabled !== 'boolean' ||
    !Number.isInteger(pit.entry) ||
    !Number.isInteger(pit.merge) ||
    pit.entry < 0 ||
    pit.merge < 0 ||
    (pit.enabled && (pit.entry >= pieces.length || pit.merge >= pieces.length)) ||
    !Number.isFinite(pit.spacingMm) ||
    pit.spacingMm < 115 ||
    pit.spacingMm > 3000 ||
    !Number.isFinite(pit.bayLengthMm) ||
    pit.bayLengthMm < 115 ||
    pit.bayLengthMm > 10000
  )
    throw new Error('Invalid pit geometry');
  validateDrawLayer(pit.drawLayer);
  if (pit.native !== undefined && typeof pit.native !== 'boolean') throw new Error('Invalid native pit');
  const trackExtras = validateTrackExtras(value.trackExtras, pieces.length),
    softyImport = validateSoftyImport(value.softyImport);
  const partGroups = validatePartGroups(value.partGroups, pieces.length);
  const measured = value.measuredLaneLengthsM ?? null;
  if (
    measured !== null &&
    (!Array.isArray(measured) ||
      measured.length !== 2 ||
      measured.some((n) => !Number.isFinite(n) || n <= 0 || n > 10000))
  )
    throw new Error('Invalid measured lengths');
  return {
    kind: TRACK_PLAN_KIND,
    version: 1,
    ...(partGroups ? { partGroups } : {}),
    ...(trackExtras ? { trackExtras } : {}),
    ...(softyImport ? { softyImport } : {}),
    ...(value.freePlacement ? { freePlacement: true } : {}),
    pieces,
    pit,
    measuredLaneLengthsM: measured,
    geometryProfile: value.geometryProfile ?? 'planner2022',
    startHeadingDegrees: value.startHeadingDegrees ?? 0,
    ...(value.roomPlan ? { roomPlan: validateRoom(value.roomPlan) } : {}),
  };
}
export function readTrackPlan(layout) {
  try {
    return validateTrackPlan(typeof layout === 'string' ? JSON.parse(layout) : layout);
  } catch {
    return null;
  }
}
export function traceTrackPlan(input) {
  const plan = validateTrackPlan(input);
  let x = 0,
    y = 0,
    h = (plan.startHeadingDegrees * Math.PI) / 180;
  const lengths = [0, 0];
  const segments = plan.pieces.map((piece, index) => {
    if (piece.placement) {
      x = piece.placement.xMm;
      y = piece.placement.yMm;
      h = (piece.placement.headingDegrees * Math.PI) / 180;
    } else h += (piece.jointDegrees * Math.PI) / 180;
    const base = TRACK_PARTS[piece.type];
    const spec =
      plan.geometryProfile === 'prototype'
        ? {
            ...base,
            ...(base.radius ? { radius: base.radius - 2 } : {}),
            ...(piece.type === 'Viertelgerade' ? { length: 86.25 } : {}),
          }
        : base;
    const turn = ((spec.angle || 0) * Math.PI) / 180;
    const sign = Math.sign(turn),
      start = { x, y, h };
    const points = [[], [], []];
    for (let j = 0; j <= 32; j++) {
      const f = j / 32,
        a = h + turn * f;
      const px = turn ? x + sign * spec.radius * (Math.sin(a) - Math.sin(h)) : x + spec.length * f * Math.cos(h);
      const py = turn ? y + sign * spec.radius * (Math.cos(h) - Math.cos(a)) : y + spec.length * f * Math.sin(h);
      [0, -49.5, 49.5].forEach((offset, lane) =>
        points[lane].push([px - Math.sin(a) * offset, py + Math.cos(a) * offset])
      );
    }
    const special = spec.special ? specialTrackGeometry(spec, start) : null;
    if (special) points.splice(0, 3, ...special.points);
    const end = points[0].at(-1);
    [x, y] = end;
    h += turn;
    const laneLengthsM = special
      ? special.laneLengthsM
      : [-49.5, 49.5].map((offset) => (turn ? Math.abs(turn) * (spec.radius - sign * offset) : spec.length) / 1000);
    laneLengthsM.forEach((n, lane) => {
      lengths[lane] += n * 1000;
    });
    return {
      ...piece,
      laneLengthsM,
      index,
      start,
      end: { x, y, h },
      points,
      ...(special
        ? {
            roadOutline: special.roadOutline,
            special: spec.special,
            modules: spec.modules,
            approximateSlots: !!spec.approximateSlots,
          }
        : {}),
    };
  });
  const connectivity = plan.freePlacement ? analyseTrackConnections(segments) : null;
  if (connectivity?.closed) {
    lengths.fill(0);
    for (const { index, reverse } of connectivity.route)
      segments[index].laneLengthsM.forEach((n, lane) => {
        lengths[reverse ? 1 - lane : lane] += n * 1000;
      });
  }
  return {
    segments,
    connectivity,
    calculatedLaneLengthsM: lengths.map((n) => n / 1000),
    laneLengthsM: plan.measuredLaneLengthsM || lengths.map((n) => n / 1000),
    gapMm: connectivity?.closed ? 0 : Math.hypot(x, y),
    headingErrorDegrees: connectivity?.closed
      ? 0
      : (((((h * 180) / Math.PI - plan.startHeadingDegrees) % 360) + 540) % 360) - 180,
  };
}
// Round-average speed only. Digital lane changes and pit routes need extra telemetry.
export function trackSpeedKmh(lengthM, lapTimeMs) {
  return Number.isFinite(lengthM) && lengthM > 0 && Number.isFinite(lapTimeMs) && lapTimeMs > 0
    ? (lengthM * 3600) / lapTimeMs
    : null;
}
export function serializeTrackPlan(plan) {
  const clean = validateTrackPlan(plan),
    result = traceTrackPlan(clean);
  return JSON.stringify({
    ...clean,
    laneLengthsM: result.laneLengthsM,
    calculatedLaneLengthsM: result.calculatedLaneLengthsM,
  });
}
export function trackPlanFields(plan) {
  const layout = serializeTrackPlan(plan),
    result = JSON.parse(layout);
  return {
    layout,
    length:
      plan.freePlacement && !traceTrackPlan(plan).connectivity.closed
        ? null
        : (result.laneLengthsM[0] + result.laneLengthsM[1]) / 2,
    corners: result.pieces.filter((p) => TRACK_PARTS[p.type].angle).length,
  };
}
export function importTrackTrk(text) {
  if (text.length > 2000000) throw new Error('TRK too large');
  const fields = Object.create(null);
  for (const token of text.replace(/^\uFEFF/, '').split('&')) {
    const i = token.indexOf('=');
    if (i < 1 || Object.hasOwn(fields, token.slice(0, i))) throw new Error('Invalid TRK');
    fields[token.slice(0, i)] = token.slice(i + 1);
  }
  if (fields.Bahnsystem !== 'Digital 132' || !fields.teile_Typ_1) throw new Error('Unsupported TRK');
  const types = fields.teile_Typ_1.split(';');
  if (types.length !== Number(fields.ItemNumber_1) + 1) throw new Error('Invalid TRK count');
  if (fields.RaceHubOSPlan) {
    const extended = validateTrackPlan(JSON.parse(decodeURIComponent(fields.RaceHubOSPlan)));
    const nativeTypes = types.filter((t) => t !== 'Startteil');
    if (JSON.stringify(extended.pieces.map((p) => p.type)) !== JSON.stringify(nativeTypes))
      throw new Error('TRK extension disagrees with edited rails');
    return extended;
  }
  return validateTrackPlan({
    ...emptyTrackPlan(),
    pieces: types.filter((t) => t !== 'Startteil').map((type) => ({ type, level: 0 })),
  });
}
// Digital controllers identify cars, not lanes. Use the mean of the two saved
// lanes, never map controller 1/2 to track lane 1/2.
export function trackLapDistanceM(track) {
  const plan = readTrackPlan(track?.layout);
  if (plan) {
    const traced = traceTrackPlan(plan);
    if (plan.freePlacement && !traced.connectivity.closed) return null;
    // An explicitly saved manual length overrides the geometric estimate.
    if (Number.isFinite(track?.length) && track.length > 0) return track.length;
    const lengths = traced.laneLengthsM;
    return lengths.every((n) => Number.isFinite(n) && n > 0) ? (lengths[0] + lengths[1]) / 2 : null;
  }
  return Number.isFinite(track?.length) && track.length > 0 ? track.length : null;
}
