export function trackPartAppearance(type) {
  if (/^(Schikane|Engstelle)_/.test(type))
    return { family: 'Sonderteil', color: '#9333ea', short: type.startsWith('Schikane') ? 'SCH' : 'ENG' }
  const bank = type.startsWith('Steilkurve_')
  const curve = /^(?:Kurve|Steilkurve)_(\d)_(\d+)_(links|rechts)$/.exec(type)
  if (curve)
    return {
      family: `K${curve[1]}`,
      color: { '1': '#dc2626', '2': '#ea580c', '3': '#2563eb', '4': '#16a34a' }[curve[1]],
      short: `${bank ? 'SK' : 'K'}${curve[1]}/${curve[2]}°`,
    }
  if (type === 'Control_unit') return { family: 'CU', color: '#7c3aed', short: 'CU' }
  if (/weiche/i.test(type))
    return {
      family: 'Weiche',
      color: '#be185d',
      short: type.startsWith('Pit_') ? 'PIT' : type.startsWith('Kurven') ? 'KW' : 'DW',
    }
  if (['Standardgerade', 'Startampel_3spur_hinten'].includes(type))
    return { family: 'Standard', color: '#475569', short: 'SG' }
  if (type === 'Drittelgerade') return { family: '1/3', color: '#0891b2', short: '1/3' }
  if (type === 'Viertelgerade') return { family: '1/4', color: '#0f766e', short: '1/4' }
  return {
    family: 'Sonderteil',
    color: '#92400e',
    short: type === 'AdapterUnit' ? 'AU' : type === 'Check_lane' ? 'CHECK' : type === 'Multistart' ? 'MULTI' : 'START',
  }
}
