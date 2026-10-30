import { TRACK_PARTS, validateTrackPlan } from './trackPlan.js';
import { catalogueSelection, remapPartGroups } from './trackAssemblies.js';
export { TRACK_ASSEMBLIES } from './trackAssemblies.js';
export const trackSelection = catalogueSelection;
export function editTrackPieces(input, index, action, types = []) {
  const plan = validateTrackPlan(input),
    selection = trackSelection(plan, index);
  const start = selection[0] ?? plan.pieces.length;
  const at =
    action === 'before' ? start : action === 'after' ? (selection.at(-1) ?? plan.pieces.length - 1) + 1 : start;
  const remove = ['replace', 'delete'].includes(action) ? selection.length : 0;
  if (!['before', 'after', 'replace', 'delete'].includes(action) || types.some((t) => !TRACK_PARTS[t]))
    throw new Error('Invalid track edit');
  const level = plan.pieces[index]?.level ?? 0;
  const inserted =
    action === 'delete'
      ? []
      : types.map((type, i) => ({
          type,
          level,
          ...(action === 'replace' && plan.pieces[start]?.drawLayer !== undefined
            ? { drawLayer: plan.pieces[start].drawLayer }
            : {}),
          jointDegrees: action === 'replace' && i === 0 ? (plan.pieces[start]?.jointDegrees ?? 0) : 0,
        }));
  const pieces = [...plan.pieces];
  pieces.splice(at, remove, ...inserted);
  const remap = (n) => (n < at ? n : n >= at + remove ? n + inserted.length - remove : at);
  const pit = { ...plan.pit, entry: remap(plan.pit.entry), merge: remap(plan.pit.merge) };
  if (
    !pieces.length ||
    pieces[pit.entry]?.type !== 'Pit_stop_weiche_anfang' ||
    pieces[pit.merge]?.type !== 'Pit_stop_weiche_ende'
  )
    pit.enabled = false;
  if (!pit.enabled) {
    pit.entry = Math.min(pit.entry, Math.max(0, pieces.length - 1));
    pit.merge = Math.min(pit.merge, Math.max(0, pieces.length - 1));
  }
  const partGroups = remapPartGroups(plan.partGroups, at, remove, inserted.length);
  const trackExtras = plan.trackExtras
    ?.filter((e) => e.anchor === undefined || e.anchor < at || e.anchor >= at + remove)
    .map((e) => (e.anchor === undefined ? e : { ...e, anchor: remap(e.anchor) }));
  return {
    plan: validateTrackPlan({
      ...plan,
      pieces,
      pit,
      ...(partGroups ? { partGroups } : {}),
      ...(trackExtras ? { trackExtras } : {}),
      measuredLaneLengthsM: null,
    }),
    selected: pieces.length ? Math.min(at, pieces.length - 1) : -1,
  };
}
