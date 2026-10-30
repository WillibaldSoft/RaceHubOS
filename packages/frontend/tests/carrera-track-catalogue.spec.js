import { test, expect, planner } from './planner-fixture'
import { emptyTrackPlan } from '../../shared/src/trackPlan.js'
const api = 'http://localhost:3101'
test('offline catalogue adds banked curves and switch variants; article search, references and saved types persist', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  const plan = {
    ...emptyTrackPlan(),
    pieces: [{ type: 'Control_unit', level: 0, jointDegrees: 0 }],
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Katalogtest', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  const external = []
  page.on('request', (r) => {
    if (r.url().startsWith('https://')) external.push(r.url())
  })
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('catalogue-tab-banked').click()
  await expect(planner(page).getByTestId('palette-Steilkurve_4_15_rechts')).toContainText('20579')
  await planner(page).getByTestId('palette-Steilkurve_2_30_rechts').click()
  await planner(page).getByTestId('add-track-piece').click()
  await planner(page).getByTestId('catalogue-tab-switches').click()
  await planner(page).getByTestId('track-catalogue-search').fill('30343')
  await expect(planner(page).getByTestId('palette-leftSwitch')).toBeVisible()
  await planner(page).getByTestId('palette-leftSwitch').click()
  await planner(page).getByTestId('add-track-piece').click()
  await expect(planner(page).getByTestId('graph-track-canvas').getByTestId('switch-guide-2-0')).toHaveCount(1)
  await planner(page).getByTestId('track-catalogue-search').fill('')
  await planner(page).getByTestId('palette-curvedRightInOut').click()
  await planner(page).getByTestId('add-track-piece').click()
  await expect(planner(page).getByTestId('graph-track-canvas').getByTestId('switch-guide-5-0')).toHaveCount(1)
  await planner(page).getByTestId('catalogue-tab-manufacturer').click()
  await planner(page).getByTestId('manufacturer-search').fill('30373')
  await expect(planner(page).getByTestId('manufacturer-30373')).toContainText('ausdrücklich angenähert')
  await planner(page).getByTestId('manufacturer-search').fill('')
  await page.screenshot({
    path: '../../local-carrera/pruefungen/carrera-katalog-herstellerreferenz.png',
  })
  await planner(page).getByTestId('catalogue-tab-switches').click()
  await planner(page).getByTestId('track-fit').click()
  await page.screenshot({
    path: '../../local-carrera/pruefungen/carrera-katalog-weichen.png',
  })
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data
  expect(JSON.parse(saved.layout).pieces.map((p) => p.type)).toEqual([
    'Control_unit',
    'Steilkurve_2_30_rechts',
    'Weiche_links_1',
    'Weiche_links_2',
    'Kurvenweiche_rechts_ia_1',
    'Kurvenweiche_rechts_ia_2',
  ])
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
  expect(external).toEqual([])
})
