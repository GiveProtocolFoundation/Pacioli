/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { notificationService } from '../services/notification/notificationService'
import type {
  Notification,
  NotificationStats,
  NotificationPreferences,
  NotificationQuery,
  NotificationPage,
  CreateNotificationInput,
} from '../types/notification'

interface NotificationContextType {
  // State
  notifications: Notification[]
  stats: NotificationStats
  preferences: NotificationPreferences
  isLoading: boolean
  error: string | null

  // Query methods
  getNotifications: (query?: NotificationQuery) => Promise<NotificationPage>
  getNotification: (id: string) => Promise<Notification | null>

  // Mutation methods
  createNotification: (input: CreateNotificationInput) => Promise<Notification>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismiss: (id: string) => Promise<void>
  dismissAll: () => Promise<void>
  resolve: (id: string) => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>

  // Preferences methods
  updatePreferences: (
    updates: Partial<NotificationPreferences>
  ) => Promise<void>
  resetPreferences: () => Promise<void>

  // Refresh method
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
)

const defaultStats: NotificationStats = {
  total: 0,
  unread: 0,
  actionRequired: 0,
  byClass: {
    data_integrity: 0,
    actionable_events: 0,
    financial_health: 0,
  },
  bySeverity: {
    info: 0,
    warning: 0,
    success: 0,
    error: 0,
  },
}

const defaultPreferences: NotificationPreferences = {
  id: 'user_preferences',
  enabled: true,
  soundEnabled: false,
  classSettings: {
    data_integrity: { enabled: true, minimumSeverity: 'warning' },
    actionable_events: { enabled: true, minimumSeverity: 'info' },
    financial_health: { enabled: true, minimumSeverity: 'warning' },
  },
  thresholds: {
    largeValueUsd: 10000,
    lowLiquidityUsd: 1000,
    confidenceThreshold: 0.7,
  },
  updatedAt: new Date().toISOString(),
}

export const NotificationProvider: React.FC<{
  children: ReactNode
}> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats>(defaultStats)
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Initialize the service
      await notificationService.init()

      // Load notifications, stats, and preferences in parallel
      const [notifResult, statsResult, prefsResult] = await Promise.all([
        notificationService.getAll({ dismissed: false, limit: 100 }),
        notificationService.getStats(),
        notificationService.getPreferences(),
      ])

      setNotifications(notifResult.notifications)
      setStats(statsResult)
      setPreferences(prefsResult)
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Subscribe to notification events
  useEffect(() => {
    loadData()

    // Subscribe to real-time updates
    const unsubscribe = notificationService.subscribe(() => {
      // Refresh data when any notification event occurs
      loadData()
    })

    return () => {
      unsubscribe()
    }
  }, [loadData])

  // Query methods
  const getNotifications = useCallback(
    async (query?: NotificationQuery): Promise<NotificationPage> => {
      return notificationService.getAll(query)
    },
    []
  )

  const getNotification = useCallback(
    async (id: string): Promise<Notification | null> => {
      return notificationService.get(id)
    },
    []
  )

  // Mutation methods
  const createNotification = useCallback(
    async (input: CreateNotificationInput): Promise<Notification> => {
      const notification = await notificationService.create(input)
      // Data will be refreshed via subscription
      return notification
    },
    []
  )

  const markAsRead = useCallback(async (id: string): Promise<void> => {
    await notificationService.markAsRead(id)
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
    setStats(prev => ({
      ...prev,
      unread: Math.max(0, prev.unread - 1),
    }))
  }, [])

  const markAllAsRead = useCallback(async (): Promise<void> => {
    await notificationService.markAllAsRead()
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setStats(prev => ({ ...prev, unread: 0 }))
  }, [])

  const dismiss = useCallback(async (id: string): Promise<void> => {
    await notificationService.dismiss(id)
    // Optimistic update - remove from list
    setNotifications(prev => prev.filter(n => n.id !== id))
    setStats(prev => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
    }))
  }, [])

  const dismissAll = useCallback(async (): Promise<void> => {
    await notificationService.dismissAll()
    // Optimistic update
    setNotifications([])
    setStats(defaultStats)
  }, [])

  const resolve = useCallback(async (id: string): Promise<void> => {
    await notificationService.resolve(id)
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, resolved: true, read: true } : n))
    )
    setStats(prev => ({
      ...prev,
      actionRequired: Math.max(0, prev.actionRequired - 1),
      unread: Math.max(0, prev.unread - 1),
    }))
  }, [])

  const deleteNotification = useCallback(async (id: string): Promise<void> => {
    await notificationService.delete(id)
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(async (): Promise<void> => {
    await notificationService.clearAll()
    setNotifications([])
    setStats(defaultStats)
  }, [])

  // Preferences methods
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>): Promise<void> => {
      const updated = await notificationService.updatePreferences(updates)
      setPreferences(updated)
    },
    []
  )

  const resetPreferences = useCallback(async (): Promise<void> => {
    await notificationService.resetPreferences()
    const prefs = await notificationService.getPreferences()
    setPreferences(prefs)
  }, [])

  // Refresh method
  const refresh = useCallback(async (): Promise<void> => {
    await loadData()
  }, [loadData])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        stats,
        preferences,
        isLoading,
        error,
        getNotifications,
        getNotification,
        createNotification,
        markAsRead,
        markAllAsRead,
        dismiss,
        dismissAll,
        resolve,
        deleteNotification,
        clearAll,
        updatePreferences,
        resetPreferences,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    )
  }
  return context
}

/**
 * Hook for just the unread count (for badge displays)
 */
export const useUnreadCount = () => {
  const { stats } = useNotifications()
  return stats.unread
}

/**
 * Hook for action required count
 */
export const useActionRequiredCount = () => {
  const { stats } = useNotifications()
  return stats.actionRequired
}
