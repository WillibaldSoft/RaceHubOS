import { test, expect } from '@playwright/test'
import path from 'node:path'
test('default large race-screen speed and scale remain inside their visible field for one and six drivers', async ({
  page,
  request,
}) => {
  await request.put('http://localhost:3101/api/preferences/race:speed-scale-source', { data: { value: 'car' } })
  await request.put('http://localhost:3101/api/preferences/raceScreenLayout', { data: { value: null } })
  await request.put('http://localhost:3101/api/preferences/race:speed-display', {
    data: { value: { mode: 'scale', defaultScale: '1:24' } },
  })
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  await page.goto('/settings/race-screen')
  const count = page.getByRole('combobox', { name: 'Drivers in preview', exact: true })
  for (const n of [1, 6]) {
    await count.selectOption(String(n))
    const speeds = page.getByTestId('race-screen-canvas').getByTestId('lap-average-speed')
    await expect(speeds).toHaveCount(n)
    await expect(speeds.first()).toContainText('1:24')
    const clipped = await speeds.evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        const text = range.getBoundingClientRect()
        const field = node.closest('[data-field="last"]')
        const problems = []
        for (let parent = node.parentElement; parent && field?.contains(parent); parent = parent.parentElement) {
          if (getComputedStyle(parent).overflow === 'hidden') {
            const box = parent.getBoundingClientRect()
            if (text.bottom > box.bottom + 1 || text.right > box.right + 1 || text.left < box.left - 1)
              problems.push({ bottom: text.bottom - box.bottom, right: text.right - box.right })
          }
        }
        return problems
      })
    )
    expect(clipped).toEqual([])
  }
  await page.screenshot({
    path: path.resolve(import.meta.dirname, '../../../../../outputs/planner-speed-race-screen.png'),
    fullPage: true,
  })
})
