import { test, expect, planner } from './planner-fixture'
import { emptyTrackPlan } from '../../shared/src/trackPlan.js'
const api = 'http://localhost:3101'
test('special assemblies are legable; toolbar inventory replaces/adds stock and prints without changing source track', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('racehubos-lang', 'de')
    window.print = () => {
      window.__partsPrinted = true
    }
  })
  const p = {
    ...emptyTrackPlan(),
    pieces: [{ type: 'Control_unit', level: 0, jointDegrees: 0 }],
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Sonderteile Referenz', layout: JSON.stringify(p) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('catalogue-tab-specials').click()
  for (const id of ['Schikane_30373', 'Engstelle_links_30350', 'Engstelle_rechts_30351']) {
    await planner(page).getByTestId(`palette-${id}`).click()
    await planner(page).getByTestId('add-track-piece').click()
  }
  await expect(planner(page).getByTestId('special-geometry-warning')).toContainText('Planungsnäherung')
  await expect(planner(page).getByTestId('graph-track-canvas').getByTestId('special-road-2')).toHaveCount(1)
  await planner(page).getByTestId('track-fit').click()
  await page.screenshot({
    path: '../../local-carrera/pruefungen/sonderteile-legbar.png',
  })
  await planner(page).getByTestId('track-parts-manager').click()
  await planner(page).getByTestId('seed-rail-inventory').click()
  await expect(planner(page).getByTestId('stock-30350')).toHaveValue('1')
  await planner(page).getByTestId('inventory-transfer-mode').selectOption('add')
  await planner(page).getByTestId('seed-rail-inventory').click()
  await expect(planner(page).getByTestId('stock-30350')).toHaveValue('2')
  await planner(page).getByTestId('stock-30350').fill('7')
  await planner(page).getByTestId('save-rail-inventory').click()
  await expect(planner(page).getByTestId('track-parts-dialog').getByRole('status')).toContainText('gespeichert')
  await planner(page).getByTestId('inventory-print-preview').click()
  await expect(planner(page).getByTestId('inventory-print-row-30350')).toContainText('7')
  await planner(page).getByTestId('inventory-print').click()
  expect(
    await planner(page)
      .locator('body')
      .evaluate(() => window.__partsPrinted)
  ).toBe(true)
  await page.emulateMedia({ media: 'print' })
  await expect(planner(page).getByTestId('inventory-print-sheet')).toBeVisible()
  await page.emulateMedia({ media: 'screen' })
  await page.screenshot({
    path: '../../local-carrera/pruefungen/teileverwaltung-druck.png',
  })
  await planner(page).getByTestId('inventory-close').click()
  await planner(page).getByTestId('track-parts-manager').click()
  await expect(planner(page).getByTestId('stock-30350')).toHaveValue('7')
  await planner(page).getByTestId('inventory-source').selectOption(source.id)
  await planner(page).getByTestId('inventory-transfer-mode').selectOption('replace')
  await planner(page).getByTestId('seed-rail-inventory').click()
  await expect(planner(page).getByTestId('stock-30350')).toHaveValue('0')
  await expect(planner(page).getByTestId('stock-30352')).toHaveValue('1')
  await planner(page).getByTestId('inventory-close').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data
  expect(JSON.parse(saved.layout).pieces.map((p) => p.type)).toEqual([
    'Control_unit',
    'Schikane_30373',
    'Engstelle_links_30350',
    'Engstelle_rechts_30351',
  ])
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
