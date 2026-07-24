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
type FilterType =
  | 'all'
  | 'financial'
  | 'transactional'
  | 'workflow'
  | 'approval'

/**
 * Maps a notification class to the corresponding UI filter tab.
 */
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

/**
 * Get icon based on notification type.
 */
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

// ============================================================================
// Notification Item Components
// ============================================================================

/**
 * Action buttons for notifications that require user response.
 */
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
        className="p-1.5 text-[#E8836F] dark:text-[#F09988] hover:bg-[#E8836F]/10 dark:hover:bg-[#E8836F]/20 rounded"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      {notification.entityRef && (
        <button className="text-xs text-[#294050] dark:text-[#F09988] hover:underline flex items-center">
          View
          <ArrowRight className="w-3 h-3 ml-1" />
        </button>
      )}
    </div>
  )
}

/**
 * Renders the body content of a notification including title, message, timestamp, and actions.
 */
const NotificationBody: React.FC<{
  notification: NotificationData
  formatTimestamp: (timestamp: string) => string
  onDismiss: (id: string) => void
  onResolve: (id: string) => void
}> = ({ notification, formatTimestamp, onDismiss, onResolve }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
          {notification.title}
          {!notification.read && (
            <span className="inline-block w-2 h-2 bg-[#294050] rounded-full ml-2" />
          )}
        </p>
        <p className="text-xs text-[#294050] dark:text-[#9FB4BE] mt-1">
          {notification.message}
        </p>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2">
      <div className="flex items-center space-x-2">
        <span className="text-xs text-[#647D8B] dark:text-[#294050]">
          {formatTimestamp(notification.createdAt)}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#D9E5E4] dark:bg-[#11202B] text-[#294050] dark:text-[#9FB4BE]">
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

/**
 * Renders a single notification item with icon, body, and click handling.
 */
const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onResolve,
  formatTimestamp,
  getSeverityStyles,
  getIcon,
}) => {
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
      className={`p-4 hover:bg-[#5FE3C0]/5 dark:hover:bg-[#5FE3C0]/10 transition-colors cursor-pointer ${
        !notification.read ? 'bg-[#294050]/5 dark:bg-[#294050]/10' : ''
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
          {React.createElement(getIcon(notification), { className: 'w-5 h-5' })}
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

// ============================================================================
// Panel Section Components
// ============================================================================

/**
 * Filter tabs for categorizing notifications by type.
 */
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
}) => {
  /**
   * Returns the CSS class string for a button based on its active state.
   * @param {boolean} isActive - Whether the button is active.
   * @returns {string} The computed class names for the button.
   */
  const getButtonClass = (isActive: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
      isActive
        ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988]'
        : 'bg-[#D9E5E4] dark:bg-[#11202B] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#e5dfd4] dark:hover:bg-[#16242F]'
    }`

  return (
    <div className="flex items-center space-x-2 p-4 border-b border-[rgba(95,227,192,0.15)] overflow-x-auto">
      <button onClick={onAll} className={getButtonClass(filter === 'all')}>
        All
      </button>
      <button
        onClick={onFinancial}
        className={getButtonClass(filter === 'financial')}
      >
        Financial
      </button>
      <button
        onClick={onTransactional}
        className={getButtonClass(filter === 'transactional')}
      >
        Transactions
      </button>
      {userType === 'organization' && (
        <>
          <button
            onClick={onWorkflow}
            className={getButtonClass(filter === 'workflow')}
          >
            Data & Sync
          </button>
          <button
            onClick={onApproval}
            className={getButtonClass(filter === 'approval')}
          >
            Approvals
          </button>
        </>
      )}
    </div>
  )
}

interface PanelHeaderProps {
  unreadCount: number
  actionRequiredCount: number
  isLoading: boolean
  onRefresh: () => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

/**
 * Panel header with title, counts, and action buttons.
 */
const PanelHeader: React.FC<PanelHeaderProps> = ({
  unreadCount,
  actionRequiredCount,
  isLoading,
  onRefresh,
  onMarkAllAsRead,
  onClose,
}) => (
  <div className="flex items-center justify-between p-4 border-b border-[rgba(95,227,192,0.15)]">
    <div>
      <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2]">
        Notifications
      </h2>
      <p className="text-xs text-[#294050] dark:text-[#9FB4BE] mt-0.5">
        {unreadCount} unread{' '}
        {actionRequiredCount > 0 && `• ${actionRequiredCount} require action`}
      </p>
    </div>
    <div className="flex items-center space-x-2">
      <button
        onClick={onRefresh}
        className="p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE] rounded-lg hover:bg-[#D9E5E4] dark:hover:bg-[#11202B]"
        title="Refresh"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
      {unreadCount > 0 && (
        <button
          onClick={onMarkAllAsRead}
          className="text-xs text-[#294050] dark:text-[#F09988] hover:underline"
        >
          Mark all read
        </button>
      )}
      <button
        onClick={onClose}
        className="p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE] rounded-lg hover:bg-[#D9E5E4] dark:hover:bg-[#11202B]"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  </div>
)

/**
 * Loading state for notification list.
 */
const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
    <Loader2 className="w-12 h-12 text-[#647D8B] mb-3 animate-spin" />
    <p className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
      Loading notifications...
    </p>
  </div>
)

/**
 * Empty state when no notifications to show.
 */
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
    <CheckCircle className="w-12 h-12 text-[#647D8B] mb-3" />
    <p className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
      All caught up!
    </p>
    <p className="text-xs text-[#294050] dark:text-[#9FB4BE] mt-1">
      No notifications to show
    </p>
  </div>
)

