import { test, expect } from '@playwright/test'
import fs from 'node:fs'
test('free driving selection shows saved plans, photo fallback and preserves track layouts', async ({
  page,
  request,
}) => {
  const plan = fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url), 'utf8')
  const track = (
    await (
      await request.post('http://localhost:3101/api/tracks', { data: { name: 'Fröhlichring Vorschau', layout: plan } })
    ).json()
  ).data
  const photo = (
    await (
      await request.post('http://localhost:3101/api/tracks', {
        data: { name: 'Fotostrecke', img: '/uploads/preview.png' },
      })
    ).json()
  ).data
  await page.route('**/uploads/preview.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="48"><rect width="80" height="48" fill="green"/></svg>',
    })
  )
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  await page.goto('/race')
  const selector = page.getByTestId('race-track-select')
  await selector.click()
  const option = page.getByRole('option').filter({ has: page.getByTestId(`track-thumbnail-${track.id}`) })
  await expect(option.locator('svg [data-testid="unit-detail-3"]')).toHaveCount(1)
  await expect(
    page
      .getByRole('option')
      .filter({ has: page.getByTestId(`track-thumbnail-${photo.id}`) })
      .locator('img')
  ).toBeVisible()
  await expect(option.getByTestId(`track-lane-lengths-${track.id}`)).toContainText('Spur 1: 16,867 m')
  await expect(option.getByTestId(`track-lane-lengths-${track.id}`)).toContainText('Spur 2: 16,867 m')
  await option.click()
  await expect(selector).toContainText('Fröhlichring Vorschau')
  await expect(selector.getByTestId(`track-thumbnail-${track.id}`).locator('svg')).toBeVisible()
  await selector.click()
  await page.screenshot({ path: '../../local-carrera/pruefungen/freies-fahren-spurlaengen.png' })
  await page.keyboard.press('Escape')
  expect((await (await request.get(`http://localhost:3101/api/tracks/${track.id}`)).json()).data.layout).toBe(
    track.layout
  )
  expect(photo.id).toBeTruthy()
})

test('track cards and table show plans; both measured lanes remain distinct and missing values stay unknown', async ({
  page,
  request,
}) => {
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url), 'utf8'))
  plan.measuredLaneLengthsM = [16.25, 17.5]
  const track = (
    await (
      await request.post('http://localhost:3101/api/tracks', {
        data: { name: 'Zwei Spurlängen', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  const unknown = { id: 'unknown-lanes', name: 'Nur Gesamtlänge', length: 20, layout: null }
  let view = 'grid'
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  await page.route('**/api/tracks?**', (route) =>
    route.fulfill({ json: { success: true, data: [track, unknown], total: 2, hasMore: false } })
  )
  await page.route('**/api/preferences/viewMode:tracks', (route) =>
    route.fulfill({ json: { success: true, data: view } })
  )
  await page.goto('/tracks')
  const card = page.getByTestId('entity-card').filter({ has: page.getByTestId(`track-thumbnail-${track.id}`) })
  await expect(card.locator('svg [data-testid="unit-detail-3"]')).toHaveCount(1)
  const lanes = card.getByTestId(`track-lane-lengths-${track.id}`)
  await expect(lanes).toContainText('Spur 1: 16,250 m')
  await expect(lanes).toContainText('Spur 2: 17,500 m')
  await expect(lanes).toHaveAttribute('title', 'Gemessen')
  await expect(page.getByTestId('track-lane-lengths-unknown-lanes')).toContainText('Spur 1: —')
  await expect(page.getByTestId('track-lane-lengths-unknown-lanes')).not.toContainText('20')
  await page.screenshot({ path: '../../local-carrera/pruefungen/strecken-karten-vorschau.png' })
  view = 'list'
  await page.reload()
  await expect(
    page.getByTestId('list-row').filter({ has: page.getByTestId(`track-thumbnail-${track.id}`) })
  ).toBeVisible()
  expect((await (await request.get(`http://localhost:3101/api/tracks/${track.id}`)).json()).data.layout).toBe(
    track.layout
  )
})
