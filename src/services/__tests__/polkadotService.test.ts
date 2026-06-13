/**
 * Unit tests for polkadotService blockchain behaviors:
 *   1. Progressive loading — fetchTransactionHistory / fetchTransactionHistoryHybrid
 *      return transactions in descending blockNumber order.
 *   2. Fee extraction — fetchBlockTransactions extracts actualFee from
 *      transactionPayment.TransactionFeePaid; returns '0' when absent.
 *   3. Staking rewards — fetchBlockTransactions returns type='staking' and
 *      from='Staking Rewards' for staking.Rewarded events.
 *   4. Parallel fetching — batches of 20 blocks are issued via Promise.all.
 *
 * All @polkadot/api interactions are mocked — no network access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NetworkType } from '../wallet/types'

// ---------------------------------------------------------------------------
// Module mocks — hoisted by Vitest before any imports
// ---------------------------------------------------------------------------

vi.mock('../blockchain/xcmCorrelationService', () => ({
  annotateXcmTransactions: vi.fn(),
  correlateXcmTransactions: vi.fn(),
  filterForAccounting: vi.fn(),
}))

vi.mock('../blockchain/priceService', () => ({
  batchCalculateUsdValues: vi.fn().mockResolvedValue([]),
  getCoinGeckoId: vi.fn().mockReturnValue(null), // disables USD enrichment
}))

vi.mock('../blockchain/subscanService', () => ({
  subscanService: {
    isAvailable: vi.fn().mockReturnValue(false),
    fetchAllTransactions: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../blockchain/moonscanService', () => ({
  moonscanService: {
    isAvailable: vi.fn().mockReturnValue(false),
  },
}))

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

import { polkadotService } from '../blockchain/polkadotService'

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_ADDRESS = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const OTHER_ADDRESS = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock Polkadot event record (mimics Vec<EventRecord> member shape).
 * extrinsicIndex controls which extrinsic this event is attached to.
 */
function makeEventRecord(
  section: string,
  method: string,
  data: Record<string, unknown>,
  extrinsicIndex = 0
) {
  return {
    phase: {
      isApplyExtrinsic: true,
      asApplyExtrinsic: { eq: (i: number) => i === extrinsicIndex },
    },
    event: {
      method,
      section,
      data: { toJSON: () => data },
    },
  }
}

/**
 * Build a mock extrinsic. Pass signer=null for unsigned (e.g. staking payouts).
 */
function makeExtrinsic(
  section: string,
  method: string,
  signer: string | null,
  hash = '0xdeadbeef'
) {
  return {
    method: { method, section },
    signer: signer ? { toString: () => signer } : null,
    hash: { toHex: () => hash },
    isSigned: signer !== null,
  }
}

type BlockSpec = {
  extrinsics: ReturnType<typeof makeExtrinsic>[]
  events: ReturnType<typeof makeEventRecord>[]
}

/**
 * Build a minimal ApiPromise mock that answers the calls made inside
 * PolkadotService.fetchBlockTransactions for each configured block.
 *
 * Hash convention: `0xhash<blockNum>` so we can parse it back to the block
 * number when getBlock / at are called.
 */
function buildMockApi(
  currentBlockNumber: number,
  blockSpecs: Map<number, BlockSpec>
) {
  const parseBlockNum = (hash: string) =>
    parseInt((hash as string).slice('0xhash'.length), 10)

  return {
    rpc: {
      chain: {
        getHeader: vi.fn().mockResolvedValue({
          number: { toNumber: () => currentBlockNumber },
        }),
        getBlockHash: vi
          .fn()
          .mockImplementation((blockNum: number) =>
            Promise.resolve(`0xhash${blockNum}`)
          ),
        getBlock: vi.fn().mockImplementation((hash: string) => {
          const n = parseBlockNum(hash)
          const spec = blockSpecs.get(n)
          return Promise.resolve({
            block: { extrinsics: spec?.extrinsics ?? [] },
          })
        }),
      },
    },
    at: vi.fn().mockImplementation((hash: string) => {
      const n = parseBlockNum(hash)
      const spec = blockSpecs.get(n)
      return Promise.resolve({
        query: {
          system: {
            events: vi.fn().mockResolvedValue(spec?.events ?? []),
          },
          timestamp: {
            now: vi
              .fn()
              .mockResolvedValue({ toNumber: () => 1_700_000_000_000 }),
          },
        },
      })
    }),
  }
}

/** Inject a pre-built connection into the service singleton's private map. */
function injectConnection(
  api: ReturnType<typeof buildMockApi>,
  network: NetworkType = NetworkType.POLKADOT
) {
  ;(
    polkadotService as unknown as { connections: Map<NetworkType, unknown> }
  ).connections.set(network, {
    api,
    network: {
      name: 'Polkadot',
      type: network,
      chainType: 'substrate',
      rpcEndpoint: 'wss://test',
      wsEndpoint: 'wss://test',
      decimals: 10,
      symbol: 'DOT',
    },
    isConnected: true,
  })
}

