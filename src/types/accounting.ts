/**
 * Pacioli Accounting Types
 * Business logic types for accounting operations, journal entries, and cost basis
 */

import {
  AccountType,
  DigitalAssetType,
  TransactionType,
  CostBasisMethod,
  GLAccount,
  Token,
  Chain,
  AccountingTransaction,
  JournalEntry,
  JournalEntryLine,
  TransactionLot,
  LotDisposal,
  Decimal,
} from './database'

// =============================================================================
// REQUEST/RESPONSE TYPES FOR API/TAURI COMMANDS
// =============================================================================

export interface CreateGLAccountRequest {
  accountNumber: string
  accountName: string
  accountType: AccountType
  parentAccountId?: number
  digitalAssetType?: DigitalAssetType
  subcategory?: string
  description?: string
}

export interface UpdateGLAccountRequest {
  id: number
  accountName?: string
  description?: string
  isActive?: boolean
}

export interface CreateTokenRequest {
  symbol: string
  name: string
  chainId: string
  contractAddress?: string
  decimals: number
  tokenStandard: string
  digitalAssetType: DigitalAssetType
  coingeckoId?: string
  iconUrl?: string
}

export interface CreateAccountingTransactionRequest {
  transactionDate: Date | string
  glAccountId: number
  tokenId: number
  quantity: Decimal
  unitPrice?: Decimal
  totalValue?: Decimal
  transactionType: TransactionType
  chainId: string
  walletAddress?: string
  txnHash?: string
  description?: string
}

export interface CreateJournalEntryRequest {
  entryDate: Date | string
  description?: string
  referenceNumber?: string
  lines: CreateJournalEntryLineRequest[]
  createdBy?: string
}

export interface CreateJournalEntryLineRequest {
  glAccountId: number
  tokenId?: number
  debitAmount: Decimal
  creditAmount: Decimal
  description?: string
  lineNumber?: number
}

export interface RecordDisposalRequest {
  lotId: number
  disposalTransactionId: number
  disposalDate: Date | string
  quantityDisposed: Decimal
  proceeds: Decimal
  costBasisMethod?: CostBasisMethod
}

export interface UpdatePriceRequest {
  tokenId: number
  priceDate: Date | string
  priceUsd: Decimal
  source?: string
}

// =============================================================================
// ENRICHED TYPES (Database + Computed Fields)
// =============================================================================

export interface EnrichedAccountingTransaction extends AccountingTransaction {
  glAccount?: GLAccount
  token?: Token
  chain?: Chain
  journalEntry?: JournalEntry
  lots?: TransactionLot[]
  unrealizedGainLoss?: Decimal
}

export interface EnrichedJournalEntry extends JournalEntry {
  lines: EnrichedJournalEntryLine[]
  totalDebits: Decimal
  totalCredits: Decimal
  isBalanced: boolean
}

export interface EnrichedJournalEntryLine extends JournalEntryLine {
  glAccount?: GLAccount
  token?: Token
}

export interface EnrichedTransactionLot extends TransactionLot {
  token?: Token
  acquisitionTransaction?: AccountingTransaction
  disposals?: LotDisposal[]
  currentValue?: Decimal
  unrealizedGainLoss?: Decimal
}

export interface EnrichedLotDisposal extends LotDisposal {
  lot?: TransactionLot
  disposalTransaction?: AccountingTransaction
  token?: Token
}

// =============================================================================
// PORTFOLIO AND HOLDINGS TYPES
// =============================================================================

export interface TokenHolding {
  tokenId: number
  symbol: string
  tokenName: string
  chainId: string
  chainName: string
  digitalAssetType: DigitalAssetType
  totalQuantity: Decimal
  averageCostBasis: Decimal
  totalCostBasis: Decimal
  currentPriceUsd?: Decimal
  currentValueUsd?: Decimal
  unrealizedGainLoss?: Decimal
  unrealizedGainLossPercent?: number
  accountBreakdown: AccountTokenHolding[]
  openLots: TransactionLot[]
}

export interface AccountTokenHolding {
  glAccountId: number
  accountNumber: string
  accountName: string
  quantity: Decimal
  costBasis: Decimal
  percentOfTotal: number
}

export interface PortfolioSummary {
  asOfDate: Date
  totalValueUsd: Decimal
  totalCostBasis: Decimal
  unrealizedGainLoss: Decimal
  unrealizedGainLossPercent: number
  numberOfTokens: number
  numberOfChains: number
  holdings: TokenHolding[]
  topHoldings: TokenHolding[]
  byDigitalAssetType: PortfolioBreakdown[]
  byChain: PortfolioBreakdown[]
}

