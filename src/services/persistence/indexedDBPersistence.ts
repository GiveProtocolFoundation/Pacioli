/**
 * IndexedDB Persistence Service
 * Fallback implementation for browser/dev mode when Tauri is not available
 * Provides profile, wallet, entity, and transaction management using IndexedDB
 */

import type {
  PersistenceService,
  Profile,
  Wallet,
  WalletInput,
  StoredTransaction,
  TransactionInput,
  PaginationOptions,
  ChainSyncStatus,
  Entity,
  EntityInput,
  EntityUpdate,
  EntityFilter,
  EntityAddress,
  EntityAddressInput,
  AddressMatch,
  KnownAddress,
  EntityType,
  TaxDocumentationStatus,
  BankAccount,
  BankAccountInput,
  BankTransaction,
  BankTransactionInput,
  BankTransactionFilter,
  ImportBatch,
  ImportBatchInput,
  StatementProfile,
  StatementProfileInput,
} from './types'
import type { Transaction, ConnectedWallet } from '../wallet/types'
import { indexedDBService } from '../database/indexedDBService'

const DB_NAME = 'PacioliPersistenceDB'
const DB_VERSION = 3

const STORES = {
  PROFILES: 'profiles',
  WALLETS: 'wallets',
  PROFILE_TRANSACTIONS: 'profile_transactions',
  SETTINGS: 'settings',
  ENTITIES: 'entities',
  ENTITY_ADDRESSES: 'entity_addresses',
  KNOWN_ADDRESSES: 'known_addresses',
  BANK_ACCOUNTS: 'bank_accounts',
  BANK_TRANSACTIONS: 'bank_transactions',
  IMPORT_BATCHES: 'import_batches',
  STATEMENT_PROFILES: 'statement_profiles',
} as const

// Utility functions (standalone to avoid 'this' requirement)
/**
 * Generates a random unique identifier (UUID).
 * @returns {string} A newly generated UUID.
 */
const generateId = (): string => crypto.randomUUID()

/**
 * Gets the current timestamp in ISO string format.
 * @returns {string} The current date and time as an ISO string.
 */
const getNow = (): string => new Date().toISOString()

/**
 * IndexedDB-based persistence service for storing application data.
 */
