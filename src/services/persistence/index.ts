/**
 * Persistence Service
 * Provides data persistence abstraction with automatic Tauri/browser detection
 *
 * Usage:
 *   import { persistence } from '@/services/persistence'
 *   const profiles = await persistence.getProfiles()
 */

import type { PersistenceService } from './types'
import { tauriPersistence } from './tauriPersistence'
import { indexedDBPersistence } from './indexedDBPersistence'

// Re-export types
export type {
  PersistenceService,
  Profile,
  Wallet,
  WalletInput,
  StoredTransaction,
  TransactionInput,
  PaginationOptions,
} from './types'

/**
 * Check if running in Tauri environment
 */
const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Get the appropriate persistence service based on environment
 */
const getPersistenceService = (): PersistenceService => {
  if (isTauri()) {
    console.log('[Persistence] Using Tauri SQLite backend')
    return tauriPersistence
  }

  console.log('[Persistence] Using IndexedDB fallback (browser mode)')
  return indexedDBPersistence
}

/**
 * Singleton persistence service instance
 */
export const persistence = getPersistenceService()

/**
 * Force use of a specific persistence implementation
 * Useful for testing or specific use cases
 */
export { tauriPersistence, indexedDBPersistence }
