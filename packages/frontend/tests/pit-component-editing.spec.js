import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
test('released native pit switches can be replaced separately and turned; catalogue branches face the double box', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  const p = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url)))
  const { data: s } = await (
    await request.post('http://localhost:3101/api/tracks', {
      data: { name: 'Austausch Boxenanschluss', layout: JSON.stringify(p) },
    })
  ).json()
  await page.goto(`/tracks/${s.id}`)
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('catalogue-tab-switches').click()
  for (const id of ['pit-entry-symbol', 'pit-exit-symbol'])
    await expect(planner(page).getByTestId(id)).toHaveAttribute('data-pit-preview-heading', '180')
  await planner(page).getByTestId('select-pit-component-extra-3').click()
  await planner(page).getByTestId('palette-Pit_stop_weiche_ende').click()
  await expect(planner(page).getByTestId('replace-track-piece')).toBeEnabled()
  await planner(page).getByTestId('replace-track-piece').click()
  await expect(planner(page).getByTestId('graph-track-canvas').getByTestId('native-extra-3')).toHaveAttribute(
    'data-native-kind',
    'pitExit'
  )
  await planner(page).getByTestId('rotate-pit-component').click()
  await planner(page).getByTestId('rotate-pit-component').click()
  await planner(page).getByTestId('palette-Pit_stop_weiche_anfang').click()
  await planner(page).getByTestId('replace-track-piece').click()
  await expect(planner(page).getByTestId('graph-track-canvas').getByTestId('native-extra-3')).toHaveAttribute(
    'data-native-kind',
    'pitEntry'
  )
  await planner(page).getByTestId('planner-save').click()
  const n = JSON.parse((await (await request.get(`http://localhost:3101/api/tracks/${s.id}`)).json()).data.layout)
  expect(n.pieces).toEqual(p.pieces)
  expect(n.laneLengthsM).toEqual(p.laneLengthsM)
})
