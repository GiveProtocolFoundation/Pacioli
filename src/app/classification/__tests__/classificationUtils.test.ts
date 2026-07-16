import { describe, it, expect } from 'vitest'
import {
  formatTimestamp,
  formatTimestampFull,
  truncateHash,
  displayTxType,
  txTypeLabels,
} from '../classificationUtils'

describe('formatTimestamp', () => {
  it('should format a Unix timestamp to a date string', () => {
    // 1700000000 = 2023-11-14T22:13:20Z
    const result = formatTimestamp(1700000000)
    expect(result).toBeTruthy()
    // The exact format depends on locale, but it should contain year digits
    expect(result).toMatch(/2023/)
  })

  it('should handle zero timestamp (epoch)', () => {
    const result = formatTimestamp(0)
    expect(result).toBeTruthy()
    // Epoch may render as 1969 or 1970 depending on local timezone offset
    expect(result).toMatch(/196[9]|197[0]/)
  })
})

describe('formatTimestampFull', () => {
  it('should include time information', () => {
    const result = formatTimestampFull(1700000000)
    expect(result).toBeTruthy()
    // Should be longer than date-only format
    expect(result.length).toBeGreaterThan(formatTimestamp(1700000000).length)
  })
})

describe('truncateHash', () => {
  it('should truncate long hashes to first 8 + last 4 chars', () => {
    const hash = '0xabcdef1234567890abcdef1234567890abcdef12'
    const result = truncateHash(hash)
    expect(result).toBe('0xabcdef...ef12')
  })

  it('should return short hashes unchanged', () => {
    const hash = '0xabc'
    expect(truncateHash(hash)).toBe('0xabc')
  })

  it('should handle exactly 14-char hashes unchanged', () => {
    const hash = '0xabcdef12345'
    expect(truncateHash(hash)).toBe('0xabcdef12345')
  })

  it('should handle 15-char hash with truncation', () => {
    const hash = '0xabcdef123456z'
    expect(truncateHash(hash)).toBe('0xabcdef...456z')
  })
})

describe('displayTxType', () => {
  it('should return human-readable labels for known types', () => {
    expect(displayTxType('transfer')).toBe('Transfer')
    expect(displayTxType('swap')).toBe('Swap')
    expect(displayTxType('claim')).toBe('Claim')
    expect(displayTxType('stake')).toBe('Stake')
    expect(displayTxType('unstake')).toBe('Unstake')
    expect(displayTxType('bridge')).toBe('Bridge')
    expect(displayTxType('mint')).toBe('Mint')
    expect(displayTxType('burn')).toBe('Burn')
    expect(displayTxType('approve')).toBe('Approve')
    expect(displayTxType('contract_call')).toBe('Contract Call')
    expect(displayTxType('unknown')).toBe('Unknown')
  })

  it('should return the raw string for unrecognized types', () => {
    expect(displayTxType('some_new_type')).toBe('some_new_type')
  })
})

describe('txTypeLabels', () => {
  it('should have entries for all standard transaction types', () => {
    const expectedTypes = [
      'transfer', 'swap', 'bridge', 'stake', 'unstake',
      'claim', 'mint', 'burn', 'approve', 'contract_call', 'unknown',
    ]
    for (const t of expectedTypes) {
      expect(txTypeLabels[t]).toBeDefined()
    }
  })
})
