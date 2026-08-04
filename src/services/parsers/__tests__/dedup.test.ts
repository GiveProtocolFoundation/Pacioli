import { describe, it, expect } from 'vitest'
import { dedup, buildExternalIdSet } from '../dedup'
import type { ParsedTransaction } from '../types'
import type { BankTransaction } from '../../persistence/types'

function makeParsed(
  overrides: Partial<ParsedTransaction> = {}
): ParsedTransaction {
  return {
    bank_account_id: 'acct-1',
    posted_date: Date.UTC(2026, 6, 1),
    amount: '100',
    currency: 'USD',
    classification_status: 'unclassified',
    ...overrides,
  }
}

function makeExisting(
  overrides: Partial<BankTransaction> = {}
): BankTransaction {
  return {
    id: 'tx-1',
    bank_account_id: 'acct-1',
    posted_date: Date.UTC(2026, 6, 1),
    amount: '100',
    currency: 'USD',
    classification_status: 'unclassified',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }
}

describe('dedup', () => {
  it('should pass through all when no existing', () => {
    const parsed = [
      makeParsed({ external_id: 'A' }),
      makeParsed({ external_id: 'B' }),
    ]
    const result = dedup(parsed, [])
    expect(result.unique).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
    expect(result.duplicateCount).toBe(0)
  })

  it('should detect duplicates by composite key', () => {
    const parsed = [
      makeParsed({ external_id: 'FITID-001' }),
      makeParsed({ external_id: 'FITID-002' }),
      makeParsed({ external_id: 'FITID-003' }),
    ]
    const existing = [
      makeExisting({ external_id: 'FITID-001' }),
      makeExisting({ external_id: 'FITID-003' }),
    ]
    const result = dedup(parsed, existing)
    expect(result.unique).toHaveLength(1)
    expect(result.unique[0].external_id).toBe('FITID-002')
    expect(result.duplicates).toHaveLength(2)
    expect(result.duplicateCount).toBe(2)
  })

  it('should detect intra-batch duplicates', () => {
    const parsed = [
      makeParsed({ external_id: 'SAME-ID' }),
      makeParsed({ external_id: 'SAME-ID' }),
      makeParsed({ external_id: 'DIFFERENT' }),
    ]
    const result = dedup(parsed, [])
    expect(result.unique).toHaveLength(2)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0]._isDuplicate).toBe(true)
  })

  it('should not dedup transactions without external_id', () => {
    const parsed = [
      makeParsed({ external_id: undefined }),
      makeParsed({ external_id: undefined }),
    ]
    const result = dedup(parsed, [])
    expect(result.unique).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
  })

  it('should scope dedup to bank_account_id', () => {
    const parsed = [
      makeParsed({ bank_account_id: 'acct-1', external_id: 'X' }),
      makeParsed({ bank_account_id: 'acct-2', external_id: 'X' }),
    ]
    const existing = [
      makeExisting({ bank_account_id: 'acct-1', external_id: 'X' }),
    ]
    const result = dedup(parsed, existing)
    expect(result.unique).toHaveLength(1)
    expect(result.unique[0].bank_account_id).toBe('acct-2')
    expect(result.duplicates).toHaveLength(1)
  })

  it('should preserve _isDuplicate flag on duplicates', () => {
    const parsed = [makeParsed({ external_id: 'DUP' })]
    const existing = [makeExisting({ external_id: 'DUP' })]
    const result = dedup(parsed, existing)
    expect(result.duplicates[0]._isDuplicate).toBe(true)
    expect(result.duplicates[0]._duplicateOf).toBe('DUP')
  })

  it('should clear _isDuplicate on unique items', () => {
    const parsed = [makeParsed({ external_id: 'NEW' })]
    const result = dedup(parsed, [])
    expect(result.unique[0]._isDuplicate).toBe(false)
  })
})

describe('buildExternalIdSet', () => {
  it('should collect external_ids', () => {
    const existing = [
      makeExisting({ external_id: 'A' }),
      makeExisting({ external_id: 'B' }),
      makeExisting({ external_id: null }),
    ]
    const set = buildExternalIdSet(existing)
    expect(set.size).toBe(2)
    expect(set.has('A')).toBe(true)
    expect(set.has('B')).toBe(true)
  })

  it('should return empty set for no transactions', () => {
    expect(buildExternalIdSet([]).size).toBe(0)
  })
})
