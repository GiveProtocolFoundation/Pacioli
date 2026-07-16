/**
 * Formats a date string for display.
 * @param d - Date string (ISO 8601 date) or null/undefined
 * @returns Formatted date string or em-dash for null/undefined
 */
export function formatDate(d: string | null | undefined): string {
  if (!d) return '\u2014'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a datetime string for display.
 * @param d - Datetime string or null/undefined
 * @returns Formatted datetime string or em-dash for null/undefined
 */
export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '\u2014'
  const date = new Date(d)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Computes the last day of a given month.
 * @param year - Full year
 * @param month - Month (1-12)
 * @returns ISO date string for the last day of the month
 */
export function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0)
  return d.toISOString().split('T')[0]
}

/**
 * Computes the first day of a given month.
 * @param year - Full year
 * @param month - Month (1-12)
 * @returns ISO date string for the first day of the month
 */
export function firstDayOfMonth(year: number, month: number): string {
  const m = String(month).padStart(2, '0')
  return `${year}-${m}-01`
}
