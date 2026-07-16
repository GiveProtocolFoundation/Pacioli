/**
 * Converts a dollar-string to integer minor units (cents) using integer math.
 * Avoids floating-point precision issues by parsing the string directly.
 * @param val - Dollar string (e.g. "123.45")
 * @returns Integer cents (e.g. 12345)
 */
export function toMinorUnits(val: string): number {
  const trimmed = val.trim()
  if (trimmed === '') return 0
  // Parse the sign from the string, not from parseInt: parseInt('-0', 10)
  // yields -0, which is NOT < 0, so "-0.50" silently flipped sign to +50.
  const negative = trimmed.startsWith('-')
  const unsigned = trimmed.replace(/^[+-]/, '')
  const parts = unsigned.split('.')
  const fraction = parts[1] ?? ''
  const whole = Number.parseInt(parts[0] || '0', 10)
  if (Number.isNaN(whole) && fraction === '') return 0
  const centStr = fraction.slice(0, 2).padEnd(2, '0')
  const cents = Number.parseInt(centStr, 10)
  const magnitude =
    (Number.isNaN(whole) ? 0 : whole) * 100 + (Number.isNaN(cents) ? 0 : cents)
  return negative ? -magnitude : magnitude
}

/**
 * Formats minor units (integer cents) as a USD dollar string.
 * Uses integer math only — no floats touch money.
 * @param minor - Amount in cents
 * @returns Formatted dollar string (e.g., "123.45")
 */
export function minorToDollars(minor: number): string {
  const negative = minor < 0
  const abs = Math.abs(minor)
  const dollars = Math.trunc(abs / 100)
  const cents = abs % 100
  const str = `${dollars}.${String(cents).padStart(2, '0')}`
  return negative ? `-${str}` : str
}

/**
 * Computes the balance of line items in integer minor units.
 * @param lines - Array of objects with debitAmount and creditAmount dollar-strings
 * @returns Object with totalDebitMinor, totalCreditMinor, differenceMinor, and isBalanced
 */
export function computeBalance(
  lines: { debitAmount: string; creditAmount: string }[]
): {
  totalDebitMinor: number
  totalCreditMinor: number
  differenceMinor: number
  isBalanced: boolean
} {
  const totalDebitMinor = lines.reduce(
    (s, l) => s + toMinorUnits(l.debitAmount),
    0
  )
  const totalCreditMinor = lines.reduce(
    (s, l) => s + toMinorUnits(l.creditAmount),
    0
  )
  const differenceMinor = totalDebitMinor - totalCreditMinor
  return {
    totalDebitMinor,
    totalCreditMinor,
    differenceMinor,
    isBalanced: differenceMinor === 0 && totalDebitMinor > 0,
  }
}

/**
 * Maps a database status string to a display status key.
 * @param status - Raw status from the database
 * @returns Display status key
 */
export function displayStatus(
  status: string
): 'draft' | 'approved' | 'posted' | 'voided' {
  if (status === 'voided') return 'voided'
  if (status === 'posted') return 'posted'
  if (status === 'approved') return 'approved'
  return 'draft'
}

/**
 * Formats a date string or Date for display.
 * @param d - Date value to format
 * @returns Formatted date string or em-dash for null/undefined
 */
export function formatDate(d: string | Date | undefined | null): string {
  if (!d) return '\u2014'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a date string or Date with time for display.
 * @param d - Date value to format
 * @returns Formatted datetime string or em-dash for null/undefined
 */
export function formatDateTime(d: string | Date | undefined | null): string {
  if (!d) return '\u2014'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
