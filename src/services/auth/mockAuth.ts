/**
 * Mock Authentication Service
 * Provides a browser-based mock implementation for development without Tauri
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
// MOCK DATA STORAGE
// =============================================================================

const MOCK_STORAGE_KEY = 'pacioli_mock_auth'

interface MockStorageData {
  users: Map<string, MockUser>
  sessions: Map<string, MockSession>
}

interface MockUser {
  id: string
  email: string
  password: string
  display_name: string
  created_at: string
}

interface MockSession {
  id: string
  user_id: string
  created_at: string
  expires_at: string
}

function getMockStorage(): MockStorageData {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored)
    return {
      users: new Map(parsed.users || []),
      sessions: new Map(parsed.sessions || []),
    }
  }
  return {
    users: new Map(),
    sessions: new Map(),
  }
}

function saveMockStorage(data: MockStorageData): void {
  localStorage.setItem(
    MOCK_STORAGE_KEY,
    JSON.stringify({
      users: Array.from(data.users.entries()),
      sessions: Array.from(data.sessions.entries()),
    })
  )
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateToken(): string {
  return `mock_token_${generateId()}`
}

/**
 * Create a full AuthUser object with all required fields
 */
function createMockAuthUser(
  id: string,
  email: string,
  displayName: string,
  createdAt: string,
  updatedAt: string
): AuthUser {
  return {
    id,
    email,
    display_name: displayName,
    status: 'active',
    email_verified: true,
    two_factor_enabled: false,
    avatar_url: null,
    created_at: createdAt,
    updated_at: updatedAt,
    last_login_at: new Date().toISOString(),
    first_name: null,
    last_name: null,
    phone: null,
    company: null,
    job_title: null,
    department: null,
    location: null,
    timezone: null,
    language: null,
    date_format: null,
    email_notifications: null,
    notification_email: null,
    sms_notifications: null,
    login_alerts: null,
  }
}

// =============================================================================
// MOCK AUTH SERVICE IMPLEMENTATION
// =============================================================================

