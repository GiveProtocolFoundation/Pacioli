/**
 * Pacioli Reporting and Analytics Types
 * Financial statements, reports, charts, and analytics
 */

import {
  AccountType,
  DigitalAssetType,
  TransactionType,
  Decimal,
  DateRange
} from './database'

import {
  TokenHolding,
  CapitalGain,
  TaxYearSummary
} from './accounting'

// =============================================================================
// FINANCIAL STATEMENT TYPES
// =============================================================================

export interface BalanceSheetReport {
  asOfDate: Date
  reportingCurrency: string
  assets: BalanceSheetSection
  liabilities: BalanceSheetSection
  equity: BalanceSheetSection
  totalAssets: Decimal
  totalLiabilities: Decimal
  totalEquity: Decimal
  isBalanced: boolean
}

export interface BalanceSheetSection {
  sectionName: string
  accounts: BalanceSheetAccount[]
  subtotal: Decimal
}

export interface BalanceSheetAccount {
  accountNumber: string
  accountName: string
  balance: Decimal
  percentOfTotal: number
  children?: BalanceSheetAccount[]
  digitalAssetType?: DigitalAssetType
  tokenBreakdown?: TokenBreakdownItem[]
}

export interface TokenBreakdownItem {
  tokenSymbol: string
  quantity: Decimal
  valueUsd: Decimal
}

export interface IncomeStatementReport {
  periodStart: Date
  periodEnd: Date
  reportingCurrency: string
  revenue: IncomeStatementSection
  expenses: IncomeStatementSection
  totalRevenue: Decimal
  totalExpenses: Decimal
  netIncome: Decimal
  netIncomePercent: number
}

export interface IncomeStatementSection {
  sectionName: string
  accounts: IncomeStatementAccount[]
  subtotal: Decimal
  percentOfRevenue: number
}

export interface IncomeStatementAccount {
  accountNumber: string
  accountName: string
  amount: Decimal
  percentOfRevenue: number
  percentOfSection: number
  children?: IncomeStatementAccount[]
  transactionTypes?: TransactionTypeBreakdown[]
}

export interface TransactionTypeBreakdown {
  transactionType: TransactionType
  amount: Decimal
  count: number
}

export interface CashFlowStatement {
  periodStart: Date
  periodEnd: Date
  reportingCurrency: string
  operatingActivities: CashFlowSection
  investingActivities: CashFlowSection
  financingActivities: CashFlowSection
  netCashFlow: Decimal
  beginningCash: Decimal
  endingCash: Decimal
}

export interface CashFlowSection {
  sectionName: string
  items: CashFlowItem[]
  subtotal: Decimal
}

export interface CashFlowItem {
  description: string
  amount: Decimal
  transactionTypes: TransactionType[]
}

export interface TrialBalance {
  asOfDate: Date
  accounts: TrialBalanceAccount[]
  totalDebits: Decimal
  totalCredits: Decimal
  isBalanced: boolean
  outOfBalanceAmount?: Decimal
}

export interface TrialBalanceAccount {
  accountNumber: string
  accountName: string
  accountType: AccountType
  debitBalance: Decimal
  creditBalance: Decimal
}

// =============================================================================
// PORTFOLIO REPORTS
// =============================================================================

export interface PortfolioReport {
  asOfDate: Date
  reportingCurrency: string
  summary: PortfolioSummary
  holdings: TokenHolding[]
  performance: PortfolioPerformance
  allocation: PortfolioAllocation
  riskMetrics: RiskMetrics
}

export interface PortfolioSummary {
  totalValueUsd: Decimal
  totalCostBasis: Decimal
  unrealizedGainLoss: Decimal
  unrealizedGainLossPercent: number
  numberOfTokens: number
  numberOfChains: number
  numberOfAccounts: number
}

export interface PortfolioPerformance {
  periodStart: Date
  periodEnd: Date
  beginningValue: Decimal
  endingValue: Decimal
  netDeposits: Decimal
  netWithdrawals: Decimal
  realizedGains: Decimal
  unrealizedGains: Decimal
  totalReturn: Decimal
  totalReturnPercent: number
  timeWeightedReturn: number
  moneyWeightedReturn: number
}

