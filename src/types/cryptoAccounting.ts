/**
 * Crypto Accounting Types
 * Comprehensive types for GAAP/IFRS compliant crypto asset accounting
 */

/**
 * Cost basis calculation methods
 */
export type CostBasisMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'SpecificID';

/**
 * Accounting standards
 */
export type AccountingStandard = 'US_GAAP' | 'IFRS' | 'Both';

/**
 * Asset classification for different business models
 */
export type AssetClassification =
  | 'BrokerTrader'    // Fair value through P&L (both GAAP & IFRS)
  | 'Investment'       // GAAP: FV through P&L, IFRS: Revaluation model
  | 'Operational'      // Payment tokens, gas fees, governance tokens
  | 'Inventory';       // NFTs, tokens held for sale

/**
 * Measurement models for IFRS
 */
export type IFRSMeasurementModel = 'CostModel' | 'RevaluationModel';

/**
 * Active market indicators
 */
export interface ActiveMarketIndicators {
  hasActiveMarket: boolean;
  exchangeName?: string;
  dailyVolume24h?: string;
  marketCap?: string;
  liquidityScore?: number; // 0-100
  lastUpdated: string;
}

/**
 * Lot-level tracking for specific identification
 */
export interface CryptoLot {
  lotId: string;
  acquisitionDate: string;
  quantity: string;
  remainingQuantity: string;

  // Cost basis
  acquisitionCost: string;         // Total cost in primary currency
  costPerUnit: string;             // Per-unit cost

  // Fair values
  fairValueAtAcquisition: string;  // FV when acquired
  currentFairValue: string;        // Current FV
  lastFairValueUpdate: string;

  // Classification
  classification: AssetClassification;

  // Active market
  activeMarket: ActiveMarketIndicators;

  // Impairment tracking (for IFRS cost model)
  impairmentHistory: ImpairmentEvent[];
  cumulativeImpairment: string;

  // Traceability
  transactionHash?: string;
  walletAddress?: string;
  notes?: string;
}

/**
 * Impairment event (primarily for IFRS cost model)
 */
export interface ImpairmentEvent {
  eventId: string;
  date: string;
  impairmentAmount: string;
  fairValueAtEvent: string;
  carryingAmountBefore: string;
  carryingAmountAfter: string;
  reason: string;
  reversalAllowed: boolean;        // IFRS allows reversal, GAAP does not
}

/**
 * Enhanced crypto transaction with full accounting data
 */
export interface CryptoTransaction {
  // Base transaction data
  id: string;
  hash: string;
  timestamp: string;
  fromAddress: string;
  toAddress?: string;

  // Asset information
  assetSymbol: string;
  assetName: string;
  quantity: string;

  // Cost basis (all methods calculated)
  costBasis: {
    FIFO: string;
    LIFO: string;
    HIFO: string;
    SpecificID?: string;  // Only if lot specified
    selectedMethod: CostBasisMethod;
    selectedValue: string;
  };

  // Fair values
  fairValueAtAcquisition: string;
  currentFairValue: string;
  fairValueCurrency: string;       // Usually primary currency

  // Classification
  classification: AssetClassification;
  classificationIntent: string;    // Business reason for classification

  // Lot assignment (for Specific ID)
  assignedLotIds?: string[];

  // Active market
  activeMarket: ActiveMarketIndicators;

  // Accounting treatment
  accountingStandard: AccountingStandard;
  measurementModel?: IFRSMeasurementModel;  // For IFRS only

  // Impairment (if applicable)
  isImpaired: boolean;
  impairmentAmount?: string;
  impairmentDate?: string;

  // Gain/Loss calculations
  realizedGainLoss?: string;       // On disposal
  unrealizedGainLoss?: string;     // Mark-to-market

  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Holding summary for a crypto asset
 */
export interface CryptoHolding {
  assetSymbol: string;
  assetName: string;

  // Quantities
  totalQuantity: string;
  availableQuantity: string;
  lockedQuantity: string;

  // Cost basis by method
  costBasis: {
    FIFO: string;
    LIFO: string;
    HIFO: string;
    weightedAverage: string;
  };

  // Fair value
  currentFairValue: string;
  fairValueCurrency: string;
  lastPriceUpdate: string;