class IndexedDBPersistenceService implements PersistenceService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /** Opens the IndexedDB database (idempotent; reuses an in-flight open). */
  private init(): Promise<void> {
    if (this.db) {
      return Promise.resolve()
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

        // Entities store
        if (!db.objectStoreNames.contains(STORES.ENTITIES)) {
          const entityStore = db.createObjectStore(STORES.ENTITIES, {
            keyPath: 'id',
          })
          entityStore.createIndex('profile_id', 'profile_id', { unique: false })
          entityStore.createIndex('entity_type', 'entity_type', {
            unique: false,
          })
          entityStore.createIndex('name', 'name', { unique: false })
          entityStore.createIndex(
            'profile_name_type',
            ['profile_id', 'name', 'entity_type'],
            {
              unique: true,
            }
          )
        }

        // Entity addresses store
        if (!db.objectStoreNames.contains(STORES.ENTITY_ADDRESSES)) {
          const addrStore = db.createObjectStore(STORES.ENTITY_ADDRESSES, {
            keyPath: 'id',
          })
          addrStore.createIndex('entity_id', 'entity_id', { unique: false })
          addrStore.createIndex('address', 'address', { unique: false })
          addrStore.createIndex('address_chain', ['address', 'chain'], {
            unique: false,
          })
          addrStore.createIndex(
            'entity_address_chain',
            ['entity_id', 'address', 'chain'],
            {
              unique: true,
            }
          )
        }

        // Known addresses store
        if (!db.objectStoreNames.contains(STORES.KNOWN_ADDRESSES)) {
          const knownStore = db.createObjectStore(STORES.KNOWN_ADDRESSES, {
            keyPath: ['address', 'chain'],
          })
          knownStore.createIndex('entity_name', 'entity_name', {
            unique: false,
          })
          knownStore.createIndex('entity_type', 'entity_type', {
            unique: false,
          })
          knownStore.createIndex('chain', 'chain', { unique: false })
        }

        // Bank accounts store (GIV-825)
        if (!db.objectStoreNames.contains(STORES.BANK_ACCOUNTS)) {
          const baStore = db.createObjectStore(STORES.BANK_ACCOUNTS, {
            keyPath: 'id',
          })
          baStore.createIndex('institution_name', 'institution_name', {
            unique: false,
          })
          baStore.createIndex('entity_id', 'entity_id', { unique: false })
        }

        // Bank transactions store (GIV-825)
        if (!db.objectStoreNames.contains(STORES.BANK_TRANSACTIONS)) {
          const btStore = db.createObjectStore(STORES.BANK_TRANSACTIONS, {
            keyPath: 'id',
          })
          btStore.createIndex('bank_account_id', 'bank_account_id', {
            unique: false,
          })
          btStore.createIndex('posted_date', 'posted_date', { unique: false })
          btStore.createIndex(
            'account_posted',
            ['bank_account_id', 'posted_date'],
            {
              unique: false,
            }
          )
          btStore.createIndex('import_batch_id', 'import_batch_id', {
            unique: false,
          })
          btStore.createIndex(
            'classification_status',
            'classification_status',
            {
              unique: false,
            }
          )
        }

        // Import batches store (GIV-825)
        if (!db.objectStoreNames.contains(STORES.IMPORT_BATCHES)) {
          const ibStore = db.createObjectStore(STORES.IMPORT_BATCHES, {
            keyPath: 'id',
          })
          ibStore.createIndex('bank_account_id', 'bank_account_id', {
            unique: false,
          })
        }

        // Statement profiles store (GIV-825)
        if (!db.objectStoreNames.contains(STORES.STATEMENT_PROFILES)) {
          db.createObjectStore(STORES.STATEMENT_PROFILES, { keyPath: 'id' })
        }
      }
    })

    return this.initPromise
  }

  /**
   * Ensures the database is initialized and returns the IDBDatabase instance.
   *
   * @returns {Promise<IDBDatabase>} The initialized database instance.
   */
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

  /**
   * Retrieves all profiles from the database, sorted by creation date in descending order.
   * @returns {Promise<Profile[]>} A promise that resolves to an array of Profile objects.
   */
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

  /**
   * Updates the specified profile's name and updated_at timestamp in the database.
   *
   * @param id The unique identifier of the profile to update.
   * @param name The new name to assign to the profile.
   * @returns A promise that resolves with the updated Profile object.
   */
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

  /**
   * Deletes a profile by its ID, including associated wallets and entities.
   *
   * @param id - The ID of the profile to delete.
   * @returns A Promise that resolves when the deletion is complete.
   */
  async deleteProfile(id: string): Promise<void> {
    const db = await this.ensureDB()

    // First delete all wallets and their transactions for this profile
    const wallets = await this.getWallets(id)
    for (const wallet of wallets) {
      await this.deleteWallet(wallet.id)
    }

    // Delete all entities for this profile
    const entities = await this.getEntities(id)
    for (const entity of entities) {
      await this.deleteEntity(entity.id)
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

  /**
   * Retrieves all wallets associated with the given profile ID, sorted by creation date descending.
   * @param profileId The ID of the profile whose wallets are to be retrieved.
   * @returns A promise that resolves to an array of Wallet objects sorted by their creation date (newest first).
   */
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

  /**
   * Retrieves a wallet by its ID from the IndexedDB.
   * @param id - The unique identifier of the wallet.
   * @returns A promise that resolves to the wallet if found, or null otherwise.
   */
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

  /**
   * Deletes a wallet and its associated transactions from the database.
   *
   * @param id - The identifier of the wallet to delete.
   * @returns A promise that resolves when the wallet and its transactions have been deleted.
   */
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
        xcm_correlation_id: txInput.xcm_correlation_id ?? null,
        xcm_linked_tx_id: txInput.xcm_linked_tx_id ?? null,
        xcm_role: txInput.xcm_role ?? null,
        xcm_status: txInput.xcm_status ?? null,
        price_at_acquisition_usd: txInput.price_at_acquisition_usd ?? null,
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

  /**
   * Retrieves transactions for a specific wallet from the database, sorted by timestamp descending.
   *
   * @param walletId - The ID of the wallet to retrieve transactions for.
   * @param options - Optional pagination options including limit and offset.
   * @returns A Promise that resolves to an array of StoredTransaction objects.
   */
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

  /**
   * Retrieves all transactions for a given profile and returns them paginated.
   *
   * @param profileId - The ID of the profile to fetch transactions for.
   * @param options - Optional pagination options specifying limit and offset.
   * @returns A promise that resolves to an array of stored transactions within the specified pagination range.
   */
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

  /**
   * Deletes all transactions associated with the given wallet ID from the IndexedDB.
   * @param walletId - The ID of the wallet whose transactions should be deleted.
   * @returns A promise that resolves to the number of transactions deleted.
   */
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

  /**
   * Sets a setting in the database for the specified key and value.
   * @param key The key of the setting to store.
   * @param value The value to store for the setting.
   * @returns A promise that resolves when the setting is stored successfully.
   */
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

  /**
   * Deletes a setting with the specified key from the settings store in IndexedDB.
   * @param key - The key of the setting to delete.
   * @returns A promise that resolves when the deletion completes.
   */
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

  /**
   * Retrieves all settings from IndexedDB.
   * @returns Promise resolving to an array of [key, value] string pairs.
   */
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

  // ============================================================================
  // Entity Operations
  // ============================================================================

  async createEntity(entity: EntityInput): Promise<Entity> {
    const db = await this.ensureDB()
    const now = getNow()

    const newEntity: Entity = {
      id: generateId(),
      profile_id: entity.profile_id,
      entity_type: entity.entity_type as EntityType,
      name: entity.name,
      display_name: entity.display_name ?? null,
      email: entity.email ?? null,
      phone: entity.phone ?? null,
      website: entity.website ?? null,
      address: entity.address ?? null,
      country_code: entity.country_code ?? null,
      tax_identifier: entity.tax_identifier ?? null,
      tax_identifier_type: entity.tax_identifier_type ?? null,
      default_wallet_address: entity.default_wallet_address ?? null,
      category: entity.category ?? null,
      tags: entity.tags ?? null,
      default_payment_terms: entity.default_payment_terms ?? null,
      default_currency: entity.default_currency ?? null,
      reportable_payee: entity.reportable_payee ?? false,
      tax_documentation_status: (entity.tax_documentation_status ??
        'none') as TaxDocumentationStatus,
      tax_documentation_date: entity.tax_documentation_date ?? null,
      tax_compliance: entity.tax_compliance ?? null,
      notes: entity.notes ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITIES, 'readwrite')
      const store = tx.objectStore(STORES.ENTITIES)
      const request = store.add(newEntity)
      request.onsuccess = () => resolve(newEntity)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Retrieves all entities for a given profile, with optional filtering.
   * @param profileId - The ID of the profile whose entities are to be retrieved.
   * @param filter - Optional filters to apply (entity type and active status).
   * @returns A promise that resolves to an array of Entity objects matching the criteria.
   */
  async getEntities(
    profileId: string,
    filter?: EntityFilter
  ): Promise<Entity[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITIES, 'readonly')
      const store = tx.objectStore(STORES.ENTITIES)
      const index = store.index('profile_id')
      const request = index.getAll(profileId)

      request.onsuccess = () => {
        let entities = request.result as Entity[]

        // Apply filters
        if (filter?.entity_type) {
          entities = entities.filter(e => e.entity_type === filter.entity_type)
        }
        if (filter?.is_active !== undefined) {
          entities = entities.filter(e => e.is_active === filter.is_active)
        }

        // Sort by name
        entities.sort((a, b) => a.name.localeCompare(b.name))
        resolve(entities)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Retrieves a single entity by its unique identifier.
   * @param id - The ID of the entity to retrieve.
   * @returns A promise that resolves to the Entity object if found, or null otherwise.
   */
  async getEntityById(id: string): Promise<Entity | null> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITIES, 'readonly')
      const store = tx.objectStore(STORES.ENTITIES)
      const request = store.get(id)
      /**
       * Retrieves an entity by its ID.
       * @param id - The ID of the entity to retrieve.
       * @returns A promise that resolves to the Entity or null if not found.
       */
      request.onsuccess = () => resolve((request.result as Entity) || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Updates an existing entity with provided fields.
   * @param id - The ID of the entity to update.
   * @param update - An object containing the fields to update on the entity.
   * @returns A promise that resolves to the updated Entity object.
   */
  async updateEntity(id: string, update: EntityUpdate): Promise<Entity> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITIES, 'readwrite')
      const store = tx.objectStore(STORES.ENTITIES)
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const entity = getRequest.result as Entity
        if (!entity) {
          reject(new Error('Entity not found'))
          return
        }

        // Apply updates
        if (update.entity_type !== undefined)
          entity.entity_type = update.entity_type
        if (update.name !== undefined) entity.name = update.name
        if (update.display_name !== undefined)
          entity.display_name = update.display_name
        if (update.email !== undefined) entity.email = update.email
        if (update.phone !== undefined) entity.phone = update.phone
        if (update.website !== undefined) entity.website = update.website
        if (update.address !== undefined) entity.address = update.address
        if (update.country_code !== undefined)
          entity.country_code = update.country_code
        if (update.tax_identifier !== undefined)
          entity.tax_identifier = update.tax_identifier
        if (update.tax_identifier_type !== undefined)
          entity.tax_identifier_type = update.tax_identifier_type
        if (update.default_wallet_address !== undefined)
          entity.default_wallet_address = update.default_wallet_address
        if (update.category !== undefined) entity.category = update.category
        if (update.tags !== undefined) entity.tags = update.tags
        if (update.default_payment_terms !== undefined)
          entity.default_payment_terms = update.default_payment_terms
        if (update.default_currency !== undefined)
          entity.default_currency = update.default_currency
        if (update.reportable_payee !== undefined)
          entity.reportable_payee = update.reportable_payee
        if (update.tax_documentation_status !== undefined)
          entity.tax_documentation_status = update.tax_documentation_status
        if (update.tax_documentation_date !== undefined)
          entity.tax_documentation_date = update.tax_documentation_date
        if (update.tax_compliance !== undefined)
          entity.tax_compliance = update.tax_compliance
        if (update.notes !== undefined) entity.notes = update.notes
        if (update.is_active !== undefined) entity.is_active = update.is_active

        entity.updated_at = getNow()

        const putRequest = store.put(entity)
        putRequest.onsuccess = () => resolve(entity)
        putRequest.onerror = () => reject(putRequest.error)
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Deletes an entity and its associated addresses from the database.
   * It first removes all associated addresses, then deletes the entity itself.
   * @param id - The unique identifier of the entity to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteEntity(id: string): Promise<void> {
    const db = await this.ensureDB()

    // Delete associated addresses first
    const addresses = await this.getEntityAddresses(id)
    for (const addr of addresses) {
      await this.deleteEntityAddress(addr.id)
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITIES, 'readwrite')
      const store = tx.objectStore(STORES.ENTITIES)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Searches for entities belonging to a profile that match the given query string.
   *
   * @param profileId - The unique identifier of the profile to search within.
   * @param query - The search query string to filter entities by name, display name, email, category, or tax identifier.
   * @param limit - Optional maximum number of results to return. Defaults to 20.
   * @returns A promise that resolves to an array of entities matching the search criteria, limited to the specified count.
   */
  async searchEntities(
    profileId: string,
    query: string,
    limit?: number
  ): Promise<Entity[]> {
    const entities = await this.getEntities(profileId, { is_active: true })
    const searchLower = query.toLowerCase()
    const maxResults = limit ?? 20

    const filtered = entities.filter(
      e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.display_name?.toLowerCase().includes(searchLower) ||
        e.email?.toLowerCase().includes(searchLower) ||
        e.category?.toLowerCase().includes(searchLower) ||
        e.tax_identifier?.toLowerCase().includes(searchLower)
    )

    return filtered.slice(0, maxResults)
  }

  /**
   * Finds an entity by address and optional chain for a given profile.
   *
   * @param profileId - The ID of the profile to which the entity belongs.
   * @param address - The address to search for.
   * @param chain - Optional blockchain chain identifier.
   * @returns A promise that resolves to the entity if found, otherwise null.
   */
  async findEntityByAddress(
    profileId: string,
    address: string,
    chain?: string
  ): Promise<Entity | null> {
    const db = await this.ensureDB()

    // Get all entity addresses matching the address (and optionally chain)
    const entityAddresses = await new Promise<EntityAddress[]>(
      (resolve, reject) => {
        const tx = db.transaction(STORES.ENTITY_ADDRESSES, 'readonly')
        const store = tx.objectStore(STORES.ENTITY_ADDRESSES)
        const index = store.index('address')
        const request = index.getAll(address)

        request.onsuccess = () => {
          let results = request.result as EntityAddress[]
          if (chain) {
            results = results.filter(ea => ea.chain === chain)
          }
          resolve(results)
        }
        request.onerror = () => reject(request.error)
      }
    )

    if (entityAddresses.length === 0) return null

    // Find entity that belongs to the profile
    for (const ea of entityAddresses) {
      const entity = await this.getEntityById(ea.entity_id)
      if (entity && entity.profile_id === profileId) {
        return entity
      }
    }

    return null
  }

  // ============================================================================
  // Entity Address Operations
  // ============================================================================

  async addEntityAddress(
    addressInput: EntityAddressInput
  ): Promise<EntityAddress> {
    const db = await this.ensureDB()
    const now = getNow()

    const newAddress: EntityAddress = {
      id: generateId(),
      entity_id: addressInput.entity_id,
      address: addressInput.address,
      chain: addressInput.chain,
      address_type: addressInput.address_type ?? null,
      label: addressInput.label ?? null,
      is_verified: addressInput.is_verified ?? false,
      verified_at: addressInput.is_verified ? now : null,
      verification_method: addressInput.verification_method ?? null,
      created_at: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITY_ADDRESSES, 'readwrite')
      const store = tx.objectStore(STORES.ENTITY_ADDRESSES)
      const request = store.add(newAddress)
      request.onsuccess = () => resolve(newAddress)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Retrieves all addresses for a given entity, sorted by creation date descending.
   *
   * @param entityId The ID of the entity whose addresses are to be retrieved.
   * @returns Promise resolving to an array of EntityAddress objects.
   */
  async getEntityAddresses(entityId: string): Promise<EntityAddress[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITY_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.ENTITY_ADDRESSES)
      const index = store.index('entity_id')
      const request = index.getAll(entityId)

      request.onsuccess = () => {
        const addresses = request.result as EntityAddress[]
        addresses.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        resolve(addresses)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Deletes an entity address from the IndexedDB store.
   *
   * @param id - The unique identifier of the entity address to delete.
   * @returns A promise that resolves when the delete operation completes.
   */
  async deleteEntityAddress(id: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITY_ADDRESSES, 'readwrite')
      const store = tx.objectStore(STORES.ENTITY_ADDRESSES)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ============================================================================
  // Address Detection Operations
  // ============================================================================

  async lookupAddress(
    profileId: string,
    address: string,
    chain: string
  ): Promise<AddressMatch | null> {
    // First check entity addresses
    const entity = await this.findEntityByAddress(profileId, address, chain)
    if (entity) {
      return {
        address,
        chain,
        match_type: 'entity',
        entity_id: entity.id,
        entity_name: entity.name,
        entity_type: entity.entity_type,
        category: entity.category,
        confidence: 'high',
      }
    }

    // Then check known addresses
    const db = await this.ensureDB()
    const known = await new Promise<KnownAddress | null>((resolve, reject) => {
      const tx = db.transaction(STORES.KNOWN_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.KNOWN_ADDRESSES)
      const request = store.get([address, chain])
      request.onsuccess = () => {
        const result = request.result as KnownAddress | undefined
        resolve(result?.is_active ? result : null)
      }
      request.onerror = () => reject(request.error)
    })

    if (known) {
      return {
        address,
        chain,
        match_type: 'known',
        entity_id: null,
        entity_name: known.entity_name,
        entity_type: known.entity_type,
        category: known.category,
        confidence: known.confidence,
      }
    }

    return null
  }

  /**
   * Looks up multiple addresses for a given profile and filters out null matches.
   *
   * @param profileId The identifier of the profile to lookup addresses for.
   * @param addresses An array of tuples, each containing an address and its corresponding chain.
   * @returns A promise that resolves to an array of AddressMatch objects for successful lookups.
   */
  async batchLookupAddresses(
    profileId: string,
    addresses: Array<[string, string]>
  ): Promise<AddressMatch[]> {
    const matches: AddressMatch[] = []

    for (const [address, chain] of addresses) {
      const match = await this.lookupAddress(profileId, address, chain)
      if (match) {
        matches.push(match)
      }
    }

    return matches
  }

  /**
   * Retrieves known addresses from the IndexedDB store, optionally filtering by chain and entity type.
   * @param chain Optional string to filter addresses by blockchain chain.
   * @param entityType Optional string to filter addresses by entity type.
   * @returns Promise resolving to an array of active KnownAddress objects sorted by entity name.
   */
  async getKnownAddresses(
    chain?: string,
    entityType?: string
  ): Promise<KnownAddress[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.KNOWN_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.KNOWN_ADDRESSES)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result as KnownAddress[]
        results = results.filter(k => k.is_active)

        if (chain) {
          results = results.filter(k => k.chain === chain)
        }
        if (entityType) {
          results = results.filter(k => k.entity_type === entityType)
        }

        results.sort((a, b) => a.entity_name.localeCompare(b.entity_name))
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Creates an entity from a known address record.
   *
   * @param profileId The profile ID to associate with the new entity.
   * @param address The known wallet address.
   * @param chain The blockchain chain identifier.
   * @returns The newly created Entity.
   */
  async createEntityFromKnown(
    profileId: string,
    address: string,
    chain: string
  ): Promise<Entity> {
    const db = await this.ensureDB()

    // Get known address
    const known = await new Promise<KnownAddress | null>((resolve, reject) => {
      const tx = db.transaction(STORES.KNOWN_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.KNOWN_ADDRESSES)
      const request = store.get([address, chain])
      request.onsuccess = () =>
        resolve((request.result as KnownAddress) || null)
      request.onerror = () => reject(request.error)
    })

    if (!known) {
      throw new Error('Known address not found')
    }

    // Create entity
    const entity = await this.createEntity({
      profile_id: profileId,
      entity_type: (known.entity_type as EntityType) ?? 'other',
      name: known.entity_name,
      website: known.website ?? undefined,
      country_code: known.country_code ?? undefined,
      default_wallet_address: address,
      category: known.category ?? undefined,
      notes: `Auto-created from known address. Source: ${known.source ?? 'unknown'}`,
    })

    // Add address
    await this.addEntityAddress({
      entity_id: entity.id,
      address,
      chain,
      address_type: 'primary',
      label: 'Main',
      is_verified: true,
      verification_method: 'known_address_database',
    })

    return entity
  }

  // ============================================================================
  // Chain Transaction Operations (delegates to indexedDBService)
  // ============================================================================

  // ============================================================================
  // Bank Account Operations (GIV-825)
  // ============================================================================

  /** Returns all bank accounts. */
  async getBankAccounts(): Promise<BankAccount[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BANK_ACCOUNTS, 'readonly')
      const store = tx.objectStore(STORES.BANK_ACCOUNTS)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /** Creates a new bank account and returns the persisted record. */
  async saveBankAccount(input: BankAccountInput): Promise<BankAccount> {
    const db = await this.ensureDB()
    const now = Math.floor(Date.now() / 1000)
    const account: BankAccount = {
      id: generateId(),
      institution_name: input.institution_name,
      account_nickname: input.account_nickname,
      account_type: input.account_type,
      currency: input.currency,
      gl_account_number: input.gl_account_number ?? '1000',
      external_source: input.external_source ?? null,
      external_account_id: input.external_account_id ?? null,
      masked_account_number: input.masked_account_number ?? null,
      opening_balance: input.opening_balance ?? null,
      opening_balance_date: input.opening_balance_date ?? null,
      entity_id: input.entity_id ?? null,
      active: true,
      created_at: now,
      updated_at: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BANK_ACCOUNTS, 'readwrite')
      const store = tx.objectStore(STORES.BANK_ACCOUNTS)
      const request = store.put(account)
      request.onsuccess = () => resolve(account)
      request.onerror = () => reject(request.error)
    })
  }

  // ============================================================================
  // Bank Transaction Operations (GIV-825)
  // ============================================================================

  /** Queries bank transactions for an account with optional filters and pagination. */
  async getBankTransactions(
    bankAccountId: string,
    filter?: BankTransactionFilter
  ): Promise<BankTransaction[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BANK_TRANSACTIONS, 'readonly')
      const store = tx.objectStore(STORES.BANK_TRANSACTIONS)
      const index = store.index('bank_account_id')
      const request = index.getAll(bankAccountId)
      request.onsuccess = () => {
        let rows: BankTransaction[] = request.result
        if (filter?.from_date != null) {
          const fromDate = filter.from_date
          rows = rows.filter(r => r.posted_date >= fromDate)
        }
        if (filter?.to_date != null) {
          const toDate = filter.to_date
          rows = rows.filter(r => r.posted_date <= toDate)
        }
        if (filter?.classification_status) {
          rows = rows.filter(
            r => r.classification_status === filter.classification_status
          )
        }
        if (filter?.import_batch_id) {
          rows = rows.filter(r => r.import_batch_id === filter.import_batch_id)
        }
        rows.sort((a, b) => b.posted_date - a.posted_date)
        const offset = filter?.offset ?? 0
        const limit = filter?.limit ?? rows.length
        resolve(rows.slice(offset, offset + limit))
      }
      request.onerror = () => reject(request.error)
    })
  }

  /** Upserts bank transactions (dedup on composite ID). Returns inserted count. */
  async saveBankTransactions(rows: BankTransactionInput[]): Promise<number> {
    const db = await this.ensureDB()
    const now = Math.floor(Date.now() / 1000)
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BANK_TRANSACTIONS, 'readwrite')
      const store = tx.objectStore(STORES.BANK_TRANSACTIONS)
      let count = 0
      for (const row of rows) {
        const record: BankTransaction = {
          id: row.external_id
            ? `${row.bank_account_id}_${row.external_id}`
            : generateId(),
          bank_account_id: row.bank_account_id,
          external_id: row.external_id ?? null,
          posted_date: row.posted_date,
          transaction_date: row.transaction_date ?? null,
          amount: row.amount,
          currency: row.currency,
          payee: row.payee ?? null,
          memo: row.memo ?? null,
          reference_number: row.reference_number ?? null,
          tx_type: row.tx_type ?? null,
          running_balance: row.running_balance ?? null,
          classification_status: row.classification_status ?? 'unclassified',
          classification_note: row.classification_note ?? null,
          raw_data: row.raw_data ?? null,
          import_batch_id: row.import_batch_id ?? null,
          created_at: now,
          updated_at: now,
        }
        const req = store.put(record)
        req.onsuccess = () => {
          count++
        }
      }
      tx.oncomplete = () => resolve(count)
      tx.onerror = () => reject(tx.error)
    })
  }

  // ============================================================================
  // Import Batch Operations (GIV-825)
  // ============================================================================

  /** Returns import batches, optionally filtered by bank account. */
  async getImportBatches(bankAccountId?: string): Promise<ImportBatch[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.IMPORT_BATCHES, 'readonly')
      const store = tx.objectStore(STORES.IMPORT_BATCHES)
      if (bankAccountId) {
        const index = store.index('bank_account_id')
        const request = index.getAll(bankAccountId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      } else {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }
    })
  }

  /** Creates a new import batch record and returns it. */
  async saveImportBatch(input: ImportBatchInput): Promise<ImportBatch> {
    const db = await this.ensureDB()
    const now = Math.floor(Date.now() / 1000)
    const batch: ImportBatch = {
      id: generateId(),
      bank_account_id: input.bank_account_id,
      filename: input.filename ?? null,
      format: input.format ?? null,
      imported_at: now,
      row_count: input.row_count ?? null,
      duplicate_count: input.duplicate_count ?? null,
      status: input.status ?? 'staged',
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.IMPORT_BATCHES, 'readwrite')
      const store = tx.objectStore(STORES.IMPORT_BATCHES)
      const request = store.put(batch)
      request.onsuccess = () => resolve(batch)
      request.onerror = () => reject(request.error)
    })
  }

  // ============================================================================
  // Statement Profile Operations (GIV-825)
  // ============================================================================

  /** Returns all saved statement profiles. */
  async getStatementProfiles(): Promise<StatementProfile[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATEMENT_PROFILES, 'readonly')
      const store = tx.objectStore(STORES.STATEMENT_PROFILES)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /** Creates a new statement profile and returns it. */
  async saveStatementProfile(
    input: StatementProfileInput
  ): Promise<StatementProfile> {
    const db = await this.ensureDB()
    const now = Math.floor(Date.now() / 1000)
    const profile: StatementProfile = {
      id: generateId(),
      name: input.name,
      institution_name: input.institution_name ?? null,
      column_map: input.column_map ?? null,
      date_format: input.date_format ?? null,
      amount_sign_convention: input.amount_sign_convention ?? null,
      currency_default: input.currency_default ?? null,
      created_at: now,
      updated_at: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATEMENT_PROFILES, 'readwrite')
      const store = tx.objectStore(STORES.STATEMENT_PROFILES)
      const request = store.put(profile)
      request.onsuccess = () => resolve(profile)
      request.onerror = () => reject(request.error)
    })
  }

  // ============================================================================
  // Chain Transaction Operations (delegates to indexedDBService)
  // ============================================================================

  /** Initialises the IndexedDB transaction store. */
  // skipcq: JS-0105 — delegates to indexedDBService
  async initTransactionStore(): Promise<void> {
    await indexedDBService.init()
  }

  /** Persists chain transactions for a given network and address. */
  // skipcq: JS-0105 — delegates to indexedDBService
  async saveChainTransactions(
    network: string,
    address: string,
    transactions: Transaction[]
  ): Promise<void> {
    await indexedDBService.saveTransactions(network, address, transactions)
  }

  /** Loads chain transactions for an address. */
  // skipcq: JS-0105, JS-D1001 — delegates to indexedDBService
  getChainTransactions(
    network: string,
    address: string
  ): Promise<Transaction[]> {
    return indexedDBService.getTransactionsFor(network, address)
  }

  /** Loads the sync status for a chain/address pair. */
  // skipcq: JS-0105, JS-D1001 — delegates to indexedDBService
  loadChainSyncStatus(
    network: string,
    address: string
  ): Promise<ChainSyncStatus | null> {
    return indexedDBService.loadSyncStatus(network, address)
  }

  /** Persists the sync status for a chain/address pair. */
  // skipcq: JS-0105 — delegates to indexedDBService
  async saveChainSyncStatus(status: ChainSyncStatus): Promise<void> {
    await indexedDBService.saveSyncStatus(status)
  }

  /** Removes all stored chain transactions from IndexedDB. */
  // skipcq: JS-0105 — delegates to indexedDBService
  async clearChainTransactions(): Promise<void> {
    await indexedDBService.clearTransactions()
  }

  // ============================================================================
  // Connected Wallet Operations (delegates to indexedDBService)
  // ============================================================================

  /** Persists the list of connected wallets. */
  // skipcq: JS-0105 — delegates to indexedDBService
  async saveConnectedWallets(wallets: ConnectedWallet[]): Promise<void> {
    await indexedDBService.saveWallets(wallets)
  }

  /** Loads all connected wallets. */
  // skipcq: JS-0105, JS-D1001 — delegates to indexedDBService
  loadConnectedWallets(): Promise<ConnectedWallet[]> {
    return indexedDBService.loadWallets()
  }
}

export const indexedDBPersistence = new IndexedDBPersistenceService()