export interface PortfolioAllocation {
  byAssetType: AllocationBreakdown[]
  byChain: AllocationBreakdown[]
  byToken: AllocationBreakdown[]
  byAccount: AllocationBreakdown[]
}

export interface AllocationBreakdown {
  category: string
  valueUsd: Decimal
  percentOfTotal: number
  costBasis: Decimal
  unrealizedGainLoss: Decimal
  count: number
}

export interface RiskMetrics {
  concentrationRisk: ConcentrationRisk
  liquidityRisk: LiquidityRisk
  volatilityMetrics: VolatilityMetrics
}

export interface ConcentrationRisk {
  topHoldingPercent: number
  top5HoldingsPercent: number
  top10HoldingsPercent: number
  herfindahlIndex: number // Portfolio concentration measure
  diversificationScore: number // 0-100
}

export interface LiquidityRisk {
  highlyLiquidPercent: number
  mediumLiquidPercent: number
  lowLiquidPercent: number
  illiquidPercent: number
  averageLiquidityScore: number
}

export interface VolatilityMetrics {
  portfolioVolatility: number
  beta?: number
  sharpeRatio?: number
  sortino Ratio?: number
  maxDrawdown?: number
}

// =============================================================================
// TAX REPORTS
// =============================================================================

export interface TaxReport {
  taxYear: number
  reportDate: Date
  taxpayerInfo: TaxpayerInfo
  summary: TaxYearSummary
  form8949Data: Form8949Data
  scheduleD: ScheduleD
  otherIncome: OtherIncomeReport
  deductions: DeductionsReport
}

export interface TaxpayerInfo {
  name: string
  ssn?: string
  address?: string
  filingStatus?: string
}

export interface Form8949Data {
  shortTermTransactions: CapitalGain[]
  longTermTransactions: CapitalGain[]
  shortTermSummary: Form8949Summary
  longTermSummary: Form8949Summary
}

export interface Form8949Summary {
  totalProceeds: Decimal
  totalCostBasis: Decimal
  totalAdjustments: Decimal
  totalGainLoss: Decimal
  transactionCount: number
}

export interface ScheduleD {
  shortTermCapitalGains: Decimal
  shortTermCapitalLosses: Decimal
  netShortTermGainLoss: Decimal
  longTermCapitalGains: Decimal
  longTermCapitalLosses: Decimal
  netLongTermGainLoss: Decimal
  totalNetGainLoss: Decimal
}

export interface OtherIncomeReport {
  stakingRewards: IncomeItem[]
  airdrops: IncomeItem[]
  interest: IncomeItem[]
  other: IncomeItem[]
  totalIncome: Decimal
}

export interface IncomeItem {
  date: Date
  tokenSymbol: string
  quantity: Decimal
  fairValueUsd: Decimal
  description: string
}

export interface DeductionsReport {
  transactionFees: DeductionItem[]
  otherExpenses: DeductionItem[]
  totalDeductions: Decimal
}

export interface DeductionItem {
  date: Date
  description: string
  amount: Decimal
  category: string
}

// =============================================================================
// ANALYTICS AND CHARTS
// =============================================================================

export interface TimeSeriesDataPoint {
  date: Date
  value: Decimal
  label?: string
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string
  borderWidth?: number
  fill?: boolean
}

export interface PortfolioValueChart {
  chartType: 'line'
  title: string
  data: TimeSeriesDataPoint[]
  compareToBaseline?: TimeSeriesDataPoint[]
}

export interface AllocationChart {
  chartType: 'pie' | 'doughnut' | 'bar'
  title: string
  data: ChartData
  totalValue: Decimal
}

export interface GainsLossesChart {
  chartType: 'bar' | 'waterfall'
  title: string
  realized: ChartDataset
  unrealized: ChartDataset
  periodStart: Date
  periodEnd: Date
}

export interface TransactionVolumeChart {
  chartType: 'bar' | 'line'
  title: string
  byType: ChartData
  byMonth: ChartData
  periodStart: Date
  periodEnd: Date
}

