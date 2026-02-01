/**
 * Bitcoin xPub Service
 *
 * Provides TypeScript bindings for Bitcoin xPub address derivation
 * and transaction/balance fetching via Tauri commands.
 */

import { invoke } from '@tauri-apps/api/core'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Address type derived from xPub prefix
 */
export type AddressType = 'Legacy' | 'NestedSegwit' | 'NativeSegwit' | 'Taproot'

/**
 * Information about a parsed xPub
 */
export interface XpubInfo {
  /** The original xPub string */
  original: string
  /** Detected address type based on prefix */
  address_type: AddressType
  /** Whether this is a testnet key */
  is_testnet: boolean
  /** Fingerprint of the master key */
  fingerprint: string
}

/**
 * A derived Bitcoin address
 */
export interface DerivedAddress {
  /** The Bitcoin address string */
  address: string
  /** Derivation path relative to xPub (e.g., "0/0") */
  derivation_path: string
  /** Index in the derivation (0-based) */
  index: number
  /** Whether this is a change address (internal chain) */
  is_change: boolean
  /** Address type */
  address_type: AddressType
}

/**
 * Portfolio derived from an xPub
 */
export interface XpubPortfolio {
  /** Information about the xPub */
  info: XpubInfo
  /** Derived receiving addresses (external chain, path 0/*) */
  receiving_addresses: DerivedAddress[]
  /** Derived change addresses (internal chain, path 1/*) */
  change_addresses: DerivedAddress[]
}

/**
 * Bitcoin balance for an address
 */
export interface BitcoinBalance {
  /** Address */
  address: string
  /** Total balance in satoshis (confirmed + unconfirmed) */
  balance: number
  /** Confirmed balance in satoshis */
  confirmed_balance: number
  /** Unconfirmed balance in satoshis */
  unconfirmed_balance: number
  /** Number of UTXOs */
  utxo_count: number
  /** Total received in satoshis */
  total_received: number
  /** Total sent in satoshis */
  total_sent: number
  /** Number of transactions */
  tx_count: number
}

/**
 * Bitcoin transaction input
 */
export interface BitcoinTxInput {
  /** Address that spent the input */
  address: string | null
  /** Value in satoshis */
  value: number
  /** Previous transaction ID */
  prev_txid: string
  /** Previous output index */
  prev_vout: number
}

/**
 * Bitcoin transaction output
 */
export interface BitcoinTxOutput {
  /** Recipient address */
  address: string | null
  /** Value in satoshis */
  value: number
  /** Output index */
  index: number
  /** Script type */
  script_type: string
}

/**
 * Bitcoin transaction
 */
export interface BitcoinTransaction {
  /** Transaction ID (hash) */
  txid: string
  /** Block height (null if unconfirmed) */
  block_height: number | null
  /** Block time as Unix timestamp (null if unconfirmed) */
  timestamp: number | null
  /** Transaction inputs */
  inputs: BitcoinTxInput[]
  /** Transaction outputs */
  outputs: BitcoinTxOutput[]
  /** Transaction fee in satoshis */
  fee: number
  /** Number of confirmations */
  confirmations: number
  /** Whether this is a coinbase transaction */
  is_coinbase: boolean
  /** Total input value in satoshis */
  total_input: number
  /** Total output value in satoshis */
  total_output: number
}

/**
 * Bitcoin UTXO
 */
export interface BitcoinUtxo {
  /** Transaction ID */
  txid: string
  /** Output index */
  vout: number
  /** Value in satoshis */
  value: number
  /** Transaction status */
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
}

// =============================================================================
// XPUB FUNCTIONS
// =============================================================================

/**
 * Check if a string is a valid xPub format
 *
 * Supports: xpub, ypub, zpub (mainnet) and tpub, upub, vpub (testnet)
 */
export async function isXpub(input: string): Promise<boolean> {
  return invoke<boolean>('bitcoin_is_xpub', { input })
}

/**
 * Parse and validate an xPub string
 *
 * @param xpub Extended public key string
 * @returns XpubInfo with address type, network, and fingerprint
 */
export async function parseXpub(xpub: string): Promise<XpubInfo> {
  return invoke<XpubInfo>('bitcoin_parse_xpub', { xpub })
}

/**
 * Derive addresses from an xPub
 *
 * @param xpub Extended public key string
 * @param receivingCount Number of receiving addresses to derive
 * @param changeCount Number of change addresses to derive
 * @returns XpubPortfolio containing xPub info and derived addresses
 */
export async function deriveAddresses(
  xpub: string,
  receivingCount: number = 20,
  changeCount: number = 10
): Promise<XpubPortfolio> {
  return invoke<XpubPortfolio>('bitcoin_derive_addresses', {
    xpub,
    receivingCount,
    changeCount,
  })
}

/**
 * Fetch balances for all addresses derived from an xPub
 *
 * Derives addresses from the xPub and fetches balances for each using Mempool.space API.
 * Only returns addresses with non-zero activity.
 *
 * @param xpub Extended public key string
 * @param receivingCount Number of receiving addresses to check
 * @param changeCount Number of change addresses to check
 * @param network Network name ("bitcoin", "testnet", "signet")
 * @returns Array of (address, balance) tuples for addresses with activity
 */