export interface PortfolioBreakdown {
  category: string
  valueUsd: Decimal
  percentOfTotal: number
  unrealizedGainLoss: Decimal
}

// =============================================================================
// COST BASIS AND TAX REPORTING TYPES
// =============================================================================

export interface CostBasisCalculation {
  method: CostBasisMethod
  quantity: Decimal
  totalCostBasis: Decimal
  averageCostPerUnit: Decimal
  lotsUsed: LotAllocation[]
}

export interface LotAllocation {
  lotId: number
  acquiredDate: Date
  quantityUsed: Decimal
  costBasis: Decimal
  costPerUnit: Decimal
}

export interface CapitalGain {
  tokenId: number
  symbol: string
  tokenName: string
  acquiredDate: Date
  disposedDate: Date
  quantity: Decimal
  costBasis: Decimal
  proceeds: Decimal
  gainLoss: Decimal
  holdingPeriodDays: number
  isLongTerm: boolean
  taxYear: number
  lotId?: number
}

export interface TaxYearSummary {
  taxYear: number
  shortTermGains: CapitalGain[]
  longTermGains: CapitalGain[]
  totalShortTermGain: Decimal
  totalLongTermGain: Decimal
  totalShortTermLoss: Decimal
  totalLongTermLoss: Decimal
  netShortTermGainLoss: Decimal
  netLongTermGainLoss: Decimal
  netCapitalGainLoss: Decimal
  totalProceeds: Decimal
  totalCostBasis: Decimal
}

export interface TaxLotSummary {
  tokenId: number
  symbol: string
  openLots: number
  totalQuantity: Decimal
  totalCostBasis: Decimal
  averageCostPerUnit: Decimal
  oldestLotDate: Date
  newestLotDate: Date
  unrealizedGainLoss?: Decimal
}

// =============================================================================
// RECONCILIATION TYPES
// =============================================================================

export interface ReconciliationItem {
  accountingTransactionId: number
  transactionDate: Date
  tokenSymbol: string
  quantity: Decimal
  totalValue?: Decimal
  transactionType: TransactionType
  txnHash?: string
  walletAddress?: string
  isReconciled: boolean
  matchedBlockchainTxn?: BlockchainTransaction
  reconciliationStatus: 'matched' | 'unmatched' | 'conflict'
  issues?: string[]
}

export interface BlockchainTransaction {
  hash: string
  blockNumber: number
  timestamp: Date
  fromAddress: string
  toAddress: string
  tokenAddress?: string
  amount: Decimal
  chainId: string
}

export interface ReconciliationReport {
  accountId: number
  accountNumber: string
  accountName: string
  tokenId: number
  tokenSymbol: string
  chainId: string
  reportDate: Date
  totalTransactions: number
  reconciledTransactions: number
  unmatchedTransactions: number
  conflicts: number
  items: ReconciliationItem[]
}

// =============================================================================
// DOUBLE-ENTRY BOOKKEEPING HELPERS
// =============================================================================

export interface DoubleEntryTemplate {
  transactionType: TransactionType
  debitAccount: string | number // Account number or ID
  creditAccount: string | number
  description: string
}

export const TRANSACTION_TEMPLATES: Record<
  TransactionType,
  DoubleEntryTemplate
