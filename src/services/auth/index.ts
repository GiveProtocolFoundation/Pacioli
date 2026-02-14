/**
 * Authentication Service
 * Provides authentication operations with automatic Tauri/browser detection
 *
 * Usage:
 *   import { authService } from '@/services/auth'
 *   const response = await authService.login({ email, password })
 */

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
  EmailChangeResponse,
  EmailChangeStatus,
} from '../../types/auth'
import { tauriAuthService } from './tauriAuth'
import { indexedDBAuthService } from './indexedDBAuth'

// =============================================================================
// AUTH SERVICE INTERFACE
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
  provisionLocalSession?(): Promise<AuthResponse>
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
  updateUserRole(
    token: string,
    profileId: string,
    userId: string,
    role: UserRole
  ): Promise<void>
  removeUserFromProfile(
    token: string,
    profileId: string,
    userId: string
  ): Promise<void>

  // Invitations
  createInvitation(
    token: string,
    input: CreateInvitationInput
  ): Promise<Invitation>
  getProfileInvitations(token: string, profileId: string): Promise<Invitation[]>
  acceptInvitation(
    invitationToken: string,
    accessToken?: string
  ): Promise<AuthResponse>
  revokeInvitation(token: string, invitationId: string): Promise<void>

  // Email change
  requestEmailChange(
    token: string,
    currentPassword: string,
    newEmail: string
  ): Promise<EmailChangeResponse>
  verifyEmailChange(verificationToken: string): Promise<string>
  cancelEmailChange(cancellationToken: string): Promise<string>
  getEmailChangeStatus(token: string): Promise<EmailChangeStatus>
}

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Check if running in Tauri environment
 */
const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Get the appropriate auth service based on environment
 */
const getAuthService = (): AuthService => {
  if (isTauri()) {
    return tauriAuthService
  }
  return indexedDBAuthService
}

/**
 * Singleton auth service instance
 */
export const authService: AuthService = getAuthService()

/**
 * Force use of a specific auth implementation
 * Useful for testing or specific use cases
 */
export { tauriAuthService, indexedDBAuthService }

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Helper to auto-refresh token if needed before making authenticated request
 */
export async function withAutoRefresh<T>(
  authenticatedRequest: (token: string) => Promise<T>
): Promise<T> {
  const storedToken = authService.getAccessToken()

  if (!storedToken) {
    throw new Error('Not authenticated')
  }

  // Refresh token if expired
  let token: string = storedToken
  if (authService.isTokenExpired()) {
    try {
      const refreshed = await authService.refreshToken()
      token = refreshed.access_token
    } catch {
      authService.clearTokens()
      throw new Error('Session expired. Please log in again.')
    }
  }

  try {
    return await authenticatedRequest(token)
  } catch (err) {
    // If the request failed with an auth error, try refreshing once and retrying
    const errMsg = String(err)
    if (
      errMsg.includes('expired') ||
      errMsg.includes('Invalid token') ||
      errMsg.includes('invalid token')
    ) {
      try {
        const refreshed = await authService.refreshToken()
        return await authenticatedRequest(refreshed.access_token)
      } catch {
        authService.clearTokens()
        throw new Error('Session expired. Please log in again.')
      }
    }
    throw err
  }
}

/**
 * Check if user is currently authenticated (has valid tokens)
 */
export function isAuthenticated(): boolean {
  const token = authService.getAccessToken()
  const refreshTokenValue = authService.getRefreshToken()

  // Must have at least refresh token
  if (!refreshTokenValue) return false

  // If access token exists and not expired, we're authenticated
  if (token && !authService.isTokenExpired()) return true

  // If access token is expired but we have refresh token, we're still "authenticated"
  // (will need to refresh before making requests)
  return Boolean(refreshTokenValue)
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
