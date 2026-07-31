import { describe, it, expect } from 'vitest'
import {
  toMinorUnits,
  minorToDollars,
  computeBalance,
  displayStatus,
  formatDate,
} from '../journalEntryUtils'

describe('toMinorUnits', () => {
  it('should convert whole dollars to cents', () => {
    expect(toMinorUnits('100')).toBe(10000)
    expect(toMinorUnits('1')).toBe(100)
    expect(toMinorUnits('0')).toBe(0)
  })

  it('should convert dollars and cents', () => {
    expect(toMinorUnits('123.45')).toBe(12345)
    expect(toMinorUnits('0.99')).toBe(99)
    expect(toMinorUnits('0.01')).toBe(1)
  })

  it('should handle single-digit cents', () => {
    expect(toMinorUnits('10.5')).toBe(1050)
    expect(toMinorUnits('1.1')).toBe(110)
  })

  it('should truncate extra decimal places (no rounding)', () => {
    expect(toMinorUnits('10.999')).toBe(1099)
    expect(toMinorUnits('1.555')).toBe(155)
  })

  it('should return 0 for empty strings', () => {
    expect(toMinorUnits('')).toBe(0)
    expect(toMinorUnits('  ')).toBe(0)
  })

  it('should return 0 for non-numeric strings', () => {
    expect(toMinorUnits('abc')).toBe(0)
    expect(toMinorUnits('.')).toBe(0)
  })

  it('should avoid floating-point errors on classic problem values', () => {
    // 0.1 + 0.2 !== 0.3 in floating point, but our integer math is exact
    const tenCentsInMinorUnits = toMinorUnits('0.10')
    const twentyCentsInMinorUnits = toMinorUnits('0.20')
    expect(tenCentsInMinorUnits + twentyCentsInMinorUnits).toBe(30) // exactly 30 cents
    expect(tenCentsInMinorUnits + twentyCentsInMinorUnits).toBe(toMinorUnits('0.30'))
  })

  it('should handle the float rounding trap 19.99 + 0.01', () => {
    const originalAmountMinorUnits = toMinorUnits('19.99')
    const incrementAmountMinorUnits = toMinorUnits('0.01')
    expect(originalAmountMinorUnits + incrementAmountMinorUnits).toBe(2000) // exactly $20.00
  })

  it('should preserve the sign of negative amounts', () => {
    expect(toMinorUnits('-1.50')).toBe(-150)
    expect(toMinorUnits('-100')).toBe(-10000)
    // Regression: parseInt('-0') is -0 (not < 0), which used to flip
    // sub-dollar negatives to positive.
    expect(toMinorUnits('-0.50')).toBe(-50)
    expect(toMinorUnits('-0.01')).toBe(-1)
  })

  it('should handle a leading decimal point', () => {
    expect(toMinorUnits('.5')).toBe(50)
    expect(toMinorUnits('.05')).toBe(5)
  })
})

describe('minorToDollars', () => {
  it('should format whole dollar amounts', () => {
    expect(minorToDollars(10000)).toBe('100.00')
    expect(minorToDollars(100)).toBe('1.00')
    expect(minorToDollars(0)).toBe('0.00')
  })

  it('should format dollars and cents', () => {
    expect(minorToDollars(12345)).toBe('123.45')
    expect(minorToDollars(99)).toBe('0.99')
    expect(minorToDollars(1)).toBe('0.01')
  })

  it('should format negative amounts', () => {
    expect(minorToDollars(-12345)).toBe('-123.45')
    expect(minorToDollars(-1)).toBe('-0.01')
  })

  it('should pad single-digit cents', () => {
    expect(minorToDollars(5)).toBe('0.05')
    expect(minorToDollars(1005)).toBe('10.05')
  })
})

describe('toMinorUnits and minorToDollars roundtrip', () => {
  const values = ['0.00', '0.01', '0.99', '1.00', '123.45', '9999.99']
  for (const val of values) {
    it(`should roundtrip ${val}`, () => {
      expect(minorToDollars(toMinorUnits(val))).toBe(val)
    })
  }
})

describe('computeBalance', () => {
  it('should detect a balanced entry', () => {
    const result = computeBalance([
      { debitAmount: '100.00', creditAmount: '' },
      { debitAmount: '', creditAmount: '100.00' },
    ])
    expect(result.totalDebitMinor).toBe(10000)
    expect(result.totalCreditMinor).toBe(10000)
    expect(result.differenceMinor).toBe(0)
    expect(result.isBalanced).toBe(true)
  })

  it('should detect an unbalanced entry', () => {
    const result = computeBalance([
      { debitAmount: '100.00', creditAmount: '' },
      { debitAmount: '', creditAmount: '50.00' },
    ])
    expect(result.differenceMinor).toBe(5000)
    expect(result.isBalanced).toBe(false)
  })

  it('should not be balanced when all zeros', () => {
    const result = computeBalance([
      { debitAmount: '', creditAmount: '' },
      { debitAmount: '', creditAmount: '' },
    ])
    expect(result.isBalanced).toBe(false)
  })

  it('should handle multi-line entries (swap example)', () => {
    // Swap 10 Token A ($100 basis, $150 FV) for 4 Token B
    // Line 1: DR Digital assets - B $150
    // Line 2: CR Digital assets - A $100
    // Line 3: CR Realized gain    $50
    const result = computeBalance([
      { debitAmount: '150.00', creditAmount: '' },
      { debitAmount: '', creditAmount: '100.00' },
      { debitAmount: '', creditAmount: '50.00' },
    ])
    expect(result.totalDebitMinor).toBe(15000)
    expect(result.totalCreditMinor).toBe(15000)
    expect(result.differenceMinor).toBe(0)
    expect(result.isBalanced).toBe(true)
  })

  it('should use integer math avoiding float error on 0.1 + 0.2', () => {
    const result = computeBalance([
      { debitAmount: '0.10', creditAmount: '' },
      { debitAmount: '0.20', creditAmount: '' },
      { debitAmount: '', creditAmount: '0.30' },
    ])
    expect(result.differenceMinor).toBe(0)
    expect(result.isBalanced).toBe(true)
  })
})

describe('displayStatus', () => {
  it('should map draft status', () => {
    expect(displayStatus('draft')).toBe('draft')
  })

  it('should map approved status', () => {
    expect(displayStatus('approved')).toBe('approved')
  })

  it('should map posted status', () => {
    expect(displayStatus('posted')).toBe('posted')
  })

  it('should map voided status', () => {
    expect(displayStatus('voided')).toBe('voided')
  })

  it('should default unknown status to draft', () => {
    expect(displayStatus('unknown')).toBe('draft')
    expect(displayStatus('')).toBe('draft')
  })
})

describe('formatDate', () => {
  it('should return em-dash for null/undefined', () => {
    expect(formatDate(null)).toBe('\u2014')
    // skipcq: JS-W1042 — undefined is the explicit value under test, not a trailing optional
    expect(formatDate(undefined)).toBe('\u2014')
  })

  it('should format a date string', () => {
    const result = formatDate('2026-07-15T12:00:00Z')
    expect(result).toContain('2026')
  })

  it('should format a Date object', () => {
    const result = formatDate(new Date(2026, 0, 15))
    expect(result).toContain('2026')
  })
})
