/* eslint-disable react-refresh/only-export-components */
/**
 * App Context
 * Manages application-level state including initialization, security modes,
 * session timeout, and password protection for the offline-first storage layer.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
import { storage, type AppState } from '../services/storage'
import type { SecurityMode } from '../i18n'

interface AppContextType {
  // App state
  appState: AppState
  isLoading: boolean
  error: string | null
  isFirstLaunch: boolean

  // Security mode
  securityMode: SecurityMode
  sessionTimeoutMinutes: number
  sessionExpired: boolean

  // Password protection
  hasPassword: boolean
  isUnlocking: boolean

  // Actions
  unlock: (password: string) => Promise<boolean>
  lock: () => Promise<void>
  setPassword: (password: string) => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>
  removePassword: (currentPassword: string) => Promise<void>
  validatePassword: (password: string) => Promise<string | null>
  refreshAppState: () => Promise<void>
  completeFirstLaunch: () => void
  recordActivity: () => void

  // Reset (danger zone)
  resetApp: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// Default session timeout in minutes
const DEFAULT_SESSION_TIMEOUT = 15

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [appState, setAppState] = useState<AppState>('Uninitialized')
  const [hasPassword, setHasPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)
  const [securityMode, setSecurityMode] = useState<SecurityMode>('easy')
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(DEFAULT_SESSION_TIMEOUT)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Activity tracking for session timeout
  const lastActivityRef = useRef<number>(Date.now())
  const timeoutCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Record user activity (call this on user interactions)
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    // Clear session expired flag on activity
    if (sessionExpired) {
      setSessionExpired(false)
    }
  }, [sessionExpired])

  // Check for session timeout (secure_plus mode only)
  const checkSessionTimeout = useCallback(() => {
    if (securityMode !== 'secure_plus' || appState !== 'Unlocked') {
      return
    }

    const now = Date.now()
    const lastActivity = lastActivityRef.current
    const timeoutMs = sessionTimeoutMinutes * 60 * 1000

    if (now - lastActivity > timeoutMs) {
      console.log('[AppContext] Session timed out due to inactivity')
      setSessionExpired(true)
      setAppState('Locked')
    }
  }, [securityMode, sessionTimeoutMinutes, appState])

  // Set up session timeout checker
  useEffect(() => {
    if (securityMode === 'secure_plus' && appState === 'Unlocked') {
      // Check every minute
      timeoutCheckIntervalRef.current = setInterval(checkSessionTimeout, 60000)

      // Also check immediately
      checkSessionTimeout()

      return () => {
        if (timeoutCheckIntervalRef.current) {
          clearInterval(timeoutCheckIntervalRef.current)
        }
      }
    }
  }, [securityMode, appState, checkSessionTimeout])

  // Set up global activity listeners for secure_plus mode
  useEffect(() => {
    if (securityMode !== 'secure_plus' || appState !== 'Unlocked') {
      return
    }

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']

    const handleActivity = () => {
      recordActivity()
    }

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [securityMode, appState, recordActivity])

  // Initialize the app on mount
  const initializeApp = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Ensure storage is initialized
      const initResult = await storage.ensureInitialized()
      console.log('[AppContext] Initialization result:', initResult)

      // Check if setup is complete
      const setupComplete = await storage.getSetting('setup_complete')
      if (!setupComplete) {
        // First launch - show wizard
        setIsFirstLaunch(true)
        setIsLoading(false)
        return
      }

      // Load security mode
      const savedMode = await storage.getSetting('security_mode')
      if (savedMode === 'easy' || savedMode === 'secure' || savedMode === 'secure_plus') {
        setSecurityMode(savedMode)
      }

      // Load session timeout for secure_plus mode
      const savedTimeout = await storage.getSetting('session_timeout_minutes')
      if (savedTimeout) {
        const timeout = parseInt(savedTimeout, 10)
        if (!isNaN(timeout) && timeout > 0) {
          setSessionTimeoutMinutes(timeout)
        }
      }

      // Get current app state
      const state = await storage.getAppState()

      // Check if password is set
      const passwordSet = await storage.hasPassword()
      setHasPassword(passwordSet)

      // Determine initial app state based on security mode
      if (savedMode === 'easy') {
        // Easy mode - always unlocked
        setAppState('Unlocked')
      } else if (passwordSet) {
        // Secure or Secure+ mode with password - start locked
        setAppState('Locked')
      } else {
        // Has security mode but no password (shouldn't happen normally)
        setAppState(state)
      }
    } catch (err) {
      console.error('[AppContext] Initialization failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize app')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  const completeFirstLaunch = useCallback(() => {
    setIsFirstLaunch(false)
    // Reload to pick up new settings
    initializeApp()
  }, [initializeApp])

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    try {
      setIsUnlocking(true)
      setError(null)

      const success = await storage.unlock(password)

      if (success) {
        setAppState('Unlocked')
        setSessionExpired(false)
        // Reset activity timer on unlock
        lastActivityRef.current = Date.now()
      } else {
        setError('Incorrect password')
      }

      return success
    } catch (err) {
      console.error('[AppContext] Unlock failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to unlock')
      return false
    } finally {
      setIsUnlocking(false)
    }
  }, [])

  const lock = useCallback(async (): Promise<void> => {
    try {
      await storage.lock()

      // Only set to Locked if not easy mode
      if (securityMode !== 'easy' && hasPassword) {
        setAppState('Locked')
      }
    } catch (err) {
      console.error('[AppContext] Lock failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to lock')
    }
  }, [hasPassword, securityMode])

  const setPassword = useCallback(async (password: string): Promise<void> => {
    try {
      setError(null)
      await storage.setPassword(password)
      setHasPassword(true)
    } catch (err) {
      console.error('[AppContext] Set password failed:', err)
      const message =
        err instanceof Error ? err.message : 'Failed to set password'
      setError(message)
      throw new Error(message)
    }
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      try {
        setError(null)
        await storage.changePassword(currentPassword, newPassword)
      } catch (err) {
        console.error('[AppContext] Change password failed:', err)
        const message =
          err instanceof Error ? err.message : 'Failed to change password'
        setError(message)
        throw new Error(message)
      }
    },
    []
  )

  const removePassword = useCallback(
    async (currentPassword: string): Promise<void> => {
      try {
        setError(null)
        await storage.removePassword(currentPassword)
        setHasPassword(false)
      } catch (err) {
        console.error('[AppContext] Remove password failed:', err)
        const message =
          err instanceof Error ? err.message : 'Failed to remove password'
        setError(message)
        throw new Error(message)
      }
    },
    []
  )

  const validatePassword = useCallback(
    async (password: string): Promise<string | null> => {
      try {
        await storage.validatePasswordStrength(password)
        return null
      } catch (err) {
        return err instanceof Error ? err.message : 'Invalid password'
      }
    },
    []
  )

  const refreshAppState = useCallback(async (): Promise<void> => {
    try {
      const state = await storage.getAppState()
      setAppState(state)

      const passwordSet = await storage.hasPassword()
      setHasPassword(passwordSet)

      // Reload security mode
      const savedMode = await storage.getSetting('security_mode')
      if (savedMode === 'easy' || savedMode === 'secure' || savedMode === 'secure_plus') {
        setSecurityMode(savedMode)
      }
    } catch (err) {
      console.error('[AppContext] Refresh state failed:', err)
    }
  }, [])

  const resetApp = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      await storage.resetApp()

      // Reset local state
      setIsFirstLaunch(true)
      setSecurityMode('easy')
      setHasPassword(false)
      setSessionExpired(false)
    } catch (err) {
      console.error('[AppContext] Reset failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset app')
      throw err
    }
  }, [])

  return (
    <AppContext.Provider
      value={{
        appState,
        isLoading,
        error,
        isFirstLaunch,
        securityMode,
        sessionTimeoutMinutes,
        sessionExpired,
        hasPassword,
        isUnlocking,
        unlock,
        lock,
        setPassword,
        changePassword,
        removePassword,
        validatePassword,
        refreshAppState,
        completeFirstLaunch,
        recordActivity,
        resetApp,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

/**
 * Hook to check if app is ready (initialized and unlocked)
 */
export const useAppReady = () => {
  const { appState, isLoading, isFirstLaunch } = useApp()
  return !isLoading && !isFirstLaunch && appState === 'Unlocked'
}
