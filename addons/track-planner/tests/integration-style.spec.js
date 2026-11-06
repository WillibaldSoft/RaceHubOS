import { test, expect } from '@playwright/test'
import { emptyTrackPlan } from '../../../packages/shared/src/index.js'
for (const language of ['de', 'en', 'fr'])
  test(`standalone uses shared design tokens and retains theme (${language})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(language)
    await expect(page.getByTestId('planner-theme-toggle')).toHaveAttribute('data-theme', 'system')
    await page.getByTestId('planner-theme-toggle').click()
    await page.getByTestId('planner-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('standalone-new').click()
    await expect(page.getByTestId('planner-theme-toggle')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('add-track-piece').click()
    const match = await page.getByTestId('add-track-piece').evaluate((el) => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = 'var(--primary)'
      el.appendChild(probe)
      const equal = getComputedStyle(el).backgroundColor === getComputedStyle(probe).backgroundColor
      probe.remove()
      return equal
    })
    expect(match).toBe(true)
    const readable = await page.getByTestId('free-part-x').evaluate((el) => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--foreground)'
      el.parentElement.appendChild(probe)
      const equal = getComputedStyle(el).color === getComputedStyle(probe).color
      probe.remove()
      return equal
    })
    expect(readable).toBe(true)
    await page.screenshot({ path: `/tmp/planner-integration-dark-${language}.png` })
    await page.reload()
    await expect(page.getByTestId('planner-theme-toggle')).toHaveAttribute('data-theme', 'dark')
  })
test('embedded adapter receives theme from its host and does not show a local theme override', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const draft = { name: 'Host integration demo', plan: emptyTrackPlan() }
  await page.route('**/integration-harness.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body><iframe style="width:1440px;height:900px" src="${baseURL}/#host=${encodeURIComponent(baseURL)}"></iframe><script>addEventListener('message',e=>{if(e.data?.type==='ready')e.source.postMessage({channel:'racehubos:track-planner:1',type:'init',language:'de',dark:true,draft:${JSON.stringify(draft)}},'${baseURL}')})</script></body></html>`,
    })
  )
  await page.goto('/integration-harness.html')
  const frame = page.frameLocator('iframe')
  await expect(frame.getByTestId('track-plan-editor')).toBeVisible()
  await expect(frame.locator('html')).toHaveClass(/dark/)
  await expect(frame.getByTestId('planner-theme-toggle')).toHaveCount(0)
  await frame.getByTestId('add-track-piece').click()
  await expect(frame.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '1')
})
