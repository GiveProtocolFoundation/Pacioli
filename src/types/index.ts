/**
 * Pacioli Type System - Central Export
 * Comprehensive type definitions for multi-token accounting
 */

// =============================================================================
// DATABASE TYPES (Primary source for core types)
// =============================================================================
export * from './database'

// =============================================================================
// ACCOUNTING TYPES (excluding duplicates)
// =============================================================================
export type {
  CreateGLAccountRequest,
  UpdateGLAccountRequest,
  CreateTokenRequest,
  CreateAccountingTransactionRequest,
  CreateJournalEntryRequest,
  CreateJournalEntryLineRequest,
  RecordDisposalRequest,
  UpdatePriceRequest,
  EnrichedAccountingTransaction,
  EnrichedJournalEntry,
  EnrichedJournalEntryLine,
  EnrichedTransactionLot,
  EnrichedLotDisposal,
  TokenHolding,
  AccountTokenHolding,
  PortfolioSummary,
  PortfolioBreakdown,
  CostBasisCalculation,
  LotAllocation,
  CapitalGain,
  TaxYearSummary,
  TaxLotSummary,
  ReconciliationItem,
  BlockchainTransaction,
  ReconciliationReport,
  DoubleEntryTemplate,
  AuditTrail,
  ComplianceCheck,
  DataIntegrityReport
} from './accounting'

export { TRANSACTION_TEMPLATES } from './accounting'

// =============================================================================
// REPORTING TYPES
// =============================================================================
export type {
  BalanceSheetReport,
  BalanceSheetSection,
  BalanceSheetAccount,
  TokenBreakdownItem,
  IncomeStatementReport,
  IncomeStatementSection,
  IncomeStatementAccount,
  TransactionTypeBreakdown,
  CashFlowStatement,
  CashFlowSection,
  CashFlowItem,
  TrialBalance,
  TrialBalanceAccount,
  PortfolioReport,
  PortfolioPerformance,
  PortfolioAllocation,
  AllocationBreakdown,
  RiskMetrics,
  ConcentrationRisk,
  LiquidityRisk,
  VolatilityMetrics,
  TaxReport,
  TaxpayerInfo,
  Form8949Data,
  Form8949Summary,
  ScheduleD,
  OtherIncomeReport,
  IncomeItem,
  DeductionsReport,
  DeductionItem,
  TimeSeriesDataPoint,
  ChartData,
  ChartDataset,
  PortfolioValueChart,
  AllocationChart,
  GainsLossesChart,
  TransactionVolumeChart,
  DashboardData,
  DashboardSummary,
  DashboardTransaction,
  DashboardCharts,
  DashboardAlert,
  CustomReportDefinition,
  CustomReportFilters,
  CustomReportColumn,
  CustomReportResult,
  ExportRequest,
  ExportOptions,
  ExportResult,
  ComparativeReport,
  ComparisonPeriod,
  ComparisonMetric,
  VarianceAnalysis
} from './reporting'

// =============================================================================
// TAURI COMMAND TYPES
// =============================================================================
export * from './tauri-commands'

// =============================================================================
// LEGACY TYPES (Re-export for backward compatibility)
// These may have duplicates with database types but are kept for legacy code
// =============================================================================
export * from './chartOfAccounts'

// Export digitalAssets types with explicit names to avoid conflicts
export type {
  DigitalAssetType as LegacyDigitalAssetType,
  Token as LegacyToken,
  Chain as LegacyChain,
  ChainType as LegacyChainType,
  TokenStandard as LegacyTokenStandard,
  DigitalAssetTypeInfo,
  TokenBalance,
  TokenPrice,
  TokenMetadata,
  ChainMetadata
} from './digitalAssets'

export {
  DIGITAL_ASSET_TYPES,
  getDigitalAssetTypeInfo,
  getAccountNumberForAssetType,
  getAllDigitalAssetTypes
} from './digitalAssets'

// Export transaction types with explicit names to avoid conflicts
export type {
  TransactionType as LegacyTransactionType,
  TransactionStatus,
  ApprovalStatus,
  TransactionFormData,
  Transaction as LegacyTransaction,
  TransactionApprovalQueueItem
} from './transaction'

export * from './currency'

// Export user types with AccountType renamed to avoid conflict with database AccountType
// Note: UserRole is exported via ./auth to avoid duplicate export
export type {
  AccountType as UserAccountType,
  Jurisdiction,
  User,
  Organization
} from './user'

export * from './errors'

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================
// Note: This also exports UserRole (re-exported from ./user)
export * from './auth'

// =============================================================================
// CHAIN ADAPTER TYPES
// =============================================================================
export {
  ChainFamily,
  TransactionStatus as ChainTransactionStatus,
  TransactionType as ChainTransactionType,
} from './chains'

export type {
  ChainInfo,
  ChainId,
  ChainTransaction,
  TokenTransfer,
  NativeBalance,
  TokenBalance as ChainTokenBalance,
  WalletBalances,
  WalletAddress,
  ChainError,
} from './chains'

// Export crypto accounting types explicitly to avoid CostBasisMethod conflict
export type {
  CostBasisMethod as CryptoCostBasisMethod,
  AccountingStandard,
  AssetClassification,
  IFRSMeasurementModel,
  ActiveMarketIndicators,
  CryptoLot,
  ImpairmentEvent,
  CryptoTransaction,
  CryptoHolding,
  ComplianceSettings,
  DisclosureReport,
  GAAPIFRSReconciliation,
  TaxLot,
  EnhancedTransaction
} from './cryptoAccounting'

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties K of T required
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

/**
 * Make specific properties K of T optional
 */
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * Extract Tauri response data type
 */
export type UnwrapTauriResponse<T> = T extends Promise<{ data?: infer U }> ? U : never