// ---------------------------------------------------------------------------
// Shared transfer event helper
// ---------------------------------------------------------------------------

function transferEvents(extrinsicIndex = 0) {
  return [
    makeEventRecord('system', 'ExtrinsicSuccess', {}, extrinsicIndex),
    makeEventRecord(
      'balances',
      'Transfer',
      { from: TEST_ADDRESS, to: OTHER_ADDRESS, amount: '1000000000' },
      extrinsicIndex
    ),
  ]
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('polkadotService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any lingering injected connections between tests
    ;(
      polkadotService as unknown as { connections: Map<string, unknown> }
    ).connections.clear()
  })

  // =========================================================================
  // Behavior 1a: Progressive loading — fetchTransactionHistory
  // =========================================================================

  describe('fetchTransactionHistory — progressive loading (descending order)', () => {
    it('returns transactions ordered by blockNumber descending', async () => {
      // Three blocks, each with one transfer from TEST_ADDRESS
      const specs = new Map<number, BlockSpec>([
        [
          3,
          {
            extrinsics: [
              makeExtrinsic(
                'balances',
                'transferAllowDeath',
                TEST_ADDRESS,
                '0xhash3'
              ),
            ],
            events: transferEvents(),
          },
        ],
        [
          2,
          {
            extrinsics: [
              makeExtrinsic(
                'balances',
                'transferAllowDeath',
                TEST_ADDRESS,
                '0xhash2'
              ),
            ],
            events: transferEvents(),
          },
        ],
        [
          1,
          {
            extrinsics: [
              makeExtrinsic(
                'balances',
                'transferAllowDeath',
                TEST_ADDRESS,
                '0xhash1'
              ),
            ],
            events: transferEvents(),
          },
        ],
      ])

      injectConnection(buildMockApi(3, specs))

      const txs = await polkadotService.fetchTransactionHistory(
        NetworkType.POLKADOT,
        { address: TEST_ADDRESS, startBlock: 1, endBlock: 3, limit: 10 }
      )

      expect(txs.length).toBeGreaterThan(0)

      for (let i = 1; i < txs.length; i++) {
        expect(txs[i - 1].blockNumber).toBeGreaterThanOrEqual(
          txs[i].blockNumber
        )
      }
    })
  })

  // =========================================================================
  // Behavior 1b: Progressive loading — fetchTransactionHistoryHybrid
  // =========================================================================

  describe('fetchTransactionHistoryHybrid — progressive loading (descending order)', () => {
    it('returns merged transactions sorted by blockNumber descending', async () => {
      // Subscan returns three transactions intentionally out of order
      const { subscanService } = await import('../blockchain/subscanService')
      vi.mocked(subscanService.isAvailable).mockReturnValue(true)
      vi.mocked(subscanService.fetchAllTransactions).mockResolvedValue([
        {
          id: 'sub-5',
          hash: '0xsub5',
          blockNumber: 5,
          timestamp: new Date(1_700_000_000_000),
          from: OTHER_ADDRESS,
          to: TEST_ADDRESS,
          value: '100',
          fee: '0',
          status: 'success',
          network: NetworkType.POLKADOT,
          tokenSymbol: 'DOT',
          type: 'transfer',
          method: 'transfer',
          section: 'balances',
          events: [],
          isSigned: true,
        },
        {
          id: 'sub-3',
          hash: '0xsub3',
          blockNumber: 3,
          timestamp: new Date(1_700_000_000_000),
          from: OTHER_ADDRESS,
          to: TEST_ADDRESS,
          value: '200',
          fee: '0',
          status: 'success',
          network: NetworkType.POLKADOT,
          tokenSymbol: 'DOT',
          type: 'transfer',
          method: 'transfer',
          section: 'balances',
          events: [],
          isSigned: true,
        },
        {
          id: 'sub-8',
          hash: '0xsub8',
          blockNumber: 8,
          timestamp: new Date(1_700_000_000_000),
          from: OTHER_ADDRESS,
          to: TEST_ADDRESS,
          value: '300',
          fee: '0',
          status: 'success',
          network: NetworkType.POLKADOT,
          tokenSymbol: 'DOT',
          type: 'transfer',
          method: 'transfer',
          section: 'balances',
          events: [],
          isSigned: true,
        },
      ] as import('../wallet/types').SubstrateTransaction[])

      // Inject RPC connection with head at block 3; blocks 1–3 have no matching txs
      const emptySpecs = new Map<number, BlockSpec>([
        [3, { extrinsics: [], events: [] }],
        [2, { extrinsics: [], events: [] }],
        [1, { extrinsics: [], events: [] }],
      ])
      injectConnection(buildMockApi(3, emptySpecs))

      const txs = await polkadotService.fetchTransactionHistoryHybrid(
        NetworkType.POLKADOT,
        { address: TEST_ADDRESS, startBlock: 1, limit: 10 }
      )

      expect(txs.length).toBeGreaterThan(0)

      for (let i = 1; i < txs.length; i++) {
        expect(txs[i - 1].blockNumber).toBeGreaterThanOrEqual(
          txs[i].blockNumber
        )
      }
    })
  })

  // =========================================================================
  // Behavior 2: Fee extraction from transactionPayment.TransactionFeePaid
  // =========================================================================

  describe('fetchTransactionHistory — fee extraction', () => {
    it('extracts actualFee from TransactionFeePaid event', async () => {
      const extrinsic = makeExtrinsic(
        'balances',
        'transferAllowDeath',
        TEST_ADDRESS,
        '0xhash1'
      )
      const events = [
        makeEventRecord('system', 'ExtrinsicSuccess', {}, 0),
        makeEventRecord(
          'balances',
          'Transfer',
          { from: TEST_ADDRESS, to: OTHER_ADDRESS, amount: '5000000000' },
          0
        ),
        makeEventRecord(
          'transactionPayment',
          'TransactionFeePaid',
          { who: TEST_ADDRESS, actualFee: '12345', tip: '0' },
          0
        ),
      ]

      const specs = new Map<number, BlockSpec>([
        [1, { extrinsics: [extrinsic], events }],
      ])
      injectConnection(buildMockApi(1, specs))

      const txs = await polkadotService.fetchTransactionHistory(
        NetworkType.POLKADOT,
        { address: TEST_ADDRESS, startBlock: 1, endBlock: 1, limit: 10 }
      )

      expect(txs).toHaveLength(1)
      expect(txs[0].fee).toBe('12345')
    })

    it('returns fee "0" when TransactionFeePaid event is absent', async () => {
      const extrinsic = makeExtrinsic(
        'balances',
        'transferAllowDeath',
        TEST_ADDRESS,
        '0xhash1'
      )
      // No TransactionFeePaid event
      const events = [
        makeEventRecord('system', 'ExtrinsicSuccess', {}, 0),
        makeEventRecord(
          'balances',
          'Transfer',
          { from: TEST_ADDRESS, to: OTHER_ADDRESS, amount: '5000000000' },
          0
        ),
      ]

      const specs = new Map<number, BlockSpec>([
        [1, { extrinsics: [extrinsic], events }],
      ])
      injectConnection(buildMockApi(1, specs))

      const txs = await polkadotService.fetchTransactionHistory(
        NetworkType.POLKADOT,
        { address: TEST_ADDRESS, startBlock: 1, endBlock: 1, limit: 10 }
      )

      expect(txs).toHaveLength(1)
      expect(txs[0].fee).toBe('0')
    })
  })

  // =========================================================================
  // Behavior 3: Staking rewards
  // =========================================================================

  describe('fetchTransactionHistory — staking rewards', () => {
    it('returns type=staking, from="Staking Rewards", and correct amount for staking.Rewarded event', async () => {
      // Unsigned extrinsic — staking payout called by a third party
      const extrinsic = makeExtrinsic(
        'staking',
        'payoutStakers',
        null,
        '0xhash1'
      )
      const events = [
        makeEventRecord('system', 'ExtrinsicSuccess', {}, 0),
        makeEventRecord(
          'staking',
          'Rewarded',
          { stash: TEST_ADDRESS, amount: '99999' },
          0
        ),
      ]

      const specs = new Map<number, BlockSpec>([
        [1, { extrinsics: [extrinsic], events }],
      ])
      injectConnection(buildMockApi(1, specs))

      const txs = await polkadotService.fetchTransactionHistory(
        NetworkType.POLKADOT,
        { address: TEST_ADDRESS, startBlock: 1, endBlock: 1, limit: 10 }
      )

      expect(txs).toHaveLength(1)
      expect(txs[0].type).toBe('staking')
      expect(txs[0].from).toBe('Staking Rewards')
      expect(txs[0].value).toBe('99999')
    })
  })

  // =========================================================================
  // Behavior 4: Parallel block fetching in batches of 20
  // =========================================================================

  describe('fetchTransactionHistory — parallel fetching', () => {
    it('issues a batch of 20 block fetches in parallel via Promise.all', async () => {
      const promiseAllSpy = vi.spyOn(Promise, 'all')

      // 25 blocks — first batch should be 20 (blocks 25→6), second batch 5 (5→1)
      const specs = new Map<number, BlockSpec>()
      for (let n = 1; n <= 25; n++) {
        specs.set(n, { extrinsics: [], events: [] })
      }

      injectConnection(buildMockApi(25, specs))

      await polkadotService.fetchTransactionHistory(NetworkType.POLKADOT, {
        address: TEST_ADDRESS,
        startBlock: 1,
        endBlock: 25,
        limit: 100,
      })

      // Promise.all must have been called at least once
      expect(promiseAllSpy).toHaveBeenCalled()

      // The first Promise.all call must carry exactly 20 promises (batch size)
      const firstBatchArgs = promiseAllSpy.mock.calls[0][0] as unknown[]
      expect(firstBatchArgs).toHaveLength(20)

      promiseAllSpy.mockRestore()
    })
  })
})
