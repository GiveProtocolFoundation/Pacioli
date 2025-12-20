/**
 * Moonscan/Etherscan V2 API Service
 * Fetches EVM transaction history using Etherscan's unified V2 API
 * Used for Moonbeam, Moonriver, and other EVM-compatible chains
 *
 * Note: As of 2024, Moonscan uses Etherscan V2 API which requires an API key.
 * Get a free API key at: https://etherscan.io/myapikey
 */

import type { NetworkType, SubstrateTransaction } from '../wallet/types'

interface MoonscanConfig {
  chainId: number
  apiKey?: string
}

// Etherscan V2 unified API base URL
const ETHERSCAN_V2_BASE_URL = 'https://api.etherscan.io/v2/api'

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

class MoonscanService {
  // Etherscan V2 uses chain IDs instead of separate base URLs
  private readonly NETWORK_CONFIGS: Partial<
    Record<NetworkType, MoonscanConfig>
  > = {
    moonbeam: {
      chainId: 1284,
    },
    moonriver: {
      chainId: 1285,
    },
  }

  // API key can be set via environment variable or localStorage
  private getApiKey(): string | null {
    // Check localStorage first (user-configured)
    const storedKey = localStorage.getItem('etherscan_api_key')
    if (storedKey) return storedKey

    // Check for environment variable (build-time configured)
    // Note: In Vite, env vars must be prefixed with VITE_
    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_ETHERSCAN_API_KEY
    ) {
      return import.meta.env.VITE_ETHERSCAN_API_KEY
    }

    return null
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
  hasApiKey(): boolean {
    return Boolean(this.getApiKey())
  }

  /**
   * Set API key (stores in localStorage)
   */
  static setApiKey(apiKey: string): void {
    localStorage.setItem('etherscan_api_key', apiKey)
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

    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error(
        'Etherscan API key required for EVM transaction history. ' +
          'Get a free key at https://etherscan.io/myapikey and add it in Settings.'
      )
    }

    const {
      startBlock = 0,
      endBlock = 99999999,
      page = 1,
      offset = 100,
      sort = 'desc',
    } = options

    // Build V2 API URL with chainid parameter
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
      apikey: apiKey,
    })

    const url = `${ETHERSCAN_V2_BASE_URL}?${params.toString()}`

    try {
      const response = await fetch(url)
      const responseText = await response.text()

      let data: MoonscanResponse<MoonscanTransaction>
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse Moonscan JSON:', parseError)
        throw new Error(
          `Invalid JSON response from Etherscan API: ${responseText.substring(0, 200)}`
        )
      }

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
          throw new Error(`Etherscan API error: ${data.result}`)
        }
        throw new Error(`Etherscan API error: ${data.message}`)
      }

      if (!Array.isArray(data.result)) {
        return []
      }

      return data.result.map(tx =>
        this.mapToSubstrateTransaction(tx, network, address)
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

    const apiKey = this.getApiKey()
    if (!apiKey) {
      // Skip token transfers if no API key (already checked in fetchTransactions)
      return []
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
      apikey: apiKey,
    })

    const url = `${ETHERSCAN_V2_BASE_URL}?${params.toString()}`

    try {
      const response = await fetch(url)
      const data: MoonscanResponse<MoonscanTokenTransfer> =
        await response.json()

      if (data.status !== '1') {
        // No transactions found or other non-error status - return empty
        return []
      }

      if (!Array.isArray(data.result)) {
        return []
      }

      return data.result.map(tx =>
        this.mapTokenTransferToSubstrateTransaction(tx, network, address)
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
  private mapToSubstrateTransaction(
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
  private mapTokenTransferToSubstrateTransaction(
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
