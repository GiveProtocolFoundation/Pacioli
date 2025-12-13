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

class TauriPersistenceService implements PersistenceService {
  // ============================================================================
  // Profile Operations
  // ============================================================================

  async createProfile(name: string): Promise<Profile> {
    return invoke<Profile>('create_profile', { name })
  }

  async getProfiles(): Promise<Profile[]> {
    return invoke<Profile[]>('get_profiles')
  }

  async updateProfile(id: string, name: string): Promise<Profile> {
    return invoke<Profile>('update_profile', { id, name })
  }

  async deleteProfile(id: string): Promise<void> {
    return invoke('delete_profile', { id })
  }

  // ============================================================================
  // Wallet Operations
  // ============================================================================

  async saveWallet(wallet: WalletInput): Promise<Wallet> {
    return invoke<Wallet>('save_wallet', { wallet })
  }

  async getWallets(profileId: string): Promise<Wallet[]> {
    return invoke<Wallet[]>('get_wallets', { profileId })
  }

  async getWalletById(id: string): Promise<Wallet | null> {
    return invoke<Wallet | null>('get_wallet_by_id', { id })
  }

  async deleteWallet(id: string): Promise<void> {
    return invoke('delete_wallet', { id })
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async saveTransactions(walletId: string, transactions: TransactionInput[]): Promise<number> {
    return invoke<number>('save_transactions', { walletId, transactions })
  }

  async getTransactions(
    walletId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]> {
    return invoke<StoredTransaction[]>('get_transactions', {
      walletId,
      limit: options?.limit ?? null,
      offset: options?.offset ?? null,
    })
  }

  async getAllTransactions(
    profileId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]> {
    return invoke<StoredTransaction[]>('get_all_transactions', {
      profileId,
      limit: options?.limit ?? null,
      offset: options?.offset ?? null,
    })
  }

  async deleteTransactions(walletId: string): Promise<number> {
    return invoke<number>('delete_transactions', { walletId })
  }

  // ============================================================================
  // Settings Operations
  // ============================================================================

  async getSetting(key: string): Promise<string | null> {
    return invoke<string | null>('get_setting', { key })
  }

  async setSetting(key: string, value: string): Promise<void> {
    return invoke('set_setting', { key, value })
  }

  async deleteSetting(key: string): Promise<void> {
    return invoke('delete_setting', { key })
  }

  async getAllSettings(): Promise<Array<[string, string]>> {
    return invoke<Array<[string, string]>>('get_all_settings')
  }
}

export const tauriPersistence = new TauriPersistenceService()
