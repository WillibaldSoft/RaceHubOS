import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('legacy plan has no invented startlight and two modelled FUEL rails appear in parts list', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Ohne Startampel', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  await expect(planner(page).getByTestId('palette-Startampel_3spur_hinten')).toHaveCount(0)
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await expect(canvas.getByTestId('rail-0')).toHaveAttribute('aria-label', /Standardgerade/)
  await expect(canvas.getByTestId('rail-0').locator('[data-unit-kind]')).toHaveCount(0)
  for (const bay of [1, 2]) await expect(canvas.getByTestId(`pit-bay-${bay}`)).toContainText('30361')
  await planner(page).getByTestId('track-parts-manager').click()
  await planner(page).getByTestId('inventory-print-list').selectOption('required')
  await planner(page).getByTestId('inventory-print-preview').click()
  await expect(planner(page).getByTestId('inventory-print-row-30361')).toContainText('2')
  await expect(planner(page).getByTestId('inventory-print-row-30341')).toContainText('3')
  await expect(planner(page).getByTestId('inventory-print-row-30354')).toHaveCount(0)
  await expect(planner(page).getByTestId('track-parts-dialog').getByRole('alert')).toHaveCount(0)
  await page.screenshot({
    path: '../../local-carrera/pruefungen/teileliste-ohne-startampel.png',
  })
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
test('native fuel drawings and material quantities resolve the same two stations', async ({ page, request }) => {
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url)))
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Native Tankplätze', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  for (const i of [4, 5])
    await expect(page.getByTestId(`native-extra-${i}`)).toHaveAttribute('data-part-article', '30361')
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('track-parts-manager').click()
  await planner(page).getByTestId('inventory-print-list').selectOption('required')
  await expect(planner(page).getByTestId('inventory-print-row-30361')).toContainText('2')
  await expect(planner(page).getByTestId('inventory-print-row-30341')).toContainText('1')
})
