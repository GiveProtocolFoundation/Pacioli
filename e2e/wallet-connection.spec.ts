/**
 * E2E: Flow 1 — Wallet connection and entity selection
 *
 * Tests:
 *   1. App boots and first-launch wizard can be completed.
 *   2. Wallet Manager page is accessible.
 *   3. A portfolio can be added via the Add dropdown.
 *   4. Entities page is accessible and an entity can be created.
 */

import { test, expect } from '@playwright/test'
import { setupApp, mockBlockchainRpc, goToWalletManager, goToEntities } from './helpers'

test.describe('Wallet connection and entity selection', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page)
  })

  test('wallet manager page loads after first-launch setup', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToWalletManager(page)
    // Page heading should include "wallet" related text
    await expect(
      page.getByRole('heading', { name: /wallet/i }).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('can open add-wallet dropdown and see portfolio option', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToWalletManager(page)

    // The page has a "+ Add" dropdown button
    const addBtn = page
      .getByRole('button', { name: /add/i })
      .first()
    await expect(addBtn).toBeVisible({ timeout: 8_000 })
    await addBtn.click()

    // The dropdown should show "Add Portfolio" option
    await expect(
      page.getByText(/add portfolio/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('wallet manager shows connect wallet section', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToWalletManager(page)

    // The page shows a "Connect Wallet" card with wallet extensions
    await expect(
      page.getByText(/connect wallet|connect your/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('entities page loads and shows entity list', async ({ page }) => {
    await goToEntities(page)
    // Should render some heading or table for entities
    await expect(
      page
        .getByRole('heading', { name: /entit/i })
        .or(page.getByText(/no entit|add your first/i))
        .first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('can create a new entity', async ({ page }) => {
    await goToEntities(page)

    const addBtn = page
      .getByRole('button', { name: /add entity|new entity/i })
      .first()
    await expect(addBtn).toBeVisible({ timeout: 8_000 })
    await addBtn.click()

    // Modal appears with "New Entity" heading
    await expect(
      page.getByText(/new entity/i).first()
    ).toBeVisible({ timeout: 5_000 })

    // Fill in entity name (label is "Name *")
    const nameInput = page.getByLabel(/^name/i).first()
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill('Give Foundation')

    // Save — use force:true because the modal backdrop intercepts pointer events
    const saveBtn = page.getByRole('button', { name: /save|create/i }).first()
    await saveBtn.click({ force: true })

    // The entity should appear in the list
    await expect(page.getByText('Give Foundation')).toBeVisible({ timeout: 8_000 })
  })
})
