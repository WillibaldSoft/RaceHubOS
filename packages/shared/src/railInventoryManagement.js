import { validateRailInventory, railRequirements } from './railInventory.js';
export function transferRailRequirements(stock, plan, mode = 'replace') {
  if (!['replace', 'add'].includes(mode)) throw new Error('Invalid inventory transfer');
  const current = validateRailInventory(stock),
    required = railRequirements(plan);
  const counts = Object.fromEntries(
    Object.entries(required.counts).map(([article, count]) => [
      article,
      count + (mode === 'add' ? current.counts[article] : 0),
    ])
  );
  return { inventory: validateRailInventory({ version: 1, counts }), unresolved: required.unresolved };
}
// Keep owned articles above zero stock, independently of the selected ordering.
export function sortRailInventoryRows(rows, counts, order = 'stockDesc') {
  if (!['stockDesc', 'stockAsc', 'article'].includes(order)) throw new Error('Invalid inventory sort');
  return [...rows].sort((a, b) => {
    const x = counts[a.article] ?? 0,
      y = counts[b.article] ?? 0;
    return (
      Number(y > 0) - Number(x > 0) ||
      (order === 'stockDesc' ? y - x : order === 'stockAsc' ? x - y : 0) ||
      a.article.localeCompare(b.article, 'en', { numeric: true })
    );
  });
}
