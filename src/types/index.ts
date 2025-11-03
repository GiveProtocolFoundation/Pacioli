/**
 * Pacioli Type System - Central Export
 * Comprehensive type definitions for multi-token accounting
 */

// =============================================================================
// DATABASE TYPES
// =============================================================================
export * from './database'

// =============================================================================
// ACCOUNTING TYPES
// =============================================================================
export * from './accounting'

// =============================================================================
// REPORTING TYPES
// =============================================================================
export * from './reporting'

// =============================================================================
// TAURI COMMAND TYPES
// =============================================================================
export * from './tauri-commands'

// =============================================================================
// EXISTING TYPES (Re-export for compatibility)
// =============================================================================
export * from './chartOfAccounts'
export * from './digitalAssets'
export * from './transaction'
export * from './currency'
export * from './user'
export * from './cryptoAccounting'
export * from './errors'

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties K of T required
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

/**
 * Make specific properties K of T optional
 */
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * Extract Tauri response data type
 */
export type UnwrapTauriResponse<T> = T extends Promise<{ data?: infer U }> ? U : never
