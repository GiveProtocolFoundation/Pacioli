import { describe, it, expect } from 'vitest'
import {
  formatTimestamp,
  formatTimestampFull,
  truncateHash,
  displayTxType,
  txTypeLabels,
  rulePreview,
  findMatchingRule,
} from '../classificationUtils'
import type { ClassificationRuleMatch } from '../classificationUtils'

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
      'transfer',
      'swap',
      'bridge',
      'stake',
      'unstake',
      'claim',
      'mint',
      'burn',
      'approve',
      'contract_call',
      'unknown',
    ]
    for (const t of expectedTypes) {
      expect(txTypeLabels[t]).toBeDefined()
    }
  })
})

describe('rulePreview', () => {
  it('should return rule description for known tx types', () => {
    expect(rulePreview('claim')).toContain('Staking reward')
    expect(rulePreview('stake')).toContain('Staking reward')
    expect(rulePreview('transfer')).toContain('Transfer')
    expect(rulePreview('swap')).toContain('swap')
    expect(rulePreview('approve')).toContain('approval')
  })

  it('should return generic description for unknown types', () => {
    expect(rulePreview('some_new_type')).toContain('Heuristic')
  })
})

describe('findMatchingRule', () => {
  const rules: ClassificationRuleMatch[] = [
    {
      id: 'r1',
      name: 'Staking Reward',
      matchTxTypes: 'claim,stake',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: true,
    },
    {
      id: 'r2',
      name: 'Polkadot Transfer',
      matchTxTypes: 'transfer',
      matchChains: 'polkadot,kusama',
      matchSelfTransfer: 'any',
      enabled: true,
    },
    {
      id: 'r3',
      name: 'Disabled Rule',
      matchTxTypes: 'swap',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: false,
    },
    {
      id: 'r4',
      name: 'Generic Swap',
      matchTxTypes: 'swap',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: true,
    },
  ]

  it('should match first enabled rule by tx type', () => {
    const match = findMatchingRule(rules, 'claim', 'polkadot')
    expect(match?.name).toBe('Staking Reward')
  })

  it('should match chain-specific rules', () => {
    const match = findMatchingRule(rules, 'transfer', 'polkadot')
    expect(match?.name).toBe('Polkadot Transfer')
  })

  it('should not match chain-specific rules for other chains', () => {
    const match = findMatchingRule(rules, 'transfer', 'ethereum')
    expect(match).toBeUndefined()
  })

  it('should skip disabled rules', () => {
    const match = findMatchingRule(rules, 'swap', 'ethereum')
    expect(match?.name).toBe('Generic Swap')
  })

  it('should return undefined when no rule matches', () => {
    const match = findMatchingRule(rules, 'burn', 'ethereum')
    expect(match).toBeUndefined()
  })

  it('should match chain case-insensitively', () => {
    const match = findMatchingRule(rules, 'transfer', 'Polkadot')
    expect(match?.name).toBe('Polkadot Transfer')
  })
})
