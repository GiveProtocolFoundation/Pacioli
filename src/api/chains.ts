/**
 * Chain API
 *
 * Tauri invoke wrappers for chain adapter commands.
 * Provides typed access to blockchain data fetching operations.
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  ChainInfo,
  ChainTransaction,
  WalletBalances,
  WalletAddress,
} from '../types/chains'

/**
 * Get all supported blockchain chains.
 *
 * @returns List of supported chains with their configuration
 */
export async function getSupportedChains(): Promise<ChainInfo[]> {
  return invoke<ChainInfo[]>('chain_get_supported_chains')
}

/**
 * Check if a chain is supported.
 *
 * @param chainId - Chain identifier (name or numeric ID)
 * @returns True if the chain is supported
 */
export async function isChainSupported(chainId: string): Promise<boolean> {
  return invoke<boolean>('chain_is_supported', { chainId })
}

/**
 * Validate an address for a specific chain.
 *
 * @param chainId - Chain identifier
 * @param address - Address to validate
 * @returns True if the address is valid for the chain
 */
export async function validateAddress(
  chainId: string,
  address: string
): Promise<boolean> {
  return invoke<boolean>('chain_validate_address', { chainId, address })
}

/**
 * Fetch transactions for an address on a specific chain.
 *
 * @param chainId - Chain identifier
 * @param address - Wallet address
 * @param fromBlock - Optional starting block number
 * @returns List of transactions
 */
export async function fetchTransactions(
  chainId: string,
  address: string,
  fromBlock?: number
): Promise<ChainTransaction[]> {
  return invoke<ChainTransaction[]>('chain_fetch_transactions', {
    chainId,
    address,
    fromBlock: fromBlock ?? null,
  })
}

/**
 * Fetch balances for an address on a specific chain.
 *
 * @param chainId - Chain identifier
 * @param address - Wallet address
 * @returns Wallet balances including native and token balances
 */
export async function fetchBalances(
  chainId: string,
  address: string
): Promise<WalletBalances> {
  return invoke<WalletBalances>('chain_fetch_balances', { chainId, address })
}

/**
 * Fetch a single transaction by hash.
 *
 * @param chainId - Chain identifier
 * @param hash - Transaction hash
 * @returns Transaction details
 */
export async function fetchTransaction(
  chainId: string,
  hash: string
): Promise<ChainTransaction> {
  return invoke<ChainTransaction>('chain_fetch_transaction', { chainId, hash })
}

/**
 * Fetch balances for multiple address/chain pairs.
 *
 * @param addresses - List of chain/address pairs
 * @returns List of wallet balances
 */
export async function fetchAllBalances(
  addresses: WalletAddress[]
): Promise<WalletBalances[]> {
  const pairs: [string, string][] = addresses.map((w) => [w.chainId, w.address])
  return invoke<WalletBalances[]>('chain_fetch_all_balances', {
    addresses: pairs,
  })
}

/**
 * Fetch transactions for multiple chains for a single address.
 *
 * @param address - Wallet address
 * @param chainIds - List of chain identifiers
 * @param fromBlock - Optional starting block number
 * @returns Combined list of transactions sorted by timestamp
 */
export async function fetchAllTransactions(
  address: string,
  chainIds: string[],
  fromBlock?: number
): Promise<ChainTransaction[]> {
  return invoke<ChainTransaction[]>('chain_fetch_all_transactions', {
    address,
    chainIds,
    fromBlock: fromBlock ?? null,
  })
}

/**
 * Connect to a specific chain (initialize adapter).
 *
 * @param chainId - Chain identifier
 * @returns Connection status message
 */
export async function connectChain(chainId: string): Promise<string> {
  return invoke<string>('chain_connect', { chainId })
}

/**
 * Set an explorer API key for a chain.
 *
 * @param chainId - Chain identifier
 * @param apiKey - API key for the block explorer
 */
export async function setExplorerApiKey(
  chainId: string,
  apiKey: string
): Promise<void> {
  await invoke('chain_set_explorer_api_key', { chainId, apiKey })
}

/**
 * Set a custom RPC URL for a chain.
 *
 * @param chainId - Chain identifier
 * @param rpcUrl - Custom RPC endpoint URL
 */
export async function setRpcUrl(
  chainId: string,
  rpcUrl: string
): Promise<void> {
  await invoke('chain_set_rpc_url', { chainId, rpcUrl })
}

/**
 * Get current block number for a chain.
 *
 * @param chainId - Chain identifier
 * @returns Current block number
 */
export async function getBlockNumber(chainId: string): Promise<number> {
  return invoke<number>('chain_get_block_number', { chainId })
}
