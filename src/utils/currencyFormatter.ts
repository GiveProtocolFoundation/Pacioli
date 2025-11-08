import { DecimalSeparatorStandard } from '../types/currency'

export interface NumberFormatOptions {
  decimalPlaces?: number
  useThousandsSeparator?: boolean
  decimalSeparatorStandard?: DecimalSeparatorStandard
  currencySymbol?: string
  currencyCode?: string
  showCurrency?: boolean
  currencyPosition?: 'prefix' | 'suffix'
}

/**
 * Format a number according to the decimal separator standard
 */
export function formatNumber(
  value: number | string,
  options: NumberFormatOptions = {}
): string {
  const {
    decimalPlaces = 2,
    useThousandsSeparator = true,
    decimalSeparatorStandard = 'point-comma',
    currencySymbol = '$',
    currencyCode = '',
    showCurrency = false,
    currencyPosition = 'prefix',
  } = options

  // Convert to number if string
  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return '0'
  }

  // Split into integer and decimal parts
  const absoluteValue = Math.abs(numValue)
  const fixedValue = absoluteValue.toFixed(decimalPlaces)
  const [integerPart, decimalPart] = fixedValue.split('.')

  // Format integer part with thousands separator
  let formattedInteger = integerPart
  if (useThousandsSeparator && integerPart.length > 3) {
    // Use comma for initial formatting, will be replaced based on standard
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // Apply decimal separator standard
  let formattedNumber = ''

  switch (decimalSeparatorStandard) {
    case 'point-comma':
      // 1,234.56 - comma for thousands, point for decimal
      formattedNumber =
        decimalPlaces > 0
          ? `${formattedInteger}.${decimalPart}`
          : formattedInteger
      break

    case 'comma-point':
      // 1.234,56 - point for thousands, comma for decimal
      formattedNumber =
        decimalPlaces > 0
          ? `${formattedInteger.replace(/,/g, '.')},${decimalPart}`
          : formattedInteger.replace(/,/g, '.')
      break

    case 'point-space':
      // 1 234.56 - thin space for thousands, point for decimal
      // Using U+2009 (thin space) for proper typography
      formattedNumber =
        decimalPlaces > 0
          ? `${formattedInteger.replace(/,/g, '\u2009')}.${decimalPart}`
          : formattedInteger.replace(/,/g, '\u2009')
      break

    case 'comma-space':
      // 1 234,56 - thin space for thousands, comma for decimal
      // Using U+2009 (thin space) for proper typography
      formattedNumber =
        decimalPlaces > 0
          ? `${formattedInteger.replace(/,/g, '\u2009')},${decimalPart}`
          : formattedInteger.replace(/,/g, '\u2009')
      break

    default:
      formattedNumber =
        decimalPlaces > 0
          ? `${formattedInteger}.${decimalPart}`
          : formattedInteger
  }

  // Add negative sign if needed
  if (numValue < 0) {
    formattedNumber = `-${formattedNumber}`
  }

  // Add currency if requested
  if (showCurrency) {
    if (currencySymbol && currencyPosition === 'prefix') {
      formattedNumber = `${currencySymbol}${formattedNumber}`
    } else if (currencySymbol && currencyPosition === 'suffix') {
      formattedNumber = `${formattedNumber} ${currencySymbol}`
    } else if (currencyCode) {
      formattedNumber = `${formattedNumber} ${currencyCode}`
    }
  }

  return formattedNumber
}

/**
 * Format a currency value with symbol
 */
export function formatCurrency(
  value: number | string,
  currencyCode = 'USD',
  options: Omit<NumberFormatOptions, 'showCurrency' | 'currencyCode'> = {}
): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹',
  }

  return formatNumber(value, {
    ...options,
    showCurrency: true,
    currencySymbol: currencySymbols[currencyCode] || currencyCode,
    currencyCode,
  })
}

/**
 * Format a percentage value
 */
export function formatPercentage(
  value: number,
  options: Pick<
    NumberFormatOptions,
    'decimalPlaces' | 'decimalSeparatorStandard'
  > = {}
): string {
  const formatted = formatNumber(value, {
    ...options,
    useThousandsSeparator: false,
  })
  return `${formatted}%`
}

/**
 * Parse a formatted number string back to a number
 */
export function parseFormattedNumber(
  formattedValue: string,
  decimalSeparatorStandard: DecimalSeparatorStandard = 'point-comma'
): number {
  // Remove currency symbols and whitespace
  let cleaned = formattedValue
    .replace(/[$€£¥₹]/gu, '')
    .replace(/[A-Z]{3}/g, '')
    .trim()

  // Convert based on separator standard
  switch (decimalSeparatorStandard) {
    case 'point-comma':
      // Remove commas (thousands) and parse
      cleaned = cleaned.replace(/,/g, '')
      break

    case 'comma-point':
      // Replace comma (decimal) with point, remove points (thousands)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
      break

    case 'point-space':
      // Remove spaces (thousands) - both regular and thin spaces
      cleaned = cleaned.replace(/[ \u2009]/g, '')
      break

    case 'comma-space':
      // Remove spaces (thousands) - both regular and thin spaces, replace comma (decimal) with point
      cleaned = cleaned.replace(/[ \u2009]/g, '').replace(',', '.')
      break

    default:
      // Default to point-comma format (most common)
      cleaned = cleaned.replace(/,/g, '')
      break
  }

  return parseFloat(cleaned) || 0
}