> = {
  [TransactionType.Purchase]: {
    transactionType: TransactionType.Purchase,
    debitAccount: '1510', // Digital Assets
    creditAccount: '1010', // Cash
    description: 'Purchase of digital asset',
  },
  [TransactionType.Sale]: {
    transactionType: TransactionType.Sale,
    debitAccount: '1010', // Cash
    creditAccount: '1510', // Digital Assets
    description: 'Sale of digital asset',
  },
  [TransactionType.Stake]: {
    transactionType: TransactionType.Stake,
    debitAccount: '1540', // Staked Assets
    creditAccount: '1510', // Digital Assets
    description: 'Staking of digital asset',
  },
  [TransactionType.Unstake]: {
    transactionType: TransactionType.Unstake,
    debitAccount: '1510', // Digital Assets
    creditAccount: '1540', // Staked Assets
    description: 'Unstaking of digital asset',
  },
  [TransactionType.Reward]: {
    transactionType: TransactionType.Reward,
    debitAccount: '1510', // Digital Assets
    creditAccount: '4100', // Staking Rewards Income
    description: 'Staking reward received',
  },
  [TransactionType.Fee]: {
    transactionType: TransactionType.Fee,
    debitAccount: '5200', // Transaction Fees Expense
    creditAccount: '1510', // Digital Assets
    description: 'Transaction fee paid',
  },
  [TransactionType.SwapIn]: {
    transactionType: TransactionType.SwapIn,
    debitAccount: '1510', // Digital Assets (new token)
    creditAccount: '1510', // Digital Assets (old token)
    description: 'Token swap - asset received',
  },
  [TransactionType.SwapOut]: {
    transactionType: TransactionType.SwapOut,
    debitAccount: '1510', // Digital Assets (old token)
    creditAccount: '1510', // Digital Assets (new token)
    description: 'Token swap - asset disposed',
  },
  [TransactionType.LPDeposit]: {
    transactionType: TransactionType.LPDeposit,
    debitAccount: '1550', // LP Tokens
    creditAccount: '1510', // Digital Assets
    description: 'Liquidity pool deposit',
  },
  [TransactionType.LPWithdraw]: {
    transactionType: TransactionType.LPWithdraw,
    debitAccount: '1510', // Digital Assets
    creditAccount: '1550', // LP Tokens
    description: 'Liquidity pool withdrawal',
  },
  [TransactionType.Airdrop]: {
    transactionType: TransactionType.Airdrop,
    debitAccount: '1510', // Digital Assets
    creditAccount: '4200', // Airdrop Income
    description: 'Airdrop received',
  },
  [TransactionType.GiftReceived]: {
    transactionType: TransactionType.GiftReceived,
    debitAccount: '1510', // Digital Assets
    creditAccount: '4300', // Gift Income
    description: 'Gift received',
  },
  [TransactionType.GiftSent]: {
    transactionType: TransactionType.GiftSent,
    debitAccount: '5300', // Gift Expense
    creditAccount: '1510', // Digital Assets
    description: 'Gift sent',
  },
  [TransactionType.Donation]: {
    transactionType: TransactionType.Donation,
    debitAccount: '5400', // Donation Expense
    creditAccount: '1510', // Digital Assets
    description: 'Charitable donation',
  },
  [TransactionType.TransferIn]: {
    transactionType: TransactionType.TransferIn,
    debitAccount: '1510', // Digital Assets
    creditAccount: '1510', // Digital Assets (different wallet)
    description: 'Transfer in between wallets',
  },
  [TransactionType.TransferOut]: {
    transactionType: TransactionType.TransferOut,
    debitAccount: '1510', // Digital Assets (different wallet)
    creditAccount: '1510', // Digital Assets
    description: 'Transfer out between wallets',
  },
  [TransactionType.LoanBorrowed]: {
    transactionType: TransactionType.LoanBorrowed,
    debitAccount: '1510', // Digital Assets
    creditAccount: '2100', // Loans Payable
    description: 'Loan borrowed',
  },
  [TransactionType.LoanRepaid]: {
    transactionType: TransactionType.LoanRepaid,
    debitAccount: '2100', // Loans Payable
    creditAccount: '1510', // Digital Assets
    description: 'Loan repayment',
  },
  [TransactionType.InterestEarned]: {
    transactionType: TransactionType.InterestEarned,
    debitAccount: '1510', // Digital Assets
    creditAccount: '4400', // Interest Income
    description: 'Interest earned',
  },
  [TransactionType.InterestPaid]: {
    transactionType: TransactionType.InterestPaid,
    debitAccount: '5500', // Interest Expense
    creditAccount: '1510', // Digital Assets
    description: 'Interest paid',
  },
  [TransactionType.Other]: {
    transactionType: TransactionType.Other,
    debitAccount: '1510', // Digital Assets
    creditAccount: '3000', // Equity
    description: 'Other transaction',
  },
}

// =============================================================================
// AUDIT AND COMPLIANCE TYPES
// =============================================================================

export interface AuditTrail {
  id: number
  entityType: 'transaction' | 'journal_entry' | 'lot' | 'account'
  entityId: number
  action: 'create' | 'update' | 'delete' | 'post' | 'reconcile'
  changedBy: string
  changedAt: Date
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  notes?: string
}

export interface ComplianceCheck {
  checkType:
    | 'journal_balance'
    | 'lot_quantity'
    | 'account_balance'
    | 'data_integrity'
  status: 'passed' | 'failed' | 'warning'
  message: string
  details?: Record<string, unknown>
  checkedAt: Date
}

export interface DataIntegrityReport {
  reportDate: Date
  checks: ComplianceCheck[]
  passedChecks: number
  failedChecks: number
  warningChecks: number
  overallStatus: 'healthy' | 'issues_found' | 'critical_issues'
}
