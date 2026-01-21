/**
 * IndexedDB Authentication Service
 * Browser-based implementation for when Tauri is not available
 * Provides user authentication using IndexedDB storage
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

const DB_NAME = 'PacioliAuthDB'
const DB_VERSION = 1

const STORES = {
  USERS: 'users',
  SESSIONS: 'sessions',
  REFRESH_TOKENS: 'refresh_tokens',
  PROFILE_ROLES: 'profile_roles',
  INVITATIONS: 'invitations',
} as const

// =============================================================================
// CRYPTO HELPERS
// =============================================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateId(): string {
  return crypto.randomUUID()
}

function getNow(): string {
  return new Date().toISOString()
}

function getExpiresAt(hours: number): string {
  const date = new Date()
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

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
// INDEXEDDB SERVICE
// =============================================================================

interface StoredUser extends AuthUser {
  password_hash: string
}

interface StoredSession {
  id: string
  user_id: string
  access_token_hash: string
  device_name: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  expires_at: string
  last_active_at: string
}

interface StoredRefreshToken {
  id: string
  user_id: string
  session_id: string
  token_hash: string
  expires_at: string
  created_at: string
}

class IndexedDBAuthService implements AuthService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  private async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open auth IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Users store
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          const userStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' })
          userStore.createIndex('email', 'email', { unique: true })
        }

        // Sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, {
            keyPath: 'id',
          })
          sessionStore.createIndex('user_id', 'user_id', { unique: false })
          sessionStore.createIndex('access_token_hash', 'access_token_hash', {
            unique: true,
          })
        }

        // Refresh tokens store
        if (!db.objectStoreNames.contains(STORES.REFRESH_TOKENS)) {
          const tokenStore = db.createObjectStore(STORES.REFRESH_TOKENS, {
            keyPath: 'id',
          })
          tokenStore.createIndex('token_hash', 'token_hash', { unique: true })
          tokenStore.createIndex('session_id', 'session_id', { unique: false })
        }

        // Profile roles store
        if (!db.objectStoreNames.contains(STORES.PROFILE_ROLES)) {
          const roleStore = db.createObjectStore(STORES.PROFILE_ROLES, {
            keyPath: 'id',
          })
          roleStore.createIndex('user_id', 'user_id', { unique: false })
          roleStore.createIndex('profile_id', 'profile_id', { unique: false })
        }

        // Invitations store
        if (!db.objectStoreNames.contains(STORES.INVITATIONS)) {
          const invStore = db.createObjectStore(STORES.INVITATIONS, {
            keyPath: 'id',
          })
          invStore.createIndex('profile_id', 'profile_id', { unique: false })
          invStore.createIndex('email', 'email', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  private async getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    await this.init()
    if (!this.db) {
      throw new Error('IndexedDB not initialized')
    }
    const transaction = this.db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  private static promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private static sanitizeUser(user: StoredUser): AuthUser {
    const { password_hash: _password_hash, ...authUser } = user
    return authUser
  }

  // Token management
  getAccessToken = getAccessToken
  getRefreshToken = getRefreshToken
  isTokenExpired = isTokenExpired
  clearTokens = clearTokens

  // Authentication
  async register(input: RegisterInput): Promise<AuthResponse> {
    await this.init()

    // Check if email already exists
    const store = await this.getStore(STORES.USERS, 'readonly')
    const index = store.index('email')
    const existingUser = await IndexedDBAuthService.promisifyRequest(
      index.get(input.email.toLowerCase())
    )

    if (existingUser) {
      throw new Error('Email already registered')
    }

    // Create user
    const now = getNow()
    const userId = generateId()
    const passwordHash = await hashPassword(input.password)

    const newUser: StoredUser = {
      id: userId,
      email: input.email.toLowerCase(),
      display_name: input.display_name,
      status: 'active',
      email_verified: true, // Auto-verify for browser mode
      two_factor_enabled: false,
      avatar_url: null,
      created_at: now,
      updated_at: now,
      last_login_at: now,
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
      email_notifications: true,
      sms_notifications: false,
      login_alerts: true,
      password_hash: passwordHash,
    }

    // Save user
    const writeStore = await this.getStore(STORES.USERS, 'readwrite')
    await IndexedDBAuthService.promisifyRequest(writeStore.add(newUser))

    // Create session and tokens
    return this.createSession(newUser)
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await this.init()

    // Find user by email
    const store = await this.getStore(STORES.USERS, 'readonly')
    const index = store.index('email')
    const user = await IndexedDBAuthService.promisifyRequest<StoredUser | undefined>(
      index.get(credentials.email.toLowerCase())
    )

    if (!user) {
      throw new Error('Invalid email or password')
    }

    // Verify password
    const passwordHash = await hashPassword(credentials.password)
    if (passwordHash !== user.password_hash) {
      throw new Error('Invalid email or password')
    }

    // Check user status
    if (user.status === 'locked') {
      throw new Error('Account is locked')
    }
    if (user.status === 'inactive') {
      throw new Error('Account is inactive')
    }

    // Update last login
    const now = getNow()
    const updatedUser: StoredUser = { ...user, last_login_at: now }
    const writeStore = await this.getStore(STORES.USERS, 'readwrite')
    await IndexedDBAuthService.promisifyRequest(writeStore.put(updatedUser))

    // Create session and tokens
    return this.createSession(updatedUser, credentials.device_name)
  }

  private async createSession(
    user: StoredUser,
    deviceName?: string
  ): Promise<AuthResponse> {
    const now = getNow()
    const accessToken = generateToken()
    const refreshTokenValue = generateToken()
    const sessionId = generateId()
    const expiresAt = getExpiresAt(1) // 1 hour
    const refreshExpiresAt = getExpiresAt(24 * 7) // 7 days

    // Hash tokens for storage
    const accessTokenHash = await hashPassword(accessToken)
    const refreshTokenHash = await hashPassword(refreshTokenValue)

    // Create session
    const session: StoredSession = {
      id: sessionId,
      user_id: user.id,
      access_token_hash: accessTokenHash,
      device_name: deviceName || 'Browser',
      ip_address: null,
      user_agent: navigator.userAgent,
      created_at: now,
      expires_at: expiresAt,
      last_active_at: now,
    }

    const sessionStore = await this.getStore(STORES.SESSIONS, 'readwrite')
    await IndexedDBAuthService.promisifyRequest(sessionStore.add(session))

    // Create refresh token
    const storedRefreshToken: StoredRefreshToken = {
      id: generateId(),
      user_id: user.id,
      session_id: sessionId,
      token_hash: refreshTokenHash,
      expires_at: refreshExpiresAt,
      created_at: now,
    }

    const tokenStore = await this.getStore(STORES.REFRESH_TOKENS, 'readwrite')
    await IndexedDBAuthService.promisifyRequest(tokenStore.add(storedRefreshToken))

    // Store tokens
    storeTokens(accessToken, refreshTokenValue, expiresAt)

    return {
      user: IndexedDBAuthService.sanitizeUser(user),
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      expires_at: expiresAt,
    }
  }

  async logout(sessionId: string): Promise<void> {
    try {
      // Delete session
      const sessionStore = await this.getStore(STORES.SESSIONS, 'readwrite')
      await IndexedDBAuthService.promisifyRequest(sessionStore.delete(sessionId))

      // Delete associated refresh tokens
      const tokenStore = await this.getStore(STORES.REFRESH_TOKENS, 'readwrite')
      const index = tokenStore.index('session_id')
      const tokens = await IndexedDBAuthService.promisifyRequest(index.getAll(sessionId))
      for (const token of tokens) {
        await IndexedDBAuthService.promisifyRequest(tokenStore.delete(token.id))
      }
    } catch {
      // Ignore errors during logout
    }
    clearTokens()
  }

  async refreshToken(): Promise<TokenRefreshResponse> {
    const refreshTokenValue = getRefreshToken()
    if (!refreshTokenValue) {
      throw new Error('No refresh token available')
    }

    const tokenHash = await hashPassword(refreshTokenValue)
    const tokenStore = await this.getStore(STORES.REFRESH_TOKENS, 'readonly')
    const index = tokenStore.index('token_hash')
    const storedToken = await IndexedDBAuthService.promisifyRequest<StoredRefreshToken | undefined>(
      index.get(tokenHash)
    )

    if (!storedToken) {
      throw new Error('Invalid refresh token')
    }

    // Check if expired
    if (new Date(storedToken.expires_at) < new Date()) {
      throw new Error('Refresh token expired')
    }

    // Generate new access token
    const newAccessToken = generateToken()
    const newExpiresAt = getExpiresAt(1)
    const newAccessTokenHash = await hashPassword(newAccessToken)

    // Update session with new access token
    const sessionStore = await this.getStore(STORES.SESSIONS, 'readwrite')
    const session = await IndexedDBAuthService.promisifyRequest<StoredSession | undefined>(
      sessionStore.get(storedToken.session_id)
    )

    if (session) {
      session.access_token_hash = newAccessTokenHash
      session.expires_at = newExpiresAt
      session.last_active_at = getNow()
      await IndexedDBAuthService.promisifyRequest(sessionStore.put(session))
    }

    // Update localStorage
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, newAccessToken)
    localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES, newExpiresAt)

    return {
      access_token: newAccessToken,
      expires_at: newExpiresAt,
    }
  }

  async verifyToken(token: string): Promise<TokenVerifyResponse> {
    const tokenHash = await hashPassword(token)
    const sessionStore = await this.getStore(STORES.SESSIONS, 'readonly')
    const index = sessionStore.index('access_token_hash')
    const session = await IndexedDBAuthService.promisifyRequest<StoredSession | undefined>(
      index.get(tokenHash)
    )

    if (!session) {
      return { valid: false }
    }

    if (new Date(session.expires_at) < new Date()) {
      return { valid: false }
    }

    return {
      valid: true,
      user_id: session.user_id,
      session_id: session.id,
      expires_at: session.expires_at,
    }
  }

  // User management
  async getCurrentUser(token: string): Promise<AuthUser> {
    const verified = await this.verifyToken(token)
    if (!verified.valid || !verified.user_id) {
      throw new Error('Invalid token')
    }

    const store = await this.getStore(STORES.USERS, 'readonly')
    const user = await IndexedDBAuthService.promisifyRequest<StoredUser | undefined>(
      store.get(verified.user_id)
    )

    if (!user) {
      throw new Error('User not found')
    }

    return IndexedDBAuthService.sanitizeUser(user)
  }

  async updateUser(token: string, input: UpdateUserInput): Promise<AuthUser> {
    const verified = await this.verifyToken(token)
    if (!verified.valid || !verified.user_id) {
      throw new Error('Invalid token')
    }

    const store = await this.getStore(STORES.USERS, 'readwrite')
    const user = await IndexedDBAuthService.promisifyRequest<StoredUser | undefined>(
      store.get(verified.user_id)
    )

    if (!user) {
      throw new Error('User not found')
    }

    const updatedUser: StoredUser = {
      ...user,
      ...input,
      updated_at: getNow(),
    }

    await IndexedDBAuthService.promisifyRequest(store.put(updatedUser))
    return IndexedDBAuthService.sanitizeUser(updatedUser)
  }

  async changePassword(token: string, input: ChangePasswordInput): Promise<void> {
    const verified = await this.verifyToken(token)
    if (!verified.valid || !verified.user_id) {
      throw new Error('Invalid token')
    }

    const store = await this.getStore(STORES.USERS, 'readwrite')
    const user = await IndexedDBAuthService.promisifyRequest<StoredUser | undefined>(
      store.get(verified.user_id)
    )

    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const currentHash = await hashPassword(input.current_password)
    if (currentHash !== user.password_hash) {
      throw new Error('Current password is incorrect')
    }

    // Update password
    const newHash = await hashPassword(input.new_password)
    const updatedUser: StoredUser = {
      ...user,
      password_hash: newHash,
      updated_at: getNow(),
    }

    await IndexedDBAuthService.promisifyRequest(store.put(updatedUser))
  }

  // Session management
  async getUserSessions(token: string): Promise<Session[]> {
    const verified = await this.verifyToken(token)
    if (!verified.valid || !verified.user_id) {
      throw new Error('Invalid token')
    }

    const store = await this.getStore(STORES.SESSIONS, 'readonly')
    const index = store.index('user_id')
    const sessions = await IndexedDBAuthService.promisifyRequest<StoredSession[]>(
      index.getAll(verified.user_id)
    )

    return sessions.map(s => ({
      id: s.id,
      user_id: s.user_id,
      device_name: s.device_name,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      created_at: s.created_at,
      expires_at: s.expires_at,
      last_active_at: s.last_active_at,
      is_current: s.id === verified.session_id,
    }))
  }

  async revokeSession(token: string, sessionId: string): Promise<void> {
    const verified = await this.verifyToken(token)
    if (!verified.valid) {
      throw new Error('Invalid token')
    }

    const sessionStore = await this.getStore(STORES.SESSIONS, 'readwrite')
    await IndexedDBAuthService.promisifyRequest(sessionStore.delete(sessionId))

    // Delete associated refresh tokens
    const tokenStore = await this.getStore(STORES.REFRESH_TOKENS, 'readwrite')
    const index = tokenStore.index('session_id')
    const tokens = await IndexedDBAuthService.promisifyRequest<StoredRefreshToken[]>(
      index.getAll(sessionId)
    )
    for (const t of tokens) {
      await IndexedDBAuthService.promisifyRequest(tokenStore.delete(t.id))
    }
  }

  async revokeAllSessions(token: string): Promise<number> {
    const verified = await this.verifyToken(token)
    if (!verified.valid || !verified.user_id) {
      throw new Error('Invalid token')
    }

    const sessionStore = await this.getStore(STORES.SESSIONS, 'readwrite')
    const index = sessionStore.index('user_id')
    const sessions = await IndexedDBAuthService.promisifyRequest<StoredSession[]>(
      index.getAll(verified.user_id)
    )

    let count = 0
    for (const session of sessions) {
      // Don't revoke current session
      if (session.id !== verified.session_id) {
        await IndexedDBAuthService.promisifyRequest(sessionStore.delete(session.id))
        count++
      }
    }

    return count
  }

  // Profile roles - simplified for browser mode
  async getUserProfiles(_token: string): Promise<ProfileWithRole[]> {
    // In browser mode, return empty - profiles are managed through persistence
    return []
  }

  async getProfileUsers(_token: string, _profileId: string): Promise<ProfileUser[]> {
    return []
  }

  async updateUserRole(
    _token: string,
    _profileId: string,
    _userId: string,
    _role: UserRole
  ): Promise<void> {
    // No-op in browser mode
  }

  async removeUserFromProfile(
    _token: string,
    _profileId: string,
    _userId: string
  ): Promise<void> {
    // No-op in browser mode
  }

  // Invitations - simplified for browser mode
  async createInvitation(
    _token: string,
    _input: CreateInvitationInput
  ): Promise<Invitation> {
    throw new Error('Invitations not supported in browser mode')
  }

  async getProfileInvitations(
    _token: string,
    _profileId: string
  ): Promise<Invitation[]> {
    return []
  }

  async acceptInvitation(
    _invitationToken: string,
    _accessToken?: string
  ): Promise<AuthResponse> {
    throw new Error('Invitations not supported in browser mode')
  }

  async revokeInvitation(_token: string, _invitationId: string): Promise<void> {
    // No-op
  }

  // Email change - simplified for browser mode (direct update, no email verification)
  async requestEmailChange(
    token: string,
    currentPassword: string,
    newEmail: string
  ): Promise<EmailChangeResponse> {
    const verified = await this.verifyToken(token)
    if (!verified.valid || !verified.user_id) {
      throw new Error('Invalid token')
    }

    const store = await this.getStore(STORES.USERS, 'readwrite')
    const user = await IndexedDBAuthService.promisifyRequest<StoredUser | undefined>(
      store.get(verified.user_id)
    )

    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const passwordHash = await hashPassword(currentPassword)
    if (passwordHash !== user.password_hash) {
      throw new Error('Current password is incorrect')
    }

    // Check if email is different
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new Error('New email must be different from current email')
    }

    // Check if new email is already in use
    const emailIndex = store.index('email')
    const existingUser = await IndexedDBAuthService.promisifyRequest<StoredUser | undefined>(
      emailIndex.get(newEmail.toLowerCase())
    )
    if (existingUser && existingUser.id !== user.id) {
      throw new Error('Email is already in use')
    }

    // In browser mode, update email directly (no verification needed for local storage)
    const updatedUser: StoredUser = {
      ...user,
      email: newEmail.toLowerCase(),
      updated_at: getNow(),
    }
    await IndexedDBAuthService.promisifyRequest(store.put(updatedUser))

    return {
      message: 'Email updated successfully! (Browser mode: no verification required)',
      expires_at: getNow(),
    }
  }

  async verifyEmailChange(_verificationToken: string): Promise<string> {
    // In browser mode, email is updated directly in requestEmailChange
    return 'Email already updated (browser mode)'
  }

  async cancelEmailChange(_cancellationToken: string): Promise<string> {
    return 'No pending email change (browser mode)'
  }

  async getEmailChangeStatus(_token: string): Promise<EmailChangeStatus> {
    return { pending: false }
  }
}

export const indexedDBAuthService = new IndexedDBAuthService()
