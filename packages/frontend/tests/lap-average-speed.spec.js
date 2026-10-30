import { test, expect } from '@playwright/test'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test.beforeEach(async ({ request }) => {
  await request.put('http://localhost:3101/api/preferences/race:speed-scale-source', { data: { value: 'car' } })
  await request.put(`${api}/api/preferences/race:speed-display`, {
    data: { value: { mode: 'actual', defaultScale: '1:32' } },
  })
})
test('last-lap speed is shown, updates for the next lap and has no value without time', async ({ page, request }) => {
  const fixture = await (await request.get(`${api}/api/sessions/e2e-s1`)).json()
  const plan = JSON.parse(
    fs.readFileSync(
      new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  const session = {
    ...fixture.data,
    name: 'Fröhlichring Geschwindigkeitstest',
    status: 'finished',
    track: {
      id: 'test-speed-track',
      name: 'Fröhlichring',
      layout: JSON.stringify(plan),
      length: 16.86739972061398,
    },
  }
  session.drivers = session.drivers.slice(0, 1).map((d) => ({
    ...d,
    totalLaps: 1,
    lastLapTime: 10000,
    bestLapTime: 10000,
    totalTime: 10000,
  }))
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  await page.route('**/api/sessions/e2e-s1', (route) => route.fulfill({ json: { success: true, data: session } }))
  await page.goto('/sessions/e2e-s1')
  const speed = page.getByTestId('lap-average-speed')
  await expect(speed).toContainText('≈ 6,07 km/h')
  await expect(speed).toContainText('Runde 1')
  await expect(speed).toHaveAttribute('title', /Spurwechseln und Boxengassen/)
  session.drivers[0].lastLapTime = 5000
  session.drivers[0].totalLaps = 2
  await page.reload()
  await expect(speed).toContainText('≈ 12,14 km/h')
  await expect(speed).toContainText('Runde 2')
  await speed.scrollIntoViewIfNeeded()
  await expect(speed).toBeVisible()
  await page.screenshot({
    path: '../../local-carrera/pruefungen/rundengeschwindigkeit.png',
    fullPage: true,
  })
  session.drivers[0].lastLapTime = null
  await page.reload()
  await expect(speed).toContainText('—')
  await expect(speed).not.toContainText('km/h')
})
test('large race screen renders average speed under each last-lap time', async ({ page }) => {
  await page.goto('/settings/race-screen')
  await expect(page.getByTestId('race-screen-canvas').getByTestId('lap-average-speed').first()).toContainText('km/h')
})
