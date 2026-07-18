/**
 * Vitest Flakiness Simulation Tests — Phase 4a Part 2
 *
 * Tests inject Moonscan/Etherscan-class provider outages (5xx, timeouts,
 * partial response payloads) via mocked Tauri invoke. The import path
 * must surface graceful "provider temporarily unavailable" errors and
 * never leak raw API errors to the frontend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchTransactionsResilient,
  loadSyncStatus,
  saveSyncStatus,
  syncMultipleWallets,
} from './resilientSyncService'

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

// Sample transaction data for successful responses
const SAMPLE_TX = {
  hash: '0xabc123',
  chain_id: { chain_type: 'evm', network: 'ethereum', chain_id: 1 },
  block_number: 19000000,
  timestamp: 1720000000,
  from: '0x1234567890123456789012345678901234567890',
  to: '0x0987654321098765432109876543210987654321',
  value: '1000000000000000000',
  fee: '21000000000000',
  status: 'success',
  tx_type: 'transfer',
  token_transfers: [],
  raw_data: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// =============================================================================
// PROVIDER FLAKINESS SIMULATION
// =============================================================================

describe('Provider outage simulation', () => {
  it('should return graceful error on 5xx server error', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for ethereum. Tried: Etherscan V2 (ethereum). Last error: API error: 500 Internal Server Error'
    )

    const result = await fetchTransactionsResilient('ethereum', '0xabc')

    expect(result.success).toBe(false)
    expect(result.transactions).toEqual([])
    expect(result.count).toBe(0)
    expect(result.isTransient).toBe(true)
    expect(result.error).toContain('temporarily unavailable')
    expect(result.error).not.toContain('500') // No raw error codes leaked
  })

  it('should return graceful error on timeout', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for polygon. Tried: Etherscan V2 (polygon), Alchemy (polygon). Last error: Connection failed: request timed out'
    )

    const result = await fetchTransactionsResilient('polygon', '0xdef')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(true)
    expect(result.error).toContain('temporarily unavailable')
  })

  it('should return graceful error on rate limit (429)', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for arbitrum. Tried: Etherscan V2 (arbitrum). Last error: Rate limited'
    )

    const result = await fetchTransactionsResilient('arbitrum', '0xghi')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(true)
    expect(result.error).toContain('arbitrum')
    expect(result.error).toContain('temporarily unavailable')
  })

  it('should return graceful error on partial response / parse failure', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for moonbeam. Tried: Etherscan V2 (moonbeam). Last error: API error: unexpected end of JSON input'
    )

    const result = await fetchTransactionsResilient('moonbeam', '0xjkl')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(true)
  })

  it('should return non-transient error for permanent failures', async () => {
    mockInvoke.mockRejectedValueOnce('Invalid address: 0xbad')

    const result = await fetchTransactionsResilient('ethereum', '0xbad')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(false)
    expect(result.error).toContain('Failed to sync')
  })

  it('should return transactions on successful sync', async () => {
    mockInvoke.mockResolvedValueOnce([SAMPLE_TX])

    const result = await fetchTransactionsResilient('ethereum', '0xabc')

    expect(result.success).toBe(true)
    expect(result.transactions).toHaveLength(1)
    expect(result.count).toBe(1)
    expect(result.transactions[0].hash).toBe('0xabc123')
    expect(result.error).toBeUndefined()
  })

  it('should return empty list on successful sync with no new transactions', async () => {
    mockInvoke.mockResolvedValueOnce([])

    const result = await fetchTransactionsResilient('ethereum', '0xabc')

    expect(result.success).toBe(true)
    expect(result.transactions).toHaveLength(0)
    expect(result.count).toBe(0)
  })
})

// =============================================================================
// CHAIN-SPECIFIC FLAKINESS
// =============================================================================

describe('Chain-specific provider failures', () => {
  it('should handle Solana RPC failure gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for solana. Tried: Solana RPC (solana), Solana Public RPC (solana). Last error: Connection failed: connection refused'
    )

    const result = await fetchTransactionsResilient('solana', 'SoL...')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(true)
    expect(result.error).toContain('solana')
  })

  it('should handle Bitcoin Mempool.space failure gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for bitcoin. Tried: Mempool.space (bitcoin), Blockstream (bitcoin). Last error: API error: 503 Service Unavailable'
    )

    const result = await fetchTransactionsResilient('bitcoin', 'bc1q...')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(true)
    expect(result.error).toContain('bitcoin')
  })

  it('should handle Moonbeam Etherscan V2 key rejection gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for moonbeam. Tried: Etherscan V2 (moonbeam). Last error: API error: Invalid API Key'
    )

    const result = await fetchTransactionsResilient('moonbeam', '0xglmr')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(true)
    // Should not leak "Invalid API Key" to user
    expect(result.error).not.toContain('Invalid API Key')
  })
})

// =============================================================================
// SYNC CURSOR OPERATIONS
// =============================================================================

describe('Sync cursor operations', () => {
  it('should load sync status for a chain+address', async () => {
    const status = {
      chain_id: 'ethereum',
      address: '0xabc',
      last_block_synced: 19000000,
      last_sync_timestamp: 1720000000,
      sync_state: 'idle' as const,
    }
    mockInvoke.mockResolvedValueOnce(status)

    const result = await loadSyncStatus('ethereum', '0xabc')

    expect(result).toEqual(status)
    expect(mockInvoke).toHaveBeenCalledWith('load_chain_sync_status', {
      network: 'ethereum',
      address: '0xabc',
    })
  })

  it('should return null for never-synced address', async () => {
    mockInvoke.mockResolvedValueOnce(null)

    const result = await loadSyncStatus('ethereum', '0xnew')

    expect(result).toBeNull()
  })

  it('should save sync status', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)

    await saveSyncStatus('ethereum', '0xabc', 19500000)

    expect(mockInvoke).toHaveBeenCalledWith('save_chain_sync_status', {
      network: 'ethereum',
      address: '0xabc',
      lastBlock: 19500000,
    })
  })
})

// =============================================================================
// MULTI-WALLET SYNC
// =============================================================================

describe('Multi-wallet resilient sync', () => {
  it('should sync multiple wallets concurrently', async () => {
    // First wallet succeeds
    mockInvoke.mockResolvedValueOnce([SAMPLE_TX])
    // Second wallet fails with transient error
    mockInvoke.mockRejectedValueOnce(
      'Provider temporarily unavailable for polygon. Last error: timeout'
    )

    const results = await syncMultipleWallets([
      { chainId: 'ethereum', address: '0xabc' },
      { chainId: 'polygon', address: '0xdef' },
    ])

    expect(results).toHaveLength(2)

    // First result: success
    expect(results[0].success).toBe(true)
    expect(results[0].count).toBe(1)

    // Second result: graceful failure
    expect(results[1].success).toBe(false)
    expect(results[1].isTransient).toBe(true)
    expect(results[1].error).toContain('temporarily unavailable')
  })

  it('should handle all wallets failing', async () => {
    mockInvoke.mockRejectedValue(
      'Provider temporarily unavailable for all. Last error: server down'
    )

    const results = await syncMultipleWallets([
      { chainId: 'ethereum', address: '0xa' },
      { chainId: 'solana', address: 'So...' },
      { chainId: 'bitcoin', address: 'bc1q...' },
    ])

    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r.success).toBe(false)
      expect(r.isTransient).toBe(true)
    }
  })

  it('should handle all wallets succeeding', async () => {
    mockInvoke.mockResolvedValue([SAMPLE_TX])

    const results = await syncMultipleWallets([
      { chainId: 'ethereum', address: '0xa' },
      { chainId: 'solana', address: 'So...' },
    ])

    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.success).toBe(true)
      expect(r.count).toBe(1)
    }
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge cases', () => {
  it('should handle Error objects thrown from invoke', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network request failed'))

    const result = await fetchTransactionsResilient('ethereum', '0xabc')

    expect(result.success).toBe(false)
    expect(result.isTransient).toBe(false)
    expect(result.error).toContain('Network request failed')
  })

  it('should handle non-string errors from invoke', async () => {
    mockInvoke.mockRejectedValueOnce({ code: 500, message: 'Internal Error' })

    const result = await fetchTransactionsResilient('ethereum', '0xabc')

    expect(result.success).toBe(false)
    // toString of object
    expect(result.error).toBeDefined()
  })

  it('should invoke the correct command name', async () => {
    mockInvoke.mockResolvedValueOnce([])

    await fetchTransactionsResilient('ethereum', '0xabc')

    expect(mockInvoke).toHaveBeenCalledWith(
      'chain_fetch_transactions_resumable',
      { chainId: 'ethereum', address: '0xabc' }
    )
  })
})
