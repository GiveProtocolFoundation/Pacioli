/**
 * Type Mappings and Conversion Utilities
 * Bridges between UI types (kebab-case) and database types (Title Case)
 */

import {
  DigitalAssetType as DBDigitalAssetType,
  ChainType as DBChainType,
  TransactionType as DBTransactionType,
  AccountType as DBAccountType,
  TokenStandard as DBTokenStandard,
  Chain as DBChain,
  Token as DBToken,
} from './database'

import {
  DigitalAssetType as UIDigitalAssetType,
  ChainType as UIChainType,
  TokenStandard as UITokenStandard,
  Chain as UIChain,
  Token as UIToken,
} from './digitalAssets'

import { TransactionType as UITransactionType } from './transaction'

import { AccountTypeValue } from './chartOfAccounts'

// =============================================================================
// DIGITAL ASSET TYPE MAPPINGS
// =============================================================================

export const DIGITAL_ASSET_TYPE_MAP: Record<
  UIDigitalAssetType,
  DBDigitalAssetType
> = {
  'native-protocol-tokens': DBDigitalAssetType.NativeProtocolToken,
  stablecoins: DBDigitalAssetType.Stablecoin,
  'wrapped-bridged-tokens': DBDigitalAssetType.WrappedBridgedToken,
  'liquid-staking-derivatives': DBDigitalAssetType.LiquidStakingDerivative,
  'liquidity-pool-tokens': DBDigitalAssetType.LPToken,
  'governance-tokens': DBDigitalAssetType.GovernanceToken,
  'yield-bearing-tokens': DBDigitalAssetType.YieldBearingToken,
  'nft-collectibles': DBDigitalAssetType.NFTCollectible,
  'nft-utility-functional': DBDigitalAssetType.NFTUtility,
  'synthetic-assets': DBDigitalAssetType.SyntheticAsset,
  'other-digital-assets': DBDigitalAssetType.OtherDigitalAsset,
}

export const DIGITAL_ASSET_TYPE_REVERSE_MAP: Record<
  DBDigitalAssetType,
  UIDigitalAssetType
> = {
  [DBDigitalAssetType.NativeProtocolToken]: 'native-protocol-tokens',
  [DBDigitalAssetType.Stablecoin]: 'stablecoins',
  [DBDigitalAssetType.WrappedBridgedToken]: 'wrapped-bridged-tokens',
  [DBDigitalAssetType.LiquidStakingDerivative]: 'liquid-staking-derivatives',
  [DBDigitalAssetType.LPToken]: 'liquidity-pool-tokens',
  [DBDigitalAssetType.GovernanceToken]: 'governance-tokens',
  [DBDigitalAssetType.YieldBearingToken]: 'yield-bearing-tokens',
  [DBDigitalAssetType.NFTCollectible]: 'nft-collectibles',
  [DBDigitalAssetType.NFTUtility]: 'nft-utility-functional',
  [DBDigitalAssetType.SyntheticAsset]: 'synthetic-assets',
  [DBDigitalAssetType.OtherDigitalAsset]: 'other-digital-assets',
}

export function uiToDbDigitalAssetType(
  uiType: UIDigitalAssetType
): DBDigitalAssetType {
  return DIGITAL_ASSET_TYPE_MAP[uiType]
}

export function dbToUiDigitalAssetType(
  dbType: DBDigitalAssetType
): UIDigitalAssetType {
  return DIGITAL_ASSET_TYPE_REVERSE_MAP[dbType]
}

// =============================================================================
// CHAIN TYPE MAPPINGS
// =============================================================================

export const CHAIN_TYPE_MAP: Record<UIChainType, DBChainType> = {
  relay: DBChainType.Relay,
  parachain: DBChainType.Parachain,
  standalone: DBChainType.Standalone,
  layer2: DBChainType.EVM, // Map layer2 to EVM for now
  sidechain: DBChainType.Other,
}

