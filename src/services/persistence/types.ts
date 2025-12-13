/**
 * Persistence Layer Types
 * TypeScript types matching the Rust backend types
 */

export interface Profile {
  id: string
  name: string
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface Wallet {
  id: string
  profile_id: string
  address: string
  chain: string
  name?: string | null
  wallet_type: string
  created_at: string
  updated_at?: string | null
}

export interface WalletInput {
  profile_id: string
  address: string
  chain: string
  name?: string
  wallet_type: string
}

export interface StoredTransaction {
  id: string
  wallet_id: string
  hash: string
  block_number?: number | null
  timestamp?: string | null
  from_address?: string | null
  to_address?: string | null
  value?: string | null
  fee?: string | null
  status?: string | null
  tx_type?: string | null
  token_symbol?: string | null
  token_decimals?: number | null
  chain: string
  raw_data?: string | null
  created_at: string
}

export interface TransactionInput {
  hash: string
  block_number?: number
  timestamp?: string
  from_address?: string
  to_address?: string
  value?: string
  fee?: string
  status?: string
  tx_type?: string
  token_symbol?: string
  token_decimals?: number
  chain: string
  raw_data?: string
}

export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface PersistenceService {
  // Profile operations
  createProfile(name: string): Promise<Profile>
  getProfiles(): Promise<Profile[]>
  updateProfile(id: string, name: string): Promise<Profile>
  deleteProfile(id: string): Promise<void>

  // Wallet operations
  saveWallet(wallet: WalletInput): Promise<Wallet>
  getWallets(profileId: string): Promise<Wallet[]>
  getWalletById(id: string): Promise<Wallet | null>
  deleteWallet(id: string): Promise<void>

  // Transaction operations
  saveTransactions(walletId: string, transactions: TransactionInput[]): Promise<number>
  getTransactions(walletId: string, options?: PaginationOptions): Promise<StoredTransaction[]>
  getAllTransactions(profileId: string, options?: PaginationOptions): Promise<StoredTransaction[]>
  deleteTransactions(walletId: string): Promise<number>

  // Settings operations
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  deleteSetting(key: string): Promise<void>
  getAllSettings(): Promise<Array<[string, string]>>
}
