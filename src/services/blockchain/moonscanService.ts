/**
 * Moonscan API Service
 * Fetches EVM transaction history for Moonbeam/Moonriver via the Etherscan V2
 * unified API (per-chain V1 endpoints are deprecated).
 *
 * Etherscan V2 requires an API key for all requests.
 * A free Etherscan key (https://etherscan.io/myapikey) works for all V2 chains
 * including Moonbeam/Moonriver. A Moonscan-specific key also works.
 */

import { invoke } from '@tauri-apps/api/core'
import type { NetworkType, SubstrateTransaction } from '../wallet/types'

interface MoonscanConfig {
  chainId: number
  apiUrl: string
  apiKey?: string
}

interface MoonscanTransaction {
  blockNumber: string
  timeStamp: string
  hash: string
  nonce: string
  blockHash: string
  transactionIndex: string
  from: string
  to: string
  value: string
  gas: string
  gasPrice: string
  isError: string
  txreceipt_status: string
  input: string
  contractAddress: string
  cumulativeGasUsed: string
  gasUsed: string
  confirmations: string
  methodId: string
  functionName: string
}

interface MoonscanTokenTransfer {
  blockNumber: string
  timeStamp: string
  hash: string
  nonce: string
  blockHash: string
  from: string
  contractAddress: string
  to: string
  value: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  transactionIndex: string
  gas: string
  gasPrice: string
  gasUsed: string
  cumulativeGasUsed: string
  input: string
  confirmations: string
}

interface MoonscanResponse<T> {
  status: string
  message: string
  result: T[] | string // Can be array or error string
}

/**
 * Service for fetching EVM transaction history using Etherscan V2 API.
 */
export class MoonscanService {
  // Etherscan V2 unified endpoint — Moonscan V1 per-chain endpoints are
  // deprecated; V2 routes via the chainid query parameter instead.
  private readonly NETWORK_CONFIGS: Partial<
    Record<NetworkType, MoonscanConfig>
  > = {
    moonbeam: {
      chainId: 1284,
      apiUrl: 'https://api.etherscan.io/v2/api',
    },
    moonriver: {
      chainId: 1285,
      apiUrl: 'https://api.etherscan.io/v2/api',
    },
  }

  /**
   * User-facing remediation guidance appended when every configured key is
   * rejected by Etherscan V2. Legacy moonscan.io keys are NOT valid on the
   * V2 unified endpoint — only keys issued by etherscan.io work.
   */
  private static readonly KEY_HELP =
    'Moonbeam/Moonriver sync uses the Etherscan V2 API, which requires a free ' +
    'Etherscan API key (legacy moonscan.io keys no longer work). Create a key ' +
    'at https://etherscan.io/myapikey, then save it in Settings → Data ' +
    'Providers under "Etherscan" and retry the sync.'

  /**
   * Collect every configured API key, in preference order:
   * Tauri keychain (moonscan, then etherscan) → localStorage → env vars.
   * All candidates are tried in order because a stored legacy Moonscan key
   * may be rejected by Etherscan V2 while the Etherscan key is valid.
   */
  private static async getApiKeyCandidates(): Promise<string[]> {
    const candidates: string[] = []

    // Tauri keychain first (desktop app)
    try {
      const key = await invoke<string | null>('get_api_key', {
        provider: 'moonscan',
      })
      if (key) candidates.push(key)
      const ethKey = await invoke<string | null>('get_api_key', {
        provider: 'etherscan',
      })
      if (ethKey) candidates.push(ethKey)
    } catch {
      // Tauri not available — fall through to browser fallbacks
    }

    // localStorage (browser dev mode, set via DataProviders page)
    const storedKey = localStorage.getItem('pacioli_api_key_moonscan')
    if (storedKey) candidates.push(storedKey)
    const ethStoredKey = localStorage.getItem('pacioli_api_key_etherscan')
    if (ethStoredKey) candidates.push(ethStoredKey)

    // Environment variables (build-time configured)
    if (typeof import.meta !== 'undefined') {
      if (import.meta.env?.VITE_MOONSCAN_API_KEY)
        candidates.push(import.meta.env.VITE_MOONSCAN_API_KEY)
      if (import.meta.env?.VITE_ETHERSCAN_API_KEY)
        candidates.push(import.meta.env.VITE_ETHERSCAN_API_KEY)
    }

    return [...new Set(candidates)]
  }

