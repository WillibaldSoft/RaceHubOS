import test from 'node:test'
import assert from 'node:assert/strict'
import { speechLocale, voicesByLanguage } from '../../src/lib/speech.js'

test('upstream speech locales and English fallback remain available with local Piper support', () => {
  assert.equal(speechLocale('de'), 'de-DE')
  assert.equal(speechLocale('fr'), 'fr-FR')
  assert.equal(speechLocale('en'), 'en-US')
  assert.equal(speechLocale('unknown'), 'en-US')
})
test('browser voice discovery is safe when unavailable and places the interface language first', () => {
  const previous = globalThis.speechSynthesis
  try {
    delete globalThis.speechSynthesis
    assert.deepEqual(voicesByLanguage('de'), [])
    const values = [
      { lang: 'en-US', name: 'English' },
      { lang: 'de-DE', name: 'Deutsch' },
      { lang: 'fr-FR', name: 'Français' },
    ]
    globalThis.speechSynthesis = { getVoices: () => values }
    const sorted = voicesByLanguage('de')
    assert.equal(sorted[0].lang, 'de-DE')
    assert.equal(sorted.length, 3)
    assert.equal(values[0].lang, 'en-US', 'the browser list is not mutated')
  } finally {
    if (previous) globalThis.speechSynthesis = previous
    else delete globalThis.speechSynthesis
  }
})
