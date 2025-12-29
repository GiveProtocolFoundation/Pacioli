/**
 * Authentication Types for Pacioli
 *
 * Type definitions for the multi-tenant authentication system
 */

import { UserRole } from './user'

// Re-export UserRole for convenience
export type { UserRole }

// =============================================================================
// WALLET AUTH TYPES
// =============================================================================

/**
 * Supported wallet types for authentication
 */
export type WalletType = 'substrate' | 'evm'

/**
 * Wallet authentication challenge
 */
export interface WalletChallenge {
  id: string
  nonce: string
  message: string
  expires_at: string
}

/**
 * Request to generate a wallet challenge
 */
export interface ChallengeRequest {
  wallet_address: string
  wallet_type: WalletType
}

/**
 * Request to verify a wallet signature
 */
export interface VerifySignatureRequest {
  challenge_id: string
  signature: string
  wallet_address: string
  wallet_name?: string
  wallet_source?: string
}

/**
 * Request to link a wallet to an existing account
 */
export interface LinkWalletRequest {
  access_token: string
  challenge_id: string
  signature: string
  wallet_address: string
  wallet_type: WalletType
  chain?: string
  wallet_name?: string
  wallet_source?: string
}

/**
 * User's linked wallet
 */
export interface UserWallet {
  id: string
  user_id: string
  wallet_address: string
  wallet_type: WalletType
  chain: string | null
  wallet_name: string | null
  wallet_source: string | null
  is_primary: boolean
  created_at: string
  last_used_at: string | null
}

/**
 * Supported wallet extensions/providers
 */
export type WalletProvider =
  | 'polkadot-js'
  | 'subwallet'
  | 'talisman'
  | 'nova'
  | 'metamask'
  | 'walletconnect'

/**
 * Wallet extension account
 */
export interface WalletAccount {
  address: string
  name: string
  source: WalletProvider
  type: WalletType
}

/**
 * Wallet extension info
 */
export interface WalletExtensionInfo {
  name: string
  provider: WalletProvider
  type: WalletType
  installed: boolean
  logo: string
  downloadUrl: string
}

// =============================================================================
// USER TYPES
// =============================================================================

/**
 * User status in the system
 */
export type UserStatus =
  | 'active'
  | 'inactive'
  | 'locked'
  | 'pending_verification'

/**
 * Authentication user from the database
 */
export interface AuthUser {
  id: string
  email: string
  display_name: string
  status: UserStatus
  email_verified: boolean
  two_factor_enabled: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
  // Extended profile fields
  first_name: string | null
  last_name: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  department: string | null
  location: string | null
  timezone: string | null
  language: string | null
  date_format: string | null
  // Notification preferences
  email_notifications: boolean | null
  sms_notifications: boolean | null
  login_alerts: boolean | null
}

/**
 * User for display in UI (excludes sensitive fields)
 */
export interface UserDisplay {
  id: string
  email: string
  display_name: string
  status: UserStatus
  email_verified: boolean
  two_factor_enabled: boolean
  created_at: string
  last_login_at: string | null
}

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string
  password: string
  device_name?: string
  ip_address?: string
}

/**
 * Registration input
 */
export interface RegisterInput {
  email: string
  password: string
  display_name: string
}

/**
 * Password change request
 */
export interface ChangePasswordInput {
  current_password: string
  new_password: string
}

/**
 * Email change request input
 */
export interface EmailChangeRequest {
  current_password: string
  new_email: string
}

/**
 * Email change response from request
 */
export interface EmailChangeResponse {
  message: string
  expires_at: string
}

/**
 * Email change status
 */
export interface EmailChangeStatus {
  pending: boolean
  new_email?: string
  expires_at?: string
  created_at?: string
}

/**
 * User update input
 */
export interface UpdateUserInput {
  display_name?: string
  avatar_url?: string
  // Extended profile fields
  first_name?: string
  last_name?: string
  phone?: string
  company?: string
  job_title?: string
  department?: string
  location?: string
  timezone?: string
  language?: string
  date_format?: string
  // Notification preferences
  email_notifications?: boolean
  sms_notifications?: boolean
  login_alerts?: boolean
}

