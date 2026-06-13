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
import { NetworkType } from '../services/wallet/types'
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto'

/** SS58 prefix map for address conversion */
const SS58_FORMATS: Record<NetworkType, number> = {
  [NetworkType.POLKADOT]: 0,
  [NetworkType.KUSAMA]: 2,
  [NetworkType.MOONBEAM]: 1284,
  [NetworkType.MOONRIVER]: 1285,
  [NetworkType.ASTAR]: 5,
  [NetworkType.ACALA]: 10,
}

/** Convert an address to network-specific SS58 format */
function toNetworkAddress(address: string, network: NetworkType): string {
  if (address.startsWith('0x')) return address
  try {
    return encodeAddress(decodeAddress(address), SS58_FORMATS[network])
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
        const txs = await polkadotService.fetchTransactionHistoryHybrid(net, {
          address: networkAddr,
          startBlock,
          limit: 50,
          onProgress: p => {
            if (isMountedRef.current) setRefreshProgress(p)
          },
        })

        if (!isMountedRef.current) return

        if (txs.length > 0) {
          // Save new transactions
          await indexedDBService.saveTransactions(net, networkAddr, txs)

          // Update sync status
          const lastBlock = Math.max(...txs.map(tx => tx.blockNumber))
          await indexedDBService.saveSyncStatus({
            network: net,
            address: networkAddr,
            lastSyncedBlock: lastBlock,
            lastSyncTime: new Date(),
            isSyncing: false,
          })
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
      return
    }

    let cancelled = false

    const subscribe = async () => {
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
