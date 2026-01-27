/**
 * Storage Types
 * Types for the offline-first storage layer
 */

/**
 * Application initialization state
 */
export type AppState = 'Uninitialized' | 'Locked' | 'Unlocked'

/**
 * Profile data structure
 */
export interface StorageProfile {
  id: string
  name: string
  avatar_url: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

/**
 * Input for creating or updating a profile
 */
export interface StorageProfileInput {
  name: string
  avatar_url?: string | null
  is_default?: boolean
}

/**
 * Wallet data structure
 */
export interface StorageWallet {
  id: string
  profile_id: string
  address: string
  chain: string
  nickname: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Input for creating or updating a wallet
 */
export interface StorageWalletInput {
  profile_id: string
  address: string
  chain: string
  nickname?: string | null
}

/**
 * Application setting
 */
export interface StorageSetting {
  key: string
  value: string
  updated_at: string
}

/**
 * Result of an import operation
 */
export interface ImportResult {
  profiles_imported: number
  wallets_imported: number
  transactions_imported: number
  warnings: string[]
}

/**
 * Preview of data to be imported
 */
export interface ImportPreview {
  version: string
  exported_at: string
  encrypted: boolean
  profile_count: number
  wallet_count: number
  transaction_count: number
}

/**
 * Export statistics
 */
export interface ExportStats {
  profileCount: number
  walletCount: number
  settingsCount: number
}

/**
 * Storage service interface
 */
export interface StorageService {
  // Initialization
  ensureInitialized(): Promise<string>
  getAppState(): Promise<AppState>
  resetApp(): Promise<void>

  // Profiles
  createProfile(input: StorageProfileInput): Promise<StorageProfile>
  getProfile(id: string): Promise<StorageProfile | null>
  getAllProfiles(): Promise<StorageProfile[]>
  updateProfile(id: string, input: StorageProfileInput): Promise<StorageProfile>
  deleteProfile(id: string): Promise<void>
  getDefaultProfile(): Promise<StorageProfile | null>
  setDefaultProfile(id: string): Promise<void>

  // Wallets
  createWallet(input: StorageWalletInput): Promise<StorageWallet>
  getWallet(id: string): Promise<StorageWallet | null>
  getWalletsByProfile(profileId: string): Promise<StorageWallet[]>
  updateWallet(id: string, input: StorageWalletInput): Promise<StorageWallet>
  deleteWallet(id: string): Promise<void>

  // Settings
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  deleteSetting(key: string): Promise<void>
  getAllSettings(): Promise<StorageSetting[]>

  // Security
  setPassword(password: string): Promise<string> // Returns recovery phrase
  changePassword(currentPassword: string, newPassword: string): Promise<void>
  removePassword(currentPassword: string): Promise<void>
  hasPassword(): Promise<boolean>
  unlock(password: string): Promise<boolean>
  lock(): Promise<void>
  validatePasswordStrength(password: string): Promise<void>

  // Recovery
  hasRecoveryPhrase(): Promise<boolean>
  verifyRecoveryPhrase(phrase: string): Promise<boolean>
  resetPasswordWithRecovery(
    recoveryPhrase: string,
    newPassword: string
  ): Promise<void>

  // Export/Import
  exportData(path: string, password?: string): Promise<void>
  getExportStats(): Promise<ExportStats>
  previewImport(path: string): Promise<ImportPreview>
  importData(path: string, password?: string): Promise<ImportResult>
}
