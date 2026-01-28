/**
 * Notification Service
 * Manages notification CRUD operations, storage, and real-time subscriptions
 */

import { indexedDBService } from '../database/indexedDBService'
import type {
  Notification,
  NotificationPreferences,
  NotificationQuery,
  NotificationPage,
  NotificationStats,
  NotificationEvent,
  NotificationSubscriber,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationSeverity,
} from '../../types/notification'
import { getDefaultPriority } from '../../types/notification'

/**
 * Generate a unique notification ID
 */
function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * NotificationService class
 * Singleton service for managing notifications
 */
class NotificationService {
  private subscribers: Set<NotificationSubscriber> = new Set()
  private initialized = false

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.initialized) return
    await indexedDBService.init()
    this.initialized = true
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init()
    }
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  /**
   * Subscribe to notification events
   */
  subscribe(callback: NotificationSubscriber): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Emit an event to all subscribers
   */
  private emit(event: NotificationEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('Notification subscriber error:', error)
      }
    })
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new notification
   */
  async create(input: CreateNotificationInput): Promise<Notification> {
    await this.ensureInit()

    // Check preferences to see if this notification should be created
    const preferences = await this.getPreferences()
    if (!this.shouldCreateNotification(input, preferences)) {
      // Return a "silent" notification that won't be persisted
      const silentNotification: Notification = {
        id: 'silent',
        ...input,
        read: true,
        dismissed: true,
        resolved: false,
        actionRequired: input.actionRequired ?? false,
        priority:
          input.priority ?? getDefaultPriority(input.type, input.severity),
        createdAt: new Date().toISOString(),
      }
      return silentNotification
    }

    const notification: Notification = {
      id: generateNotificationId(),
      ...input,
      read: false,
      dismissed: false,
      resolved: false,
      actionRequired: input.actionRequired ?? false,
      priority:
        input.priority ?? getDefaultPriority(input.type, input.severity),
      createdAt: new Date().toISOString(),
    }

    await indexedDBService.saveNotification(notification)

    this.emit({
      type: 'notification_created',
      notification,
      timestamp: new Date().toISOString(),
    })

    return notification
  }

  /**
   * Create multiple notifications (batch)
   */
  async createMany(inputs: CreateNotificationInput[]): Promise<Notification[]> {
    await this.ensureInit()

    const preferences = await this.getPreferences()
    const notifications: Notification[] = []

    for (const input of inputs) {
      if (this.shouldCreateNotification(input, preferences)) {
        const notification: Notification = {
          id: generateNotificationId(),
          ...input,
          read: false,
          dismissed: false,
          resolved: false,
          actionRequired: input.actionRequired ?? false,
          priority:
            input.priority ?? getDefaultPriority(input.type, input.severity),
          createdAt: new Date().toISOString(),
        }
        notifications.push(notification)
      }
    }

    if (notifications.length > 0) {
      await indexedDBService.saveNotifications(notifications)

      this.emit({
        type: 'notification_created',
        notifications,
        timestamp: new Date().toISOString(),
      })
    }

    return notifications
  }

  /**
   * Get a notification by ID
   */
  async get(id: string): Promise<Notification | null> {
    await this.ensureInit()
    return indexedDBService.getNotification(id)
  }

  /**
   * Get notifications with filtering and pagination
   */
  async getAll(query: NotificationQuery = {}): Promise<NotificationPage> {
    await this.ensureInit()
    // By default, don't show dismissed notifications
    const defaultQuery: NotificationQuery = {
      dismissed: false,
      ...query,
    }
    return indexedDBService.getNotifications(defaultQuery)
  }

  /**
   * Get unread notifications
   */
  async getUnread(): Promise<Notification[]> {
    const result = await this.getAll({ read: false, dismissed: false })
    return result.notifications
  }

  /**
   * Get notifications requiring action
   */
  async getActionRequired(): Promise<Notification[]> {
    const result = await this.getAll({
      actionRequired: true,
      resolved: false,
      dismissed: false,
    })
    return result.notifications
  }

  /**
   * Update a notification
   */
  async update(
    id: string,
    updates: UpdateNotificationInput
  ): Promise<Notification | null> {
    await this.ensureInit()

    const notification = await indexedDBService.updateNotification(id, updates)

    if (notification) {
      this.emit({
        type: 'notification_updated',
        notification,
        timestamp: new Date().toISOString(),
      })
    }

    return notification
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<Notification | null> {
    return this.update(id, { read: true })
  }

  /**
   * Mark multiple notifications as read
   */
  async markManyAsRead(ids: string[]): Promise<void> {
    await this.ensureInit()
    for (const id of ids) {
      await this.markAsRead(id)
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await this.ensureInit()
    await indexedDBService.markAllNotificationsAsRead()

    this.emit({
      type: 'notification_updated',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Dismiss a notification
   */
  async dismiss(id: string): Promise<Notification | null> {
    return this.update(id, { dismissed: true })
  }

  /**
   * Dismiss all notifications
   */
  async dismissAll(): Promise<void> {
    await this.ensureInit()
    await indexedDBService.dismissAllNotifications()

    this.emit({
      type: 'notification_updated',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Resolve a notification (mark as addressed/handled)
   */
  async resolve(id: string): Promise<Notification | null> {
    return this.update(id, { resolved: true, read: true })
  }

  /**
   * Delete a notification
   */
  async delete(id: string): Promise<void> {
    await this.ensureInit()
    await indexedDBService.deleteNotification(id)

    this.emit({
      type: 'notification_deleted',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    await this.ensureInit()
    await indexedDBService.clearNotifications()

    this.emit({
      type: 'notifications_cleared',
      timestamp: new Date().toISOString(),
    })
  }

  // ==================== STATISTICS ====================

  /**
   * Get notification statistics
   */
  async getStats(): Promise<NotificationStats> {
    await this.ensureInit()

    const { notifications } = await this.getAll({
      dismissed: false,
      limit: 10000,
    })

    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      actionRequired: notifications.filter(n => n.actionRequired && !n.resolved)
        .length,
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

    for (const notification of notifications) {
      stats.byClass[notification.class]++
      stats.bySeverity[notification.severity]++
    }

    return stats
  }

  // ==================== PREFERENCES ====================

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    await this.ensureInit()
    return indexedDBService.getNotificationPreferences()
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    await this.ensureInit()
    const current = await this.getPreferences()
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await indexedDBService.saveNotificationPreferences(updated)
    return updated
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(): Promise<void> {
    await this.ensureInit()
    await indexedDBService.resetNotificationPreferences()
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if a notification should be created based on preferences
   */
  private shouldCreateNotification(
    input: CreateNotificationInput,
    preferences: NotificationPreferences
  ): boolean {
    // Global toggle
    if (!preferences.enabled) {
      return false
    }

    // Class-specific toggle
    const classSettings = preferences.classSettings[input.class]
    if (!classSettings?.enabled) {
      return false
    }

    // Severity threshold check
    const severityOrder: NotificationSeverity[] = [
      'info',
      'warning',
      'success',
      'error',
    ]
    const inputSeverityIndex = severityOrder.indexOf(input.severity)
    const minSeverityIndex = severityOrder.indexOf(
      classSettings.minimumSeverity
    )

    // Only filter out info if minimum is higher
    if (input.severity === 'info' && classSettings.minimumSeverity !== 'info') {
      return false
    }

    // Error severity should always pass
    if (input.severity === 'error') {
      return true
    }

    // Warning passes if minimum is warning or lower
    if (
      input.severity === 'warning' &&
      (classSettings.minimumSeverity === 'warning' ||
        classSettings.minimumSeverity === 'info')
    ) {
      return true
    }

    // Success notifications are treated like info for filtering
    if (input.severity === 'success') {
      return classSettings.minimumSeverity === 'info'
    }

    return inputSeverityIndex >= minSeverityIndex
  }

  /**
   * Check for existing notification with same groupKey to avoid duplicates
   */
  async findByGroupKey(groupKey: string): Promise<Notification | null> {
    await this.ensureInit()
    const { notifications } = await this.getAll({
      dismissed: false,
      resolved: false,
      limit: 1000,
    })
    return notifications.find(n => n.groupKey === groupKey) || null
  }

  /**
   * Create or update a notification by groupKey (upsert behavior)
   */
  async upsertByGroupKey(
    input: CreateNotificationInput & { groupKey: string }
  ): Promise<Notification> {
    const existing = await this.findByGroupKey(input.groupKey)

    if (existing) {
      // Update existing notification
      const updated = await this.update(existing.id, {
        read: false, // Mark as unread again since it's updated
      })
      return updated || existing
    }

    // Create new notification
    return this.create(input)
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
