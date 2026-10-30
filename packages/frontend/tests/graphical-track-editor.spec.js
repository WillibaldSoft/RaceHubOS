import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('offline graphical placement, selection, replacement, undo and persisted geometry', async ({ page, request }) => {
  const sourcePlan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Graphic source', layout: JSON.stringify(sourcePlan) },
      })
    ).json()
  ).data
  const external = []
  page.on('request', (r) => {
    if (r.url().startsWith('https://')) external.push(r.url())
  })
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await expect(canvas).toHaveAttribute('data-piece-count', '55')
  await expect(planner(page).getByTestId('track-piece-list')).toHaveCount(0)
  await planner(page).getByTestId('track-layer-filter').selectOption('0')
  await canvas.getByTestId('rail-4').click()
  await expect(planner(page).getByTestId('selected-track-piece')).toContainText('K1')
  await planner(page).getByTestId('palette-Kurve_3_30_rechts').click()
  await planner(page).getByTestId('replace-track-piece').click()
  await expect(planner(page).getByTestId('selected-track-piece')).toContainText('K3')
  await planner(page).getByTestId('track-undo').click()
  await canvas.getByTestId('rail-4').click()
  await expect(planner(page).getByTestId('selected-track-piece')).toContainText('K1')
  await planner(page).getByTestId('track-redo').click()
  await canvas.getByTestId('rail-4').click()
  await expect(planner(page).getByTestId('selected-track-piece')).toContainText('K3')
  await planner(page).getByTestId('palette-Standardgerade').click()
  await canvas.getByTestId('track-connector').click()
  await expect(canvas).toHaveAttribute('data-piece-count', '56')
  await planner(page).getByTestId('track-type-colors').check()
  await planner(page).getByTestId('track-labels').selectOption('both')
  await expect(canvas.getByTestId('rail-label-4')).toContainText('K3')
  await expect(canvas.getByTestId('rail-4').locator('path[stroke="#2563eb"]')).toHaveCount(1)
  await expect(planner(page).getByTestId('track-type-legend')).toContainText('K3')
  await planner(page).getByTestId('track-layer-filter').selectOption('1')
  await expect(canvas.getByTestId('rail-0')).toHaveCount(0)
  await planner(page).getByTestId('track-layer-filter').selectOption('all')
  await page.screenshot({
    path: '../../local-carrera/pruefungen/grafischer-planer.png',
  })
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    actual = JSON.parse(saved.layout)
  expect(actual.pieces.length).toBe(56)
  expect(actual.pieces[4].type).toBe('Kurve_3_30_rechts')
  expect(actual.pieces[5].type).toBe('Standardgerade')
  expect(actual.pit.enabled).toBe(true)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  expect(external).toEqual([])
})
test('print views contain type colours, build order and separate levels and hide application chrome for printing', async ({
  page,
  request,
}) => {
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Print source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('track-print-preview').click()
  const dialog = planner(page).getByTestId('track-print-dialog')
  await expect(dialog.getByTestId('track-type-legend')).toContainText('K1')
  await planner(page).getByTestId('track-print-view').selectOption('assembly')
  await expect(dialog.getByTestId('rail-label-0')).toContainText('1')
  await planner(page).getByTestId('track-print-view').selectOption('levels')
  await expect(planner(page).getByTestId('track-print-page')).toHaveCount(2)
  await page.emulateMedia({ media: 'print' })
  await expect(planner(page).getByTestId('track-print-now')).toBeHidden()
  await expect(planner(page).getByTestId('graph-track-canvas')).toBeHidden()
  await expect(planner(page).getByTestId('track-print-page').first()).toBeVisible()
  await page.emulateMedia({ media: 'screen' })
  await planner(page).getByTestId('track-print-view').selectOption('colors')
  await page.screenshot({
    path: '../../local-carrera/pruefungen/grafischer-planer-druck.png',
  })
  await planner(page).getByTestId('track-print-close').click()
  await expect(dialog).toHaveCount(0)
})

