export const symbolNames = [
  'users',
  'home',
  'dashboard',
  'flag',
  'trophy',
  'clock',
  'map',
  'teams',
  'driver',
  'car',
  'stats',
  'scale',
  'grid',
  'terminal',
  'settings',
  'gauge',
  'route',
  'fuel',
  'wrench',
  'medal',
  'zap',
  'emojiFlag',
  'emojiCar',
  'emojiTrophy',
  'emojiClock',
  'emojiMap',
  'emojiTeam',
  'emojiDriver',
  'emojiStats',
  'emojiSettings',
  'emojiFuel',
]
export const navigationDefaults = {
  '/': ['gauge', '#2563eb'],
  '/race': ['flag', '#16a34a'],
  '/championships': ['trophy', '#d97706'],
  '/history': ['clock', '#7c3aed'],
  '/tracks': ['route', '#0891b2'],
  '/teams': ['teams', '#db2777'],
  '/drivers': ['driver', '#ea580c'],
  '/cars': ['car', '#dc2626'],
  '/stats': ['stats', '#4f46e5'],
  '/balancing': ['scale', '#0d9488'],
  '/displays': ['grid', '#9333ea'],
  '/test': ['terminal', '#475569'],
  '/settings': ['settings', '#64748b'],
}
export function normalizeNavigation(value) {
  const source = value && typeof value === 'object' ? value : {}
  const size =
    typeof source.size === 'number' && Number.isFinite(source.size) ? Math.min(32, Math.max(16, source.size)) : 22
  const result = { version: 1, original: source.original === true, size, badges: source.badges !== false, items: {} }
  for (const [path, [icon, color]] of Object.entries(navigationDefaults)) {
    const item = source.items?.[path]
    result.items[path] = {
      icon: symbolNames.includes(item?.icon) ? item.icon : icon,
      color: typeof item?.color === 'string' && /^#[a-f0-9]{6}$/i.test(item.color) ? item.color : color,
    }
  }
  return result
}

// Icon shapes used by the original sidebar, before appearance customization.
export function originalNavigation() {
  const config = normalizeNavigation({ original: true, size: 16, badges: false })
  config.items['/'].icon = 'dashboard'
  config.items['/tracks'].icon = 'map'
  config.items['/drivers'].icon = 'users'
  config.items['/stats'].icon = 'dashboard'
  return config
}
