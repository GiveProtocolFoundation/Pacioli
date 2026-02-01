/**
 * Storage Service
 * Simple localStorage wrapper for wallet and transaction data
 * Can be upgraded to IndexedDB for better performance with large datasets
 */

import type { ConnectedWallet, Transaction } from '../wallet/types'

const STORAGE_KEYS = {
  WALLETS: 'pacioli_connected_wallets',
  TRACKED_WALLETS: 'pacioli_tracked_wallets',
  TRANSACTIONS: 'pacioli_transactions',
  SYNC_STATUS: 'pacioli_sync_status',
} as const

/**
 * A manually tracked wallet address (not connected via extension)
 */
export interface TrackedWallet {
  id: string
  address: string
  blockchain: string
  label?: string
  isVerified: boolean
  signature?: string
  createdAt: number
  updatedAt: number
}

export interface SyncStatus {
  network: string
  address: string
  lastSyncedBlock: number
  lastSyncTime: Date
  isSyncing: boolean
}

/**
 * Storage service for managing wallet and transaction data in localStorage.
 */
export const StorageService = {
  /**
   * Save connected wallets
   */
  saveWallets(wallets: ConnectedWallet[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets))
    } catch (error) {
      console.error('Error saving wallets:', error)
    }
  },

  /**
   * Load connected wallets
   */
  loadWallets(): ConnectedWallet[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WALLETS)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error loading wallets:', error)
      return []
    }
  },

  /**
   * Clear saved wallets
   */
  clearWallets(): void {
    localStorage.removeItem(STORAGE_KEYS.WALLETS)
  },

  /**
   * Save transactions (appends to existing)
   */
  saveTransactions(
    network: string,
    address: string,
    transactions: Transaction[]
  ): void {
    try {
      const allTransactions = StorageService.loadTransactions()
      const key = `${network}:${address}`

      allTransactions[key] = [...(allTransactions[key] || []), ...transactions]

      // Deduplicate by ID
      allTransactions[key] = Array.from(
        new Map(
          allTransactions[key].map((tx: Transaction) => [tx.id, tx])
        ).values()
      )

      // Sort by block number (newest first)
      allTransactions[key].sort(
        (a: Transaction, b: Transaction) => b.blockNumber - a.blockNumber
      )

      localStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(allTransactions)
      )
    } catch (error) {
      console.error('Error saving transactions:', error)
    }
  },

  /**
   * Load all transactions
   */
  loadTransactions(): Record<string, Transaction[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Error loading transactions:', error)
      return {}
    }
  },

  /**
   * Load transactions for specific address and network
   */
  loadTransactionsFor(network: string, address: string): Transaction[] {
    const allTransactions = StorageService.loadTransactions()
    const key = `${network}:${address}`
    return allTransactions[key] || []
  },

  /**
   * Clear all transactions
   */
  clearTransactions(): void {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS)
  },

  /**
   * Save sync status
   */
  saveSyncStatus(status: SyncStatus): void {
    try {
      const allStatus = StorageService.loadAllSyncStatus()
      const key = `${status.network}:${status.address}`
      allStatus[key] = status
      localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(allStatus))
    } catch (error) {
      console.error('Error saving sync status:', error)
    }
  },

  /**
   * Load sync status
   */
  loadSyncStatus(network: string, address: string): SyncStatus | null {
    try {
      const allStatus = StorageService.loadAllSyncStatus()
      const key = `${network}:${address}`
      return allStatus[key] || null
    } catch (error) {
      console.error('Error loading sync status:', error)
      return null
    }
  },

  /**
   * Load all sync statuses
   */
  loadAllSyncStatus(): Record<string, SyncStatus> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_STATUS)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Error loading sync status:', error)
      return {}
    }
  },

  /**
   * Clear all stored data
   */
  clearAll(): void {
    StorageService.clearWallets()
    StorageService.clearTrackedWallets()
    StorageService.clearTransactions()
    localStorage.removeItem(STORAGE_KEYS.SYNC_STATUS)
  },

  // =========================================================================
  // TRACKED WALLETS (manually added addresses)
  // =========================================================================

  /**
   * Add a tracked wallet
   */
  addTrackedWallet(wallet: Omit<TrackedWallet, 'id' | 'createdAt' | 'updatedAt'>): TrackedWallet {
    const wallets = StorageService.loadTrackedWallets()

    // Check for duplicates
    const existing = wallets.find(
      w => w.address.toLowerCase() === wallet.address.toLowerCase() &&
           w.blockchain === wallet.blockchain
    )
    if (existing) {
      throw new Error('This wallet address is already tracked')
    }

    const newWallet: TrackedWallet = {
      ...wallet,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    wallets.push(newWallet)
    localStorage.setItem(STORAGE_KEYS.TRACKED_WALLETS, JSON.stringify(wallets))

    return newWallet
  },

  /**
   * Load all tracked wallets
   */
  loadTrackedWallets(): TrackedWallet[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRACKED_WALLETS)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error loading tracked wallets:', error)
      return []
    }
  },

  /**
   * Update a tracked wallet
   */
  updateTrackedWallet(id: string, updates: Partial<TrackedWallet>): TrackedWallet | null {
    const wallets = StorageService.loadTrackedWallets()
    const index = wallets.findIndex(w => w.id === id)

    if (index === -1) return null

    wallets[index] = {
      ...wallets[index],
      ...updates,
      updatedAt: Date.now(),
    }

    localStorage.setItem(STORAGE_KEYS.TRACKED_WALLETS, JSON.stringify(wallets))
    return wallets[index]
  },

  /**
   * Remove a tracked wallet
   */
  removeTrackedWallet(id: string): boolean {
    const wallets = StorageService.loadTrackedWallets()
    const filtered = wallets.filter(w => w.id !== id)

    if (filtered.length === wallets.length) return false

    localStorage.setItem(STORAGE_KEYS.TRACKED_WALLETS, JSON.stringify(filtered))
    return true
  },

  /**
   * Clear all tracked wallets
   */
  clearTrackedWallets(): void {
    localStorage.removeItem(STORAGE_KEYS.TRACKED_WALLETS)
  },
}
