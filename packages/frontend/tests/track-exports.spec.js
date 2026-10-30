import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('editor exports nonempty SBP and TRK files with the current double pit', async ({ page, request }) => {
  const plan = JSON.parse(
    fs.readFileSync(
      new URL('../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
  const created = await (
    await request.post(`${api}/api/tracks`, {
      data: { name: 'Fröhlichring Exporttest', layout: JSON.stringify(plan) },
    })
  ).json()
  expect(created.success).toBe(true)
  await page.goto(`/tracks/${created.data.id}`)
  await page.getByTestId('edit-track').click()
  await expect(planner(page).getByTestId('track-plan-editor')).toHaveAttribute('data-planner-expanded', 'true')
  await planner(page).getByTestId('planner-files-toggle').click()
  const sbpPromise = page.waitForEvent('download')
  await planner(page).getByTestId('export-softyroyal').click()
  const sbpDownload = await sbpPromise
  const sbp = JSON.parse(fs.readFileSync(await sbpDownload.path(), 'utf8'))
  expect(sbp.file).toBe('sbp')
  expect(sbp.items).toHaveLength(62)
  expect(sbp.racehubos.plan.pit.enabled).toBe(true)
  const trkPromise = page.waitForEvent('download')
  await planner(page).getByTestId('export-autorennbahn-trk').click()
  const trkDownload = await trkPromise
  const trk = fs.readFileSync(await trkDownload.path(), 'utf8')
  expect(trk).toContain('Bahnsystem=Digital 132')
  expect(trk).toContain('ItemNumber_1=55')
  expect(trk).toContain('RaceHubOSPlan=')
  await expect(planner(page).getByTestId('export-softyroyal')).toBeVisible()
  await page.screenshot({
    path: '../../local-carrera/pruefungen/strecken-exporte.png',
    fullPage: true,
  })
})
