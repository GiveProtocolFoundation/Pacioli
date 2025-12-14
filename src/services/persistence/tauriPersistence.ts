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
  saveTransactions: (walletId: string, transactions: TransactionInput[]): Promise<number> => {
    return invoke<number>('save_transactions', { walletId, transactions })
  },

  getTransactions: (walletId: string, options?: PaginationOptions): Promise<StoredTransaction[]> => {
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
}
