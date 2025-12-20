/**
 * Polkadot Blockchain Service
 * Handles connection to Polkadot/Kusama relay chains and parachains
 * Fetches transaction history and monitors real-time events
 */

import { ApiPromise, WsProvider } from '@polkadot/api'
import { formatBalance } from '@polkadot/util'
import type {
  Header,
  AccountInfo,
  EventRecord,
  Moment,
} from '@polkadot/types/interfaces'
import type { Vec } from '@polkadot/types'
import type {
  NetworkConfig,
  SubstrateTransaction,
  NetworkType,
} from '../wallet/types'
import { ChainType } from '../wallet/types'
import { subscanService } from './subscanService'
import { moonscanService } from './moonscanService'

export interface BlockchainConnection {
  api: ApiPromise
  network: NetworkConfig
  isConnected: boolean
}

export interface TransactionFilter {
  address: string
  startBlock?: number
  endBlock?: number
  limit?: number
  onProgress?: (progress: SyncProgress) => void
}

export interface SyncProgress {
  stage: 'connecting' | 'fetching' | 'processing' | 'saving' | 'complete'
  currentBlock: number
  totalBlocks: number
  blocksScanned: number
  transactionsFound: number
  message: string
}

class PolkadotService {
  private connections: Map<NetworkType, BlockchainConnection> = new Map()
  private wsProviders: Map<NetworkType, WsProvider> = new Map()

  // Polkadot Relay Chain endpoints
  private readonly RPC_ENDPOINTS: Record<NetworkType, string[]> = {
    polkadot: [
      'wss://rpc.polkadot.io',
      'wss://polkadot-rpc.dwellir.com',
      'wss://polkadot.api.onfinality.io/public-ws',
    ],
    kusama: [
      'wss://kusama-rpc.polkadot.io',
      'wss://kusama-rpc.dwellir.com',
      'wss://kusama.api.onfinality.io/public-ws',
    ],
    moonbeam: ['wss://wss.api.moonbeam.network'],
    moonriver: ['wss://wss.api.moonriver.moonbeam.network'],
    astar: ['wss://rpc.astar.network'],
    acala: ['wss://acala-rpc.dwellir.com'],
  }

