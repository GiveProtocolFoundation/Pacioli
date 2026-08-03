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
 * In-memory fallback for non-Tauri environments (browser development).
 * Settings are backed by localStorage so they survive page reloads.
 */
const SETTINGS_LS_PREFIX = 'pacioli_setting_'

/**
 * Creates an in-memory fallback StorageService for non-Tauri environments (browser development).
 * @returns {StorageService} The memory-based storage service.
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

  // Hydrate settings from localStorage so they persist across page reloads
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const lsKey = localStorage.key(i)
      if (lsKey?.startsWith(SETTINGS_LS_PREFIX)) {
        const value = localStorage.getItem(lsKey)
        if (value !== null) {
          settings.set(lsKey.slice(SETTINGS_LS_PREFIX.length), value)
        }
      }
    }
  } catch {
    // localStorage unavailable (e.g. SSR) — proceed with empty map
  }

  return {
    ensureInitialized: () => {
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
        return Promise.resolve(`initialized:${id}`)
      }
      return Promise.resolve('already_initialized')
    },

    getAppState: () => Promise.resolve(appState),

    resetApp: () => {
      profiles.clear()
      wallets.clear()
      settings.clear()
      appState = 'Uninitialized'
      hasPasswordSet = false
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k?.startsWith(SETTINGS_LS_PREFIX)) keysToRemove.push(k)
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
      } catch {
        /* noop */
      }
      return Promise.resolve()
    },

    createProfile: input => {
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
      return Promise.resolve(profile)
    },

    getProfile: id => Promise.resolve(profiles.get(id) ?? null),

    getAllProfiles: () => Promise.resolve(Array.from(profiles.values())),

    updateProfile: (id, input) => {
      const existing = profiles.get(id)
      if (!existing) return Promise.reject(new Error('Profile not found'))
      const updated = {
        ...existing,
        ...input,
        avatar_url: input.avatar_url ?? existing.avatar_url,
        updated_at: new Date().toISOString(),
      }
      profiles.set(id, updated)
      return Promise.resolve(updated)
    },

    deleteProfile: id => {
      profiles.delete(id)
      return Promise.resolve()
    },

    getDefaultProfile: () =>
      Promise.resolve(
        Array.from(profiles.values()).find(p => p.is_default) ?? null
      ),

    setDefaultProfile: id => {
      profiles.forEach((p, key) => {
        profiles.set(key, { ...p, is_default: key === id })
      })
      return Promise.resolve()
    },

    createWallet: input => {
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
      return Promise.resolve(wallet)
    },

    getWallet: id => Promise.resolve(wallets.get(id) ?? null),

    getWalletsByProfile: profileId =>
      Promise.resolve(
        Array.from(wallets.values()).filter(w => w.profile_id === profileId)
      ),

    updateWallet: (id, input) => {
      const existing = wallets.get(id)
      if (!existing) return Promise.reject(new Error('Wallet not found'))
      const updated = {
        ...existing,
        ...input,
        nickname: input.nickname ?? existing.nickname,
        updated_at: new Date().toISOString(),
      }
      wallets.set(id, updated)
      return Promise.resolve(updated)
    },

    deleteWallet: id => {
      wallets.delete(id)
      return Promise.resolve()
    },

    getSetting: key => Promise.resolve(settings.get(key) ?? null),

    setSetting: (key, value) => {
      settings.set(key, value)
      try {
        localStorage.setItem(SETTINGS_LS_PREFIX + key, value)
      } catch {
        /* noop */
      }
      return Promise.resolve()
    },

    deleteSetting: key => {
      settings.delete(key)
      try {
        localStorage.removeItem(SETTINGS_LS_PREFIX + key)
      } catch {
        /* noop */
      }
      return Promise.resolve()
    },

    getAllSettings: () =>
      Promise.resolve(
        Array.from(settings.entries()).map(([key, value]) => ({
          key,
          value,
          updated_at: new Date().toISOString(),
        }))
      ),

    setPassword: () => {
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
      return Promise.resolve(mockRecoveryPhrase)
    },

    changePassword: () => Promise.resolve(),

    removePassword: () => {
      hasPasswordSet = false
      mockRecoveryPhrase = ''
      return Promise.resolve()
    },

    hasPassword: () => Promise.resolve(hasPasswordSet),

    unlock: () => {
      appState = 'Unlocked'
      return Promise.resolve(true)
    },

    lock: () => {
      if (hasPasswordSet) {
        appState = 'Locked'
      }
      return Promise.resolve()
    },

    validatePasswordStrength: password => {
      if (password.length < 8) {
        return Promise.reject(
          new Error('Password must be at least 8 characters long')
        )
      }
      return Promise.resolve()
    },

    hasRecoveryPhrase: () => Promise.resolve(mockRecoveryPhrase.length > 0),

    verifyRecoveryPhrase: phrase =>
      Promise.resolve(phrase === mockRecoveryPhrase),

    resetPasswordWithRecovery: phrase => {
      if (phrase !== mockRecoveryPhrase) {
        return Promise.reject(new Error('Invalid recovery phrase'))
      }
      // Password is reset (in memory mode, just keep things unlocked)
      return Promise.resolve()
    },

    exportData: () => {
      console.warn('[MemoryStorage] Export not available in browser mode')
      return Promise.resolve()
    },

    getExportStats: () =>
      Promise.resolve({
        profileCount: profiles.size,
        walletCount: wallets.size,
        settingsCount: settings.size,
      }),

    previewImport: () =>
      Promise.reject(new Error('Import not available in browser mode')),

    importData: () =>
      Promise.reject(new Error('Import not available in browser mode')),
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
