/**
 * Pacioli Database Types
 * Comprehensive type definitions matching the SQLite database schema
 * Generated from migrations in src-tauri/migrations/
 */

// =============================================================================
// CORE ENUMS
// =============================================================================

export enum AccountType {
  Asset = 'Asset',
  Liability = 'Liability',
  Equity = 'Equity',
  Income = 'Income',
  Expense = 'Expense',
}

export enum DigitalAssetType {
  NativeProtocolToken = 'Native Protocol Token',
  Stablecoin = 'Stablecoin',
  WrappedBridgedToken = 'Wrapped/Bridged Token',
  LiquidStakingDerivative = 'Liquid Staking Derivative',
  LPToken = 'LP Token',
  GovernanceToken = 'Governance Token',
  YieldBearingToken = 'Yield-Bearing Token',
  NFTCollectible = 'NFT - Collectible',
  NFTUtility = 'NFT - Utility',
  SyntheticAsset = 'Synthetic Asset',
  OtherDigitalAsset = 'Other Digital Asset',
}

export enum ChainType {
  Relay = 'relay',
  Parachain = 'parachain',
  Standalone = 'standalone',
  EVM = 'evm',
  Other = 'other',
}

export enum TokenStandard {
  Native = 'native',
  PSP22 = 'PSP-22',
  PSP34 = 'PSP-34',
  PSP37 = 'PSP-37',
  ERC20 = 'ERC-20',
  ERC721 = 'ERC-721',
  ERC1155 = 'ERC-1155',
  Other = 'other',
}

export enum TransactionType {
  Purchase = 'purchase',
  Sale = 'sale',
  TransferIn = 'transfer_in',
  TransferOut = 'transfer_out',
  Stake = 'stake',
  Unstake = 'unstake',
  Reward = 'reward',
  Fee = 'fee',
  SwapIn = 'swap_in',
  SwapOut = 'swap_out',
  LPDeposit = 'lp_deposit',
  LPWithdraw = 'lp_withdraw',
  Airdrop = 'airdrop',
  GiftReceived = 'gift_received',
  GiftSent = 'gift_sent',
  Donation = 'donation',
  LoanBorrowed = 'loan_borrowed',
  LoanRepaid = 'loan_repaid',
  InterestEarned = 'interest_earned',
  InterestPaid = 'interest_paid',
  Other = 'other',
}

export enum CostBasisMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  HIFO = 'HIFO',
  SpecificID = 'SpecificID',
  AvgCost = 'AvgCost',
}

export enum NormalBalance {
  Debit = 'debit',
  Credit = 'credit',
}

// =============================================================================
// GENERAL LEDGER - CHART OF ACCOUNTS
// =============================================================================

