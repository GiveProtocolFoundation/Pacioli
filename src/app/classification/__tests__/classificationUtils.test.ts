import { describe, it, expect } from 'vitest'
import {
  formatTimestamp,
  formatTimestampFull,
  truncateHash,
  displayTxType,
  txTypeLabels,
  rulePreview,
  findMatchingRule,
  findMatchingBankRule,
  payeePatternMatches,
} from '../classificationUtils'
import type { ClassificationRuleMatch } from '../classificationUtils'

const cryptoDefaults = {
  sourceKind: 'crypto',
  matchPayeePattern: '',
  matchAmountSign: 'any',
} as const

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
      ...cryptoDefaults,
    },
    {
      id: 'r2',
      name: 'Polkadot Transfer',
      matchTxTypes: 'transfer',
      matchChains: 'polkadot,kusama',
      matchSelfTransfer: 'any',
      enabled: true,
      ...cryptoDefaults,
    },
    {
      id: 'r3',
      name: 'Disabled Rule',
      matchTxTypes: 'swap',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: false,
      ...cryptoDefaults,
    },
    {
      id: 'r4',
      name: 'Generic Swap',
      matchTxTypes: 'swap',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: true,
      ...cryptoDefaults,
    },
  ]

  it('should match first enabled rule by tx type', () => {
    const match = findMatchingRule(rules, 'claim', 'polkadot', false)
    expect(match?.name).toBe('Staking Reward')
  })

  it('should match chain-specific rules', () => {
    const match = findMatchingRule(rules, 'transfer', 'polkadot', false)
    expect(match?.name).toBe('Polkadot Transfer')
  })

  it('should not match chain-specific rules for other chains', () => {
    const match = findMatchingRule(rules, 'transfer', 'ethereum', false)
    expect(match).toBeUndefined()
  })

  it('should skip disabled rules', () => {
    const match = findMatchingRule(rules, 'swap', 'ethereum', false)
    expect(match?.name).toBe('Generic Swap')
  })

  it('should return undefined when no rule matches', () => {
    const match = findMatchingRule(rules, 'burn', 'ethereum', false)
    expect(match).toBeUndefined()
  })

  it('should match chain case-insensitively', () => {
    const match = findMatchingRule(rules, 'transfer', 'Polkadot', false)
    expect(match?.name).toBe('Polkadot Transfer')
  })

  it('should skip self-transfer-only rules for external transfers', () => {
    const selfTransferRules: ClassificationRuleMatch[] = [
      {
        id: 'st1',
        name: 'Self-Transfer (Own Wallets)',
        matchTxTypes: 'transfer',
        matchChains: '',
        matchSelfTransfer: 'true',
        enabled: true,
        ...cryptoDefaults,
      },
      {
        id: 'st2',
        name: 'Transfer Received (External)',
        matchTxTypes: 'transfer',
        matchChains: '',
        matchSelfTransfer: 'false',
        enabled: true,
        ...cryptoDefaults,
      },
    ]
    const match = findMatchingRule(
      selfTransferRules,
      'transfer',
      'polkadot',
      false
    )
    expect(match?.name).toBe('Transfer Received (External)')
  })

  it('should skip external-only rules for self-transfers', () => {
    const selfTransferRules: ClassificationRuleMatch[] = [
      {
        id: 'st1',
        name: 'Self-Transfer (Own Wallets)',
        matchTxTypes: 'transfer',
        matchChains: '',
        matchSelfTransfer: 'true',
        enabled: true,
        ...cryptoDefaults,
      },
      {
        id: 'st2',
        name: 'Transfer Received (External)',
        matchTxTypes: 'transfer',
        matchChains: '',
        matchSelfTransfer: 'false',
        enabled: true,
        ...cryptoDefaults,
      },
    ]
    const match = findMatchingRule(
      selfTransferRules,
      'transfer',
      'polkadot',
      true
    )
    expect(match?.name).toBe('Self-Transfer (Own Wallets)')
  })

  it('should match "any" self-transfer mode regardless of flag', () => {
    const match = findMatchingRule(rules, 'claim', 'polkadot', true)
    expect(match?.name).toBe('Staking Reward')
  })

  it('should not match bank rules in crypto search', () => {
    const mixed: ClassificationRuleMatch[] = [
      {
        id: 'b1',
        name: 'Bank Gusto',
        matchTxTypes: '',
        matchChains: '',
        matchSelfTransfer: 'any',
        enabled: true,
        sourceKind: 'bank',
        matchPayeePattern: 'gusto',
        matchAmountSign: 'negative',
      },
      {
        id: 'c1',
        name: 'Crypto Claim',
        matchTxTypes: 'claim',
        matchChains: '',
        matchSelfTransfer: 'any',
        enabled: true,
        ...cryptoDefaults,
      },
    ]
    const match = findMatchingRule(mixed, 'claim', 'polkadot', false)
    expect(match?.name).toBe('Crypto Claim')
  })
})

describe('payeePatternMatches', () => {
  it('should match case-insensitive substring', () => {
    expect(payeePatternMatches('gusto', 'GUSTO INC')).toBe(true)
    expect(payeePatternMatches('gusto', 'Payment to Gusto')).toBe(true)
    expect(payeePatternMatches('gusto', 'ADP Payroll')).toBe(false)
  })

  it('should match pipe-separated alternatives', () => {
    expect(payeePatternMatches('google|microsoft', 'Google Cloud')).toBe(true)
    expect(payeePatternMatches('google|microsoft', 'Microsoft 365')).toBe(true)
    expect(payeePatternMatches('google|microsoft', 'Amazon AWS')).toBe(false)
  })

  it('should match everything when pattern is empty', () => {
    expect(payeePatternMatches('', 'anything')).toBe(true)
    expect(payeePatternMatches('', '')).toBe(true)
  })
})

describe('findMatchingBankRule', () => {
  const bankRules: ClassificationRuleMatch[] = [
    {
      id: 'b1',
      name: 'Payroll — Gusto',
      matchTxTypes: '',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: true,
      sourceKind: 'bank',
      matchPayeePattern: 'gusto',
      matchAmountSign: 'negative',
    },
    {
      id: 'b2',
      name: 'Stripe Income',
      matchTxTypes: '',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: true,
      sourceKind: 'bank',
      matchPayeePattern: 'stripe',
      matchAmountSign: 'positive',
    },
    {
      id: 'b3',
      name: 'Disabled Bank Rule',
      matchTxTypes: '',
      matchChains: '',
      matchSelfTransfer: 'any',
      enabled: false,
      sourceKind: 'bank',
      matchPayeePattern: 'adp',
      matchAmountSign: 'negative',
    },
  ]

  it('should match payee + sign', () => {
    const match = findMatchingBankRule(bankRules, 'GUSTO INC', true)
    expect(match?.name).toBe('Payroll — Gusto')
  })

  it('should not match wrong sign', () => {
    const match = findMatchingBankRule(bankRules, 'GUSTO INC', false)
    expect(match).toBeUndefined()
  })

  it('should match positive sign rules', () => {
    const match = findMatchingBankRule(bankRules, 'Stripe Payout', false)
    expect(match?.name).toBe('Stripe Income')
  })

  it('should skip disabled rules', () => {
    const match = findMatchingBankRule(bankRules, 'ADP PAYROLL', true)
    expect(match).toBeUndefined()
  })

  it('should return undefined for unknown payee', () => {
    const match = findMatchingBankRule(bankRules, 'Unknown Vendor', true)
    expect(match).toBeUndefined()
  })
})
