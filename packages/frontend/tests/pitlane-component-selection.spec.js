import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
for (const native of [true, false])
  test(`pit components have independent labels and selection (${native ? 'native' : 'schematic'})`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
    const plan = JSON.parse(
      fs.readFileSync(
        new URL(
          native
            ? './fixtures/froehlichring-softy-124.json'
            : '../../../addons/track-planner/public/track-plans/froehlichring.json',
          import.meta.url
        )
      )
    )
    const source = (
      await (
        await request.post(`${api}/api/tracks`, {
          data: {
            name: `Pit-Komponenten ${native ? 'Softy' : 'Plan'}`,
            layout: JSON.stringify(plan),
          },
        })
      ).json()
    ).data
    await page.goto(`/tracks/${source.id}`)
    await page.getByTestId('edit-track').click()
    await expect(planner(page).getByTestId('track-group-controls')).toBeVisible()
    await expect(planner(page).getByTestId('group-track-parts')).toContainText('Kombination erstellen')
    await expect(planner(page).getByTestId('ungroup-track-parts')).toContainText('Kombination aufbrechen')
    await planner(page).getByTestId('track-labels').selectOption('types')
    await planner(page).getByTestId('track-type-colors').check()
    const id = native ? 'extra-2' : 'pit-common-0',
      fuel = native ? 'extra-4' : 'pit-bay-0-1',
      canvas = planner(page).getByTestId('graph-track-canvas')
    await expect(canvas.getByTestId(`pit-component-label-${id}`)).toHaveText('ESG')
    await expect(planner(page).getByTestId('pit-legend-single')).toContainText('30341')
    await (native ? canvas.getByTestId('native-extra-2') : canvas.getByTestId(`schematic-component-${id}`)).click()
    await expect(planner(page).getByTestId('selected-track-piece')).toContainText('ESG')
    await expect(planner(page).getByTestId('selected-track-piece')).toContainText('30341')
    await expect(planner(page).getByTestId('selected-pit-component')).toContainText('1-spurig')
    await expect(canvas).not.toContainText('Zwei parallele Boxenplätze')
    if (!native) {
      await planner(page).getByTestId('track-layer-filter').selectOption('1')
      await expect(canvas.getByTestId(`schematic-component-${id}`)).toHaveCount(0)
      await planner(page).getByTestId('track-layer-filter').selectOption('all')
    }
    await planner(page).getByTestId('select-whole-pit-combination').click()
    await expect(planner(page).getByTestId('ungroup-track-parts')).toBeEnabled()
    await planner(page).getByTestId('ungroup-track-parts').click()
    await expect(planner(page).getByTestId('ungroup-track-parts')).toBeDisabled()
    await planner(page).getByTestId('track-undo').click()
    await planner(page).getByTestId(`select-pit-component-${id}`).click()
    await expect(planner(page).getByTestId('replace-track-piece')).toBeDisabled()
    await expect(planner(page).getByTestId('delete-track-piece')).toBeDisabled()
    await planner(page).getByTestId(`select-pit-component-${fuel}`).click()
    await expect(planner(page).getByTestId('selected-track-piece')).toContainText('30361')
    await canvas.getByTestId(`rail-${native ? 1 : 0}`).click()
    await expect(planner(page).getByTestId('selected-track-piece')).toContainText('2-spurig')
    await planner(page).getByTestId('track-print-preview').click()
    await expect(planner(page).getByTestId('track-print-dialog').getByTestId('pit-legend-single')).toContainText(
      '30341'
    )
    await planner(page).getByTestId('track-print-close').click()
    await planner(page).getByTestId(`select-pit-component-${id}`).click()
    await page.screenshot({
      path: `../../local-carrera/pruefungen/pit-komponenten-${native ? 'native' : 'schematisch'}.png`,
    })
    expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  })
