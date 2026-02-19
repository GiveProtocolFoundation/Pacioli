import React, { useState, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

interface CryptoIconProps {
  symbol: string
  size?: number
  className?: string
}

const CryptoIcon: React.FC<CryptoIconProps> = ({
  symbol,
  size = 40,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false)
  const { theme } = useTheme()

  // Map symbols to their CoinGecko IDs and local icons
  const cryptoConfig: Record<
    string,
    { coingeckoId: string; hasLocalIcon: boolean; hasThemeVariants?: boolean }
  > = {
    DOT: { coingeckoId: 'polkadot', hasLocalIcon: true },
    KSM: { coingeckoId: 'kusama', hasLocalIcon: true },
    GLMR: {
      coingeckoId: 'moonbeam',
      hasLocalIcon: true,
      hasThemeVariants: true,
    },
    ASTR: { coingeckoId: 'astar', hasLocalIcon: true },
    BNC: { coingeckoId: 'bifrost-native-coin', hasLocalIcon: true },
    iBTC: { coingeckoId: 'interbtc', hasLocalIcon: true },
    BTC: { coingeckoId: 'bitcoin', hasLocalIcon: true },
    ETH: { coingeckoId: 'ethereum', hasLocalIcon: false },
    BNB: { coingeckoId: 'binancecoin', hasLocalIcon: false },
    USDT: { coingeckoId: 'tether', hasLocalIcon: true },
    USDC: { coingeckoId: 'usd-coin', hasLocalIcon: true },
    SOL: { coingeckoId: 'solana', hasLocalIcon: false },
  }

  const config = cryptoConfig[symbol.toUpperCase()]

  // Helper to get CoinGecko image IDs (these are specific to each coin)
  const getCoinGeckoImageId = (coinId: string): string => {
    const imageIds: Record<string, string> = {
      polkadot: '12171',
      kusama: '12747',
      moonbeam: '22459',
      astar: '22617',
      'bifrost-native-coin': '12704',
      interbtc: '21681',
      bitcoin: '1',
      ethereum: '279',
      binancecoin: '825',
      tether: '325',
      'usd-coin': '6319',
      solana: '4128',
    }
    return imageIds[coinId] || '1'
  }

  // Determine the icon source
  const getIconSrc = () => {
    if (config?.hasLocalIcon) {
      // Handle theme-specific logos (e.g., GLMR)
      if (config.hasThemeVariants && symbol.toUpperCase() === 'GLMR') {
        return theme === 'dark'
          ? '/crypto-icons/GLMR_White.svg'
          : '/crypto-icons/GLMR_Black.svg'
      }

      // Handle ASTR PNG file
      if (symbol.toUpperCase() === 'ASTR') {
        return '/crypto-icons/ASTR.png'
      }

      // Handle other SVG files (need to check for case-sensitive variants)
      const upperSymbol = symbol.toUpperCase()
      if (upperSymbol === 'BNC') {
        return '/crypto-icons/BNC.svg'
      }
      if (upperSymbol === 'IBTC') {
        return '/crypto-icons/iBTC.svg' // Case-sensitive: iBTC not IBTC
      }

      return `/crypto-icons/${symbol.toLowerCase()}.svg`
    } else if (config?.coingeckoId) {
      return `https://assets.coingecko.com/coins/images/${getCoinGeckoImageId(config.coingeckoId)}/small/${config.coingeckoId}.png`
    }
    return null
  }

  const iconSrc = getIconSrc()

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  // Fallback UI when image fails or no icon available
  if (imageError || !iconSrc) {
    return (
      <div
        className={`rounded-full flex items-center justify-center bg-gradient-to-br from-[#8b4e52] to-[#7a4248] ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-white font-semibold text-xs">
          {symbol.slice(0, 3)}
        </span>
      </div>
    )
  }

  return (
    <img
      src={iconSrc}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={handleImageError}
    />
  )
}

export default CryptoIcon
