import React, { useState, useCallback, useMemo } from 'react'
import {
  X,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Receipt,
  Wallet,
  Users,
  ArrowRight,
  Check,
  XCircle,
  RefreshCw,
  WifiOff,
  HelpCircle,
  Database,
  Loader2,
} from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext'
import type {
  Notification as NotificationData,
  NotificationClass,
  NotificationType,
  NotificationSeverity,
} from '../../types/notification'
import { getNotificationClassLabel } from '../../types/notification'

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  userType: 'individual' | 'organization'
}

interface NotificationItemProps {
  notification: NotificationData
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
  onResolve: (id: string) => void
  formatTimestamp: (timestamp: string) => string
  getSeverityStyles: (severity: NotificationSeverity) => string
  getIcon: (notification: NotificationData) => React.ElementType
}

// Map notification class to UI filter tabs
type FilterType = 'all' | 'financial' | 'transactional' | 'workflow' | 'approval'

function mapClassToFilter(notifClass: NotificationClass): FilterType {
  switch (notifClass) {
    case 'financial_health':
      return 'financial'
    case 'actionable_events':
      return 'transactional'
    case 'data_integrity':
      return 'workflow'
    default:
      return 'transactional'
  }
}

// Get icon based on notification type
function getNotificationIcon(
  notification: NotificationData
): React.ElementType {
  const typeIcons: Partial<Record<NotificationType, React.ElementType>> = {
    // Data Integrity
    sync_status: RefreshCw,
    api_error: WifiOff,
    partial_import: Database,
    missing_price: HelpCircle,
    unknown_token: HelpCircle,
    // Actionable Events
    uncategorized_tx: Receipt,
    low_confidence: AlertTriangle,
    unmatched_transfer: ArrowRight,
    orphaned_deposit: Wallet,
    // Financial Health
    negative_balance: AlertTriangle,
    duplicate_tx: XCircle,
    low_liquidity: DollarSign,
    large_value_tx: TrendingUp,
    pending_approval: Users,
  }

  return typeIcons[notification.type] || AlertTriangle
}

const NotificationActions: React.FC<{
  notification: NotificationData
  onDismiss: (id: string) => void
  onResolve: (id: string) => void
}> = ({ notification, onDismiss, onResolve }) => {
  const handleResolve = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onResolve(notification.id)
    },
    [notification.id, onResolve]
  )

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDismiss(notification.id)
    },
    [notification.id, onDismiss]
  )

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleResolve}
        className="p-1.5 text-[#7a9b6f] dark:text-[#8faf84] hover:bg-[#7a9b6f]/10 dark:hover:bg-[#7a9b6f]/20 rounded"
        title="Resolve"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={handleDismiss}
        className="p-1.5 text-[#9d6b6b] dark:text-[#b88585] hover:bg-[#9d6b6b]/10 dark:hover:bg-[#9d6b6b]/20 rounded"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      {notification.entityRef && (
        <button className="text-xs text-[#8b4e52] dark:text-[#a86e72] hover:underline flex items-center">
          View
          <ArrowRight className="w-3 h-3 ml-1" />
        </button>
      )}
    </div>
  )
}

const NotificationBody: React.FC<{
  notification: NotificationData
  formatTimestamp: (timestamp: string) => string
  onDismiss: (id: string) => void
  onResolve: (id: string) => void
}> = ({ notification, formatTimestamp, onDismiss, onResolve }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
          {notification.title}
          {!notification.read && (
            <span className="inline-block w-2 h-2 bg-[#8b4e52] rounded-full ml-2" />
          )}
        </p>
        <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
          {notification.message}
        </p>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2">
      <div className="flex items-center space-x-2">
        <span className="text-xs text-[#a39d94] dark:text-[#696557]">
          {formatTimestamp(notification.createdAt)}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#ede8e0] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac]">
          {getNotificationClassLabel(notification.class)}
        </span>
      </div>
      {notification.actionRequired && !notification.resolved && (
        <NotificationActions
          notification={notification}
          onDismiss={onDismiss}
          onResolve={onResolve}
        />
      )}
    </div>
  </div>
)

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onResolve,
  formatTimestamp,
  getSeverityStyles,
  getIcon,
}) => {
  const Icon = getIcon(notification)
  const handleClick = useCallback(() => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
  }, [onMarkAsRead, notification.id, notification.read])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!notification.read) {
          onMarkAsRead(notification.id)
        }
      }
    },
    [onMarkAsRead, notification.id, notification.read]
  )

  return (
    <div
      key={notification.id}
      className={`p-4 hover:bg-[#c9a961]/5 dark:hover:bg-[#c9a961]/10 transition-colors cursor-pointer ${
        !notification.read ? 'bg-[#8b4e52]/5 dark:bg-[#8b4e52]/10' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}`}
    >
      <div className="flex items-start space-x-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getSeverityStyles(
            notification.severity
          )}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <NotificationBody
          notification={notification}
          formatTimestamp={formatTimestamp}
          onDismiss={onDismiss}
          onResolve={onResolve}
        />
      </div>
    </div>
  )
}

