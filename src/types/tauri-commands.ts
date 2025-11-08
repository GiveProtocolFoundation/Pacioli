/**
 * Pacioli Tauri Command Types
 * Type definitions for Tauri commands (frontend-to-backend API)
 */

import {
  GLAccount,
  Chain,
  Token,
  Wallet,
  AccountingTransaction,
  JournalEntry,
  TransactionLot,
  PriceHistory,
  VTokenBalance,
  VAccountBalance,
  VTokenHolding,
  VGainsLossesSummary,
  VOpenTaxLot,
  VGeneralLedgerEntry,
  VTaxSummary,
  FilterOptions,
  SortOptions,
  PaginatedResponse,
  DateRange
} from './database'

import {
  CreateGLAccountRequest,
  UpdateGLAccountRequest,
  CreateTokenRequest,
  CreateAccountingTransactionRequest,
  CreateJournalEntryRequest,
  RecordDisposalRequest,
  UpdatePriceRequest,
  EnrichedAccountingTransaction,
  EnrichedJournalEntry,
  PortfolioSummary,
  ReconciliationReport
} from './accounting'

import {
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowStatement,
  TrialBalance,
  PortfolioReport,
  TaxReport,
  DashboardData,
  CustomReportDefinition,
  CustomReportResult,
  ExportRequest,
  ExportResult
} from './reporting'

// =============================================================================
// TAURI COMMAND RESPONSE WRAPPER
// =============================================================================

export interface TauriResponse<T> {
  success: boolean
  data?: T
  error?: TauriError
}

export interface TauriError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// =============================================================================
// GENERAL LEDGER COMMANDS
// =============================================================================

/* eslint-disable @typescript-eslint/no-namespace */
export namespace GLAccountCommands {
  export type GetAll = () => Promise<TauriResponse<GLAccount[]>>
  export type GetById = (id: number) => Promise<TauriResponse<GLAccount>>
  export type GetByNumber = (accountNumber: string) => Promise<TauriResponse<GLAccount>>
  export type Create = (request: CreateGLAccountRequest) => Promise<TauriResponse<GLAccount>>
  export type Update = (request: UpdateGLAccountRequest) => Promise<TauriResponse<GLAccount>>
  export type Delete = (id: number) => Promise<TauriResponse<boolean>>
  export type GetChildren = (parentId: number) => Promise<TauriResponse<GLAccount[]>>
  export type GetBalances = (asOfDate?: Date) => Promise<TauriResponse<VAccountBalance[]>>
}

// =============================================================================
// CHAIN AND TOKEN COMMANDS
// =============================================================================

export namespace ChainCommands {
  export type GetAll = () => Promise<TauriResponse<Chain[]>>
  export type GetById = (chainId: string) => Promise<TauriResponse<Chain>>
  export type GetActive = () => Promise<TauriResponse<Chain[]>>
  export type UpdateStatus = (chainId: string, isActive: boolean) => Promise<TauriResponse<boolean>>
}

export namespace TokenCommands {
  export type GetAll = () => Promise<TauriResponse<Token[]>>
  export type GetById = (id: number) => Promise<TauriResponse<Token>>
  export type GetByChain = (chainId: string) => Promise<TauriResponse<Token[]>>
  export type GetBySymbol = (symbol: string, chainId?: string) => Promise<TauriResponse<Token[]>>
  export type Create = (request: CreateTokenRequest) => Promise<TauriResponse<Token>>
  export type Update = (id: number, updates: Partial<Token>) => Promise<TauriResponse<Token>>
  export type GetActive = () => Promise<TauriResponse<Token[]>>
}

