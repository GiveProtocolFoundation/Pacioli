/**
 * Price Service
 *
 * Fetches cryptocurrency prices from CoinGecko via Tauri commands.
 * Used to add USD values to imported transactions.
 */

import { invoke } from '@tauri-apps/api/core'
import { isTauriAvailable } from '../../utils/tauri'

/** Response from single price lookup */
export interface PriceResponse {
  coin_id: string
  price: string
  currency: string
}

/** Response from historical price lookup */
export interface HistoricalPriceResponse {
  coin_id: string
  price: string
  currency: string
  date: string
}

/** Response from batch historical price lookup */
export interface BatchHistoricalPriceResponse {
  prices: Record<string, { Ok?: string; Err?: string }>
  currency: string
  date: string
}

/** Map of network/token symbols to CoinGecko IDs */
const COINGECKO_IDS: Record<string, string> = {
  // Polkadot ecosystem
  DOT: 'polkadot',
  KSM: 'kusama',
  GLMR: 'moonbeam',
  MOVR: 'moonriver',
  ASTR: 'astar',
  ACA: 'acala',
  AUSD: 'acala-dollar',
  // Ethereum ecosystem
  ETH: 'ethereum',
  WETH: 'weth',
  // Stablecoins
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  BUSD: 'binance-usd',
  // Other major tokens
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  MATIC: 'matic-network',
  BNB: 'binancecoin',
  SOL: 'solana',
  AVAX: 'avalanche-2',
  ATOM: 'cosmos',
  NEAR: 'near',
  FTM: 'fantom',
  ARB: 'arbitrum',
  OP: 'optimism',
}

/** Map of network names to their native token CoinGecko IDs */
const NETWORK_NATIVE_TOKENS: Record<string, string> = {
  polkadot: 'polkadot',
  kusama: 'kusama',
  moonbeam: 'moonbeam',
  moonriver: 'moonriver',
  astar: 'astar',
  acala: 'acala',
  ethereum: 'ethereum',
  polygon: 'matic-network',
  arbitrum: 'ethereum', // Uses ETH
  optimism: 'ethereum', // Uses ETH
  base: 'ethereum', // Uses ETH
}

/**
 * Get CoinGecko ID for a token symbol
 */
export function getCoinGeckoId(symbol: string): string | null {
  const upperSymbol = symbol.toUpperCase()
  return COINGECKO_IDS[upperSymbol] || null
}

/**
 * Get CoinGecko ID for a network's native token
 */
export function getNetworkCoinGeckoId(network: string): string | null {
  const lowerNetwork = network.toLowerCase()
  return NETWORK_NATIVE_TOKENS[lowerNetwork] || null
}

/**
 * Convert a Date or timestamp to CoinGecko's date format (DD-MM-YYYY)
 */
export function toCoinGeckoDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Get current price for a cryptocurrency
 */
export async function getCurrentPrice(
  coinId: string,
  vsCurrency = 'usd'
): Promise<number | null> {
  if (!isTauriAvailable()) {
    console.warn('[PriceService] Tauri not available, cannot fetch price')
    return null
  }

  try {
    const response = await invoke<PriceResponse>('get_crypto_price', {
      coinId,
      vsCurrency,
    })
    return parseFloat(response.price)
  } catch (error) {
    console.error(`[PriceService] Failed to get price for ${coinId}:`, error)
    return null
  }
}

/**
 * Get current prices for multiple cryptocurrencies
 */
export async function getCurrentPrices(
  coinIds: string[],
  vsCurrency = 'usd'
): Promise<Record<string, number>> {
  if (!isTauriAvailable()) {
    console.warn('[PriceService] Tauri not available, cannot fetch prices')
    return {}
  }

  try {
    const response = await invoke<Record<string, string>>('get_crypto_prices', {
      coinIds,
      vsCurrency,
    })
    const result: Record<string, number> = {}
    for (const [coinId, price] of Object.entries(response)) {
      result[coinId] = parseFloat(price)
    }
    return result
  } catch (error) {
    console.error('[PriceService] Failed to get prices:', error)
    return {}
  }
}

/**
 * Get historical price for a cryptocurrency on a specific date
 */