export const CHAIN_TYPE_REVERSE_MAP: Partial<Record<DBChainType, UIChainType>> =
  {
    [DBChainType.Relay]: 'relay',
    [DBChainType.Parachain]: 'parachain',
    [DBChainType.Standalone]: 'standalone',
    [DBChainType.EVM]: 'layer2',
    [DBChainType.Other]: 'sidechain',
  }

export function uiToDbChainType(uiType: UIChainType): DBChainType {
  return CHAIN_TYPE_MAP[uiType]
}

export function dbToUiChainType(dbType: DBChainType): UIChainType {
  return CHAIN_TYPE_REVERSE_MAP[dbType] || 'standalone'
}

// =============================================================================
// ACCOUNT TYPE MAPPINGS
// =============================================================================

export const ACCOUNT_TYPE_MAP: Record<AccountTypeValue, DBAccountType> = {
  Asset: DBAccountType.Asset,
  Liability: DBAccountType.Liability,
  Equity: DBAccountType.Equity,
  Revenue: DBAccountType.Income, // Note: Revenue maps to Income
  Expense: DBAccountType.Expense,
}

export const ACCOUNT_TYPE_REVERSE_MAP: Record<DBAccountType, AccountTypeValue> =
  {
    [DBAccountType.Asset]: 'Asset',
    [DBAccountType.Liability]: 'Liability',
    [DBAccountType.Equity]: 'Equity',
    [DBAccountType.Income]: 'Revenue', // Note: Income maps to Revenue
    [DBAccountType.Expense]: 'Expense',
  }

export function chartToDbAccountType(
  chartType: AccountTypeValue
): DBAccountType {
  return ACCOUNT_TYPE_MAP[chartType]
}

export function dbToChartAccountType(dbType: DBAccountType): AccountTypeValue {
  return ACCOUNT_TYPE_REVERSE_MAP[dbType]
}

// =============================================================================
// TRANSACTION TYPE MAPPINGS
// =============================================================================

// UI TransactionType is simple: 'revenue' | 'expense' | 'transfer'
// DB TransactionType is detailed: 'purchase', 'sale', 'stake', etc.

export function uiToDbTransactionType(
  uiType: UITransactionType
): DBTransactionType[] {
  switch (uiType) {
    case 'revenue':
      return [
        DBTransactionType.Reward,
        DBTransactionType.Airdrop,
        DBTransactionType.GiftReceived,
        DBTransactionType.InterestEarned,
      ]
    case 'expense':
      return [
        DBTransactionType.Fee,
        DBTransactionType.GiftSent,
        DBTransactionType.Donation,
        DBTransactionType.InterestPaid,
      ]
    case 'transfer':
      return [
        DBTransactionType.Purchase,
        DBTransactionType.Sale,
        DBTransactionType.TransferIn,
        DBTransactionType.TransferOut,
        DBTransactionType.Stake,
        DBTransactionType.Unstake,
        DBTransactionType.SwapIn,
        DBTransactionType.SwapOut,
        DBTransactionType.LPDeposit,
        DBTransactionType.LPWithdraw,
      ]
    default:
      return [DBTransactionType.Other]
  }
}

