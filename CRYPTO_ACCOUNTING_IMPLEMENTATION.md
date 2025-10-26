# Crypto Accounting Implementation Guide

## Overview

Pacioli now includes a comprehensive crypto accounting system that supports both US GAAP and IFRS standards with sophisticated cost basis tracking, impairment testing, and automated disclosure generation.

## Features Implemented

### 1. Multi-Method Cost Basis Tracking

**Location**: `src/services/costBasisService.ts`

Supports four industry-standard cost basis calculation methods:

- **FIFO** (First In, First Out): Uses oldest lots first
- **LIFO** (Last In, First Out): Uses newest lots first
- **HIFO** (Highest In, First Out): Uses highest cost lots first (tax optimization)
- **Specific ID**: Taxpayer chooses specific lots

**Key Features**:
- Lot-level tracking with acquisition dates and costs
- Automatic disposal allocation across multiple lots
- Holding period calculation for tax purposes
- Weighted average cost calculation
- Validation and integrity checking

**Example Usage**:
```typescript
import { CostBasisService } from '@/services/costBasisService';

// Calculate cost basis for a disposal
const disposal = CostBasisService.calculateCostBasis({
  assetSymbol: 'ETH',
  quantity: '2.5',
  disposalDate: '2025-01-15',
  method: 'FIFO'
}, cryptoLots);

console.log(`Total cost basis: ${disposal.totalCostBasis}`);
console.log(`Average cost per unit: ${disposal.averageCostPerUnit}`);
```

### 2. Asset Classification System

**Location**: `src/types/cryptoAccounting.ts`

Four classification modes based on business intent:

#### Broker-Trader Mode
- **Treatment**: Fair value through P&L under both GAAP and IFRS
- **Use Case**: Active trading operations
- **Gains/Losses**: Recognized immediately in profit/loss

#### Investment Mode
- **US GAAP**: Fair value through P&L
- **IFRS**: Revaluation model (OCI) or cost model
- **Use Case**: Long-term holdings

#### Operational Mode
- **Treatment**: Intangible assets (cost less impairment)
- **Use Case**: Payment tokens, gas fees, governance tokens
- **Impairment**: Tested periodically

#### Inventory Mode
- **Treatment**: Lower of cost or net realizable value
- **Use Case**: NFT traders, token merchants
- **Write-downs**: Recognized when NRV < cost

### 3. GAAP/IFRS Compliance Engine

**Location**: `src/services/complianceService.ts`

Automatically applies appropriate accounting treatment based on selected standard:

**US GAAP Treatment**:
- Crypto assets generally measured at fair value through P&L
- No impairment reversal allowed once written down
- Specific disclosure requirements

**IFRS Treatment**:
- Choice of cost model or revaluation model
- Impairment testing required under cost model
- Impairment reversals allowed (up to original cost)
- Revaluation gains to OCI (Other Comprehensive Income)

**Dual Reporting**:
- Maintains both GAAP and IFRS values simultaneously
- Automatic reconciliation between standards
- Flags irreconcilable differences

### 4. Lot-Level Identification

**Location**: `src/types/cryptoAccounting.ts` - `CryptoLot` interface

Each crypto acquisition is tracked as a separate lot containing:

```typescript
interface CryptoLot {
  lotId: string;
  acquisitionDate: string;
  quantity: string;
  remainingQuantity: string;

  // Cost tracking
  acquisitionCost: string;
  costPerUnit: string;

  // Fair value tracking
  fairValueAtAcquisition: string;
  currentFairValue: string;
  lastFairValueUpdate: string;

  // Classification
  classification: AssetClassification;

  // Impairment history
  impairmentHistory: ImpairmentEvent[];
  cumulativeImpairment: string;

  // Active market indicators
  activeMarket: ActiveMarketIndicators;
}
```

### 5. Impairment Testing (IFRS Cost Model)

**Features**:
- Automatic impairment testing when fair value drops below carrying amount
- Impairment reversal capability (IFRS only)
- Complete audit trail of impairment events
- Integration with journal entry generation

**Example**:
```typescript
import { complianceService } from '@/services/complianceService';

const impairmentResult = complianceService.performImpairmentTest(
  carryingAmount: '50000',
  fairValue: '45000',
  previousImpairment: '0'
);

if (impairmentResult.isImpaired) {
  console.log(`Impairment loss: ${impairmentResult.impairmentLoss}`);
}
```

