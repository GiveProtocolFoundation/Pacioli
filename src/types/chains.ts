/**
 * Chain Types
 *
 * TypeScript types for interacting with Pacioli's chain adapters via Tauri.
 * These types mirror the Rust structs defined in src-tauri/src/chains/mod.rs.
 */

/**
 * Chain family classification.
 * Determines which adapter and parsing logic to use.
 */
export enum ChainFamily {
  Evm = 'evm',
  Substrate = 'substrate',
  Solana = 'solana',
  Bitcoin = 'bitcoin',
}

/**
 * Transaction status on the blockchain.
 */
export enum TransactionStatus {
  Success = 'success',
  Failed = 'failed',
  Pending = 'pending',
}

/**
 * Classification of transaction types for accounting purposes.
 */
export enum TransactionType {
  Transfer = 'transfer',
  Swap = 'swap',
  Bridge = 'bridge',
  Stake = 'stake',
  Unstake = 'unstake',
  Claim = 'claim',
  Mint = 'mint',
  Burn = 'burn',
  Approve = 'approve',
  ContractCall = 'contract_call',
  Unknown = 'unknown',
}

/**
 * Information about a supported blockchain.
 * Used for UI display and chain selection.
 */
export interface ChainInfo {
  /** Unique chain identifier (e.g., "ethereum", "polygon", "1", "137") */
  chain_id: string
  /** Human-readable chain name */
  name: string
  /** Native token symbol (e.g., "ETH", "MATIC") */
  symbol: string
  /** Chain family classification */
  chain_type: ChainFamily
  /** Numeric chain ID for EVM chains */
  numeric_chain_id: number | null
  /** Native token decimals */
  decimals: number
  /** URL to chain logo image */
  logo_url: string | null
  /** Whether this is a testnet */
  is_testnet: boolean
  /** Block explorer URL */
  explorer_url: string | null
}

/**
 * Chain identifier with type information.
 */
export interface ChainId {
  /** Chain family classification */
  chain_type: ChainFamily
  /** Chain name identifier */
  name: string
  /** Numeric chain ID for EVM chains */
  chain_id: number | null
}

/**
 * Token transfer within a transaction.
 */
export interface TokenTransfer {
  /** Token contract address */
  token_address: string
  /** Token symbol (if known) */
  symbol: string | null
  /** Token name (if known) */
  name: string | null
  /** Token decimals */
  decimals: number
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Transfer amount (raw units) */
  amount: string
  /** Log index within the transaction */
  log_index: number
}

/**
 * Blockchain transaction with parsed metadata.
 */
export interface ChainTransaction {
  /** Transaction hash */
  hash: string
  /** Chain identifier */
  chain_id: ChainId
  /** Block number containing the transaction */
  block_number: number
  /** Unix timestamp */
  timestamp: number
  /** Sender address */
  from: string
  /** Recipient address (null for contract creation) */
  to: string | null
  /** Transaction value in native token (raw units) */
  value: string
  /** Transaction fee in native token (raw units) */
  fee: string
  /** Transaction status */
  status: TransactionStatus
  /** Transaction type classification */
  tx_type: TransactionType
  /** ERC20/token transfers within this transaction */
  token_transfers: TokenTransfer[]
  /** Raw transaction data (JSON) */
  raw_data: unknown | null
}

/**
 * Native token balance.
 */
export interface NativeBalance {
  /** Native token symbol */
  symbol: string
  /** Balance amount (raw units) */
  balance: string
  /** Token decimals */
  decimals: number
  /** USD value (if available) */
  value_usd: number | null
}

/**
 * Token balance for ERC20/SPL tokens.
 */
export interface TokenBalance {
  /** Token contract address */
  token_address: string
  /** Token symbol */
  symbol: string
  /** Token name */
  name: string
  /** Token decimals */
  decimals: number
  /** Balance amount (raw units) */
  balance: string
  /** USD value (if available) */
  value_usd: number | null
  /** Token logo URL */
  logo_url: string | null
}

/**
 * Complete wallet balance information for a chain.
 */
export interface WalletBalances {
  /** Chain identifier */
  chain_id: string
  /** Wallet address */
  address: string
  /** Native token balance */
  native_balance: NativeBalance
  /** Token balances */
  token_balances: TokenBalance[]
  /** Total portfolio value in USD */
  total_value_usd: number | null
  /** Unix timestamp when balances were fetched */
  fetched_at: number
}

/**
 * Wallet identifier for multi-chain balance fetching.
 */
export interface WalletAddress {
  chainId: string
  address: string
}

/**
 * Error response from chain operations.
 */
export interface ChainError {
  code: string
  message: string
  chain_id?: string
}
