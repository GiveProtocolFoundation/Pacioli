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
  Entity,
  EntityInput,
  EntityUpdate,
  EntityFilter,
  EntityAddress,
  EntityAddressInput,
  AddressMatch,
  KnownAddress,
} from './types'

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

  getEntities: (profileId: string, filter?: EntityFilter): Promise<Entity[]> => {
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

  searchEntities: (profileId: string, query: string, limit?: number): Promise<Entity[]> => {
    return invoke<Entity[]>('search_entities', { profileId, query, limit: limit ?? null })
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
  addEntityAddress: (addressInput: EntityAddressInput): Promise<EntityAddress> => {
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
    return invoke<AddressMatch | null>('lookup_address', { profileId, address, chain })
  },

  batchLookupAddresses: (
    profileId: string,
    addresses: Array<[string, string]>
  ): Promise<AddressMatch[]> => {
    return invoke<AddressMatch[]>('batch_lookup_addresses', { profileId, addresses })
  },

  getKnownAddresses: (chain?: string, entityType?: string): Promise<KnownAddress[]> => {
    return invoke<KnownAddress[]>('get_known_addresses', {
      chain: chain ?? null,
      entityType: entityType ?? null,
    })
  },

  createEntityFromKnown: (profileId: string, address: string, chain: string): Promise<Entity> => {
    return invoke<Entity>('create_entity_from_known', { profileId, address, chain })
  },
}
