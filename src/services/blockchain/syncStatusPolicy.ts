/**
 * Sync-status policy for history imports.
 *
 * A hybrid import can be incomplete: when the indexed (Subscan) history is
 * unavailable, only a bounded recent-block RPC window is returned. Advancing
 * the sync point in that case would record the skipped range as synced and it
 * would never be re-imported, so the previous sync point must be preserved.
 */

/** Minimal transaction shape needed to derive a sync point. */
export interface BlockHeightTransaction {
  blockNumber: number
}

/** Sync-status shape accepted by both persistence backends. */
export interface SyncStatusUpdate {
  network: string
  address: string
  lastSyncedBlock: number
  lastSyncTime: Date
  isSyncing: boolean
}

/**
 * Build the sync-status update for a finished import, or `null` when the sync
 * point must not advance.
 *
 * Returns `null` for an incomplete import (RPC-only fallback) or when nothing
 * was imported; callers should then keep their existing sync point.
 */
export function nextSyncStatus(
  transactions: ReadonlyArray<BlockHeightTransaction>,
  isComplete: boolean,
  network: string,
  address: string,
  now: Date = new Date()
): SyncStatusUpdate | null {
  if (!isComplete || transactions.length === 0) return null

  return {
    network,
    address,
    lastSyncedBlock: Math.max(...transactions.map(tx => tx.blockNumber)),
    lastSyncTime: now,
    isSyncing: false,
  }
}
