import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  firstDayOfMonth,
  lastDayOfMonth,
} from '../accountingPeriodUtils'

describe('formatDate', () => {
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('\u2014')
  })

  it('returns em-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('\u2014')
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
    expect(formatDateTime(undefined)).toBe('\u2014')
  })

  it('formats a valid datetime string', () => {
    const result = formatDateTime('2026-01-15T14:30:00')
    expect(result).toContain('2026')
    expect(result).toContain('15')
  })
})

describe('firstDayOfMonth', () => {
  it('returns correct first day for January', () => {
    expect(firstDayOfMonth(2026, 1)).toBe('2026-01-01')
  })

  it('returns correct first day for December', () => {
    expect(firstDayOfMonth(2026, 12)).toBe('2026-12-01')
  })

  it('pads single-digit months', () => {
    expect(firstDayOfMonth(2026, 3)).toBe('2026-03-01')
  })
})

describe('lastDayOfMonth', () => {
  it('returns 31 for January', () => {
    expect(lastDayOfMonth(2026, 1)).toBe('2026-01-31')
  })

  it('returns 28 for February (non-leap)', () => {
    expect(lastDayOfMonth(2026, 2)).toBe('2026-02-28')
  })

  it('returns 29 for February (leap year)', () => {
    expect(lastDayOfMonth(2028, 2)).toBe('2028-02-29')
  })

  it('returns 30 for April', () => {
    expect(lastDayOfMonth(2026, 4)).toBe('2026-04-30')
  })

  it('returns 31 for December', () => {
    expect(lastDayOfMonth(2026, 12)).toBe('2026-12-31')
  })
})
