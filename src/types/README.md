# Pacioli Type System

## Overview

Type system layers:

1. `database.ts` - SQLite schema types
2. `accounting.ts` - Business logic
3. `reporting.ts` - Financial statements and analytics
4. `tauri-commands.ts` - Frontend-backend API
5. `type-mappings.ts` - UI/DB conversion utilities

## Architecture

```
UI Components
     ↓
Type System (Reporting, Accounting, Tauri Commands)
     ↓
Database Types
     ↓
SQLite Schema (migrations/*.sql)
```

## database.ts

Maps to SQLite database schema.

**Main Types:**
- `GLAccount` - Chart of accounts
- `Token`, `Chain` - Blockchain entities
- `AccountingTransaction` - Subsidiary ledger
- `JournalEntry`, `JournalEntryLine` - Double-entry bookkeeping
- `TransactionLot` - Cost basis tracking
- `VTokenBalance`, `VAccountBalance` - Views

**Enums:**
- `AccountType`, `DigitalAssetType`, `TransactionType`, `CostBasisMethod`

**Example:**
```typescript
import { GLAccount, AccountType } from '@/types/database'

const account: GLAccount = {
  id: 1,
  accountNumber: '1510',
  accountName: 'Digital Assets',
  accountType: AccountType.Asset,
  isActive: true,
  isEditable: true,
  normalBalance: NormalBalance.Debit,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

## accounting.ts

Business logic types.

**Main Types:**
- `CreateAccountingTransactionRequest`
- `EnrichedAccountingTransaction`
- `TokenHolding`
- `CostBasisCalculation`
- `CapitalGain`
- `TRANSACTION_TEMPLATES`

**Example:**
```typescript
import { CreateAccountingTransactionRequest, TransactionType } from '@/types/accounting'

const request: CreateAccountingTransactionRequest = {
  transactionDate: new Date(),
  glAccountId: 1,
  tokenId: 5,
  quantity: '100.000000000000000000',
  unitPrice: '5.50000000',
  totalValue: '550.00',
  transactionType: TransactionType.Purchase,
  chainId: 'polkadot',
  walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
}
```

## reporting.ts

Financial statements and analytics.

**Main Types:**
- `BalanceSheetReport`
- `IncomeStatementReport`
- `PortfolioReport`
- `TaxReport`
- `DashboardData`
- `ChartData`

## tauri-commands.ts

Type-safe Tauri backend interface.

**Namespaces:**
- `GLAccountCommands`, `TransactionCommands`, `JournalEntryCommands`
- `ReportingCommands`, `PortfolioCommands`, `ExportCommands`

**Example:**
```typescript
import { invoke } from '@tauri-apps/api/tauri'
import { TauriResponse, GLAccount } from '@/types'

const response = await invoke<TauriResponse<GLAccount[]>>('get_all_gl_accounts')
if (response.success && response.data) {
  return response.data
}
```

## type-mappings.ts

Converts between UI types (kebab-case) and DB types (Title Case).

**Functions:**
- `uiToDbDigitalAssetType()`, `dbToUiDigitalAssetType()`
- `uiTokenToDbToken()`, `dbTokenToUiToken()`

**Example:**
```typescript
import { uiToDbDigitalAssetType } from '@/types/type-mappings'

const dbType = uiToDbDigitalAssetType('native-protocol-tokens')
// => 'Native Protocol Token'
```

## Usage Patterns

### Fetch Data

```typescript
import { GLAccount, VAccountBalance } from '@/types/database'

const [accounts, setAccounts] = useState<GLAccount[]>([])

useEffect(() => {
  const fetch = async () => {
    const result = await invoke<TauriResponse<GLAccount[]>>('get_all_gl_accounts')
    if (result.success) setAccounts(result.data || [])
  }
  fetch()
}, [])
```

### Create Transaction

```typescript
import { CreateAccountingTransactionRequest, TransactionType } from '@/types/accounting'

const create = async (formData: any) => {
  const request: CreateAccountingTransactionRequest = {
    transactionDate: formData.date,
    glAccountId: formData.accountId,
    tokenId: formData.tokenId,
    quantity: formData.amount.toString(),
    transactionType: TransactionType.Purchase,
    chainId: formData.chainId
  }

  const result = await invoke<TauriResponse<AccountingTransaction>>(
    'create_transaction',
    { request }
  )
}
```

### Generate Report

```typescript
import { BalanceSheetReport } from '@/types/reporting'

const report = await invoke<TauriResponse<BalanceSheetReport>>(
  'get_balance_sheet',
  { asOfDate: new Date() }
)
```

## Best Practices

### Use Decimal Strings

```typescript
// Correct
const amount = '123.45'

// Wrong - loses precision
const amount = 123.45
```

### Check Response Success

```typescript
const response = await invoke<TauriResponse<GLAccount[]>>('get_accounts')
if (response.success && response.data) {
  return response.data
} else {
  throw new Error(response.error?.message)
}
```

### Use Type Guards

```typescript
import { isDBDigitalAssetType } from '@/types/type-mappings'

if (isDBDigitalAssetType(value)) {
  processDigitalAssetType(value)
}
```

## Common Imports

```typescript
// Database
import { GLAccount, Token, AccountingTransaction } from '@/types/database'

// Accounting
import { CreateAccountingTransactionRequest, PortfolioSummary } from '@/types/accounting'

// Reporting
import { BalanceSheetReport, TaxReport } from '@/types/reporting'

// Tauri
import { TauriResponse, TransactionCommands } from '@/types/tauri-commands'

// Mappings
import { uiToDbDigitalAssetType, dbTokenToUiToken } from '@/types/type-mappings'
```

## Decimal Type

All monetary and quantity values:

```typescript
type Decimal = string

const price: Decimal = '5.50000000'        // 8 decimals
const quantity: Decimal = '100.000000000000000000' // 18 decimals
const value: Decimal = '550.00'            // 2 decimals
```

## Database Schema Mapping

| Type | Migration File | Table |
|------|----------------|-------|
| `GLAccount` | `20250102000001_create_gl_accounts.sql` | `gl_accounts` |
| `Chain`, `Token` | `20250102000002_create_chains_and_tokens.sql` | `chains`, `tokens` |
| `AccountingTransaction`, `JournalEntry` | `20250102000003_create_journal_entries.sql` | `accounting_transactions`, `journal_entries` |
| `TransactionLot`, `LotDisposal` | `20250102000004_create_cost_basis_tracking.sql` | `transaction_lots`, `lot_disposals` |
| `VTokenBalance`, `VAccountBalance` | `20250102000005_create_accounting_views.sql` | `v_token_balances`, `v_account_balances` |
