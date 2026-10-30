import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recoverView } from '../../src/lib/recoverView.mjs'

test('old build chunks recover once across routes, without a reload loop', () => {
  const values = new Map()
  let reloads = 0
  const browser = {
    navigator: { onLine: true },
    sessionStorage: {
      getItem: (key) => values.get(key),
      setItem: (key, value) => values.set(key, value),
    },
    location: { reload: () => reloads++ },
  }
  for (const message of [
    'Failed to fetch dynamically imported module: /assets/old.js',
    'error loading dynamically imported module: /assets/old.js',
  ]) {
    values.clear()
    assert.equal(recoverView(new Error(message), browser, 100000), true)
    assert.equal(recoverView(new Error(message), browser, 100001), false)
  }
  assert.equal(reloads, 2)
  assert.equal(recoverView(new Error('ReferenceError: unknown variable'), browser, 200000), false)
  browser.navigator.onLine = false
  assert.equal(recoverView(new Error('Importing a module script failed.'), browser, 200000), false)
  browser.navigator.onLine = true
  browser.sessionStorage.setItem = () => {
    throw new Error('blocked storage')
  }
  assert.equal(recoverView(new Error('Unable to preload CSS'), browser, 200000), false)
  assert.equal(reloads, 2)
})
