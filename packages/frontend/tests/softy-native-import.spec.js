import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
import { SOFTY_GUIDS as G, exportSoftyRoyal } from '../../shared/src/index.js'
const api = 'http://localhost:3101'
test('native Softy file imports offline as a new track with double box, crossing and shoulders', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 })
  const original = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: {
          name: 'Keep original Softy source',
          layout: JSON.stringify(original),
        },
      })
    ).json()
  ).data
  const value = JSON.parse(fs.readFileSync(new URL('./fixtures/softy-native-froehlichring.sbp', import.meta.url)))
  const straight = value.items.find((i) => i.guid === G.straight),
    h = (straight.rotation * Math.PI) / 180
  value.items.push({
    guid: G.borderStandard,
    position: {
      x: straight.position.x + Math.sin(h) * 148.5,
      y: straight.position.y - Math.cos(h) * 148.5,
    },
    rotation: straight.rotation,
  })
  value.items.push({
    guid: G.borderEndRight,
    position: {
      x: straight.position.x + Math.cos(h) * 172.5 + Math.sin(h) * 99,
      y: straight.position.y + Math.sin(h) * 172.5 - Math.cos(h) * 99,
    },
    rotation: straight.rotation,
  })
  const external = []
  page.on('request', (r) => {
    if (r.url().startsWith('https://')) external.push(r.url())
  })
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('planner-files-toggle').click()
  await planner(page)
    .getByTestId('track-plan-import')
    .setInputFiles({
      name: 'Fröhlichring Softy geändert.sbp',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    })
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await expect(canvas).toHaveAttribute('data-piece-count', '55')
  await expect(planner(page).getByTestId('softy-import-report')).toBeVisible()
  await expect(canvas.locator('[data-native-kind="pitEntry"]')).toHaveCount(2)
  await expect(canvas.locator('[data-native-kind="pitExit"]')).toHaveCount(2)
  await expect(canvas.locator('[data-native-kind="borderStandard"]')).toHaveCount(1)
  await expect(canvas.locator('[data-native-kind="borderEndRight"]')).toHaveCount(1)
  await expect(canvas.locator('[data-native-kind="single"]')).toHaveCount(3)
  await page.screenshot({
    path: '../../local-carrera/pruefungen/softy-nativ-import.png',
    fullPage: true,
  })
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    plan = JSON.parse(saved.layout)
  expect(saved.name).toContain('Softy')
  expect(plan.pit.native).toBe(true)
  expect(plan.softyImport.bays).toBe(2)
  expect(plan.laneLengthsM[0]).toBeCloseTo(16.8673997, 6)
  expect(plan.trackExtras.filter((e) => e.kind.startsWith('border'))).toHaveLength(2)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  await page.reload()
  await page.getByTestId('edit-track').click()
  await expect(canvas.locator('[data-native-kind="pitEntry"]')).toHaveCount(2)
  await planner(page).getByTestId('planner-files-toggle').click()
  const downloadPromise = page.waitForEvent('download')
  await planner(page).getByTestId('export-softyroyal').click()
  const download = await downloadPromise
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'))
  expect(exported.items).toHaveLength(64)
  expect(exported.items.filter((i) => i.guid === G.borderEndRight)).toHaveLength(1)
  await planner(page).getByTestId('planner-files-toggle').click()
  await planner(page).getByTestId('track-print-preview').click()
  await planner(page).getByTestId('track-print-view').selectOption('levels')
  await expect(planner(page).getByTestId('track-print-page')).toHaveCount(2)
  await planner(page).getByTestId('track-print-close').click()
  expect(external).toEqual([])
})
test('an unsupported native part cannot replace the current draft or stored track', async ({ page, request }) => {
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Reject unsupported SBP', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('planner-files-toggle').click()
  const value = exportSoftyRoyal(plan).file
  delete value.racehubos
  value.items.push({
    guid: 'unsupported-track-guid',
    position: { x: 0, y: 0 },
    rotation: 0,
  })
  await planner(page)
    .getByTestId('track-plan-import')
    .setInputFiles({
      name: 'unsupported.sbp',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(value)),
    })
  await expect(planner(page).getByRole('alert')).toContainText('unsupported-track-guid')
  await planner(page).getByTestId('planner-files-toggle').click()
  await expect(planner(page).getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '55')
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
