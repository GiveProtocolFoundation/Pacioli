/**
 * Notification System Types
 * Comprehensive type definitions for the functional notification system
 */

// =============================================================================
// NOTIFICATION CLASS AND TYPE ENUMS
// =============================================================================

/**
 * Notification classification by domain
 */
export type NotificationClass =
  | 'data_integrity'
  | 'actionable_events'
  | 'financial_health'

/**
 * Class 1: Data Integrity & Connectivity notifications
 */
export type DataIntegrityType =
  | 'sync_status'
  | 'api_error'
  | 'partial_import'
  | 'missing_price'
  | 'unknown_token'

/**
 * Class 2: Actionable Transaction Events notifications
 */
export type ActionableEventType =
  | 'uncategorized_tx'
  | 'low_confidence'
  | 'unmatched_transfer'
  | 'orphaned_deposit'

/**
 * Class 3: Financial Health & Compliance notifications
 */
export type FinancialHealthType =
  | 'negative_balance'
  | 'duplicate_tx'
  | 'low_liquidity'
  | 'large_value_tx'
  | 'pending_approval'

/**
 * All notification types combined
 */
export type NotificationType =
  | DataIntegrityType
  | ActionableEventType
  | FinancialHealthType

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'warning' | 'success' | 'error'

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'

// =============================================================================
// NOTIFICATION ENTITY REFERENCE
// =============================================================================

/**
 * Reference to a related entity (for navigation/linking)
 */
export interface NotificationEntityRef {
  entityType: 'transaction' | 'wallet' | 'token' | 'sync' | 'import'
  entityId: string
  chainId?: string
}

// =============================================================================
// NOTIFICATION ACTIONS
// =============================================================================

/**
 * Action that can be taken on a notification
 */
export interface NotificationAction {
  id: string
  label: string
  variant: 'primary' | 'secondary' | 'danger'
  action:
    | { type: 'navigate'; path: string }
    | { type: 'dismiss' }
    | { type: 'resolve' }
    | { type: 'custom'; handler: string }
}

// =============================================================================
// CORE NOTIFICATION INTERFACE
// =============================================================================

/**
 * Core notification data structure
 */
export interface Notification {
  id: string
  class: NotificationClass
  type: NotificationType
  severity: NotificationSeverity
  priority: NotificationPriority
  title: string
  message: string
  read: boolean
  dismissed: boolean
  resolved: boolean
  actionRequired: boolean
  actions?: NotificationAction[]
  entityRef?: NotificationEntityRef
  createdAt: string
  updatedAt?: string
  groupKey?: string // For collapsing similar notifications
  metadata?: Record<string, unknown> // Additional context-specific data
}

/**
 * Input for creating a new notification
 */
export interface CreateNotificationInput {
  class: NotificationClass
  type: NotificationType
  severity: NotificationSeverity
  priority: NotificationPriority
  title: string
  message: string
  actionRequired?: boolean
  actions?: NotificationAction[]
  entityRef?: NotificationEntityRef
  groupKey?: string
  metadata?: Record<string, unknown>
}

/**
 * Input for updating an existing notification
 */
export interface UpdateNotificationInput {
  read?: boolean
  dismissed?: boolean
  resolved?: boolean
}

// =============================================================================
// NOTIFICATION PREFERENCES
// =============================================================================

/**
 * Settings for a specific notification class
 */
export interface NotificationClassSettings {
  enabled: boolean
  minimumSeverity: NotificationSeverity
}

/**
 * Threshold configuration for automatic notifications
 */
export interface NotificationThresholds {
  largeValueUsd: number // Default: $10,000
  lowLiquidityUsd: number // Default: $1,000
  confidenceThreshold: number // Default: 0.7 (70%)
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  id: string // Always 'user_preferences'
  enabled: boolean
  soundEnabled: boolean
  classSettings: Record<NotificationClass, NotificationClassSettings>
  thresholds: NotificationThresholds
  updatedAt: string
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  id: 'user_preferences',
  enabled: true,
  soundEnabled: false,
  classSettings: {
    data_integrity: {
      enabled: true,
      minimumSeverity: 'warning',
    },
    actionable_events: {
      enabled: true,
      minimumSeverity: 'info',
    },
    financial_health: {
      enabled: true,
      minimumSeverity: 'warning',
    },
  },
  thresholds: {
    largeValueUsd: 10000,
    lowLiquidityUsd: 1000,
    confidenceThreshold: 0.7,
  },
  updatedAt: new Date().toISOString(),
}

