import { test, expect } from '@playwright/test'
const API = 'http://localhost:3101'
test('local controls, alerts and navigation coexist with multilingual Piper and retain saved gain/rate', async ({
  page,
  request,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'de'))
  await request.put(`${API}/api/preferences/bestLapVoice:voiceId`, { data: { value: '_piper-thorsten' } })
  await page.route('**/api/voice/status', (r) =>
    r.fulfill({
      json: {
        available: true,
        voices: [
          { id: 'de_DE-thorsten-medium', language: 'de', locale: 'de-DE', name: 'Thorsten' },
          { id: 'en_US-ljspeech-high', language: 'en', locale: 'en-US', name: 'LJ Speech' },
          { id: 'fr_FR-siwis-medium', language: 'fr', locale: 'fr-FR', name: 'Siwis' },
        ],
      },
    })
  )
  await page.goto('/settings')
  await expect(page.locator('#voice-gain')).toBeVisible()
  await expect(page.locator('#voice-rate')).toBeVisible()
  await page.locator('#voice-gain').fill('3')
  await page.locator('#voice-rate').selectOption('1.1')
  await expect.poll(async () => (await (await request.get(`${API}/api/preferences/voice:gain`)).json()).data).toBe(3)
  await page.reload()
  await expect(page.locator('#voice-gain')).toHaveValue('3')
  await expect(page.locator('#voice-rate')).toHaveValue('1.1')
  await expect(page.getByRole('heading', { name: 'Navigationssymbole anpassen', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unterbrechung testen', exact: true })).toBeVisible()
  await page.getByTestId('voice-selector').click()
  await expect(page.getByRole('option', { name: /Siwis/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Unterbrechung testen', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Rennwarnungen' })).toBeVisible()
  expect(errors).toEqual([])
})
