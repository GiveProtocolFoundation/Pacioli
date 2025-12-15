/**
 * Authentication Service
 * Provides authentication operations via Tauri commands
 *
 * Usage:
 *   import { authService } from '@/services/auth'
 *   const response = await authService.login({ email, password })
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  AuthUser,
  AuthResponse,
  LoginCredentials,
  RegisterInput,
  UpdateUserInput,
  ChangePasswordInput,
  TokenRefreshResponse,
  TokenVerifyResponse,
  Session,
  ProfileWithRole,
  ProfileUser,
  Invitation,
  CreateInvitationInput,
  UserRole,
} from '../../types/auth'

// =============================================================================
// TOKEN STORAGE
// =============================================================================

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'pacioli_access_token',
  REFRESH_TOKEN: 'pacioli_refresh_token',
  TOKEN_EXPIRES: 'pacioli_token_expires',
} as const

/**
 * Store tokens in localStorage
 */
function storeTokens(accessToken: string, refreshToken: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken)
  localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken)
  localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, expiresAt)
}

/**
 * Clear tokens from localStorage
 */
function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.TOKEN_EXPIRES)
}

/**
 * Get stored access token
 */
function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
}

/**
 * Get stored refresh token
 */
function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN)
}

/**
 * Check if access token is expired
 */
function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(TOKEN_KEYS.TOKEN_EXPIRES)
  if (!expiresAt) return true

  const expiry = new Date(expiresAt)
  const now = new Date()
  // Add 60 second buffer for network latency
  return now.getTime() >= expiry.getTime() - 60000
}

// =============================================================================
// AUTH SERVICE
// =============================================================================

/**
 * Authentication service interface
 */
export interface AuthService {
  // Token management
  getAccessToken(): string | null
  getRefreshToken(): string | null
  isTokenExpired(): boolean
  clearTokens(): void

  // Authentication
  register(input: RegisterInput): Promise<AuthResponse>
  login(credentials: LoginCredentials): Promise<AuthResponse>
  logout(sessionId: string): Promise<void>
  refreshToken(): Promise<TokenRefreshResponse>
  verifyToken(token: string): Promise<TokenVerifyResponse>

  // User management
  getCurrentUser(token: string): Promise<AuthUser>
  updateUser(token: string, input: UpdateUserInput): Promise<AuthUser>
  changePassword(token: string, input: ChangePasswordInput): Promise<void>

  // Session management
  getUserSessions(token: string): Promise<Session[]>
  revokeSession(token: string, sessionId: string): Promise<void>
  revokeAllSessions(token: string): Promise<number>

  // Profile roles
  getUserProfiles(token: string): Promise<ProfileWithRole[]>
  getProfileUsers(token: string, profileId: string): Promise<ProfileUser[]>
  updateUserRole(token: string, profileId: string, userId: string, role: UserRole): Promise<void>
  removeUserFromProfile(token: string, profileId: string, userId: string): Promise<void>

  // Invitations
  createInvitation(token: string, input: CreateInvitationInput): Promise<Invitation>
  getProfileInvitations(token: string, profileId: string): Promise<Invitation[]>
  acceptInvitation(invitationToken: string, accessToken?: string): Promise<AuthResponse>
  revokeInvitation(token: string, invitationId: string): Promise<void>
}

/**
 * Tauri-based authentication service implementation
 */
