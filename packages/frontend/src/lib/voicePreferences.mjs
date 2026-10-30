// Anselme's per-language preferences also accept the existing local Piper IDs.
export function voiceIdsFromPreference(value, language = 'fr') {
  const supported = ['de', 'en', 'fr']
  if (typeof value === 'string') {
    if (!value) return {}
    if (value === '_piper-auto') return Object.fromEntries(supported.map((lang) => [lang, value]))
    const local = value === '_piper-thorsten' ? 'de' : /^_piper:(de|en|fr)[_-]/.exec(value)?.[1]
    return { [local || (supported.includes(language) ? language : 'fr')]: value }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([lang, voice]) => supported.includes(lang) && typeof voice === 'string' && voice)
  )
}
