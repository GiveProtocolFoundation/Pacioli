/**
 * Subscan API Service
 * Fast transaction retrieval using Subscan's indexed blockchain data
 * Used for instant historical transaction fetching (hybrid with RPC)
 */

import type { NetworkType, SubstrateTransaction } from '../wallet/types'

interface SubscanConfig {
  baseUrl: string
  apiKey?: string
}

interface SubscanTransfer {
  block_num: number
  block_timestamp: number
  extrinsic_index: string
  hash: string
  from: string
  to: string
  amount: string // Formatted amount (e.g., "1.5")
  amount_v2: string // Raw amount in planck (e.g., "15000000000")
  fee: string
  success: boolean
  module: string
  call_module?: string // Alternative field name
  call_module_function?: string // The actual method/function name
  asset_symbol?: string
  event_idx?: number
  event_id?: string
  // CRITICAL: Account display information contains semantic data!
  from_account_display?: {
    address?: string
    display?: string // e.g., "Pool#20(Reward)", "Treasury", "Staking"
    people?: {
      display?: string
    }
  }
  to_account_display?: {
    address?: string
    display?: string
    people?: {
      display?: string
    }
  }
  // Additional event/action data
  event?: {
    module_id?: string
    event_id?: string
    event_index?: string
  }
  // Extrinsic data that might be included
  extrinsic?: {
    call_module?: string
    call_module_function?: string
  }
}

interface SubscanReward {
  block_num: number
  block_timestamp: number
  extrinsic_index: string
  event_index: string
  amount: string
  module: string
  event_id: string
}

interface SubscanExtrinsic {
  block_num: number
  block_timestamp: number
  extrinsic_index: string
  hash: string
  call_module: string
  call_module_function: string
  account_id: string
  success: boolean
  fee: string
  params?: string
}

interface SubscanResponse<T> {
  code: number
  message: string
  data: {
    count: number
    transfers?: T[]
    list?: T[]
  }
}

class SubscanService {
  private readonly NETWORK_CONFIGS: Record<NetworkType, SubscanConfig> = {
    polkadot: { baseUrl: 'https://polkadot.api.subscan.io' },
    kusama: { baseUrl: 'https://kusama.api.subscan.io' },
    moonbeam: { baseUrl: 'https://moonbeam.api.subscan.io' },
    moonriver: { baseUrl: 'https://moonriver.api.subscan.io' },
    astar: { baseUrl: 'https://astar.api.subscan.io' },
    acala: { baseUrl: 'https://acala.api.subscan.io' },
  }

