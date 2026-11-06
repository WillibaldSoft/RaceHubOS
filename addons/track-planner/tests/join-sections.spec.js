import { test, expect } from '@playwright/test'
import { emptyTrackPlan, enableFreePlacement, transformFreeParts } from '../../../packages/shared/src/index.js'
const fixture = () =>
  transformFreeParts(
    enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
    }),
    [2, 3, 4],
    { degrees: 60, dx: 800, dy: 400 }
  )
async function open(page, lang = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(lang)
  await page.getByTestId('standalone-new').click()
  await page.locator('.planner-name').fill('Join demo')
  await page.getByTestId('planner-files-toggle').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'join.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture())) })
}
async function pick(page, index, add = false) {
  const rail = page.getByTestId('graph-track-canvas').getByTestId(`rail-${index}`)
  await rail.focus()
  await rail.press(add ? 'Control+Enter' : 'Enter')
}
for (const lang of ['de', 'en', 'fr'])
  test(`join marked sections with full geometry, undo and redo (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, lang)
    await pick(page, 0)
    await pick(page, 3, true)
    await expect(page.getByTestId('join-track-sections')).toBeEnabled()
    await expect(page.getByTestId('join-sections-preview')).toBeVisible()
    await expect(page.getByTestId('connection-candidate')).toHaveCount(0)
    await page.getByTestId('join-sections-pair').selectOption('1:1/2:0')
    await page.screenshot({ path: `/tmp/planner-join-before-${lang}.png` })
    await page.getByTestId('join-track-sections').click()
    await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '5')
    await expect(page.getByTestId('join-track-sections')).toBeDisabled()
    await expect(page.getByTestId('free-track-status')).toContainText('1')
    await pick(page, 2)
    await expect.poll(async () => Number(await page.getByTestId('free-part-x').inputValue())).toBeCloseTo(690, 3)
    await expect.poll(async () => Number(await page.getByTestId('free-part-y').inputValue())).toBeCloseTo(0, 3)
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(0, 3)
    await page.getByTestId('track-undo').click()
    await pick(page, 2)
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(60, 3)
    await page.getByTestId('track-redo').click()
    await pick(page, 2)
    await expect.poll(async () => Number(await page.getByTestId('free-part-x').inputValue())).toBeCloseTo(690, 3)
    await page.screenshot({ path: `/tmp/planner-join-after-${lang}.png` })
  })
test('Ctrl-click on open connection markers selects two sections', async ({ page }) => {
  await open(page)
  const a = page.getByTestId('open-port-0-0'),
    b = page.getByTestId('open-port-4-1')
  await a.focus()
  await a.press('Enter')
  await b.focus()
  await b.press('Control+Enter')
  await expect(page.getByTestId('join-track-sections')).toBeEnabled()
  await expect(page.getByTestId('join-sections-pair')).toHaveValue('0:0/4:1')
  await page.getByTestId('join-track-sections').click()
  await expect(page.locator('[data-testid^="open-port-"]')).toHaveCount(2)
})