  /**
   * True when the response is Etherscan V2's key-rejection error
   * ("Invalid API Key" / "Missing/Invalid API Key").
   */
  private static isKeyRejection(data: MoonscanResponse<unknown>): boolean {
    return (
      data.status !== '1' &&
      typeof data.result === 'string' &&
      data.result.toLowerCase().includes('api key')
    )
  }

  /**
   * Fetch from the Etherscan V2 API, retrying with each configured key
   * candidate if the current one is rejected. Throws an actionable error
   * (including remediation steps) when no configured key is accepted.
   */
  private static async fetchWithKeyFallback<T>(
    apiUrl: string,
    params: URLSearchParams
  ): Promise<MoonscanResponse<T>> {
    const candidates = await MoonscanService.getApiKeyCandidates()
    // With no keys configured, still attempt once so the server's own
    // "Missing/Invalid API Key" surfaces through the same error path.
    const attempts = candidates.length > 0 ? candidates : ['']
    let lastRejection: string | null = null

    for (const key of attempts) {
      if (key) params.set('apikey', key)
      else params.delete('apikey')

      const response = await fetch(`${apiUrl}?${params.toString()}`)
      const responseText = await response.text()

      let data: MoonscanResponse<T>
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse Etherscan V2 JSON:', parseError)
        throw new Error(
          `Invalid JSON response from Etherscan API: ${responseText.substring(0, 200)}`
        )
      }

      if (!MoonscanService.isKeyRejection(data)) {
        return data
      }
      lastRejection = data.result as string
    }

