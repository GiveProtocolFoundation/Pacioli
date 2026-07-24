/**
 * XCM Cross-Chain Correlation Service
 *
 * Correlates XCM send events on a source chain with the corresponding
 * receive events on a destination chain, preventing double-counting
 * in balance and cost-basis calculations.
 *
 * Algorithm:
 *  1. Walk each XCM transaction's events to find the XCM message ID.
 *  2. Tag the transaction as 'send' or 'receive' based on event type.
 *  3. Across all tracked chains, match send↔receive pairs by message ID.
 *  4. For accounting, exclude matched 'receive' legs (already covered by the send).
 */

import type { SubstrateTransaction } from '../wallet/types'

// ---------------------------------------------------------------------------
// Event shape helpers
// ---------------------------------------------------------------------------

/** Sections that emit an outbound XCM message on the source chain. */
const XCM_SEND_SECTIONS = ['polkadotXcm', 'xcmPallet', 'xTokens'] as const
type XcmSendSection = (typeof XCM_SEND_SECTIONS)[number]

/** Methods within those sections that represent an outbound message. */
const XCM_SENT_METHODS = [
  'Sent',
  'TransferredMultiAssets',
  'TransferredAssets',
] as const
type XcmSentMethod = (typeof XCM_SENT_METHODS)[number]

/** Events that appear on the destination chain when an XCM message is processed. */
const XCM_RECEIVE_EVENTS: ReadonlyArray<{
  readonly section: string
  readonly method: string
}> = [
  { section: 'dmpQueue', method: 'ExecutedDownward' },
  { section: 'xcmpQueue', method: 'Success' },
  { section: 'xcmpQueue', method: 'Fail' },
  { section: 'polkadotXcm', method: 'Success' },
  { section: 'polkadotXcm', method: 'AssetsTrapped' },
  { section: 'messageQueue', method: 'Processed' },
  { section: 'messageQueue', method: 'ProcessingFailed' },
]

/** Regex for a 32-byte hex message ID (0x + 64 hex chars). */
const MESSAGE_ID_RE = /^0x[0-9a-fA-F]{64}$/

/**
 * Checks whether the given value is a valid message ID string.
 *
 * @param v - The value to check.
 * @returns True if the value is a string matching the MESSAGE_ID_RE pattern, false otherwise.
 */
function isMessageId(v: unknown): v is string {
  return typeof v === 'string' && MESSAGE_ID_RE.test(v)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the XCM message ID from a transaction's events.
 *
 * Handles both camelCase (`messageId`) and snake_case (`message_id`) field
 * names, as well as positional array-style event data for older runtimes.
 *
 * Returns the hex message ID string (e.g. `"0xabc..."`), or `null` if none
 * could be found.
 */
export function extractXcmMessageId(tx: SubstrateTransaction): string | null {
  for (const event of tx.events) {
    const data = event.data as Record<string, unknown>

    const isSend =
      XCM_SEND_SECTIONS.includes(event.section as XcmSendSection) &&
      XCM_SENT_METHODS.includes(event.method as XcmSentMethod)

    const isReceive = XCM_RECEIVE_EVENTS.some(
      e => e.section === event.section && e.method === event.method
    )

    if (!isSend && !isReceive) continue

    // Try named fields first (modern Substrate runtimes)
    if (isMessageId(data.messageId)) return data.messageId
    if (isMessageId(data.message_id)) return data.message_id
    // messageQueue::Processed uses 'id'
    if (isMessageId(data.id)) return data.id

    // Positional array-style event data (older runtimes / some parachains)
    // polkadotXcm::Sent: [origin, destination, message, messageId]
    if (Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        if (isMessageId(data[i])) return data[i] as string
      }
    }
  }
  return null
}

/**
 * Determine whether a transaction represents the outgoing send leg or the
 * incoming receive leg of an XCM transfer.
 *
 * Returns `null` for non-XCM transactions.
 */
