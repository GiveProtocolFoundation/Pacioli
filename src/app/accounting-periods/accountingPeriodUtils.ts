/**
 * Formats a date string for display.
 * @param dateString - Date string (ISO 8601 date) or null/undefined
 * @returns Formatted date string or em-dash for null/undefined
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '\u2014'
  const parsed = new Date(`${dateString}T00:00:00`)
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a datetime string for display.
 * @param dateTimeString - Datetime string or null/undefined
 * @returns Formatted datetime string or em-dash for null/undefined
 */
export function formatDateTime(
  dateTimeString: string | null | undefined
): string {
  if (!dateTimeString) return '\u2014'
  const parsed = new Date(dateTimeString)
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
