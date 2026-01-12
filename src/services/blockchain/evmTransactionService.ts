/**
 * EVM Transaction Fetching Service
 * Fetches transaction history for EVM-compatible chains using block explorer APIs
 */

import { ethers } from 'ethers'
import { EVM_CHAINS, type EVMChain } from '../evmService'
import type { EVMTransaction, NetworkType } from '../wallet/types'

// Map EVM chain keys to NetworkType
export const EVM_NETWORK_MAP: Record<string, NetworkType> = {
  moonbeam: 'moonbeam' as NetworkType,
  moonriver: 'moonriver' as NetworkType,
  astar: 'astar' as NetworkType,
  acala: 'acala' as NetworkType,
}

// Block explorer API configurations
interface BlockExplorerConfig {
  apiUrl: string
  apiKey?: string
  rateLimit: number // ms between requests
}

const BLOCK_EXPLORER_APIS: Record<string, BlockExplorerConfig> = {
  moonbeam: {
    apiUrl: 'https://api-moonbeam.moonscan.io/api',
    rateLimit: 200,
  },
  moonriver: {
    apiUrl: 'https://api-moonriver.moonscan.io/api',
    rateLimit: 200,
  },
  astar: {
    apiUrl: 'https://blockscout.com/astar/api',
    rateLimit: 250,
  },
  acala: {
    apiUrl: 'https://blockscout.acala.network/api',
    rateLimit: 250,
  },
}

export interface EVMSyncProgress {
  stage: 'connecting' | 'fetching' | 'processing' | 'saving' | 'complete'
  currentBlock: number
  totalBlocks: number
  blocksScanned: number
  transactionsFound: number
  message: string
}

interface BlockExplorerTx {
  hash: string
  blockNumber: string
  timeStamp: string
  from: string
  to: string
  value: string
  gas: string
  gasPrice: string
  gasUsed: string
  isError: string
  input: string
  contractAddress?: string
  functionName?: string
}

interface TokenTransferTx {
  hash: string
  blockNumber: string
  timeStamp: string
  from: string
  to: string
  value: string
  tokenSymbol: string
  tokenDecimal: string
  contractAddress: string
  gas: string
  gasPrice: string
  gasUsed: string
}

/**
 * Service for fetching and processing EVM blockchain transactions.
 */
