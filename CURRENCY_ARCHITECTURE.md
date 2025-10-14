# Currency Architecture Documentation

## Overview

This document describes the multi-currency architecture implemented in the Numbers application. The system supports both fiat currencies (USD, EUR, GBP, etc.) and cryptocurrencies (BTC, ETH, SOL, etc.) with automatic conversion and flexible reporting options.

## Architecture Components

### 1. Database Schema

#### currencies table
Stores all supported currencies (both fiat and crypto).

```sql
CREATE TABLE currencies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,          -- ISO/ticker (USD, BTC, ETH)
    name TEXT NOT NULL,                 -- Full name
    type TEXT NOT NULL,                 -- 'fiat' or 'crypto'
    decimals INTEGER NOT NULL,          -- Precision (2 for USD, 8 for BTC)
    is_supported BOOLEAN DEFAULT 1,     -- Enable/disable currencies
    coingecko_id TEXT,                  -- For crypto price feeds
    fixer_id TEXT,                      -- For fiat exchange rates
    symbol TEXT,                        -- Display symbol ($, €, ₿)
    icon_url TEXT,                      -- Currency icon
    created_at DATETIME,
    updated_at DATETIME
);
```

**Pre-populated currencies:**
- Crypto: BTC, ETH, USDC, USDT, SOL, MATIC, BNB, ADA, DOT, AVAX
- Fiat: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR

#### exchange_rates table
Caches exchange rates with TTL for performance.

```sql
CREATE TABLE exchange_rates (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate TEXT NOT NULL,                 -- Stored as TEXT for precision
    timestamp DATETIME NOT NULL,
    source TEXT NOT NULL,               -- 'coingecko', 'fixer', 'manual', 'compound'
    ttl_seconds INTEGER DEFAULT 300,    -- 5 min for crypto, 24h for fiat
    metadata TEXT,                      -- JSON for additional data
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (from_currency) REFERENCES currencies(code),
    FOREIGN KEY (to_currency) REFERENCES currencies(code)
);
```

**Exchange rate sources:**
- `coingecko`: Crypto prices from CoinGecko API
- `fixer`: Fiat exchange rates from Fixer API
- `manual`: Manually entered rates
- `compound`: Calculated from multiple sources (e.g., BTC→ETH via USD)

**TTL (Time To Live):**
- Crypto rates: 300 seconds (5 minutes) - volatile markets
- Fiat rates: 86400 seconds (24 hours) - more stable

#### account_settings table
Per-profile currency preferences.

```sql
CREATE TABLE account_settings (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL UNIQUE,
    primary_currency TEXT DEFAULT 'USD',    -- Main reporting currency
    reporting_currencies TEXT,               -- Comma-separated list
    conversion_method TEXT DEFAULT 'spot',   -- 'spot', 'historical', 'fixed'

    -- Display preferences
    decimal_places INTEGER DEFAULT 2,
    use_thousands_separator BOOLEAN DEFAULT 1,
    currency_display_format TEXT DEFAULT 'symbol',  -- 'symbol', 'code', 'name'

    -- Auto-conversion settings
    auto_convert BOOLEAN DEFAULT 1,
    cache_exchange_rates BOOLEAN DEFAULT 1,

    -- API keys
    coingecko_api_key TEXT,
    fixer_api_key TEXT,

    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES profiles(id),
    FOREIGN KEY (primary_currency) REFERENCES currencies(code)
);
```

**Conversion methods:**
- `spot`: Use current exchange rate
- `historical`: Use rate at transaction time
- `fixed`: Use manually set rates

#### transactions table (enhanced)
Updated with currency conversion fields.

```sql
ALTER TABLE transactions ADD COLUMN amount_primary TEXT;
ALTER TABLE transactions ADD COLUMN primary_currency TEXT DEFAULT 'USD';
ALTER TABLE transactions ADD COLUMN exchange_rate TEXT;
ALTER TABLE transactions ADD COLUMN exchange_rate_source TEXT;
ALTER TABLE transactions ADD COLUMN exchange_rate_timestamp DATETIME;
```

### 2. Rust Backend

#### Currency Models
Located in `src-tauri/src/core/currency.rs`:

```rust
pub struct Currency {
    pub id: String,
    pub code: String,
    pub name: String,
    pub currency_type: CurrencyType,
    pub decimals: i32,
    pub is_supported: bool,
    // ... other fields
}

pub struct ExchangeRate {
    pub id: String,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: String,  // Stored as string for precision
    pub timestamp: String,
    pub source: ExchangeRateSource,
    pub ttl_seconds: i32,
    // ... other fields
}

pub struct AccountSettings {
    pub id: String,
    pub profile_id: String,
    pub primary_currency: String,
    pub conversion_method: ConversionMethod,
    // ... other fields
}

pub struct TransactionWithConversion {
    // Original transaction fields
    pub value: String,
    pub token_symbol: String,

    // Conversion fields
    pub amount_primary: Option<String>,
    pub primary_currency: Option<String>,
    pub exchange_rate: Option<String>,
    pub exchange_rate_source: Option<String>,
    // ... other fields
}
```

