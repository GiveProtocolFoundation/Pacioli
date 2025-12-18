/**
 * Currency Service
 * Handles currency conversions, formatting, and exchange rate management
 */

import Decimal from 'decimal.js'
import {
  Currency,
  ExchangeRate,
  ConversionRequest,
  ConversionResponse,
  CurrencyFormatOptions,
  AccountSettings,
  ExchangeRateSource,
} from '../types/currency'

/**
 * Currency symbols map
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  DOT: 'DOT',
  KSM: 'KSM',
  GLMR: 'GLMR',
  ASTR: 'ASTR',
  BNC: 'BNC',
  iBTC: 'iBTC',
  ETH: 'Ξ',
  USDC: '$',
  USDT: '$',
}

/**
 * Currency Service Class
 */
export class CurrencyService {
  private exchangeRates: Map<string, ExchangeRate> = new Map()
  private currencies: Map<string, Currency> = new Map()
  private settings: AccountSettings | null = null

  /**
   * Initialize the currency service with currencies and settings
   */
  async initialize(
    currencies: Currency[],
    settings: AccountSettings
  ): Promise<void> {
    this.currencies = new Map(currencies.map(c => [c.code, c]))
    this.settings = settings
  }

  /**
   * Set account settings
   */
  setSettings(settings: AccountSettings): void {
    this.settings = settings
  }

  /**
   * Get currency by code
   */
  getCurrency(code: string): Currency | undefined {
    return this.currencies.get(code)
  }

  /**
   * Cache exchange rate
   */
  cacheExchangeRate(rate: ExchangeRate): void {
    const key = `${rate.fromCurrency}-${rate.toCurrency}`
    this.exchangeRates.set(key, rate)
  }

  /**
   * Get cached exchange rate
   */
  getCachedRate(fromCurrency: string, toCurrency: string): ExchangeRate | null {
    const key = `${fromCurrency}-${toCurrency}`
    const rate = this.exchangeRates.get(key)

    if (!rate) return null

    // Check if rate is still valid (TTL)
    const rateTime = new Date(rate.timestamp).getTime()
    const now = Date.now()
    const ageInSeconds = (now - rateTime) / 1000

    if (ageInSeconds > rate.ttlSeconds) {
      // Rate has expired
      this.exchangeRates.delete(key)
      return null
    }

    return rate
  }

