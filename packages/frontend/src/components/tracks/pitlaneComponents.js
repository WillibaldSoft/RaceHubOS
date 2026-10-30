import { extraWorldPose, nativeFuelBayIndices, SOFTY_EXTRAS } from '@racehubos/shared'
const styles = {
  single: { short: 'ESG', article: '30341', color: '#0891b2' },
  fuel: { short: 'FUEL', article: '30361', color: '#d97706' },
  entry: { short: 'PIT-IN', article: '30356', color: '#be185d' },
  exit: { short: 'PIT-OUT', article: '30356', color: '#be185d' },
}
export function pitlaneComponents(plan, segments) {
  const fuel = new Set(nativeFuelBayIndices(plan, segments))
  const nativeParts = (plan.trackExtras || []).flatMap((e, i) => {
    if (e.hidden) return []
    if (!['single', 'pitEntry', 'pitExit'].includes(e.kind))
      return [
        {
          id: `extra-${i}`,
          kind: 'border',
          short: 'RS',
          article: SOFTY_EXTRAS[e.kind].article,
          color: '#dc2626',
          extraIndex: i,
          anchor: e.anchor,
          pose: extraWorldPose(e, segments),
        },
      ]
    const kind = fuel.has(i) ? 'fuel' : e.kind === 'single' ? 'single' : e.kind === 'pitEntry' ? 'entry' : 'exit'
    return [
      { ...styles[kind], id: `extra-${i}`, kind, extraIndex: i, anchor: e.anchor, pose: extraWorldPose(e, segments) },
    ]
  })
  if (plan.pit.native || !plan.pit.enabled) return nativeParts
  const p = plan.pit,
    entry = segments[p.entry]?.start,
    merge = segments[p.merge]?.end
  if (!entry || !merge || p.spacingMm % 345 || p.bayLengthMm % 345 || p.bayLengthMm < 1035) return nativeParts
  const c = Math.cos(entry.h),
    s = Math.sin(entry.h),
    parts = [...nativeParts],
    add = (id, kind, u, v, anchor = p.entry) =>
      parts.push({
        ...styles[kind],
        id,
        kind,
        anchor,
        pose: { xMm: entry.x + c * u - s * v, yMm: entry.y + s * u + c * v, headingDegrees: (entry.h * 180) / Math.PI },
      })
  const split = 345 + p.spacingMm,
    end = split + p.bayLengthMm,
    n = p.bayLengthMm / 345,
    mid = Math.floor((n - 1) / 2)
  for (let i = 0; i < p.spacingMm / 345; i++) add(`pit-common-${i}`, 'single', 345 + i * 345 + 172.5, 148.5)
  for (let lane = 0; lane < 2; lane++)
    for (let i = lane ? 1 : 0; i < (lane ? n - 1 : n); i++)
      add(`pit-bay-${lane}-${i}`, i === mid ? 'fuel' : 'single', split + i * 345 + 172.5, 148.5 + lane * 99)
  add('pit-entry', 'entry', 172.5, 99)
  add('pit-second-entry', 'entry', split + 172.5, 198)
  add('pit-merge', 'exit', end - 172.5, 198)
  const dx = merge.x - entry.x,
    dy = merge.y - entry.y,
    ex = dx * c + dy * s
  add('pit-exit', 'exit', ex - 172.5, 99, p.merge)
  return parts
}
export function pitlaneLegend(plan, segments) {
  const counts = new Map()
  for (const p of pitlaneComponents(plan, segments).filter((p) => p.kind !== 'border')) {
    const row = counts.get(p.kind) || { ...p, count: 0 }
    row.count++
    counts.set(p.kind, row)
  }
  return [...counts.values()]
}
