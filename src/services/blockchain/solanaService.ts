/**
 * Solana Service
 *
 * Provides TypeScript bindings for Solana balance and transaction
 * fetching via Tauri commands. Mirrors the Bitcoin service pattern.
 */

import { invoke } from '@tauri-apps/api/core'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Native SOL transfer within a transaction
 */
export interface SolanaNativeTransfer {
  from: string
  to: string
  /** Amount in lamports */
  amount: number
}

/**
 * SPL token transfer within a transaction
 */
export interface SolanaTokenTransfer {
  from: string
  to: string
  mint: string
  amount: number
  token_standard: string
}

/**
 * Solana token account (SPL token balance)
 */
export interface SolanaTokenAccount {
  /** Token mint address */
  mint: string
  /** Token symbol (if known) */
  symbol: string | null
  /** Token name (if known) */
  name: string | null
  /** Raw balance as string */
  balance: string
  /** Token decimals */
  decimals: number
  /** Human-readable balance */
  ui_balance: string
}

/**
 * Solana address balance
 */
export interface SolanaBalance {
  /** Address */
  address: string
  /** Balance in lamports */
  balance: number
  /** Token accounts */
  token_accounts: SolanaTokenAccount[]
}

/**
 * Solana transaction
 */
export interface SolanaTransaction {
  /** Transaction signature */
  signature: string
  /** Slot number */
  slot: number
  /** Block timestamp (Unix seconds) */
  timestamp: number
  /** Transaction fee in lamports */
  fee: number
  /** Transaction status */
  status: 'success' | 'failed'
  /** Transaction type */
  tx_type: string
  /** Native SOL transfers */
  native_transfers: SolanaNativeTransfer[]
  /** SPL token transfers */
  token_transfers: SolanaTokenTransfer[]
  /** Human-readable description */
  description: string
  /** Source program/protocol */
  source_program: string
  /** Fee payer address */
  fee_payer: string
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get balance for a Solana address
 *
 * @param address Solana address (base58 encoded)
 * @param network Network name ("solana" or "solana_devnet")
 */
export async function getSolanaBalance(
  address: string,
  network: string = 'solana'
): Promise<SolanaBalance> {
  return invoke<SolanaBalance>('get_solana_balance', { address, network })
}

/**
 * Get transactions for a Solana address
 *
 * @param address Solana address
 * @param network Network name ("solana" or "solana_devnet")
 * @param maxPages Maximum pages to fetch (~100 txs per page)
 */
export async function getSolanaTransactions(
  address: string,
  network: string = 'solana',
  maxPages?: number
): Promise<SolanaTransaction[]> {
  return invoke<SolanaTransaction[]>('get_solana_transactions', {
    address,
    network,
    maxPages,
  })
}

/**
 * Validate a Solana address
 */
export async function validateSolanaAddress(address: string): Promise<boolean> {
  return invoke<boolean>('validate_solana_address', { address })
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format lamports to SOL string
 */
export function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9)
}

/**
 * Parse SOL string to lamports
 */
export function parseSol(sol: string): number {
  return Math.round(parseFloat(sol) * 1_000_000_000)
}