  /**
   * Convert amount from one currency to another
   * This would typically call a Tauri command to get the rate from the backend
   */
  async convert(request: ConversionRequest): Promise<ConversionResponse> {
    const { fromCurrency, toCurrency, amount, timestamp, method } = request

    // If same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount,
        exchangeRate: '1.0',
        timestamp: timestamp || new Date().toISOString(),
        source: 'manual' as ExchangeRateSource,
      }
    }

    // Check cache first
    const cachedRate = this.getCachedRate(fromCurrency, toCurrency)
    if (cachedRate && (!timestamp || method !== 'historical')) {
      const convertedAmount = new Decimal(amount)
        .mul(new Decimal(cachedRate.rate))
        .toString()

      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount,
        exchangeRate: cachedRate.rate,
        timestamp: cachedRate.timestamp,
        source: cachedRate.source,
      }
    }

    // For now, return a mock conversion
    // In production, this would be:
    // const response = await invoke('get_exchange_rate', { fromCurrency, toCurrency, timestamp });

    throw new Error(
      'Exchange rate not available. Please implement Tauri command integration.'
    )
  }

  /**
   * Convert transaction to primary currency
   */
  async convertTransactionToPrimary(
    amount: string,
    currency: string,
    timestamp: string
  ): Promise<{ convertedAmount: string; rate: string; source: string }> {
    if (!this.settings) {
      throw new Error('Account settings not initialized')
    }

    const primaryCurrency = this.settings.primaryCurrency

    if (currency === primaryCurrency) {
      return {
        convertedAmount: amount,
        rate: '1.0',
        source: 'manual',
      }
    }

    const conversionMethod = this.settings.conversionMethod
    const useHistorical = conversionMethod === 'historical'

    const response = await this.convert({
      fromCurrency: currency,
      toCurrency: primaryCurrency,
      amount,
      timestamp: useHistorical ? timestamp : undefined,
      method: conversionMethod,
    })

    return {
      convertedAmount: response.convertedAmount,
      rate: response.exchangeRate,
      source: response.source,
    }
  }

  /**
   * Format currency value for display
   */
  formatCurrency(
    amount: string | number,
    currencyCode: string,
    options?: CurrencyFormatOptions
  ): string {
    const currency = this.getCurrency(currencyCode)
    const decimals =
      options?.decimals ??
      currency?.decimals ??
      this.settings?.decimalPlaces ??
      2
    const useThousands =
      options?.useThousandsSeparator ??
      this.settings?.useThousandsSeparator ??
      true
    const displayFormat =
      options?.displayFormat ?? this.settings?.currencyDisplayFormat ?? 'symbol'

    const decimal = new Decimal(amount)
    const formatted = decimal.toFixed(decimals)

    // Add thousands separator if needed
    const [whole, fraction] = formatted.split('.')
    const formattedWhole = useThousands
      ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : whole

    const numberPart = fraction
      ? `${formattedWhole}.${fraction}`
      : formattedWhole

    // Format based on display preference
    switch (displayFormat) {
      case 'symbol': {
        const symbol = options?.symbol ?? CURRENCY_SYMBOLS[currencyCode] ?? ''
        return `${symbol}${numberPart}`
      }
      case 'code':
        return `${numberPart} ${currencyCode}`
      case 'name': {
        const name = currency?.name ?? currencyCode
        return `${numberPart} ${name}`
      }
      default:
        return numberPart
    }
  }

  /**
   * Parse currency string to decimal
   */
  static parseCurrency(value: string): Decimal {
    // Remove currency symbols and thousands separators
    const cleaned = value.replace(/[^0-9.-]/g, '')
    return new Decimal(cleaned)
  }

  /**
   * Get all supported currencies
   */
  getAllCurrencies(): Currency[] {
    return Array.from(this.currencies.values())
  }

  /**
   * Get currencies by type
   */
  getCurrenciesByType(type: 'fiat' | 'crypto'): Currency[] {
    return this.getAllCurrencies().filter(c => c.type === type)
  }

  /**
   * Get reporting currencies for the account
   */
  getReportingCurrencies(): string[] {
    if (!this.settings) return []
    return [
      this.settings.primaryCurrency,
      ...(this.settings.reportingCurrencies || []),
    ]
  }

  /**
   * Calculate percentage change
   */
  static calculatePercentageChange(oldValue: string, newValue: string): number {
    const old = new Decimal(oldValue)
    const newVal = new Decimal(newValue)

    if (old.isZero()) return 0

    return newVal.minus(old).div(old).mul(100).toNumber()
  }

  /**
   * Sum amounts in the same currency
   */
  static sumAmounts(amounts: string[]): string {
    return amounts
      .reduce((sum, amount) => sum.plus(new Decimal(amount)), new Decimal(0))
      .toString()
  }

  /**
   * Check if exchange rate is stale
   */
  static isRateStale(rate: ExchangeRate): boolean {
    const rateTime = new Date(rate.timestamp).getTime()
    const now = Date.now()
    const ageInSeconds = (now - rateTime) / 1000
    return ageInSeconds > rate.ttlSeconds
  }
}

/**
 * Singleton instance
 */
export const currencyService = new CurrencyService()

/**
 * Utility function to format currency
 */
export function formatCurrency(
  amount: string | number,
  currencyCode: string,
  options?: CurrencyFormatOptions
): string {
  return currencyService.formatCurrency(amount, currencyCode, options)
}

/**
 * Utility function to get currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}

/**
 * Utility function to format compact currency (e.g., 1.5K, 2.3M)
 */
export function formatCompactCurrency(
  amount: string | number,
  currencyCode: string
): string {
  const decimal = new Decimal(amount)
  const symbol = getCurrencySymbol(currencyCode)

  if (decimal.abs().lessThan(1000)) {
    return `${symbol}${decimal.toFixed(2)}`
  }

  if (decimal.abs().lessThan(1000000)) {
    return `${symbol}${decimal.div(1000).toFixed(1)}K`
  }

  if (decimal.abs().lessThan(1000000000)) {
    return `${symbol}${decimal.div(1000000).toFixed(1)}M`
  }

  return `${symbol}${decimal.div(1000000000).toFixed(1)}B`
}