/**
 * Authentication response from login/register
 */
export interface AuthResponse {
  user: AuthUser
  access_token: string
  refresh_token: string
  expires_at: string
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  access_token: string
  expires_at: string
}

/**
 * Token verification response
 */
export interface TokenVerifyResponse {
  valid: boolean
  user_id?: string
  session_id?: string
  expires_at?: string
}

// =============================================================================
// SESSION TYPES
// =============================================================================

/**
 * User session
 */
export interface Session {
  id: string
  user_id: string
  device_name: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  expires_at: string
  last_active_at: string
  is_current?: boolean
}

/**
 * Session for display in UI
 */
export interface SessionDisplay extends Session {
  is_current: boolean
}

// =============================================================================
// PROFILE ROLE TYPES
// =============================================================================

/**
 * Profile role assignment
 */
export interface ProfileRole {
  role: UserRole
  granted_at: string
  granted_by: string | null
}

/**
 * User's relationship to a profile
 */
export interface UserProfileRole {
  user_id: string
  profile_id: string
  role: UserRole
  granted_at: string
  granted_by: string | null
}

/**
 * Profile with user's role
 */
export interface ProfileWithRole {
  profile_id: string
  profile_name: string
  role: UserRole
  granted_at: string
}

/**
 * User with their role in a profile
 */
export interface ProfileUser {
  user_id: string
  email: string
  display_name: string
  role: UserRole
  granted_at: string
  status: UserStatus
}

// =============================================================================
// INVITATION TYPES
// =============================================================================

/**
 * Invitation status
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

/**
 * Profile invitation
 */
export interface Invitation {
  id: string
  profile_id: string
  email: string
  role: UserRole
  status: InvitationStatus
  invited_by: string
  inviter_name?: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

/**
 * Create invitation input
 */
export interface CreateInvitationInput {
  profile_id: string
  email: string
  role: UserRole
}

/**
 * Accept invitation input
 */
export interface AcceptInvitationInput {
  token: string
  password?: string
  name?: string
}

// =============================================================================
// PERMISSION TYPES
// =============================================================================

/**
 * Available permissions in the system
 */
export type Permission =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'manage_users'
  | 'manage_profile'
  | 'export'
  | 'import'
  | 'view_audit'

/**
 * Role permission mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ['view'],
  preparer: ['view', 'create', 'edit', 'export'],
  approver: ['view', 'create', 'edit', 'approve', 'export', 'view_audit'],
  admin: [
    'view',
    'create',
    'edit',
    'delete',
    'approve',
    'manage_users',
    'export',
    'import',
    'view_audit',
  ],
  'system-admin': [
    'view',
    'create',
    'edit',
    'delete',
    'approve',
    'manage_users',
    'manage_profile',
    'export',
    'import',
    'view_audit',
  ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole | undefined | null,
  permission: Permission
): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Check if a role can perform an action on transactions
 */
export function canApproveTransactions(
  role: UserRole | undefined | null
): boolean {
  return hasPermission(role, 'approve')
}

/**
 * Check if a role can manage users
 */
export function canManageUsers(role: UserRole | undefined | null): boolean {
  return hasPermission(role, 'manage_users')
}

/**
 * Check if a role can delete items
 */
export function canDelete(role: UserRole | undefined | null): boolean {
  return hasPermission(role, 'delete')
}

// =============================================================================
// AUDIT LOG TYPES
// =============================================================================

/**
 * Audit event types
 */
export type AuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'register'
  | 'password_change'
  | 'password_reset'
  | 'session_revoke'
  | 'role_change'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'user_removed'

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  user_id: string | null
  event_type: AuditEventType
  target_user_id: string | null
  profile_id: string | null
  ip_address: string | null
  user_agent: string | null
  details: Record<string, unknown>
  created_at: string
}

// =============================================================================
// AUTH CONTEXT TYPES
// =============================================================================

/**
 * Authentication context state
 */
export interface AuthContextState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  userProfiles: ProfileWithRole[]
  currentProfileRole: UserRole | null
}