// =============================================================================
// NOTIFICATION STATISTICS
// =============================================================================

/**
 * Notification statistics for UI display
 */
export interface NotificationStats {
  total: number
  unread: number
  actionRequired: number
  byClass: Record<NotificationClass, number>
  bySeverity: Record<NotificationSeverity, number>
}

// =============================================================================
// NOTIFICATION QUERY INTERFACE
// =============================================================================

/**
 * Query options for fetching notifications
 */
export interface NotificationQuery {
  class?: NotificationClass
  type?: NotificationType
  severity?: NotificationSeverity
  read?: boolean
  dismissed?: boolean
  resolved?: boolean
  actionRequired?: boolean
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * Paginated notification result
 */
export interface NotificationPage {
  notifications: Notification[]
  total: number
  hasMore: boolean
}

// =============================================================================
// NOTIFICATION EVENT INTERFACE
// =============================================================================

/**
 * Event types emitted by the notification service
 */
export type NotificationEventType =
  | 'notification_created'
  | 'notification_updated'
  | 'notification_deleted'
  | 'notifications_cleared'

/**
 * Notification event payload
 */
export interface NotificationEvent {
  type: NotificationEventType
  notification?: Notification
  notifications?: Notification[]
  timestamp: string
}

/**
 * Notification event subscriber callback
 */
export type NotificationSubscriber = (event: NotificationEvent) => void

// =============================================================================
// TYPE MAPPING HELPERS
// =============================================================================

/**
 * Maps notification type to its class
 */
export function getNotificationClass(
  type: NotificationType
): NotificationClass {
  const dataIntegrityTypes: DataIntegrityType[] = [
    'sync_status',
    'api_error',
    'partial_import',
    'missing_price',
    'unknown_token',
  ]

  const actionableEventTypes: ActionableEventType[] = [
    'uncategorized_tx',
    'low_confidence',
    'unmatched_transfer',
    'orphaned_deposit',
  ]

  if (dataIntegrityTypes.includes(type as DataIntegrityType)) {
    return 'data_integrity'
  }
  if (actionableEventTypes.includes(type as ActionableEventType)) {
    return 'actionable_events'
  }
  return 'financial_health'
}

/**
 * Maps notification class to display label
 */
export function getNotificationClassLabel(
  notificationClass: NotificationClass
): string {
  const labels: Record<NotificationClass, string> = {
    data_integrity: 'Data & Sync',
    actionable_events: 'Transactions',
    financial_health: 'Financial',
  }
  return labels[notificationClass]
}

/**
 * Maps notification type to display label
 */
export function getNotificationTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    // Data Integrity
    sync_status: 'Sync Status',
    api_error: 'API Error',
    partial_import: 'Partial Import',
    missing_price: 'Missing Price',
    unknown_token: 'Unknown Token',
    // Actionable Events
    uncategorized_tx: 'Uncategorized Transaction',
    low_confidence: 'Low Confidence',
    unmatched_transfer: 'Unmatched Transfer',
    orphaned_deposit: 'Orphaned Deposit',
    // Financial Health
    negative_balance: 'Negative Balance',
    duplicate_tx: 'Duplicate Transaction',
    low_liquidity: 'Low Liquidity',
    large_value_tx: 'Large Transaction',
    pending_approval: 'Pending Approval',
  }
  return labels[type]
}

/**
 * Gets default priority for a notification type
 */
export function getDefaultPriority(
  type: NotificationType,
  severity: NotificationSeverity
): NotificationPriority {
  // Error severity always gets high priority
  if (severity === 'error') {
    return type === 'negative_balance' ? 'critical' : 'high'
  }

  // Warning severity gets medium-high priority
  if (severity === 'warning') {
    const highPriorityTypes: NotificationType[] = [
      'duplicate_tx',
      'unmatched_transfer',
      'large_value_tx',
    ]
    return highPriorityTypes.includes(type) ? 'high' : 'medium'
  }

  // Info/Success get low-medium priority
  return 'low'
}
