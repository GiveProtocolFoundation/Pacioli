/**
 * Resilient Sync Service — Phase 4a Part 2
 *
 * Provides a unified resilient transaction sync interface for all chain types.
 * Uses the Tauri `chain_fetch_transactions_resumable` command which:
 * 1. Loads the sync cursor from `address_sync_status`
 * 2. Fetches only new transactions (from last synced block)
 * 3. Updates the cursor on success
 *
 * Provider failures are surfaced as graceful "provider temporarily unavailable"
 * messages — never raw API errors.
 */

import { invoke } from '@tauri-apps/api/core'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sync status for a chain+address pair, matching `ChainSyncStatusRow` on the Rust side.
 */
export interface SyncStatus {
  chain_id: string
  address: string
  last_block_synced: number
  last_sync_timestamp: number | null
  sync_state: 'idle' | 'syncing' | 'error' | null
}

/**
 * Normalized chain transaction from the Rust adapter layer.
 */
export interface ChainTransaction {
  hash: string
  chain_id: { chain_type: string; network: string; chain_id: number | null }
  block_number: number
  timestamp: number
  from: string
  to: string | null
  value: string
  fee: string
  status: string
  tx_type: string
  token_transfers: TokenTransfer[]
  raw_data: Record<string, unknown> | null
}

/**
 * Token transfer within a transaction.
 */
export interface TokenTransfer {
  token_address: string
  token_symbol: string | null
  token_decimals: number | null
  from: string
  to: string
  value: string
}

/**
 * Result of a resilient sync operation.
 */
export interface SyncResult {
  /** Whether the sync completed successfully. */
  success: boolean
  /** Transactions fetched (empty on failure). */
  transactions: ChainTransaction[]
  /** Number of new transactions fetched. */
  count: number
  /** User-friendly error message if sync failed. */
  error?: string
  /** Whether the error is transient (provider temporarily unavailable). */
  isTransient?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** User-facing error prefix for provider failures. */
const PROVIDER_UNAVAILABLE_PREFIX = 'Provider temporarily unavailable'

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Fetch transactions with resumable sync cursor and provider fallback.
 *
 * Uses the Tauri `chain_fetch_transactions_resumable` command which
 * handles sync cursor loading/updating and provider fallback internally.
 *
 * @param chainId - Chain identifier (e.g. "ethereum", "solana", "bitcoin")
 * @param address - Wallet address
 * @returns SyncResult with transactions or graceful error
 */
export async function fetchTransactionsResilient(
  chainId: string,
  address: string,
): Promise<SyncResult> {
  try {
    const transactions = await invoke<ChainTransaction[]>(
      'chain_fetch_transactions_resumable',
      { chainId, address },
    )

    return {
      success: true,
      transactions,
      count: transactions.length,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const isTransient = message.includes(PROVIDER_UNAVAILABLE_PREFIX)

    return {
      success: false,
      transactions: [],
      count: 0,
      error: isTransient
        ? `${chainId} sync is temporarily unavailable. The system will retry automatically.`
        : `Failed to sync ${chainId}: ${message}`,
      isTransient,
    }
  }
}

/**
 * Load the current sync status for a chain+address pair.
 *
 * @param chainId - Chain identifier
 * @param address - Wallet address
 * @returns SyncStatus or null if never synced
 */
export async function loadSyncStatus(
  chainId: string,
  address: string,
): Promise<SyncStatus | null> {
  return invoke<SyncStatus | null>('load_chain_sync_status', {
    network: chainId,
    address,
  })
}

/**
 * Save/update the sync status for a chain+address pair.
 *
 * @param chainId - Chain identifier
 * @param address - Wallet address
 * @param lastBlock - Last synced block number
 */
export async function saveSyncStatus(
  chainId: string,
  address: string,
  lastBlock: number,
): Promise<void> {
  return invoke('save_chain_sync_status', {
    network: chainId,
    address,
    lastBlock,
  })
}

/**
 * Sync multiple chain+address pairs with resilient fallback.
 *
 * Returns results for each pair. Failed syncs are reported with
 * graceful error messages; successful syncs include the transactions.
 *
 * @param pairs - Array of { chainId, address } pairs to sync
 * @returns Array of SyncResult for each pair (same order)
 */
export async function syncMultipleWallets(
  pairs: Array<{ chainId: string; address: string }>,
): Promise<SyncResult[]> {
  return Promise.all(
    pairs.map(({ chainId, address }) =>
      fetchTransactionsResilient(chainId, address),
    ),
  )
}