  // Unrealized gain/loss
  unrealizedGainLoss: {
    FIFO: string;
    LIFO: string;
    HIFO: string;
    weightedAverage: string;
  };

  // Classification breakdown
  classificationBreakdown: {
    [key in AssetClassification]?: string;  // Quantity by classification
  };

  // Lot tracking
  lots: CryptoLot[];

  // Active market
  activeMarket: ActiveMarketIndicators;

  // Impairment summary
  totalImpairment: string;
  impairmentEvents: number;
}

/**
 * Account-level compliance settings
 */
export interface ComplianceSettings {
  id: string;
  profileId: string;

  // Standard selection
  accountingStandard: AccountingStandard;

  // Cost basis method
  defaultCostBasisMethod: CostBasisMethod;
  allowMethodOverride: boolean;

  // IFRS specific
  ifrsMeasurementModel?: IFRSMeasurementModel;
  allowImpairmentReversal?: boolean;

  // Classification defaults
  defaultClassification: AssetClassification;
  classificationByAsset?: Record<string, AssetClassification>;

  // Disclosure requirements
  generateDisclosures: boolean;
  disclosureLevel: 'Minimal' | 'Standard' | 'Comprehensive';

  // Fair value settings
  fairValueSource: 'CoinGecko' | 'Fixer' | 'Manual' | 'Composite';
  fairValueUpdateFrequency: number;  // In seconds

  // Reporting
  reportingCurrency: string;
  functionalCurrency: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Disclosure report data
 */
export interface DisclosureReport {
  id: string;
  reportDate: string;
  standard: AccountingStandard;

  // Summary data
  totalCryptoAssets: string;
  totalFairValue: string;
  unrealizedGains: string;
  unrealizedLosses: string;
  realizedGains: string;
  realizedLosses: string;

  // By classification
  byClassification: {
    [key in AssetClassification]?: {
      holdings: string;
      fairValue: string;
      unrealizedGainLoss: string;
    };
  };

  // Significant holdings (>5% of total)
  significantHoldings: {
    assetSymbol: string;
    quantity: string;
    fairValue: string;
    percentOfTotal: number;
  }[];

  // Impairment disclosure
  impairmentSummary?: {
    totalImpairments: string;
    impairmentsByAsset: Record<string, string>;
    reversalsThisPeriod?: string;  // IFRS only
  };

  // Measurement methodology
  measurementMethodology: {
    costBasisMethod: CostBasisMethod;
    fairValueSource: string;
    activeMarketDetermination: string;
  };

  // Risks and concentrations
  concentrationRisks?: string[];
  marketRisks?: string[];
  liquidityRisks?: string[];

  // Narrative disclosures
  accountingPolicies: string;
  significantJudgments: string;
  additionalNotes?: string;

  createdAt: string;
}

/**
 * Reconciliation between GAAP and IFRS
 */
export interface GAAPIFRSReconciliation {
  reportDate: string;

  // Starting point (US GAAP)
  gaapCarryingAmount: string;

  // Adjustments to IFRS
  adjustments: {
    description: string;
    amount: string;
    explanation: string;
  }[];

  // Ending point (IFRS)
  ifrsCarryingAmount: string;

  // Key differences
  keyDifferences: {
    item: string;
    gaapTreatment: string;
    ifrsTreatment: string;
    impact: string;
  }[];

  // Irreconcilable items (if any)
  irreconcilableItems?: {
    description: string;
    reason: string;
    recommendation: string;
  }[];
}

/**
 * Tax lot for tax reporting (similar to accounting lot but tax-specific)
 */
export interface TaxLot {
  lotId: string;
  acquisitionDate: string;
  disposalDate?: string;
  quantity: string;
  costBasis: string;
  proceeds?: string;
  gainLoss?: string;
  holdingPeriod?: 'ShortTerm' | 'LongTerm';
  taxYear: number;
}

/**
 * Integration with transaction types
 */
export interface EnhancedTransaction extends CryptoTransaction {
  // Link to general ledger
  journalEntryId?: string;
  debitAccount?: string;
  creditAccount?: string;

  // Tax tracking
  taxLotIds?: string[];
  taxCategory?: 'Capital' | 'Ordinary' | 'Exempt';

  // Audit trail
  approvedBy?: string;
  approvalDate?: string;
  auditNotes?: string;
}
