export const defaultAlerts = {
  enabled: true,
  threshold: 3,
  voice: true,
  emptyVoice: true,
  volume: 0.8,
  interruption: true,
  interruptionVoice: true,
  overlay: true,
  color: '#f59e0b',
  emptyColor: '#ef4444',
  pauseColor: '#f59e0b',
  font: 32,
}
export function normalizeAlerts(value) {
  const v = value && typeof value === 'object' ? value : {},
    result = { ...defaultAlerts }
  for (const key of ['enabled', 'voice', 'emptyVoice', 'interruption', 'interruptionVoice', 'overlay'])
    if (typeof v[key] === 'boolean') result[key] = v[key]
  for (const [key, min, max] of [
    ['threshold', 1, 14],
    ['volume', 0, 1],
    ['font', 18, 72],
  ])
    if (Number.isFinite(v[key]))
      result[key] = Math.min(max, Math.max(min, key === 'volume' ? v[key] : Math.round(v[key])))
  for (const key of ['color', 'emptyColor', 'pauseColor'])
    if (/^#[a-f0-9]{6}$/i.test(v[key] || '')) result[key] = v[key]
  return result
}
// Retain latches through missing telemetry. Only refuelling above reserve + 1 rearms.
export function fuelWarning(previous = {}, raw, threshold) {
  const state = { reserve: Boolean(previous.reserve), empty: Boolean(previous.empty) },
    events = []
  if (!Number.isInteger(raw) || raw < 0 || raw > 15) return { state, events }
  if (raw > threshold + 1) {
    state.reserve = false
    state.empty = false
  }
  if (raw === 0) {
    if (!state.empty) events.push('empty')
    state.empty = true
    state.reserve = true
  } else if (raw <= threshold && !state.reserve) {
    events.push('reserve')
    state.reserve = true
  }
  return { state, events }
}
export function interruptionReason(session, device) {
  if (!['active', 'paused', 'finishing'].includes(session?.status)) return null
  if (session.status === 'paused')
    return {
      key: 'paused',
      title: 'Rennen unterbrochen',
      text: 'Die Sitzung ist pausiert. Zum Fortsetzen die CU-Startampel vorbereiten.',
    }
  if (device.connectionState !== 'live')
    return {
      key: 'connection',
      title: 'CU-Verbindung unterbrochen',
      text: 'Keine aktuellen CU-Daten. Die Rennzeit wird dadurch nicht automatisch angehalten. Bitte Sitzung pausieren.',
    }
  if ([8, 9].includes(device.cuStatus?.start))
    return {
      key: 'cuStopped',
      title: 'Control Unit gestoppt',
      text: 'Die CU steht. Die Sitzung ist noch aktiv; bitte pausieren, damit die Rennzeit angehalten wird.',
    }
  return null
}
