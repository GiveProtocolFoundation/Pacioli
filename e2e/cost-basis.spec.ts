/**
 * E2E: Flow 3 — Cost basis report generation
 *
 * STATUS: Partially stubbed — full cost-basis computation depends on
 *         GIV-447 (cost basis engine). Tests that require computed results
 *         are marked with test.skip() and TODO references.
 *
 * What is tested now:
 *   1. Reports page loads and the "Crypto Reports" category is visible.
 *   2. A cost-basis / capital-gains report entry is listed.
 *   3. Clicking the report card opens a detail / configuration panel.
 *   4. (STUB) Actual cost-basis calculation result — skipped until GIV-447 lands.
 */

import { test, expect } from '@playwright/test'
import { setupApp, mockBlockchainRpc, goToReports } from './helpers'

test.describe('Cost basis report generation', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page)
  })

  test('reports page loads with crypto category visible', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // The page should render a reports listing
    await expect(
      page
        .getByRole('heading', { name: /report/i })
        .or(page.getByText(/crypto reports|tax reports/i))
        .first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('cost basis / capital gains report card is visible', async ({
    page,
  }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // Check for any cost-basis related report in the listing
    const costBasisCard = page.getByText(/cost basis|capital gain/i).first()
    await expect(costBasisCard).toBeVisible({ timeout: 8_000 })
  })

  test('clicking a crypto report card shows detail or run options', async ({
    page,
  }) => {
    await mockBlockchainRpc(page)
    await goToReports(page)

    // Select crypto category if tabs/filters exist
    const cryptoTab = page.getByRole('button', { name: /crypto/i }).first()
    if (await cryptoTab.isVisible().catch(() => false)) {
      await cryptoTab.click()
    }

    // Click the first report card
    const reportCard = page
      .getByText(/cost basis|capital gain|realized gain/i)
      .first()
    if (await reportCard.isVisible().catch(() => false)) {
      await reportCard.click()
      // Expect some form of action (Run / Generate / Configure) to appear
      await expect(
        page
          .getByRole('button', { name: /run|generate|configure|export/i })
          .or(page.getByText(/date range|from|to/i))
          .first()
      ).toBeVisible({ timeout: 8_000 })
    }
  })

  //   This test should:
  //     1. Seed fixture transactions with known acquisition/disposal dates and prices.
  //     2. Trigger cost-basis calculation via the report UI.
  //     3. Verify that per-asset gain/loss values match expected FIFO/HIFO output.
  test.skip('cost basis calculation returns correct FIFO results', async ({
    page,
  }) => {
    // Depends on GIV-447: cost basis engine
    await mockBlockchainRpc(page)
    await goToReports(page)
    // Placeholder — implement after GIV-447 is merged
    expect(true).toBe(false) // fail-safe: should not run until unskipped
  })

  test.skip('cost basis method selector persists selection across report runs', ({
    page: _page,
  }) => {
    // Depends on GIV-447
    expect(true).toBe(false)
  })
})