const FilterTabs: React.FC<{
  filter: FilterType
  userType: 'individual' | 'organization'
  onAll: () => void
  onFinancial: () => void
  onTransactional: () => void
  onWorkflow: () => void
  onApproval: () => void
}> = ({
  filter,
  userType,
  onAll,
  onFinancial,
  onTransactional,
  onWorkflow,
  onApproval,
}) => (
  <div className="flex items-center space-x-2 p-4 border-b border-[rgba(201,169,97,0.15)] overflow-x-auto">
    <button
      onClick={onAll}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filter === 'all'
          ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
          : 'bg-[#ede8e0] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#e5dfd4] dark:hover:bg-[#2a2620]'
      }`}
    >
      All
    </button>
    <button
      onClick={onFinancial}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filter === 'financial'
          ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
          : 'bg-[#ede8e0] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#e5dfd4] dark:hover:bg-[#2a2620]'
      }`}
    >
      Financial
    </button>
    <button
      onClick={onTransactional}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filter === 'transactional'
          ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
          : 'bg-[#ede8e0] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#e5dfd4] dark:hover:bg-[#2a2620]'
      }`}
    >
      Transactions
    </button>
    {userType === 'organization' && (
      <>
        <button
          onClick={onWorkflow}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            filter === 'workflow'
              ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
              : 'bg-[#ede8e0] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#e5dfd4] dark:hover:bg-[#2a2620]'
          }`}
        >
          Data & Sync
        </button>
        <button
          onClick={onApproval}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            filter === 'approval'
              ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
              : 'bg-[#ede8e0] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#e5dfd4] dark:hover:bg-[#2a2620]'
          }`}
        >
          Approvals
        </button>
      </>
    )}
  </div>
)

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  onClose,
  userType,
}) => {
  const [filter, setFilter] = useState<FilterType>('all')

  const {
    notifications,
    stats,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    resolve,
    refresh,
  } = useNotifications()

  // Filter notifications based on user type and selected filter
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      // For individuals, don't show workflow or approval-type notifications
      if (userType === 'individual') {
        const notifFilter = mapClassToFilter(notif.class)
        if (notifFilter === 'workflow' || notifFilter === 'approval') {
          // Allow data_integrity but not pending_approval type
          if (notif.type === 'pending_approval') {
            return false
          }
        }
      }

      // Apply selected filter
      if (filter === 'all') return true

      // Map notification class to filter
      const notifFilter = mapClassToFilter(notif.class)

      // Special case: pending_approval type goes to approval filter
      if (notif.type === 'pending_approval') {
        return filter === 'approval'
      }

      return notifFilter === filter
    })
  }, [notifications, userType, filter])

  const unreadCount = stats.unread
  const actionRequiredCount = stats.actionRequired

  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    )

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    return date.toLocaleDateString()
  }, [])

  const getSeverityStyles = useCallback((severity: NotificationSeverity) => {
    const styles = {
      info: 'bg-[#c9a961]/20 dark:bg-[#c9a961]/30 text-[#8b4e52] dark:text-[#a86e72]',
      warning:
        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      success:
        'bg-green-100 dark:bg-green-900/30 text-[#7a9b6f] dark:text-[#8faf84]',
      error: 'bg-red-100 dark:bg-red-900/30 text-[#9d6b6b] dark:text-[#b88585]',
    }
    return styles[severity]
  }, [])

  const handleMarkAsRead = useCallback(
    (id: string) => {
      markAsRead(id)
    },
    [markAsRead]
  )

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss(id)
    },
    [dismiss]
  )

  const handleResolve = useCallback(
    (id: string) => {
      resolve(id)
    },
    [resolve]
  )

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead()
  }, [markAllAsRead])

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  const handleFilterAll = useCallback(() => setFilter('all'), [])
  const handleFilterFinancial = useCallback(() => setFilter('financial'), [])
  const handleFilterTransactional = useCallback(
    () => setFilter('transactional'),
    []
  )
  const handleFilterWorkflow = useCallback(() => setFilter('workflow'), [])
  const handleFilterApproval = useCallback(() => setFilter('approval'), [])

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close notifications"
      />

      {/* Sliding Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-[#fafaf8] dark:bg-[#0f0e0c] shadow-xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(201,169,97,0.15)]">
          <div>
            <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
              Notifications
            </h2>
            <p className="text-xs text-[#696557] dark:text-[#94a3b8] mt-0.5">
              {unreadCount} unread{' '}
              {actionRequiredCount > 0 &&
                `• ${actionRequiredCount} require action`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac] rounded-lg hover:bg-[#ede8e0] dark:hover:bg-[#1a1815]"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-[#8b4e52] dark:text-[#a86e72] hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac] rounded-lg hover:bg-[#ede8e0] dark:hover:bg-[#1a1815]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <FilterTabs
          filter={filter}
          userType={userType}
          onAll={handleFilterAll}
          onFinancial={handleFilterFinancial}
          onTransactional={handleFilterTransactional}
          onWorkflow={handleFilterWorkflow}
          onApproval={handleFilterApproval}
        />

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Loader2 className="w-12 h-12 text-[#a39d94] mb-3 animate-spin" />
              <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                Loading notifications...
              </p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <CheckCircle className="w-12 h-12 text-[#a39d94] mb-3" />
              <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                All caught up!
              </p>
              <p className="text-xs text-[#696557] dark:text-[#94a3b8] mt-1">
                No notifications to show
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(201,169,97,0.15)]">
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDismiss={handleDismiss}
                  onResolve={handleResolve}
                  formatTimestamp={formatTimestamp}
                  getSeverityStyles={getSeverityStyles}
                  getIcon={getNotificationIcon}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(201,169,97,0.15)] p-4">
          <button className="w-full text-sm text-[#8b4e52] dark:text-[#a86e72] hover:underline">
            View all notifications
          </button>
        </div>
      </div>
    </>
  )
}

export default NotificationsPanel
