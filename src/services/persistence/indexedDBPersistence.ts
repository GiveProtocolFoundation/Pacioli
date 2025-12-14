/**
 * IndexedDB Persistence Service
 * Fallback implementation for browser/dev mode when Tauri is not available
 * Provides profile and wallet management using IndexedDB
 */

import type {
  PersistenceService,
  Profile,
  Wallet,
  WalletInput,
  StoredTransaction,
  TransactionInput,
  PaginationOptions,
} from './types'

const DB_NAME = 'PacioliPersistenceDB'
const DB_VERSION = 1

const STORES = {
  PROFILES: 'profiles',
  WALLETS: 'wallets',
  PROFILE_TRANSACTIONS: 'profile_transactions',
  SETTINGS: 'settings',
} as const

// Utility functions (standalone to avoid 'this' requirement)
const generateId = (): string => crypto.randomUUID()
const getNow = (): string => new Date().toISOString()

class IndexedDBPersistenceService implements PersistenceService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  private async init(): Promise<void> {
    if (this.db) {
      return undefined
    }
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open persistence IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Profiles store
        if (!db.objectStoreNames.contains(STORES.PROFILES)) {
          db.createObjectStore(STORES.PROFILES, { keyPath: 'id' })
        }

        // Wallets store
        if (!db.objectStoreNames.contains(STORES.WALLETS)) {
          const walletStore = db.createObjectStore(STORES.WALLETS, {
            keyPath: 'id',
          })
          walletStore.createIndex('profile_id', 'profile_id', { unique: false })
          walletStore.createIndex('address_chain', ['address', 'chain'], {
            unique: false,
          })
        }