  /**
   * Fetch all transfers for an address
   */
  async fetchTransfers(
    network: NetworkType,
    address: string,
    options: {
      row?: number
      page?: number
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<SubstrateTransaction[]> {
    const config = this.NETWORK_CONFIGS[network]
    if (!config) {
      throw new Error(`Subscan not configured for ${network}`)
    }

    const { row = 100, page = 0, onProgress } = options
    const transactions: SubstrateTransaction[] = []

    console.log(`🔍 [Subscan] fetchTransfers: ${network}:${address}, row=${row}, page=${page}`)

    try {
      // Fetch transfers (sent + received)
      // Use correct Subscan API v2 endpoint
      const response = await this.makeRequest<SubscanResponse<SubscanTransfer>>(
        config,
        '/api/v2/scan/transfers',
        {
          row,
          page,
          address,
        }
      ).catch(err => {
        // Enhance error message for CORS issues
        if (err instanceof TypeError && err.message.includes('NetworkError')) {
          console.error('🚨 [Subscan] CORS or Network Error - Subscan API may be blocked by browser')
          console.error('🚨 This is likely due to CORS restrictions or browser extensions blocking the request')
          console.error('🚨 The app will fall back to slower RPC scanning')
        }
        throw err
      })

      console.log(`🔍 [Subscan] API Response code: ${response.code}, message: ${response.message}`)
      console.log(`🔍 [Subscan] Total count from API: ${response.data.count}`)

      if (response.code === 0) {
        // Subscan might return data.transfers or data.list
        const transfers = response.data.transfers || response.data.list || []
        console.log(`🔍 [Subscan] Received ${transfers.length} transfer records from API`)

        // Debug: Log first transfer to see what data we're getting
        if (transfers.length > 0) {
          console.log('🔍 [Subscan] Sample transfer data:', JSON.stringify(transfers[0], null, 2))
        }

        onProgress?.(transfers.length, response.data.count || 0)

        for (const transfer of transfers) {
          // Extract detailed action information
          const actionInfo = this.extractActionFromTransfer(transfer)

          console.log(
            `🔍 [Subscan] Transfer ${transfer.block_num}-${transfer.extrinsic_index}: ${actionInfo.section}.${actionInfo.method}`
          )

          transactions.push({
            id: `${transfer.block_num}-${transfer.extrinsic_index}`,
            hash: transfer.hash,
            blockNumber: transfer.block_num,
            timestamp: new Date(transfer.block_timestamp * 1000),
            from: transfer.from,
            to: transfer.to,
            value: transfer.amount_v2, // Use raw planck value
            fee: transfer.fee,
            status: transfer.success ? 'success' : 'failed',
            network,
            type: actionInfo.type,
            method: actionInfo.method,
            section: actionInfo.section,
            events: [],
            isSigned: true,
          })
        }
      }

      return transactions
    } catch (error) {
      console.error('Subscan transfer fetch failed:', error)
      throw error
    }
  }

  /**
   * Fetch staking rewards for an address
   */
  async fetchRewards(
    network: NetworkType,
    address: string,
    options: {
      row?: number
      page?: number
    } = {}
  ): Promise<SubstrateTransaction[]> {
    const config = this.NETWORK_CONFIGS[network]
    if (!config) {
      throw new Error(`Subscan not configured for ${network}`)
    }

    const { row = 100, page = 0 } = options
    const transactions: SubstrateTransaction[] = []

    try {
      const response = await this.makeRequest<SubscanResponse<SubscanReward>>(
        config,
        '/api/scan/account/reward_slash',
        {
          address,
          row,
          page,
          is_stash: true,
        }
      )

      if (response.code === 0 && response.data.list) {
        for (const reward of response.data.list) {
          transactions.push({
            id: `${reward.block_num}-${reward.event_index}`,
            hash: '', // Rewards don't have transaction hashes
            blockNumber: reward.block_num,
            timestamp: new Date(reward.block_timestamp * 1000),
            from: 'Staking Rewards',
            to: address,
            value: reward.amount,
            fee: '0',
            status: 'success',
            network,
            type: 'staking',
            method: 'Rewarded',
            section: 'staking',
            events: [],
            isSigned: false,
          })
        }
      }

      return transactions
    } catch (error) {
      console.error('Subscan reward fetch failed:', error)
      // Don't throw - rewards are optional
      return []
    }
  }

  /**
   * Fetch all extrinsics for an address (for governance, XCM, etc.)
   */
  async fetchExtrinsics(
    network: NetworkType,
    address: string,
    options: {
      row?: number
      page?: number
    } = {}
  ): Promise<SubstrateTransaction[]> {
    const config = this.NETWORK_CONFIGS[network]
    if (!config) {
      throw new Error(`Subscan not configured for ${network}`)
    }

    const { row = 100, page = 0 } = options
    const transactions: SubstrateTransaction[] = []

    try {
      const response = await this.makeRequest<SubscanResponse<SubscanExtrinsic>>(
        config,
        '/api/scan/extrinsics',
        {
          address,
          row,
          page,
        }
      )

      if (response.code === 0 && response.data.list) {
        for (const extrinsic of response.data.list) {
          const type = this.classifyExtrinsicType(
            extrinsic.call_module,
            extrinsic.call_module_function
          )

          transactions.push({
            id: `${extrinsic.block_num}-${extrinsic.extrinsic_index}`,
            hash: extrinsic.hash,
            blockNumber: extrinsic.block_num,
            timestamp: new Date(extrinsic.block_timestamp * 1000),
            from: extrinsic.account_id,
            to: '', // Varies by type
            value: '0',
            fee: extrinsic.fee,
            status: extrinsic.success ? 'success' : 'failed',
            network,
            type,
            method: extrinsic.call_module_function,
            section: extrinsic.call_module,
            events: [],
            isSigned: true,
          })
        }
      }

      return transactions
    } catch (error) {
      console.error('Subscan extrinsic fetch failed:', error)
      // Don't throw - extrinsics are optional
      return []
    }
  }

  /**
   * Fetch all transactions for an address (transfers + rewards + extrinsics)
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

    console.log(`🔍 [Subscan] fetchAllTransactions called for ${network}:${address}`)
    console.log(`🔍 [Subscan] Limit: ${limit}`)

    try {
      // 1. Fetch transfers (most common)
      console.log('🔍 [Subscan] Fetching transfers...')
      onProgress?.('Fetching transfers from Subscan...', 0, limit)
      const transfers = await this.fetchTransfers(network, address, {
        row: limit,
        page: 0,
        onProgress: (current, total) => {
          onProgress?.('Fetching transfers from Subscan...', current, total)
        },
      })
      console.log(`🔍 [Subscan] Received ${transfers.length} transfers`)

      // 2. Try to fetch extrinsics for detailed method names
      // Skip this if we already have good data from transfers
      console.log('🔍 [Subscan] Attempting to fetch extrinsics for method details...')
      let extrinsics: SubstrateTransaction[] = []

      // Only fetch extrinsics if transfers succeeded and we want enhanced data
      // This reduces API calls and avoids rate limiting
      try {
        console.log('🔍 [Subscan] Fetching extrinsics endpoint...')
        onProgress?.('Fetching transaction details...', 0, 0)

        // Add small delay to avoid rate limiting (250ms)
        await new Promise(resolve => setTimeout(resolve, 250))

        extrinsics = await this.fetchExtrinsics(network, address, {
          row: limit,
          page: 0,
        })
        console.log(`🔍 [Subscan] ✅ Received ${extrinsics.length} extrinsics`)
      } catch (error) {
        console.warn('🔍 [Subscan] ⚠️  Failed to fetch extrinsics, using transfer data only')
        console.warn('🔍 [Subscan] Error:', error)
        console.warn('🔍 [Subscan] This may be due to rate limiting or CORS restrictions')
        console.warn('🔍 [Subscan] Transaction types will show as generic "balances.transfer"')
        // Continue without extrinsic details if this fails
      }

      // 3. Create a map of extrinsics by block+index for quick lookup
      const extrinsicMap = new Map<string, SubstrateTransaction>()
      extrinsics.forEach((ext) => {
        extrinsicMap.set(ext.id, ext)
      })

      // 4. Enhance transfers with method information from extrinsics
      const enhancedTransfers = transfers.map((transfer) => {
        const matchingExt = extrinsicMap.get(transfer.id)
        if (matchingExt) {
          // Use method and section from extrinsic data
          return {
            ...transfer,
            method: matchingExt.method,
            section: matchingExt.section,
            type: matchingExt.type,
          }
        }
        return transfer
      })

      allTransactions.push(...enhancedTransfers)
      console.log(`🔍 [Subscan] Enhanced ${enhancedTransfers.length} transfers with method details`)

      // 5. Add non-transfer extrinsics (governance, XCM, staking, etc.)
      const nonTransferExtrinsics = extrinsics.filter(
        (ext) => !(ext.section === 'balances' && ext.method.includes('transfer'))
      )
      allTransactions.push(...nonTransferExtrinsics)
      console.log(`🔍 [Subscan] Added ${nonTransferExtrinsics.length} non-transfer extrinsics`)

      // 6. Fetch staking rewards (if applicable)
      if (network === 'polkadot' || network === 'kusama') {
        console.log('🔍 [Subscan] Fetching staking rewards...')
        onProgress?.('Fetching staking rewards from Subscan...', 0, 0)
        const rewards = await this.fetchRewards(network, address, {
          row: Math.min(limit, 50),
          page: 0,
        })
        console.log(`🔍 [Subscan] Received ${rewards.length} staking rewards`)
        allTransactions.push(...rewards)
      }

      // Sort by block number descending (newest first)
      console.log(`🔍 [Subscan] Total before dedup: ${allTransactions.length}`)
      allTransactions.sort((a, b) => b.blockNumber - a.blockNumber)

      // Deduplicate by ID
      const seen = new Set<string>()
      const deduplicated = allTransactions.filter((tx) => {
        if (seen.has(tx.id)) return false
        seen.add(tx.id)
        return true
      })

      console.log(`🔍 [Subscan] After dedup: ${deduplicated.length}, returning: ${Math.min(deduplicated.length, limit)}`)
      const result = deduplicated.slice(0, limit)
      console.log(`🔍 [Subscan] ✅ Returning ${result.length} transactions to caller`)
      return result
    } catch (error) {
      console.error('Subscan fetch failed:', error)
      throw error
    }
  }

  /**
   * Make HTTP request to Subscan API
   */
  private async makeRequest<T>(
    config: SubscanConfig,
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey
    }

    console.log(`Subscan API Request: ${config.baseUrl}${endpoint}`, body)

    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      mode: 'cors', // Explicitly enable CORS
      credentials: 'omit', // Don't send credentials
    })

