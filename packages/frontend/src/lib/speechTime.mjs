// Spoken times use hundredths for clarity; stored/displayed timing stays unchanged.
export function speechTimeParts(ms, locale = 'de') {
  if (!Number.isFinite(ms) || ms <= 0) return null
  const hundredths = Math.round(ms / 10)
  return {
    minutes: Math.floor(hundredths / 6000),
    seconds: ((hundredths % 6000) / 100).toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false }),
  }
}
export function speechRate(value) {
  return Number.isFinite(value) ? Math.max(0.8, Math.min(1.2, value)) : 0.95
}
