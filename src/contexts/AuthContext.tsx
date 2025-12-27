/**
 * Authentication Context
 * Manages user authentication state and provides auth operations across the application
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
import {
  authService,
  isAuthenticated as checkIsAuthenticated,
  withAutoRefresh,
  type AuthUser,
  type LoginCredentials,
  type RegisterInput,
  type UpdateUserInput,
  type ChangePasswordInput,
  type ProfileWithRole,
} from '../services/auth'
import type {
  Permission,
  UserRole,
  AuthResponse,
  UserStatus,
} from '../types/auth'
import { hasPermission, ROLE_PERMISSIONS, parseAuthError } from '../types/auth'

/**
 * Backend user response type (differs slightly from frontend AuthUser)
 * The backend may return display_name instead of name
 */
interface BackendUser {
  id: string
  email: string
  display_name?: string
  name?: string
  status: UserStatus
  email_verified?: boolean
  two_factor_enabled?: boolean
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

interface AuthContextType {
  // State
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  userProfiles: ProfileWithRole[]
  currentProfileRole: UserRole | null

  // Authentication actions
  login: (credentials: LoginCredentials) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  setAuthFromWallet: (response: AuthResponse) => Promise<void>

  // User management
  updateUser: (input: UpdateUserInput) => Promise<void>
  changePassword: (input: ChangePasswordInput) => Promise<void>

  // Permission helpers
  hasPermission: (permission: Permission) => boolean
  canAccessProfile: (profileId: string) => boolean
  getProfileRole: (profileId: string) => UserRole | null

  // Clear error
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Session ID storage key
const SESSION_ID_KEY = 'pacioli_session_id'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userProfiles, setUserProfiles] = useState<ProfileWithRole[]>([])
  const [currentProfileRole, setCurrentProfileRole] = useState<UserRole | null>(
    null
  )

  // Ref to track if we're initializing
  const initializingRef = useRef(false)

  // Auto-refresh token interval
  const refreshIntervalRef = useRef<number | null>(null)

  // Initialize auth state on mount
  const initializeAuth = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (initializingRef.current) return
    initializingRef.current = true

