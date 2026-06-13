import { describe, it, expect } from 'vitest'
import {
  extractXcmMessageId,
  getXcmRole,
  annotateXcmTransactions,
  correlateXcmTransactions,
  filterForAccounting,
} from '../blockchain/xcmCorrelationService'
import { NetworkType } from '../wallet/types'
import type { SubstrateTransaction } from '../wallet/types'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const MSG_ID_A =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const MSG_ID_B =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function makeXcmTx(
  overrides: Partial<SubstrateTransaction> & { id: string }
): SubstrateTransaction {
  return {
    hash: '0x1234',
    blockNumber: 1000,
    timestamp: new Date('2024-01-01T00:00:00Z'),
    from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    value: '10000000000',
    fee: '10000000',
    status: 'success' as const,
    network: NetworkType.POLKADOT,
    tokenSymbol: 'DOT',
    type: 'xcm' as const,
    method: 'reserveTransferAssets',
    section: 'polkadotXcm',
    events: [],
    isSigned: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// extractXcmMessageId
// ---------------------------------------------------------------------------

describe('extractXcmMessageId', () => {
  it('returns null for a non-XCM transaction with no events', () => {
    const tx = makeXcmTx({ id: 'tx1', events: [] })
    expect(extractXcmMessageId(tx)).toBeNull()
  })

  it('extracts messageId from polkadotXcm Sent event (camelCase field)', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { origin: {}, destination: {}, message: [], messageId: MSG_ID_A },
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBe(MSG_ID_A)
  })

  it('extracts message_id from xcmPallet Sent event (snake_case field)', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      events: [
        {
          section: 'xcmPallet',
          method: 'Sent',
          data: { origin: {}, destination: {}, message: [], message_id: MSG_ID_A },
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBe(MSG_ID_A)
  })

  it('extracts messageId from array-style positional event data (older runtimes)', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          // [origin, destination, message, messageId] positional array
          data: [{}, {}, [], MSG_ID_A] as unknown as Record<string, unknown>,
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBe(MSG_ID_A)
  })

  it('extracts messageId from dmpQueue ExecutedDownward receive event', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      isSigned: false,
      events: [
        {
          section: 'dmpQueue',
          method: 'ExecutedDownward',
          data: { messageId: MSG_ID_A, outcome: { complete: true } },
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBe(MSG_ID_A)
  })

  it('extracts id from messageQueue Processed receive event', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      isSigned: false,
      events: [
        {
          section: 'messageQueue',
          method: 'Processed',
          data: { id: MSG_ID_A, origin: {}, weight_used: '100', success: true },
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBe(MSG_ID_A)
  })

  it('ignores events on unrelated sections', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      events: [
        {
          section: 'balances',
          method: 'Transfer',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBeNull()
  })

  it('rejects hex strings that are not 32 bytes (wrong length)', () => {
    const shortId = '0xaabb'
    const tx = makeXcmTx({
      id: 'tx1',
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: shortId },
        },
      ],
    })
    expect(extractXcmMessageId(tx)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getXcmRole
// ---------------------------------------------------------------------------

describe('getXcmRole', () => {
  it('returns null for non-XCM transactions', () => {
    const tx = makeXcmTx({ id: 'tx1', type: 'transfer' })
    expect(getXcmRole(tx)).toBeNull()
  })

  it('returns "send" when polkadotXcm Sent event is present', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      events: [{ section: 'polkadotXcm', method: 'Sent', data: {} }],
    })
    expect(getXcmRole(tx)).toBe('send')
  })

  it('returns "receive" when dmpQueue ExecutedDownward event is present', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      isSigned: false,
      events: [
        { section: 'dmpQueue', method: 'ExecutedDownward', data: {} },
      ],
    })
    expect(getXcmRole(tx)).toBe('receive')
  })

  it('returns "receive" when xcmpQueue Success event is present', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      isSigned: false,
      events: [{ section: 'xcmpQueue', method: 'Success', data: {} }],
    })
    expect(getXcmRole(tx)).toBe('receive')
  })

  it('falls back to "send" when isSigned=true and no distinguishing events', () => {
    const tx = makeXcmTx({ id: 'tx1', isSigned: true, events: [] })
    expect(getXcmRole(tx)).toBe('send')
  })

  it('falls back to "receive" when isSigned=false and no distinguishing events', () => {
    const tx = makeXcmTx({ id: 'tx1', isSigned: false, events: [] })
    expect(getXcmRole(tx)).toBe('receive')
  })
})

// ---------------------------------------------------------------------------
// annotateXcmTransactions
// ---------------------------------------------------------------------------

