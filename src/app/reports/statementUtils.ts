/**
 * Utility functions for financial statement pages.
 * Pure helpers — no React, fully testable via Vitest.
 */

/** Formats minor units (integer cents) as a dollar string: 12345 → "$123.45". */
export function formatMinorAsDollars(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  const dollars = Math.floor(abs / 100)
  const cents = abs % 100
  return `${sign}$${dollars.toLocaleString('en-US')}.${String(cents).padStart(2, '0')}`
}

/** Formats minor units without currency symbol: 12345 → "123.45". */
export function formatMinorPlain(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  const dollars = Math.floor(abs / 100)
  const cents = abs % 100
  return `${sign}${dollars.toLocaleString('en-US')}.${String(cents).padStart(2, '0')}`
}

/** Formats an ISO date string to a readable format: "2025-01-01" → "Jan 1, 2025". */
export function formatStatementDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const date = new Date(
    Number.parseInt(parts[0], 10),
    Number.parseInt(parts[1], 10) - 1,
    Number.parseInt(parts[2], 10),
  )
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Returns the period-over-period change as a percentage, or null if prior is 0. */
export function computeChangePercent(
  current: number,
  prior: number,
): number | null {
  if (prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

/** Formats a change percentage: "+12.5%" or "-3.2%" or "N/A". */
export function formatChangePercent(pct: number | null): string {
  if (pct === null) return 'N/A'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * Returns the default period dates for statements.
 * Defaults to the current calendar year (Jan 1 – Dec 31).
 */
export function defaultPeriodDates(): {
  startDate: string
  endDate: string
} {
  const now = new Date()
  const year = now.getFullYear()
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}
