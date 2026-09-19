import { describe, it, expect } from 'vitest'
import { nextSyncStatus } from './syncStatusPolicy'

const TXS = [{ blockNumber: 10 }, { blockNumber: 42 }, { blockNumber: 7 }]

describe('nextSyncStatus', () => {
  it('advances to the highest imported block for a complete import', () => {
    const now = new Date(1_700_000_000_000)

    expect(nextSyncStatus(TXS, true, 'polkadot', 'addr', now)).toEqual({
      network: 'polkadot',
      address: 'addr',
      lastSyncedBlock: 42,
      lastSyncTime: now,
      isSyncing: false,
    })
  })

  it('preserves the previous sync point for an incomplete (RPC-only) import', () => {
    // Regression: a non-empty recent-window fallback must not advance
    // lastSyncedBlock as though the full history had been imported.
    expect(nextSyncStatus(TXS, false, 'polkadot', 'addr')).toBeNull()
  })

  it('does not advance when nothing was imported', () => {
    expect(nextSyncStatus([], true, 'polkadot', 'addr')).toBeNull()
  })
})
