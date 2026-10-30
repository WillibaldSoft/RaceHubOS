import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const api = 'http://localhost:3101'
const out = path.resolve(import.meta.dirname, '../../../../../outputs')
const plan = JSON.parse(
  fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
)
test.beforeEach(async ({ page, request }) => {
  await request.put(api + '/api/preferences/race:speed-scale-source', { data: { value: 'car' } })
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  await request.put(`${api}/api/addons/track-planner`, {
    data: { enabled: false },
  })
  await request.put(`${api}/api/preferences/race:speed-display`, {
    data: { value: { mode: 'actual', defaultScale: '1:32' } },
  })
})
test('inactive add-on preserves layout while manual track forms and read-only previews work', async ({
  page,
  request,
}) => {
  const original = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: {
          name: 'Optionaler Plan',
          layout: JSON.stringify(plan),
          length: 20,
        },
      })
    ).json()
  ).data
  const assets = []
  page.on('request', (r) => {
    if (r.url().includes('/api/addons/track-planner/assets/')) assets.push(r.url())
  })
  await page.goto(`/tracks/${original.id}`)
  await page.getByTestId('edit-track').click()
  await expect(page.getByTestId('planner-unavailable')).toBeVisible()
  await expect(page.getByTestId('planner-addon-frame')).toHaveCount(0)
  const fields = page.getByRole('spinbutton')
  await fields.first().fill('25')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect
    .poll(async () => (await (await request.get(`${api}/api/tracks/${original.id}`)).json()).data.length)
    .toBe(25)
  expect((await (await request.get(`${api}/api/tracks/${original.id}`)).json()).data.layout).toBe(original.layout)
  expect(assets).toEqual([])
})
test('settings activate the installed bundle, editor imports, saves and exports across the frame boundary', async ({
  page,
  request,
}) => {
  await page.goto('/settings')
  await page.getByTestId('toggle-planner-addon').click()
  await expect(page.getByTestId('addon-settings')).toContainText('Installiert und aktiviert')
  await page.goto('/tracks')
  await page.getByRole('button', { name: 'Neue Strecke' }).click()
  await page.getByTestId('enable-track-editor').click()
  const editor = page.frameLocator('[data-testid="planner-addon-frame"]')
  await expect(editor.getByTestId('track-plan-editor')).toBeVisible()
  await editor.getByTestId('planner-files-toggle').click()
  await editor.getByTestId('track-plan-import').setInputFiles({
    name: 'Übertragener Plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  })
  await expect(editor.getByTestId('graph-track-canvas')).toBeVisible()
  await editor.locator('.planner-name').fill('Add-on Übertragung')
  await editor.getByTestId('planner-save').click()
  await expect(editor.getByRole('status').filter({ hasText: 'gespeichert' })).toBeVisible()
  await expect(page.getByTestId('planner-addon-frame')).toHaveCount(0)
  const saved = (await (await request.get(`${api}/api/tracks?limit=100`)).json()).data.find(
    (t) => t.name === 'Add-on Übertragung'
  )
  expect(saved).toBeTruthy()
  expect(JSON.parse(saved.layout).pieces).toEqual(plan.pieces)
  await page.goto(`/tracks/${saved.id}`)
  await page.getByTestId('edit-track').click()
  await expect(editor.getByTestId('graph-track-canvas')).toBeVisible()
  await editor.getByTestId('planner-files-toggle').click()
  const downloadPromise = page.waitForEvent('download')
  await editor.getByTestId('export-track-json').click()
  const download = await downloadPromise
  expect(JSON.parse(await fs.promises.readFile(await download.path(), 'utf8')).pieces).toEqual(plan.pieces)
  await page.screenshot({
    path: path.join(out, 'planner-addon-installed.png'),
  })
})
test('race speed uses manual distance without planner: actual, per-car scale, fallback, next lap and missing values', async ({
  page,
  request,
}) => {
  const base = (await (await request.get(`${api}/api/sessions/e2e-s1`)).json()).data
  const data = {
    ...base,
    status: 'finished',
    track: {
      id: 'manual-speed',
      name: 'Manuelle 20-Meter-Strecke',
      length: 20,
      layout: null,
    },
    drivers: base.drivers.slice(0, 1).map((d) => ({
      ...d,
      car: { ...d.car, scale: '1:24' },
      totalLaps: 1,
      lastLapTime: 10000,
      bestLapTime: 10000,
      totalTime: 10000,
    })),
  }
  await page.route('**/api/sessions/e2e-s1', (route) => route.fulfill({ json: { success: true, data } }))
  await page.goto('/sessions/e2e-s1')
  const speed = page.getByTestId('lap-average-speed')
  await expect(speed).toContainText('7,20 km/h')
  await expect(speed).toContainText('tatsächlich')
  await request.put(`${api}/api/preferences/race:speed-display`, {
    data: { value: { mode: 'scale', defaultScale: '1:32' } },
  })
  await page.reload()
  await expect(speed).toContainText('172,80 km/h')
  await expect(speed).toContainText('1:24')
  data.drivers[0].car.scale = null
  await page.reload()
  await expect(speed).toContainText('230,40 km/h')
  await expect(speed).toContainText('1:32')
  await request.put(`${api}/api/preferences/race:speed-display`, {
    data: { value: { mode: 'scale', defaultScale: '1:24' } },
  })
  await page.reload()
  await expect(speed).toContainText('172,80 km/h')
  data.drivers[0].lastLapTime = 5000
  data.drivers[0].totalLaps = 2
  await page.reload()
  await expect(speed).toContainText('345,60 km/h')
  await expect(speed).toContainText('Runde 2')
  await speed.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: path.join(out, 'planner-speed-scale.png'),
    fullPage: true,
  })
  data.drivers[0].lastLapTime = null
  await page.reload()
  await expect(speed).toContainText('—')
  await expect(speed).not.toContainText('km/h')
  data.drivers[0].lastLapTime = 5000
  data.track.length = null
  await page.reload()
  await expect(speed).toContainText('—')
})
test('global settings persist after reload and large race screen also labels scale speed', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('speed-mode').selectOption('scale')
  await page.getByTestId('speed-default-scale').selectOption('1:24')
  await page.reload()
  await expect(page.getByTestId('speed-mode')).toHaveValue('scale')
  await expect(page.getByTestId('speed-default-scale')).toHaveValue('1:24')
  await page.goto('/settings/race-screen')
  await expect(page.getByTestId('race-screen-canvas').getByTestId('lap-average-speed').first()).toContainText('1:24')
})

