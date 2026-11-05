import { test, expect } from '@playwright/test'
import { emptyTrackPlan, enableFreePlacement } from '../../../packages/shared/src/index.js'
const plan = () =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
async function open(page, language = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(language)
  await page.getByTestId('standalone-new').click()
  await page.locator('.planner-name').fill('Replacement Demo')
  await page.getByTestId('planner-files-toggle').click()
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'replacement.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan())),
  })
}
async function select(page, index) {
  const rail = page.getByTestId('graph-track-canvas').getByTestId(`rail-${index}`)
  await rail.focus()
  await rail.press('Enter')
}
for (const language of ['de', 'en', 'fr'])
  test(`catalogue replaces selected rail, follows geometry and allows later cut (${language})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, language)
    await select(page, 1)
    await page.getByTestId('palette-Kurve_1_60_rechts').click()
    await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '5')
    await expect(page.getByTestId('replacement-cut-select')).toHaveValue('3')
    await expect(page.getByTestId('graph-track-canvas').getByTestId('rail-1')).toHaveAttribute('aria-label', /60/)
    await select(page, 2)
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(60, 4)
    await expect(page.getByTestId('replacement-cut-marker')).toBeVisible()
    // Recompute the cut from the original layout, without accumulating rotations.
    await page.getByTestId('replacement-cut-select').selectOption('1')
    await select(page, 3)
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(0, 4)
    await expect.poll(async () => Number(await page.getByTestId('free-part-x').inputValue())).toBeCloseTo(1035, 4)
    await page.getByTestId('replacement-cut-select').selectOption('3')
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(60, 4)
    await page.screenshot({ path: `/tmp/planner-follow-${language}.png` })
    await page.getByTestId('replacement-cut-done').click()
    await expect(page.getByTestId('replacement-cut-controls')).toHaveCount(0)
    await page.getByTestId('track-undo').click()
    await select(page, 3)
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(0, 4)
    await page.getByTestId('track-redo').click()
    await select(page, 3)
    await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(60, 4)
  })
test('repeat placement still chooses a part without replacing the selected rail', async ({ page }) => {
  await open(page)
  await select(page, 1)
  await page.getByTestId('repeat-track-part').check()
  await page.getByTestId('palette-Kurve_1_60_rechts').click()
  await expect(page.getByTestId('replacement-cut-controls')).toHaveCount(0)
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '5')
  await expect.poll(async () => Number(await page.getByTestId('free-part-angle').inputValue())).toBeCloseTo(0, 4)
})
