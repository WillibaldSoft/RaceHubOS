import { test, expect, planner } from './planner-fixture'
const api = 'http://localhost:3101'
test('attach shoulders and ends, inspect corrected room fit and print, save a copy and retain originals', async ({
  page,
  request,
}) => {
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
    roomPlan: {
      widthM: 1.2,
      depthM: 3,
      drivers: 1,
      driverWidthM: 0.8,
      driverDepthM: 0.8,
      aisleM: 0.8,
      edgeM: 0.15,
      maxLevels: 1,
      levelHeightMm: 150,
      maxGradePercent: 15,
    },
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Border source', layout: JSON.stringify(plan) },
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
  await canvas.getByTestId('rail-0').click()
  await planner(page).getByTestId('catalogue-tab-borders').click()
  await planner(page).getByTestId('track-borders').locator('summary').click()
  await planner(page).getByTestId('border-left').check()
  await planner(page).getByTestId('border-right').check()
  await planner(page).getByTestId('border-left-startCap').check()
  await planner(page).getByTestId('border-right-endCap').check()
  await expect(canvas.getByTestId('border-shape-0-left-strip')).toHaveCount(1)
  await expect(canvas.getByTestId('border-shape-0-right-endCap')).toHaveCount(1)
  await expect(planner(page).getByTestId('track-borders').getByTestId('border-count-20560')).toContainText('2')
  await expect(planner(page).getByTestId('track-borders').getByTestId('border-count-20598')).toContainText('2')
  await expect(planner(page).getByTestId('border-room-warning')).toHaveCount(0)
  await expect(planner(page).getByTestId('border-footprint')).toContainText('0.622')
  await planner(page).getByTestId('track-undo').click()
  await expect(canvas.getByTestId('border-shape-0-right-endCap')).toHaveCount(0)
  await planner(page).getByTestId('track-redo').click()
  await expect(canvas.getByTestId('border-shape-0-right-endCap')).toHaveCount(1)
  await canvas.getByTestId('rail-0').click()
  await planner(page).getByTestId('free-part-angle').fill('20')
  await planner(page).getByTestId('free-part-angle').press('Tab')
  await expect(canvas.getByTestId('border-shape-0-left-strip')).toHaveCount(1)
  await planner(page).getByTestId('track-print-preview').click()
  const dialog = planner(page).getByTestId('track-print-dialog')
  await expect(dialog.getByTestId('border-parts-list')).toBeVisible()
  await expect(dialog.getByTestId('border-shape-0-left-startCap')).toHaveCount(1)
  await planner(page).getByTestId('track-print-close').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    actual = JSON.parse(saved.layout)
  expect(actual.pieces[0].borders).toEqual({
    left: { startCap: true, endCap: false },
    right: { startCap: false, endCap: true },
  })
  expect(actual.pieces[0].placement.headingDegrees).toBe(20)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  await page.reload()
  await page.getByTestId('edit-track').click()
  await expect(canvas.getByTestId('border-shape-0-right-strip')).toHaveCount(1)
  expect(external).toEqual([])
})