export function dbToUiTransactionType(
  dbType: DBTransactionType
): UITransactionType {
  const revenueTypes = [
    DBTransactionType.Reward,
    DBTransactionType.Airdrop,
    DBTransactionType.GiftReceived,
    DBTransactionType.InterestEarned,
  ]

  const expenseTypes = [
    DBTransactionType.Fee,
    DBTransactionType.GiftSent,
    DBTransactionType.Donation,
    DBTransactionType.InterestPaid,
  ]

  if (revenueTypes.includes(dbType)) return 'revenue'
  if (expenseTypes.includes(dbType)) return 'expense'
  return 'transfer'
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isDBDigitalAssetType(
  value: unknown
): value is DBDigitalAssetType {
  return (
    typeof value === 'string' &&
    Object.values(DBDigitalAssetType).includes(value as DBDigitalAssetType)
  )
}

export function isUIDigitalAssetType(
  value: unknown
): value is UIDigitalAssetType {
  return (
    typeof value === 'string' &&
    Object.keys(DIGITAL_ASSET_TYPE_MAP).includes(value as UIDigitalAssetType)
  )
}

export function isDBAccountType(value: unknown): value is DBAccountType {
  return (
    typeof value === 'string' &&
    Object.values(DBAccountType).includes(value as DBAccountType)
  )
}

export function isDBTransactionType(
  value: unknown
): value is DBTransactionType {
  return (
    typeof value === 'string' &&
    Object.values(DBTransactionType).includes(value as DBTransactionType)
  )
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

/**
 * Convert UI token to database token
 */
export function uiTokenToDbToken(
  uiToken: UIToken | null
): Omit<DBToken, 'createdAt' | 'updatedAt'> | null {
  if (!uiToken) return null

  return {
    id:
      typeof uiToken.id === 'string'
        ? parseInt(uiToken.id, 10)
        : (uiToken.id as unknown as number),
    symbol: uiToken.symbol,
    name: uiToken.name,
    chainId: uiToken.chainId,
    contractAddress: uiToken.contractAddress,
    decimals: uiToken.decimals,
    tokenStandard: uiToken.tokenStandard as DBTokenStandard,
    digitalAssetType: isUIDigitalAssetType(uiToken.digitalAssetType)
      ? uiToDbDigitalAssetType(uiToken.digitalAssetType)
      : (uiToken.digitalAssetType as DBDigitalAssetType),
    coingeckoId: uiToken.coingeckoId,
    iconUrl: uiToken.iconUrl,
    isActive: uiToken.isActive,
  }
}

/**
 * Convert database token to UI token
 */
export function dbTokenToUiToken(dbToken: DBToken | null): UIToken | null {
  if (!dbToken) return null

  return {
    id: dbToken.id.toString(),
    symbol: dbToken.symbol,
    name: dbToken.name,
    chainId: dbToken.chainId,
    contractAddress: dbToken.contractAddress,
    decimals: dbToken.decimals,
    tokenStandard: dbToken.tokenStandard as UITokenStandard,
    digitalAssetType: isDBDigitalAssetType(dbToken.digitalAssetType)
      ? dbToUiDigitalAssetType(dbToken.digitalAssetType)
      : (dbToken.digitalAssetType as UIDigitalAssetType),
    coingeckoId: dbToken.coingeckoId,
    iconUrl: dbToken.iconUrl,
    isActive: dbToken.isActive,
  }
}

/**
 * Convert UI chain to database chain
 */
export function uiChainToDbChain(
  uiChain: UIChain | null
): Omit<DBChain, 'createdAt' | 'updatedAt'> | null {
  if (!uiChain) return null

  return {
    id:
      typeof uiChain.id === 'string'
        ? parseInt(uiChain.id, 10)
        : (uiChain.id as unknown as number),
    chainId: uiChain.chainId,
    chainName: uiChain.chainName,
    nativeTokenSymbol: uiChain.nativeTokenId,
    chainType: uiToDbChainType(uiChain.chainType),
    rpcEndpoint: uiChain.rpcUrl,
    blockExplorerUrl: uiChain.explorerUrl,
    isActive: uiChain.isActive,
  }
}

/**
 * Convert database chain to UI chain
 */
export function dbChainToUiChain(dbChain: DBChain | null): UIChain | null {
  if (!dbChain) return null

  return {
    id: dbChain.id.toString(),
    chainId: dbChain.chainId,
    chainName: dbChain.chainName,
    nativeTokenId: dbChain.nativeTokenSymbol,
    chainType: dbToUiChainType(dbChain.chainType),
    rpcUrl: dbChain.rpcEndpoint,
    explorerUrl: dbChain.blockExplorerUrl,
    isActive: dbChain.isActive,
  }
}
