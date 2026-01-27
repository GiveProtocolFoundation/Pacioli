/**
 * Notification Detection Hooks
 * React hooks for integrating notification detection with app functionality
 */

import { useCallback } from 'react'
import {
  detectSyncStatus,
  detectSyncComplete,
  detectApiError,
  detectPartialImport,
  detectUnknownToken,
  detectMissingPrice,
  detectUncategorizedTransaction,
  detectLargeValueTransaction,
  detectNegativeBalance,
  detectDuplicateTransaction,
  detectLowLiquidity,
} from '../services/notification/eventDetectors'
import { notificationService } from '../services/notification/notificationService'
import type { EVMSyncProgress } from '../services/blockchain/evmTransactionService'

// Generic transaction data for notification hooks
interface TransactionData {
  id: string
  hash?: string
  network: string
  type?: string
}

/**
 * Hook for detecting sync-related events during blockchain synchronization
 */
export function useSyncNotifications() {
  /**
   * Create a progress handler that detects sync events
   */
  const createProgressHandler = useCallback(
    (network: string, address: string) => {
      let lastStage: EVMSyncProgress['stage'] | null = null

      return async (progress: EVMSyncProgress) => {
        // Detect connection/sync issues
        if (progress.stage === 'connecting' && lastStage !== 'connecting') {
          // Starting sync - no notification needed
        }

        // Track stage changes
        lastStage = progress.stage

        // Detect sync completion
        if (progress.stage === 'complete') {
          await detectSyncComplete(network, address, progress.transactionsFound)
        }
      }
    },
    []
  )

  /**
   * Report a sync error
   */
  const reportSyncError = useCallback(
    async (
      network: string,
      address: string,
      error: Error | string
    ) => {
      const errorMessage =
        typeof error === 'string' ? error : error.message
      await detectSyncStatus(network, address, 'error', errorMessage)
    },
    []
  )

  /**
   * Report sync disconnection
   */
  const reportDisconnection = useCallback(
    async (network: string, address: string) => {
      await detectSyncStatus(network, address, 'disconnected')
    },
    []
  )

  return {
    createProgressHandler,
    reportSyncError,
    reportDisconnection,
  }
}

/**
 * Hook for detecting transaction-related events during import
 */
export function useTransactionNotifications() {
  /**
   * Process imported transactions for notification detection
   */
  const processImportedTransactions = useCallback(
    async (
      transactions: Array<TransactionData & { usdValue?: number }>,
      options: {
        checkUncategorized?: boolean
        checkLargeValue?: boolean
      } = {}
    ) => {
      const { checkUncategorized = true, checkLargeValue = true } = options

      const preferences = await notificationService.getPreferences()

      for (const tx of transactions) {
        // Check for uncategorized transactions
        if (checkUncategorized) {
          await detectUncategorizedTransaction(tx)
        }

        // Check for large value transactions
        if (checkLargeValue && tx.usdValue !== undefined) {
          await detectLargeValueTransaction(tx, tx.usdValue, preferences)
        }
      }
    },
    []
  )

  /**
   * Report import completion with potential failures
   */
  const reportImportResults = useCallback(
    async (
      totalCount: number,
      successCount: number,
      failures: Array<{ id: string; error: string }>
    ) => {
      if (failures.length > 0) {
        await detectPartialImport(totalCount, successCount, failures)
      }
    },
    []
  )

  /**
   * Report unknown token encountered
   */
  const reportUnknownToken = useCallback(
    async (contractAddress: string, network: string, transactionId?: string) => {
      await detectUnknownToken(contractAddress, network, transactionId)
    },
    []
  )

  /**
   * Report missing price data
   */
  const reportMissingPrice = useCallback(
    async (
      tokenSymbol: string,
      tokenAddress: string,
      date: string,
      transactionId: string
    ) => {
      await detectMissingPrice(tokenSymbol, tokenAddress, date, transactionId)
    },
    []
  )

  /**
   * Report potential duplicate transaction
   */
  const reportDuplicate = useCallback(
    async (transaction: TransactionData, existingTransactionId: string) => {
      await detectDuplicateTransaction(transaction, existingTransactionId)
    },
    []
  )

  return {
    processImportedTransactions,
    reportImportResults,
    reportUnknownToken,
    reportMissingPrice,
    reportDuplicate,
  }
}

/**
 * Hook for detecting balance-related events
 */
export function useBalanceNotifications() {
  /**
   * Check for negative balance after a transaction
   */
  const checkNegativeBalance = useCallback(
    async (
      tokenSymbol: string,
      walletAddress: string,
      balance: number,
      transactionId: string
    ) => {
      await detectNegativeBalance(tokenSymbol, walletAddress, balance, transactionId)
    },
    []
  )

  /**
   * Check for low liquidity
   */
  const checkLowLiquidity = useCallback(
    async (walletAddress: string, totalUsdValue: number) => {
      const preferences = await notificationService.getPreferences()
      await detectLowLiquidity(walletAddress, totalUsdValue, preferences)
    },
    []
  )

  return {
    checkNegativeBalance,
    checkLowLiquidity,
  }
}

/**
 * Hook for detecting API-related events
 */
export function useApiNotifications() {
  /**
   * Report an API error
   */
  const reportApiError = useCallback(
    async (
      service: string,
      endpoint: string,
      errorCode: number | string,
      errorMessage: string
    ) => {
      await detectApiError(service, endpoint, errorCode, errorMessage)
    },
    []
  )

  return {
    reportApiError,
  }
}

/**
 * Combined hook for all notification detectors
 */
export function useNotificationDetectors() {
  const sync = useSyncNotifications()
  const transactions = useTransactionNotifications()
  const balances = useBalanceNotifications()
  const api = useApiNotifications()

  return {
    sync,
    transactions,
    balances,
    api,
  }
}

export default useNotificationDetectors