// =============================================================================
// DASHBOARDS
// =============================================================================

export interface DashboardData {
  asOfDate: Date
  summary: DashboardSummary
  recentTransactions: DashboardTransaction[]
  topHoldings: TokenHolding[]
  charts: DashboardCharts
  alerts: DashboardAlert[]
}

export interface DashboardSummary {
  totalPortfolioValue: Decimal
  dayChange: Decimal
  dayChangePercent: number
  weekChange: Decimal
  weekChangePercent: number
  monthChange: Decimal
  monthChangePercent: number
  yearToDateGainLoss: Decimal
  unrealizedGainLoss: Decimal
  realizedGainLossYTD: Decimal
}

export interface DashboardTransaction {
  id: number
  date: Date
  type: TransactionType
  tokenSymbol: string
  quantity: Decimal
  valueUsd: Decimal
  accountName: string
  chainName: string
}

export interface DashboardCharts {
  portfolioValue: PortfolioValueChart
  allocation: AllocationChart
  gainsLosses: GainsLossesChart
  transactionVolume: TransactionVolumeChart
}

export interface DashboardAlert {
  id: number
  severity: 'info' | 'warning' | 'error'
  category: 'reconciliation' | 'tax' | 'compliance' | 'price' | 'threshold'
  message: string
  actionRequired?: string
  createdAt: Date
  isRead: boolean
}

// =============================================================================
// CUSTOM REPORTS
// =============================================================================

export interface CustomReportDefinition {
  id: number
  name: string
  description?: string
  reportType: 'transaction_detail' | 'account_activity' | 'token_movement' | 'custom_query'
  filters: CustomReportFilters
  columns: CustomReportColumn[]
  groupBy?: string[]
  sortBy?: { field: string; direction: 'asc' | 'desc' }[]
  createdBy: string
  createdAt: Date
  isPublic: boolean
}

export interface CustomReportFilters {
  dateRange?: DateRange
  accountIds?: number[]
  tokenIds?: number[]
  chainIds?: string[]
  transactionTypes?: TransactionType[]
  minAmount?: Decimal
  maxAmount?: Decimal
  customFilters?: Record<string, unknown>
}

export interface CustomReportColumn {
  field: string
  header: string
  dataType: 'string' | 'number' | 'decimal' | 'date' | 'boolean'
  format?: string
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count'
  width?: number
}

export interface CustomReportResult {
  definition: CustomReportDefinition
  data: Record<string, unknown>[]
  summary?: Record<string, unknown>
  generatedAt: Date
  rowCount: number
}

// =============================================================================
// EXPORT FORMATS
// =============================================================================

export interface ExportRequest {
  reportType: 'balance_sheet' | 'income_statement' | 'portfolio' | 'tax' | 'custom'
  reportData: unknown
  format: 'pdf' | 'excel' | 'csv' | 'json'
  options?: ExportOptions
}

export interface ExportOptions {
  includeCharts?: boolean
  includeNotes?: boolean
  detailLevel?: 'summary' | 'detailed' | 'comprehensive'
  orientation?: 'portrait' | 'landscape'
  pageSize?: 'letter' | 'a4' | 'legal'
  dateFormat?: string
  numberFormat?: string
}

export interface ExportResult {
  filename: string
  mimeType: string
  data: Blob | string
  size: number
  exportedAt: Date
}

// =============================================================================
// COMPARISON REPORTS
// =============================================================================

export interface ComparativeReport {
  reportType: 'period_comparison' | 'budget_vs_actual' | 'year_over_year'
  periods: ComparisonPeriod[]
  metrics: ComparisonMetric[]
  variance: VarianceAnalysis[]
}

export interface ComparisonPeriod {
  label: string
  startDate: Date
  endDate: Date
  data: Record<string, Decimal>
}

export interface ComparisonMetric {
  metric: string
  category: string
  periods: Decimal[]
  variance: Decimal[]
  variancePercent: number[]
}

export interface VarianceAnalysis {
  metric: string
  actual: Decimal
  expected: Decimal
  variance: Decimal
  variancePercent: number
  isFavorable: boolean
  explanation?: string
}
