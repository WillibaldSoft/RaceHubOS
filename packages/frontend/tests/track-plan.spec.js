import { test, expect, planner } from './planner-fixture'
test('plan a track, save two lanes, reopen and edit without losing the plan', async ({ page, request }) => {
  const name = `Track editor ${Date.now()}`
  await page.goto('/tracks')
  await page
    .getByRole('button', { name: /Nouveau circuit/ })
    .first()
    .click()
  await page.locator('input[required]').fill(name)
  await page.getByTestId('enable-track-editor').click()
  await planner(page).getByTestId('add-track-piece').click()
  await planner(page).getByTestId('add-track-piece').click()
  await expect(planner(page).getByTestId('track-plan-summary')).toContainText('0.690 / 0.690 m')
  await planner(page).getByTestId('planner-save').click()
  await expect(page.getByTestId('planner-addon-frame')).toHaveCount(0)
  const response = await request.get('http://localhost:3101/api/tracks?limit=100')
  const track = (await response.json()).data.find((t) => t.name === name)
  expect(track.length).toBe(0.69)
  expect(JSON.parse(track.layout).laneLengthsM).toEqual([0.69, 0.69])
  await page.goto(`/tracks/${track.id}`)
  await expect(page.getByTestId('track-plan-summary')).toContainText('0.690 / 0.690 m')
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('add-track-piece').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page.getByTestId('planner-addon-frame')).toHaveCount(0)
  await expect(page.getByTestId('track-plan-summary')).toContainText('1.035 / 1.035 m')
  const invalid = await request.put(`http://localhost:3101/api/tracks/${track.id}`, {
    data: {
      layout: JSON.stringify({
        kind: 'racehubos.track-plan',
        version: 1,
        pieces: [{ type: 'unknown' }],
      }),
    },
  })
  expect(invalid.status()).toBe(400)
})

test('load and save the current Froehlichring template including double pit and overpass', async ({
  page,
  request,
}) => {
  await page.goto('/tracks')
  await page
    .getByRole('button', { name: /Nouveau circuit/ })
    .first()
    .click()
  const name = `Fröhlichring ${Date.now()}`
  await page.locator('input[required]').fill(name)
  await page.getByTestId('enable-track-editor').click()
  await planner(page).getByTestId('planner-files-toggle').click()
  await planner(page).getByTestId('load-froehlichring').click()
  await expect(planner(page).getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '55')
  for (const id of ['pit-bay-1', 'pit-bay-2'])
    await expect(planner(page).getByTestId('graph-track-canvas').getByTestId(id)).toHaveCount(1)
  await planner(page).getByTestId('planner-save').click()
  await expect(page.getByTestId('planner-addon-frame')).toHaveCount(0)
  const response = await request.get('http://localhost:3101/api/tracks?limit=100')
  const track = (await response.json()).data.find((t) => t.name === name)
  const plan = JSON.parse(track.layout)
  expect(plan.pit.enabled).toBe(true)
  expect(plan.pieces.some((p) => p.level === 1)).toBe(true)
  expect(plan.laneLengthsM[0]).toBeGreaterThan(10)
  await page.goto(`/tracks/${track.id}`)
  await expect(page.getByTestId('track-plan-preview')).toBeVisible()
  await page.screenshot({
    path: '../../local-carrera/pruefungen/streckeneditor-froehlichring.png',
    fullPage: true,
  })
})
