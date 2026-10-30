import { test, expect, planner } from './planner-fixture'
import fs from 'node:fs'
import { emptyTrackPlan, traceTrackPlan, extraWorldPose, readTrackPlan } from '../../shared/src/index.js'
const api = 'http://localhost:3101'
async function screenPoint(canvas, x, y) {
  return canvas.evaluate(
    (svg, { x, y }) => {
      const p = svg.createSVGPoint()
      p.x = x
      p.y = y
      const q = p.matrixTransform(svg.getScreenCTM())
      return { x: q.x, y: q.y }
    },
    { x, y }
  )
}
async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}
test('rectangle selects, translates and rotates the complete native Fröhlichring with shoulders and pit intact', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1500, height: 1050 })
  const plan = JSON.parse(fs.readFileSync(new URL('./fixtures/froehlichring-softy-124.json', import.meta.url)))
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Rectangle source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  await planner(page).getByTestId('free-track-snap').uncheck()
  const canvas = planner(page).getByTestId('graph-track-canvas'),
    vb = (await canvas.getAttribute('viewBox')).split(' ').map(Number)
  const a = await screenPoint(canvas, vb[0] + 10, vb[1] + 10),
    b = await screenPoint(canvas, vb[0] + vb[2] - 10, vb[1] + vb[3] - 10)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await expect(planner(page).getByTestId('track-selection-rectangle')).toBeVisible()
  await page.mouse.up()
  await expect(canvas).toHaveAttribute('data-selected-count', '55')
  await expect(planner(page).getByTestId('track-selection-rectangle')).toHaveCount(0)
  const seg = traceTrackPlan(plan).segments[50],
    m = seg.points[0][16],
    from = await screenPoint(canvas, ...m),
    to = await screenPoint(canvas, m[0] + 120, m[1] + 80)
  await drag(page, from, to)
  await expect(canvas).toHaveAttribute('data-selected-count', '55')
  await canvas.press('r')
  await expect(canvas).toHaveAttribute('data-selected-count', '55')
  await page.screenshot({
    path: '../../local-carrera/pruefungen/auswahlrahmen-ganze-bahn.png',
  })
  await planner(page).getByTestId('planner-save').click()
  await expect(page).not.toHaveURL(new RegExp(source.id))
  const saved = (await (await request.get(`${api}/api/tracks/${page.url().split('/').at(-1)}`)).json()).data,
    actual = readTrackPlan(saved.layout),
    oldTrace = traceTrackPlan(plan),
    newTrace = traceTrackPlan(actual)
  expect(newTrace.connectivity.closed).toBe(true)
  expect(actual.pit).toEqual(plan.pit)
  for (let i = 0; i < plan.pieces.length; i++) {
    expect(actual.pieces[i].type).toBe(plan.pieces[i].type)
    expect(actual.pieces[i].borders).toEqual(plan.pieces[i].borders)
    expect(
      ((newTrace.segments[i].start.h - oldTrace.segments[i].start.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    ).toBeCloseTo(Math.PI / 12, 8)
  }
  const pts = oldTrace.segments.flatMap((s) => s.points[0]),
    cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2,
    cy = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2,
    c = Math.cos(Math.PI / 12),
    sn = Math.sin(Math.PI / 12)
  for (let i = 0; i < plan.pieces.length; i++) {
    const a = oldTrace.segments[i].start,
      b = newTrace.segments[i].start
    expect(b.x).toBeCloseTo(cx + 120 + c * (a.x - cx) - sn * (a.y - cy), 2)
    expect(b.y).toBeCloseTo(cy + 80 + sn * (a.x - cx) + c * (a.y - cy), 2)
  }
  const v0 = oldTrace.segments[0].start,
    v1 = newTrace.segments[0].start,
    w0 = oldTrace.segments[25].start,
    w1 = newTrace.segments[25].start
  expect(Math.hypot(v1.x - w1.x, v1.y - w1.y)).toBeCloseTo(Math.hypot(v0.x - w0.x, v0.y - w0.y), 7)
  for (let i = 0; i < actual.trackExtras.length; i++) {
    const p = extraWorldPose(actual.trackExtras[i], newTrace.segments),
      q = extraWorldPose(plan.trackExtras[i], oldTrace.segments)
    expect(Math.hypot(p.xMm - v1.x, p.yMm - v1.y)).toBeCloseTo(Math.hypot(q.xMm - v0.x, q.yMm - v0.y), 7)
  }
  expect(newTrace.laneLengthsM[0]).toBeCloseTo(oldTrace.laneLengthsM[0], 9)
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
test('partial and additive box selection, escape, pan mode and Ctrl+A', async ({ page, request }) => {
  const plan = {
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 3 }, () => ({
      type: 'Standardgerade',
      level: 0,
      jointDegrees: 0,
    })),
  }
  const source = (
    await (
      await request.post(`${api}/api/tracks`, {
        data: { name: 'Partial box source', layout: JSON.stringify(plan) },
      })
    ).json()
  ).data
  await page.goto(`/tracks/${source.id}`)
  await page.getByTestId('copy-track').click()
  const canvas = planner(page).getByTestId('graph-track-canvas')
  await drag(page, await screenPoint(canvas, -30, -150), await screenPoint(canvas, 330, 150))
  await expect(canvas).toHaveAttribute('data-selected-count', '1')
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await drag(page, await screenPoint(canvas, 700, -150), await screenPoint(canvas, 1050, 150))
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  await expect(canvas).toHaveAttribute('data-selected-count', '2')
  await canvas.press('Escape')
  await expect(canvas).toHaveAttribute('data-selected-count', '0')
  await planner(page).getByTestId('track-pan-mode').click()
  const before = await canvas.getAttribute('viewBox')
  const a = await screenPoint(canvas, 100, -250),
    b = await screenPoint(canvas, 200, -200)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await expect(canvas).not.toHaveAttribute('viewBox', before)
  await page.mouse.up()
  await expect(canvas).not.toHaveAttribute('viewBox', before)
  await expect(canvas).toHaveAttribute('data-selected-count', '0')
  await canvas.press('Control+a')
  await expect(canvas).toHaveAttribute('data-selected-count', '3')
  await canvas.press('Escape')
  await planner(page).getByTestId('track-select-all').click()
  await expect(canvas).toHaveAttribute('data-selected-count', '3')
  expect((await (await request.get(`${api}/api/tracks/${source.id}`)).json()).data.layout).toBe(source.layout)
})
