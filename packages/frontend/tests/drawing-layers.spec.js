import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('pit drawing is below bridge; active entries and passive merges differ', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Ebenen Brücke', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas')
  expect(
    await canvas.evaluate(
      (e) =>
        !!(
          e
            .querySelector('[data-testid="schematic-pit-drawing"]')
            .compareDocumentPosition(e.querySelector('[data-testid="rail-34"]')) & Node.DOCUMENT_POSITION_FOLLOWING
        )
    )
  ).toBe(true)
  await expect(canvas.getByTestId('active-entrySwitch')).toHaveCount(1)
  await expect(canvas.getByTestId('active-secondSwitch')).toHaveCount(1)
  await expect(canvas.getByTestId('pit-sharedExit')).toHaveAttribute('data-switch-kind', 'passive-merge')
  await expect(canvas.getByTestId('pit-sharedExit').locator('[data-switch-kind="active-entry"]')).toHaveCount(0)
  await planner(page).getByTestId('catalogue-tab-switches').click()
  await expect(planner(page).getByTestId('pit-entry-symbol')).toHaveAttribute('data-switch-kind', 'active-entry')
  await expect(planner(page).getByTestId('pit-exit-symbol')).toHaveAttribute('data-switch-kind', 'passive-merge')
  await expect(planner(page).getByTestId('pit-exit-symbol').getByTestId('pit-symbol-actuator')).toHaveCount(0)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
test('native road, exit and shoulder drawing layers can be adjusted and saved independently', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url)))
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Zeichenebenen', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await canvas.getByTestId('rail-1').click()
  await planner(page).getByTestId('drawing-layer-up').click()
  await expect(canvas.getByTestId('rail-1')).toHaveAttribute('data-draw-layer', '1')
  await planner(page).getByTestId('select-pit-component-extra-0').click()
  await planner(page).getByTestId('select-pit-carrier').click()
  await planner(page).getByTestId('drawing-layer-target').selectOption('left')
  await planner(page).getByTestId('drawing-layer-down').click()
  await expect(canvas.getByTestId('border-shape-0-left-strip')).toHaveAttribute('data-draw-layer', '-1')
  await planner(page).getByTestId('select-pit-component-extra-7').click()
  await expect(planner(page).getByTestId('selected-track-piece')).toContainText('Zusammenführung')
  await planner(page).getByTestId('drawing-layer-down').click()
  await expect(canvas.getByTestId('native-extra-7')).toHaveAttribute('data-draw-layer', '-1')
  await expect(canvas.getByTestId('native-extra-0').locator('[data-switch-kind="active-entry"]')).toHaveCount(1)
  await expect(canvas.getByTestId('native-extra-7').locator('[data-switch-kind="active-entry"]')).toHaveCount(0)
  await planner(page).getByTestId('select-whole-pit-combination').click()
  await expect(planner(page).getByTestId('drawing-layer-target')).toHaveValue('rails')
  await planner(page).getByTestId('select-pit-component-extra-12').click()
  await expect(planner(page).getByTestId('selected-track-piece')).toContainText('Randstreifen')
  await planner(page).getByTestId('drawing-layer-down').click()
  await expect(canvas.getByTestId('native-extra-12')).toHaveAttribute('data-draw-layer', '-1')
  await page.screenshot({
    path: '../../local-carrera/pruefungen/zeichenebenen-pitlane.png',
  })
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    p = JSON.parse(saved.layout)
  expect(p.pieces[1].drawLayer).toBe(1)
  expect(p.pieces[0].borders.left.drawLayer).toBe(-1)
  expect(p.trackExtras[7].drawLayer).toBe(-1)
  expect(p.trackExtras[12].drawLayer).toBe(-1)
  expect(p.laneLengthsM).toEqual(plan.laneLengthsM)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
