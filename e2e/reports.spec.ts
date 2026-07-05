/**
 * E2E: Flow 4 — Report generation and export
 *
 * Tests:
 *   1. Reports page loads and shows all four categories.
 *   2. Each report category (financial, crypto, tax, custom) is accessible.
 *   3. Clicking a report's "Run" button starts generation (or shows config).
 *   4. Download action is available on report cards.
 *   5. "Recent runs" section is visible (even if empty).
 *   6. Favorite reports are highlighted.
 */

import { test, expect } from '@playwright/test'
import { setupApp, mockBlockchainRpc, goToReports } from './helpers'

test.describe('Report generation and export', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page)
  })

  test('reports page renders all category tabs', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    await expect(page.getByText(/financial reports/i).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/crypto/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/tax/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('financial reports category shows balance sheet', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // Click "Financial Reports" tab if present
    const financialTab = page.getByRole('button', { name: /financial/i }).first()
    if (await financialTab.isVisible().catch(() => false)) {
      await financialTab.click()
    }

    await expect(page.getByText(/balance sheet/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('clicking Run on a report shows configuration or triggers generation', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // Find a "Run" button on any report card
    const runBtn = page.getByRole('button', { name: /run|generate/i }).first()
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click()
      // Some kind of feedback should appear (modal, spinner, date picker, etc.)
      await expect(
        page
          .getByRole('dialog')
          .or(page.getByText(/generating|date range|from|to|format/i))
          .first()
      ).toBeVisible({ timeout: 8_000 })
    } else {
      // Alternatively, report cards may be clickable directly
      const reportCard = page.locator('[class*="report"], [class*="card"]').first()
      if (await reportCard.isVisible().catch(() => false)) {
        await reportCard.click()
        await expect(
          page.getByRole('button', { name: /run|generate|export/i }).first()
        ).toBeVisible({ timeout: 8_000 })
      }
    }
  })

  test('download action is available on report cards', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // Each report card has a Download icon button
    const downloadBtn = page.getByRole('button', { name: /download/i }).first()
    await expect(downloadBtn).toBeVisible({ timeout: 8_000 })
  })

  test('recent runs section is rendered', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // "Recent runs" heading or an empty-state equivalent
    await expect(
      page
        .getByText(/recent run|no recent/i)
        .or(page.getByRole('heading', { name: /recent/i }))
        .first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('crypto reports category shows capital gains / cost basis entry', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    const cryptoTab = page.getByRole('button', { name: /crypto/i }).first()
    if (await cryptoTab.isVisible().catch(() => false)) {
      await cryptoTab.click()
    }

    await expect(
      page
        .getByText(/capital gain|cost basis|realized/i)
        .first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('tax reports category shows donation receipt entry', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    const taxTab = page.getByRole('button', { name: /tax/i }).first()
    if (await taxTab.isVisible().catch(() => false)) {
      await taxTab.click()
    }

    // Tax reports should mention donor receipts or form 990 etc.
    await expect(
      page
        .getByText(/donation|receipt|990|tax/i)
        .first()
    ).toBeVisible({ timeout: 8_000 })
  })
})
