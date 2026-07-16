import { describe, it, expect } from 'vitest'
import {
  formatMinorAsDollars,
  formatMinorPlain,
  formatStatementDate,
  computeChangePercent,
  formatChangePercent,
  defaultPeriodDates,
} from './statementUtils'

describe('formatMinorAsDollars', () => {
  it('should format positive amounts with commas', () => {
    expect(formatMinorAsDollars(12345)).toBe('$123.45')
    expect(formatMinorAsDollars(100000)).toBe('$1,000.00')
    expect(formatMinorAsDollars(5)).toBe('$0.05')
  })

  it('should format zero', () => {
    expect(formatMinorAsDollars(0)).toBe('$0.00')
  })

  it('should format negative amounts', () => {
    expect(formatMinorAsDollars(-500)).toBe('-$5.00')
    expect(formatMinorAsDollars(-12345)).toBe('-$123.45')
  })

  it('should handle exact dollar amounts', () => {
    expect(formatMinorAsDollars(100)).toBe('$1.00')
    expect(formatMinorAsDollars(50000)).toBe('$500.00')
  })
})

describe('formatMinorPlain', () => {
  it('should format without currency symbol', () => {
    expect(formatMinorPlain(12345)).toBe('123.45')
    expect(formatMinorPlain(0)).toBe('0.00')
    expect(formatMinorPlain(-500)).toBe('-5.00')
  })

  it('should include commas for large numbers', () => {
    expect(formatMinorPlain(100000)).toBe('1,000.00')
  })
})

describe('formatStatementDate', () => {
  it('should format ISO date strings', () => {
    expect(formatStatementDate('2025-01-01')).toBe('Jan 1, 2025')
    expect(formatStatementDate('2025-12-31')).toBe('Dec 31, 2025')
  })

  it('should return input unchanged for invalid dates', () => {
    expect(formatStatementDate('invalid')).toBe('invalid')
  })
})

describe('computeChangePercent', () => {
  it('should compute positive change', () => {
    expect(computeChangePercent(120, 100)).toBe(20)
  })

  it('should compute negative change', () => {
    expect(computeChangePercent(80, 100)).toBe(-20)
  })

  it('should return null when prior is zero', () => {
    expect(computeChangePercent(100, 0)).toBeNull()
  })

  it('should return 0 when values are equal', () => {
    expect(computeChangePercent(100, 100)).toBe(0)
  })
})

describe('formatChangePercent', () => {
  it('should format positive change', () => {
    expect(formatChangePercent(12.5)).toBe('+12.5%')
  })

  it('should format negative change', () => {
    expect(formatChangePercent(-3.2)).toBe('-3.2%')
  })

  it('should format null as N/A', () => {
    expect(formatChangePercent(null)).toBe('N/A')
  })

  it('should format zero change', () => {
    expect(formatChangePercent(0)).toBe('+0.0%')
  })
})

describe('defaultPeriodDates', () => {
  it('should return current year Jan 1 to Dec 31', () => {
    const result = defaultPeriodDates()
    const year = new Date().getFullYear()
    expect(result.startDate).toBe(`${year}-01-01`)
    expect(result.endDate).toBe(`${year}-12-31`)
  })
})