test('Ctrl-click toggles multiple rails and applies shoulder sides and end pieces only to the selection', async ({
  page,
  request,
}) => {
  const plan = {
    kind: 'racehubos.track-plan',
    version: 1,
    pieces: ['Standardgerade', 'Kurve_2_30_rechts', 'Standardgerade'].map((type) => ({
      type,
      level: 0,
      jointDegrees: 0,
    })),
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
        data: {
          name: 'Multi shoulder selection',
          layout: JSON.stringify(plan),
        },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await canvas.getByTestId('rail-0').click()
  await planner(page).getByTestId('catalogue-tab-borders').click()
  await planner(page).getByTestId('track-borders').locator('summary').click()
  await planner(page).getByTestId('border-left').check()
  await canvas.getByTestId('rail-2').click({ modifiers: ['Control'] })
  await expect(canvas).toHaveAttribute('data-selected-count', '2')
  await expect(planner(page).getByTestId('border-left')).toHaveAttribute('aria-checked', 'mixed')
  await planner(page).getByTestId('border-apply-both').click()
  await expect(canvas.getByTestId('border-shape-0-right-strip')).toHaveCount(1)
  await expect(canvas.getByTestId('border-shape-2-right-strip')).toHaveCount(1)
  await expect(canvas.getByTestId('border-shape-1-right-strip')).toHaveCount(0)
  await planner(page).getByTestId('border-left-startCap').check()
  await expect(planner(page).getByTestId('track-borders').getByTestId('border-count-20598')).toContainText('2')
  await planner(page).getByTestId('free-track-snap').uncheck()
  await canvas.scrollIntoViewIfNeeded()
  const groupRail = await canvas.getByTestId('rail-0').boundingBox()
  await page.mouse.move(groupRail.x + groupRail.width / 2, groupRail.y + groupRail.height / 2)
  await page.mouse.down()
  await page.mouse.move(groupRail.x + groupRail.width / 2 + 25, groupRail.y + groupRail.height / 2 + 20, { steps: 5 })
  await page.mouse.up()
  await expect(canvas).toHaveAttribute('data-selected-count', '2')
  await canvas.getByTestId('rail-0').click({ modifiers: ['Control'] })
  await expect(canvas).toHaveAttribute('data-selected-count', '1')
  await canvas.getByTestId('rail-0').click({ modifiers: ['Control'] })
  await expect(canvas).toHaveAttribute('data-selected-count', '2')
  await planner(page).getByTestId('free-part-x').fill('100')
  await planner(page).getByTestId('free-part-y').fill('50')
  await planner(page).getByTestId('free-part-y').press('Tab')
  await expect(canvas).toHaveAttribute('data-selected-count', '2')
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const actual = JSON.parse(
    (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data.layout
  )
  expect(actual.pieces[0].borders.left.startCap).toBe(true)
  expect(actual.pieces[2].borders.left.startCap).toBe(true)
  expect(actual.pieces[1].borders).toBeUndefined()
  expect(actual.pieces[1].placement).toEqual({
    xMm: 345,
    yMm: 0,
    headingDegrees: 0,
  })
  expect(actual.pieces[0].placement).toEqual({
    xMm: 100,
    yMm: 50,
    headingDegrees: 0,
  })
  expect(actual.pieces[2].placement.xMm).toBeCloseTo(693.5)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})

test('fullscreen workspace caps only the free ends of a contiguous selection and exposes file exchange', async ({
  page,
  request,
}) => {
  const plan = {
    kind: 'racehubos.track-plan',
    version: 1,
    pieces: Array.from({ length: 3 }, () => ({
      type: 'Standardgerade',
      level: 0,
      jointDegrees: 0,
    })),
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
        data: { name: 'Continuous border run', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const editor = planner(page).getByTestId('track-plan-editor'),
    canvas = planner(page).getByTestId('graph-track-canvas')
  await expect(editor).toHaveAttribute('data-planner-expanded', 'true')
  await canvas.getByTestId('rail-0').click()
  await canvas.getByTestId('rail-1').click({ modifiers: ['Control'] })
  await canvas.getByTestId('rail-2').click({ modifiers: ['Control'] })
  await expect(canvas).toHaveAttribute('data-selected-count', '3')
  await planner(page).getByTestId('catalogue-tab-borders').click()
  await planner(page).getByTestId('track-borders').locator('summary').click()
  await planner(page).getByTestId('border-apply-both').click()
  await planner(page).getByTestId('border-auto-ends').click()
  await expect(planner(page).getByTestId('border-left-startCap')).toBeChecked()
  await expect(planner(page).getByTestId('border-left-endCap')).toBeChecked()
  await planner(page).getByTestId('border-left-startCap').uncheck()
  await planner(page).getByTestId('border-left-startCap').check()
  await expect(canvas.getByTestId('border-shape-0-left-startCap')).toHaveCount(1)
  await expect(canvas.getByTestId('border-shape-2-right-endCap')).toHaveCount(1)
  await expect(canvas.getByTestId('border-shape-1-left-startCap')).toHaveCount(0)
  await expect(canvas.getByTestId('border-shape-1-right-endCap')).toHaveCount(0)
  await expect(planner(page).getByTestId('track-borders').getByTestId('border-count-20598')).toContainText('4')
  await planner(page).getByTestId('planner-files-toggle').click()
  await expect(planner(page).getByTestId('planner-files')).toBeVisible()
  await expect(planner(page).getByTestId('import-softyroyal')).toBeVisible()
  await expect(planner(page).getByTestId('import-autorennbahn-trk')).toBeVisible()
  await expect(planner(page).getByTestId('export-softyroyal')).toBeVisible()
  await expect(planner(page).getByTestId('export-autorennbahn-trk')).toBeEnabled()
  const downloaded = page.waitForEvent('download')
  await planner(page).getByTestId('export-track-json').click()
  const file = await downloaded
  await planner(page)
    .getByTestId('track-plan-import')
    .setInputFiles(await file.path())
  await expect(canvas).toBeVisible()
  await expect(canvas.getByTestId('border-shape-1-left-startCap')).toHaveCount(0)
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const actual = JSON.parse(
    (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data.layout
  )
  expect(actual.pieces[1].borders.left).toEqual({
    startCap: false,
    endCap: false,
  })
  expect(actual.pieces[0].borders.right.startCap).toBe(true)
  expect(actual.pieces[2].borders.left.endCap).toBe(true)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