#### Currency Service
Located in `src-tauri/src/core/currency_service.rs`:

```rust
pub struct CurrencyService {
    pool: Pool<Sqlite>,
}

impl CurrencyService {
    pub async fn get_all_currencies(&self) -> Result<Vec<Currency>>;
    pub async fn get_currency(&self, code: &str) -> Result<Option<Currency>>;
    pub async fn get_account_settings(&self, profile_id: &str) -> Result<Option<AccountSettings>>;
    pub async fn get_cached_exchange_rate(&self, from: &str, to: &str) -> Result<Option<ExchangeRate>>;
    pub async fn convert(&self, from: &str, to: &str, amount: &str) -> Result<CurrencyConversion>;
    pub async fn cleanup_stale_rates(&self) -> Result<u64>;
    // ... other methods
}
```

### 3. TypeScript Frontend

#### Type Definitions
Located in `src/types/currency.ts`:

```typescript
export interface Currency {
  id: string;
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
  decimals: number;
  isSupported: boolean;
  symbol?: string;
  // ... other fields
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  timestamp: string;
  source: ExchangeRateSource;
  ttlSeconds: number;
}

export interface AccountSettings {
  id: string;
  profileId: string;
  primaryCurrency: string;
  reportingCurrencies?: string[];
  conversionMethod: ConversionMethod;
  // ... other fields
}

export interface TransactionWithConversion {
  // Original fields
  value: string;
  tokenSymbol: string;

  // Conversion fields
  amountPrimary?: string;
  primaryCurrency?: string;
  exchangeRate?: string;
  exchangeRateSource?: string;
}
```

#### Currency Service
Located in `src/utils/currencyService.ts`:

```typescript
export class CurrencyService {
  async initialize(currencies: Currency[], settings: AccountSettings): Promise<void>;
  getCurrency(code: string): Currency | undefined;
  getCachedRate(from: string, to: string): ExchangeRate | null;
  async convert(request: ConversionRequest): Promise<ConversionResponse>;
  formatCurrency(amount: string | number, code: string, options?: CurrencyFormatOptions): string;
  // ... other methods
}

// Utility functions
export function formatCurrency(amount: string | number, code: string): string;
export function getCurrencySymbol(code: string): string;
export function formatCompactCurrency(amount: string | number, code: string): string;
```

## Usage Examples

### Backend (Rust)

```rust
use crate::core::{CurrencyService, ConversionMethod};

// Initialize service
let currency_service = CurrencyService::new(pool);

// Get all currencies
let currencies = currency_service.get_all_currencies().await?;

// Get account settings
let settings = currency_service.get_account_settings("profile-id").await?;

// Convert currency
let conversion = currency_service.convert(
    "BTC",
    "USD",
    "1.5",
    None,
    Some(ConversionMethod::Spot)
).await?;

println!("1.5 BTC = {} USD", conversion.converted_amount);

// Cache exchange rate
let rate = ExchangeRate {
    id: "btc-usd-1234".to_string(),
    from_currency: "BTC".to_string(),
    to_currency: "USD".to_string(),
    rate: "67000.00".to_string(),
    timestamp: "2025-01-01T00:00:00Z".to_string(),
    source: ExchangeRateSource::CoinGecko,
    ttl_seconds: 300,
    metadata: None,
    created_at: "2025-01-01T00:00:00Z".to_string(),
    updated_at: "2025-01-01T00:00:00Z".to_string(),
};

currency_service.cache_exchange_rate(&rate).await?;
```

### Frontend (TypeScript)

```typescript
import { currencyService, formatCurrency, formatCompactCurrency } from '@/utils/currencyService';
import { Currency, AccountSettings } from '@/types/currency';

// Initialize service
await currencyService.initialize(currencies, settings);

// Format currency
const formatted = formatCurrency(1234.56, 'USD');  // "$1,234.56"

// Compact format
const compact = formatCompactCurrency(1500000, 'USD');  // "$1.5M"

// Convert currency
const result = await currencyService.convert({
  fromCurrency: 'BTC',
  toCurrency: 'USD',
  amount: '0.5',
  method: 'spot'
});

console.log(`0.5 BTC = ${result.convertedAmount} USD`);

// Get currency symbol
const symbol = getCurrencySymbol('EUR');  // "€"
```

## Migration Guide

### Running Migrations

The migrations are automatically run when the database is initialized. The migration files are located in `src-tauri/migrations/` and are executed in order:

