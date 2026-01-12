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
import { isTauriAvailable, warnIfNotTauri } from '../../utils/tauri'

// Re-export types
export type {
  PersistenceService,
  Profile,
  Wallet,
  WalletInput,
  StoredTransaction,
  TransactionInput,
  PaginationOptions,
  // Entity types
  Entity,
  EntityInput,
  EntityUpdate,
  EntityType,
  EntityAddress,
  EntityAddressInput,
  EntityFilter,
  KnownAddress,
  AddressMatch,
  PostalAddress,
  TaxDocumentationStatus,
} from './types'

/**
 * Get the appropriate persistence service based on environment
 */
const getPersistenceService = (): PersistenceService => {
  if (isTauriAvailable()) {
    return tauriPersistence
  }

  warnIfNotTauri('PersistenceService')
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
