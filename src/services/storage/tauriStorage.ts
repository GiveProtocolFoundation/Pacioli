/**
 * Tauri Storage Service
 * Implements StorageService using Tauri commands for the offline-first storage layer
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  StorageService,
  AppState,
  StorageProfile,
  StorageProfileInput,
  StorageWallet,
  StorageWalletInput,
  StorageSetting,
  ImportResult,
  ImportPreview,
  ExportStats,
} from '../../types/storage'

/**
 * Tauri storage implementation
 */
export const tauriStorage: StorageService = {
  // Initialization
  ensureInitialized: (): Promise<string> => {
    return invoke<string>('storage_ensure_initialized')
  },

  getAppState: (): Promise<AppState> => {
    return invoke<AppState>('storage_get_app_state')
  },

  resetApp: (): Promise<void> => {
    return invoke('storage_reset_app')
  },

  // Profiles
  createProfile: (input: StorageProfileInput): Promise<StorageProfile> => {
    return invoke<StorageProfile>('storage_create_profile', { input })
  },

  getProfile: (id: string): Promise<StorageProfile | null> => {
    return invoke<StorageProfile | null>('storage_get_profile', { id })
  },

  getAllProfiles: (): Promise<StorageProfile[]> => {
    return invoke<StorageProfile[]>('storage_get_all_profiles')
  },

  updateProfile: (
    id: string,
    input: StorageProfileInput
  ): Promise<StorageProfile> => {
    return invoke<StorageProfile>('storage_update_profile', { id, input })
  },

  deleteProfile: (id: string): Promise<void> => {
    return invoke('storage_delete_profile', { id })
  },

  getDefaultProfile: (): Promise<StorageProfile | null> => {
    return invoke<StorageProfile | null>('storage_get_default_profile')
  },

  setDefaultProfile: (id: string): Promise<void> => {
    return invoke('storage_set_default_profile', { id })
  },

  // Wallets
  createWallet: (input: StorageWalletInput): Promise<StorageWallet> => {
    return invoke<StorageWallet>('storage_create_wallet', { input })
  },

  getWallet: (id: string): Promise<StorageWallet | null> => {
    return invoke<StorageWallet | null>('storage_get_wallet', { id })
  },

  getWalletsByProfile: (profileId: string): Promise<StorageWallet[]> => {
    return invoke<StorageWallet[]>('storage_get_wallets_by_profile', {
      profileId,
    })
  },

  updateWallet: (
    id: string,
    input: StorageWalletInput
  ): Promise<StorageWallet> => {
    return invoke<StorageWallet>('storage_update_wallet', { id, input })
  },

  deleteWallet: (id: string): Promise<void> => {
    return invoke('storage_delete_wallet', { id })
  },

  // Settings
  getSetting: (key: string): Promise<string | null> => {
    return invoke<string | null>('storage_get_setting', { key })
  },

  setSetting: (key: string, value: string): Promise<void> => {
    return invoke('storage_set_setting', { key, value })
  },

  deleteSetting: (key: string): Promise<void> => {
    return invoke('storage_delete_setting', { key })
  },

  getAllSettings: (): Promise<StorageSetting[]> => {
    return invoke<StorageSetting[]>('storage_get_all_settings')
  },

  // Security
  setPassword: (password: string): Promise<string> => {
    return invoke<string>('storage_set_password', { password })
  },

  changePassword: (
    currentPassword: string,
    newPassword: string
  ): Promise<void> => {
    return invoke('storage_change_password', { currentPassword, newPassword })
  },

  removePassword: (currentPassword: string): Promise<void> => {
    return invoke('storage_remove_password', { currentPassword })
  },

  hasPassword: (): Promise<boolean> => {
    return invoke<boolean>('storage_has_password')
  },

  unlock: (password: string): Promise<boolean> => {
    return invoke<boolean>('storage_unlock', { password })
  },

  lock: (): Promise<void> => {
    return invoke('storage_lock')
  },

  validatePasswordStrength: (password: string): Promise<void> => {
    return invoke('storage_validate_password_strength', { password })
  },

  hasRecoveryPhrase: (): Promise<boolean> => {
    return invoke<boolean>('storage_has_recovery_phrase')
  },

  verifyRecoveryPhrase: (phrase: string): Promise<boolean> => {
    return invoke<boolean>('storage_verify_recovery_phrase', { phrase })
  },

  resetPasswordWithRecovery: (
    recoveryPhrase: string,
    newPassword: string
  ): Promise<void> => {
    return invoke('storage_reset_password_with_recovery', {
      recoveryPhrase,
      newPassword,
    })
  },

  // Export/Import
  exportData: (path: string, password?: string): Promise<void> => {
    return invoke('storage_export_data', { path, password: password ?? null })
  },

  getExportStats: async (): Promise<ExportStats> => {
    const [profileCount, walletCount, settingsCount] = await invoke<
      [number, number, number]
    >('storage_get_export_stats')
    return { profileCount, walletCount, settingsCount }
  },

  previewImport: (path: string): Promise<ImportPreview> => {
    return invoke<ImportPreview>('storage_preview_import', { path })
  },

  importData: (path: string, password?: string): Promise<ImportResult> => {
    return invoke<ImportResult>('storage_import_data', {
      path,
      password: password ?? null,
    })
  },
}