export async function fetchXpubBalances(
  xpub: string,
  receivingCount: number = 20,
  changeCount: number = 10,
  network: string = 'bitcoin'
): Promise<[DerivedAddress, BitcoinBalance][]> {
  return invoke<[DerivedAddress, BitcoinBalance][]>('bitcoin_fetch_xpub_balances', {
    xpub,
    receivingCount,
    changeCount,
    network,
  })
}

/**
 * Fetch transactions for all addresses derived from an xPub
 *
 * @param xpub Extended public key string
 * @param receivingCount Number of receiving addresses to check
 * @param changeCount Number of change addresses to check
 * @param network Network name ("bitcoin", "testnet", "signet")
 * @param maxPagesPerAddress Maximum pages of transactions per address
 * @returns Array of (address, transactions) tuples for addresses with transactions
 */
export async function fetchXpubTransactions(
  xpub: string,
  receivingCount: number = 20,
  changeCount: number = 10,
  network: string = 'bitcoin',
  maxPagesPerAddress: number = 2
): Promise<[DerivedAddress, BitcoinTransaction[]][]> {
  return invoke<[DerivedAddress, BitcoinTransaction[]][]>('bitcoin_fetch_xpub_transactions', {
    xpub,
    receivingCount,
    changeCount,
    network,
    maxPagesPerAddress,
  })
}

// =============================================================================
// SINGLE ADDRESS FUNCTIONS
// =============================================================================

/**
 * Validate a Bitcoin address
 */
export async function validateBitcoinAddress(address: string): Promise<boolean> {
  return invoke<boolean>('validate_bitcoin_address', { address })
}

/**
 * Get balance for a Bitcoin address
 *
 * @param address Bitcoin address
 * @param network Network name ("bitcoin", "testnet", "signet")
 */
export async function getBitcoinBalance(
  address: string,
  network: string = 'bitcoin'
): Promise<BitcoinBalance> {
  return invoke<BitcoinBalance>('get_bitcoin_balance', { address, network })
}

/**
 * Get transactions for a Bitcoin address
 *
 * @param address Bitcoin address
 * @param network Network name ("bitcoin", "testnet", "signet")
 * @param maxPages Maximum pages to fetch (25 txs per page)
 */
export async function getBitcoinTransactions(
  address: string,
  network: string = 'bitcoin',
  maxPages?: number
): Promise<BitcoinTransaction[]> {
  return invoke<BitcoinTransaction[]>('get_bitcoin_transactions', {
    address,
    network,
    maxPages,
  })
}

/**
 * Get UTXOs for a Bitcoin address
 *
 * @param address Bitcoin address
 * @param network Network name ("bitcoin", "testnet", "signet")
 */
export async function getBitcoinUtxos(
  address: string,
  network: string = 'bitcoin'
): Promise<BitcoinUtxo[]> {
  return invoke<BitcoinUtxo[]>('get_bitcoin_utxos', { address, network })
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format satoshis to BTC string
 */
export function formatBtc(satoshis: number): string {
  return (satoshis / 100_000_000).toFixed(8)
}

/**
 * Parse BTC string to satoshis
 */
export function parseBtc(btc: string): number {
  return Math.round(parseFloat(btc) * 100_000_000)
}

/**
 * Get display name for address type
 */
export function getAddressTypeDisplayName(addressType: AddressType): string {
  switch (addressType) {
    case 'Legacy':
      return 'Legacy (P2PKH)'
    case 'NestedSegwit':
      return 'Nested SegWit (P2SH-P2WPKH)'
    case 'NativeSegwit':
      return 'Native SegWit (P2WPKH)'
    case 'Taproot':
      return 'Taproot (P2TR)'
  }
}

/**
 * Get xPub prefix description
 */
export function getXpubPrefixDescription(prefix: string): string {
  switch (prefix.toLowerCase()) {
    case 'xpub':
      return 'BIP44 Legacy addresses (1...)'
    case 'ypub':
      return 'BIP49 Nested SegWit addresses (3...)'
    case 'zpub':
      return 'BIP84 Native SegWit addresses (bc1q...)'
    case 'tpub':
      return 'Testnet BIP44 Legacy addresses'
    case 'upub':
      return 'Testnet BIP49 Nested SegWit addresses'
    case 'vpub':
      return 'Testnet BIP84 Native SegWit addresses'
    default:
      return 'Unknown format'
  }
}

/**
 * Calculate total balance across multiple addresses
 */
export function calculateTotalBalance(
  balances: [DerivedAddress, BitcoinBalance][]
): {
  total: number
  confirmed: number
  unconfirmed: number
  addressCount: number
  txCount: number
} {
  let total = 0
  let confirmed = 0
  let unconfirmed = 0
  let txCount = 0

  for (const [, balance] of balances) {
    total += balance.balance
    confirmed += balance.confirmed_balance
    unconfirmed += balance.unconfirmed_balance
    txCount += balance.tx_count
  }

  return {
    total,
    confirmed,
    unconfirmed,
    addressCount: balances.length,
    txCount,
  }
}
