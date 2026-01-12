/**
 * Crypto Logo Utility
 *
 * Provides functions to retrieve cryptocurrency logos from the public/crypto-icons directory.
 * Includes fallback handling for cryptocurrencies without logos.
 * Supports theme-specific logos for cryptocurrencies like GLMR.
 */

export interface CryptoLogoConfig {
  symbol: string
  logoPath: string | null
  logoPathDark?: string | null // Optional dark theme logo
  color: string // Brand color for fallback display
}

// Map of supported cryptocurrencies with their logo paths and brand colors
const CRYPTO_LOGOS: Record<string, CryptoLogoConfig> = {
  BTC: {
    symbol: 'BTC',
    logoPath: '/crypto-icons/btc.svg',
    color: '#F7931A',
  },
  DOT: {
    symbol: 'DOT',
    logoPath: '/crypto-icons/dot.svg',
    color: '#E6007A',
  },
  KSM: {
    symbol: 'KSM',
    logoPath: '/crypto-icons/ksm.svg',
    color: '#000000',
  },
  GLMR: {
    symbol: 'GLMR',
    logoPath: '/crypto-icons/GLMR_Black.svg', // Light mode
    logoPathDark: '/crypto-icons/GLMR_White.svg', // Dark mode
    color: '#53CBC8',
  },
  ASTR: {
    symbol: 'ASTR',
    logoPath: '/crypto-icons/ASTR.png',
    color: '#0081FF',
  },
  BNC: {
    symbol: 'BNC',
    logoPath: '/crypto-icons/BNC.svg',
    color: '#5A25F0',
  },
  IBTC: {
    symbol: 'iBTC',
    logoPath: '/crypto-icons/iBTC.svg',
    color: '#F7931A',
  },
  USDC: {
    symbol: 'USDC',
    logoPath: '/crypto-icons/usdc.svg',
    color: '#2775CA',
  },
  USDT: {
    symbol: 'USDT',
    logoPath: '/crypto-icons/usdt.svg',
    color: '#26A17B',
  },
}

/**
 * Get the logo path for a cryptocurrency symbol
 * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'DOT')
 * @param theme - Current theme ('light' or 'dark'), defaults to 'light'
 * @returns The logo path or null if not available
 */
export const getCryptoLogoPath = (
  symbol: string,
  theme: 'light' | 'dark' = 'light'
): string | null => {
  const crypto = CRYPTO_LOGOS[symbol.toUpperCase()]
  if (!crypto) return null

  // Use theme-specific logo if available and theme is dark
  if (theme === 'dark' && crypto.logoPathDark) {
    return crypto.logoPathDark
  }

  return crypto.logoPath || null
}

/**
 * Get the brand color for a cryptocurrency symbol
 * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'DOT')
 * @returns The brand color hex code
 */
export const getCryptoBrandColor = (symbol: string): string => {
  const crypto = CRYPTO_LOGOS[symbol.toUpperCase()]
  return crypto?.color || '#2563EB' // Default to blue if unknown
}

/**
 * Check if a cryptocurrency logo is available
 * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'DOT')
 * @returns True if logo exists, false otherwise
 */
export const hasCryptoLogo = (symbol: string): boolean => {
  const logoPath = getCryptoLogoPath(symbol)
  return logoPath !== null
}

/**
 * Get crypto configuration including logo path and color
 * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'DOT')
 * @returns CryptoLogoConfig object or default config
 */
export const getCryptoConfig = (symbol: string): CryptoLogoConfig => {
  const crypto = CRYPTO_LOGOS[symbol.toUpperCase()]
  return (
    crypto || {
      symbol: symbol.toUpperCase(),
      logoPath: null,
      color: '#2563EB',
    }
  )
}

/**
 * Add a new cryptocurrency logo configuration
 * Useful for dynamically adding new cryptocurrencies
 * @param symbol - Cryptocurrency symbol
 * @param logoPath - Path to the logo file in public directory
 * @param color - Brand color hex code
 */
export const addCryptoLogo = (
  symbol: string,
  logoPath: string,
  color: string
): void => {
  CRYPTO_LOGOS[symbol.toUpperCase()] = {
    symbol: symbol.toUpperCase(),
    logoPath,
    color,
  }
}

/**
 * Get all supported cryptocurrency symbols
 * @returns Array of cryptocurrency symbols
 */
export const getAllCryptoSymbols = (): string[] => {
  return Object.keys(CRYPTO_LOGOS)
}

/**
 * Get all cryptocurrencies that have logos available
 * @returns Array of cryptocurrency symbols with logos
 */
export const getCryptosWithLogos = (): string[] => {
  return Object.entries(CRYPTO_LOGOS)
    .filter(([_, config]) => config.logoPath !== null)
    .map(([symbol]) => symbol)
}
