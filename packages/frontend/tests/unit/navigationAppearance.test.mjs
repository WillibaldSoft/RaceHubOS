import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNavigation, navigationDefaults } from '../../src/lib/navigationAppearance.mjs'
test('partial or damaged saved navigation remains renderable and bounded', () => {
  const config = normalizeNavigation({
    size: 999,
    items: { '/race': { icon: 'unknown', color: 'url(untrusted)' }, '/cars': { icon: 'emojiCar', color: '#abcdef' } },
  })
  assert.equal(config.size, 32)
  assert.equal(config.items['/race'].icon, navigationDefaults['/race'][0])
  assert.equal(config.items['/race'].color, navigationDefaults['/race'][1])
  assert.deepEqual(config.items['/cars'], { icon: 'emojiCar', color: '#abcdef' })
  assert.equal(Object.keys(config.items).length, 13)
  assert.equal(normalizeNavigation({ size: NaN }).size, 22)
  assert.equal(normalizeNavigation({ badges: false }).badges, false)
})

test('Anselme original preset persists original appearance without coloured badges', async () => {
  const { originalNavigation } = await import('../../src/lib/navigationAppearance.mjs')
  const config = originalNavigation()
  assert.equal(config.original, true)
  assert.equal(config.size, 16)
  assert.equal(config.badges, false)
  assert.deepEqual(normalizeNavigation(JSON.parse(JSON.stringify(config))), config)
  assert.deepEqual(
    Object.values(config.items).map((item) => item.icon),
    [
      'dashboard',
      'flag',
      'trophy',
      'clock',
      'map',
      'teams',
      'users',
      'car',
      'dashboard',
      'scale',
      'grid',
      'terminal',
      'settings',
    ]
  )
})

test('existing custom settings remain custom and keep their colours and badges', () => {
  const value = { size: 28, badges: true, items: { '/race': { icon: 'emojiFlag', color: '#abcdef' } } }
  const config = normalizeNavigation(value)
  assert.equal(config.original, false)
  assert.equal(config.size, 28)
  assert.equal(config.badges, true)
  assert.deepEqual(config.items['/race'], value.items['/race'])
})
