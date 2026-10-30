import { test as base, expect } from '@playwright/test'
export const test = base.extend({
  page: async ({ page, request }, use) => {
    const response = await request.put('http://localhost:3101/api/addons/track-planner', { data: { enabled: true } })
    expect(response.ok()).toBe(true)
    await use(page)
  },
})
export { expect }
export const planner = (page) => page.frameLocator('[data-testid=planner-addon-frame]')
