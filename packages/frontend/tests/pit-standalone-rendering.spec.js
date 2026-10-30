import { test, expect } from '@playwright/test'
import fs from 'node:fs'
test('individually laid pit rails show a branch, an active entry and a fixed exit', async ({ page, request }) => {
  const plan = JSON.parse(
    fs.readFileSync(new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url))
  )
  plan.pit.enabled = false
  const { data: track } = await (
    await request.post('http://localhost:3101/api/tracks', {
      data: { name: 'Pitlane Einzelteile', layout: JSON.stringify(plan) },
    })
  ).json()
  await page.goto(`/tracks/${track.id}`)
  const entry = page.locator('[data-pit-switch-detail="active-entry"]'),
    exit = page.locator('[data-pit-switch-detail="passive-merge"]')
  await expect(entry).toHaveCount(1)
  await expect(exit).toHaveCount(1)
  for (const node of [entry, exit])
    await expect(node.locator('[data-rail-slots="pit-branch"] [data-slot-layer="groove"]')).toHaveCount(1)
  await expect(entry.locator('[data-pit-actuator]')).toHaveCount(1)
  await expect(exit.locator('[data-pit-actuator]')).toHaveCount(0)
  await expect(exit.locator('[data-pit-fixed-merge]')).toHaveCount(1)
  expect((await (await request.get(`http://localhost:3101/api/tracks/${track.id}`)).json()).data.layout).toBe(
    track.layout
  )
})