  /**
   * Connect to a Polkadot network
   */
  async connect(
    network: NetworkType,
    config?: Partial<NetworkConfig>
  ): Promise<BlockchainConnection> {
    // Check if already connected
    const existing = this.connections.get(network)
    if (existing?.isConnected) {
      return existing
    }

    const endpoints = this.RPC_ENDPOINTS[network]
    if (!endpoints || endpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for ${network}`)
    }

    // Try each endpoint until one connects
    let lastError: Error | null = null
    for (const endpoint of endpoints) {
      try {
        const wsProvider = new WsProvider(endpoint, 5000) // 5 second timeout
        const api = await ApiPromise.create({ provider: wsProvider })

        // Add timeout to isReady
        await Promise.race([
          api.isReady,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Connection timeout after 10 seconds')),
              10000
            )
          ),
        ])

        const chain = await api.rpc.system.chain()
        await api.rpc.system.version()

        // Get chain properties (handle both Substrate and EVM chains)
        const properties = await api.rpc.system.properties()

        // SS58 format - handle different return types
        let ss58Format = 42 // default
        try {
          const ss58Value = properties.ss58Format.unwrapOr(42)
          ss58Format =
            typeof ss58Value === 'number'
              ? ss58Value
              : ss58Value.toNumber
                ? ss58Value.toNumber()
                : 42
        } catch (error) {
          console.warn('Could not get ss58Format, using default:', error)
        }

        // Token decimals - handle different return types
        let tokenDecimals = 18 // default for EVM chains
        try {
          const decimalsValue = properties.tokenDecimals.unwrapOr([18])
          const decimalsArray = Array.isArray(decimalsValue)
            ? decimalsValue
            : [decimalsValue]
          const firstDecimal = decimalsArray[0]
          tokenDecimals =
            typeof firstDecimal === 'number'
              ? firstDecimal
              : firstDecimal.toNumber
                ? firstDecimal.toNumber()
                : 18
        } catch (error) {
          console.warn('Could not get tokenDecimals, using default:', error)
        }

        // Token symbol - handle different return types
        let tokenSymbol = 'UNIT' // default
        try {
          const symbolValue = properties.tokenSymbol.unwrapOr(['UNIT'])
          const symbolArray = Array.isArray(symbolValue)
            ? symbolValue
            : [symbolValue]
          tokenSymbol = symbolArray[0].toString()
        } catch (error) {
          console.warn('Could not get tokenSymbol, using default:', error)
        }

        // Configure formatBalance
        formatBalance.setDefaults({
          decimals: tokenDecimals,
          unit: tokenSymbol,
        })

        const networkConfig: NetworkConfig = {
          name: chain.toString(),
          type: network,
          chainType: ChainType.SUBSTRATE,
          rpcEndpoint: endpoint,
          wsEndpoint: endpoint,
          ss58Format,
          decimals: tokenDecimals,
          symbol: tokenSymbol,
          ...config,
        }

        const connection: BlockchainConnection = {
          api,
          network: networkConfig,
          isConnected: true,
        }

        this.connections.set(network, connection)
        this.wsProviders.set(network, wsProvider)

        return connection
      } catch (error) {
        lastError = error as Error
        console.warn(`Failed to connect to ${endpoint}:`, error)
        continue
      }
    }

    throw new Error(
      `Failed to connect to ${network}. Last error: ${lastError?.message}`
    )
  }

  /**
   * Get API instance for a network
   */
  getApi(network: NetworkType): ApiPromise | null {
    return this.connections.get(network)?.api || null
  }

  /**
   * Fetch transaction history for an address
   * OPTIMIZED: Progressive loading (newest first) + Parallel block fetching + Fee extraction
   */
  async fetchTransactionHistory(
    network: NetworkType,
    filter: TransactionFilter
  ): Promise<SubstrateTransaction[]> {
    const connection = this.connections.get(network)
    if (!connection || !connection.isConnected) {
      throw new Error(`Not connected to ${network}`)
    }

    const { api } = connection
    const {
      address,
      startBlock = 1,
      endBlock,
      limit = 100,
      onProgress,
    } = filter

    const transactions: SubstrateTransaction[] = []

    try {
      // Report connecting stage
      onProgress?.({
        stage: 'connecting',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: 0,
        message: 'Getting current block height...',
      })

      // Get current block if endBlock not specified
      const finalEndBlock =
        endBlock || (await api.rpc.chain.getHeader()).number.toNumber()
      const totalBlocks = finalEndBlock - startBlock + 1

      onProgress?.({
        stage: 'fetching',
        currentBlock: finalEndBlock,
        totalBlocks,
        blocksScanned: 0,
        transactionsFound: 0,
        message: `Starting sync from block #${finalEndBlock.toLocaleString()}`,
      })

      // OPTIMIZATION: Start from newest blocks and work backward
      const batchSize = 20 // Smaller batch for parallel processing
      let currentBlock = finalEndBlock
      let blocksScanned = 0

      while (currentBlock >= startBlock && transactions.length < limit) {
        const startBatch = Math.max(currentBlock - batchSize + 1, startBlock)
        const blocksToFetch = []

        // Build array of block numbers to fetch (in descending order)
        for (let blockNum = currentBlock; blockNum >= startBatch; blockNum--) {
          blocksToFetch.push(blockNum)
        }

        // Report fetching progress
        onProgress?.({
          stage: 'fetching',
          currentBlock,
          totalBlocks,
          blocksScanned,
          transactionsFound: transactions.length,
          message: `Scanning blocks ${startBatch.toLocaleString()} - ${currentBlock.toLocaleString()}`,
        })

        // OPTIMIZATION: Parallel block fetching with Promise.all
        const blockDataPromises = blocksToFetch.map(async blockNum => {
          return this.fetchBlockTransactions(api, blockNum, address, network)
        })

        const blockDataResults = await Promise.all(blockDataPromises)

        // Flatten and add to transactions (already in newest-first order)
        for (const blockTxs of blockDataResults) {
          for (const tx of blockTxs) {
            if (transactions.length < limit) {
              transactions.push(tx)
            } else {
              break
            }
          }
          if (transactions.length >= limit) break
        }

        blocksScanned += blocksToFetch.length
        currentBlock = startBatch - 1

        // Report processing progress
        onProgress?.({
          stage: 'processing',
          currentBlock,
          totalBlocks,
          blocksScanned,
          transactionsFound: transactions.length,
          message: `Found ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`,
        })
      }