class EVMTransactionService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map()

  /**
   * Get or create a provider for a chain
   */
  private getProvider(chain: string): ethers.JsonRpcProvider {
    const existingProvider = this.providers.get(chain)
    if (existingProvider) {
      return existingProvider
    }

    const config = EVM_CHAINS[chain]
    if (!config) throw new Error(`Unknown chain: ${chain}`)

    const provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.providers.set(chain, provider)
    return provider
  }

  /**
   * Fetch transactions using block explorer API
   */
  async fetchTransactionHistory(
    chain: string,
    address: string,
    options: {
      limit?: number
      onProgress?: (progress: EVMSyncProgress) => void
    } = {}
  ): Promise<EVMTransaction[]> {
    const { limit = 100, onProgress } = options
    const config = EVM_CHAINS[chain]
    const explorerConfig = BLOCK_EXPLORER_APIS[chain]

    if (!config) {
      throw new Error(`Unknown chain: ${chain}`)
    }

    onProgress?.({
      stage: 'connecting',
      currentBlock: 0,
      totalBlocks: 0,
      blocksScanned: 0,
      transactionsFound: 0,
      message: `Connecting to ${config.name}...`,
    })

    const transactions: EVMTransaction[] = []

    try {
      // Fetch normal transactions
      onProgress?.({
        stage: 'fetching',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: 0,
        message: 'Fetching transaction history...',
      })

      const normalTxs = await EVMTransactionService.fetchNormalTransactions(chain, address, limit, explorerConfig)

      onProgress?.({
        stage: 'processing',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: normalTxs.length,
        message: `Processing ${normalTxs.length} transactions...`,
      })

      // Convert to EVMTransaction format
      for (const tx of normalTxs) {
        const evmTx = EVMTransactionService.convertToEVMTransaction(tx, chain, config)
        transactions.push(evmTx)
      }

      // Fetch ERC20 token transfers
      onProgress?.({
        stage: 'fetching',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: transactions.length,
        message: 'Fetching token transfers...',
      })

      const tokenTxs = await EVMTransactionService.fetchTokenTransfers(chain, address, limit, explorerConfig)

      for (const tx of tokenTxs) {
        const evmTx = EVMTransactionService.convertTokenTransferToEVMTransaction(tx, chain, config)
        // Only add if not already in list (by hash)
        if (!transactions.some(t => t.hash === evmTx.hash)) {
          transactions.push(evmTx)
        }
      }

      // Sort by block number descending (newest first)
      transactions.sort((a, b) => b.blockNumber - a.blockNumber)

      // Apply limit
      const limitedTxs = transactions.slice(0, limit)

      onProgress?.({
        stage: 'complete',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: limitedTxs.length,
        message: `Found ${limitedTxs.length} transactions`,
      })

      return limitedTxs
    } catch (error) {
      console.error('Error fetching EVM transactions:', error)

      // Fallback to RPC-based fetching if explorer API fails
      return this.fetchTransactionsViaRPC(chain, address, limit, onProgress)
    }
  }

  /**
   * Fetch normal (ETH) transactions from block explorer
   */
  private static async fetchNormalTransactions(
    chain: string,
    address: string,
    limit: number,
    explorerConfig?: BlockExplorerConfig
  ): Promise<BlockExplorerTx[]> {
    if (!explorerConfig) {
      return []
    }

    try {
      const params = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address,
        startblock: '0',
        endblock: '99999999',
        page: '1',
        offset: limit.toString(),
        sort: 'desc',
      })

      const response = await fetch(`${explorerConfig.apiUrl}?${params}`)
      const data = await response.json()

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result as BlockExplorerTx[]
      }

      return []
    } catch (error) {
      console.warn(`Failed to fetch normal transactions for ${chain}:`, error)
      return []
    }
  }

  /**
   * Fetch ERC20 token transfers from block explorer
   */
  private static async fetchTokenTransfers(
    chain: string,
    address: string,
    limit: number,
    explorerConfig?: BlockExplorerConfig
  ): Promise<TokenTransferTx[]> {
    if (!explorerConfig) {
      return []
    }

    try {
      // Add rate limiting delay
      await new Promise(resolve => setTimeout(resolve, explorerConfig.rateLimit))

      const params = new URLSearchParams({
        module: 'account',
        action: 'tokentx',
        address,
        startblock: '0',
        endblock: '99999999',
        page: '1',
        offset: limit.toString(),
        sort: 'desc',
      })

      const response = await fetch(`${explorerConfig.apiUrl}?${params}`)
      const data = await response.json()

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result as TokenTransferTx[]
      }

      return []
    } catch (error) {
      console.warn(`Failed to fetch token transfers for ${chain}:`, error)
      return []
    }
  }

  /**
   * Fallback: Fetch recent transactions via RPC (limited to recent blocks)
   */
  private async fetchTransactionsViaRPC(
    chain: string,
    address: string,
    limit: number,
    onProgress?: (progress: EVMSyncProgress) => void
  ): Promise<EVMTransaction[]> {
    const config = EVM_CHAINS[chain]
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`)
    }

    const provider = this.getProvider(chain)
    const transactions: EVMTransaction[] = []

    try {
      onProgress?.({
        stage: 'connecting',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: 0,
        message: 'Connecting via RPC...',
      })

      const currentBlock = await provider.getBlockNumber()
      const blocksToScan = Math.min(1000, currentBlock) // Scan last 1000 blocks
      const startBlock = currentBlock - blocksToScan

      onProgress?.({
        stage: 'fetching',
        currentBlock: startBlock,
        totalBlocks: blocksToScan,
        blocksScanned: 0,
        transactionsFound: 0,
        message: `Scanning blocks ${startBlock} to ${currentBlock}...`,
      })

      // Scan blocks in batches
      const batchSize = 20
      const addressLower = address.toLowerCase()

      for (let i = currentBlock; i > startBlock && transactions.length < limit; i -= batchSize) {
        const batchEnd = i
        const batchStart = Math.max(i - batchSize + 1, startBlock)

        const blockPromises = []
        for (let blockNum = batchEnd; blockNum >= batchStart; blockNum--) {
          blockPromises.push(provider.getBlock(blockNum, true))
        }

        const blocks = await Promise.all(blockPromises)

        for (const block of blocks) {
          if (!block || !block.prefetchedTransactions) continue

          for (const tx of block.prefetchedTransactions) {
            if (
              tx.from?.toLowerCase() === addressLower ||
              tx.to?.toLowerCase() === addressLower
            ) {
              const receipt = await provider.getTransactionReceipt(tx.hash)

              const evmTx: EVMTransaction = {
                id: tx.hash,
                hash: tx.hash,
                blockNumber: tx.blockNumber || 0,
                timestamp: new Date(block.timestamp * 1000),
                from: tx.from || '',
                to: tx.to || '',
                value: tx.value.toString(),
                fee: receipt ? (receipt.gasUsed * (receipt.gasPrice || 0n)).toString() : '0',
                status: receipt?.status === 1 ? 'success' : 'failed',
                network: EVM_NETWORK_MAP[chain] || ('moonbeam' as NetworkType),
                type: tx.data === '0x' ? 'transfer' : 'contract',
                gasUsed: receipt?.gasUsed.toString() || '0',
                gasPrice: (receipt?.gasPrice || tx.gasPrice || 0n).toString(),
                input: tx.data,
              }

              transactions.push(evmTx)

              if (transactions.length >= limit) break
            }
          }
        }

        onProgress?.({
          stage: 'processing',
          currentBlock: batchStart,
          totalBlocks: blocksToScan,
          blocksScanned: currentBlock - batchStart,
          transactionsFound: transactions.length,
          message: `Scanned ${currentBlock - batchStart} blocks, found ${transactions.length} transactions...`,
        })
      }

      onProgress?.({
        stage: 'complete',
        currentBlock,
        totalBlocks: blocksToScan,
        blocksScanned: blocksToScan,
        transactionsFound: transactions.length,
        message: `Found ${transactions.length} transactions`,
      })

      return transactions
    } catch (error) {
      console.error('Error fetching transactions via RPC:', error)
      throw error
    }
  }

  /**
   * Convert block explorer transaction to EVMTransaction
   */
  private static convertToEVMTransaction(
    tx: BlockExplorerTx,
    chain: string,
    _config: EVMChain
  ): EVMTransaction {
    const gasUsed = BigInt(tx.gasUsed || '0')
    const gasPrice = BigInt(tx.gasPrice || '0')
    const fee = (gasUsed * gasPrice).toString()

    return {
      id: tx.hash,
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 10),
      timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
      from: tx.from,
      to: tx.to || '',
      value: tx.value,
      fee,
      status: tx.isError === '0' ? 'success' : 'failed',
      network: EVM_NETWORK_MAP[chain] || ('moonbeam' as NetworkType),
      type: tx.input === '0x' ? 'transfer' : tx.contractAddress ? 'contract' : 'contract',
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      input: tx.input,
      contractAddress: tx.contractAddress,
    }
  }

  /**
   * Convert token transfer to EVMTransaction
   */
  private static convertTokenTransferToEVMTransaction(
    tx: TokenTransferTx,
    chain: string,
    _config: EVMChain
  ): EVMTransaction {
    const gasUsed = BigInt(tx.gasUsed || '0')
    const gasPrice = BigInt(tx.gasPrice || '0')
    const fee = (gasUsed * gasPrice).toString()

    return {
      id: `${tx.hash}-${tx.contractAddress}`,
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 10),
      timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
      from: tx.from,
      to: tx.to,
      value: tx.value,
      fee,
      status: 'success',
      network: EVM_NETWORK_MAP[chain] || ('moonbeam' as NetworkType),
      type: 'token_transfer',
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      contractAddress: tx.contractAddress,
      tokenSymbol: tx.tokenSymbol,
      tokenDecimals: parseInt(tx.tokenDecimal, 10),
    }
  }

  /**
   * Get current chain ID from MetaMask
   */
  static async getCurrentChainId(): Promise<number | null> {
    if (!window.ethereum) return null

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      return parseInt(chainId as string, 16)
    } catch (error) {
      console.error('Error getting chain ID:', error)
      return null
    }
  }

  /**
   * Get chain key from chain ID
   */
  static getChainKeyFromId(chainId: number): string | null {
    for (const [key, config] of Object.entries(EVM_CHAINS)) {
      if (config.chainId === chainId) {
        return key
      }
    }
    return null
  }

  /**
   * Get native token balance
   */
  async getNativeBalance(chain: string, address: string): Promise<string> {
    const provider = this.getProvider(chain)
    const balance = await provider.getBalance(address)
    return balance.toString()
  }

  /**
   * Format balance with proper decimals
   */
  static formatBalance(value: string, decimals = 18): string {
    try {
      return ethers.formatUnits(value, decimals)
    } catch {
      return '0'
    }
  }
}

export const evmTransactionService = new EVMTransactionService()