1. `20250101000001_create_profiles.sql` - Profiles table
2. `20250101000002_create_accounts.sql` - Accounts table
3. `20250101000003_create_transactions.sql` - Transactions table
4. `20250101000004_create_sync_status.sql` - Sync status table
5. **`20250101000005_create_currencies.sql`** - Currencies table (NEW)
6. **`20250101000006_create_exchange_rates.sql`** - Exchange rates table (NEW)
7. **`20250101000007_create_account_settings.sql`** - Account settings table (NEW)
8. **`20250101000008_add_currency_conversion_to_transactions.sql`** - Transaction updates (NEW)

### Updating Existing Data

If you have existing transactions, you'll need to backfill the conversion data:

```rust
// Pseudocode for backfilling conversions
for transaction in existing_transactions {
    let rate = get_historical_rate(
        transaction.token_symbol,
        primary_currency,
        transaction.timestamp
    ).await?;

    let amount_primary = Decimal::from_str(&transaction.value)?
        * Decimal::from_str(&rate)?;

    currency_service.update_transaction_conversion(
        &transaction.id,
        &amount_primary.to_string(),
        &primary_currency,
        &rate,
        "coingecko",
        &transaction.timestamp
    ).await?;
}
```

## API Integration

### CoinGecko (Crypto Prices)

```rust
// Example API call structure
let url = format!(
    "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies={}",
    coingecko_id,
    to_currency.to_lowercase()
);

// Response: { "bitcoin": { "usd": 67000.00 } }
```

### Fixer.io (Fiat Rates)

```rust
// Example API call structure
let url = format!(
    "https://api.fixer.io/latest?base={}&symbols={}",
    from_currency,
    to_currency
);

// Response: { "base": "USD", "rates": { "EUR": 0.92 } }
```

## Performance Considerations

1. **Caching Strategy**
   - Exchange rates are cached with TTL
   - Crypto rates expire after 5 minutes
   - Fiat rates expire after 24 hours
   - Stale rates are automatically cleaned up

2. **Database Indexes**
   - Composite index on (from_currency, to_currency, timestamp)
   - Index on timestamp for cleanup queries
   - Index on currency code for lookups

3. **Precision**
   - All amounts stored as TEXT to preserve decimal precision
   - Use `rust_decimal::Decimal` for calculations
   - Use `decimal.js` in TypeScript

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_currency_conversion() {
        // Test conversion logic
    }

    #[test]
    fn test_rate_caching() {
        // Test caching mechanism
    }
}
```

### Integration Tests

```typescript
describe('CurrencyService', () => {
  it('should format currency correctly', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toBe('$1,234.56');
  });

  it('should convert between currencies', async () => {
    const result = await currencyService.convert({
      fromCurrency: 'BTC',
      toCurrency: 'USD',
      amount: '1.0'
    });
    expect(result.convertedAmount).toBeDefined();
  });
});
```

## Future Enhancements

1. **Real-time Price Updates**
   - WebSocket connections to price feeds
   - Live price updates in UI

2. **Historical Charts**
   - Store historical rates for trend analysis
   - Price charts for each currency

3. **Multi-Currency Reporting**
   - Generate reports in multiple currencies simultaneously
   - Automatic conversion for tax reporting

4. **Custom Exchange Rates**
   - Allow users to set custom rates
   - Override automatic rates for specific transactions

5. **Rate Alerts**
   - Notify users when rates reach target values
   - Price notifications for portfolios

## Troubleshooting

### Issue: Exchange rate not found

**Solution:** Ensure the exchange rate is cached or fetch from API:

```rust
let rate = match currency_service.get_cached_exchange_rate(from, to).await? {
    Some(rate) => rate,
    None => {
        // Fetch from API and cache
        let fetched_rate = fetch_rate_from_api(from, to).await?;
        currency_service.cache_exchange_rate(&fetched_rate).await?;
        fetched_rate
    }
};
```

### Issue: Stale exchange rates

**Solution:** Run cleanup periodically:

```rust
// In a background task
tokio::spawn(async move {
    loop {
        tokio::time::sleep(Duration::from_secs(3600)).await;
        let _ = currency_service.cleanup_stale_rates().await;
    }
});
```

### Issue: Precision loss in calculations

**Solution:** Always use Decimal types:

```rust
// Bad
let amount = 1.23_f64 * 67000.0_f64;

// Good
use rust_decimal::Decimal;
let amount = Decimal::from_str("1.23")? * Decimal::from_str("67000")?;
```

## Support

For questions or issues with the currency architecture:
1. Check this documentation
2. Review the code comments
3. Create an issue in the repository
4. Contact the development team

## License

This currency architecture is part of the Numbers project and follows the same license.
