import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('native box lanes and unit lanes share rail material and remain above unit markings', async ({
  page,
  request,
}) => {
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url)))
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Slots native', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('edit-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas'),
    cu = canvas.getByTestId('rail-3'),
    pit = canvas.getByTestId('native-extra-4')
  // Horizontal single-lane straights have a zero-height bounding box.
  // Object-bounding-box gradients cannot paint their metal conductors.
  await expect(canvas.locator('linearGradient')).toHaveAttribute('gradientUnits', 'userSpaceOnUse')
  for (const index of [4, 5])
    await expect(canvas.getByTestId(`native-extra-${index}`).locator('[data-slot-layer="metal"]')).toHaveCount(1)
  for (const node of [cu, pit, canvas.getByTestId('rail-7')]) {
    await expect(node.locator('[data-slot-layer="recess"]').first()).toHaveAttribute('stroke-width', '17')
    await expect(node.locator('[data-slot-layer="metal"]').first()).toHaveAttribute('stroke-width', '10')
    await expect(node.locator('[data-slot-layer="groove"]').first()).toHaveAttribute('stroke-width', '3.5')
  }
  expect(
    await cu.evaluate(
      (e) =>
        !!(
          e.querySelector('[data-unit-kind]').compareDocumentPosition(e.querySelector('[data-rail-slots]')) &
          Node.DOCUMENT_POSITION_FOLLOWING
        )
    )
  ).toBe(true)
  expect(
    await pit.evaluate(
      (e) =>
        !!(
          e
            .querySelector('[data-testid^="fuel-detail"]')
            .compareDocumentPosition(e.querySelector('[data-rail-slots]')) & Node.DOCUMENT_POSITION_FOLLOWING
        )
    )
  ).toBe(true)
  await planner(page).getByTestId('catalogue-tab-units').click()
  await expect(planner(page).getByTestId('palette-Control_unit').locator('[data-slot-layer="groove"]')).toHaveCount(2)
  await page.screenshot({
    path: '../../local-carrera/pruefungen/einheitliche-slots-units-pitlane.png',
  })
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
test('schematic double pit draws four continuous rail paths after fuel markings', async ({ page, request }) => {
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Slots schematic', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  const slots = page.locator('[data-rail-slots="pit-schematic"]')
  await expect(slots.locator('[data-slot-layer="metal"]')).toHaveCount(4)
  await expect(slots.locator('[data-slot-layer="groove"]')).toHaveCount(4)
})