export const authService: AuthService = {
  // Token management
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  clearTokens,

  // Authentication
  async register(input: RegisterInput): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('register', { input })
    storeTokens(response.access_token, response.refresh_token, response.expires_at)
    return response
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('login', { credentials })
    storeTokens(response.access_token, response.refresh_token, response.expires_at)
    return response
  },

  async logout(sessionId: string): Promise<void> {
    const token = getAccessToken()
    if (token) {
      try {
        await invoke('logout', { token, sessionId })
      } catch {
        // Ignore errors during logout - we clear tokens anyway
      }
    }
    clearTokens()
  },

  async refreshToken(): Promise<TokenRefreshResponse> {
    const refreshTokenValue = getRefreshToken()
    if (!refreshTokenValue) {
      throw new Error('No refresh token available')
    }

    const response = await invoke<TokenRefreshResponse>('refresh_token', {
      refreshToken: refreshTokenValue,
    })

    // Update only access token and expiry
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, response.access_token)
    localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, response.expires_at)

    return response
  },

  async verifyToken(token: string): Promise<TokenVerifyResponse> {
    return invoke<TokenVerifyResponse>('verify_token', { token })
  },

  // User management
  async getCurrentUser(token: string): Promise<AuthUser> {
    return invoke<AuthUser>('get_current_user', { token })
  },

  async updateUser(token: string, input: UpdateUserInput): Promise<AuthUser> {
    return invoke<AuthUser>('update_user', { token, name: input.name, email: input.email })
  },

  async changePassword(token: string, input: ChangePasswordInput): Promise<void> {
    return invoke('change_password', {
      token,
      currentPassword: input.current_password,
      newPassword: input.new_password,
    })
  },

  // Session management
  async getUserSessions(token: string): Promise<Session[]> {
    return invoke<Session[]>('get_user_sessions', { token })
  },

  async revokeSession(token: string, sessionId: string): Promise<void> {
    return invoke('revoke_session', { token, sessionId })
  },

  async revokeAllSessions(token: string): Promise<number> {
    return invoke<number>('revoke_all_sessions', { token })
  },

  // Profile roles
  async getUserProfiles(token: string): Promise<ProfileWithRole[]> {
    return invoke<ProfileWithRole[]>('get_user_profiles', { token })
  },

  async getProfileUsers(token: string, profileId: string): Promise<ProfileUser[]> {
    return invoke<ProfileUser[]>('get_profile_users', { token, profileId })
  },

  async updateUserRole(
    token: string,
    profileId: string,
    userId: string,
    role: UserRole
  ): Promise<void> {
    return invoke('update_user_role', { token, profileId, targetUserId: userId, newRole: role })
  },

  async removeUserFromProfile(token: string, profileId: string, userId: string): Promise<void> {
    return invoke('remove_user_from_profile', { token, profileId, targetUserId: userId })
  },

  // Invitations
  async createInvitation(token: string, input: CreateInvitationInput): Promise<Invitation> {
    return invoke<Invitation>('create_invitation', {
      token,
      profileId: input.profile_id,
      email: input.email,
      role: input.role,
    })
  },

  async getProfileInvitations(token: string, profileId: string): Promise<Invitation[]> {
    return invoke<Invitation[]>('get_profile_invitations', { token, profileId })
  },

  async acceptInvitation(invitationToken: string, accessToken?: string): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('accept_invitation', {
      invitationToken,
      accessToken: accessToken ?? null,
    })

    // Store new tokens if returned
    if (response.access_token) {
      storeTokens(response.access_token, response.refresh_token, response.expires_at)
    }

    return response
  },

  async revokeInvitation(token: string, invitationId: string): Promise<void> {
    return invoke('revoke_invitation', { token, invitationId })
  },
}

/**
 * Helper to auto-refresh token if needed before making authenticated request
 */
export async function withAutoRefresh<T>(
  authenticatedRequest: (token: string) => Promise<T>
): Promise<T> {
  const storedToken = getAccessToken()

  if (!storedToken) {
    throw new Error('Not authenticated')
  }

  // Refresh token if expired
  let token: string = storedToken
  if (isTokenExpired()) {
    try {
      const refreshed = await authService.refreshToken()
      token = refreshed.access_token
    } catch {
      clearTokens()
      throw new Error('Session expired. Please log in again.')
    }
  }

  return authenticatedRequest(token)
}

/**
 * Check if user is currently authenticated (has valid tokens)
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken()
  const refreshTokenValue = getRefreshToken()

  // Must have at least refresh token
  if (!refreshTokenValue) return false

  // If access token exists and not expired, we're authenticated
  if (token && !isTokenExpired()) return true

  // If access token is expired but we have refresh token, we're still "authenticated"
  // (will need to refresh before making requests)
  return !!refreshTokenValue
}

// Re-export types
export type {
  AuthUser,
  AuthResponse,
  LoginCredentials,
  RegisterInput,
  UpdateUserInput,
  ChangePasswordInput,
  TokenRefreshResponse,
  TokenVerifyResponse,
  Session,
  ProfileWithRole,
  ProfileUser,
  Invitation,
  CreateInvitationInput,
}
