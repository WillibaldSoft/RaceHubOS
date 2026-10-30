import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('realistic CU, two fuel bays and split switch guides render; CU releases and regrouping persists', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1500, height: 1100 })
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url))),
    source = (
      await (
        await request.post(`${api}/api/tracks`, {
          data: { name: 'Unit assembly source', layout: JSON.stringify(plan) },
        })
      ).json()
    ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await expect(canvas.getByTestId('unit-detail-3')).toBeVisible()
  await expect(canvas.getByTestId('fuel-detail-4')).toBeVisible()
  await expect(canvas.getByTestId('fuel-detail-5')).toBeVisible()
  await expect(canvas.getByTestId('switch-guide-51-0')).toBeVisible()
  await expect(canvas.getByTestId('switch-guide-52-0')).toBeVisible()
  await expect(canvas.getByTestId('pit-tongue-0')).toHaveCount(1)
  await canvas.getByTestId('rail-3').click()
  await expect(planner(page).getByTestId('ungroup-track-parts')).toBeEnabled()
  await planner(page).getByTestId('ungroup-track-parts').click()
  await expect(planner(page).getByTestId('ungroup-track-parts')).toBeDisabled()
  await planner(page).getByTestId('free-part-x').fill('-935')
  await planner(page).getByTestId('free-part-x').press('Tab')
  await expect(planner(page).getByTestId('free-part-x')).toHaveValue('-935')
  await planner(page).getByTestId('track-undo').click()
  await canvas.getByTestId('rail-3').click()
  await expect(planner(page).getByTestId('free-part-x')).toHaveValue('-1035')
  await planner(page).getByTestId('track-select-all').click()
  await planner(page).getByTestId('group-track-parts').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    actual = JSON.parse(saved.layout)
  expect(actual.partGroups.groups).toHaveLength(1)
  expect(actual.partGroups.groups[0]).toHaveLength(55)
  expect(actual.pieces).toEqual(plan.pieces)
  expect(actual.pit).toEqual(plan.pit)
  expect(actual.trackExtras).toEqual(plan.trackExtras)
  expect(saved.length).toBeCloseTo(16.8673997, 6)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  await page.reload()
  await page.getByTestId('edit-track').click()
  await canvas.getByTestId('rail-54').click()
  await expect(planner(page).getByTestId('ungroup-track-parts')).toBeEnabled()
  await planner(page).getByTestId('ungroup-track-parts').click()
  await expect(planner(page).getByTestId('ungroup-track-parts')).toBeDisabled()
  await planner(page).getByTestId('catalogue-tab-units').click()
  await planner(page).getByTestId('palette-Check_lane').click()
  await planner(page).getByTestId('add-track-piece').click()
  await expect(canvas.locator('[data-unit-kind="Check_lane"]')).toHaveCount(1)
  await planner(page).getByTestId('track-fit').click()
  await page.screenshot({
    path: '../../local-carrera/pruefungen/units-weichen-baugruppen.png',
  })
})
