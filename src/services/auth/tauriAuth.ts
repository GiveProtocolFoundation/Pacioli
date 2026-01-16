/**
 * Tauri Authentication Service
 * Provides authentication operations via Tauri commands
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
  EmailChangeResponse,
  EmailChangeStatus,
} from '../../types/auth'
import type { AuthService } from './index'

// =============================================================================
// TOKEN STORAGE
// =============================================================================

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'pacioli_access_token',
  REFRESH_TOKEN: 'pacioli_refresh_token',
  TOKEN_EXPIRES: 'pacioli_token_expires',
} as const

function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresAt: string
): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken)
  localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken)
  localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, expiresAt)
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(TOKEN_KEYS.TOKEN_EXPIRES)
}

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
}

function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN)
}

function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(TOKEN_KEYS.TOKEN_EXPIRES)
  if (!expiresAt) return true

  const expiry = new Date(expiresAt)
  const now = new Date()
  return now.getTime() >= expiry.getTime() - 60000
}

// =============================================================================
// TAURI AUTH SERVICE
// =============================================================================

export const tauriAuthService: AuthService = {
  // Token management
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  clearTokens,

  // Authentication
  async register(input: RegisterInput): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('register', { input })
    storeTokens(
      response.access_token,
      response.refresh_token,
      response.expires_at
    )
    return response
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('login', { credentials })
    storeTokens(
      response.access_token,
      response.refresh_token,
      response.expires_at
    )
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
    return invoke<AuthUser>('update_user', {
      token,
      update: input,
    })
  },

  async changePassword(
    token: string,
    input: ChangePasswordInput
  ): Promise<void> {
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

  async getProfileUsers(
    token: string,
    profileId: string
  ): Promise<ProfileUser[]> {
    return invoke<ProfileUser[]>('get_profile_users', { token, profileId })
  },

  async updateUserRole(
    token: string,
    profileId: string,
    userId: string,
    role: UserRole
  ): Promise<void> {
    return invoke('update_user_role', {
      token,
      profileId,
      targetUserId: userId,
      newRole: role,
    })
  },

  async removeUserFromProfile(
    token: string,
    profileId: string,
    userId: string
  ): Promise<void> {
    return invoke('remove_user_from_profile', {
      token,
      profileId,
      targetUserId: userId,
    })
  },

  // Invitations
  async createInvitation(
    token: string,
    input: CreateInvitationInput
  ): Promise<Invitation> {
    return invoke<Invitation>('create_invitation', {
      token,
      profileId: input.profile_id,
      email: input.email,
      role: input.role,
    })
  },

  async getProfileInvitations(
    token: string,
    profileId: string
  ): Promise<Invitation[]> {
    return invoke<Invitation[]>('get_profile_invitations', { token, profileId })
  },

  async acceptInvitation(
    invitationToken: string,
    accessToken?: string
  ): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('accept_invitation', {
      invitationToken,
      accessToken: accessToken ?? null,
    })

    if (response.access_token) {
      storeTokens(
        response.access_token,
        response.refresh_token,
        response.expires_at
      )
    }

    return response
  },

  async revokeInvitation(token: string, invitationId: string): Promise<void> {
    return invoke('revoke_invitation', { token, invitationId })
  },

  // Email change
  async requestEmailChange(
    token: string,
    currentPassword: string,
    newEmail: string
  ): Promise<EmailChangeResponse> {
    return invoke<EmailChangeResponse>('request_email_change', {
      token,
      request: {
        current_password: currentPassword,
        new_email: newEmail,
      },
    })
  },

  async verifyEmailChange(verificationToken: string): Promise<string> {
    return invoke<string>('verify_email_change', { verificationToken })
  },

  async cancelEmailChange(cancellationToken: string): Promise<string> {
    return invoke<string>('cancel_email_change', { cancellationToken })
  },

  async getEmailChangeStatus(token: string): Promise<EmailChangeStatus> {
    return invoke<EmailChangeStatus>('get_email_change_status', { token })
  },
}
