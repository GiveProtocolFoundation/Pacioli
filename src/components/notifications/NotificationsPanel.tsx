import React, { useState, useCallback } from 'react'
import {
  X,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Receipt,
  Wallet,
  Users,
  FileText,
  ArrowRight,
  Check,
  XCircle,
} from 'lucide-react'

interface Notification {
  id: string
  type: 'financial' | 'transactional' | 'workflow' | 'approval'
  title: string
  message: string
  timestamp: string
  read: boolean
  severity: 'info' | 'warning' | 'success' | 'error'
  icon: React.ElementType
  actionRequired?: boolean
}

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  userType: 'individual' | 'organization'
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  formatTimestamp: (timestamp: string) => string
  getSeverityStyles: (severity: Notification['severity']) => string
}

const NotificationActions: React.FC = () => (
  <div className="flex items-center space-x-2">
    <button className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded">
      <Check className="w-4 h-4" />
    </button>
    <button className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
      <X className="w-4 h-4" />
    </button>
    <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center">
      View
      <ArrowRight className="w-3 h-3 ml-1" />
    </button>
  </div>
)

const NotificationBody: React.FC<{
  notification: NotificationItemProps['notification']
  formatTimestamp: NotificationItemProps['formatTimestamp']
}> = ({ notification, formatTimestamp }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {notification.title}
          {!notification.read && (
            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full ml-2" />
          )}
        </p>
        <p className="text-xs text-gray-600 dark:text-[#94a3b8] mt-1">
          {notification.message}
        </p>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2">
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {formatTimestamp(notification.timestamp)}
      </span>
      {notification.actionRequired && <NotificationActions />}
    </div>
  </div>
)

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  formatTimestamp,
  getSeverityStyles,
}) => {
  const Icon = notification.icon
  const handleClick = useCallback(() => {
    onMarkAsRead(notification.id)
  }, [onMarkAsRead, notification.id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onMarkAsRead(notification.id)
      }
    },
    [onMarkAsRead, notification.id]
  )

  return (
    <div
      key={notification.id}
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
        !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
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
        />
      </div>
    </div>
  )
}

const mockNotifications: Notification[] = [
  // Financial Alerts
  {
    id: '1',
    type: 'financial',
    title: 'Large Transaction Detected',
    message:
      'A transaction of $25,000 was recorded in account "Treasury Wallet"',
    timestamp: '2025-10-18T02:30:00Z',
    read: false,
    severity: 'warning',
    icon: AlertTriangle,
  },
  {
    id: '2',
    type: 'financial',
    title: 'Monthly Revenue Target Met',
    message: 'Your organization has reached 100% of the monthly revenue goal',
    timestamp: '2025-10-18T01:15:00Z',
    read: false,
    severity: 'success',
    icon: TrendingUp,
  },
  {
    id: '3',
    type: 'financial',
    title: 'Low Balance Warning',
    message: 'Operating account balance is below $5,000 threshold',
    timestamp: '2025-10-17T18:45:00Z',
    read: true,
    severity: 'warning',
    icon: DollarSign,
  },

  // Transactional Alerts
  {
    id: '4',
    type: 'transactional',
    title: 'Staking Rewards Received',
    message: '12.5 DOT staking rewards received in Polkadot Staking Wallet',
    timestamp: '2025-10-18T00:00:00Z',
    read: false,
    severity: 'success',
    icon: Wallet,
  },
  {
    id: '5',
    type: 'transactional',
    title: 'Transaction Failed',
    message: 'Transaction #TX-2847 failed due to insufficient gas fees',
    timestamp: '2025-10-17T22:10:00Z',
    read: true,
    severity: 'error',
    icon: XCircle,
  },
  {
    id: '6',
    type: 'transactional',
    title: 'New Donation Received',
    message: '$500 donation received from John Doe',
    timestamp: '2025-10-17T16:20:00Z',
    read: true,
    severity: 'success',
    icon: Receipt,
  },

  // Workflow Requests (Organization only)
  {
    id: '7',
    type: 'workflow',
    title: 'Invoice Awaiting Review',
    message: 'Invoice #INV-2847 from Acme Corp needs review before payment',
    timestamp: '2025-10-18T03:00:00Z',
    read: false,
    severity: 'info',
    icon: FileText,
    actionRequired: true,
  },
  {
    id: '8',
    type: 'workflow',
    title: 'Report Generation Complete',
    message: 'Q3 Financial Report is ready for download',
    timestamp: '2025-10-17T20:30:00Z',
    read: false,
    severity: 'info',
    icon: FileText,
  },

  // Approval Requests (Organization only)
  {
    id: '9',
    type: 'approval',
    title: 'Expense Approval Required',
    message: 'Sarah Johnson submitted expense report for $2,450.50',
    timestamp: '2025-10-18T02:00:00Z',
    read: false,
    severity: 'info',
    icon: Users,
    actionRequired: true,
  },
  {
    id: '10',
    type: 'approval',
    title: 'Budget Approval Needed',
    message: 'Q4 Marketing budget proposal requires your approval',
    timestamp: '2025-10-17T14:00:00Z',
    read: false,
    severity: 'info',
    icon: DollarSign,
    actionRequired: true,
  },
]

const FilterTabs: React.FC<{
  filter: 'all' | 'financial' | 'transactional' | 'workflow' | 'approval'
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
  <div className="flex items-center space-x-2 p-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
    <button
      onClick={onAll}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filter === 'all'
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      All
    </button>
    <button
      onClick={onFinancial}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filter === 'financial'
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      Financial
    </button>
    <button
      onClick={onTransactional}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filter === 'transactional'
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-200 dark:hover:bg-gray-700'
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
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Workflow
        </button>
        <button
          onClick={onApproval}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            filter === 'approval'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-200 dark:hover:bg-gray-700'
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
  const [filter, setFilter] = useState<
    'all' | 'financial' | 'transactional' | 'workflow' | 'approval'
  >('all')
  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications)

  // Filter notifications based on user type and selected filter
  const filteredNotifications = notifications.filter(notif => {
    // For individuals, don't show workflow or approval notifications
    if (
      userType === 'individual' &&
      (notif.type === 'workflow' || notif.type === 'approval')
    ) {
      return false
    }
    // Apply selected filter
    if (filter === 'all') return true
    return notif.type === filter
  })

  const unreadCount = filteredNotifications.filter(n => !n.read).length
  const actionRequiredCount = filteredNotifications.filter(
    n => n.actionRequired
  ).length

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

  const getSeverityStyles = useCallback(
    (severity: Notification['severity']) => {
      const styles = {
        info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        warning:
          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
        success:
          'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
        error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      }
      return styles[severity]
    },
    []
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

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
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-0.5">
              {unreadCount} unread{' '}
              {actionRequiredCount > 0 &&
                `• ${actionRequiredCount} require action`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
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
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <CheckCircle className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                All caught up!
              </p>
              <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
                No notifications to show
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  formatTimestamp={formatTimestamp}
                  getSeverityStyles={getSeverityStyles}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <button className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline">
            View all notifications
          </button>
        </div>
      </div>
    </>
  )
}

export default NotificationsPanel