    throw new Error(
      `Moonscan API error: ${lastRejection ?? 'Invalid API Key'}. ${MoonscanService.KEY_HELP}`
    )
  }

  /**
   * Check if Moonscan is available for a network
   */
  isAvailable(network: NetworkType): boolean {
    return Boolean(this.NETWORK_CONFIGS[network])
  }

  /**
   * Check if API key is configured
   */
  static async hasApiKey(): Promise<boolean> {
    return (await MoonscanService.getApiKeyCandidates()).length > 0
  }

  /**
   * Fetch normal EVM transactions for an address
   */
  async fetchTransactions(
    network: NetworkType,
    address: string,
    options: {
      startBlock?: number
      endBlock?: number
      page?: number
      offset?: number
      sort?: 'asc' | 'desc'
    } = {}
  ): Promise<SubstrateTransaction[]> {
    const config = this.NETWORK_CONFIGS[network]
    if (!config) {
      throw new Error(`Moonscan not configured for ${network}`)
    }

    const {
      startBlock = 0,
      endBlock = 99999999,
      page = 1,
      offset = 100,
      sort = 'desc',
    } = options

    // Build Etherscan V2 API URL with chainid parameter
    const params = new URLSearchParams({
      chainid: config.chainId.toString(),
      module: 'account',
      action: 'txlist',
      address,
      startblock: startBlock.toString(),
      endblock: endBlock.toString(),
      page: page.toString(),
      offset: offset.toString(),
      sort,
    })

    try {
      const data =
        await MoonscanService.fetchWithKeyFallback<MoonscanTransaction>(
          config.apiUrl,
          params
        )

      if (data.status !== '1') {
        // Status '0' with "No transactions found" is not an error
        if (
          data.message === 'No transactions found' ||
          (data.message === 'OK' &&
            typeof data.result === 'string' &&
            data.result.includes('No transactions'))
        ) {
          return []
        }
        // Handle specific error messages
        if (typeof data.result === 'string') {
          throw new Error(`Moonscan API error: ${data.result}`)
        }
        throw new Error(`Moonscan API error: ${data.message}`)
      }

      if (!Array.isArray(data.result)) {
        return []
      }

      return data.result.map(tx =>
        MoonscanService.mapToSubstrateTransaction(tx, network, address)
      )
    } catch (error) {
      console.error('Moonscan fetch error:', error)
      throw error
    }
  }

  /**
   * Fetch ERC-20 token transfers for an address
   */
  async fetchTokenTransfers(
    network: NetworkType,
    address: string,
    options: {
      startBlock?: number
      endBlock?: number
      page?: number
      offset?: number
      sort?: 'asc' | 'desc'
    } = {}
  ): Promise<SubstrateTransaction[]> {
    const config = this.NETWORK_CONFIGS[network]
    if (!config) {
      throw new Error(`Moonscan not configured for ${network}`)
    }

    const {
      startBlock = 0,
      endBlock = 99999999,
      page = 1,
      offset = 100,
      sort = 'desc',
    } = options

    const params = new URLSearchParams({
      chainid: config.chainId.toString(),
      module: 'account',
      action: 'tokentx',
      address,
      startblock: startBlock.toString(),
      endblock: endBlock.toString(),
      page: page.toString(),
      offset: offset.toString(),
      sort,
    })

    try {
      const data =
        await MoonscanService.fetchWithKeyFallback<MoonscanTokenTransfer>(
          config.apiUrl,
          params
        )

      if (data.status !== '1') {
        // No transactions found or other non-error status - return empty
        return []
      }

      if (!Array.isArray(data.result)) {
        return []
      }

      return data.result.map(tx =>
        MoonscanService.mapTokenTransferToSubstrateTransaction(
          tx,
          network,
          address
        )
      )
    } catch (error) {
      console.error('Moonscan token transfer fetch error:', error)
      // Don't throw - token transfers are optional
      return []
    }
  }

  /**
   * Fetch all transactions (normal + token transfers)
   */
  async fetchAllTransactions(
    network: NetworkType,
    address: string,
    options: {
      limit?: number
      onProgress?: (stage: string, current: number, total: number) => void
    } = {}
  ): Promise<SubstrateTransaction[]> {
    const { limit = 100, onProgress } = options
    const allTransactions: SubstrateTransaction[] = []

    try {
      // 1. Fetch normal transactions
      onProgress?.('Fetching EVM transactions from Moonscan...', 0, limit)
      const normalTxs = await this.fetchTransactions(network, address, {
        offset: limit,
      })
      allTransactions.push(...normalTxs)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250))

      // 2. Fetch token transfers
      onProgress?.(
        'Fetching token transfers from Moonscan...',
        normalTxs.length,
        limit
      )
      const tokenTxs = await this.fetchTokenTransfers(network, address, {
        offset: limit,
      })
      allTransactions.push(...tokenTxs)

      // Sort by block number (newest first)
      allTransactions.sort((a, b) => b.blockNumber - a.blockNumber)

      // Deduplicate by hash (token transfers might duplicate normal txs)
      const seen = new Set<string>()
      const deduplicated = allTransactions.filter(tx => {
        if (seen.has(tx.hash)) return false
        seen.add(tx.hash)
        return true
      })

      return deduplicated.slice(0, limit)
    } catch (error) {
      console.error('Moonscan fetchAllTransactions error:', error)
      throw error
    }
  }

  /**
   * Map Moonscan transaction to SubstrateTransaction format
   */
  private static mapToSubstrateTransaction(
    tx: MoonscanTransaction,
    network: NetworkType,
    _userAddress: string
  ): SubstrateTransaction {
    const isContract = tx.input !== '0x' && tx.input.length > 2

    // Determine transaction type
    let type: SubstrateTransaction['type'] = 'transfer'
    let method = 'transfer'
    let section = 'balances'

    if (isContract) {
      type = 'other'
      section = 'evm'
      // Try to parse function name
      if (tx.functionName) {
        method = tx.functionName.split('(')[0] || 'contract_call'
      } else {
        method = 'contract_call'
      }
    }

    return {
      id: `${tx.blockNumber}-${tx.transactionIndex}`,
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 10),
      timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
      from: tx.from,
      to: tx.to || tx.contractAddress || '',
      value: tx.value, // Value in wei
      fee: (BigInt(tx.gasUsed) * BigInt(tx.gasPrice)).toString(),
      status: tx.isError === '0' ? 'success' : 'failed',
      network,
      type,
      method,
      section,
      events: [],
      isSigned: true,
    }
  }

  /**
   * Map token transfer to SubstrateTransaction format
   */
  private static mapTokenTransferToSubstrateTransaction(
    tx: MoonscanTokenTransfer,
    network: NetworkType,
    _userAddress: string
  ): SubstrateTransaction {
    return {
      id: `${tx.blockNumber}-${tx.transactionIndex}-token`,
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 10),
      timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
      from: tx.from,
      to: tx.to,
      value: tx.value, // Value in token units (need to adjust for decimals)
      fee: (BigInt(tx.gasUsed) * BigInt(tx.gasPrice)).toString(),
      status: 'success', // Token transfers don't have isError field
      network,
      type: 'transfer',
      method: `transfer_${tx.tokenSymbol}`,
      section: 'erc20',
      events: [
        {
          method: 'Transfer',
          section: tx.tokenSymbol,
          data: {
            tokenName: tx.tokenName,
            tokenSymbol: tx.tokenSymbol,
            tokenDecimals: parseInt(tx.tokenDecimal, 10),
            contractAddress: tx.contractAddress,
          },
        },
      ],
      isSigned: true,
    }
  }
}

export const moonscanService = new MoonscanService()
