import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveDataRestoreReceipt } from '../../src/lib/dataRestoreReceipt.mjs'
test('socket-first import receipt survives before reload; other restore events do not replace it', () => {
  const values = new Map()
  const storage = { setItem: (key, value) => values.set(key, value) }
  saveDataRestoreReceipt({ source: 'cockpit', previous: 'before-import.json' }, storage)
  assert.equal(values.get('racehub:cockpit-backup'), 'before-import.json')
  for (const value of [null, {}, { source: 'restore', previous: 'other.json' }, { source: 'cockpit', previous: null }])
    saveDataRestoreReceipt(value, storage)
  assert.equal(values.get('racehub:cockpit-backup'), 'before-import.json')
})
