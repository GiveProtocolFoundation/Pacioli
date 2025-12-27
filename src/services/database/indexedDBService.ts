/**
 * IndexedDB Transaction Service
 * Production-ready database for storing blockchain transactions
 * Supports 100k+ transactions with proper indexing and querying
 */

import type { Transaction, ConnectedWallet } from '../wallet/types'

const DB_NAME = 'PacioliDB'
const DB_VERSION = 2 // Bumped for wallet_aliases store

// Store names
const STORES = {
  TRANSACTIONS: 'transactions',
  WALLETS: 'wallets',
  SYNC_STATUS: 'sync_status',
  METADATA: 'metadata',
  WALLET_ALIASES: 'wallet_aliases',
} as const

export interface SyncStatus {
  network: string
  address: string
  lastSyncedBlock: number
  lastSyncTime: Date
  isSyncing: boolean
}

export interface WalletAlias {
  address: string // Primary key - the wallet address
  alias: string // User-defined alias/name
  updatedAt: Date
}

export interface TransactionQuery {
  network?: string
  address?: string
  type?: string
  startBlock?: number
  endBlock?: number
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface TransactionPage {
  transactions: Transaction[]
  total: number
  hasMore: boolean
}

class IndexedDBService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) {
      return
    }
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create transactions store
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORES.TRANSACTIONS, {
            keyPath: 'id',
          })

          // Indexes for fast queries
          txStore.createIndex('network', 'network', { unique: false })
          txStore.createIndex('address', 'address', { unique: false })
          txStore.createIndex('blockNumber', 'blockNumber', { unique: false })
          txStore.createIndex('timestamp', 'timestamp', { unique: false })
          txStore.createIndex('type', 'type', { unique: false })
          txStore.createIndex('status', 'status', { unique: false })

          // Compound indexes for common queries
          txStore.createIndex('network_address', ['network', 'address'], {
            unique: false,
          })
          txStore.createIndex('network_block', ['network', 'blockNumber'], {
            unique: false,
          })
          txStore.createIndex('address_block', ['address', 'blockNumber'], {
            unique: false,
          })
          txStore.createIndex('address_timestamp', ['address', 'timestamp'], {
            unique: false,
          })
        }

        // Create wallets store
        if (!db.objectStoreNames.contains(STORES.WALLETS)) {
          db.createObjectStore(STORES.WALLETS, { keyPath: 'type' })
        }

        // Create sync status store
        if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
          const syncStore = db.createObjectStore(STORES.SYNC_STATUS, {
            keyPath: ['network', 'address'],
          })
          syncStore.createIndex('network', 'network', { unique: false })
          syncStore.createIndex('address', 'address', { unique: false })
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' })
        }

        // Create wallet aliases store (added in v2)
        if (!db.objectStoreNames.contains(STORES.WALLET_ALIASES)) {
          db.createObjectStore(STORES.WALLET_ALIASES, { keyPath: 'address' })
        }
        return null
      }
    })

    return this.initPromise
  }

  /**
   * Ensure DB is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.init()
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Save transactions (batch insert/update)
   */
  async saveTransactions(
    network: string,
    address: string,
    transactions: Transaction[]
  ): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite')
    const store = tx.objectStore(STORES.TRANSACTIONS)

    // Tag transactions with the queried address for easier retrieval
    const taggedTransactions = transactions.map(t => ({
      ...t,
      address, // The address used to query this transaction
      network,
    }))

    // Batch insert
    const promises = taggedTransactions.map(transaction => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put(transaction)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    await Promise.all(promises)
  }

  /**
   * Get transactions with filtering and pagination
   */
  async getTransactions(
    query: TransactionQuery = {}
  ): Promise<TransactionPage> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.TRANSACTIONS, 'readonly')
    const store = tx.objectStore(STORES.TRANSACTIONS)

    const {
      network,
      address,
      type,
      startBlock,
      endBlock,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = query

    let results: Transaction[] = []

    // Choose best index for query
    if (network && address) {
      // Use compound index for network + address
      const index = store.index('network_address')
      const range = IDBKeyRange.only([network, address])
      results = await IndexedDBService.getFromIndex(index, range)
    } else if (address) {
      // Use address index
      const index = store.index('address')
      const range = IDBKeyRange.only(address)
      results = await IndexedDBService.getFromIndex(index, range)
    } else if (network) {
      // Use network index
      const index = store.index('network')
      const range = IDBKeyRange.only(network)
      results = await IndexedDBService.getFromIndex(index, range)
    } else {
      // Full scan (less efficient)
      results = await IndexedDBService.getAllFromStore(store)
    }

    // Apply additional filters
    results = results.filter(tx => {
      return (
        (!type || tx.type === type) &&
        (!startBlock || tx.blockNumber >= startBlock) &&
        (!endBlock || tx.blockNumber <= endBlock) &&
        (!startDate || new Date(tx.timestamp) >= startDate) &&
        (!endDate || new Date(tx.timestamp) <= endDate)
      )
    })

    // Sort by block number descending (newest first)
    results.sort((a, b) => b.blockNumber - a.blockNumber)

    const total = results.length
    const paginated = results.slice(offset, offset + limit)

    return {
      transactions: paginated,
      total,
      hasMore: offset + limit < total,
    }
  }

  /**
   * Get transactions for a specific address and network
   */
  async getTransactionsFor(
    network: string,
    address: string
  ): Promise<Transaction[]> {
    const result = await this.getTransactions({
      network,
      address,
      limit: 10000,
    })
    return result.transactions
  }

  /**
   * Delete transactions older than a certain date
   */
  async deleteOldTransactions(beforeDate: Date): Promise<number> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite')
    const store = tx.objectStore(STORES.TRANSACTIONS)
    const index = store.index('timestamp')

    const range = IDBKeyRange.upperBound(beforeDate.getTime())
    const request = index.openCursor(range)

    let deletedCount = 0

    return new Promise((resolve, reject) => {
      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all transactions
   */
  async clearTransactions(): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite')
    const store = tx.objectStore(STORES.TRANSACTIONS)
    await IndexedDBService.promisifyRequest(store.clear())
  }

  // ==================== WALLET OPERATIONS ====================

  /**
   * Save connected wallets
   */
  async saveWallets(wallets: ConnectedWallet[]): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLETS, 'readwrite')
    const store = tx.objectStore(STORES.WALLETS)

    const promises = wallets.map(wallet => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put(wallet)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    await Promise.all(promises)
  }

  /**
   * Load connected wallets
   */
  async loadWallets(): Promise<ConnectedWallet[]> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLETS, 'readonly')
    const store = tx.objectStore(STORES.WALLETS)
    return IndexedDBService.getAllFromStore(store)
  }

  /**
   * Clear saved wallets
   */
  async clearWallets(): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLETS, 'readwrite')
    const store = tx.objectStore(STORES.WALLETS)
    await IndexedDBService.promisifyRequest(store.clear())
  }

  // ==================== SYNC STATUS OPERATIONS ====================

  /**
   * Save sync status
   */
  async saveSyncStatus(status: SyncStatus): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.SYNC_STATUS, 'readwrite')
    const store = tx.objectStore(STORES.SYNC_STATUS)
    await IndexedDBService.promisifyRequest(store.put(status))
  }

  /**
   * Load sync status for network and address
   */
  async loadSyncStatus(
    network: string,
    address: string
  ): Promise<SyncStatus | null> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.SYNC_STATUS, 'readonly')
    const store = tx.objectStore(STORES.SYNC_STATUS)
    const result = await IndexedDBService.promisifyRequest<SyncStatus>(
      store.get([network, address])
    )
    return result || null
  }

  /**
   * Load all sync statuses
   */
  async loadAllSyncStatus(): Promise<Record<string, SyncStatus>> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.SYNC_STATUS, 'readonly')
    const store = tx.objectStore(STORES.SYNC_STATUS)
    const statuses = await IndexedDBService.getAllFromStore<SyncStatus>(store)

    const record: Record<string, SyncStatus> = {}
    statuses.forEach((status: SyncStatus) => {
      const key = `${status.network}:${status.address}`
      record[key] = status
    })
    return record
  }

  // ==================== METADATA OPERATIONS ====================

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: unknown): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.METADATA, 'readwrite')
    const store = tx.objectStore(STORES.METADATA)
    await IndexedDBService.promisifyRequest(
      store.put({
        key,
        value,
        updatedAt: new Date().toISOString(),
      })
    )
  }

  /**
   * Get metadata value
   */
  async getMetadata<T = unknown>(key: string): Promise<T | null> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.METADATA, 'readonly')
    const store = tx.objectStore(STORES.METADATA)
    const result = await IndexedDBService.promisifyRequest<{ key: string; value: T }>(
      store.get(key)
    )
    return result?.value || null
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get all items from a store
   */
  private static async getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get items from an index with a range
   */
  private static async getFromIndex<T>(
    index: IDBIndex,
    range?: IDBKeyRange
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = range ? index.getAll(range) : index.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Promisify an IDBRequest
   */
  private static promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    transactionCount: number
    walletCount: number
    syncStatusCount: number
    estimatedSize: string
  }> {
    const db = await this.ensureDB()

    const txCount = await this.getStoreCount(db, STORES.TRANSACTIONS)
    const walletCount = await this.getStoreCount(db, STORES.WALLETS)
    const syncCount = await this.getStoreCount(db, STORES.SYNC_STATUS)

    // Estimate size (rough approximation)
    const estimatedSize = `~${Math.round((txCount * 2) / 1024)} MB`

    return {
      transactionCount: txCount,
      walletCount,
      syncStatusCount: syncCount,
      estimatedSize,
    }
  }

  private async getStoreCount(
    db: IDBDatabase,
    storeName: string
  ): Promise<number> {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    return IndexedDBService.promisifyRequest(store.count())
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    await this.clearTransactions()
    await this.clearWallets()

    const db = await this.ensureDB()
    const tx = db.transaction(
      [STORES.SYNC_STATUS, STORES.METADATA],
      'readwrite'
    )
    await IndexedDBService.promisifyRequest(tx.objectStore(STORES.SYNC_STATUS).clear())
    await IndexedDBService.promisifyRequest(tx.objectStore(STORES.METADATA).clear())
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }

  // ==================== WALLET ALIAS OPERATIONS ====================

  /**
   * Save or update a wallet alias
   */
  async saveWalletAlias(address: string, alias: string): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLET_ALIASES, 'readwrite')
    const store = tx.objectStore(STORES.WALLET_ALIASES)

    const walletAlias: WalletAlias = {
      address: address.toLowerCase(), // Normalize address for consistent lookup
      alias,
      updatedAt: new Date(),
    }

    await IndexedDBService.promisifyRequest(store.put(walletAlias))
  }

  /**
   * Get alias for a specific address
   */
  async getWalletAlias(address: string): Promise<string | null> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLET_ALIASES, 'readonly')
    const store = tx.objectStore(STORES.WALLET_ALIASES)

    const result = await IndexedDBService.promisifyRequest<WalletAlias>(
      store.get(address.toLowerCase())
    )
    return result?.alias || null
  }

  /**
   * Get all wallet aliases as a map (address -> alias)
   */
  async getAllWalletAliases(): Promise<Record<string, string>> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLET_ALIASES, 'readonly')
    const store = tx.objectStore(STORES.WALLET_ALIASES)

    const aliases = await IndexedDBService.getAllFromStore<WalletAlias>(store)
    const aliasMap: Record<string, string> = {}

    for (const entry of aliases) {
      aliasMap[entry.address] = entry.alias
    }

    return aliasMap
  }

  /**
   * Delete a wallet alias
   */
  async deleteWalletAlias(address: string): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLET_ALIASES, 'readwrite')
    const store = tx.objectStore(STORES.WALLET_ALIASES)
    await IndexedDBService.promisifyRequest(store.delete(address.toLowerCase()))
  }

  /**
   * Clear all wallet aliases
   */
  async clearWalletAliases(): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(STORES.WALLET_ALIASES, 'readwrite')
    const store = tx.objectStore(STORES.WALLET_ALIASES)
    await IndexedDBService.promisifyRequest(store.clear())
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService()
