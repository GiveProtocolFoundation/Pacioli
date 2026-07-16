import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '../accountingPeriodUtils'

const missingValue: string | undefined = undefined

describe('formatDate', () => {
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('\u2014')
  })

  it('returns em-dash for undefined', () => {
    expect(formatDate(missingValue)).toBe('\u2014')
  })

  it('returns em-dash for empty string', () => {
    expect(formatDate('')).toBe('\u2014')
  })

  it('formats a valid date string', () => {
    const result = formatDate('2026-01-15')
    expect(result).toContain('2026')
    expect(result).toContain('15')
  })

  it('formats month boundary dates', () => {
    const result = formatDate('2026-12-31')
    expect(result).toContain('2026')
    expect(result).toContain('31')
  })
})

describe('formatDateTime', () => {
  it('returns em-dash for null', () => {
    expect(formatDateTime(null)).toBe('\u2014')
  })

  it('returns em-dash for undefined', () => {
    expect(formatDateTime(missingValue)).toBe('\u2014')
  })

  it('returns em-dash for empty string', () => {
    expect(formatDateTime('')).toBe('\u2014')
  })

  it('formats a valid datetime string', () => {
    const result = formatDateTime('2026-01-15T14:30:00')
    expect(result).toContain('2026')
    expect(result).toContain('15')
  })
})
