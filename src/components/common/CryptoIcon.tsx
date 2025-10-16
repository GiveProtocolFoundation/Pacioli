import React, { useState, useCallback } from 'react'

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

  // Map symbols to their CoinGecko IDs and local icons
  const cryptoConfig: Record<
    string,
    { coingeckoId: string; hasLocalIcon: boolean }
  > = {
    DOT: { coingeckoId: 'polkadot', hasLocalIcon: true },
    KSM: { coingeckoId: 'kusama', hasLocalIcon: true },
    GLMR: { coingeckoId: 'moonbeam', hasLocalIcon: false },
    ASTR: { coingeckoId: 'astar', hasLocalIcon: false },
    BNC: { coingeckoId: 'bifrost-native-coin', hasLocalIcon: false },
    iBTC: { coingeckoId: 'interbtc', hasLocalIcon: false },
    BTC: { coingeckoId: 'bitcoin', hasLocalIcon: true },
    ETH: { coingeckoId: 'ethereum', hasLocalIcon: false },
    USDT: { coingeckoId: 'tether', hasLocalIcon: false },
    USDC: { coingeckoId: 'usd-coin', hasLocalIcon: false },
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
      tether: '325',
      'usd-coin': '6319',
    }
    return imageIds[coinId] || '1'
  }

  // Determine the icon source
  const getIconSrc = () => {
    if (config?.hasLocalIcon) {
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
        className={`rounded-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 ${className}`}
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
