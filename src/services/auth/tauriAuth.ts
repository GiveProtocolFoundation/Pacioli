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
import {
  storeTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  setAccessToken,
  setTokenExpires,
} from './tokenStorage'

// =============================================================================
// TAURI-SPECIFIC TYPES
// =============================================================================

/**
 * Raw response from Rust backend (uses expires_in seconds, not expires_at)
 */
interface TauriAuthResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
  expires_in: number
}

function computeExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
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
    const raw = await invoke<TauriAuthResponse>('register', { input })
    const expiresAt = computeExpiresAt(raw.expires_in)
    storeTokens(raw.access_token, raw.refresh_token, expiresAt)
    return {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      user: raw.user,
      expires_at: expiresAt,
    }
  },

  async provisionLocalSession(): Promise<AuthResponse> {
    const raw = await invoke<TauriAuthResponse>('provision_local_session')
    const expiresAt = computeExpiresAt(raw.expires_in)
    storeTokens(raw.access_token, raw.refresh_token, expiresAt)
    return {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      user: raw.user,
      expires_at: expiresAt,
    }
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const raw = await invoke<TauriAuthResponse>('login', { credentials })
    const expiresAt = computeExpiresAt(raw.expires_in)
    storeTokens(raw.access_token, raw.refresh_token, expiresAt)
    return {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      user: raw.user,
      expires_at: expiresAt,
    }
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

    const raw = await invoke<TauriAuthResponse>('refresh_token', {
      refreshToken: refreshTokenValue,
    })

    const expiresAt = computeExpiresAt(raw.expires_in)
    setAccessToken(raw.access_token)
    setTokenExpires(expiresAt)

    return { access_token: raw.access_token, expires_at: expiresAt }
  },

  verifyToken(token: string): Promise<TokenVerifyResponse> {
    return invoke<TokenVerifyResponse>('verify_token', { token })
  },

  // User management
  getCurrentUser(token: string): Promise<AuthUser> {
    return invoke<AuthUser>('get_current_user', { token })
  },

  updateUser(token: string, input: UpdateUserInput): Promise<AuthUser> {
    return invoke<AuthUser>('update_user', {
      token,
      update: input,
    })
  },

  changePassword(
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
  getUserSessions(token: string): Promise<Session[]> {
    return invoke<Session[]>('get_user_sessions', { token })
  },

  revokeSession(token: string, sessionId: string): Promise<void> {
    return invoke('revoke_session', { token, sessionId })
  },

  revokeAllSessions(token: string): Promise<number> {
    return invoke<number>('revoke_all_sessions', { token })
  },

  // Profile roles
  getUserProfiles(token: string): Promise<ProfileWithRole[]> {
    return invoke<ProfileWithRole[]>('get_user_profiles', { token })
  },

  getProfileUsers(
    token: string,
    profileId: string
  ): Promise<ProfileUser[]> {
    return invoke<ProfileUser[]>('get_profile_users', { token, profileId })
  },

  updateUserRole(
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

  removeUserFromProfile(
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
  createInvitation(
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

  getProfileInvitations(
    token: string,
    profileId: string
  ): Promise<Invitation[]> {
    return invoke<Invitation[]>('get_profile_invitations', { token, profileId })
  },

  async acceptInvitation(
    invitationToken: string,
    accessToken?: string
  ): Promise<AuthResponse> {
    const raw = await invoke<TauriAuthResponse>('accept_invitation', {
      invitationToken,
      accessToken: accessToken ?? null,
    })

    const expiresAt = computeExpiresAt(raw.expires_in)
    if (raw.access_token) {
      storeTokens(raw.access_token, raw.refresh_token, expiresAt)
    }

    return {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      user: raw.user,
      expires_at: expiresAt,
    }
  },

  revokeInvitation(token: string, invitationId: string): Promise<void> {
    return invoke('revoke_invitation', { token, invitationId })
  },

  // Email change
  requestEmailChange(
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

  verifyEmailChange(verificationToken: string): Promise<string> {
    return invoke<string>('verify_email_change', { verificationToken })
  },

  cancelEmailChange(cancellationToken: string): Promise<string> {
    return invoke<string>('cancel_email_change', { cancellationToken })
  },

  getEmailChangeStatus(token: string): Promise<EmailChangeStatus> {
    return invoke<EmailChangeStatus>('get_email_change_status', { token })
  },
}
