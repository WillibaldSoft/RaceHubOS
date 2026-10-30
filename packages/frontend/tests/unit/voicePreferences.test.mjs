import test from 'node:test'
import assert from 'node:assert/strict'
import { voiceIdsFromPreference } from '../../src/lib/voicePreferences.mjs'
test('adopting upstream per-language voices preserves legacy German and other local Piper choices', () => {
  assert.deepEqual(voiceIdsFromPreference('_piper-thorsten', 'en'), { de: '_piper-thorsten' })
  assert.deepEqual(voiceIdsFromPreference('_piper:fr_FR-siwis-medium', 'de'), { fr: '_piper:fr_FR-siwis-medium' })
  assert.deepEqual(voiceIdsFromPreference('browser-de', 'de'), { de: 'browser-de' })
  assert.deepEqual(voiceIdsFromPreference('_piper-auto'), { de: '_piper-auto', en: '_piper-auto', fr: '_piper-auto' })
})
test('separate language preferences survive reload and malformed values are discarded', () => {
  const value = { de: '_piper-thorsten', en: 'English voice', fr: 'French voice' }
  assert.deepEqual(voiceIdsFromPreference(value), value)
  assert.deepEqual(voiceIdsFromPreference({ de: 5, en: '', xx: 'voice' }), {})
  for (const invalid of [null, [], 42, '']) assert.deepEqual(voiceIdsFromPreference(invalid), {})
})