export function getXcmRole(
  tx: SubstrateTransaction
): 'send' | 'receive' | null {
  if (tx.type !== 'xcm') return null

  for (const event of tx.events) {
    if (
      XCM_SEND_SECTIONS.includes(event.section as XcmSendSection) &&
      XCM_SENT_METHODS.includes(event.method as XcmSentMethod)
    ) {
      return 'send'
    }
    if (
      XCM_RECEIVE_EVENTS.some(
        e => e.section === event.section && e.method === event.method
      )
    ) {
      return 'receive'
    }
  }

  // Fallback heuristic: signed extrinsics are sends; unsigned are receives.
  return tx.isSigned ? 'send' : 'receive'
}

/**
 * Annotate XCM transactions in-place with `xcmCorrelationId`, `xcmRole`,
 * and an initial `xcmStatus` of `'pending'`.
 *
 * Call this after fetching transactions for a single chain before merging
 * across chains.
 */
export function annotateXcmTransactions(txs: SubstrateTransaction[]): void {
  for (const tx of txs) {
    if (tx.type !== 'xcm') continue

    const messageId = extractXcmMessageId(tx)
    if (messageId) {
      tx.xcmCorrelationId = messageId
    }

    if (!tx.xcmRole) {
      const role = getXcmRole(tx)
      if (role) tx.xcmRole = role
    }

    if (!tx.xcmStatus) {
      tx.xcmStatus = 'pending'
    }
  }
}

/**
 * Correlate XCM send/receive pairs across a combined list of transactions
 * from **multiple chains**.
 *
 * Mutates the transactions in-place:
 * - Matched pairs get `xcmLinkedTxId` pointing at each other.
 * - Matched pairs get `xcmStatus = 'matched'`.
 * - Unmatched XCM transactions retain `xcmStatus = 'pending'`.
 *
 * Returns the same array (mutated) for convenience.
 */
export function correlateXcmTransactions(
  txs: SubstrateTransaction[]
): SubstrateTransaction[] {
  // Ensure all XCM transactions are annotated first.
  annotateXcmTransactions(txs)

  const sendMap = new Map<string, SubstrateTransaction>()
  const receiveMap = new Map<string, SubstrateTransaction>()

  for (const tx of txs) {
    if (tx.type !== 'xcm' || !tx.xcmCorrelationId) continue

    if (tx.xcmRole === 'send') {
      sendMap.set(tx.xcmCorrelationId, tx)
    } else if (tx.xcmRole === 'receive') {
      receiveMap.set(tx.xcmCorrelationId, tx)
    }
  }

  for (const [corrId, sendTx] of sendMap) {
    const receiveTx = receiveMap.get(corrId)
    if (!receiveTx) continue

    sendTx.xcmLinkedTxId = receiveTx.id
    receiveTx.xcmLinkedTxId = sendTx.id
    sendTx.xcmStatus = 'matched'
    receiveTx.xcmStatus = 'matched'
  }

  return txs
}

/**
 * Filter a transaction list for balance and cost-basis accounting.
 *
 * Removes matched XCM receive legs to avoid double-counting:
 * - An XCM send already represents the full economic event
 *   (funds leave chain A and arrive on chain B).
 * - The paired receive on chain B is informational; treating it as a
 *   separate inflow would overstate the user's holdings.
 *
 * Unmatched receives (the send leg is not yet visible) are kept with
 * `xcmStatus = 'pending'` so accounting tools can flag them for review.
 */
export function filterForAccounting(
  txs: SubstrateTransaction[]
): SubstrateTransaction[] {
  return txs.filter(
    tx =>
      tx.type !== 'xcm' ||
      tx.xcmRole === 'send' ||
      // Unmatched receives: keep but flag as pending
      (tx.xcmRole === 'receive' && tx.xcmStatus !== 'matched')
    // Matched receives: excluded (already captured by the send)
  )
}
