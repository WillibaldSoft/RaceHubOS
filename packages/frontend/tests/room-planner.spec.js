import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
const api = 'http://localhost:3101'
test('image exports preserve the drawn pit and room proposals remain drafts until applied and saved', async ({
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
      data: { name: 'Room and image test', layout: JSON.stringify(plan) },
    })
  ).json()
  const id = created.data.id
  await page.goto(`/tracks/${id}`)
  for (const format of ['png', 'jpg', 'svg']) {
    const pending = page.waitForEvent('download')
    await page.getByTestId(`export-image-${format}`).click()
    const download = await pending
    const bytes = fs.readFileSync(await download.path())
    expect(bytes.length).toBeGreaterThan(1000)
    if (format === 'png') fs.writeFileSync('../../local-carrera/pruefungen/froehlichring-bildexport.png', bytes)
    if (format === 'png') expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    if (format === 'jpg') expect(bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff')
    if (format === 'svg') {
      expect(bytes.toString()).toContain('pit-bay-2')
      expect(bytes.toString()).toContain('Control unit')
    }
  }
  await page.getByTestId('edit-track').click()
  await planner(page).getByTestId('planner-mode').selectOption('room')
  await planner(page).getByTestId('room-depthM').fill('6')
  await planner(page).getByTestId('room-maxLevels').selectOption('2')
  await planner(page).getByTestId('generate-room-plan').click()
  await expect(planner(page).getByTestId('room-proposal-oval')).toBeVisible()
  await expect(planner(page).getByTestId('room-proposal-bridge')).toBeVisible()
  const before = await (await request.get(`${api}/api/tracks/${id}`)).json()
  expect(JSON.parse(before.data.layout).pieces).toEqual(plan.pieces)
  await planner(page).getByTestId('room-proposal-bridge').screenshot({
    path: '../../local-carrera/pruefungen/raumplaner-vorschlag.png',
  })
  await planner(page).getByTestId('apply-room-bridge').click()
  await planner(page).getByTestId('saved-room-plan').locator('..').locator(':scope > summary').click()
  await expect(planner(page).getByTestId('saved-room-plan')).toBeVisible()
  const stillBefore = await (await request.get(`${api}/api/tracks/${id}`)).json()
  expect(stillBefore.data.layout).toBe(before.data.layout)
  // The surrounding form owns persistence, not the planner.
  await planner(page).getByTestId('planner-save').click()
  await expect(page.getByTestId('saved-room-plan')).toBeVisible()
  const saved = await (await request.get(`${api}/api/tracks/${id}`)).json()
  const actual = JSON.parse(saved.data.layout)
  expect(actual.roomPlan.depthM).toBe(6)
  expect(actual.roomPlan.maxLevels).toBe(2)
  expect(actual.pieces.some((p) => p.level === 1)).toBe(true)
  expect(actual.pieces.filter((p) => p.type === 'Control_unit')).toHaveLength(1)
})

test('saved tracks can constrain proposal dimensions and form a separate new-track draft', async ({
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
      data: { name: 'Reference source', layout: JSON.stringify(plan) },
    })
  ).json()
  const source = created.data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await expect(planner(page).getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '55')
  await planner(page).getByTestId('planner-mode').selectOption('room')
  await planner(page).getByTestId('room-reference').selectOption(source.id)
  const width = Number(await planner(page).getByTestId('reference-widthM').getAttribute('value'))
  const depth = Number(await planner(page).getByTestId('reference-depthM').getAttribute('value'))
  expect(width).toBeGreaterThan(3)
  expect(depth).toBeGreaterThan(2)
  await planner(page).getByTestId('generate-room-plan').click()
  await expect(planner(page).getByTestId('room-proposal-oval')).toBeVisible()
  await planner(page).getByTestId('apply-room-oval').click()
  await planner(page).getByTestId('planner-save').click()
  await expect(page.getByTestId('saved-room-plan')).toBeVisible()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const original = await (await request.get(`${api}/api/tracks/${source.id}`)).json()
  expect(original.data.layout).toBe(source.layout)
  const all = await (await request.get(`${api}/api/tracks?limit=100`)).json()
  const copy = all.data.find((t) => t.name.startsWith('Reference source') && t.id !== source.id)
  expect(copy).toBeTruthy()
  const savedPlan = JSON.parse(copy.layout)
  expect(savedPlan.roomPlan.reference.name).toBe('Reference source')
  expect(savedPlan.roomPlan.reference.widthM).toBe(width)
  expect(savedPlan.roomPlan.reference.depthM).toBe(depth)
})
