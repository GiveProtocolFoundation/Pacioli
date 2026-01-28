/**
 * Storage Service
 * Provides offline-first storage abstraction with Tauri backend
 *
 * Usage:
 *   import { storage } from '@/services/storage'
 *   const appState = await storage.getAppState()
 */

import type { StorageService } from '../../types/storage'
import { tauriStorage } from './tauriStorage'
import { isTauriAvailable } from '../../utils/tauri'

// Re-export types
export type {
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
 * In-memory fallback for non-Tauri environments (browser development)
 */
const createMemoryStorage = (): StorageService => {
  let appState: 'Uninitialized' | 'Locked' | 'Unlocked' = 'Uninitialized'
  let hasPasswordSet = false
  let mockRecoveryPhrase = ''
  const profiles: Map<string, import('../../types/storage').StorageProfile> =
    new Map()
  const wallets: Map<string, import('../../types/storage').StorageWallet> =
    new Map()
  const settings: Map<string, string> = new Map()

  return {
    ensureInitialized: async () => {
      if (appState === 'Uninitialized') {
        const id = crypto.randomUUID()
        profiles.set(id, {
          id,
          name: 'Default Profile',
          avatar_url: null,
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        appState = 'Unlocked'
        return `initialized:${id}`
      }
      return 'already_initialized'
    },

    getAppState: async () => appState,

    resetApp: async () => {
      profiles.clear()
      wallets.clear()
      settings.clear()
      appState = 'Uninitialized'
      hasPasswordSet = false
    },

    createProfile: async input => {
      const id = crypto.randomUUID()
      const profile: import('../../types/storage').StorageProfile = {
        id,
        name: input.name,
        avatar_url: input.avatar_url ?? null,
        is_default: input.is_default ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      profiles.set(id, profile)
      return profile
    },

    getProfile: async id => profiles.get(id) ?? null,

    getAllProfiles: async () => Array.from(profiles.values()),

    updateProfile: async (id, input) => {
      const existing = profiles.get(id)
      if (!existing) throw new Error('Profile not found')
      const updated = {
        ...existing,
        ...input,
        avatar_url: input.avatar_url ?? existing.avatar_url,
        updated_at: new Date().toISOString(),
      }
      profiles.set(id, updated)
      return updated
    },

    deleteProfile: async id => {
      profiles.delete(id)
    },

    getDefaultProfile: async () =>
      Array.from(profiles.values()).find(p => p.is_default) ?? null,

    setDefaultProfile: async id => {
      profiles.forEach((p, key) => {
        profiles.set(key, { ...p, is_default: key === id })
      })
    },

    createWallet: async input => {
      const id = crypto.randomUUID()
      const wallet: import('../../types/storage').StorageWallet = {
        id,
        profile_id: input.profile_id,
        address: input.address,
        chain: input.chain,
        nickname: input.nickname ?? null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      wallets.set(id, wallet)
      return wallet
    },

    getWallet: async id => wallets.get(id) ?? null,

    getWalletsByProfile: async profileId =>
      Array.from(wallets.values()).filter(w => w.profile_id === profileId),

    updateWallet: async (id, input) => {
      const existing = wallets.get(id)
      if (!existing) throw new Error('Wallet not found')
      const updated = {
        ...existing,
        ...input,
        nickname: input.nickname ?? existing.nickname,
        updated_at: new Date().toISOString(),
      }
      wallets.set(id, updated)
      return updated
    },

    deleteWallet: async id => {
      wallets.delete(id)
    },

    getSetting: async key => settings.get(key) ?? null,

    setSetting: async (key, value) => {
      settings.set(key, value)
    },

    deleteSetting: async key => {
      settings.delete(key)
    },

    getAllSettings: async () =>
      Array.from(settings.entries()).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      })),

    setPassword: async () => {
      hasPasswordSet = true
      // Generate mock recovery phrase for browser mode
      const words = [
        'abandon',
        'ability',
        'able',
        'about',
        'above',
        'absent',
        'absorb',
        'abstract',
        'absurd',
        'abuse',
        'access',
        'accident',
      ]
      mockRecoveryPhrase = words.join(' ')
      return mockRecoveryPhrase
    },

    changePassword: async () => {},

    removePassword: async () => {
      hasPasswordSet = false
      mockRecoveryPhrase = ''
    },

    hasPassword: async () => hasPasswordSet,

    unlock: async () => {
      appState = 'Unlocked'
      return true
    },

    lock: async () => {
      if (hasPasswordSet) {
        appState = 'Locked'
      }
    },

    validatePasswordStrength: async password => {
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long')
      }
    },

    hasRecoveryPhrase: async () => mockRecoveryPhrase.length > 0,

    verifyRecoveryPhrase: async phrase => phrase === mockRecoveryPhrase,

    resetPasswordWithRecovery: async phrase => {
      if (phrase !== mockRecoveryPhrase) {
        throw new Error('Invalid recovery phrase')
      }
      // Password is reset (in memory mode, just keep things unlocked)
    },

    exportData: async () => {
      console.warn('[MemoryStorage] Export not available in browser mode')
    },

    getExportStats: async () => ({
      profileCount: profiles.size,
      walletCount: wallets.size,
      settingsCount: settings.size,
    }),

    previewImport: async () => {
      throw new Error('Import not available in browser mode')
    },

    importData: async () => {
      throw new Error('Import not available in browser mode')
    },
  }
}

/**
 * Get the appropriate storage service based on environment
 */
const getStorageService = (): StorageService => {
  if (isTauriAvailable()) {
    return tauriStorage
  }

  console.warn(
    '[StorageService] Tauri not available, using in-memory storage (data will not persist)'
  )
  return createMemoryStorage()
}

/**
 * Singleton storage service instance
 */
export const storage = getStorageService()

/**
 * Force use of a specific storage implementation
 */
export { tauriStorage }