/**
 * Authentication context actions
 */
export interface AuthContextActions {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateUser: (input: UpdateUserInput) => Promise<void>
  changePassword: (input: ChangePasswordInput) => Promise<void>
  hasPermission: (permission: Permission) => boolean
  canAccessProfile: (profileId: string) => boolean
  getProfileRole: (profileId: string) => UserRole | null
}

/**
 * Full authentication context type
 */
export type AuthContextType = AuthContextState & AuthContextActions

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Authentication error codes
 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_LOCKED'
  | 'USER_INACTIVE'
  | 'EMAIL_NOT_VERIFIED'
  | 'SESSION_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_INVALID'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
  // Wallet auth errors
  | 'WALLET_NOT_FOUND'
  | 'WALLET_ALREADY_LINKED'
  | 'INVALID_SIGNATURE'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_USED'
  | 'WALLET_EXTENSION_NOT_FOUND'
  | 'USER_REJECTED_SIGNATURE'

/**
 * Authentication error
 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  details?: Record<string, unknown>
}

/**
 * Create an auth error
 */
export function createAuthError(
  code: AuthErrorCode,
  message: string,
  details?: Record<string, unknown>
): AuthError {
  return { code, message, details }
}

/**
 * Parse error from backend response
 */
export function parseAuthError(error: unknown): AuthError {
  if (typeof error === 'string') {
    // Parse common backend error messages
    if (
      error.includes('Invalid credentials') ||
      error.includes('Invalid email or password')
    ) {
      return createAuthError('INVALID_CREDENTIALS', 'Invalid email or password')
    }
    if (error.includes('User not found')) {
      return createAuthError('USER_NOT_FOUND', 'User not found')
    }
    if (error.includes('Account is locked')) {
      return createAuthError('USER_LOCKED', error)
    }
    if (error.includes('Account is inactive')) {
      return createAuthError('USER_INACTIVE', 'Account is inactive')
    }
    if (error.includes('Email already registered')) {
      return createAuthError(
        'EMAIL_ALREADY_EXISTS',
        'Email is already registered'
      )
    }
    if (error.includes('Password must')) {
      return createAuthError('WEAK_PASSWORD', error)
    }
    if (error.includes('Token') && error.includes('expired')) {
      return createAuthError('TOKEN_EXPIRED', 'Session has expired')
    }
    if (error.includes('Invalid token')) {
      return createAuthError('TOKEN_INVALID', 'Invalid session token')
    }
    if (error.includes('Invitation') && error.includes('expired')) {
      return createAuthError('INVITATION_EXPIRED', 'Invitation has expired')
    }
    if (
      error.includes('Permission denied') ||
      error.includes('not authorized')
    ) {
      return createAuthError(
        'INSUFFICIENT_PERMISSIONS',
        'You do not have permission to perform this action'
      )
    }

    // Wallet auth errors
    if (
      error.includes('Challenge not found') ||
      (error.includes('Challenge') && error.includes('expired'))
    ) {
      return createAuthError(
        'CHALLENGE_EXPIRED',
        'Sign-in challenge has expired. Please try again.'
      )
    }
    if (error.includes('Challenge has already been used')) {
      return createAuthError(
        'CHALLENGE_USED',
        'This sign-in challenge has already been used.'
      )
    }
    if (
      error.includes('Invalid signature') ||
      error.includes('Signature does not match')
    ) {
      return createAuthError(
        'INVALID_SIGNATURE',
        'Invalid wallet signature. Please try signing again.'
      )
    }
    if (error.includes('already linked to another')) {
      return createAuthError(
        'WALLET_ALREADY_LINKED',
        'This wallet is already linked to another account.'
      )
    }
    if (error.includes('already linked to your')) {
      return createAuthError(
        'WALLET_ALREADY_LINKED',
        'This wallet is already linked to your account.'
      )
    }

    return createAuthError('UNKNOWN_ERROR', error)
  }

  if (error instanceof Error) {
    return createAuthError('UNKNOWN_ERROR', error.message)
  }

  return createAuthError('UNKNOWN_ERROR', 'An unexpected error occurred')
}
