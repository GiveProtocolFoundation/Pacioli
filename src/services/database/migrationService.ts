/**
 * Migration Service
 * Migrates data from localStorage to IndexedDB
 */

import { storageService } from './storageService'
import { indexedDBService } from './indexedDBService'

export interface MigrationResult {
  success: boolean
  walletsMigrated: number
  transactionsMigrated: number
  syncStatusesMigrated: number
  errors: string[]
}

class MigrationService {
  /**
   * Check if migration has been completed
   */
  async hasMigrated(): Promise<boolean> {
    const migrationFlag = await indexedDBService.getMetadata<boolean>('migration_completed')
    return migrationFlag === true
  }

  /**
   * Mark migration as completed
   */
  private async setMigrationCompleted(): Promise<void> {
    await indexedDBService.setMetadata('migration_completed', true)
    await indexedDBService.setMetadata('migration_date', new Date().toISOString())
  }

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
      if (await this.hasMigrated()) {
        console.log('Migration already completed')
        result.success = true
        return result
      }

      console.log('Starting migration from localStorage to IndexedDB...')

      // Migrate wallets
      try {
        const wallets = storageService.loadWallets()
        if (wallets.length > 0) {
          await indexedDBService.saveWallets(wallets)
          result.walletsMigrated = wallets.length
          console.log(`Migrated ${wallets.length} wallets`)
        }
      } catch (error) {
        const errorMsg = `Failed to migrate wallets: ${error}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }

      // Migrate transactions
      try {
        const allTransactions = storageService.loadTransactions()
        const transactionKeys = Object.keys(allTransactions)

        for (const key of transactionKeys) {
          const [network, address] = key.split(':')
          const transactions = allTransactions[key]

          if (transactions && transactions.length > 0) {
            await indexedDBService.saveTransactions(network, address, transactions)
            result.transactionsMigrated += transactions.length
          }
        }

        console.log(`Migrated ${result.transactionsMigrated} transactions`)
      } catch (error) {
        const errorMsg = `Failed to migrate transactions: ${error}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }

      // Migrate sync status
      try {
        const allSyncStatus = storageService.loadAllSyncStatus()
        const statusKeys = Object.keys(allSyncStatus)

        for (const key of statusKeys) {
          const status = allSyncStatus[key]
          if (status) {
            await indexedDBService.saveSyncStatus(status)
            result.syncStatusesMigrated++
          }
        }

        console.log(`Migrated ${result.syncStatusesMigrated} sync statuses`)
      } catch (error) {
        const errorMsg = `Failed to migrate sync status: ${error}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }

      // Mark migration as complete
      await this.setMigrationCompleted()

      result.success = result.errors.length === 0
      console.log('Migration completed', result)

      return result
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`)
      console.error('Migration failed:', error)
      return result
    }
  }

  /**
   * Clear localStorage after successful migration
   * (Only call this after verifying IndexedDB data is correct)
   */
  async clearLocalStorage(): Promise<void> {
    if (await this.hasMigrated()) {
      storageService.clearAll()
      console.log('localStorage cleared after successful migration')
    } else {
      console.warn('Cannot clear localStorage - migration not completed')
    }
  }

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
    const migrated = await this.hasMigrated()
    const migrationDate = await indexedDBService.getMetadata<string>('migration_date')

    // Count localStorage data
    const lsWallets = storageService.loadWallets().length
    const lsTransactions = storageService.loadTransactions()
    const lsTxCount = Object.values(lsTransactions).reduce(
      (sum, txs) => sum + txs.length,
      0
    )
    const lsSyncStatuses = Object.keys(storageService.loadAllSyncStatus()).length

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
  }

  /**
   * Rollback - restore data from localStorage
   * (Use if migration fails or data is corrupted)
   */
  async rollback(): Promise<void> {
    console.warn('Rolling back migration...')

    // Clear IndexedDB
    await indexedDBService.clearAll()

    // Reset migration flag
    await indexedDBService.setMetadata('migration_completed', false)

    console.log('Rollback completed - using localStorage again')
  }
}

export const migrationService = new MigrationService()