### 6. Automated Disclosure Generation

**Location**: `src/services/complianceService.ts` - `generateDisclosure()`

Automatically generates comprehensive disclosure reports including:

- **Summary Data**:
  - Total crypto assets
  - Total fair value
  - Unrealized gains and losses
  - Realized gains and losses

- **By Classification**:
  - Holdings and fair values by classification type
  - Unrealized gain/loss by classification

- **Significant Holdings**:
  - Assets comprising >5% of total portfolio
  - Concentration risk disclosures

- **Impairment Summary**:
  - Total impairments by asset
  - Impairment reversals (IFRS)

- **Methodology Disclosures**:
  - Cost basis method used
  - Fair value sources
  - Active market determination criteria

- **Risk Disclosures**:
  - Concentration risks
  - Market risks
  - Liquidity risks

### 7. Journal Entry Automation

**Location**: `src/services/complianceService.ts` - `generateJournalEntries()`

Automatically generates proper journal entries for:

#### Acquisition:
```
Dr: Crypto Assets - ETH
Cr: Cash
```

#### Revaluation (Fair Value Model):
```
Dr: Crypto Assets - ETH
Cr: Unrealized Gain on Crypto Assets
```

#### Revaluation (IFRS Revaluation Model - Gain):
```
Dr: Crypto Assets - ETH
Cr: Revaluation Surplus (OCI)
```

#### Impairment:
```
Dr: Impairment Loss
Cr: Crypto Assets - ETH
```

## Data Models

### Core Types

1. **CryptoTransaction**: Enhanced transaction with full accounting data
2. **CryptoLot**: Lot-level tracking for specific identification
3. **CryptoHolding**: Aggregated holding with cost basis and fair value
4. **ComplianceSettings**: Account-level compliance configuration
5. **DisclosureReport**: Generated disclosure data
6. **GAAPIFRSReconciliation**: Reconciliation between standards

### Key Enums

- `CostBasisMethod`: FIFO | LIFO | HIFO | SpecificID
- `AccountingStandard`: US_GAAP | IFRS | Both
- `AssetClassification`: BrokerTrader | Investment | Operational | Inventory
- `IFRSMeasurementModel`: CostModel | RevaluationModel

## Integration Guide

### Step 1: Configure Compliance Settings

```typescript
import { ComplianceSettings } from '@/types/cryptoAccounting';

const settings: ComplianceSettings = {
  id: 'settings-1',
  profileId: 'user-123',
  accountingStandard: 'Both',  // Or 'US_GAAP' or 'IFRS'
  defaultCostBasisMethod: 'FIFO',
  allowMethodOverride: true,
  ifrsMeasurementModel: 'RevaluationModel',
  allowImpairmentReversal: true,
  defaultClassification: 'Investment',
  generateDisclosures: true,
  disclosureLevel: 'Comprehensive',
  fairValueSource: 'CoinGecko',
  fairValueUpdateFrequency: 300,  // 5 minutes
  reportingCurrency: 'USD',
  functionalCurrency: 'USD',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

complianceService.initialize(settings);
```

### Step 2: Track Acquisitions as Lots

```typescript
import { CryptoLot } from '@/types/cryptoAccounting';

const lot: CryptoLot = {
  lotId: 'lot-eth-001',
  acquisitionDate: '2025-01-10T10:00:00Z',
  quantity: '5.0',
  remainingQuantity: '5.0',
  acquisitionCost: '10000',  // $10,000 total
  costPerUnit: '2000',       // $2,000 per ETH
  fairValueAtAcquisition: '10000',
  currentFairValue: '12500',  // Now worth $12,500
  lastFairValueUpdate: new Date().toISOString(),
  classification: 'Investment',
  activeMarket: {
    hasActiveMarket: true,
    exchangeName: 'Coinbase',
    dailyVolume24h: '15000000000',
    marketCap: '300000000000',
    liquidityScore: 95,
    lastUpdated: new Date().toISOString(),
  },
  impairmentHistory: [],
  cumulativeImpairment: '0',
};
```

### Step 3: Calculate Cost Basis on Disposal

