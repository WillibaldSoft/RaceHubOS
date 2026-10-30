import { EXTRA_TRACK_ASSEMBLIES } from './carreraTrackCatalog.js';
// Movement groups are editor metadata: no rail geometry, wiring or switch state.
export const TRACK_ASSEMBLIES = Object.freeze({
  ...EXTRA_TRACK_ASSEMBLIES,
  double: ['DigitaleDoppelweiche_1', 'DigitaleDoppelweiche_2'],
  curved: ['Kurvenweiche_rechts_ai_1', 'Kurvenweiche_rechts_ai_2'],
});
export function validatePartGroups(value, count) {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Array.isArray(value.groups) ||
    value.groups.length > 1000 ||
    !Array.isArray(value.released) ||
    value.released.length > count
  )
    throw new Error('Invalid part groups');
  const valid = (n) => Number.isInteger(n) && n >= 0 && n < count,
    used = new Set();
  const groups = value.groups.map((g) => {
    if (!Array.isArray(g) || g.length < 2 || g.length > count || g.some((n) => !valid(n) || used.has(n)))
      throw new Error('Invalid part group');
    const unique = new Set(g);
    if (unique.size !== g.length) throw new Error('Duplicate group member');
    g.forEach((n) => used.add(n));
    return [...g].sort((a, b) => a - b);
  });
  if (value.released.some((n) => !valid(n)) || new Set(value.released).size !== value.released.length)
    throw new Error('Invalid released parts');
  return { groups, released: [...value.released].sort((a, b) => a - b) };
}
export function catalogueSelection(plan, index) {
  if (!plan.pieces[index]) return [];
  if (plan.partGroups?.released.includes(index)) return [index];
  for (const types of Object.values(TRACK_ASSEMBLIES))
    for (let offset = 0; offset < types.length; offset++) {
      const start = index - offset;
      if (
        start >= 0 &&
        types.every(
          (type, i) => plan.pieces[start + i]?.type === type && !plan.partGroups?.released.includes(start + i)
        )
      )
        return types.map((_, i) => start + i);
    }
  return [index];
}
export function assemblySelection(plan, index) {
  if (!plan.pieces[index]) return [];
  const group = plan.partGroups?.groups.find((g) => g.includes(index));
  if (group) return [...group];
  if (plan.partGroups?.released.includes(index)) return [index];
  if (plan.pit.enabled) {
    const indices = [];
    for (let i = plan.pit.entry, n = 0; n < plan.pieces.length; n++, i = (i + 1) % plan.pieces.length) {
      if (!plan.partGroups?.released.includes(i)) indices.push(i);
      if (i === plan.pit.merge) break;
    }
    if (indices.includes(index)) return indices;
  }
  return catalogueSelection(plan, index);
}
export function groupTrackParts(plan, indices) {
  const selection = [...new Set(indices.flatMap((i) => assemblySelection(plan, i)))].sort((a, b) => a - b);
  if (selection.length < 2) throw new Error('Select at least two parts');
  const selected = new Set(selection),
    state = plan.partGroups ?? { groups: [], released: [] };
  return {
    ...plan,
    partGroups: validatePartGroups(
      { groups: [...state.groups.filter((g) => !g.some((i) => selected.has(i))), selection], released: state.released },
      plan.pieces.length
    ),
  };
}
export function ungroupTrackParts(plan, indices) {
  const selected = new Set(indices.flatMap((i) => assemblySelection(plan, i))),
    state = plan.partGroups ?? { groups: [], released: [] };
  return {
    ...plan,
    partGroups: validatePartGroups(
      {
        groups: state.groups.filter((g) => !g.some((i) => selected.has(i))),
        released: [...new Set([...state.released, ...selected])],
      },
      plan.pieces.length
    ),
  };
}
// Delete/replacement drops only removed members; insertion never accidentally
// adopts new rails into a custom group. Remaining singleton groups dissolve.
export function remapPartGroups(state, at, remove, inserted) {
  if (!state) return undefined;
  const keep = (n) => n < at || n >= at + remove,
    map = (n) => (n < at ? n : n + inserted - remove);
  return {
    groups: state.groups.map((g) => g.filter(keep).map(map)).filter((g) => g.length > 1),
    released: state.released.filter(keep).map(map),
  };
}
