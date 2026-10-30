import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('catalogue stock is editable, persistent and constrains several mixed-radius variants without modifying the source track', async ({
  page,
  request,
}) => {
  const plan = JSON.parse(
    fs.readFileSync(
      new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  const created = await (
    await request.post(`${api}/api/tracks`, {
      data: { name: 'Stock source', layout: JSON.stringify(plan) },
    })
  ).json()
  const source = created.data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('planner-mode').selectOption('room')
  await planner(page).getByTestId('room-reference').selectOption(source.id)
  await planner(page).getByTestId('seed-rail-inventory').click()
  await expect(planner(page).getByTestId('stock-30352')).toHaveValue('1')
  await expect(planner(page).getByTestId('stock-30347')).toHaveValue('2')
  await expect(planner(page).getByTestId('stock-30365')).toHaveValue('1')
  await planner(page).getByTestId('stock-20509').fill('9')
  await planner(page).getByTestId('save-rail-inventory').click()
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/api/preferences/carreraRailInventory`)).json()).data?.counts['20509']
    )
    .toBe(9)
  const invalid = await request.put(`${api}/api/preferences/carreraRailInventory`, {
    data: { value: { version: 1, counts: { 20509: -1 } } },
  })
  expect(invalid.status()).toBe(400)
  await planner(page).getByTestId('use-rail-inventory').check()
  await planner(page).getByTestId('generate-room-plan').click()
  await expect(planner(page).getByTestId('room-proposal-oval')).toBeVisible()
  await expect(planner(page).getByTestId('room-proposal-oval-2')).toBeVisible()
  await planner(page).getByTestId('room-proposal-oval').getByTestId('rail-requirements').locator('summary').click()
  await expect(planner(page).getByTestId('room-proposal-oval').getByTestId('rail-requirements')).toContainText(
    /suffisant|reicht aus|sufficient/
  )
  await planner(page).getByTestId('room-proposal-oval').screenshot({
    path: '../../local-carrera/pruefungen/schienenbestand-variante.png',
  })
  await planner(page).getByTestId('stock-30352').fill('0')
  await planner(page).getByTestId('generate-room-plan').click()
  await expect(planner(page).getByTestId('room-proposal-oval')).toHaveCount(0)
  await page.reload()
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('planner-mode').selectOption('room')
  await expect(planner(page).getByTestId('stock-20509')).toHaveValue('9')
  await expect(planner(page).getByTestId('stock-30352')).toHaveValue('1')
  const original = await (await request.get(`${api}/api/tracks/${source.id}`)).json()
  expect(original.data.layout).toBe(source.layout)
})
