import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('catalogue tabs and shoulder submenu stay left; transforms move below the larger zoomable drawing', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1500, height: 1100 })
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url)))
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Catalogue layout source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const sidebar = planner(page).getByTestId('planner-catalogue-sidebar'),
    canvas = planner(page).getByTestId('graph-track-canvas'),
    controls = planner(page).getByTestId('track-transform-controls')
  await planner(page).getByTestId('catalogue-tab-straights').click()
  await expect(planner(page).getByTestId('palette-Standardgerade')).toBeVisible()
  await expect(planner(page).getByTestId('palette-Control_unit')).toHaveCount(0)
  await planner(page).getByTestId('catalogue-tab-curves').click()
  await expect(planner(page).getByTestId('palette-Kurve_4_15_rechts')).toBeVisible()
  await expect(planner(page).getByTestId('palette-Standardgerade')).toHaveCount(0)
  await planner(page).getByTestId('catalogue-tab-switches').click()
  await expect(planner(page).getByTestId('palette-double')).toBeVisible()
  await expect(planner(page).getByTestId('palette-curved')).toBeVisible()
  await planner(page).getByTestId('catalogue-tab-units').click()
  await expect(planner(page).getByTestId('palette-Control_unit')).toBeVisible()
  await canvas.getByTestId('rail-54').click()
  await planner(page).getByTestId('catalogue-tab-borders').click()
  await sidebar.getByTestId('track-borders').locator('summary').click()
  await expect(sidebar.getByTestId('border-left')).toBeVisible()
  await expect(sidebar.getByTestId('border-left-startCap')).toBeVisible()
  await expect(controls.getByTestId('free-part-x')).toBeVisible()
  const sb = await sidebar.boundingBox(),
    cb = await canvas.boundingBox(),
    tb = await controls.boundingBox()
  expect(sb.x + sb.width).toBeLessThan(cb.x + 1)
  expect(cb.width).toBeGreaterThan(1100)
  expect(tb.y).toBeGreaterThanOrEqual(cb.y + cb.height)
  await controls.getByTestId('free-part-x').fill('445')
  await controls.getByTestId('free-part-x').press('Tab')
  await expect(controls.getByTestId('free-part-x')).toHaveValue('445')
  await planner(page).getByTestId('track-undo').click()
  await planner(page).getByTestId('track-zoom-slider').fill('150')
  await expect(planner(page).getByTestId('track-zoom-percent')).toHaveText('150%')
  await planner(page).getByTestId('track-fit').click()
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox(),
    point = {
      x: Math.round(box.x + box.width * 0.6),
      y: Math.round(box.y + box.height * 0.5),
    }
  const worldAt = () =>
    canvas.evaluate((svg, p) => {
      const q = svg.createSVGPoint()
      q.x = p.x
      q.y = p.y
      const v = q.matrixTransform(svg.getScreenCTM().inverse())
      return { x: v.x, y: v.y }
    }, point)
  const before = await worldAt()
  await page.mouse.move(point.x, point.y)
  await page.mouse.wheel(0, -160)
  await expect(planner(page).getByTestId('track-zoom-percent')).toHaveText('115%')
  const after = await worldAt()
  expect(after.x).toBeCloseTo(before.x, 2)
  expect(after.y).toBeCloseTo(before.y, 2)
  await planner(page).getByTestId('track-fit').click()
  await expect(planner(page).getByTestId('track-zoom-percent')).toHaveText('100%')
  await planner(page).getByTestId('track-select-all').click()
  await expect(canvas).toHaveAttribute('data-selected-count', '55')
  await page.screenshot({
    path: '../../local-carrera/pruefungen/katalog-reiter-grosse-planflaeche.png',
    fullPage: true,
  })
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  await page.setViewportSize({ width: 900, height: 900 })
  await expect(planner(page).getByTestId('catalogue-tab-borders')).toBeVisible()
  expect(await canvas.evaluate((e) => e.getBoundingClientRect().right)).toBeLessThanOrEqual(900)
})
