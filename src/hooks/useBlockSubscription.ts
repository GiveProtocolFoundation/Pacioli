/**
 * useBlockSubscription — Real-time block subscription hook
 *
 * Manages subscribeNewBlocks() lifecycle: subscribes on connect/active wallet,
 * unsubscribes on disconnect/unmount. Debounces new-block events and triggers
 * an incremental transaction/balance refresh instead of a full rescan.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  polkadotService,
  type SyncProgress,
} from '../services/blockchain/polkadotService'
import { indexedDBService } from '../services/database/indexedDBService'
import { nextSyncStatus } from '../services/blockchain/syncStatusPolicy'
import { NetworkType } from '../services/wallet/types'
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto'

/** SS58 prefix map for address conversion */
const SS58_FORMATS: Partial<Record<NetworkType, number>> = {
  [NetworkType.POLKADOT]: 0,
  [NetworkType.KUSAMA]: 2,
  [NetworkType.ASTAR]: 5,
  [NetworkType.ACALA]: 10,
  // Moonbeam (1284) and Moonriver (1285) are sunset — omitted
}

/** Sunset chains are historical-import only: there are no new blocks to watch. */
const HISTORICAL_ONLY_NETWORKS = new Set<NetworkType>([
  NetworkType.MOONBEAM,
  NetworkType.MOONRIVER,
])

/** Convert an address to network-specific SS58 format */
function toNetworkAddress(address: string, network: NetworkType): string {
  if (address.startsWith('0x')) return address
  const prefix = SS58_FORMATS[network]
  if (prefix === undefined) return address
  try {
    return encodeAddress(decodeAddress(address), prefix)
  } catch {
    return address
  }
}

export interface BlockSubscriptionState {
  /** Whether a live subscription is active */
  isLive: boolean
  /** Latest block number seen */
  latestBlock: number | null
  /** Whether an incremental refresh is running */
  isRefreshing: boolean
  /** Last refresh error, if any */
  refreshError: string | null
  /** Progress of the current incremental refresh */
  refreshProgress: SyncProgress | null
}

export interface UseBlockSubscriptionOptions {
  /** Network to subscribe to */
  network: NetworkType
  /** Address to refresh transactions for */
  address: string
  /** Whether real-time sync is enabled (user toggle) */
  enabled: boolean
  /** Whether the DB is initialized */
  dbReady: boolean
  /** Callback when new transactions are fetched */
  onTransactionsUpdated?: (network: NetworkType, address: string) => void
}

/** Debounce interval for block events (ms). Substrate produces blocks every 6s. */
const DEBOUNCE_MS = 12_000

/**
 * Subscribes to block events and manages subscription state including
 * live status, latest block number, and incremental refresh progress.
 * @param options Configuration options for the block subscription:
 *  - network: The blockchain network to subscribe to.
 *  - address: The address for which to refresh transactions.
 *  - enabled: Whether real-time synchronization is enabled.
 *  - dbReady: Indicates if the database is initialized.
 *  - onTransactionsUpdated: Optional callback invoked when new transactions are fetched.
 * @returns The current state of the block subscription, including latestBlock,
 * isLive, isRefreshing, refreshError, and refreshProgress.
 */