```typescript
import { CostBasisService } from '@/services/costBasisService';

// Dispose of 2.5 ETH using FIFO
const disposal = CostBasisService.calculateCostBasis({
  assetSymbol: 'ETH',
  quantity: '2.5',
  disposalDate: '2025-01-15T14:00:00Z',
  method: 'FIFO',
}, [lot]);

// Calculate gain/loss
const proceeds = '6500';  // Sold for $6,500
const gainLoss = CostBasisService.calculateGainLoss(
  disposal.totalCostBasis,
  proceeds
);

console.log(`Realized ${gainLoss.isGain ? 'gain' : 'loss'}: $${gainLoss.gainLoss}`);
```

### Step 4: Generate Disclosures

```typescript
import { complianceService } from '@/services/complianceService';

const disclosure = complianceService.generateDisclosure(
  holdings,
  '2025-01-31'
);

console.log('Total Crypto Assets:', disclosure.totalCryptoAssets);
console.log('Unrealized Gains:', disclosure.unrealizedGains);
console.log('Unrealized Losses:', disclosure.unrealizedLosses);
```

### Step 5: Perform GAAP/IFRS Reconciliation

```typescript
const reconciliation = complianceService.generateReconciliation(
  holdings,
  '2025-01-31'
);

console.log('GAAP Carrying Amount:', reconciliation.gaapCarryingAmount);
console.log('IFRS Carrying Amount:', reconciliation.ifrsCarryingAmount);
console.log('Adjustments:', reconciliation.adjustments);
```

## Active Market Determination

The system includes sophisticated active market indicators:

```typescript
interface ActiveMarketIndicators {
  hasActiveMarket: boolean;
  exchangeName?: string;
  dailyVolume24h?: string;      // 24-hour trading volume
  marketCap?: string;            // Total market capitalization
  liquidityScore?: number;       // 0-100 score
  lastUpdated: string;
}
```

**Active Market Criteria**:
1. Minimum daily volume threshold
2. Multiple exchanges trading the asset
3. Sufficient market capitalization
4. Regular price updates
5. Low bid-ask spreads

## Tax Reporting Integration

The system includes tax lot tracking compatible with IRS Form 8949:

```typescript
interface TaxLot {
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
```

## Next Steps

### Recommended Integrations:

1. **Real-time Fair Value Updates**
   - Integrate with CoinGecko API
   - Implement WebSocket connections for live prices
   - Add price alert mechanisms

2. **Enhanced UI Components**
   - Lot selection interface for Specific ID
   - Classification management dashboard
   - Disclosure report viewer
   - GAAP/IFRS comparison charts

3. **Automated Testing**
   - Unit tests for cost basis calculations
   - Integration tests for compliance logic
   - Regression tests for disclosure generation

4. **Backend Integration**
   - Persist lots to database
   - Store compliance settings
   - Cache disclosure reports
   - Implement audit logging

5. **Report Generation**
   - PDF export for disclosures
   - Excel export for tax lots
   - Financial statement formatting
   - Chart of accounts integration

## File Structure

```
src/
├── types/
│   ├── cryptoAccounting.ts          # Core type definitions
│   └── currency.ts                   # Existing currency types
├── services/
│   ├── costBasisService.ts          # Cost basis calculations
│   ├── complianceService.ts         # GAAP/IFRS compliance
│   └── currencyService.ts           # Existing currency service
└── app/
    └── transactions/
        └── Transactions.tsx          # Transaction UI (to be enhanced)
```

## Standards Compliance

### US GAAP References:
- ASC 820: Fair Value Measurement
- ASC 350: Intangibles (for operational tokens)
- ASC 330: Inventory (for NFTs/tokens for sale)

### IFRS References:
- IAS 38: Intangible Assets
- IAS 2: Inventories
- IAS 36: Impairment of Assets
- IFRS 13: Fair Value Measurement

## Support

For questions or issues with the crypto accounting implementation:
- Review this guide
- Check type definitions in `src/types/cryptoAccounting.ts`
- Examine service implementations in `src/services/`
- Refer to inline code documentation

## Version

- **Implementation Date**: January 2025
- **Version**: 1.0.0
- **Standards**: US GAAP (current), IFRS (current)
- **Status**: Foundation complete, UI integration pending