    try {
      setIsLoading(true)
      setError(null)

      // Check if we have stored tokens
      if (!checkIsAuthenticated()) {
        setIsAuthenticated(false)
        setUser(null)
        setUserProfiles([])
        return
      }

      // Try to get current user with auto-refresh
      const currentUser = await withAutoRefresh(token =>
        authService.getCurrentUser(token)
      )
      setUser(currentUser)
      setIsAuthenticated(true)

      // Load user's profiles
      const profiles = await withAutoRefresh(token =>
        authService.getUserProfiles(token)
      )
      setUserProfiles(profiles)

      // Set current profile role if we have a stored profile selection
      const storedProfileId = localStorage.getItem('currentProfileId')
      if (storedProfileId) {
        const currentProfileData = profiles.find(
          p => p.profile_id === storedProfileId
        )
        if (currentProfileData) {
          setCurrentProfileRole(currentProfileData.role)
        } else if (profiles.length > 0) {
          setCurrentProfileRole(profiles[0].role)
        }
      } else if (profiles.length > 0) {
        setCurrentProfileRole(profiles[0].role)
      }
    } catch (err) {
      console.error('[AuthContext] Failed to initialize auth:', err)
      // Clear auth state on initialization failure
      authService.clearTokens()
      setIsAuthenticated(false)
      setUser(null)
      setUserProfiles([])
    } finally {
      setIsLoading(false)
      initializingRef.current = false
    }
  }, [])

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Setup token refresh interval
  useEffect(() => {
    // Clear any existing interval first
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    // Only set up refresh interval when authenticated
    if (isAuthenticated) {
      // Refresh token every 10 minutes (access tokens last 15 minutes)
      refreshIntervalRef.current = window.setInterval(
        async () => {
          if (authService.isTokenExpired()) {
            try {
              await authService.refreshToken()
            } catch {
              // If refresh fails, log out
              authService.clearTokens()
              setIsAuthenticated(false)
              setUser(null)
              setUserProfiles([])
            }
          }
        },
        10 * 60 * 1000
      )
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [isAuthenticated])

  // Update current profile role when profile selection changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentProfileId' && e.newValue) {
        const profile = userProfiles.find(p => p.profile_id === e.newValue)
        if (profile) {
          setCurrentProfileRole(profile.role)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [userProfiles])

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await authService.login(credentials)

        // Store session ID for logout
        localStorage.setItem(SESSION_ID_KEY, response.user.id)

        setUser(response.user)
        setIsAuthenticated(true)

        // Load user's profiles
        const profiles = await authService.getUserProfiles(
          response.access_token
        )
        setUserProfiles(profiles)

        if (profiles.length > 0) {
          setCurrentProfileRole(profiles[0].role)
        }
      } catch (err) {
        const authError = parseAuthError(err)
        setError(authError.message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const register = useCallback(async (input: RegisterInput): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await authService.register(input)

      // Store session ID for logout
      localStorage.setItem(SESSION_ID_KEY, response.user.id)

      setUser(response.user)
      setIsAuthenticated(true)
      setUserProfiles([])
      setCurrentProfileRole(null)
    } catch (err) {
      const authError = parseAuthError(err)
      setError(authError.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setAuthFromWallet = useCallback(
    async (response: AuthResponse): Promise<void> => {
      try {
        setIsLoading(true)
        setError(null)

        // Store session ID for logout
        localStorage.setItem(SESSION_ID_KEY, response.user.id)

        // Convert the AuthUser type from wallet auth response
        // The backend returns User which has display_name, we map it to our AuthUser format
        const backendUser = response.user as unknown as BackendUser
        const user: AuthUser = {
          id: backendUser.id,
          email: backendUser.email,
          name: backendUser.display_name || backendUser.name || 'Wallet User',
          status: backendUser.status,
          email_verified: backendUser.email_verified ?? false,
          two_factor_enabled: backendUser.two_factor_enabled ?? false,
          failed_login_attempts: 0,
          locked_until: null,
          created_at: backendUser.created_at,
          updated_at: backendUser.updated_at,
          last_login_at: backendUser.last_login_at || null,
        }

        setUser(user)
        setIsAuthenticated(true)

        // Load user's profiles
        const profiles = await authService.getUserProfiles(
          response.access_token
        )
        setUserProfiles(profiles)

        if (profiles.length > 0) {
          setCurrentProfileRole(profiles[0].role)
        }
      } catch (err) {
        const authError = parseAuthError(err)
        setError(authError.message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)

      const sessionId = localStorage.getItem(SESSION_ID_KEY)
      if (sessionId) {
        await authService.logout(sessionId)
      } else {
        authService.clearTokens()
      }

      localStorage.removeItem(SESSION_ID_KEY)
    } catch (err) {
      console.error('[AuthContext] Logout error:', err)
      // Still clear local state even if server logout fails
      authService.clearTokens()
      localStorage.removeItem(SESSION_ID_KEY)
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      setUserProfiles([])
      setCurrentProfileRole(null)
      setError(null)
      setIsLoading(false)
    }
  }, [])

  const refreshAuth = useCallback(async (): Promise<void> => {
    await initializeAuth()
  }, [initializeAuth])

  const updateUser = useCallback(
    async (input: UpdateUserInput): Promise<void> => {
      try {
        setError(null)

        const updatedUser = await withAutoRefresh(token =>
          authService.updateUser(token, input)
        )
        setUser(updatedUser)
      } catch (err) {
        const authError = parseAuthError(err)
        setError(authError.message)
        throw err
      }
    },
    []
  )

  const changePassword = useCallback(
    async (input: ChangePasswordInput): Promise<void> => {
      try {
        setError(null)

        await withAutoRefresh(token => authService.changePassword(token, input))
      } catch (err) {
        const authError = parseAuthError(err)
        setError(authError.message)
        throw err
      }
    },
    []
  )

  const hasPermissionCheck = useCallback(
    (permission: Permission): boolean => {
      return hasPermission(currentProfileRole, permission)
    },
    [currentProfileRole]
  )

  const canAccessProfile = useCallback(
    (profileId: string): boolean => {
      return userProfiles.some(p => p.profile_id === profileId)
    },
    [userProfiles]
  )

  const getProfileRole = useCallback(
    (profileId: string): UserRole | null => {
      const profile = userProfiles.find(p => p.profile_id === profileId)
      return profile?.role ?? null
    },
    [userProfiles]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        userProfiles,
        currentProfileRole,
        login,
        register,
        logout,
        refreshAuth,
        setAuthFromWallet,
        updateUser,
        changePassword,
        hasPermission: hasPermissionCheck,
        canAccessProfile,
        getProfileRole,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Re-export permission utilities for convenience
export { hasPermission, ROLE_PERMISSIONS }
export type { Permission }
