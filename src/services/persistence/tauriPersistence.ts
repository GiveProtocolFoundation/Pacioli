/**
 * Tauri Persistence Service
 * Implements PersistenceService using Tauri commands to communicate with SQLite backend
 */

import { invoke } from '@tauri-apps/api/core'
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

/**
 * Feature flag: when true, chain transaction operations route to SQLite
 * via Tauri invoke. When false (default), they fall back to IndexedDB
 * (preserving pre-convergence behavior for safe rollback).
 */
const USE_PERSISTENCE_TX_PATH =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('USE_PERSISTENCE_TX_PATH') === 'true'

/**
 * Tauri persistence implementation using plain object
 * Methods don't require instance state, so object literal is more appropriate than class
 */
export const tauriPersistence: PersistenceService = {
  // Profile Operations
  createProfile: (name: string): Promise<Profile> => {
    return invoke<Profile>('create_profile', { name })
  },

  getProfiles: (): Promise<Profile[]> => {
    return invoke<Profile[]>('get_profiles')
  },

  updateProfile: (id: string, name: string): Promise<Profile> => {
    return invoke<Profile>('update_profile', { id, name })
  },

  deleteProfile: (id: string): Promise<void> => {
    return invoke('delete_profile', { id })
  },

  // Wallet Operations
  saveWallet: (wallet: WalletInput): Promise<Wallet> => {
    return invoke<Wallet>('save_wallet', { wallet })
  },

  getWallets: (profileId: string): Promise<Wallet[]> => {
    return invoke<Wallet[]>('get_wallets', { profileId })
  },

  getWalletById: (id: string): Promise<Wallet | null> => {
    return invoke<Wallet | null>('get_wallet_by_id', { id })
  },

  deleteWallet: (id: string): Promise<void> => {
    return invoke('delete_wallet', { id })
  },

  // Transaction Operations
  saveTransactions: (
    walletId: string,
    transactions: TransactionInput[]
  ): Promise<number> => {
    return invoke<number>('save_transactions', { walletId, transactions })
  },

  getTransactions: (
    walletId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]> => {
    return invoke<StoredTransaction[]>('get_transactions', {
      walletId,
      limit: options?.limit ?? null,
      offset: options?.offset ?? null,
    })
  },

  getAllTransactions: (
    profileId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]> => {
    return invoke<StoredTransaction[]>('get_all_transactions', {
      profileId,
      limit: options?.limit ?? null,
      offset: options?.offset ?? null,
    })
  },

  deleteTransactions: (walletId: string): Promise<number> => {
    return invoke<number>('delete_transactions', { walletId })
  },

  // Settings Operations
  getSetting: (key: string): Promise<string | null> => {
    return invoke<string | null>('get_setting', { key })
  },

  setSetting: (key: string, value: string): Promise<void> => {
    return invoke('set_setting', { key, value })
  },

  deleteSetting: (key: string): Promise<void> => {
    return invoke('delete_setting', { key })
  },

  getAllSettings: (): Promise<Array<[string, string]>> => {
    return invoke<Array<[string, string]>>('get_all_settings')
  },

  // Entity operations
  createEntity: (entity: EntityInput): Promise<Entity> => {
    return invoke<Entity>('create_entity', { entity })
  },

  getEntities: (
    profileId: string,
    filter?: EntityFilter
  ): Promise<Entity[]> => {
    return invoke<Entity[]>('get_entities', {
      profileId,
      entityType: filter?.entity_type ?? null,
      isActive: filter?.is_active ?? null,
    })
  },

  getEntityById: (id: string): Promise<Entity | null> => {
    return invoke<Entity | null>('get_entity_by_id', { id })
  },

  updateEntity: (id: string, update: EntityUpdate): Promise<Entity> => {
    return invoke<Entity>('update_entity', { id, update })
  },

  deleteEntity: (id: string): Promise<void> => {
    return invoke('delete_entity', { id })
  },

  searchEntities: (
    profileId: string,
    query: string,
    limit?: number
  ): Promise<Entity[]> => {
    return invoke<Entity[]>('search_entities', {
      profileId,
      query,
      limit: limit ?? null,
    })
  },

  findEntityByAddress: (
    profileId: string,
    address: string,
    chain?: string
  ): Promise<Entity | null> => {
    return invoke<Entity | null>('find_entity_by_address', {
      profileId,
      address,
      chain: chain ?? null,
    })
  },

  // Entity address operations
  addEntityAddress: (
    addressInput: EntityAddressInput
  ): Promise<EntityAddress> => {
    return invoke<EntityAddress>('add_entity_address', { addressInput })
  },

  getEntityAddresses: (entityId: string): Promise<EntityAddress[]> => {
    return invoke<EntityAddress[]>('get_entity_addresses', { entityId })
  },

  deleteEntityAddress: (id: string): Promise<void> => {
    return invoke('delete_entity_address', { id })
  },

  // Address detection operations
  lookupAddress: (
    profileId: string,
    address: string,
    chain: string
  ): Promise<AddressMatch | null> => {
    return invoke<AddressMatch | null>('lookup_address', {
      profileId,
      address,
      chain,
    })
  },

  batchLookupAddresses: (
    profileId: string,
    addresses: Array<[string, string]>
  ): Promise<AddressMatch[]> => {
    return invoke<AddressMatch[]>('batch_lookup_addresses', {
      profileId,
      addresses,
    })
  },

  getKnownAddresses: (
    chain?: string,
    entityType?: string
  ): Promise<KnownAddress[]> => {
    return invoke<KnownAddress[]>('get_known_addresses', {
      chain: chain ?? null,
      entityType: entityType ?? null,
    })
  },

  createEntityFromKnown: (
    profileId: string,
    address: string,
    chain: string
  ): Promise<Entity> => {
    return invoke<Entity>('create_entity_from_known', {
      profileId,
      address,
      chain,
    })
  },

  // Bank Account Operations (GIV-825)
  getBankAccounts: (): Promise<BankAccount[]> => {
    return invoke<BankAccount[]>('get_bank_accounts')
  },

  saveBankAccount: (account: BankAccountInput): Promise<BankAccount> => {
    return invoke<BankAccount>('save_bank_account', { account })
  },

  archiveBankAccount: (id: string): Promise<void> => {
    return invoke<void>('archive_bank_account', { id })
  },

  // Bank Transaction Operations (GIV-825)
  getBankTransactions: (
    bankAccountId: string,
    filter?: BankTransactionFilter
  ): Promise<BankTransaction[]> => {
    return invoke<BankTransaction[]>('get_bank_transactions', {
      bankAccountId,
      fromDate: filter?.from_date ?? null,
      toDate: filter?.to_date ?? null,
      classificationStatus: filter?.classification_status ?? null,
      importBatchId: filter?.import_batch_id ?? null,
      limit: filter?.limit ?? null,
      offset: filter?.offset ?? null,
    })
  },

  saveBankTransactions: (rows: BankTransactionInput[]): Promise<number> => {
    return invoke<number>('save_bank_transactions', { rows })
  },

  // Import Batch Operations (GIV-825)
  getImportBatches: (bankAccountId?: string): Promise<ImportBatch[]> => {
    return invoke<ImportBatch[]>('get_import_batches', {
      bankAccountId: bankAccountId ?? null,
    })
  },

  saveImportBatch: (batch: ImportBatchInput): Promise<ImportBatch> => {
    return invoke<ImportBatch>('save_import_batch', { batch })
  },

  // Statement Profile Operations (GIV-825)
  getStatementProfiles: (): Promise<StatementProfile[]> => {
    return invoke<StatementProfile[]>('get_statement_profiles')
  },

  saveStatementProfile: (
    profile: StatementProfileInput
  ): Promise<StatementProfile> => {
    return invoke<StatementProfile>('save_statement_profile', { profile })
  },

  // Chain Transaction Operations
  initTransactionStore: async (): Promise<void> => {
    if (!USE_PERSISTENCE_TX_PATH) {
      await indexedDBService.init()
    }
    // SQLite auto-initializes via Tauri; no-op when flag is on
  },

  saveChainTransactions: async (
    network: string,
    address: string,
    transactions: Transaction[]
  ): Promise<void> => {
    if (USE_PERSISTENCE_TX_PATH) {
      // Serialize each transaction to JSON for SQLite raw_json_data storage.
      // Column names match the Phase 4a descriptive naming convention.
      const serialized = transactions.map(tx => ({
        id: tx.id,
        transaction_hash: tx.hash,
        block_number: tx.blockNumber,
        timestamp:
          tx.timestamp instanceof Date
            ? Math.floor(tx.timestamp.getTime() / 1000)
            : 0,
        from_address: tx.from,
        to_address: tx.to,
        transfer_value: tx.value,
        transaction_fee: tx.fee,
        status: tx.status,
        transaction_type: tx.type,
        raw_json_data: JSON.stringify(tx),
        price_at_acquisition_usd:
          tx.pricePerUnitUsd != null ? tx.pricePerUnitUsd.toString() : null,
      }))
      await invoke('save_chain_transactions', {
        network,
        address,
        transactions: serialized,
      })
      return
    }
    await indexedDBService.saveTransactions(network, address, transactions)
  },

  getChainTransactions: async (
    network: string,
    address: string
  ): Promise<Transaction[]> => {
    if (USE_PERSISTENCE_TX_PATH) {
      const rows = await invoke<Array<{ raw_json_data: string }>>(
        'get_chain_transactions',
        {
          network,
          address,
        }
      )
      return rows.map(row => {
        const tx = JSON.parse(row.raw_json_data) as Transaction
        // Restore Date object from serialized string
        if (typeof tx.timestamp === 'string') {
          tx.timestamp = new Date(tx.timestamp)
        }
        return tx
      })
    }
    return indexedDBService.getTransactionsFor(network, address)
  },

  loadChainSyncStatus: async (
    network: string,
    address: string
  ): Promise<ChainSyncStatus | null> => {
    if (USE_PERSISTENCE_TX_PATH) {
      const result = await invoke<{
        chain_id: string
        address: string
        last_block_synced: number
        last_sync_timestamp: number | null
        sync_state: string | null
      } | null>('load_chain_sync_status', { network, address })
      if (!result) return null
      return {
        network: result.chain_id,
        address: result.address,
        lastSyncedBlock: result.last_block_synced,
        lastSyncTime: result.last_sync_timestamp
          ? new Date(result.last_sync_timestamp * 1000)
          : new Date(),
        isSyncing: result.sync_state === 'syncing',
      }
    }
    return indexedDBService.loadSyncStatus(network, address)
  },

  saveChainSyncStatus: async (status: ChainSyncStatus): Promise<void> => {
    if (USE_PERSISTENCE_TX_PATH) {
      await invoke('save_chain_sync_status', {
        network: status.network,
        address: status.address,
        lastBlock: status.lastSyncedBlock,
      })
      return
    }
    await indexedDBService.saveSyncStatus(status)
  },

  clearChainTransactions: async (): Promise<void> => {
    if (USE_PERSISTENCE_TX_PATH) {
      await invoke('clear_chain_transactions')
      return
    }
    await indexedDBService.clearTransactions()
  },

  // Connected Wallet Operations
  saveConnectedWallets: async (wallets: ConnectedWallet[]): Promise<void> => {
    if (USE_PERSISTENCE_TX_PATH) {
      // Store as JSON in SQLite settings table
      await invoke('set_setting', {
        key: 'connected_wallets',
        value: JSON.stringify(wallets),
      })
      return
    }
    await indexedDBService.saveWallets(wallets)
  },

  loadConnectedWallets: async (): Promise<ConnectedWallet[]> => {
    if (USE_PERSISTENCE_TX_PATH) {
      const json = await invoke<string | null>('get_setting', {
        key: 'connected_wallets',
      })
      if (!json) return []
      try {
        return JSON.parse(json) as ConnectedWallet[]
      } catch {
        return []
      }
    }
    return indexedDBService.loadWallets()
  },
}
