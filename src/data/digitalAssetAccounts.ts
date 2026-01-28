import { ChartOfAccountsEntry } from '../types/chartOfAccounts'
import {
  getDigitalAssetTypeInfo,
  DigitalAssetType,
} from '../types/digitalAssets'

/**
 * Digital Asset Accounts for Chart of Accounts
 *
 * These accounts follow the sub-account/subsidiary ledger approach
 * where each digital asset type has its own account number (1510-1595)
 * and individual tokens are tracked in subsidiary ledgers.
 *
 * This structure allows for:
 * - Reporting by asset type (all Native Protocol Tokens)
 * - Reporting by specific token (all ETH holdings across types)
 * - Multi-chain support (same token on different chains)
 * - Scalability (add unlimited tokens without restructuring accounts)
 */
export const DIGITAL_ASSET_ACCOUNTS: ChartOfAccountsEntry[] = [
  {
    code: '1510',
    name: 'Digital Assets - Native Protocol Tokens',
    type: 'Asset',
    description:
      'Native tokens of blockchain protocols (ETH, DOT, KSM, GLMR, MOVR, ASTR, ACA, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1520',
    name: 'Digital Assets - Stablecoins',
    type: 'Asset',
    description: 'Fiat-pegged digital assets (USDC, USDT, DAI, aUSD, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1530',
    name: 'Digital Assets - Wrapped & Bridged Tokens',
    type: 'Asset',
    description: 'Cross-chain wrapped assets (WETH, WBTC, xcDOT, xcKSM, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1540',
    name: 'Digital Assets - Liquid Staking Derivatives',
    type: 'Asset',
    description: 'Liquid staking tokens (stETH, rETH, LDOT, stDOT, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1550',
    name: 'Digital Assets - Liquidity Pool Tokens',
    type: 'Asset',
    description:
      'LP tokens from AMMs (Uniswap, Curve, Balancer, HydraDX, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1560',
    name: 'Digital Assets - Governance Tokens',
    type: 'Asset',
    description: 'Protocol governance tokens (UNI, AAVE, COMP, CRV, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1570',
    name: 'Digital Assets - Yield-Bearing Tokens',
    type: 'Asset',
    description: 'Interest-bearing tokens (aTokens, cTokens, yTokens, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1580',
    name: 'Digital Assets - NFTs (Collectibles)',
    type: 'Asset',
    description: 'Non-fungible tokens held as collectibles or art',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1585',
    name: 'Digital Assets - NFTs (Utility/Functional)',
    type: 'Asset',
    description:
      'Functional NFTs (gaming items, access passes, memberships, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1590',
    name: 'Digital Assets - Synthetic Assets',
    type: 'Asset',
    description:
      'Synthetic derivatives and tokenized assets (synths, tokenized stocks, etc.)',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
  {
    code: '1595',
    name: 'Digital Assets - Other',
    type: 'Asset',
    description: 'Other digital assets that do not fit standard categories',
    subcategory: 'Digital Assets',
    isActive: true,
    editable: false,
  },
]

/**
 * Get digital asset account by account code
 */
export function getDigitalAssetAccountByCode(
  code: string
): ChartOfAccountsEntry | undefined {
  return DIGITAL_ASSET_ACCOUNTS.find(account => account.code === code)
}

/**
 * Get digital asset account by digital asset type
 */
export function getDigitalAssetAccountByType(
  type: DigitalAssetType
): ChartOfAccountsEntry | undefined {
  const info = getDigitalAssetTypeInfo(type)
  return DIGITAL_ASSET_ACCOUNTS.find(
    account => account.code === info.accountNumber
  )
}

/**
 * Get all digital asset account codes
 */
export function getDigitalAssetAccountCodes(): string[] {
  return DIGITAL_ASSET_ACCOUNTS.map(account => account.code)
}

/**
 * Check if an account code is a digital asset account
 */
export function isDigitalAssetAccount(code: string): boolean {
  return getDigitalAssetAccountCodes().includes(code)
}
