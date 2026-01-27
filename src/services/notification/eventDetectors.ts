/**
 * Event Detectors
 * Detection logic for various notification-worthy events
 *
 * Classes:
 * - Class 1: Data Integrity & Connectivity
 * - Class 2: Actionable Transaction Events (Priority)
 * - Class 3: Financial Health & Compliance
 */

import { notificationService } from './notificationService'
import type {
  CreateNotificationInput,
  NotificationPreferences,
} from '../../types/notification'

// Type for notification input with required groupKey
type NotificationWithGroupKey = CreateNotificationInput & { groupKey: string }

// Generic transaction interface for event detection (subset of wallet Transaction types)
interface TransactionEventData {
  id: string
  hash?: string
  network: string
  type?: string
  from?: string
  to?: string
  value?: string
}

// =============================================================================
// CLASS 2: ACTIONABLE TRANSACTION EVENTS (Priority Implementation)
// =============================================================================

/**
 * Detect uncategorized transactions
 * Triggers when a transaction is saved without a category
 */
export async function detectUncategorizedTransaction(
  transaction: TransactionEventData
): Promise<void> {
  // Check if transaction has no category or is marked as other
  const isUncategorized = !transaction.type || transaction.type === 'other'

  if (isUncategorized) {
    const notification: NotificationWithGroupKey = {
      class: 'actionable_events',
      type: 'uncategorized_tx',
      severity: 'info',
      priority: 'medium',
      title: 'Uncategorized Transaction',
      message: `Transaction ${transaction.hash?.slice(0, 10) ?? transaction.id}... needs categorization`,
      actionRequired: true,
      entityRef: {
        entityType: 'transaction',
        entityId: transaction.id,
        chainId: transaction.network,
      },
      groupKey: `uncategorized_${transaction.id}`,
      metadata: {
        transactionId: transaction.id,
        hash: transaction.hash,
        network: transaction.network,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect low confidence auto-categorization
 * Triggers when auto-classification confidence is below threshold
 */
export async function detectLowConfidenceClassification(
  transaction: TransactionEventData,
  confidence: number,
  preferences: NotificationPreferences
): Promise<void> {
  const threshold = preferences.thresholds.confidenceThreshold

  if (confidence < threshold && confidence > 0) {
    const notification: NotificationWithGroupKey = {
      class: 'actionable_events',
      type: 'low_confidence',
      severity: 'info',
      priority: 'low',
      title: 'Low Confidence Classification',
      message: `Transaction classified as "${transaction.type}" with ${Math.round(confidence * 100)}% confidence`,
      actionRequired: true,
      entityRef: {
        entityType: 'transaction',
        entityId: transaction.id,
        chainId: transaction.network,
      },
      groupKey: `low_confidence_${transaction.id}`,
      metadata: {
        transactionId: transaction.id,
        classifiedType: transaction.type,
        confidence,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect unmatched internal transfers
 * Triggers when a transfer out doesn't have a matching deposit
 */
export async function detectUnmatchedTransfer(
  transaction: TransactionEventData & { direction?: 'in' | 'out' },
  hasMatchingDeposit: boolean
): Promise<void> {
  // Only check outgoing transfers
  if (transaction.type !== 'transfer' || transaction.direction !== 'out') {
    return
  }

  if (!hasMatchingDeposit) {
    const notification: NotificationWithGroupKey = {
      class: 'actionable_events',
      type: 'unmatched_transfer',
      severity: 'warning',
      priority: 'medium',
      title: 'Unmatched Transfer',
      message: `Outgoing transfer to ${transaction.to?.slice(0, 10) ?? 'unknown'}... has no matching deposit`,
      actionRequired: true,
      entityRef: {
        entityType: 'transaction',
        entityId: transaction.id,
        chainId: transaction.network,
      },
      groupKey: `unmatched_transfer_${transaction.id}`,
      metadata: {
        transactionId: transaction.id,
        toAddress: transaction.to,
        amount: transaction.value,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect orphaned deposits
 * Triggers when a deposit comes from an unknown/external source
 */
export async function detectOrphanedDeposit(
  transaction: TransactionEventData & { direction?: 'in' | 'out' },
  isKnownSource: boolean
): Promise<void> {
  // Only check incoming transfers
  if (transaction.direction !== 'in') {
    return
  }

  if (!isKnownSource) {
    const notification: NotificationWithGroupKey = {
      class: 'actionable_events',
      type: 'orphaned_deposit',
      severity: 'info',
      priority: 'low',
      title: 'Deposit from Unknown Source',
      message: `Received deposit from ${transaction.from?.slice(0, 10) ?? 'unknown'}... - source not identified`,
      actionRequired: false,
      entityRef: {
        entityType: 'transaction',
        entityId: transaction.id,
        chainId: transaction.network,
      },
      groupKey: `orphaned_deposit_${transaction.id}`,
      metadata: {
        transactionId: transaction.id,
        fromAddress: transaction.from,
        amount: transaction.value,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

// =============================================================================
// CLASS 1: DATA INTEGRITY & CONNECTIVITY
// =============================================================================

/**
 * Detect sync status changes
 * Triggers on connection failures or sync delays
 */
export async function detectSyncStatus(
  network: string,
  address: string,
  status: 'connected' | 'disconnected' | 'syncing' | 'error',
  errorMessage?: string
): Promise<void> {
  if (status === 'error' || status === 'disconnected') {
    const notification: NotificationWithGroupKey = {
      class: 'data_integrity',
      type: 'sync_status',
      severity: status === 'error' ? 'error' : 'warning',
      priority: status === 'error' ? 'high' : 'medium',
      title: status === 'error' ? 'Sync Error' : 'Connection Lost',
      message:
        errorMessage ||
        `Unable to sync ${network} wallet ${address.slice(0, 8)}...`,
      actionRequired: false,
      entityRef: {
        entityType: 'sync',
        entityId: `${network}:${address}`,
        chainId: network,
      },
      groupKey: `sync_status_${network}_${address}`,
      metadata: {
        network,
        address,
        status,
        errorMessage,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect API errors
 * Triggers when API requests fail
 */
export async function detectApiError(
  service: string,
  endpoint: string,
  errorCode: number | string,
  errorMessage: string
): Promise<void> {
  const notification: NotificationWithGroupKey = {
    class: 'data_integrity',
    type: 'api_error',
    severity: 'error',
    priority: 'high',
    title: 'API Error',
    message: `${service} request failed: ${errorMessage}`,
    actionRequired: false,
    groupKey: `api_error_${service}_${endpoint}`,
    metadata: {
      service,
      endpoint,
      errorCode,
      errorMessage,
    },
  }

  await notificationService.upsertByGroupKey(notification)
}

/**
 * Detect partial imports
 * Triggers when some transactions fail to import
 */
export async function detectPartialImport(
  totalCount: number,
  successCount: number,
  failedTransactions: Array<{ id: string; error: string }>
): Promise<void> {
  if (failedTransactions.length > 0) {
    const notification: CreateNotificationInput = {
      class: 'data_integrity',
      type: 'partial_import',
      severity: 'warning',
      priority: 'medium',
      title: 'Partial Import',
      message: `${successCount}/${totalCount} transactions imported. ${failedTransactions.length} failed.`,
      actionRequired: true,
      entityRef: {
        entityType: 'import',
        entityId: `import_${Date.now()}`,
      },
      metadata: {
        totalCount,
        successCount,
        failedCount: failedTransactions.length,
        failedTransactions: failedTransactions.slice(0, 10), // Limit stored failures
      },
    }

    await notificationService.create(notification)
  }
}

/**
 * Detect missing historical price
 * Triggers when price data is unavailable for a transaction date
 */
export async function detectMissingPrice(
  tokenSymbol: string,
  tokenAddress: string,
  date: string,
  transactionId: string
): Promise<void> {
  const notification: NotificationWithGroupKey = {
    class: 'data_integrity',
    type: 'missing_price',
    severity: 'warning',
    priority: 'low',
    title: 'Missing Price Data',
    message: `Historical price unavailable for ${tokenSymbol} on ${date}`,
    actionRequired: false,
    entityRef: {
      entityType: 'transaction',
      entityId: transactionId,
    },
    groupKey: `missing_price_${tokenSymbol}_${date}`,
    metadata: {
      tokenSymbol,
      tokenAddress,
      date,
      transactionId,
    },
  }

  await notificationService.upsertByGroupKey(notification)
}

/**
 * Detect unknown tokens
 * Triggers when an unrecognized token/contract is encountered
 */
export async function detectUnknownToken(
  contractAddress: string,
  network: string,
  transactionId?: string
): Promise<void> {
  const notification: NotificationWithGroupKey = {
    class: 'data_integrity',
    type: 'unknown_token',
    severity: 'info',
    priority: 'low',
    title: 'Unknown Token',
    message: `Unrecognized token contract: ${contractAddress.slice(0, 10)}... on ${network}`,
    actionRequired: false,
    entityRef: {
      entityType: 'token',
      entityId: contractAddress,
      chainId: network,
    },
    groupKey: `unknown_token_${network}_${contractAddress}`,
    metadata: {
      contractAddress,
      network,
      transactionId,
    },
  }

  await notificationService.upsertByGroupKey(notification)
}

// =============================================================================
// CLASS 3: FINANCIAL HEALTH & COMPLIANCE
// =============================================================================

/**
 * Detect large value transactions
 * Triggers when transaction value exceeds threshold
 */
export async function detectLargeValueTransaction(
  transaction: TransactionEventData,
  usdValue: number,
  preferences: NotificationPreferences
): Promise<void> {
  const threshold = preferences.thresholds.largeValueUsd

  if (usdValue >= threshold) {
    const notification: NotificationWithGroupKey = {
      class: 'financial_health',
      type: 'large_value_tx',
      severity: 'warning',
      priority: 'high',
      title: 'Large Transaction Detected',
      message: `Transaction of $${usdValue.toLocaleString()} recorded (threshold: $${threshold.toLocaleString()})`,
      actionRequired: false,
      entityRef: {
        entityType: 'transaction',
        entityId: transaction.id,
        chainId: transaction.network,
      },
      groupKey: `large_value_${transaction.id}`,
      metadata: {
        transactionId: transaction.id,
        usdValue,
        threshold,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect negative balance
 * Triggers when a sale results in negative ledger balance
 */
export async function detectNegativeBalance(
  tokenSymbol: string,
  walletAddress: string,
  balance: number,
  transactionId: string
): Promise<void> {
  if (balance < 0) {
    const notification: NotificationWithGroupKey = {
      class: 'financial_health',
      type: 'negative_balance',
      severity: 'error',
      priority: 'critical',
      title: 'Negative Balance Detected',
      message: `${tokenSymbol} balance is negative (${balance}) in wallet ${walletAddress.slice(0, 8)}...`,
      actionRequired: true,
      entityRef: {
        entityType: 'wallet',
        entityId: walletAddress,
      },
      groupKey: `negative_balance_${walletAddress}_${tokenSymbol}`,
      metadata: {
        tokenSymbol,
        walletAddress,
        balance,
        transactionId,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect potential duplicate transactions
 * Triggers when a transaction appears to be a duplicate
 */
export async function detectDuplicateTransaction(
  transaction: TransactionEventData,
  existingTransactionId: string
): Promise<void> {
  const notification: NotificationWithGroupKey = {
    class: 'financial_health',
    type: 'duplicate_tx',
    severity: 'warning',
    priority: 'high',
    title: 'Potential Duplicate',
    message: `Transaction may be a duplicate of ${existingTransactionId.slice(0, 10)}...`,
    actionRequired: true,
    entityRef: {
      entityType: 'transaction',
      entityId: transaction.id,
      chainId: transaction.network,
    },
    groupKey: `duplicate_${transaction.id}_${existingTransactionId}`,
    metadata: {
      newTransactionId: transaction.id,
      existingTransactionId,
      hash: transaction.hash,
    },
  }

  await notificationService.upsertByGroupKey(notification)
}

/**
 * Detect low liquidity
 * Triggers when wallet balance falls below threshold
 */
export async function detectLowLiquidity(
  walletAddress: string,
  totalUsdValue: number,
  preferences: NotificationPreferences
): Promise<void> {
  const threshold = preferences.thresholds.lowLiquidityUsd

  if (totalUsdValue < threshold && totalUsdValue > 0) {
    const notification: NotificationWithGroupKey = {
      class: 'financial_health',
      type: 'low_liquidity',
      severity: 'warning',
      priority: 'medium',
      title: 'Low Balance Warning',
      message: `Wallet balance ($${totalUsdValue.toLocaleString()}) below threshold ($${threshold.toLocaleString()})`,
      actionRequired: false,
      entityRef: {
        entityType: 'wallet',
        entityId: walletAddress,
      },
      groupKey: `low_liquidity_${walletAddress}`,
      metadata: {
        walletAddress,
        totalUsdValue,
        threshold,
      },
    }

    await notificationService.upsertByGroupKey(notification)
  }
}

/**
 * Detect pending approval required
 * Triggers for transactions requiring approval workflow
 */
export async function detectPendingApproval(
  transaction: TransactionEventData,
  submitterName: string
): Promise<void> {
  const notification: NotificationWithGroupKey = {
    class: 'financial_health',
    type: 'pending_approval',
    severity: 'info',
    priority: 'medium',
    title: 'Approval Required',
    message: `${submitterName} submitted a transaction requiring approval`,
    actionRequired: true,
    entityRef: {
      entityType: 'transaction',
      entityId: transaction.id,
    },
    groupKey: `pending_approval_${transaction.id}`,
    metadata: {
      transactionId: transaction.id,
      submitterName,
    },
  }

  await notificationService.upsertByGroupKey(notification)
}

// =============================================================================
// BATCH DETECTION UTILITIES
// =============================================================================

/**
 * Process a batch of transactions for notification detection
 */
export async function processTransactionBatch(
  transactions: TransactionEventData[]
): Promise<void> {
  for (const transaction of transactions) {
    // Check for uncategorized transactions
    await detectUncategorizedTransaction(transaction)

    // Note: Other detections would require additional context
    // (known wallets, price data, etc.) which would be passed from
    // the calling code
  }
}

/**
 * Detect sync completion notification
 */
export async function detectSyncComplete(
  network: string,
  address: string,
  transactionsFound: number
): Promise<void> {
  // Clear any existing sync error notifications
  const existingNotification = await notificationService.findByGroupKey(
    `sync_status_${network}_${address}`
  )

  if (existingNotification) {
    await notificationService.resolve(existingNotification.id)
  }

  // Only create a success notification if transactions were found
  if (transactionsFound > 0) {
    const notification: CreateNotificationInput = {
      class: 'data_integrity',
      type: 'sync_status',
      severity: 'success',
      priority: 'low',
      title: 'Sync Complete',
      message: `Found ${transactionsFound} transaction${transactionsFound === 1 ? '' : 's'} for ${network} wallet`,
      actionRequired: false,
      entityRef: {
        entityType: 'sync',
        entityId: `${network}:${address}`,
        chainId: network,
      },
      metadata: {
        network,
        address,
        transactionsFound,
      },
    }

    await notificationService.create(notification)
  }
}
