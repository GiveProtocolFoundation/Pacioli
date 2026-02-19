import { Chain, Token } from '../types/digitalAssets'

export const SEED_CHAINS: Chain[] = [
  {
    id: 'polkadot',
    chainId: 'polkadot',
    chainName: 'Polkadot',
    nativeTokenId: 'dot',
    chainType: 'relay',
    rpcUrl: 'wss://rpc.polkadot.io',
    explorerUrl: 'https://polkadot.subscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/dot.svg',
  },
  {
    id: 'kusama',
    chainId: 'kusama',
    chainName: 'Kusama',
    nativeTokenId: 'ksm',
    chainType: 'relay',
    rpcUrl: 'wss://kusama-rpc.polkadot.io',
    explorerUrl: 'https://kusama.subscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/ksm.svg',
  },
  {
    id: 'moonbeam',
    chainId: 'moonbeam',
    chainName: 'Moonbeam',
    nativeTokenId: 'glmr',
    chainType: 'parachain',
    rpcUrl: 'wss://wss.api.moonbeam.network',
    explorerUrl: 'https://moonbeam.moonscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/glmr.svg',
  },
  {
    id: 'moonriver',
    chainId: 'moonriver',
    chainName: 'Moonriver',
    nativeTokenId: 'movr',
    chainType: 'parachain',
    rpcUrl: 'wss://wss.api.moonriver.moonbeam.network',
    explorerUrl: 'https://moonriver.moonscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/movr.svg',
  },
  {
    id: 'astar',
    chainId: 'astar',
    chainName: 'Astar',
    nativeTokenId: 'astr',
    chainType: 'parachain',
    rpcUrl: 'wss://rpc.astar.network',
    explorerUrl: 'https://astar.subscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/astr.svg',
  },
  {
    id: 'ethereum',
    chainId: 'ethereum',
    chainName: 'Ethereum',
    nativeTokenId: 'eth',
    chainType: 'standalone',
    rpcUrl: 'https://mainnet.infura.io',
    explorerUrl: 'https://etherscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/eth.svg',
  },
  {
    id: 'bsc',
    chainId: 'bsc',
    chainName: 'BNB Smart Chain',
    nativeTokenId: 'bnb',
    chainType: 'standalone',
    explorerUrl: 'https://bscscan.com',
    isActive: true,
  },
  {
    id: 'acala',
    chainId: 'acala',
    chainName: 'Acala',
    nativeTokenId: 'aca',
    chainType: 'parachain',
    rpcUrl: 'wss://acala-rpc.dwellir.com',
    explorerUrl: 'https://acala.subscan.io',
    isActive: true,
    iconUrl: '/crypto-icons/aca.svg',
  },
  {
    id: 'hydradx',
    chainId: 'hydradx',
    chainName: 'HydraDX',
    nativeTokenId: 'hdx',
    chainType: 'parachain',
    rpcUrl: 'wss://rpc.hydradx.cloud',
    explorerUrl: 'https://hydradx.subscan.io',
    isActive: true,
  },
]

