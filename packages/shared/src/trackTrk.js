import { EXTRA_TRACK_PARTS } from './carreraTrackCatalog.js';
import { validateTrackPlan } from './trackPlan.js';

// Experimental Windows2022 TRK writer: known main-rail columns only.
// The full editor plan is kept in a separate ASCII extension for our round trip.
// No unsupported nested pit attachment names or joint-angle units are invented.
export function exportAutorennbahnTrk(input) {
  const plan = validateTrackPlan(input);
  if (plan.pieces.some((p) => Object.hasOwn(EXTRA_TRACK_PARTS, p.type)))
    throw new Error('New catalogue geometry requires RaceHubOS JSON export; native TRK mapping not verified.');
  if (plan.freePlacement) throw new Error('Free placement requires JSON or SBP export');
  if (!plan.pieces.length) throw new Error('Empty plan');
  const fields = {
    Bahnsystem: 'Digital 132',
    Version: '2022',
    Release: '1',
    Patch: '2',
    TrackNumber: '37',
    LevelNumber: String(1 + Math.max(...plan.pieces.map((p) => p.level))),
  };
  const defaults = {
    teile_Typ: 'Startteil',
    RSL: 'false',
    RSR: 'false',
    PLL: '',
    PLR: '',
    Pos1_links: '',
    Pos2_links: '',
    Pos1_rechts: '',
    Pos2_rechts: '',
    LPL: 'false',
    LPR: 'false',
    Center: '',
    Index: '0',
    Level: '0',
    Offset: '0',
    Alpha: 'false',
    LeftLane: '1',
    RightLane: '2',
    PL_LeftLane: '',
    PL_RightLane: '',
    ItemIsParentOfLeft: '0',
    ItemIsParentOfRight: '0',
  };
  for (let group = 1; group <= 37; group++) {
    const rows = [{ ...defaults }];
    if (group === 1)
      plan.pieces.forEach((p, i) =>
        rows.push({ ...defaults, teile_Typ: p.type, Index: String(i + 1), Level: String(p.level) })
      );
    for (const key of Object.keys(defaults)) fields[`${key}_${group}`] = rows.map((r) => r[key]).join(';');
    fields[`ItemNumber_${group}`] = String(rows.length - 1);
    fields[`SettingLaneColor_${group}`] = 'true';
  }
  Object.assign(fields, {
    Buildings: '',
    Buildings_x: '',
    Buildings_y: '',
    Buildings_rotation: '',
    Buildings_viewPoint: '',
    Buildings_alpha: '',
    BuildingNumber: '0',
    Textfield_text: '',
    Textfield_x: '',
    Textfield_y: '',
    Textfield_rotation: '',
    Textfield_alpha: '',
    Textfield_background: '',
    Textfield_backgroundColor: '',
    Textfield_border: '',
    Textfield_borderColor: '',
    Textfield_size: '',
    Textfield_align: '',
    Textfield_bold: '',
    Textfield_italic: '',
    Textfield_underline: '',
    Textfield_color: '',
    Textfield_width: '',
    TextfieldNumber: '0',
    ScaleFactorTrack: '1',
    TrackAndRoom_x: '0',
    TrackAndRoom_y: '0',
    TrackAndBuildings_x: '0',
    TrackAndBuildings_y: '0',
    TrackAndBuildings_rotation: String(plan.startHeadingDegrees),
    SettingLockRoom: 'false',
    SettingShowRoom: 'false',
    NumberOfSelectedItem: '0',
    TypeOfSelectedItem: 'Schiene',
    NumberOfSelectedTrack: '1',
    LastRoomFileName: '',
    RaceHubOSPlan: encodeURIComponent(JSON.stringify(plan)),
  });
  return {
    text: Object.entries(fields)
      .map(([key, value]) => `${key}=${value}`)
      .join('&'),
    notices: [
      'Experimental TRK2022 main-course export; opening in the Windows planner has not been runtime-tested. Native radii and closure may differ.',
      ...(plan.pit.enabled
        ? [
            'The modern double pit is preserved in the RaceHubOSPlan extension only; it is NOT exported as verified native Windows pit geometry.',
          ]
        : []),
      ...(plan.pieces.some((p) => p.jointDegrees)
        ? [
            'Schematic joint adjustments are preserved in the RaceHubOS extension; not assigned to undocumented native Offset units.',
          ]
        : []),
    ],
  };
}