        // Profile transactions store (links transactions to wallets/profiles)
        if (!db.objectStoreNames.contains(STORES.PROFILE_TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORES.PROFILE_TRANSACTIONS, {
            keyPath: 'id',
          })
          txStore.createIndex('wallet_id', 'wallet_id', { unique: false })
          txStore.createIndex('hash', 'hash', { unique: false })
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
        }
      }
    })

    return this.initPromise
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')
    return this.db
  }

  // ============================================================================
  // Profile Operations
  // ============================================================================

  async createProfile(name: string): Promise<Profile> {
    const db = await this.ensureDB()
    const now = getNow()
    const profile: Profile = {
      id: generateId(),
      name,
      avatar_url: null,
      created_at: now,
      updated_at: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILES, 'readwrite')
      const store = tx.objectStore(STORES.PROFILES)
      const request = store.add(profile)
      request.onsuccess = () => resolve(profile)
      request.onerror = () => reject(request.error)
    })
  }

  async getProfiles(): Promise<Profile[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILES, 'readonly')
      const store = tx.objectStore(STORES.PROFILES)
      const request = store.getAll()
      request.onsuccess = () => {
        const profiles = request.result as Profile[]
        profiles.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        resolve(profiles)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async updateProfile(id: string, name: string): Promise<Profile> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILES, 'readwrite')
      const store = tx.objectStore(STORES.PROFILES)
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const profile = getRequest.result as Profile
        if (!profile) {
          reject(new Error('Profile not found'))
          return
        }

        profile.name = name
        profile.updated_at = getNow()

        const putRequest = store.put(profile)
        putRequest.onsuccess = () => resolve(profile)
        putRequest.onerror = () => reject(putRequest.error)
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async deleteProfile(id: string): Promise<void> {
    const db = await this.ensureDB()

    // First delete all wallets and their transactions for this profile
    const wallets = await this.getWallets(id)
    for (const wallet of wallets) {
      await this.deleteWallet(wallet.id)
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILES, 'readwrite')
      const store = tx.objectStore(STORES.PROFILES)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ============================================================================
  // Wallet Operations
  // ============================================================================

  async saveWallet(wallet: WalletInput): Promise<Wallet> {
    const db = await this.ensureDB()
    const now = getNow()

    // Check if wallet already exists for this profile/address/chain
    const existingWallets = await this.getWallets(wallet.profile_id)
    const existing = existingWallets.find(
      w => w.address === wallet.address && w.chain === wallet.chain
    )

    if (existing) {
      // Update existing wallet
      existing.name = wallet.name ?? existing.name
      existing.wallet_type = wallet.wallet_type
      existing.updated_at = now

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.WALLETS, 'readwrite')
        const store = tx.objectStore(STORES.WALLETS)
        const request = store.put(existing)
        request.onsuccess = () => resolve(existing)
        request.onerror = () => reject(request.error)
      })
    }

    // Create new wallet
    const newWallet: Wallet = {
      id: generateId(),
      profile_id: wallet.profile_id,
      address: wallet.address,
      chain: wallet.chain,
      name: wallet.name ?? null,
      wallet_type: wallet.wallet_type,
      created_at: now,
      updated_at: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WALLETS, 'readwrite')
      const store = tx.objectStore(STORES.WALLETS)
      const request = store.add(newWallet)
      request.onsuccess = () => resolve(newWallet)
      request.onerror = () => reject(request.error)
    })
  }

  async getWallets(profileId: string): Promise<Wallet[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WALLETS, 'readonly')
      const store = tx.objectStore(STORES.WALLETS)
      const index = store.index('profile_id')
      const request = index.getAll(profileId)
      request.onsuccess = () => {
        const wallets = request.result as Wallet[]
        wallets.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        resolve(wallets)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getWalletById(id: string): Promise<Wallet | null> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WALLETS, 'readonly')
      const store = tx.objectStore(STORES.WALLETS)
      const request = store.get(id)
      request.onsuccess = () => resolve((request.result as Wallet) || null)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteWallet(id: string): Promise<void> {
    const db = await this.ensureDB()

    // Delete associated transactions first
    await this.deleteTransactions(id)

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WALLETS, 'readwrite')
      const store = tx.objectStore(STORES.WALLETS)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async saveTransactions(
    walletId: string,
    transactions: TransactionInput[]
  ): Promise<number> {
    const db = await this.ensureDB()
    const now = getNow()
    let savedCount = 0

    const tx = db.transaction(STORES.PROFILE_TRANSACTIONS, 'readwrite')
    const store = tx.objectStore(STORES.PROFILE_TRANSACTIONS)

    for (const txInput of transactions) {
      const storedTx: StoredTransaction = {
        id: generateId(),
        wallet_id: walletId,
        hash: txInput.hash,
        block_number: txInput.block_number ?? null,
        timestamp: txInput.timestamp ?? null,
        from_address: txInput.from_address ?? null,
        to_address: txInput.to_address ?? null,
        value: txInput.value ?? null,
        fee: txInput.fee ?? null,
        status: txInput.status ?? null,
        tx_type: txInput.tx_type ?? null,
        token_symbol: txInput.token_symbol ?? null,
        token_decimals: txInput.token_decimals ?? null,
        chain: txInput.chain,
        raw_data: txInput.raw_data ?? null,
        created_at: now,
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(storedTx)
          request.onsuccess = () => {
            savedCount++
            resolve()
          }
          request.onerror = () => reject(request.error)
        })
      } catch {
        // Continue on error
      }
    }

    return savedCount
  }

  async getTransactions(
    walletId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]> {
    const db = await this.ensureDB()
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILE_TRANSACTIONS, 'readonly')
      const store = tx.objectStore(STORES.PROFILE_TRANSACTIONS)
      const index = store.index('wallet_id')
      const request = index.getAll(walletId)

      request.onsuccess = () => {
        const transactions = request.result as StoredTransaction[]
        transactions.sort((a, b) => {
          const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
          const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
          return bTime - aTime
        })
        resolve(transactions.slice(offset, offset + limit))
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllTransactions(
    profileId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]> {
    const wallets = await this.getWallets(profileId)
    const allTransactions: StoredTransaction[] = []

    for (const wallet of wallets) {
      const transactions = await this.getTransactions(wallet.id, {
        limit: 10000,
      })
      allTransactions.push(...transactions)
    }

    // Sort by timestamp descending
    allTransactions.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return bTime - aTime
    })

    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    return allTransactions.slice(offset, offset + limit)
  }

  async deleteTransactions(walletId: string): Promise<number> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILE_TRANSACTIONS, 'readwrite')
      const store = tx.objectStore(STORES.PROFILE_TRANSACTIONS)
      const index = store.index('wallet_id')
      const request = index.openCursor(walletId)
      let deletedCount = 0

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

  // ============================================================================
  // Settings Operations
  // ============================================================================

  async getSetting(key: string): Promise<string | null> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly')
      const store = tx.objectStore(STORES.SETTINGS)
      const request = store.get(key)
      request.onsuccess = () => {
        const result = request.result as
          | { key: string; value: string }
          | undefined
        resolve(result?.value ?? null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite')
      const store = tx.objectStore(STORES.SETTINGS)
      const request = store.put({ key, value, updated_at: getNow() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deleteSetting(key: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite')
      const store = tx.objectStore(STORES.SETTINGS)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllSettings(): Promise<Array<[string, string]>> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly')
      const store = tx.objectStore(STORES.SETTINGS)
      const request = store.getAll()
      request.onsuccess = () => {
        const results = request.result as Array<{ key: string; value: string }>
        resolve(results.map(r => [r.key, r.value]))
      }
      request.onerror = () => reject(request.error)
    })
  }
}

export const indexedDBPersistence = new IndexedDBPersistenceService()
