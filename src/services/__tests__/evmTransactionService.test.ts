/**
 * Unit tests for evmTransactionService blockchain behaviors:
 *   1. Sort order — fetchTransactionHistory returns transactions in
 *      descending blockNumber order after merging normal txs and token transfers.
 *   2. Parallel fetching — fetchTransactionsViaRPC (RPC fallback) issues
 *      block fetches in parallel batches of 20 via Promise.all.
 *
 * All ethers / fetch network calls are mocked — no real network access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — hoisted by Vitest before any imports
// ---------------------------------------------------------------------------

vi.mock('ethers', () => {
  const mockProvider = {
    getBlockNumber: vi.fn().mockResolvedValue(50),
    getBlock: vi.fn().mockResolvedValue(null), // no matching txs by default
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    getBalance: vi.fn().mockResolvedValue(BigInt('0')),
  }

  return {
    ethers: {
      JsonRpcProvider: vi.fn().mockImplementation(() => mockProvider),
      formatUnits: vi.fn((value: string, decimals: number) =>
        (Number(value) / 10 ** decimals).toString()
      ),
    },
  }
})

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

import { evmTransactionService } from '../blockchain/evmTransactionService'

// ---------------------------------------------------------------------------
// Block-explorer response factory
// ---------------------------------------------------------------------------

function makeExplorerTx(
  hash: string,
  blockNumber: number,
  from: string,
  to: string,
  value = '1000000000000000000'
) {
  return {
    hash,
    blockNumber: String(blockNumber),
    timeStamp: String(Math.floor(Date.now() / 1000)),
    from,
    to,
    value,
    gas: '21000',
    gasPrice: '1000000000',
    gasUsed: '21000',
    isError: '0',
    input: '0x',
  }
}

/** Response that signals no results */
function emptyExplorerResponse() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: '0', result: [] }),
  })
}

const TEST_ADDRESS = '0xUser000000000000000000000000000000000001'
const OTHER_ADDRESS = '0xOther00000000000000000000000000000000002'

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('evmTransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear cached providers so mocks are always fresh
    ;(evmTransactionService as unknown as { providers: Map<string, unknown> }).providers.clear()
  })

  // =========================================================================
  // Behavior 1: Sort order — descending blockNumber
  // =========================================================================

  describe('fetchTransactionHistory — sort order', () => {
    it('returns transactions sorted by blockNumber descending', async () => {
      // Normal transactions come back from the explorer in non-descending order
      const normalTxs = [
        makeExplorerTx('0xhash100', 100, TEST_ADDRESS, OTHER_ADDRESS),
        makeExplorerTx('0xhash50', 50, OTHER_ADDRESS, TEST_ADDRESS),
        makeExplorerTx('0xhash200', 200, TEST_ADDRESS, OTHER_ADDRESS),
      ]

      // fetchNormalTransactions → normal txs; fetchTokenTransfers → empty
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          // First fetch: normal transactions
          await Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: '1', result: normalTxs }),
          })
        )
        .mockResolvedValueOnce(
          // Second fetch: token transfers (rate-limit delay fires, then this)
          await emptyExplorerResponse()
        )

      vi.stubGlobal('fetch', fetchMock)

      const txs = await evmTransactionService.fetchTransactionHistory(
        'moonbeam',
        TEST_ADDRESS,
        { limit: 10 }
      )

      expect(txs.length).toBeGreaterThan(0)

      for (let i = 1; i < txs.length; i++) {
        expect(txs[i - 1].blockNumber).toBeGreaterThanOrEqual(txs[i].blockNumber)
      }

      // Highest block should be first
      expect(txs[0].blockNumber).toBe(200)

      vi.unstubAllGlobals()
    })

    it('deduplicates transactions with the same hash and preserves descending order', async () => {
      const normalTxs = [
        makeExplorerTx('0xhash300', 300, TEST_ADDRESS, OTHER_ADDRESS),
        makeExplorerTx('0xhash100', 100, TEST_ADDRESS, OTHER_ADDRESS),
      ]
      // Token transfer with the same hash as a normal tx → should be deduplicated
      const tokenTxs = [
        {
          hash: '0xhash100',
          blockNumber: '100',
          timeStamp: String(Math.floor(Date.now() / 1000)),
          from: TEST_ADDRESS,
          to: OTHER_ADDRESS,
          value: '5000',
          tokenSymbol: 'USDC',
          tokenDecimal: '6',
          contractAddress: '0xUSDC',
          gas: '50000',
          gasPrice: '1000000000',
          gasUsed: '40000',
        },
      ]

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: '1', result: normalTxs }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: '1', result: tokenTxs }),
        })

      vi.stubGlobal('fetch', fetchMock)

      const txs = await evmTransactionService.fetchTransactionHistory(
        'moonbeam',
        TEST_ADDRESS,
        { limit: 10 }
      )

      // Duplicate hash should appear only once
      const hashes = txs.map(t => t.hash)
      const uniqueHashes = new Set(hashes)
      expect(hashes.length).toBe(uniqueHashes.size)

      // Still sorted descending
      for (let i = 1; i < txs.length; i++) {
        expect(txs[i - 1].blockNumber).toBeGreaterThanOrEqual(txs[i].blockNumber)
      }

      vi.unstubAllGlobals()
    })
  })

  // =========================================================================
  // Behavior 4: Parallel block fetching — batches of 20 via Promise.all
  // =========================================================================

  describe('fetchTransactionsViaRPC — parallel block fetching', () => {
    it('fetches blocks in parallel batches of 20 via Promise.all', async () => {
      // Build a mock provider that returns empty blocks (no matching transactions)
      const mockProvider = {
        getBlockNumber: vi.fn().mockResolvedValue(100),
        getBlock: vi.fn().mockResolvedValue({
          timestamp: Math.floor(Date.now() / 1000),
          prefetchedTransactions: [],
        }),
        getTransactionReceipt: vi.fn().mockResolvedValue(null),
      }

      // Inject mock provider into the private providers map
      ;(evmTransactionService as unknown as { providers: Map<string, unknown> }).providers.set(
        'moonbeam',
        mockProvider
      )

      const promiseAllSpy = vi.spyOn(Promise, 'all')

      // Call the private RPC fallback directly (TypeScript private is runtime-accessible)
      await (
        evmTransactionService as unknown as {
          fetchTransactionsViaRPC(
            chain: string,
            address: string,
            limit: number
          ): Promise<unknown[]>
        }
      ).fetchTransactionsViaRPC('moonbeam', TEST_ADDRESS, 100)

      // Promise.all must have been called (block batches dispatched in parallel)
      expect(promiseAllSpy).toHaveBeenCalled()

      // The first call should carry exactly 20 block promises (batch size = 20)
      const firstBatchArgs = promiseAllSpy.mock.calls[0][0] as unknown[]
      expect(firstBatchArgs).toHaveLength(20)

      promiseAllSpy.mockRestore()
    })
  })
})
