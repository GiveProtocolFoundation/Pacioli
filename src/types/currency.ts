/**
 * Currency Architecture TypeScript Types
 * These types mirror the Rust structs and database schema
 */

/**
 * Currency type enumeration
 */
export type CurrencyType = 'fiat' | 'crypto'

/**
 * Currency model representing a supported currency
 */
export interface Currency {
  id: string
  code: string // ISO code for fiat (USD, EUR) or ticker for crypto (BTC, ETH)
  name: string
  type: CurrencyType
  decimals: number
  isSupported: boolean // For phased rollout
  coingeckoId?: string // For crypto price feeds from CoinGecko
  fixerId?: string // For fiat exchange rates from Fixer
  symbol?: string // Display symbol (e.g., $, €, ₿)
  iconUrl?: string // URL to currency icon
  createdAt: string
  updatedAt: string
}

/**
 * Exchange rate source enumeration
 */
export type ExchangeRateSource = 'coingecko' | 'fixer' | 'manual' | 'compound'

/**
 * Exchange rate model for currency conversions
 */
export interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: string // Stored as string to preserve decimal precision
  timestamp: string
  source: ExchangeRateSource
  ttlSeconds: number // Time to live: 300s (5 min) for crypto, 86400s (24h) for fiat
  metadata?: string // JSON string for additional data
  createdAt: string
  updatedAt: string
}

/**
 * Conversion method enumeration
 */
export type ConversionMethod = 'spot' | 'historical' | 'fixed'

/**
 * Currency display format enumeration
 */
export type CurrencyDisplayFormat = 'symbol' | 'code' | 'name'

/**
 * Decimal separator standard enumeration
 */
export type DecimalSeparatorStandard =
  | 'point-comma' // 1,234.56 (common in US, UK, etc.)
  | 'comma-point' // 1.234,56 (common in EU, Latin America)
  | 'point-space' // 1 234.56 (common in Canada, Switzerland)
  | 'comma-space' // 1 234,56 (common in some European countries)

/**
 * Account settings for currency preferences per organization/profile
 */
export interface AccountSettings {
  id: string
  profileId: string
  primaryCurrency: string // The main reporting currency
  reportingCurrencies?: string[] // Additional reporting currencies
  conversionMethod: ConversionMethod
  // Display preferences
  decimalPlaces: number
  useThousandsSeparator: boolean
  currencyDisplayFormat: CurrencyDisplayFormat
  decimalSeparatorStandard: DecimalSeparatorStandard
  // Auto-conversion settings
  autoConvert: boolean // Automatically convert to primary currency
  cacheExchangeRates: boolean // Cache rates for performance
  // API configuration
  coingeckoApiKey?: string
  fixerApiKey?: string
  createdAt: string
  updatedAt: string
}

/**
 * Enhanced transaction interface with currency conversion fields
 */
export interface TransactionWithConversion {
  id: string
  profileId: string
  chain: string
  hash: string
  blockNumber: number
  timestamp: string
  fromAddress: string
  toAddress?: string
  value: string // Original amount as string for precision
  tokenSymbol: string // Original currency
  tokenDecimals: number
  transactionType: string
  status: string
  fee?: string
  metadata?: string
  // Currency conversion fields
  amountPrimary?: string // Converted to primary currency
  primaryCurrency?: string // The currency used for conversion
  exchangeRate?: string // Historical rate used
  exchangeRateSource?: string // Source of the exchange rate
  exchangeRateTimestamp?: string // When the rate was fetched
  createdAt: string
  updatedAt: string
}

/**
 * Helper interface for currency conversion calculations
 */
export interface CurrencyConversion {
  fromCurrency: string
  toCurrency: string
  amount: string
  convertedAmount: string
  exchangeRate: string
  timestamp: string
}

/**
 * Currency balance with conversion
 */
export interface CurrencyBalance {
  currency: string
  amount: number
  usdValue: number
  primaryValue?: number // Value in user's primary currency
  change24h?: number
}

/**
 * Historical balance data point for charts
 */
export interface BalanceDataPoint {
  date: string
  [currency: string]: number | string // Dynamic currency keys
}

/**
 * Price feed configuration
 */
export interface PriceFeedConfig {
  source: ExchangeRateSource
  apiKey?: string
  refreshInterval: number // In seconds
  baseCurrency: string
}

/**
 * Currency conversion request
 */
export interface ConversionRequest {
  fromCurrency: string
  toCurrency: string
  amount: string
  timestamp?: string // For historical conversions
  method?: ConversionMethod
}

/**
 * Currency conversion response
 */
export interface ConversionResponse {
  fromCurrency: string
  toCurrency: string
  amount: string
  convertedAmount: string
  exchangeRate: string
  timestamp: string
  source: ExchangeRateSource
}

/**
 * Supported currencies - Re-exported from constants for backwards compatibility
 */
import {
  FIAT_CURRENCY_CODES,
  CRYPTO_CURRENCY_CODES,
} from '../constants/currencies'

export const SUPPORTED_FIAT_CURRENCIES = FIAT_CURRENCY_CODES
export const SUPPORTED_CRYPTO_CURRENCIES = CRYPTO_CURRENCY_CODES

export type SupportedCryptoCurrency =
  (typeof SUPPORTED_CRYPTO_CURRENCIES)[number]
export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number]
export type SupportedCurrency = SupportedCryptoCurrency | SupportedFiatCurrency

/**
 * Currency formatting options
 */
export interface CurrencyFormatOptions {
  decimals?: number
  useThousandsSeparator?: boolean
  displayFormat?: CurrencyDisplayFormat
  decimalSeparatorStandard?: DecimalSeparatorStandard
  symbol?: string
}
