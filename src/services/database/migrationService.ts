/**
 * Migration Service
 * Migrates data from localStorage to IndexedDB
 */

import { StorageService } from './storageService'
import { indexedDBService } from './indexedDBService'

export interface MigrationResult {
  success: boolean
  walletsMigrated: number
  transactionsMigrated: number
  syncStatusesMigrated: number
  errors: string[]
}

/**
 * Mark migration as completed (internal helper)
 */
async function setMigrationCompleted(): Promise<void> {
  await indexedDBService.setMetadata('migration_completed', true)
  await indexedDBService.setMetadata('migration_date', new Date().toISOString())
}

/**
 * Migration service for moving data from localStorage to IndexedDB.
 */
export const MigrationService = {
  /**
   * Check if migration has been completed
   */
  async hasMigrated(): Promise<boolean> {
    const migrationFlag = await indexedDBService.getMetadata<boolean>(
      'migration_completed'
    )
    return migrationFlag === true
  },

  /**
   * Migrate all data from localStorage to IndexedDB
   */
  async migrateAll(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      walletsMigrated: 0,
      transactionsMigrated: 0,
      syncStatusesMigrated: 0,
      errors: [],
    }

    try {
      // Initialize IndexedDB
      await indexedDBService.init()

      // Check if already migrated
      if (await MigrationService.hasMigrated()) {
        result.success = true
        return result
      }

      // Migrate wallets
      try {
        const wallets = StorageService.loadWallets()
        if (wallets.length > 0) {
          await indexedDBService.saveWallets(wallets)
          result.walletsMigrated = wallets.length
        }
      } catch (error) {
        const errorMsg = `Failed to migrate wallets: ${error}`
        result.errors.push(errorMsg)
        console.error('Failed to migrate wallets:', error)
      }

      // Migrate transactions
      try {
        const allTransactions = StorageService.loadTransactions()
        const transactionKeys = Object.keys(allTransactions)

        for (const key of transactionKeys) {
          const [network, address] = key.split(':')
          const transactions = allTransactions[key]

          if (transactions && transactions.length > 0) {
            await indexedDBService.saveTransactions(
              network,
              address,
              transactions
            )
            result.transactionsMigrated += transactions.length
          }
        }
      } catch (error) {
        const errorMsg = `Failed to migrate transactions: ${error}`
        result.errors.push(errorMsg)
        console.error('Failed to migrate transactions:', error)
      }

      // Migrate sync status
      try {
        const allSyncStatus = StorageService.loadAllSyncStatus()
        const statusKeys = Object.keys(allSyncStatus)

        for (const key of statusKeys) {
          const status = allSyncStatus[key]
          if (status) {
            await indexedDBService.saveSyncStatus(status)
            result.syncStatusesMigrated++
          }
        }
      } catch (error) {
        const errorMsg = `Failed to migrate sync status: ${error}`
        result.errors.push(errorMsg)
        console.error('Failed to migrate sync status:', error)
      }

      // Mark migration as complete
      await setMigrationCompleted()

      result.success = result.errors.length === 0

      return result
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`)
      console.error('Migration failed:', error)
      return result
    }
  },

  /**
   * Clear localStorage after successful migration
   * (Only call this after verifying IndexedDB data is correct)
   */
  async clearLocalStorage(): Promise<void> {
    if (await MigrationService.hasMigrated()) {
      StorageService.clearAll()
    }
  },

  /**
   * Get migration status and statistics
   */
  async getMigrationStatus(): Promise<{
    migrated: boolean
    migrationDate: string | null
    localStorageData: {
      wallets: number
      transactions: number
      syncStatuses: number
    }
    indexedDBData: {
      wallets: number
      transactions: number
      syncStatuses: number
    }
  }> {
    const migrated = await MigrationService.hasMigrated()
    const migrationDate =
      await indexedDBService.getMetadata<string>('migration_date')

    // Count localStorage data
    const lsWallets = StorageService.loadWallets().length
    const lsTransactions = StorageService.loadTransactions()
    const lsTxCount = Object.values(lsTransactions).reduce(
      (sum: number, txs: unknown[]) => sum + txs.length,
      0
    )
    const lsSyncStatuses = Object.keys(
      StorageService.loadAllSyncStatus()
    ).length

    // Count IndexedDB data
    const stats = await indexedDBService.getStats()

    return {
      migrated,
      migrationDate,
      localStorageData: {
        wallets: lsWallets,
        transactions: lsTxCount,
        syncStatuses: lsSyncStatuses,
      },
      indexedDBData: {
        wallets: stats.walletCount,
        transactions: stats.transactionCount,
        syncStatuses: stats.syncStatusCount,
      },
    }
  },

  /**
   * Rollback - restore data from localStorage
   * (Use if migration fails or data is corrupted)
   */
  async rollback(): Promise<void> {
    // Clear IndexedDB
    await indexedDBService.clearAll()

    // Reset migration flag
    await indexedDBService.setMetadata('migration_completed', false)
  },
}
