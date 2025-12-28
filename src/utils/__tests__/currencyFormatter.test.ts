import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  parseFormattedNumber,
} from '../currencyFormatter'

describe('currencyFormatter', () => {
  describe('formatNumber', () => {
    describe('basic formatting', () => {
      it('should format a simple number with default options', () => {
        expect(formatNumber(1234.56)).toBe('1,234.56')
      })

      it('should format zero', () => {
        expect(formatNumber(0)).toBe('0.00')
      })

      it('should format negative numbers', () => {
        expect(formatNumber(-1234.56)).toBe('-1,234.56')
      })

      it('should handle string input', () => {
        expect(formatNumber('1234.56')).toBe('1,234.56')
      })

      it('should return "0" for NaN input', () => {
        expect(formatNumber(NaN)).toBe('0')
        expect(formatNumber('invalid')).toBe('0')
      })

      it('should format large numbers', () => {
        expect(formatNumber(1234567890.12)).toBe('1,234,567,890.12')
      })

      it('should format small numbers', () => {
        expect(formatNumber(0.12)).toBe('0.12')
      })
    })

    describe('decimal places', () => {
      it('should respect custom decimal places', () => {
        expect(formatNumber(1234.5678, { decimalPlaces: 4 })).toBe('1,234.5678')
      })

      it('should handle zero decimal places', () => {
        expect(formatNumber(1234.56, { decimalPlaces: 0 })).toBe('1,235')
      })

      it('should pad with zeros if needed', () => {
        expect(formatNumber(1234, { decimalPlaces: 2 })).toBe('1,234.00')
      })
    })

    describe('thousands separator', () => {
      it('should disable thousands separator when requested', () => {
        expect(formatNumber(1234567, { useThousandsSeparator: false })).toBe(
          '1234567.00'
        )
      })

      it('should not add separator for numbers less than 1000', () => {
        expect(formatNumber(999)).toBe('999.00')
      })
    })

    describe('decimal separator standards', () => {
      it('should format with point-comma standard (US/UK)', () => {
        expect(
          formatNumber(1234.56, { decimalSeparatorStandard: 'point-comma' })
        ).toBe('1,234.56')
      })

      it('should format with comma-point standard (Europe)', () => {
        expect(
          formatNumber(1234.56, { decimalSeparatorStandard: 'comma-point' })
        ).toBe('1.234,56')
      })

      it('should format with point-space standard', () => {
        expect(
          formatNumber(1234.56, { decimalSeparatorStandard: 'point-space' })
        ).toBe('1\u2009234.56') // \u2009 is thin space
      })

      it('should format with comma-space standard', () => {
        expect(
          formatNumber(1234.56, { decimalSeparatorStandard: 'comma-space' })
        ).toBe('1\u2009234,56')
      })

      it('should handle zero decimal places with comma-point standard', () => {
        expect(
          formatNumber(1234.56, {
            decimalPlaces: 0,
            decimalSeparatorStandard: 'comma-point',
          })
        ).toBe('1.235')
      })
    })

    describe('currency display', () => {
      it('should add currency symbol as prefix', () => {
        expect(
          formatNumber(1234.56, {
            showCurrency: true,
            currencySymbol: '$',
            currencyPosition: 'prefix',
          })
        ).toBe('$1,234.56')
      })

      it('should add currency symbol as suffix', () => {
        expect(
          formatNumber(1234.56, {
            showCurrency: true,
            currencySymbol: '€',
            currencyPosition: 'suffix',
          })
        ).toBe('1,234.56 €')
      })

      it('should fall back to currency code if no symbol', () => {
        expect(
          formatNumber(1234.56, {
            showCurrency: true,
            currencySymbol: '',
            currencyCode: 'USD',
          })
        ).toBe('1,234.56 USD')
      })
    })
  })

  describe('formatCurrency', () => {
    it('should format USD with dollar sign', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56')
    })

    it('should format EUR with euro sign', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56')
    })

    it('should format GBP with pound sign', () => {
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56')
    })

    it('should format JPY with yen sign', () => {
      expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,234.56')
    })

    it('should format CAD with CA$ prefix', () => {
      expect(formatCurrency(1234.56, 'CAD')).toBe('CA$1,234.56')
    })

    it('should format unknown currency with code as symbol', () => {
      expect(formatCurrency(1234.56, 'XYZ')).toBe('XYZ1,234.56')
    })

    it('should respect decimal separator options', () => {
      expect(
        formatCurrency(1234.56, 'EUR', {
          decimalSeparatorStandard: 'comma-point',
        })
      ).toBe('€1.234,56')
    })

    it('should handle negative values', () => {
      expect(formatCurrency(-1234.56, 'USD')).toBe('$-1,234.56')
    })
  })

  describe('formatPercentage', () => {
    it('should format a positive percentage', () => {
      expect(formatPercentage(12.34)).toBe('12.34%')
    })

    it('should format zero percentage', () => {
      expect(formatPercentage(0)).toBe('0.00%')
    })

    it('should format negative percentage', () => {
      expect(formatPercentage(-5.5)).toBe('-5.50%')
    })

    it('should respect custom decimal places', () => {
      expect(formatPercentage(12.3456, { decimalPlaces: 1 })).toBe('12.3%')
    })

    it('should not use thousands separator', () => {
      expect(formatPercentage(1234.56)).toBe('1234.56%')
    })

    it('should respect decimal separator standard', () => {
      expect(
        formatPercentage(12.34, { decimalSeparatorStandard: 'comma-point' })
      ).toBe('12,34%')
    })
  })

  describe('parseFormattedNumber', () => {
    describe('point-comma standard (US/UK)', () => {
      it('should parse a formatted number', () => {
        expect(parseFormattedNumber('1,234.56', 'point-comma')).toBe(1234.56)
      })

      it('should parse number with currency symbol', () => {
        expect(parseFormattedNumber('$1,234.56', 'point-comma')).toBe(1234.56)
      })

      it('should parse number with euro symbol', () => {
        expect(parseFormattedNumber('€1,234.56', 'point-comma')).toBe(1234.56)
      })

      it('should parse number with currency code', () => {
        expect(parseFormattedNumber('1,234.56 USD', 'point-comma')).toBe(
          1234.56
        )
      })

      it('should handle negative numbers', () => {
        expect(parseFormattedNumber('-1,234.56', 'point-comma')).toBe(-1234.56)
      })
    })

    describe('comma-point standard (Europe)', () => {
      it('should parse European format', () => {
        expect(parseFormattedNumber('1.234,56', 'comma-point')).toBe(1234.56)
      })

      it('should parse with currency symbol', () => {
        expect(parseFormattedNumber('€1.234,56', 'comma-point')).toBe(1234.56)
      })
    })

    describe('point-space standard', () => {
      it('should parse format with thin space separator', () => {
        expect(parseFormattedNumber('1\u2009234.56', 'point-space')).toBe(
          1234.56
        )
      })

      it('should parse format with regular space separator', () => {
        expect(parseFormattedNumber('1 234.56', 'point-space')).toBe(1234.56)
      })
    })

    describe('comma-space standard', () => {
      it('should parse format with thin space and comma decimal', () => {
        expect(parseFormattedNumber('1\u2009234,56', 'comma-space')).toBe(
          1234.56
        )
      })

      it('should parse format with regular space and comma decimal', () => {
        expect(parseFormattedNumber('1 234,56', 'comma-space')).toBe(1234.56)
      })
    })

    describe('edge cases', () => {
      it('should return 0 for empty string', () => {
        expect(parseFormattedNumber('', 'point-comma')).toBe(0)
      })

      it('should return 0 for invalid input', () => {
        expect(parseFormattedNumber('invalid', 'point-comma')).toBe(0)
      })

      it('should handle numbers without separators', () => {
        expect(parseFormattedNumber('1234.56', 'point-comma')).toBe(1234.56)
      })

      it('should use default standard if unknown', () => {
        // @ts-expect-error testing invalid input
        expect(parseFormattedNumber('1,234.56', 'unknown')).toBe(1234.56)
      })
    })
  })

  describe('roundtrip: format then parse', () => {
    const testCases = [
      { value: 1234.56, standard: 'point-comma' as const },
      { value: 9999999.99, standard: 'point-comma' as const },
      { value: 1234.56, standard: 'comma-point' as const },
      { value: 1234.56, standard: 'point-space' as const },
      { value: 1234.56, standard: 'comma-space' as const },
    ]

    testCases.forEach(({ value, standard }) => {
      it(`should roundtrip ${value} with ${standard} standard`, () => {
        const formatted = formatNumber(value, {
          decimalSeparatorStandard: standard,
        })
        const parsed = parseFormattedNumber(formatted, standard)
        expect(parsed).toBe(value)
      })
    })
  })
})
