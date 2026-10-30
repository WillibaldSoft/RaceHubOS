import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('worker searches without external requests, shows both pit bays, cancels, and saves only a separate new track', async ({
  page,
  request,
}) => {
  test.setTimeout(90000)
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Offline detailed source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  const external = []
  page.on('request', (req) => {
    if (
      !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(req.url()) &&
      !req.url().startsWith('blob:') &&
      !req.url().startsWith('data:')
    )
      external.push(req.url())
  })
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('planner-mode').selectOption('room')
  await planner(page).getByTestId('room-reference').selectOption(source.id)
  await planner(page).getByTestId('seed-rail-inventory').click()
  await planner(page).getByTestId('use-rail-inventory').check()
  await planner(page).getByTestId('enable-detailed-search').check()
  await planner(page).getByTestId('search-attempts').fill('5000')
  await planner(page).getByTestId('generate-room-plan').click()
  await expect(planner(page).getByTestId('search-progress')).toBeVisible()
  await planner(page).getByTestId('cancel-track-search').click()
  await expect(planner(page).getByTestId('search-progress')).toHaveCount(0)
  await expect(planner(page).getByTestId('generate-room-plan')).toBeEnabled()
  await planner(page).getByTestId('search-attempts').fill('100')
  await planner(page).getByTestId('search-seed').fill('87654321')
  await planner(page).getByTestId('generate-room-plan').click()
  const proposal = planner(page).getByTestId('room-proposal-detailed')
  await expect(proposal).toBeVisible({ timeout: 45000 })
  await expect(proposal.getByTestId('pit-bay-1')).toHaveCount(1)
  await expect(proposal.getByTestId('pit-bay-2')).toHaveCount(1)
  const before = (await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data
  expect(before.layout).toBe(source.layout)
  expect(await planner(page).locator('[data-testid^="room-proposal-detailed"]').count()).toBeGreaterThan(0)
  const usedSeed = await planner(page).getByTestId('search-seed').inputValue()
  await planner(page).getByTestId('generate-room-plan').click()
  expect(await planner(page).getByTestId('search-seed').inputValue()).not.toBe(usedSeed)
  await planner(page).getByTestId('cancel-track-search').click()
  await planner(page).getByTestId('search-seed').fill(usedSeed)
  await planner(page).getByTestId('repeat-track-search').check()
  await planner(page).getByTestId('generate-room-plan').click()
  await expect(proposal).toBeVisible({ timeout: 45000 })
  expect(await planner(page).getByTestId('search-seed').inputValue()).toBe(usedSeed)
  await page.screenshot({
    path: '../../local-carrera/pruefungen/offline-ueberfahrt-doppelbox.png',
  })
  await planner(page).getByTestId('apply-room-detailed').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data
  const actual = JSON.parse(saved.layout)
  expect(actual.pit.spacingMm).toBe(plan.pit.spacingMm)
  expect(actual.pit.bayLengthMm).toBe(plan.pit.bayLengthMm)
  expect(actual.pit.entry).toBe(0)
  expect(actual.pieces.map((p) => p.type)).not.toEqual(plan.pieces.map((p) => p.type))
  expect(actual.roomPlan.detailedSearch.enabled).toBe(true)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  expect(external).toEqual([])
})

test('additional parts and curve character are saved with a separate shopping list, without changing source or owned stock', async ({
  page,
  request,
}) => {
  test.setTimeout(90000)
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Additional parts source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  const stockBefore = await (await request.get(`${api}/api/preferences/carreraRailInventory`)).json()
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('planner-mode').selectOption('room')
  await planner(page).getByTestId('room-reference').selectOption(source.id)
  await planner(page).getByTestId('seed-rail-inventory').click()
  await planner(page).getByTestId('use-rail-inventory').check()
  await planner(page).getByTestId('stock-30352').fill('0')
  await planner(page).getByTestId('allow-additional-parts').check()
  await planner(page).getByTestId('curve-style').selectOption('dynamic')
  await planner(page).getByTestId('enable-detailed-search').check()
  await planner(page).getByTestId('search-attempts').fill('100')
  await planner(page).getByTestId('generate-room-plan').click()
  const proposal = planner(page).getByTestId('room-proposal-detailed')
  await expect(proposal).toBeVisible({ timeout: 45000 })
  await expect(proposal.getByTestId('additional-parts')).toContainText('30352')
  await expect(proposal.getByTestId('curve-dynamics')).toBeVisible()
  await planner(page).getByTestId('apply-room-detailed').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    actual = JSON.parse(saved.layout)
  expect(actual.roomPlan.allowAdditionalParts).toBe(true)
  expect(actual.roomPlan.curveStyle).toBe('dynamic')
  expect(actual.roomPlan.inventory.counts['30352']).toBe(0)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  expect(await (await request.get(`${api}/api/preferences/carreraRailInventory`)).json()).toEqual(stockBefore)
  await page.getByTestId('saved-room-plan').click()
  await expect(page.getByTestId('additional-parts')).toContainText('30352')
})