export namespace WalletCommands {
  export type GetAll = () => Promise<TauriResponse<Wallet[]>>
  export type GetByChain = (chainId: string) => Promise<TauriResponse<Wallet[]>>
  export type Create = (wallet: Omit<Wallet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TauriResponse<Wallet>>
  export type UpdateSyncStatus = (id: number, lastSynced: Date) => Promise<TauriResponse<boolean>>
  export type Delete = (id: number) => Promise<TauriResponse<boolean>>
}

// =============================================================================
// TRANSACTION COMMANDS
// =============================================================================

export namespace TransactionCommands {
  export type GetAll = (filters?: FilterOptions, sort?: SortOptions) => Promise<TauriResponse<PaginatedResponse<EnrichedAccountingTransaction>>>
  export type GetById = (id: number) => Promise<TauriResponse<EnrichedAccountingTransaction>>
  export type GetByAccount = (accountId: number, dateRange?: DateRange) => Promise<TauriResponse<AccountingTransaction[]>>
  export type GetByToken = (tokenId: number, dateRange?: DateRange) => Promise<TauriResponse<AccountingTransaction[]>>
  export type GetByWallet = (walletAddress: string, chainId: string) => Promise<TauriResponse<AccountingTransaction[]>>
  export type GetUnreconciled = () => Promise<TauriResponse<AccountingTransaction[]>>
  export type Create = (request: CreateAccountingTransactionRequest) => Promise<TauriResponse<AccountingTransaction>>
  export type Update = (id: number, updates: Partial<AccountingTransaction>) => Promise<TauriResponse<AccountingTransaction>>
  export type Delete = (id: number) => Promise<TauriResponse<boolean>>
  export type Reconcile = (id: number) => Promise<TauriResponse<boolean>>
  export type BulkReconcile = (ids: number[]) => Promise<TauriResponse<number>>
}

// =============================================================================
// JOURNAL ENTRY COMMANDS
// =============================================================================

export namespace JournalEntryCommands {
  export type GetAll = (filters?: FilterOptions) => Promise<TauriResponse<EnrichedJournalEntry[]>>
  export type GetById = (id: number) => Promise<TauriResponse<EnrichedJournalEntry>>
  export type GetByDateRange = (dateRange: DateRange) => Promise<TauriResponse<JournalEntry[]>>
  export type GetUnposted = () => Promise<TauriResponse<JournalEntry[]>>
  export type Create = (request: CreateJournalEntryRequest) => Promise<TauriResponse<JournalEntry>>
  export type Update = (id: number, updates: Partial<JournalEntry>) => Promise<TauriResponse<JournalEntry>>
  export type Post = (id: number) => Promise<TauriResponse<boolean>>
  export type Reverse = (id: number, reversalDate: Date, description?: string) => Promise<TauriResponse<JournalEntry>>
  export type Delete = (id: number) => Promise<TauriResponse<boolean>>
  export type Validate = (id: number) => Promise<TauriResponse<{ isValid: boolean; errors: string[] }>>
}

// =============================================================================
// COST BASIS AND TAX LOT COMMANDS
// =============================================================================

export namespace LotCommands {
  export type GetAll = () => Promise<TauriResponse<TransactionLot[]>>
  export type GetByToken = (tokenId: number) => Promise<TauriResponse<TransactionLot[]>>
  export type GetOpen = (tokenId?: number) => Promise<TauriResponse<VOpenTaxLot[]>>
  export type GetById = (id: number) => Promise<TauriResponse<TransactionLot>>
  export type RecordDisposal = (request: RecordDisposalRequest) => Promise<TauriResponse<boolean>>
  export type GetDisposals = (lotId: number) => Promise<TauriResponse<any[]>>
  export type GetRealizedGains = (taxYear?: number) => Promise<TauriResponse<VGainsLossesSummary[]>>
}

// =============================================================================
// PRICE COMMANDS
// =============================================================================

export namespace PriceCommands {
  export type GetLatest = (tokenId: number) => Promise<TauriResponse<PriceHistory>>
  export type GetHistory = (tokenId: number, dateRange: DateRange) => Promise<TauriResponse<PriceHistory[]>>
  export type UpdatePrice = (request: UpdatePriceRequest) => Promise<TauriResponse<PriceHistory>>
  export type BulkUpdatePrices = (updates: UpdatePriceRequest[]) => Promise<TauriResponse<number>>
  export type FetchFromCoingecko = (tokenIds: number[]) => Promise<TauriResponse<number>>
}

// =============================================================================
// REPORTING COMMANDS
// =============================================================================

export namespace ReportingCommands {
  export type GetBalanceSheet = (asOfDate: Date) => Promise<TauriResponse<BalanceSheetReport>>
  export type GetIncomeStatement = (dateRange: DateRange) => Promise<TauriResponse<IncomeStatementReport>>
  export type GetCashFlow = (dateRange: DateRange) => Promise<TauriResponse<CashFlowStatement>>
  export type GetTrialBalance = (asOfDate: Date) => Promise<TauriResponse<TrialBalance>>
  export type GetPortfolio = (asOfDate: Date) => Promise<TauriResponse<PortfolioReport>>
  export type GetTaxReport = (taxYear: number) => Promise<TauriResponse<TaxReport>>
  export type GetDashboard = () => Promise<TauriResponse<DashboardData>>
  export type GetGeneralLedger = (filters: FilterOptions) => Promise<TauriResponse<VGeneralLedgerEntry[]>>
  export type GetTaxSummary = (taxYear: number) => Promise<TauriResponse<VTaxSummary>>
}

// =============================================================================
// CUSTOM REPORT COMMANDS
// =============================================================================

export namespace CustomReportCommands {
  export type GetAll = () => Promise<TauriResponse<CustomReportDefinition[]>>
  export type GetById = (id: number) => Promise<TauriResponse<CustomReportDefinition>>
  export type Create = (definition: Omit<CustomReportDefinition, 'id' | 'createdAt'>) => Promise<TauriResponse<CustomReportDefinition>>
  export type Update = (id: number, updates: Partial<CustomReportDefinition>) => Promise<TauriResponse<CustomReportDefinition>>
  export type Delete = (id: number) => Promise<TauriResponse<boolean>>
  export type Execute = (id: number) => Promise<TauriResponse<CustomReportResult>>
}

// =============================================================================
// EXPORT COMMANDS
// =============================================================================

export namespace ExportCommands {
  export type ExportReport = (request: ExportRequest) => Promise<TauriResponse<ExportResult>>
  export type ExportTransactions = (filters: FilterOptions, format: 'csv' | 'excel') => Promise<TauriResponse<ExportResult>>
  export type ExportTaxForm = (taxYear: number, form: '8949' | 'schedule_d') => Promise<TauriResponse<ExportResult>>
}

// =============================================================================
// RECONCILIATION COMMANDS
// =============================================================================

export namespace ReconciliationCommands {
  export type GetReconciliationReport = (accountId: number, tokenId: number, chainId: string) => Promise<TauriResponse<ReconciliationReport>>
  export type MatchTransaction = (accountingTxnId: number, blockchainTxnHash: string) => Promise<TauriResponse<boolean>>
  export type UnmatchTransaction = (accountingTxnId: number) => Promise<TauriResponse<boolean>>
  export type AutoReconcile = (accountId: number) => Promise<TauriResponse<{ matched: number; unmatched: number }>>
}

// =============================================================================
// PORTFOLIO COMMANDS
// =============================================================================

// Analytics data types
export interface PortfolioValuePoint {
  date: string
  value: number
}

export interface TransactionVolumePoint {
  date: string
  volume: number
  count: number
}

export interface GainsLossesChartData {
  date: string
  realized_gains: number
  unrealized_gains: number
}

export interface AllocationChartData {
  label: string
  value: number
  percentage: number
}

export interface PerformanceData {
  total_return: number
  total_return_percent: number
  time_weighted_return: number
}

export namespace PortfolioCommands {
  export type GetSummary = () => Promise<TauriResponse<PortfolioSummary>>
  export type GetHoldings = () => Promise<TauriResponse<VTokenHolding[]>>
  export type GetTokenBalances = (accountId?: number) => Promise<TauriResponse<VTokenBalance[]>>
  export type GetPerformance = (dateRange: DateRange) => Promise<TauriResponse<PerformanceData>>
  export type GetAllocation = () => Promise<TauriResponse<AllocationChartData[]>>
}

// =============================================================================
// ANALYTICS COMMANDS
// =============================================================================

export namespace AnalyticsCommands {
  export type GetPortfolioValueHistory = (dateRange: DateRange) => Promise<TauriResponse<PortfolioValuePoint[]>>
  export type GetTransactionVolume = (dateRange: DateRange) => Promise<TauriResponse<TransactionVolumePoint[]>>
  export type GetGainsLossesChart = (dateRange: DateRange) => Promise<TauriResponse<GainsLossesChartData[]>>
  export type GetAllocationChart = (groupBy: 'asset_type' | 'chain' | 'account') => Promise<TauriResponse<AllocationChartData[]>>
}

// =============================================================================
// PREFERENCES COMMANDS
// =============================================================================

export namespace PreferenceCommands {
  export type Get = (key: string) => Promise<TauriResponse<string | null>>
  export type Set = (key: string, value: string) => Promise<TauriResponse<boolean>>
  export type GetAll = () => Promise<TauriResponse<Record<string, string>>>
  export type SetDefaultCostBasisMethod = (method: string) => Promise<TauriResponse<boolean>>
  export type SetReportingCurrency = (currency: string) => Promise<TauriResponse<boolean>>
}

// =============================================================================
// DATABASE MAINTENANCE COMMANDS
// =============================================================================

export namespace DatabaseCommands {
  export type RunMigrations = () => Promise<TauriResponse<{ migrationsRun: number }>>
  export type Backup = (path: string) => Promise<TauriResponse<{ backupPath: string; size: number }>>
  export type Restore = (path: string) => Promise<TauriResponse<boolean>>
  export type Vacuum = () => Promise<TauriResponse<boolean>>
  export type GetStats = () => Promise<TauriResponse<DatabaseStats>>
  export type ValidateIntegrity = () => Promise<TauriResponse<{ isValid: boolean; issues: string[] }>>
}

export interface DatabaseStats {
  totalSize: number
  tableStats: {
    tableName: string
    rowCount: number
    sizeBytes: number
  }[]
  lastBackup?: Date
  databaseVersion: string
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

export namespace BatchCommands {
  export type ImportTransactions = (transactions: CreateAccountingTransactionRequest[]) => Promise<TauriResponse<{ imported: number; failed: number; errors: string[] }>>
  export type ImportPrices = (prices: UpdatePriceRequest[]) => Promise<TauriResponse<{ imported: number; failed: number }>>
  export type BulkCreateJournalEntries = (entries: CreateJournalEntryRequest[]) => Promise<TauriResponse<{ created: number; failed: number }>>
}

// =============================================================================
// HELPER TYPES FOR COMMAND INVOCATION
// =============================================================================

export type CommandName =
  // GL Accounts
  | 'get_all_gl_accounts'
  | 'get_gl_account_by_id'
  | 'create_gl_account'
  | 'update_gl_account'
  // Chains
  | 'get_all_chains'
  | 'get_active_chains'
  // Tokens
  | 'get_all_tokens'
  | 'get_token_by_id'
  | 'create_token'
  // Transactions
  | 'get_all_transactions'
  | 'create_transaction'
  | 'reconcile_transaction'
  // Journal Entries
  | 'create_journal_entry'
  | 'post_journal_entry'
  // Lots
  | 'get_open_lots'
  | 'record_disposal'
  // Reports
  | 'get_balance_sheet'
  | 'get_income_statement'
  | 'get_portfolio_report'
  | 'get_tax_report'
  | 'get_dashboard'
  // Prices
  | 'update_price'
  | 'fetch_prices_from_coingecko'
  // Database
  | 'run_migrations'
  | 'backup_database'

export interface CommandInvocation {
  cmd: CommandName
  payload?: Record<string, unknown>
}