export async function getHistoricalPrice(
  coinId: string,
  date: Date | number,
  vsCurrency = 'usd'
): Promise<number | null> {
  if (!isTauriAvailable()) {
    console.warn('[PriceService] Tauri not available, cannot fetch historical price')
    return null
  }

  try {
    const dateStr = toCoinGeckoDate(date)
    const response = await invoke<HistoricalPriceResponse>('get_historical_crypto_price', {
      coinId,
      date: dateStr,
      vsCurrency,
    })
    return parseFloat(response.price)
  } catch (error) {
    console.error(`[PriceService] Failed to get historical price for ${coinId} on ${date}:`, error)
    return null
  }
}

/**
 * Get historical prices for multiple cryptocurrencies on a specific date
 * Useful for batch processing transactions from the same day
 */
export async function getBatchHistoricalPrices(
  coinIds: string[],
  date: Date | number,
  vsCurrency = 'usd'
): Promise<Record<string, number | null>> {
  if (!isTauriAvailable()) {
    console.warn('[PriceService] Tauri not available, cannot fetch historical prices')
    return {}
  }

  try {
    const dateStr = toCoinGeckoDate(date)
    const response = await invoke<BatchHistoricalPriceResponse>('get_batch_historical_prices', {
      coinIds,
      date: dateStr,
      vsCurrency,
    })

    const result: Record<string, number | null> = {}
    for (const [coinId, priceResult] of Object.entries(response.prices)) {
      if (priceResult.Ok) {
        result[coinId] = parseFloat(priceResult.Ok)
      } else {
        result[coinId] = null
      }
    }
    return result
  } catch (error) {
    console.error('[PriceService] Failed to get batch historical prices:', error)
    return {}
  }
}

/**
 * Calculate USD value for a transaction
 *
 * @param amount - The token amount (already converted from planck/wei)
 * @param tokenSymbol - The token symbol (e.g., "DOT", "KSM")
 * @param timestamp - The transaction timestamp
 * @returns The USD value or null if price couldn't be fetched
 */
export async function calculateUsdValue(
  amount: number,
  tokenSymbol: string,
  timestamp: Date | number
): Promise<number | null> {
  const coinId = getCoinGeckoId(tokenSymbol)
  if (!coinId) {
    console.warn(`[PriceService] No CoinGecko ID found for ${tokenSymbol}`)
    return null
  }

  const price = await getHistoricalPrice(coinId, timestamp)
  if (price === null) {
    return null
  }

  return amount * price
}

/**
 * Batch calculate USD values for multiple transactions
 * Groups transactions by date to minimize API calls
 *
 * @param transactions - Array of { amount, tokenSymbol, timestamp }
 * @returns Array of USD values (null if price couldn't be fetched)
 */
export async function batchCalculateUsdValues(
  transactions: Array<{
    amount: number
    tokenSymbol: string
    timestamp: Date | number
  }>
): Promise<(number | null)[]> {
  if (transactions.length === 0) return []

  // Group transactions by date and token
  const byDateAndToken = new Map<string, Map<string, number[]>>()

  transactions.forEach((tx, index) => {
    const dateStr = toCoinGeckoDate(tx.timestamp)
    const coinId = getCoinGeckoId(tx.tokenSymbol)
    if (!coinId) return

    if (!byDateAndToken.has(dateStr)) {
      byDateAndToken.set(dateStr, new Map())
    }
    const dateMap = byDateAndToken.get(dateStr)!
    if (!dateMap.has(coinId)) {
      dateMap.set(coinId, [])
    }
    dateMap.get(coinId)!.push(index)
  })

  // Fetch prices for each unique date
  const results: (number | null)[] = new Array(transactions.length).fill(null)

  for (const [dateStr, tokenMap] of byDateAndToken) {
    const coinIds = Array.from(tokenMap.keys())
    const date = parseCoingeckoDate(dateStr)

    const prices = await getBatchHistoricalPrices(coinIds, date)

    // Calculate USD values for each transaction
    for (const [coinId, indices] of tokenMap) {
      const price = prices[coinId]
      if (price !== null) {
        for (const index of indices) {
          results[index] = transactions[index].amount * price
        }
      }
    }
  }

  return results
}

/**
 * Parse a CoinGecko date string (DD-MM-YYYY) back to a Date
 */
function parseCoingeckoDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export const priceService = {
  getCoinGeckoId,
  getNetworkCoinGeckoId,
  toCoinGeckoDate,
  getCurrentPrice,
  getCurrentPrices,
  getHistoricalPrice,
  getBatchHistoricalPrices,
  calculateUsdValue,
  batchCalculateUsdValues,
}