      // Report completion
      onProgress?.({
        stage: 'complete',
        currentBlock: Math.max(currentBlock, startBlock),
        totalBlocks,
        blocksScanned,
        transactionsFound: transactions.length,
        message: `Sync complete: ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} found`,
      })

      return transactions
    } catch (error) {
      console.error(`Error fetching transactions for ${address}:`, error)
      throw error
    }
  }

  /**
   * Fetch transaction history using HYBRID approach (Subscan + RPC)
   * FAST: Uses Subscan API for historical data, RPC for recent blocks
   * This provides instant results for historical data while keeping live data fresh
   */
  async fetchTransactionHistoryHybrid(
    network: NetworkType,
    filter: TransactionFilter
  ): Promise<SubstrateTransaction[]> {
    const { address, startBlock = 1, limit = 100, onProgress } = filter
    const allTransactions: SubstrateTransaction[] = []
    // Scan last 1000 blocks via RPC for recent transactions
    // Older transactions are fetched instantly from Subscan API
    const RECENT_BLOCKS_CUTOFF = 1000 // ~1.7 hours on Polkadot at 6s/block

    // Check if this is an EVM address on an EVM-compatible chain (Moonbeam, Moonriver)
    const isEVMChain = network === 'moonbeam' || network === 'moonriver'
    const isEVMAddress = address.startsWith('0x')

    if (isEVMChain && isEVMAddress) {
      // Use Moonscan for EVM addresses on Moonbeam/Moonriver
      if (!moonscanService.isAvailable(network)) {
        throw new Error(`Moonscan not available for ${network}`)
      }

      try {
        onProgress?.({
          stage: 'fetching',
          currentBlock: 0,
          totalBlocks: 0,
          blocksScanned: 0,
          transactionsFound: 0,
          message: 'Fetching EVM transactions from Moonscan...',
        })

        const evmTransactions = await moonscanService.fetchAllTransactions(
          network,
          address,
          {
            limit,
            onProgress: (stage, current, total) => {
              onProgress?.({
                stage: 'fetching',
                currentBlock: 0,
                totalBlocks: total,
                blocksScanned: current,
                transactionsFound: current,
                message: stage,
              })
            },
          }
        )

        onProgress?.({
          stage: 'complete',
          currentBlock: 0,
          totalBlocks: 0,
          blocksScanned: evmTransactions.length,
          transactionsFound: evmTransactions.length,
          message: `Found ${evmTransactions.length} EVM transaction${evmTransactions.length !== 1 ? 's' : ''}`,
        })

        return evmTransactions
      } catch (error) {
        console.error('🚀 [Hybrid] Moonscan fetch failed:', error)
        throw new Error(
          `Failed to fetch EVM transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    try {
      // Initialize variables needed across phases
      let currentBlock = 0
      let recentBlockStart = 0

      // PHASE 1: Fetch historical data from Subscan (instant)
      // Using Subscan API v2 endpoint
      if (subscanService.isAvailable(network)) {
        try {
          onProgress?.({
            stage: 'fetching',
            currentBlock: 0,
            totalBlocks: 0,
            blocksScanned: 0,
            transactionsFound: 0,
            message: 'Fetching historical transactions from Subscan API...',
          })

          const subscanTxs = await subscanService.fetchAllTransactions(
            network,
            address,
            {
              limit: Math.min(limit, 100), // Subscan API max is 100 rows
              onProgress: (stage, current, _total) => {
                onProgress?.({
                  stage: 'fetching',
                  currentBlock: 0,
                  totalBlocks: 0,
                  blocksScanned: 0,
                  transactionsFound: current,
                  message: stage,
                })
              },
            }
          )

          // DON'T filter yet - we don't know the current block until RPC connects
          // Just add all Subscan transactions for now
          allTransactions.push(...subscanTxs)

          onProgress?.({
            stage: 'processing',
            currentBlock: 0,
            totalBlocks: 0,
            blocksScanned: 0,
            transactionsFound: allTransactions.length,
            message: `Loaded ${allTransactions.length} transactions from Subscan`,
          })
        } catch (error) {
          console.error('Subscan fetch failed, will use RPC only:', error)

          onProgress?.({
            stage: 'fetching',
            currentBlock: 0,
            totalBlocks: 0,
            blocksScanned: 0,
            transactionsFound: 0,
            message:
              'Subscan blocked - using slow blockchain scan (may take several minutes)...',
          })
        }
      }

      // PHASE 2: Fetch recent blocks via RPC (for live data)
      // This phase is optional - if it fails, we still have Subscan data
      let api: ApiPromise | null = null

      try {
        // Try to connect to RPC (with short timeout)
        const connection = this.connections.get(network)
        if (!connection || !connection.isConnected) {
          // Set a timeout for RPC connection
          const connectPromise = this.connect(network)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('RPC connection timeout')), 10000)
          )

          await Promise.race([connectPromise, timeoutPromise])
        }

        api = this.getApi(network)
        if (!api) {
          throw new Error('Failed to get API connection')
        }

        // Get current block height
        const currentBlockHeader = await api.rpc.chain.getHeader()
        currentBlock = currentBlockHeader.number.toNumber()
        recentBlockStart = Math.max(
          currentBlock - RECENT_BLOCKS_CUTOFF,
          startBlock
        )
      } catch (rpcError) {
        console.warn('RPC connection failed, skipping recent block scan:', rpcError)

        // Skip Phase 2 if RPC fails - we already have historical data from Subscan
        // Deduplicate and return what we have
        const seen = new Set<string>()
        const deduplicated = allTransactions.filter(tx => {
          if (seen.has(tx.id)) return false
          seen.add(tx.id)
          return true
        })

        const final = deduplicated.slice(0, limit)

        onProgress?.({
          stage: 'complete',
          currentBlock: 0,
          totalBlocks: 0,
          blocksScanned: 0,
          transactionsFound: final.length,
          message: `Found ${final.length} transactions from Subscan (RPC unavailable)`,
        })

        return final
      }

      onProgress?.({
        stage: 'fetching',
        currentBlock: currentBlock,
        totalBlocks: RECENT_BLOCKS_CUTOFF,
        blocksScanned: 0,
        transactionsFound: allTransactions.length,
        message: `Scanning recent blocks (${recentBlockStart.toLocaleString()} - ${currentBlock.toLocaleString()})...`,
      })

      const batchSize = 20
      let scanBlock = currentBlock
      let blocksScanned = 0
      const recentTxs: SubstrateTransaction[] = []

      while (scanBlock >= recentBlockStart && recentTxs.length < limit) {
        const startBatch = Math.max(scanBlock - batchSize + 1, recentBlockStart)
        const blocksToFetch = []

        for (let blockNum = scanBlock; blockNum >= startBatch; blockNum--) {
          blocksToFetch.push(blockNum)
        }

        // Report progress
        onProgress?.({
          stage: 'fetching',
          currentBlock: scanBlock,
          totalBlocks: RECENT_BLOCKS_CUTOFF,
          blocksScanned,
          transactionsFound: allTransactions.length + recentTxs.length,
          message: `Scanning recent blocks ${startBatch.toLocaleString()} - ${scanBlock.toLocaleString()}`,
        })

        // Parallel block fetching
        const blockDataPromises = blocksToFetch.map(async blockNum => {
          return this.fetchBlockTransactions(api, blockNum, address, network)
        })

        const blockDataResults = await Promise.all(blockDataPromises)

        // Collect results
        for (const blockTxs of blockDataResults) {
          recentTxs.push(...blockTxs)
        }

        blocksScanned += blocksToFetch.length
        scanBlock = startBatch - 1
      }

      // PHASE 3: Merge and deduplicate
      allTransactions.push(...recentTxs)

      onProgress?.({
        stage: 'processing',
        currentBlock: currentBlock,
        totalBlocks: RECENT_BLOCKS_CUTOFF,
        blocksScanned,
        transactionsFound: allTransactions.length,
        message: 'Merging and deduplicating transactions...',
      })

      // Deduplicate by transaction ID
      const seen = new Set<string>()
      const deduplicated = allTransactions.filter(tx => {
        if (seen.has(tx.id)) return false
        seen.add(tx.id)
        return true
      })

      // Sort by block number descending (newest first)
      deduplicated.sort((a, b) => b.blockNumber - a.blockNumber)

      // Limit results
      const final = deduplicated.slice(0, limit)

      onProgress?.({
        stage: 'complete',
        currentBlock: currentBlock,
        totalBlocks: RECENT_BLOCKS_CUTOFF,
        blocksScanned,
        transactionsFound: final.length,
        message: `Found ${final.length} transaction${final.length !== 1 ? 's' : ''} (${allTransactions.length - recentTxs.length} from Subscan, ${recentTxs.length} from blockchain)`,
      })

      return final
    } catch (error) {
      console.error(`Hybrid fetch failed for ${address}:`, error)

      // Provide more helpful error messages
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('Failed to connect')) {
        throw new Error(
          'Unable to connect to Polkadot network. Please check your internet connection and try again. ' +
            'If the problem persists, the RPC nodes may be temporarily unavailable.'
        )
      }

      if (errorMessage.includes('Subscan')) {
        throw new Error(
          'Subscan API is currently unavailable. The sync will take longer as it scans the blockchain directly. ' +
            'Please be patient or try again later.'
        )
      }

      throw error
    }
  }

  /**
   * Fetch all transactions from a single block for a given address
   * OPTIMIZED: Extracts fees and staking rewards
   */
  private async fetchBlockTransactions(
    api: ApiPromise,
    blockNum: number,
    address: string,
    network: NetworkType
  ): Promise<SubstrateTransaction[]> {
    const transactions: SubstrateTransaction[] = []

    try {
      const blockHash = await api.rpc.chain.getBlockHash(blockNum)
      const signedBlock = await api.rpc.chain.getBlock(blockHash)
      const apiAt = await api.at(blockHash)
      const allRecords = (await apiAt.query.system.events()) as Vec<EventRecord>

      // Get block timestamp
      const timestamp = (await apiAt.query.timestamp.now()) as Moment
      const blockTime = new Date(timestamp.toNumber())

      // Define event type for mapped events
      type MappedEvent = {
        method: string
        section: string
        data: Record<string, unknown>
      }

      // Process each extrinsic
      signedBlock.block.extrinsics.forEach((extrinsic, index: number) => {
        const {
          method: { method, section },
          signer,
        } = extrinsic

        // Get events for this extrinsic
        const events: MappedEvent[] = allRecords
          .filter(
            (record: EventRecord) =>
              record.phase.isApplyExtrinsic &&
              record.phase.asApplyExtrinsic.eq(index)
          )
          .map((record: EventRecord) => ({
            method: record.event.method,
            section: record.event.section,
            data: record.event.data.toJSON() as Record<string, unknown>,
          }))

        // Check if this transaction involves our address
        // Handle unsigned extrinsics (signer may be null)
        const signerAddress = signer ? signer.toString() : null
        let isRelevant = signerAddress === address

        // Also check transfer events and staking rewards
        events.forEach(event => {
          if (event.section === 'balances' && event.method === 'Transfer') {
            const data = event.data as {
              from: string
              to: string
              amount: string
            }
            if (data.from === address || data.to === address) {
              isRelevant = true
            }
          }
          // OPTIMIZATION: Check staking rewards
          if (event.section === 'staking' && event.method === 'Rewarded') {
            const data = event.data as { stash: string; amount: string }
            if (data.stash === address) {
              isRelevant = true
            }
          }
        })

        if (isRelevant) {
          // Find success/failure event
          const isSuccess = events.some(
            e => e.section === 'system' && e.method === 'ExtrinsicSuccess'
          )

          // Extract transfer details
          const transferEvent = events.find(
            e => e.section === 'balances' && e.method === 'Transfer'
          )
          const transferData = transferEvent?.data as {
            from?: string
            to?: string
            amount?: string
          }

          // OPTIMIZATION: Extract transaction fee
          const feeEvent = events.find(
            e =>
              e.section === 'transactionPayment' &&
              e.method === 'TransactionFeePaid'
          )
          const feeData = feeEvent?.data as {
            who?: string
            actualFee?: string
            tip?: string
          }
          const fee = feeData?.actualFee || '0'

          // OPTIMIZATION: Extract staking reward
          const rewardEvent = events.find(
            e => e.section === 'staking' && e.method === 'Rewarded'
          )
          const rewardData = rewardEvent?.data as {
            stash?: string
            amount?: string
          }
          const rewardAmount = rewardData?.amount

          // Determine value and transaction type
          let value = transferData?.amount || '0'
          let transactionType = this.classifyTransactionType(section, method)
          let from = transferData?.from || signerAddress || ''
          let to = transferData?.to || ''

          // Special handling for staking rewards
          if (rewardEvent && rewardAmount) {
            value = rewardAmount
            transactionType = 'staking'
            from = 'Staking Rewards'
            to = address
          }

          const transaction: SubstrateTransaction = {
            id: `${blockNum}-${index}`,
            hash: extrinsic.hash.toHex(),
            blockNumber: blockNum,
            timestamp: blockTime,
            from,
            to,
            value,
            fee, // OPTIMIZATION: Real fee extracted from events
            status: isSuccess ? 'success' : 'failed',
            network,
            type: transactionType,
            method,
            section,
            events,
            isSigned: extrinsic.isSigned,
          }

          transactions.push(transaction)
        }
      })
    } catch (error) {
      console.error(`Error fetching block ${blockNum}:`, error)
      // Continue with other blocks even if one fails
    }

    return transactions
  }

  /**
   * Get current balance for an address
   */
  async getBalance(network: NetworkType, address: string): Promise<string> {
    const api = this.getApi(network)
    if (!api) {
      throw new Error(`Not connected to ${network}`)
    }

    const account = await api.query.system.account(address)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (account as any).data.free.toString()
  }

  /**
   * Subscribe to new blocks
   */
  async subscribeNewBlocks(
    network: NetworkType,
    callback: (header: Header) => void
  ): Promise<() => void> {
    const api = this.getApi(network)
    if (!api) {
      throw new Error(`Not connected to ${network}`)
    }

    const unsubscribe = await api.rpc.chain.subscribeNewHeads(header => {
      callback(header)
    })

    return unsubscribe
  }

  /**
   * Subscribe to balance changes for an address
   */
  async subscribeBalance(
    network: NetworkType,
    address: string,
    callback: (balance: string) => void
  ): Promise<() => void> {
    const api = this.getApi(network)
    if (!api) {
      throw new Error(`Not connected to ${network}`)
    }

    const unsubscribe = (await api.query.system.account(
      address,
      (account: AccountInfo) => {
        callback(account.data.free.toString())
      }
    )) as unknown as () => void

    return unsubscribe
  }

  /**
   * Classify transaction type based on method and section
   */
  private static classifyTransactionType(
    section: string,
    method: string
  ): SubstrateTransaction['type'] {
    if (section === 'balances' && method === 'transfer') return 'transfer'
    if (section === 'staking') return 'staking'
    if (section === 'xcmPallet' || section === 'polkadotXcm') return 'xcm'
    if (
      section === 'democracy' ||
      section === 'council' ||
      section === 'treasury'
    ) {
      return 'governance'
    }
    return 'other'
  }

  /**
   * Disconnect from network
   */
  async disconnect(network: NetworkType): Promise<void> {
    const connection = this.connections.get(network)
    if (connection) {
      await connection.api.disconnect()
      this.connections.delete(network)
    }

    const provider = this.wsProviders.get(network)
    if (provider) {
      await provider.disconnect()
      this.wsProviders.delete(network)
    }
  }

  /**
   * Disconnect from all networks
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(
      network => this.disconnect(network)
    )
    await Promise.all(disconnectPromises)
  }
}

export const polkadotService = new PolkadotService()