interface NotificationListProps {
  notifications: NotificationData[]
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
  onResolve: (id: string) => void
  formatTimestamp: (timestamp: string) => string
  getSeverityStyles: (severity: NotificationSeverity) => string
}

/**
 * List of notification items.
 */
const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onMarkAsRead,
  onDismiss,
  onResolve,
  formatTimestamp,
  getSeverityStyles,
}) => (
  <div className="divide-y divide-[rgba(95,227,192,0.15)]">
    {notifications.map(notification => (
      <NotificationItem
        key={notification.id}
        notification={notification}
        onMarkAsRead={onMarkAsRead}
        onDismiss={onDismiss}
        onResolve={onResolve}
        formatTimestamp={formatTimestamp}
        getSeverityStyles={getSeverityStyles}
        getIcon={getNotificationIcon}
      />
    ))}
  </div>
)

/**
 * Panel footer with view all link.
 */
const PanelFooter: React.FC = () => (
  <div className="border-t border-[rgba(95,227,192,0.15)] p-4">
    <button className="w-full text-sm text-[#294050] dark:text-[#F09988] hover:underline">
      View all notifications
    </button>
  </div>
)

interface PanelBackdropProps {
  onClose: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

/**
 * Backdrop overlay for the sliding panel.
 */
const PanelBackdrop: React.FC<PanelBackdropProps> = ({
  onClose,
  onKeyDown,
}) => (
  <div
    className="fixed inset-0 bg-black/50 z-40"
    onClick={onClose}
    onKeyDown={onKeyDown}
    role="button"
    tabIndex={0}
    aria-label="Close notifications"
  />
)

// ============================================================================
// Main Component
// ============================================================================

/**
 * Sliding panel component that displays user notifications with filtering,
 * mark as read, dismiss, and resolve functionality.
 */
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
          if (notif.type === 'pending_approval') {
            return false
          }
        }
      }

      if (filter === 'all') return true

      const notifFilter = mapClassToFilter(notif.class)

      if (notif.type === 'pending_approval') {
        return filter === 'approval'
      }

      return notifFilter === filter
    })
  }, [notifications, userType, filter])

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
      info: 'bg-[#5FE3C0]/20 dark:bg-[#5FE3C0]/30 text-[#294050] dark:text-[#F09988]',
      warning:
        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      success:
        'bg-green-100 dark:bg-green-900/30 text-[#7a9b6f] dark:text-[#8faf84]',
      error: 'bg-red-100 dark:bg-red-900/30 text-[#E8836F] dark:text-[#F09988]',
    }
    return styles[severity]
  }, [])

  const handleMarkAsRead = useCallback(
    (id: string) => markAsRead(id),
    [markAsRead]
  )
  const handleDismiss = useCallback((id: string) => dismiss(id), [dismiss])
  const handleResolve = useCallback((id: string) => resolve(id), [resolve])
  const handleMarkAllAsRead = useCallback(
    () => markAllAsRead(),
    [markAllAsRead]
  )
  /**
   * Handles the refresh action.
   *
   * @returns void
   */
  const handleRefresh = useCallback(() => refresh(), [refresh])

  /**
   * Sets the notification filter to all notifications.
   *
   * @returns void
   */
  const handleFilterAll = useCallback(() => setFilter('all'), [])

  /**
   * Sets the notification filter to financial notifications.
   *
   * @returns void
   */
  const handleFilterFinancial = useCallback(() => setFilter('financial'), [])

  /**
   * Sets the notification filter to transactional notifications.
   *
   * @returns void
   */
  const handleFilterTransactional = useCallback(
    () => setFilter('transactional'),
    []
  )

  /**
   * Sets the notification filter to workflow notifications.
   *
   * @returns void
   */
  const handleFilterWorkflow = useCallback(() => setFilter('workflow'), [])

  /**
   * Sets the notification filter to approval notifications.
   *
   * @returns void
   */
  const handleFilterApproval = useCallback(() => setFilter('approval'), [])

  /**
   * Handles key down events on the backdrop to close the panel on Enter or Space key press.
   *
   * @param e React.KeyboardEvent keyboard event
   * @returns void
   */
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

  /**
   * Renders the content of the notifications panel based on loading state and filtered notifications.
   *
   * @returns JSX.Element|null The appropriate state component or notification list.
   */
  const renderContent = () => {
    if (isLoading) return <LoadingState />
    if (filteredNotifications.length === 0) return <EmptyState />
    return (
      <NotificationList
        notifications={filteredNotifications}
        onMarkAsRead={handleMarkAsRead}
        onDismiss={handleDismiss}
        onResolve={handleResolve}
        formatTimestamp={formatTimestamp}
        getSeverityStyles={getSeverityStyles}
      />
    )
  }

  return (
    <>
      <PanelBackdrop onClose={onClose} onKeyDown={handleBackdropKeyDown} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-[#F7FAFA] dark:bg-[#0C141B] shadow-xl z-50 overflow-hidden flex flex-col">
        <PanelHeader
          unreadCount={stats.unread}
          actionRequiredCount={stats.actionRequired}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClose={onClose}
        />
        <FilterTabs
          filter={filter}
          userType={userType}
          onAll={handleFilterAll}
          onFinancial={handleFilterFinancial}
          onTransactional={handleFilterTransactional}
          onWorkflow={handleFilterWorkflow}
          onApproval={handleFilterApproval}
        />
        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
        <PanelFooter />
      </div>
    </>
  )
}

export default NotificationsPanel