test('explicit vehicle scale persists and changes the selected car speed from the global override', async ({
  page,
  request,
}) => {
  const fixture = (await (await request.get(api + '/api/sessions/e2e-s1')).json()).data
  const data = {
    ...fixture,
    status: 'finished',
    track: { ...fixture.track, length: 20, layout: null },
    drivers: fixture.drivers
      .slice(0, 1)
      .map((d) => ({ ...d, car: { ...d.car, scale: '1:24' }, totalLaps: 1, lastLapTime: 10000, totalTime: 10000 })),
  }
  await page.route('**/api/sessions/e2e-s1', (route) => route.fulfill({ json: { success: true, data } }))
  await page.goto('/settings')
  await expect(page.getByTestId('speed-scale-source')).toHaveValue('car')
  await page.getByTestId('speed-mode').selectOption('scale')
  await page.getByTestId('speed-scale-source').selectOption('global')
  await page.reload()
  await expect(page.getByTestId('speed-scale-source')).toHaveValue('global')
  await page.goto('/sessions/e2e-s1')
  await expect(page.getByTestId('lap-average-speed')).toContainText('230,40 km/h')
  await page.goto('/settings')
  await page.getByTestId('speed-scale-source').selectOption('car')
  await page.reload()
  await expect(page.getByTestId('speed-scale-source')).toHaveValue('car')
  await page.goto('/sessions/e2e-s1')
  await expect(page.getByTestId('lap-average-speed')).toContainText('172,80 km/h')
  await expect(page.getByTestId('lap-average-speed')).toContainText('1:24')
})