    // Read response body once
    const responseText = await response.text()

    if (!response.ok) {
      console.error('Subscan API error response:', responseText)
      throw new Error(
        `Subscan API error: ${response.status} ${response.statusText} - ${responseText}`
      )
    }

    try {
      const data = JSON.parse(responseText)
      console.log('Subscan API Response:', data)
      return data
    } catch (error) {
      console.error('Failed to parse Subscan response:', responseText)
      throw new Error(`Invalid JSON response from Subscan: ${responseText.slice(0, 200)}`)
    }
  }

  /**
   * Extract detailed action from transfer data
   * This provides better classification than just "transfer"
   */
  private extractActionFromTransfer(transfer: SubscanTransfer): {
    method: string
    section: string
    type: SubstrateTransaction['type']
  } {
    // Priority 0: Use account display information (most reliable for Subscan v2 API)
    // This contains semantic data like "Pool#20(Reward)", "Treasury", "Staking", etc.
    const fromDisplay =
      transfer.from_account_display?.display ||
      transfer.from_account_display?.people?.display ||
      ''
    const toDisplay =
      transfer.to_account_display?.display || transfer.to_account_display?.people?.display || ''

    // Parse display strings for action classification
    if (fromDisplay || toDisplay) {
      const displayText = (fromDisplay + ' ' + toDisplay).toLowerCase()

      // Staking rewards - from nomination pools or validators
      if (
        displayText.includes('reward') ||
        (displayText.includes('pool#') && fromDisplay.toLowerCase().includes('reward'))
      ) {
        return {
          method: 'Reward',
          section: 'staking',
          type: 'staking',
        }
      }

      // Nomination pool operations
      if (displayText.includes('pool#') || displayText.includes('nomination')) {
        if (displayText.includes('join') || toDisplay.toLowerCase().includes('pool#')) {
          return {
            method: 'join',
            section: 'nominationPools',
            type: 'staking',
          }
        }
        if (displayText.includes('unbond') || displayText.includes('withdraw')) {
          return {
            method: 'unbond',
            section: 'nominationPools',
            type: 'staking',
          }
        }
        return {
          method: 'pool_transaction',
          section: 'nominationPools',
          type: 'staking',
        }
      }

      // Treasury operations
      if (displayText.includes('treasury')) {
        return {
          method: 'treasury_transfer',
          section: 'treasury',
          type: 'governance',
        }
      }

      // Validator operations
      if (displayText.includes('validator') || displayText.includes('stash')) {
        if (displayText.includes('bond')) {
          return {
            method: 'bond',
            section: 'staking',
            type: 'staking',
          }
        }
        if (displayText.includes('unbond')) {
          return {
            method: 'unbond',
            section: 'staking',
            type: 'staking',
          }
        }
        return {
          method: 'staking_operation',
          section: 'staking',
          type: 'staking',
        }
      }

      // Governance/Council operations
      if (displayText.includes('council') || displayText.includes('governance')) {
        return {
          method: 'governance_action',
          section: 'governance',
          type: 'governance',
        }
      }

      // Crowdloan operations
      if (displayText.includes('crowdloan')) {
        return {
          method: 'contribute',
          section: 'crowdloan',
          type: 'other',
        }
      }
    }

    // Priority 1: Use call_module_function if available
    if (transfer.call_module_function && transfer.call_module) {
      return {
        method: transfer.call_module_function,
        section: transfer.call_module,
        type: this.classifyExtrinsicType(transfer.call_module, transfer.call_module_function),
      }
    }

    // Priority 2: Use extrinsic data if available
    if (transfer.extrinsic?.call_module_function && transfer.extrinsic?.call_module) {
      return {
        method: transfer.extrinsic.call_module_function,
        section: transfer.extrinsic.call_module,
        type: this.classifyExtrinsicType(
          transfer.extrinsic.call_module,
          transfer.extrinsic.call_module_function
        ),
      }
    }

    // Priority 3: Use event data if available
    if (transfer.event?.event_id && transfer.event?.module_id) {
      return {
        method: transfer.event.event_id,
        section: transfer.event.module_id,
        type: this.classifyExtrinsicType(transfer.event.module_id, transfer.event.event_id),
      }
    }

    if (transfer.event_id) {
      return {
        method: transfer.event_id,
        section: transfer.module || 'balances',
        type: this.classifyExtrinsicType(transfer.module || 'balances', transfer.event_id),
      }
    }

    // Priority 4: Use heuristics based on transfer characteristics
    const heuristic = this.detectActionHeuristic(transfer)
    if (heuristic) {
      return heuristic
    }

    // Default: basic transfer
    return {
      method: 'transfer',
      section: transfer.module || 'balances',
      type: 'transfer',
    }
  }

  /**
   * Detect action type using heuristics when explicit data is missing
   */
  private detectActionHeuristic(transfer: SubscanTransfer): {
    method: string
    section: string
    type: SubstrateTransaction['type']
  } | null {
    // Staking reward detection
    if (
      (!transfer.from || transfer.from === '' || transfer.from === 'system') &&
      parseFloat(transfer.amount_v2 || transfer.amount || '0') > 0
    ) {
      // Check if timestamp aligns with era changes (staking rewards)
      const date = new Date(transfer.block_timestamp * 1000)
      const hour = date.getUTCHours()
      // Staking rewards often come at specific hours (era changes)
      if (hour >= 0 && hour <= 2) {
        return {
          method: 'Reward',
          section: 'staking',
          type: 'staking',
        }
      }

      return {
        method: 'Deposit',
        section: 'balances',
        type: 'transfer',
      }
    }

    // Fee payment detection
    if (
      (!transfer.to || transfer.to === '' || transfer.to === 'system') &&
      parseFloat(transfer.amount_v2 || transfer.amount || '0') > 0
    ) {
      return {
        method: 'Withdraw',
        section: 'balances',
        type: 'transfer',
      }
    }

    return null
  }

  /**
   * Classify extrinsic type based on module and function
   */
  private classifyExtrinsicType(
    module: string,
    method: string
  ): SubstrateTransaction['type'] {
    if (module === 'balances') return 'transfer'
    if (module === 'staking') return 'staking'
    if (module === 'xcmPallet' || module === 'polkadotXcm' || module === 'xTokens') {
      return 'xcm'
    }
    if (
      module === 'democracy' ||
      module === 'council' ||
      module === 'treasury' ||
      module === 'phragmenElection' ||
      module === 'convictionVoting'
    ) {
      return 'governance'
    }
    if (module === 'crowdloan') return 'other'
    if (module === 'identity') return 'other'
    if (module === 'utility') return 'transfer'
    return 'other'
  }

  /**
   * Check if Subscan is available for a network
   */
  isAvailable(network: NetworkType): boolean {
    return !!this.NETWORK_CONFIGS[network]
  }

  /**
   * Get the highest block number from Subscan (for determining sync cutoff)
   */
  async getLatestBlock(network: NetworkType): Promise<number> {
    const config = this.NETWORK_CONFIGS[network]
    if (!config) {
      throw new Error(`Subscan not configured for ${network}`)
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/scan/metadata`)
      const data = await response.json()
      return data.data?.blockNum || 0
    } catch (error) {
      console.error('Failed to get latest block from Subscan:', error)
      return 0
    }
  }
}

export const subscanService = new SubscanService()
