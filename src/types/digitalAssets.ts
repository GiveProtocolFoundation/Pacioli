/**
 * Digital Asset Classification and Token Architecture
 * Supporting multi-token, multi-chain cryptocurrency accounting
 */

export type DigitalAssetType =
  | 'native-protocol-tokens'
  | 'stablecoins'
  | 'wrapped-bridged-tokens'
  | 'liquid-staking-derivatives'
  | 'liquidity-pool-tokens'
  | 'governance-tokens'
  | 'yield-bearing-tokens'
  | 'nft-collectibles'
  | 'nft-utility-functional'
  | 'synthetic-assets'
  | 'other-digital-assets'

export type ChainType = 'relay' | 'parachain' | 'standalone' | 'layer2' | 'sidechain'

export type TokenStandard = 'native' | 'PSP-22' | 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'SPL' | 'other'

export interface DigitalAssetTypeInfo {
  type: DigitalAssetType
  accountNumber: string
  name: string
  description: string
  accountingTreatment: string
  examples: string[]
}

export const DIGITAL_ASSET_TYPES: Record<DigitalAssetType, DigitalAssetTypeInfo> = {
  'native-protocol-tokens': {
    type: 'native-protocol-tokens',
    accountNumber: '1510',
    name: 'Native Protocol Tokens',
    description: 'Tokens that power their respective blockchain networks',
    accountingTreatment: 'Capital assets with cost basis tracking',
    examples: ['DOT', 'KSM', 'ETH', 'BTC', 'GLMR', 'ASTR', 'ACA'],
  },
  'stablecoins': {
    type: 'stablecoins',
    accountNumber: '1520',
    name: 'Stablecoins',
    description: 'Tokens pegged to fiat currencies or other stable assets',
    accountingTreatment: 'Cash equivalents or short-term investments',
    examples: ['USDC', 'USDT', 'DAI', 'USDD'],
  },
  'wrapped-bridged-tokens': {
    type: 'wrapped-bridged-tokens',
    accountNumber: '1530',
    name: 'Wrapped/Bridged Tokens',
    description: 'Representations of native tokens on other chains',
    accountingTreatment: 'Same as underlying asset with bridging notes',
    examples: ['WETH', 'WBTC', 'xcDOT', 'xcKSM'],
  },
  'liquid-staking-derivatives': {
    type: 'liquid-staking-derivatives',
    accountNumber: '1540',
    name: 'Liquid Staking Derivatives',
    description: 'Receipt tokens from liquid staking protocols',
    accountingTreatment: 'Staked assets with derivative characteristics',
    examples: ['stDOT', 'LDOT', 'stETH', 'rETH'],
  },
  'liquidity-pool-tokens': {
    type: 'liquidity-pool-tokens',
    accountNumber: '1550',
    name: 'Liquidity Pool (LP) Tokens',
    description: 'Represent share of DEX liquidity pool',
    accountingTreatment: 'Investment with fair value adjustments',
    examples: ['UNI-V2', 'Curve LP', 'HydraDX pool tokens'],
  },
  'governance-tokens': {
    type: 'governance-tokens',
    accountNumber: '1560',
    name: 'Governance Tokens',
    description: 'Voting/utility tokens for protocol governance',
    accountingTreatment: 'Intangible assets or investments',
    examples: ['UNI', 'AAVE', 'COMP', 'INTR'],
  },
  'yield-bearing-tokens': {
    type: 'yield-bearing-tokens',
    accountNumber: '1570',
    name: 'Yield-Bearing Tokens',
    description: 'Auto-compounding or interest-accruing tokens',
    accountingTreatment: 'Investment with accrued income',
    examples: ['aTokens (Aave)', 'cTokens (Compound)', 'yvTokens (Yearn)'],
  },
  'nft-collectibles': {
    type: 'nft-collectibles',
    accountNumber: '1580',
    name: 'NFTs - Collectibles',
    description: 'Non-fungible tokens held for collection/appreciation',
    accountingTreatment: 'Collectibles or intangible assets',
    examples: ['Art NFTs', 'Profile Pictures', 'Trading Cards'],
  },
  'nft-utility-functional': {
    type: 'nft-utility-functional',
    accountNumber: '1585',
    name: 'NFTs - Utility/Functional',
    description: 'NFTs that provide access, rights, or utility',
    accountingTreatment: 'Prepaid assets or intangible assets',
    examples: ['Domain names', 'Membership passes', 'In-game items'],
  },
  'synthetic-assets': {
    type: 'synthetic-assets',
    accountNumber: '1590',
    name: 'Synthetic Assets',
    description: 'Tokens representing exposure to off-chain assets',
    accountingTreatment: 'Derivatives',
    examples: ['Synthetic stocks', 'Commodities', 'Indices'],
  },
  'other-digital-assets': {
    type: 'other-digital-assets',
    accountNumber: '1595',
    name: 'Other Digital Assets',
    description: 'Catch-all for uncategorized tokens',
    accountingTreatment: 'Based on specific characteristics',
    examples: ['Experimental tokens', 'Custom assets'],
  },
}

export interface Chain {
  id: string
  chainId: string
  chainName: string
  nativeTokenId?: string
  chainType: ChainType
  rpcUrl?: string
  explorerUrl?: string
  isActive: boolean
  iconUrl?: string
}

export interface Token {
  id: string
  symbol: string
  name: string
  chainId: string
  contractAddress?: string
  decimals: number
  tokenStandard: TokenStandard
  digitalAssetType: DigitalAssetType
  coingeckoId?: string
  iconUrl?: string
  isActive: boolean
  metadata?: Record<string, unknown>
}

export interface TokenBalance {
  accountId: string
  tokenId: string
  quantity: number
  averageCost: number
  costBasis: number
  currentValue?: number
  unrealizedGainLoss?: number
}

export interface TokenPrice {
  tokenId: string
  price: number
  currency: string
  timestamp: string
  source: string
}

export interface TokenMetadata {
  tokenId: string
  marketCap?: number
  volume24h?: number
  priceChange24h?: number
  circulatingSupply?: number
  totalSupply?: number
  lastUpdated: string
}

export interface ChainMetadata {
  chainId: string
  blockHeight?: number
  blockTime?: number
  validators?: number
  totalValueLocked?: number
  lastUpdated: string
}

export const getDigitalAssetTypeInfo = (type: DigitalAssetType): DigitalAssetTypeInfo => {
  return DIGITAL_ASSET_TYPES[type]
}

export const getAccountNumberForAssetType = (type: DigitalAssetType): string => {
  return DIGITAL_ASSET_TYPES[type].accountNumber
}

export const getAllDigitalAssetTypes = (): DigitalAssetTypeInfo[] => {
  return Object.values(DIGITAL_ASSET_TYPES)
}
