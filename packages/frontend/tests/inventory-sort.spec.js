import { test, expect, planner } from './planner-fixture'
import { emptyRailInventory, RAIL_INVENTORY_KEY, emptyTrackPlan } from '../../shared/src/index.js'
const api = 'http://localhost:3101'
test('stock-first sorting works in editor and print list without changing saved quantities or track', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  const stock = emptyRailInventory()
  Object.assign(stock.counts, { 30350: 2, 30351: 9, 30373: 2 })
  await request.put(`${api}/api/preferences/${RAIL_INVENTORY_KEY}`, {
    data: { value: stock },
  })
  const plan = {
    ...emptyTrackPlan(),
    pieces: [{ type: 'Control_unit', level: 0, jointDegrees: 0 }],
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Bestand sortieren', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('track-parts-manager').click()
  const rows = planner(page).getByTestId('rail-inventory-editor').locator('tbody tr'),
    order = () => rows.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')))
  await expect(planner(page).getByTestId('stock-30351')).toHaveValue('9')
  expect((await order()).slice(0, 4)).toEqual([
    'inventory-row-30351',
    'inventory-row-30350',
    'inventory-row-30373',
    'inventory-row-20509',
  ])
  await planner(page).getByTestId('inventory-sort').selectOption('stockAsc')
  expect((await order()).slice(0, 4)).toEqual([
    'inventory-row-30350',
    'inventory-row-30373',
    'inventory-row-30351',
    'inventory-row-20509',
  ])
  await planner(page).getByTestId('inventory-sort').selectOption('article')
  expect((await order()).slice(0, 4)).toEqual([
    'inventory-row-30350',
    'inventory-row-30351',
    'inventory-row-30373',
    'inventory-row-20509',
  ])
  await planner(page).getByTestId('inventory-print-preview').click()
  await expect(planner(page).getByTestId('inventory-print-sort')).toHaveValue('article')
  const printOrder = () =>
    planner(page)
      .getByTestId('inventory-print-sheet')
      .locator('tbody tr')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')))
  expect(await printOrder()).toEqual([
    'inventory-print-row-30350',
    'inventory-print-row-30351',
    'inventory-print-row-30373',
    'inventory-print-row-30352',
  ])
  await planner(page).getByTestId('inventory-print-sort').selectOption('stockDesc')
  expect((await printOrder()).slice(0, 3)).toEqual([
    'inventory-print-row-30351',
    'inventory-print-row-30350',
    'inventory-print-row-30373',
  ])
  await page.screenshot({
    path: '../../local-carrera/pruefungen/teilebestand-sortierung.png',
  })
  expect((await (await request.get(`${api}/api/preferences/${RAIL_INVENTORY_KEY}`)).json()).data).toEqual(stock)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