export function useBlockSubscription(
  options: UseBlockSubscriptionOptions
): BlockSubscriptionState {
  const { network, address, enabled, dbReady, onTransactionsUpdated } = options

  const [isLive, setIsLive] = useState(false)
  const [latestBlock, setLatestBlock] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshProgress, setRefreshProgress] = useState<SyncProgress | null>(
    null
  )

  // Refs for debounce and cleanup
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const isMountedRef = useRef(true)
  const refreshInFlightRef = useRef(false)

  // Stable ref for the callback to avoid re-subscribing when it changes
  const onTransactionsUpdatedRef = useRef(onTransactionsUpdated)
  onTransactionsUpdatedRef.current = onTransactionsUpdated

  /**
   * Perform an incremental refresh: fetch only recent transactions since the
   * last synced block, merge into DB, and notify the UI.
   */
  const doIncrementalRefresh = useCallback(
    async (net: NetworkType, addr: string) => {
      if (refreshInFlightRef.current || !isMountedRef.current) return
      refreshInFlightRef.current = true

      const networkAddr = toNetworkAddress(addr, net)

      try {
        setIsRefreshing(true)
        setRefreshError(null)

        // Determine startBlock from last sync status
        const syncStatus = await indexedDBService.loadSyncStatus(
          net,
          networkAddr
        )
        const startBlock = syncStatus
          ? syncStatus.lastSyncedBlock + 1
          : undefined

        // Fetch only new transactions (limit 50 for incremental)
        const result = await polkadotService.fetchTransactionHistoryHybrid(
          net,
          {
            address: networkAddr,
            startBlock,
            limit: 50,
            onProgress: p => {
              if (isMountedRef.current) setRefreshProgress(p)
            },
          }
        )

        if (!isMountedRef.current) return

        const txs = result.transactions

        if (txs.length > 0) {
          // Save new transactions
          await indexedDBService.saveTransactions(net, networkAddr, txs)
        }

        // Advance the sync point only for a complete import. An RPC-only
        // fallback covers a bounded recent window; advancing here would mark
        // the skipped range as synced and it would never be re-imported.
        const syncStatusUpdate = nextSyncStatus(
          txs,
          result.isComplete,
          net,
          networkAddr
        )
        if (syncStatusUpdate) {
          await indexedDBService.saveSyncStatus(syncStatusUpdate)
        }

        if (isMountedRef.current) {
          setRefreshProgress(null)
          // Notify parent that data has been updated
          onTransactionsUpdatedRef.current?.(net, addr)
        }
      } catch (err) {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Refresh failed'
          setRefreshError(msg)
          console.error(
            '[useBlockSubscription] incremental refresh error:',
            err
          )
        }
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false)
          setRefreshProgress(null)
        }
        refreshInFlightRef.current = false
      }
    },
    []
  )

  // Main subscription effect
  useEffect(() => {
    isMountedRef.current = true

    // Nothing to do if disabled, no address, or DB not ready
    if (!enabled || !address || !dbReady) {
      setIsLive(false)
      setLatestBlock(null)
      return undefined
    }

    let cancelled = false

    /**
     * Subscribes to new block headers from the polkadot service and updates state.
     *
     * The unsubscribe handle is stored in `unsubscribeRef`; this function
     * intentionally returns no value.
     *
     * @returns {Promise<void>} Resolves once the subscription attempt settles.
     */
    const subscribe = async () => {
      // Sunset chains are historical-import only; there is nothing to subscribe to.
      if (HISTORICAL_ONLY_NETWORKS.has(network)) return

      try {
        const unsub = await polkadotService.subscribeNewBlocks(
          network,
          header => {
            if (cancelled) return

            const blockNum = header.number.toNumber()
            setLatestBlock(blockNum)
            setIsLive(true)

            // Debounce: wait DEBOUNCE_MS after the last block before refreshing
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current)
            }
            debounceTimerRef.current = setTimeout(() => {
              if (!cancelled) {
                doIncrementalRefresh(network, address)
              }
            }, DEBOUNCE_MS)
          }
        )

        if (cancelled) {
          // Race: effect cleaned up before subscribe resolved
          unsub()
          return
        }

        unsubscribeRef.current = unsub
        setIsLive(true)
        console.warn(
          `[useBlockSubscription] subscribed to ${network} for ${address}`
        )
      } catch (err) {
        if (!cancelled) {
          console.error('[useBlockSubscription] subscribe error:', err)
          setIsLive(false)
          setRefreshError(
            err instanceof Error ? err.message : 'Subscription failed'
          )
        }
      }
    }

    subscribe()

    // Cleanup: unsubscribe + cancel debounce
    return () => {
      cancelled = true
      isMountedRef.current = false

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
        console.warn(`[useBlockSubscription] unsubscribed from ${network}`)
      }
      setIsLive(false)
    }
  }, [network, address, enabled, dbReady, doIncrementalRefresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    isLive,
    latestBlock,
    isRefreshing,
    refreshError,
    refreshProgress,
  }
}