describe('annotateXcmTransactions', () => {
  it('sets xcmCorrelationId, xcmRole, and xcmStatus on XCM transactions', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    annotateXcmTransactions([tx])

    expect(tx.xcmCorrelationId).toBe(MSG_ID_A)
    expect(tx.xcmRole).toBe('send')
    expect(tx.xcmStatus).toBe('pending')
  })

  it('does not overwrite an already-set xcmRole', () => {
    const tx = makeXcmTx({
      id: 'tx1',
      xcmRole: 'receive',
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    annotateXcmTransactions([tx])
    // Pre-set xcmRole should be preserved
    expect(tx.xcmRole).toBe('receive')
  })

  it('skips non-XCM transactions', () => {
    const tx = makeXcmTx({ id: 'tx1', type: 'transfer', events: [] })
    annotateXcmTransactions([tx])
    expect(tx.xcmCorrelationId).toBeUndefined()
    expect(tx.xcmRole).toBeUndefined()
    expect(tx.xcmStatus).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// correlateXcmTransactions
// ---------------------------------------------------------------------------

describe('correlateXcmTransactions', () => {
  it('links a matching send/receive pair by xcmCorrelationId', () => {
    const send = makeXcmTx({
      id: 'dot-100-1',
      network: NetworkType.POLKADOT,
      isSigned: true,
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    const receive = makeXcmTx({
      id: 'acala-200-0',
      network: NetworkType.ACALA,
      isSigned: false,
      events: [
        {
          section: 'dmpQueue',
          method: 'ExecutedDownward',
          data: { messageId: MSG_ID_A },
        },
      ],
    })

    correlateXcmTransactions([send, receive])

    expect(send.xcmLinkedTxId).toBe('acala-200-0')
    expect(receive.xcmLinkedTxId).toBe('dot-100-1')
    expect(send.xcmStatus).toBe('matched')
    expect(receive.xcmStatus).toBe('matched')
  })

  it('leaves unmatched XCM transactions as "pending"', () => {
    const send = makeXcmTx({
      id: 'dot-100-1',
      isSigned: true,
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: MSG_ID_A },
        },
      ],
    })

    correlateXcmTransactions([send])

    expect(send.xcmLinkedTxId).toBeUndefined()
    expect(send.xcmStatus).toBe('pending')
  })

  it('does not link pairs with different xcmCorrelationIds', () => {
    const send = makeXcmTx({
      id: 'tx-send',
      isSigned: true,
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    const receive = makeXcmTx({
      id: 'tx-receive',
      isSigned: false,
      events: [
        {
          section: 'dmpQueue',
          method: 'ExecutedDownward',
          data: { messageId: MSG_ID_B }, // different ID
        },
      ],
    })

    correlateXcmTransactions([send, receive])

    expect(send.xcmLinkedTxId).toBeUndefined()
    expect(receive.xcmLinkedTxId).toBeUndefined()
    expect(send.xcmStatus).toBe('pending')
    expect(receive.xcmStatus).toBe('pending')
  })

  it('returns the same array reference', () => {
    const txs: SubstrateTransaction[] = []
    const result = correlateXcmTransactions(txs)
    expect(result).toBe(txs)
  })
})

// ---------------------------------------------------------------------------
// filterForAccounting
// ---------------------------------------------------------------------------

describe('filterForAccounting', () => {
  it('keeps all non-XCM transactions', () => {
    const transfer = makeXcmTx({ id: 'tx1', type: 'transfer' })
    const staking = makeXcmTx({ id: 'tx2', type: 'staking' })
    const result = filterForAccounting([transfer, staking])
    expect(result).toHaveLength(2)
  })

  it('keeps XCM send legs regardless of match status', () => {
    const send = makeXcmTx({
      id: 'tx-send',
      xcmRole: 'send',
      xcmStatus: 'matched',
    })
    const result = filterForAccounting([send])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tx-send')
  })

  it('removes matched XCM receive legs (would double-count)', () => {
    const receive = makeXcmTx({
      id: 'tx-receive',
      xcmRole: 'receive',
      xcmStatus: 'matched',
    })
    const result = filterForAccounting([receive])
    expect(result).toHaveLength(0)
  })

  it('keeps unmatched XCM receive legs (pending — need human review)', () => {
    const receive = makeXcmTx({
      id: 'tx-receive',
      xcmRole: 'receive',
      xcmStatus: 'pending',
    })
    const result = filterForAccounting([receive])
    expect(result).toHaveLength(1)
  })

  it('full round-trip: correlate then filter removes the receive', () => {
    const send = makeXcmTx({
      id: 'dot-100-1',
      network: NetworkType.POLKADOT,
      isSigned: true,
      events: [
        {
          section: 'polkadotXcm',
          method: 'Sent',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    const receive = makeXcmTx({
      id: 'acala-200-0',
      network: NetworkType.ACALA,
      isSigned: false,
      events: [
        {
          section: 'dmpQueue',
          method: 'ExecutedDownward',
          data: { messageId: MSG_ID_A },
        },
      ],
    })
    const other = makeXcmTx({ id: 'tx-other', type: 'transfer' })

    correlateXcmTransactions([send, receive, other])
    const accounting = filterForAccounting([send, receive, other])

    // receive is excluded; send and non-XCM are kept
    expect(accounting.map(t => t.id)).toEqual(['dot-100-1', 'tx-other'])
  })
})
