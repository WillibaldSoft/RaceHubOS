import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { trackBounds, emptyTrackPlan } from '../../../packages/shared/src/index.js'
const fixture = JSON.parse(
  fs.readFileSync(new URL('../../../packages/frontend/tests/fixtures/froehlichring-softy-124.json', import.meta.url))
)
async function open(page, language = 'de', plan = fixture) {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(language)
  await page.getByTestId('standalone-new').click()
  await page.locator('.planner-name').fill('Layout Demo')
  if (plan.pieces.length) {
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: 'layout-demo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(plan)),
    })
  }
  await page.getByTestId('track-fit').click()
}
async function fitted(page, plan = fixture) {
  const bounds = trackBounds(plan)
  await expect
    .poll(() =>
      page.getByTestId('graph-track-canvas').evaluate((svg, b) => {
        const rect = svg.getBoundingClientRect(),
          m = svg.getScreenCTM()
        const points = [
          [b.x, b.y],
          [b.x + b.width, b.y + b.depth],
        ].map(([x, y]) => {
          const p = svg.createSVGPoint()
          p.x = x
          p.y = y
          return p.matrixTransform(m)
        })
        const body = document.querySelector('.planner-body')
        return (
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= innerWidth + 1 &&
          rect.bottom <= innerHeight + 1 &&
          rect.height > 100 &&
          points.every(
            (p) => p.x >= rect.left - 1 && p.x <= rect.right + 1 && p.y >= rect.top - 1 && p.y <= rect.bottom + 1
          ) &&
          body.scrollHeight <= body.clientHeight + 1 &&
          body.scrollTop === 0
        )
      }, bounds)
    )
    .toBe(true)
}
for (const [language, width, height] of [
  ['de', 1600, 900],
  ['fr', 1366, 768],
  ['en', 1024, 768],
]) {
  test(`workbench keeps the full plan and right controls visible at ${width}x${height} (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await open(page, language)
    await fitted(page)
    const svg = page.getByTestId('graph-track-canvas'),
      before = await svg.boundingBox()
    const right = await page.getByTestId('planner-selection-sidebar').boundingBox()
    expect(right.x).toBeGreaterThanOrEqual(before.x + before.width)
    await expect(page.getByTestId('add-track-piece')).toBeInViewport()
    await expect(page.getByTestId('track-fit')).toBeInViewport()
    await expect(page.getByTestId('planner-save')).toBeInViewport()
    await page.getByTestId('planner-advanced-details').locator('summary').click()
    await page.getByTestId('planner-inspector-body').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await fitted(page)
    expect(await svg.boundingBox()).toEqual(before)
    await expect(page.getByTestId('add-track-piece')).toBeInViewport()
    await page
      .getByTestId('planner-catalogue-sidebar')
      .locator('[role=tabpanel]')
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight
      })
    await fitted(page)
    await page.screenshot({ path: `/tmp/planner-workbench-${language}.png` })
  })
}
test('resizing preserves a fitted plan; small screens dock panels without hiding the drawing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  for (const size of [
    { width: 1200, height: 720 },
    { width: 390, height: 844 },
    { width: 768, height: 650 },
  ]) {
    await page.setViewportSize(size)
    await fitted(page)
    if (size.width <= 900) {
      await page.getByTestId('toggle-track-inspector').click()
      await fitted(page)
      await page.getByTestId('toggle-track-inspector').click()
      await fitted(page)
      await page.getByTestId('toggle-track-catalogue').click()
      await fitted(page)
      await expect(page.getByTestId('repeat-track-part')).toBeInViewport()
      await page.getByTestId('toggle-track-catalogue').click()
    }
  }
  await page.screenshot({ path: '/tmp/planner-workbench-compact.png' })
})
test('repeat placement follows the mouse, stamps repeatedly, snaps and exits with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, 'de', emptyTrackPlan())
  await page.getByTestId('repeat-track-part').check()
  await page.getByTestId('palette-Standardgerade').click()
  const svg = page.getByTestId('graph-track-canvas')
  async function point(x, y) {
    return svg.evaluate(
      (svg, { x, y }) => {
        const p = svg.createSVGPoint()
        p.x = x
        p.y = y
        const s = p.matrixTransform(svg.getScreenCTM())
        return { x: s.x, y: s.y }
      },
      { x, y }
    )
  }
  for (const [n, x] of [
    [1, 0],
    [2, 345],
    [3, 690],
  ]) {
    const p = await point(x, 0)
    await page.mouse.move(p.x, p.y)
    await expect(page.getByTestId('repeat-track-preview')).toBeVisible()
    await page.mouse.click(p.x, p.y)
    await expect(svg).toHaveAttribute('data-piece-count', String(n))
    await expect(page.getByTestId('repeat-track-part')).toBeChecked()
  }
  const duplicate = await point(690, 0)
  await page.mouse.move(duplicate.x, duplicate.y)
  await page.mouse.click(duplicate.x, duplicate.y)
  await expect(svg).toHaveAttribute('data-piece-count', '3')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('repeat-track-part')).not.toBeChecked()
  await expect(page.getByTestId('repeat-track-preview')).toHaveCount(0)
  await page.getByTestId('track-undo').click()
  await expect(svg).toHaveAttribute('data-piece-count', '2')
  await page.getByTestId('track-redo').click()
  await expect(svg).toHaveAttribute('data-piece-count', '3')
  await page.screenshot({ path: '/tmp/planner-repeat-placement.png' })
})

test('dragging and zoom remain accurate in the resized middle canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await open(page, 'de', emptyTrackPlan())
  for (let n = 0; n < 3; n++) await page.getByTestId('add-track-piece').click()
  await page.getByTestId('track-view-options').locator('summary').click()
  await page.getByTestId('free-track-snap').uncheck()
  await page.getByTestId('track-view-options').locator('summary').click()
  const svg = page.getByTestId('graph-track-canvas')
  await svg.getByTestId('rail-0').focus()
  await svg.getByTestId('rail-0').press('Enter')
  const positions = await svg.evaluate((svg) =>
    [
      [100, 0],
      [220, 80],
    ].map(([x, y]) => {
      const p = svg.createSVGPoint()
      p.x = x
      p.y = y
      const s = p.matrixTransform(svg.getScreenCTM())
      return { x: s.x, y: s.y }
    })
  )
  await page.mouse.move(positions[0].x, positions[0].y)
  await page.mouse.down()
  await page.mouse.move(positions[1].x, positions[1].y, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Number(await page.getByTestId('free-part-x').inputValue())).toBeCloseTo(120, 0)
  await expect.poll(async () => Number(await page.getByTestId('free-part-y').inputValue())).toBeCloseTo(80, 0)
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click()
  await expect(page.getByTestId('track-zoom-percent')).toHaveText('125%')
  await page.getByTestId('track-fit').click()
  await expect(page.getByTestId('track-zoom-percent')).toHaveText('100%')
  await expect(page.getByTestId('track-fit')).toBeInViewport()
})