export const SEED_TOKENS: Token[] = [
  // Native Protocol Tokens
  {
    id: 'dot',
    symbol: 'DOT',
    name: 'Polkadot',
    chainId: 'polkadot',
    decimals: 10,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'polkadot',
    iconUrl: '/crypto-icons/dot.svg',
    isActive: true,
  },
  {
    id: 'ksm',
    symbol: 'KSM',
    name: 'Kusama',
    chainId: 'kusama',
    decimals: 12,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'kusama',
    iconUrl: '/crypto-icons/ksm.svg',
    isActive: true,
  },
  {
    id: 'glmr',
    symbol: 'GLMR',
    name: 'Moonbeam',
    chainId: 'moonbeam',
    decimals: 18,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'moonbeam',
    iconUrl: '/crypto-icons/glmr.svg',
    isActive: true,
  },
  {
    id: 'movr',
    symbol: 'MOVR',
    name: 'Moonriver',
    chainId: 'moonriver',
    decimals: 18,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'moonriver',
    iconUrl: '/crypto-icons/movr.svg',
    isActive: true,
  },
  {
    id: 'astr',
    symbol: 'ASTR',
    name: 'Astar',
    chainId: 'astar',
    decimals: 18,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'astar',
    iconUrl: '/crypto-icons/astr.svg',
    isActive: true,
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    chainId: 'ethereum',
    decimals: 18,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'ethereum',
    iconUrl: '/crypto-icons/eth.svg',
    isActive: true,
  },
  {
    id: 'aca',
    symbol: 'ACA',
    name: 'Acala',
    chainId: 'acala',
    decimals: 12,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'acala',
    iconUrl: '/crypto-icons/aca.svg',
    isActive: true,
  },
  {
    id: 'bnc',
    symbol: 'BNC',
    name: 'Bifrost Native Coin',
    chainId: 'polkadot',
    decimals: 12,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'bifrost-native-coin',
    iconUrl: '/crypto-icons/bnc.svg',
    isActive: true,
  },
  {
    id: 'hdx',
    symbol: 'HDX',
    name: 'HydraDX',
    chainId: 'hydradx',
    decimals: 12,
    tokenStandard: 'native',
    digitalAssetType: 'native-protocol-tokens',
    coingeckoId: 'hydradx',
    isActive: true,
  },

  // Stablecoins
  {
    id: 'usdc-ethereum',
    symbol: 'USDC',
    name: 'USD Coin',
    chainId: 'ethereum',
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'stablecoins',
    coingeckoId: 'usd-coin',
    iconUrl: '/crypto-icons/usdc.svg',
    isActive: true,
  },
  {
    id: 'usdc-moonbeam',
    symbol: 'USDC',
    name: 'USD Coin (Moonbeam)',
    chainId: 'moonbeam',
    contractAddress: '0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b',
    decimals: 6,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'stablecoins',
    coingeckoId: 'usd-coin',
    iconUrl: '/crypto-icons/usdc.svg',
    isActive: true,
  },
  {
    id: 'usdt-ethereum',
    symbol: 'USDT',
    name: 'Tether USD',
    chainId: 'ethereum',
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'stablecoins',
    coingeckoId: 'tether',
    iconUrl: '/crypto-icons/usdt.svg',
    isActive: true,
  },
  {
    id: 'usdt-moonbeam',
    symbol: 'USDT',
    name: 'Tether USD (Moonbeam)',
    chainId: 'moonbeam',
    contractAddress: '0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73',
    decimals: 6,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'stablecoins',
    coingeckoId: 'tether',
    iconUrl: '/crypto-icons/usdt.svg',
    isActive: true,
  },
  {
    id: 'dai-ethereum',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    chainId: 'ethereum',
    contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'stablecoins',
    coingeckoId: 'dai',
    iconUrl: '/crypto-icons/dai.svg',
    isActive: true,
  },
  {
    id: 'ausd-acala',
    symbol: 'aUSD',
    name: 'Acala Dollar',
    chainId: 'acala',
    decimals: 12,
    tokenStandard: 'PSP-22',
    digitalAssetType: 'stablecoins',
    coingeckoId: 'acala-dollar',
    isActive: true,
  },

  // Wrapped/Bridged Tokens
  {
    id: 'weth-ethereum',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    chainId: 'ethereum',
    contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'wrapped-bridged-tokens',
    coingeckoId: 'weth',
    iconUrl: '/crypto-icons/weth.svg',
    isActive: true,
  },
  {
    id: 'wbtc-ethereum',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    chainId: 'ethereum',
    contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'wrapped-bridged-tokens',
    coingeckoId: 'wrapped-bitcoin',
    iconUrl: '/crypto-icons/wbtc.svg',
    isActive: true,
  },
  {
    id: 'xcdot-moonbeam',
    symbol: 'xcDOT',
    name: 'Cross-chain DOT',
    chainId: 'moonbeam',
    contractAddress: '0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080',
    decimals: 10,
    tokenStandard: 'ERC-20',
    digitalAssetType: 'wrapped-bridged-tokens',
    coingeckoId: 'polkadot',
    iconUrl: '/crypto-icons/dot.svg',
    isActive: true,
  },

  // Liquid Staking Derivatives
  {
    id: 'ldot-acala',
    symbol: 'LDOT',
    name: 'Liquid DOT',
    chainId: 'acala',
    decimals: 10,
    tokenStandard: 'PSP-22',
    digitalAssetType: 'liquid-staking-derivatives',
    coingeckoId: 'liquid-staking-dot',
    isActive: true,
  },
  {
    id: 'stdot-bifrost',
    symbol: 'stDOT',
    name: 'Staked DOT',
    chainId: 'polkadot',
    decimals: 10,
    tokenStandard: 'PSP-22',
    digitalAssetType: 'liquid-staking-derivatives',
    isActive: true,
  },

  // Governance Tokens
  {
    id: 'intr-interlay',
    symbol: 'INTR',
    name: 'Interlay',
    chainId: 'polkadot',
    decimals: 10,
    tokenStandard: 'native',
    digitalAssetType: 'governance-tokens',
    coingeckoId: 'interlay',
    isActive: true,
  },
]

/** Get a token by its unique ID. */
export const getTokenById = (id: string): Token | undefined => {
  return SEED_TOKENS.find(token => token.id === id)
}

/** Get all active tokens for a given chain. */
export const getTokensByChain = (chainId: string): Token[] => {
  return SEED_TOKENS.filter(
    token => token.chainId === chainId && token.isActive
  )
}

/** Get all active tokens of a given digital asset type. */
export const getTokensByAssetType = (assetType: string): Token[] => {
  return SEED_TOKENS.filter(
    token => token.digitalAssetType === assetType && token.isActive
  )
}

/** Get a chain by its unique ID. */
export const getChainById = (id: string): Chain | undefined => {
  return SEED_CHAINS.find(chain => chain.id === id)
}

/** Search active tokens by symbol or name. */
export const searchTokens = (query: string): Token[] => {
  const lowerQuery = query.toLowerCase()
  return SEED_TOKENS.filter(
    token =>
      (token.symbol.toLowerCase().includes(lowerQuery) ||
        token.name.toLowerCase().includes(lowerQuery)) &&
      token.isActive
  )
}
