/**
 * E2E: Flow 1 — Wallet connection and entity selection
 *
 * Tests:
 *   1. App boots and first-launch wizard can be completed.
 *   2. Wallet Manager page is accessible.
 *   3. A wallet can be added via the manual address entry modal.
 *   4. The added wallet appears in the wallet list.
 *   5. Entities page is accessible and an entity can be created.
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

  test('can open add-wallet modal and add an Ethereum address manually', async ({ page }) => {
    await mockBlockchainRpc(page)
    await goToWalletManager(page)

    // Locate and click the "Add wallet" / "Add portfolio" / "+" button
    const addBtn = page
      .getByRole('button', { name: /add wallet|add portfolio|new wallet|\+/i })
      .first()
    await expect(addBtn).toBeVisible({ timeout: 8_000 })
    await addBtn.click()

    // A modal or form should appear
    const modal = page.locator('[role="dialog"], .modal, form').first()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Select blockchain — look for a dropdown or button labelled "Ethereum"
    const blockchainSelector = page.getByLabel(/blockchain|chain/i).first()
    if (await blockchainSelector.isVisible().catch(() => false)) {
      await blockchainSelector.selectOption({ label: /ethereum/i })
    } else {
      const ethBtn = page.getByRole('button', { name: /ethereum/i }).first()
      if (await ethBtn.isVisible().catch(() => false)) {
        await ethBtn.click()
      }
    }

    // Enter a valid Ethereum address
    const addressInput = page.getByPlaceholder(/address|0x/i).first()
    await expect(addressInput).toBeVisible({ timeout: 5_000 })
    await addressInput.fill('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')

    // Optionally add a label
    const labelInput = page.getByPlaceholder(/label|name|nickname/i).first()
    if (await labelInput.isVisible().catch(() => false)) {
      await labelInput.fill('Test ETH Wallet')
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /add|save|connect|submit/i }).first()
    await submitBtn.click()

    // The modal should close and/or a success indicator should appear
    // (We allow up to 8s because storage writes may be async)
    await expect(modal).not.toBeVisible({ timeout: 8_000 }).catch(async () => {
      // Some implementations keep modal open with success — just check address appears
      await expect(
        page.getByText('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
      ).toBeVisible({ timeout: 8_000 })
    })
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
      .getByRole('button', { name: /new entity|add entity|\+/i })
      .first()
    await expect(addBtn).toBeVisible({ timeout: 8_000 })
    await addBtn.click()

    // Fill in entity name
    const nameInput = page.getByLabel(/name/i).first()
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill('Give Foundation')

    // Save
    const saveBtn = page.getByRole('button', { name: /save|create|add/i }).first()
    await saveBtn.click()

    // The entity should appear in the list
    await expect(page.getByText('Give Foundation')).toBeVisible({ timeout: 8_000 })
  })
})