export interface GLAccount {
  id: number
  accountNumber: string
  accountName: string
  accountType: AccountType
  parentAccountId?: number
  digitalAssetType?: DigitalAssetType
  subcategory?: string
  description?: string
  isActive: boolean
  isEditable: boolean
  normalBalance: NormalBalance
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// BLOCKCHAIN CHAINS AND TOKENS
// =============================================================================

export interface Chain {
  id: number
  chainId: string
  chainName: string
  nativeTokenSymbol?: string
  chainType: ChainType
  rpcEndpoint?: string
  blockExplorerUrl?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Token {
  id: number
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
  createdAt: Date
  updatedAt: Date
}

export interface PriceHistory {
  id: number
  tokenId: number
  priceDate: Date
  priceUsd: string // Stored as DECIMAL(18, 8)
  source?: string
  createdAt: Date
}

export interface Wallet {
  id: number
  walletName?: string
  walletAddress: string
  chainId: string
  isActive: boolean
  lastSynced?: Date
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// JOURNAL ENTRIES AND ACCOUNTING TRANSACTIONS
// =============================================================================

export interface AccountingTransaction {
  id: number
  transactionDate: Date
  glAccountId: number
  tokenId: number
  quantity: string // Stored as DECIMAL(36, 18)
  unitPrice?: string // Stored as DECIMAL(18, 8)
  totalValue?: string // Stored as DECIMAL(18, 2)
  transactionType: TransactionType
  chainId: string
  walletAddress?: string
  txnHash?: string
  description?: string
  isReconciled: boolean
  journalEntryId?: number
  createdAt: Date
  updatedAt: Date
}

export interface JournalEntry {
  id: number
  entryDate: Date
  entryNumber?: string
  description?: string
  referenceNumber?: string
  isPosted: boolean
  isReversed: boolean
  reversedByEntryId?: number
  createdBy?: string
  createdAt: Date
  updatedAt: Date
  /** FK to entities table (nullable in Stage 1). */
  entityId?: string
  /** Lifecycle status: draft, approved, posted, voided. */
  status: string
  /** How the entry was drafted: manual, rule, model. */
  origin: string
  /** Who approved this entry. */
  approvedBy?: string
  /** When this entry was approved. */
  approvedAt?: Date
  /** When this entry was posted to the ledger. */
  postedAt?: Date
  /** FK to multi_chain_transactions — on-chain source tx, null for manual entries. */
  sourceTxId?: string
}

export interface JournalEntryLine {
  id: number
  journalEntryId: number
  glAccountId: number
  tokenId?: number
  debitAmount: number // Legacy float column (kept for backward compat)
  creditAmount: number // Legacy float column (kept for backward compat)
  description?: string
  lineNumber?: number
  createdAt: Date
  /** Debit value in functional-currency minor units (USD cents). */
  debitMinor: number
  /** Credit value in functional-currency minor units (USD cents). */
  creditMinor: number
  /** Token quantity as canonical decimal string. Null for pure-fiat lines. */
  quantity?: string
  /** Asset identifier: 'USD' for fiat, 'token:<id>' for tokens, null for measurement lines. */
  assetId?: string
}

// =============================================================================
// COST BASIS TRACKING AND TAX LOTS
// =============================================================================

export interface TransactionLot {
  id: number
  accountingTransactionId: number
  tokenId: number
  acquiredDate: Date
  quantity: string // Stored as DECIMAL(36, 18)
  costBasis: string // Stored as DECIMAL(18, 2)
  remainingQuantity: string // Stored as DECIMAL(36, 18)
  isClosed: boolean
  costBasisMethod?: CostBasisMethod
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface LotDisposal {
  id: number
  lotId: number
  disposalTransactionId: number
  disposalDate: Date
  quantityDisposed: string // Stored as DECIMAL(36, 18)
  proceeds: string // Stored as DECIMAL(18, 2)
  costBasis: string // Stored as DECIMAL(18, 2)
  gainLoss: string // Stored as DECIMAL(18, 2)
  holdingPeriodDays?: number
  isLongTerm?: boolean
  createdAt: Date
}

export interface RealizedGainLoss {
  id: number
  tokenId: number
  disposalDate: Date
  quantity: string // Stored as DECIMAL(36, 18)
  proceeds: string // Stored as DECIMAL(18, 2)
  costBasis: string // Stored as DECIMAL(18, 2)
  realizedGainLoss: string // Stored as DECIMAL(18, 2)
  isLongTerm?: boolean
  taxYear?: number
  disposalTransactionId?: number
  createdAt: Date
}

export interface CostBasisPreference {
  id: number
  preferenceKey: string
  preferenceValue?: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// VIEW TYPES (Materialized from Database Views)
// =============================================================================

// =============================================================================
// CLASSIFICATION STATUS (multi_chain_transactions)
// =============================================================================

export type ClassificationStatus =
  | 'unclassified'
  | 'classified'
  | 'ignored'
  | 'split'

/** Valuation enrichment status for multi-chain transactions. */
export type ValuationStatus = 'unpriced' | 'priced' | 'unavailable'

/** Raw multi-chain transaction row from the Rust backend (camelCase via serde). */
export interface RawTransaction {
  id: string
  chainId: string
  transactionHash: string
  fromAddress: string
  toAddress: string | null
  transferValue: string
  transactionFee: string | null
  timestamp: number
  transactionType: string
  status: string
  classificationStatus: ClassificationStatus
  priceAtAcquisitionUsd: string | null
  valuationStatus: ValuationStatus
  isSelfTransfer: boolean
}

// =============================================================================
// JOURNAL ENTRY WITH LINES (API response shape from Rust backend)
// =============================================================================

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[]
}

// =============================================================================
// ACCOUNTING VIEWS
// =============================================================================

export interface VTokenBalance {
  glAccountId: number
  accountNumber: string
  accountName: string
  accountType: AccountType
  tokenId: number
  tokenSymbol: string
  tokenName: string
  chainId: string
  totalInflows: string
  totalOutflows: string
  netQuantity: string
  totalValueUsd: string
}

export interface VAccountBalance {
  accountId: number
  accountNumber: string
  accountName: string
  accountType: AccountType
  digitalAssetType?: DigitalAssetType
  normalBalance: NormalBalance
  totalDebits: string
  totalCredits: string
  balance: string
  balanceSigned: string
}

export interface VTokenHolding {
  tokenId: number
  symbol: string
  tokenName: string
  chainId: string
  chainName: string
  digitalAssetType: DigitalAssetType
  totalQuantity: string
  latestPriceUsd?: string
  currentValueUsd?: string
  totalCostBasisUsd: string
  unrealizedGainLossUsd?: string
}

export interface VBalanceSheetItem {
  accountType: AccountType
  accountNumber: string
  accountName: string
  balance: string
  sortOrder: number
}

export interface VIncomeStatementItem {
  accountType: AccountType
  accountNumber: string
  accountName: string
  balance: string
  sortOrder: number
}

export interface VGainsLossesSummary {
  symbol: string
  tokenName: string
  taxYear?: number
  isLongTerm?: boolean
  holdingPeriod: string
  totalQuantityDisposed: string
  totalProceeds: string
  totalCostBasis: string
  totalGainLoss: string
  numberOfDisposals: number
}

export interface VOpenTaxLot {
  lotId: number
  symbol: string
  tokenName: string
  chainId: string
  acquiredDate: Date
  originalQuantity: string
  remainingQuantity: string
  costBasis: string
  costPerUnit: string
  costBasisMethod?: CostBasisMethod
  currentPriceUsd?: string
  currentValueUsd?: string
  unrealizedGainLoss?: string
  daysHeld: number
}

export interface VGeneralLedgerEntry {
  entryDate: Date
  entryNumber?: string
  lineNumber?: number
  accountNumber: string
  accountName: string
  accountType: AccountType
  tokenSymbol?: string
  debitAmount: string
  creditAmount: string
  description?: string
  referenceNumber?: string
  isPosted: boolean
  isReversed: boolean
}

export interface VTrialBalanceEntry {
  accountNumber: string
  accountName: string
  accountType: AccountType
  debitBalance: string
  creditBalance: string
}

export interface VPortfolioPerformance {
  snapshotDate: Date
  totalPortfolioValueUsd: string
  numberOfTokensHeld: number
}

export interface VTaxSummary {
  taxYear?: number
  longTermGains: string
  longTermLosses: string
  shortTermGains: string
  shortTermLosses: string
  netCapitalGainLoss: string
  totalProceeds: string
  totalCostBasis: string
}

export interface VAccountActivity {
  accountNumber: string
  accountName: string
  transactionCount: number
  unreconciledCount: number
  earliestTransaction?: Date
  latestTransaction?: Date
  distinctTokens: number
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type Decimal = string // All decimal values stored as strings for precision

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface FilterOptions {
  dateRange?: DateRange
  accountIds?: number[]
  tokenIds?: number[]
  chainIds?: string[]
  transactionTypes?: TransactionType[]
  isReconciled?: boolean
}

export interface SortOptions {
  field: string
  direction: 'asc' | 'desc'
}

// =============================================================================
// ACCOUNTING PERIODS (GIV-684, Phase 5)
// =============================================================================

export interface AccountingPeriod {
  id: number
  periodStart: string
  periodEnd: string
  status: 'open' | 'closed'
  closedBy?: string
  closedAt?: string
  reopenedBy?: string
  reopenedAt?: string
  createdAt?: string
  updatedAt?: string
}