test('dragging a complete assembly docks it and keyboard undo restores it after removal', async ({ page, request }) => {
  const plan = {
    kind: 'racehubos.track-plan',
    version: 1,
    pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }],
    pit: {
      enabled: false,
      entry: 0,
      merge: 0,
      spacingMm: 345,
      bayLengthMm: 1035,
    },
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Drag source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await expect(planner(page).getByTestId('track-plan-editor')).toHaveAttribute('data-planner-expanded', 'true')
  await planner(page).getByTestId('palette-double').scrollIntoViewIfNeeded()
  await planner(page)
    .getByTestId('palette-double')
    .dragTo(planner(page).getByTestId('graph-track-canvas'), {
      targetPosition: { x: 200, y: 100 },
    })
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await expect(canvas).toHaveAttribute('data-piece-count', '3')
  await planner(page).getByTestId('delete-track-piece').click()
  await expect(canvas).toHaveAttribute('data-piece-count', '1')
  await canvas.press('Control+z')
  await expect(canvas).toHaveAttribute('data-piece-count', '3')
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})

test('free dragging, rotation, snapping and saved coordinates survive reload without moving neighbours', async ({
  page,
  request,
}) => {
  const plan = {
    kind: 'racehubos.track-plan',
    version: 1,
    pieces: [
      { type: 'Standardgerade', level: 0, jointDegrees: 0 },
      { type: 'Standardgerade', level: 0, jointDegrees: 0 },
    ],
    pit: {
      enabled: false,
      entry: 0,
      merge: 0,
      spacingMm: 345,
      bayLengthMm: 1035,
    },
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Free placement source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await expect(planner(page).getByTestId('track-plan-editor')).toHaveAttribute('data-planner-expanded', 'true')
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await planner(page).getByTestId('free-track-snap').uncheck()
  const rail = await canvas.getByTestId('rail-1').boundingBox()
  await page.mouse.move(rail.x + rail.width / 2, rail.y + rail.height / 2)
  await page.mouse.down()
  await page.mouse.move(rail.x + rail.width / 2 + 70, rail.y + rail.height / 2 + 60, { steps: 8 })
  await page.mouse.up()
  await expect(planner(page).getByTestId('free-track-status')).toBeVisible()
  expect(Number(await planner(page).getByTestId('free-part-y').inputValue())).toBeGreaterThan(20)
  await planner(page).getByTestId('free-part-angle').fill('25')
  await planner(page).getByTestId('free-part-angle').press('Tab')
  await expect(planner(page).getByTestId('free-part-angle')).toHaveValue('25')
  await planner(page).getByTestId('free-part-angle').fill('0')
  await planner(page).getByTestId('free-part-x').fill('365')
  await planner(page).getByTestId('free-part-y').fill('20')
  await planner(page).getByTestId('free-snap-now').click()
  await expect(planner(page).getByTestId('free-part-x')).toHaveValue('345')
  await expect(planner(page).getByTestId('free-part-y')).toHaveValue('0')
  await expect(planner(page).getByTestId('free-snap-indicator')).toBeVisible()
  await planner(page).getByTestId('free-part-angle').fill('35')
  await planner(page).getByTestId('free-part-x').fill('600')
  await planner(page).getByTestId('free-part-y').fill('200')
  await planner(page).getByTestId('free-part-y').press('Tab')
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    actual = JSON.parse(saved.layout)
  expect(actual.freePlacement).toBe(true)
  expect(actual.pieces[0].placement).toEqual({
    xMm: 0,
    yMm: 0,
    headingDegrees: 0,
  })
  expect(actual.pieces[1].placement).toEqual({
    xMm: 600,
    yMm: 200,
    headingDegrees: 35,
  })
  expect(saved.length).toBeNull()
  await page.reload()
  await page.getByTestId('edit-track').click()
  await canvas.getByTestId('rail-1').click()
  await expect(planner(page).getByTestId('free-part-x')).toHaveValue('600')
  await expect(planner(page).getByTestId('free-part-angle')).toHaveValue('35')
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
