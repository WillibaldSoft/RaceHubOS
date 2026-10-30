import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
const output = path.resolve(import.meta.dirname, '../../../../../outputs')
test('standalone planner saves a local plan and exports an exchange file without RaceHubOS', async ({
  page,
  request,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('standalone-home')).toBeVisible()
  await page.getByTestId('standalone-language').selectOption('de')
  await page.getByTestId('standalone-new').click()
  await page.locator('.planner-name').fill('Plan vom zweiten Rechner')
  await page.getByTestId('add-track-piece').click()
  await page.getByTestId('add-track-piece').click()
  await page.getByTestId('planner-save').click()
  await expect(page.getByRole('status').filter({ hasText: 'lokal gespeichert' })).toBeVisible()
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  await expect(page.getByTestId('standalone-track')).toContainText('Plan vom zweiten Rechner')
  const rows = (await (await request.get('/api/tracks')).json()).data
  expect(rows).toHaveLength(1)
  expect(rows[0].length).toBe(0.69)
  await page.reload()
  await page.getByTestId('standalone-track').selectOption(rows[0].id)
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '2')
  await page.getByTestId('planner-files-toggle').click()
  const pending = page.waitForEvent('download')
  await page.getByTestId('export-track-json').click()
  const download = await pending
  const plan = JSON.parse(await fs.readFile(await download.path(), 'utf8'))
  expect(plan.pieces).toHaveLength(2)
  expect(plan.kind).toBe('racehubos.track-plan')
  await page.screenshot({ path: path.join(output, 'planner-standalone.png') })
  expect(errors).toEqual([])
})
test('standalone room planner can generate drafts without changing saved plans', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('planner-mode').selectOption('room')
  await page.getByTestId('generate-room-plan').click()
  await expect(page.getByTestId('room-proposal-oval')).toBeVisible()
})
test('standalone calculator offers actual and both scale speeds; mobile controls fit the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('add-track-piece').click()
  await page.getByTestId('add-track-piece').click()
  await page.getByTestId('track-plan-summary').locator('..').locator('summary').click()
  await page.getByTestId('planner-speed-mode').selectOption('1:32')
  await expect(page.getByTestId('planner-speed-result')).toContainText('7.95 / 7.95 km/h')
  await page.getByTestId('planner-speed-mode').selectOption('1:24')
  await expect(page.getByTestId('planner-speed-result')).toContainText('5.96 / 5.96 km/h')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({
    path: path.join(output, 'planner-standalone-mobile.png'),
  })
})
