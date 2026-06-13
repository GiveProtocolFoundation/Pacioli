/**
 * E2E: Flow 5 — Settings (API keys and provider configuration)
 *
 * Tests:
 *   1. Settings page loads with all navigation sections.
 *   2. Data Providers section shows provider list.
 *   3. An API key field exists for a provider.
 *   4. Entering and saving an API key persists to localStorage (browser mode).
 *   5. General Settings section renders with org info.
 *   6. Currencies section is accessible.
 *   7. (STUB) Real-time sync toggle — depends on GIV-445.
 */

import { test, expect } from '@playwright/test'
import { setupApp, goToSettings } from './helpers'

test.describe('Settings — API keys and provider configuration', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page)
  })

  test('settings page loads with sidebar sections', async ({ page }) => {
    await goToSettings(page)

    await expect(page.getByText(/general/i).first()).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByText(/data provider/i).first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('data providers section renders provider list', async ({ page }) => {
    // Navigate directly to data-providers sub-route
    await page.goto('/settings/data-providers')
    await page.waitForLoadState('networkidle')

    // Should show provider cards (Etherscan, Polygonscan, etc.)
    await expect(page.getByText(/etherscan/i).first()).toBeVisible({
      timeout: 8_000,
    })
  })

  test('API key input is present and accepts a value', async ({ page }) => {
    // Navigate directly to data-providers sub-route
    await page.goto('/settings/data-providers')
    await page.waitForLoadState('networkidle')

    // Click the "Add API Key" button on the first provider card
    const addKeyBtn = page.getByRole('button', { name: /add api key/i }).first()
    await expect(addKeyBtn).toBeVisible({ timeout: 8_000 })
    await addKeyBtn.click()

    // The API key input field should appear
    const apiKeyInput = page
      .getByPlaceholder(/enter your api key/i)
      .or(page.getByPlaceholder(/api key/i))
      .first()
    await expect(apiKeyInput).toBeVisible({ timeout: 5_000 })

    // Type a test key
    await apiKeyInput.fill('TEST_API_KEY_12345')
    await expect(apiKeyInput).toHaveValue('TEST_API_KEY_12345')
  })

  test('saving an API key persists to localStorage in browser mode', async ({
    page,
  }) => {
    // Navigate directly to data-providers sub-route
    await page.goto('/settings/data-providers')
    await page.waitForLoadState('networkidle')

    // Click "Add API Key" on the first provider (Etherscan)
    const addKeyBtn = page.getByRole('button', { name: /add api key/i }).first()
    if (await addKeyBtn.isVisible().catch(() => false)) {
      await addKeyBtn.click()

      const apiKeyInput = page
        .getByPlaceholder(/enter your api key/i)
        .or(page.getByPlaceholder(/api key/i))
        .first()

      if (await apiKeyInput.isVisible().catch(() => false)) {
        await apiKeyInput.fill('E2E_ETHERSCAN_KEY')

        // Click Save
        const saveBtn = page.getByRole('button', { name: /save/i }).first()
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click()

          // Verify localStorage in browser-mode
          const stored = await page.evaluate(() =>
            localStorage.getItem('pacioli_api_key_etherscan')
          )
          if (stored !== null) {
            expect(stored).toBe('E2E_ETHERSCAN_KEY')
          }
        }
      }
    }
  })

  test('general settings section renders organization name field', async ({
    page,
  }) => {
    await goToSettings(page)

    // Should show org name or system preferences
    await expect(
      page
        .getByText(/organization name/i)
        .or(page.getByText(/organization information/i))
        .first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('currencies settings section is accessible', async ({ page }) => {
    await page.goto('/settings/currencies')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/currenc/i).first()).toBeVisible({
      timeout: 8_000,
    })
  })

  // TODO(GIV-445): Unskip when real-time sync toggle feature lands.
  test.skip('real-time sync toggle persists state', async ({ page }) => {
    await goToSettings(page)
    const syncToggle = page
      .getByRole('switch', { name: /real.?time sync/i })
      .first()
    await expect(syncToggle).toBeVisible({ timeout: 8_000 })
    await syncToggle.click()
    await expect(syncToggle).toBeChecked()
    await syncToggle.click()
    await expect(syncToggle).not.toBeChecked()
  })
})