export const mockAuthService: AuthService = {
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  clearTokens,

  register(input: RegisterInput): Promise<AuthResponse> {
    const storage = getMockStorage()

    // Check if email already exists
    for (const user of storage.users.values()) {
      if (user.email === input.email) {
        return Promise.reject(new Error('Email already registered'))
      }
    }

    const userId = generateId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    const newUser: MockUser = {
      id: userId,
      email: input.email,
      password: input.password,
      display_name: input.display_name,
      created_at: now.toISOString(),
    }

    const sessionId = generateId()
    const session: MockSession = {
      id: sessionId,
      user_id: userId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }

    storage.users.set(userId, newUser)
    storage.sessions.set(sessionId, session)
    saveMockStorage(storage)

    const accessToken = generateToken()
    const refreshToken = generateToken()

    const response: AuthResponse = {
      user: createMockAuthUser(
        userId,
        input.email,
        input.display_name,
        now.toISOString(),
        now.toISOString()
      ),
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
    }

    storeTokens(accessToken, refreshToken, expiresAt.toISOString())
    return Promise.resolve(response)
  },

  login(credentials: LoginCredentials): Promise<AuthResponse> {
    const storage = getMockStorage()

    let foundUser: MockUser | null = null
    for (const user of storage.users.values()) {
      if (user.email === credentials.email) {
        foundUser = user
        break
      }
    }

    if (!foundUser || foundUser.password !== credentials.password) {
      return Promise.reject(new Error('Invalid email or password'))
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const sessionId = generateId()
    const session: MockSession = {
      id: sessionId,
      user_id: foundUser.id,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }

    storage.sessions.set(sessionId, session)
    saveMockStorage(storage)

    const accessToken = generateToken()
    const refreshToken = generateToken()

    const response: AuthResponse = {
      user: createMockAuthUser(
        foundUser.id,
        foundUser.email,
        foundUser.display_name,
        foundUser.created_at,
        now.toISOString()
      ),
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
    }

    storeTokens(accessToken, refreshToken, expiresAt.toISOString())
    return Promise.resolve(response)
  },

  logout(_sessionId: string): Promise<void> {
    clearTokens()
    return Promise.resolve()
  },

  refreshToken(): Promise<TokenRefreshResponse> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const accessToken = generateToken()

    setAccessToken(accessToken)
    setTokenExpires(expiresAt.toISOString())

    return Promise.resolve({
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
    })
  },

  verifyToken(_token: string): Promise<TokenVerifyResponse> {
    return Promise.resolve({
      valid: true,
      user_id: 'mock_user_id',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  },

  getCurrentUser(_token: string): Promise<AuthUser> {
    return Promise.resolve(
      createMockAuthUser(
        'mock_user_id',
        'dev@example.com',
        'Development User',
        new Date().toISOString(),
        new Date().toISOString()
      )
    )
  },

  updateUser(_token: string, input: UpdateUserInput): Promise<AuthUser> {
    return Promise.resolve(
      createMockAuthUser(
        'mock_user_id',
        'dev@example.com',
        input.display_name || 'Development User',
        new Date().toISOString(),
        new Date().toISOString()
      )
    )
  },

  changePassword(_token: string, _input: ChangePasswordInput): Promise<void> {
    return Promise.resolve()
  },

  getUserSessions(_token: string): Promise<Session[]> {
    const now = new Date()
    return Promise.resolve([
      {
        id: 'mock_session',
        user_id: 'mock_user_id',
        device_name: 'Development Browser',
        ip_address: '127.0.0.1',
        user_agent: 'Mock Browser',
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        last_active_at: now.toISOString(),
        is_current: true,
      },
    ])
  },

  revokeSession(_token: string, _sessionId: string): Promise<void> {
    return Promise.resolve()
  },

  revokeAllSessions(_token: string): Promise<number> {
    return Promise.resolve(1)
  },

  getUserProfiles(_token: string): Promise<ProfileWithRole[]> {
    return Promise.resolve([
      {
        profile_id: 'mock_profile',
        profile_name: 'Development Profile',
        role: 'admin',
        granted_at: new Date().toISOString(),
      },
    ])
  },

  getProfileUsers(_token: string, _profileId: string): Promise<ProfileUser[]> {
    return Promise.resolve([
      {
        user_id: 'mock_user_id',
        email: 'dev@example.com',
        display_name: 'Development User',
        role: 'admin',
        granted_at: new Date().toISOString(),
        status: 'active',
      },
    ])
  },

  updateUserRole(
    _token: string,
    _profileId: string,
    _userId: string,
    _role: UserRole
  ): Promise<void> {
    return Promise.resolve()
  },

  removeUserFromProfile(
    _token: string,
    _profileId: string,
    _userId: string
  ): Promise<void> {
    return Promise.resolve()
  },

  createInvitation(
    _token: string,
    input: CreateInvitationInput
  ): Promise<Invitation> {
    const now = new Date()
    return Promise.resolve({
      id: generateId(),
      profile_id: input.profile_id,
      email: input.email,
      role: input.role,
      status: 'pending' as const,
      invited_by: 'mock_user_id',
      created_at: now.toISOString(),
      expires_at: new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      accepted_at: null,
    })
  },

  getProfileInvitations(
    _token: string,
    _profileId: string
  ): Promise<Invitation[]> {
    return Promise.resolve([])
  },

  acceptInvitation(
    _invitationToken: string,
    _accessToken?: string
  ): Promise<AuthResponse> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const accessToken = generateToken()
    const refreshToken = generateToken()

    return Promise.resolve({
      user: createMockAuthUser(
        'mock_user_id',
        'dev@example.com',
        'Development User',
        now.toISOString(),
        now.toISOString()
      ),
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
    })
  },

  revokeInvitation(_token: string, _invitationId: string): Promise<void> {
    return Promise.resolve()
  },

  requestEmailChange(
    _token: string,
    _currentPassword: string,
    _newEmail: string
  ): Promise<EmailChangeResponse> {
    return Promise.resolve({
      message: 'Verification email sent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  },

  verifyEmailChange(_verificationToken: string): Promise<string> {
    return Promise.resolve('Email changed successfully')
  },

  cancelEmailChange(_cancellationToken: string): Promise<string> {
    return Promise.resolve('Email change cancelled')
  },

  getEmailChangeStatus(_token: string): Promise<EmailChangeStatus> {
    return Promise.resolve({ pending: false })
  },
}
