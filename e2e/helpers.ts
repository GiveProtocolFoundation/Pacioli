/**
 * Shared E2E helpers for Pacioli Playwright tests.
 *
 * Key responsibility: bring the app from the first-launch state to a
 * fully-unlocked "ready" state so individual specs can focus on their flows.
 *
 * The web build uses an in-memory storage backend (no Tauri).
 * On first load, `setup_complete` is absent → the first-launch wizard appears.
 * We walk through it using Easy mode (no password required).
 */

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// RPC mock helpers
// ---------------------------------------------------------------------------

/**
 * Block all outgoing JSON-RPC / etherscan / subscan network requests so tests
 * never depend on live blockchain nodes.  Call this before page.goto().
 */
export async function mockBlockchainRpc(page: Page): Promise<void> {
  // Ethereum / EVM JSON-RPC
  await page.route('**/*.infura.io/**', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x0' }),
    })
  )
  await page.route('**/*.alchemy.com/**', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x0' }),
    })
  )
  await page.route('**/api.etherscan.io/**', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ status: '1', message: 'OK', result: [] }),
    })
  )
  await page.route('**/api.polygonscan.com/**', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ status: '1', message: 'OK', result: [] }),
    })
  )
  // Polkadot WSS (ws://) — Playwright can't intercept WebSocket frames but we
  // prevent the initial HTTP upgrade from reaching the network.
  await page.route('**subscan.io**', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ code: 0, data: { list: [], count: 0 } }),
    })
  )
  // Solana RPC
  await page.route('**/mainnet-beta.solana.com/**', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: [] } }),
    })
  )
}

// ---------------------------------------------------------------------------
// App bootstrap helpers
// ---------------------------------------------------------------------------

/**
 * Seed onboarding settings (accountType + jurisdiction) directly into IndexedDB
 * so the OnboardingGate passes through without needing Tauri's invoke().
 */
async function seedOnboardingSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('PacioliPersistenceDB', 2)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('settings', 'readwrite')
        const store = tx.objectStore('settings')
        const now = new Date().toISOString()
        store.put({ key: 'accountType', value: 'individual', updated_at: now })
        store.put({ key: 'jurisdiction', value: 'us-gaap', updated_at: now })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }
      request.onerror = () => reject(request.error)
    })
  })
}

/**
 * Navigate to the app and complete the first-launch wizard in Easy mode so
 * the main shell is visible.  Idempotent — if the app is already unlocked,
 * this returns immediately.
 */
export async function setupApp(page: Page): Promise<void> {
  await mockBlockchainRpc(page)
  await page.goto('/')

  // If main navigation is already visible, app is ready
  const nav = page.locator('nav, [data-testid="navigation"]').first()
  const isNavVisible = await nav.isVisible().catch(() => false)
  if (isNavVisible) return

  // --- First-launch wizard ---
  // Step 1: Language selection — just click Continue
  const continueBtn = page.getByRole('button', { name: /continue/i })
  await expect(continueBtn.first()).toBeVisible({ timeout: 10_000 })
  await continueBtn.first().click()

  // Step 2: Security mode — select "Easy" / "Easy Access" then Continue
  const easyOption = page.getByRole('button', { name: /easy/i }).first()
  const easyRadio = page.getByLabel(/easy/i).first()
  if (await easyOption.isVisible().catch(() => false)) {
    await easyOption.click()
  } else if (await easyRadio.isVisible().catch(() => false)) {
    await easyRadio.click()
  }
  // Click Continue on the security step
  await page
    .getByRole('button', { name: /continue/i })
    .first()
    .click()

  // Step 3: Completion step — click "Get Started" or "Continue"
  const doneBtn = page
    .getByRole('button', { name: /get started|continue|finish|done/i })
    .first()
  await expect(doneBtn).toBeVisible({ timeout: 8_000 })
  await doneBtn.click()

  // --- Onboarding gate ---
  // After first-launch, the OnboardingGate redirects to /onboarding because
  // accountType is null. In E2E (web build, no Tauri), we seed the required
  // settings directly into IndexedDB and reload so AuthContext picks them up.
  const onboardingHeading = page.getByText(
    'Where is your organization registered?'
  )
  const hitOnboarding = await expect(onboardingHeading)
    .toBeVisible({ timeout: 5_000 })
    .then(
      () => true,
      () => false
    )
  if (hitOnboarding) {
    await seedOnboardingSettings(page)
    await page.goto('/')
  }

  // Wait for the main shell (navigation) to appear
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

export async function goToTransactions(page: Page): Promise<void> {
  await page.goto('/transactions')
  await page.waitForLoadState('networkidle')
}

/**
 * Navigates to the reports page and waits until the network is idle.
 * @param page - The Playwright Page object used for navigation.
 * @returns A Promise that resolves when the page has fully loaded.
 */
export async function goToReports(page: Page): Promise<void> {
  await page.goto('/reports')
  await page.waitForLoadState('networkidle')
}

/**
 * Navigates to the settings page and waits for the network to be idle.
 *
 * @param page - The Playwright Page object used for navigation.
 * @returns A promise that resolves when the page has fully loaded.
 */
export async function goToSettings(page: Page): Promise<void> {
  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
}

/**
 * Navigates the page to the wallet manager route and waits for the network to be idle.
 *
 * @param page - The Playwright Page instance to navigate.
 * @returns A promise that resolves when the navigation and load state are complete.
 */
export async function goToWalletManager(page: Page): Promise<void> {
  await page.goto('/wallet-manager')
  await page.waitForLoadState('networkidle')
}

/**
 * Navigates to the entities page and waits for the page to finish loading.
 * @param page The Playwright Page instance to perform navigation on.
 * @returns A promise that resolves when navigation and page load are complete.
 */
export async function goToEntities(page: Page): Promise<void> {
  await page.goto('/entities')
  await page.waitForLoadState('networkidle')
}

// ---------------------------------------------------------------------------
// Fixture transaction data
// ---------------------------------------------------------------------------

export const FIXTURE_WALLETS = [
  {
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    blockchain: 'ethereum',
    label: 'Test ETH Wallet',
  },
  {
    address: 'So11111111111111111111111111111111111111112',
    blockchain: 'solana',
    label: 'Test SOL Wallet',
  },
]

export const FIXTURE_TRANSACTIONS = [
  {
    id: 'tx-001',
    type: 'revenue',
    amount: '1.5',
    currency: 'ETH',
    date: '2025-11-01T10:00:00Z',
    description: 'Test donation ETH',
  },
  {
    id: 'tx-002',
    type: 'expense',
    amount: '0.05',
    currency: 'ETH',
    date: '2025-10-31T09:00:00Z',
    description: 'Gas fee',
  },
]
