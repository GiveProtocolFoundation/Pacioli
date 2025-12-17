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
} from './types'

const DB_NAME = 'PacioliPersistenceDB'
const DB_VERSION = 2 // Bumped for entity support

const STORES = {
  PROFILES: 'profiles',
  WALLETS: 'wallets',
  PROFILE_TRANSACTIONS: 'profile_transactions',
  SETTINGS: 'settings',
  ENTITIES: 'entities',
  ENTITY_ADDRESSES: 'entity_addresses',
  KNOWN_ADDRESSES: 'known_addresses',
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

        // Entities store
        if (!db.objectStoreNames.contains(STORES.ENTITIES)) {
          const entityStore = db.createObjectStore(STORES.ENTITIES, { keyPath: 'id' })
          entityStore.createIndex('profile_id', 'profile_id', { unique: false })
          entityStore.createIndex('entity_type', 'entity_type', { unique: false })
          entityStore.createIndex('name', 'name', { unique: false })
          entityStore.createIndex('profile_name_type', ['profile_id', 'name', 'entity_type'], {
            unique: true,
          })
        }

        // Entity addresses store
        if (!db.objectStoreNames.contains(STORES.ENTITY_ADDRESSES)) {
          const addrStore = db.createObjectStore(STORES.ENTITY_ADDRESSES, { keyPath: 'id' })
          addrStore.createIndex('entity_id', 'entity_id', { unique: false })
          addrStore.createIndex('address', 'address', { unique: false })
          addrStore.createIndex('address_chain', ['address', 'chain'], { unique: false })
          addrStore.createIndex('entity_address_chain', ['entity_id', 'address', 'chain'], {
            unique: true,
          })
        }

        // Known addresses store
        if (!db.objectStoreNames.contains(STORES.KNOWN_ADDRESSES)) {
          const knownStore = db.createObjectStore(STORES.KNOWN_ADDRESSES, {
            keyPath: ['address', 'chain'],
          })
          knownStore.createIndex('entity_name', 'entity_name', { unique: false })
          knownStore.createIndex('entity_type', 'entity_type', { unique: false })
          knownStore.createIndex('chain', 'chain', { unique: false })
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
      tax_documentation_status: (entity.tax_documentation_status ?? 'none') as TaxDocumentationStatus,
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

  async getEntities(profileId: string, filter?: EntityFilter): Promise<Entity[]> {
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
          entities = entities.filter((e) => e.entity_type === filter.entity_type)
        }
        if (filter?.is_active !== undefined) {
          entities = entities.filter((e) => e.is_active === filter.is_active)
        }

        // Sort by name
        entities.sort((a, b) => a.name.localeCompare(b.name))
        resolve(entities)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getEntityById(id: string): Promise<Entity | null> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITIES, 'readonly')
      const store = tx.objectStore(STORES.ENTITIES)
      const request = store.get(id)
      request.onsuccess = () => resolve((request.result as Entity) || null)
      request.onerror = () => reject(request.error)
    })
  }

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
        if (update.entity_type !== undefined) entity.entity_type = update.entity_type
        if (update.name !== undefined) entity.name = update.name
        if (update.display_name !== undefined) entity.display_name = update.display_name
        if (update.email !== undefined) entity.email = update.email
        if (update.phone !== undefined) entity.phone = update.phone
        if (update.website !== undefined) entity.website = update.website
        if (update.address !== undefined) entity.address = update.address
        if (update.country_code !== undefined) entity.country_code = update.country_code
        if (update.tax_identifier !== undefined) entity.tax_identifier = update.tax_identifier
        if (update.tax_identifier_type !== undefined)
          entity.tax_identifier_type = update.tax_identifier_type
        if (update.default_wallet_address !== undefined)
          entity.default_wallet_address = update.default_wallet_address
        if (update.category !== undefined) entity.category = update.category
        if (update.tags !== undefined) entity.tags = update.tags
        if (update.default_payment_terms !== undefined)
          entity.default_payment_terms = update.default_payment_terms
        if (update.default_currency !== undefined) entity.default_currency = update.default_currency
        if (update.reportable_payee !== undefined) entity.reportable_payee = update.reportable_payee
        if (update.tax_documentation_status !== undefined)
          entity.tax_documentation_status = update.tax_documentation_status
        if (update.tax_documentation_date !== undefined)
          entity.tax_documentation_date = update.tax_documentation_date
        if (update.tax_compliance !== undefined) entity.tax_compliance = update.tax_compliance
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

  async searchEntities(profileId: string, query: string, limit?: number): Promise<Entity[]> {
    const entities = await this.getEntities(profileId, { is_active: true })
    const searchLower = query.toLowerCase()
    const maxResults = limit ?? 20

    const filtered = entities.filter(
      (e) =>
        e.name.toLowerCase().includes(searchLower) ||
        e.display_name?.toLowerCase().includes(searchLower) ||
        e.email?.toLowerCase().includes(searchLower) ||
        e.category?.toLowerCase().includes(searchLower) ||
        e.tax_identifier?.toLowerCase().includes(searchLower)
    )

    return filtered.slice(0, maxResults)
  }

  async findEntityByAddress(
    profileId: string,
    address: string,
    chain?: string
  ): Promise<Entity | null> {
    const db = await this.ensureDB()

    // Get all entity addresses matching the address (and optionally chain)
    const entityAddresses = await new Promise<EntityAddress[]>((resolve, reject) => {
      const tx = db.transaction(STORES.ENTITY_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.ENTITY_ADDRESSES)
      const index = store.index('address')
      const request = index.getAll(address)

      request.onsuccess = () => {
        let results = request.result as EntityAddress[]
        if (chain) {
          results = results.filter((ea) => ea.chain === chain)
        }
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })

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

  async addEntityAddress(addressInput: EntityAddressInput): Promise<EntityAddress> {
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
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        resolve(addresses)
      }
      request.onerror = () => reject(request.error)
    })
  }

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

  async getKnownAddresses(chain?: string, entityType?: string): Promise<KnownAddress[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.KNOWN_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.KNOWN_ADDRESSES)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result as KnownAddress[]
        results = results.filter((k) => k.is_active)

        if (chain) {
          results = results.filter((k) => k.chain === chain)
        }
        if (entityType) {
          results = results.filter((k) => k.entity_type === entityType)
        }

        results.sort((a, b) => a.entity_name.localeCompare(b.entity_name))
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async createEntityFromKnown(profileId: string, address: string, chain: string): Promise<Entity> {
    const db = await this.ensureDB()

    // Get known address
    const known = await new Promise<KnownAddress | null>((resolve, reject) => {
      const tx = db.transaction(STORES.KNOWN_ADDRESSES, 'readonly')
      const store = tx.objectStore(STORES.KNOWN_ADDRESSES)
      const request = store.get([address, chain])
      request.onsuccess = () => resolve((request.result as KnownAddress) || null)
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
}

export const indexedDBPersistence = new IndexedDBPersistenceService()
