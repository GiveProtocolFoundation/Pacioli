/**
 * Storage Service
 * Simple localStorage wrapper for wallet and transaction data
 * Can be upgraded to IndexedDB for better performance with large datasets
 */

import type { ConnectedWallet, Transaction } from '../wallet/types'

const STORAGE_KEYS = {
  WALLETS: 'pacioli_connected_wallets',
  TRANSACTIONS: 'pacioli_transactions',
  SYNC_STATUS: 'pacioli_sync_status',
} as const

export interface SyncStatus {
  network: string
  address: string
  lastSyncedBlock: number
  lastSyncTime: Date
  isSyncing: boolean
}

export class StorageService {
  /**
   * Save connected wallets
   */
  static saveWallets(wallets: ConnectedWallet[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets))
    } catch (error) {
      console.error('Error saving wallets:', error)
    }
  }

  /**
   * Load connected wallets
   */
  static loadWallets(): ConnectedWallet[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WALLETS)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error loading wallets:', error)
      return []
    }
  }

  /**
   * Clear saved wallets
   */
  static clearWallets(): void {
    localStorage.removeItem(STORAGE_KEYS.WALLETS)
  }

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
        new Map(allTransactions[key].map((tx: Transaction) => [tx.id, tx])).values()
      )

      // Sort by block number (newest first)
      allTransactions[key].sort((a: Transaction, b: Transaction) => b.blockNumber - a.blockNumber)

      localStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(allTransactions)
      )
    } catch (error) {
      console.error('Error saving transactions:', error)
    }
  }

  /**
   * Load all transactions
   */
  static loadTransactions(): Record<string, Transaction[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Error loading transactions:', error)
      return {}
    }
  }

  /**
   * Load transactions for specific address and network
   */
  loadTransactionsFor(network: string, address: string): Transaction[] {
    const allTransactions = StorageService.loadTransactions()
    const key = `${network}:${address}`
    return allTransactions[key] || []
  }

  /**
   * Clear all transactions
   */
  static clearTransactions(): void {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS)
  }

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
  }

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
  }

  /**
   * Load all sync statuses
   */
  static loadAllSyncStatus(): Record<string, SyncStatus> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_STATUS)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Error loading sync status:', error)
      return {}
    }
  }

  /**
   * Clear all stored data
   */
  clearAll(): void {
    StorageService.clearWallets()
    StorageService.clearTransactions()
    localStorage.removeItem(STORAGE_KEYS.SYNC_STATUS)
  }
}

export const storageService = new StorageService()
