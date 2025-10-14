# Multi-Currency System Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the multi-currency system in the Numbers application, following the MVP-first approach with support for USD, EUR, GBP, DOT, KSM, USDT, and USDC.

## Phase 1: MVP Implementation (CURRENT)

### Supported Currencies

**Fiat:**
- USD (US Dollar) - Primary
- EUR (Euro)
- GBP (British Pound)

**Crypto:**
- DOT (Polkadot) - 10 decimals, Substrate chain
- KSM (Kusama) - 12 decimals, Substrate chain
- USDT (Tether) - 6 decimals
- USDC (USD Coin) - 6 decimals

### Database Schema

The MVP uses simplified tables focused on essential functionality:

```sql
-- MVP Currencies (7 total)
currencies_mvp
- Stores only MVP currencies
- Includes Substrate-specific flags

-- Exchange Rates with High Precision
exchange_rates_mvp
- Rates stored as TEXT (DECIMAL 36,18 precision)
- 5-minute TTL for crypto
- 24-hour TTL for fiat

-- Account Currency Settings
account_currency_settings
- One setting per organization
- Primary currency selection
- Conversion method (spot/historical/fixed)

-- Enhanced Transactions
transactions (updated with new columns)
- original_amount (DECIMAL 36,18)
- original_currency
- converted_amount (DECIMAL 36,18)
- conversion_rate (DECIMAL 36,18)
- rate_timestamp
- rate_source

-- XCM Transfer Tracking (Polkadot-specific)
xcm_transfers
- Multi-hop transfer tracking
- Status monitoring
- Cross-chain transfer details

-- Parachain Tokens (Dynamic)
parachain_tokens
- Auto-discovered tokens
- 18 decimal precision
- Chain-specific asset IDs
```

### Core Principles

#### 1. Store Original, Convert On-Demand

**Always store:**
```rust
struct Transaction {
    original_amount: String,      // "10.5" DOT
    original_currency: String,     // "DOT"
    converted_amount: String,      // "78.75" (in USD)
    conversion_rate: String,       // "7.50" (DOT/USD rate)
    rate_timestamp: String,        // When rate was fetched
    rate_source: String,           // "coingecko"
}
```

**Never store:**
- Only converted amounts
- Hardcoded exchange rates
- Amounts without their currency

#### 2. Use High-Precision Decimals

```rust
// ALWAYS use Decimal for calculations
use rust_decimal::Decimal;

// Good ✓
let amount = Decimal::from_str("10.123456789012345678")?;
let rate = Decimal::from_str("7.5")?;
let converted = amount * rate;

// Bad ✗
let amount = 10.123456789012345678_f64;  // Loses precision!
let rate = 7.5_f64;
let converted = amount * rate;
```

#### 3. Cache Exchange Rates with TTL

```rust
// Crypto rates: 5 minutes (300 seconds)
INSERT INTO exchange_rates_mvp (
    from_currency, to_currency, rate,
    timestamp, source, ttl_seconds
) VALUES ('DOT', 'USD', '7.50', datetime('now'), 'coingecko', 300);

// Fiat rates: 24 hours (86400 seconds)
INSERT INTO exchange_rates_mvp (
    from_currency, to_currency, rate,
    timestamp, source, ttl_seconds
) VALUES ('EUR', 'USD', '1.09', datetime('now'), 'fixer', 86400);
```

## API Integration

### CoinGecko (Crypto Prices)

```rust
use crate::api::price_feeds::CoinGeckoClient;

// Initialize client
let client = CoinGeckoClient::new(Some(api_key));

// Get current price
let dot_price = client.get_price("polkadot", "usd").await?;
println!("DOT: ${}", dot_price);  // High precision string

// Get multiple prices
let prices = client.get_multiple_prices(
    &["polkadot", "kusama", "tether", "usd-coin"],
    "usd"
).await?;

// Get historical price
let historical = client.get_historical_price(
    "polkadot",
    "01-01-2025",  // DD-MM-YYYY format
    "usd"
).await?;
```

**Rate Limits:**
- Free tier: 10-50 calls/minute
- Pro tier: 500 calls/minute
- Cache aggressively!

### Fixer.io (Fiat Rates)

```rust
use crate::api::price_feeds::FixerClient;

// Initialize client
let client = FixerClient::new(api_key);

// Get current rate
let eur_usd = client.get_rate("EUR", "USD").await?;

// Get multiple rates
let rates = client.get_multiple_rates("USD", &["EUR", "GBP"]).await?;

// Get historical rate
let historical = client.get_historical_rate(
    "EUR",
    "USD",
    "2025-01-01"  // YYYY-MM-DD format
).await?;

// Convert amount
let converted = client.convert("EUR", "USD", "100.00").await?;
```

**Rate Limits:**
- Free tier: 100 calls/month
- Basic tier: 1000 calls/month
- Cache for 24 hours!

## Polkadot/Substrate Special Handling

### 1. High Precision (18 Decimals)

```rust
use crate::core::SubstrateCurrencyHandler;

// DOT uses 10 decimals, but store with 18 for consistency
// 1 DOT = 10^10 planck (smallest unit)

// Convert from planck to DOT
let planck_amount = "10000000000";  // 1 DOT
let dot_amount = SubstrateCurrencyHandler::convert_from_planck(
    planck_amount,
    10  // DOT decimals
)?;
assert_eq!(dot_amount, "1");

// Convert from DOT to planck
let dot_amount = "1.5";
let planck = SubstrateCurrencyHandler::convert_to_planck(
    dot_amount,
    10
)?;
assert_eq!(planck, "15000000000");
```

### 2. XCM Transfer Tracking

```rust
use crate::core::substrate_currency::XcmTransfer;

// Track cross-chain transfer
let xcm_transfer = XcmTransfer {
    id: "xcm-123".to_string(),
    transaction_id: "tx-456".to_string(),
    from_chain_id: "polkadot".to_string(),
    from_address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY".to_string(),
    to_chain_id: "moonbeam".to_string(),
    to_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb".to_string(),
    asset_id: "DOT".to_string(),
    amount: "10.5".to_string(),
    status: XcmTransferStatus::Pending,
    hops: vec!["polkadot".to_string(), "moonbeam".to_string()],
    timestamp: "2025-01-01T00:00:00Z".to_string(),
};

let handler = SubstrateCurrencyHandler::new(pool);
handler.track_xcm_transfer(&xcm_transfer).await?;

// Update status as transfer progresses
handler.update_xcm_status("xcm-123", XcmTransferStatus::InTransit).await?;
handler.update_xcm_status("xcm-123", XcmTransferStatus::Completed).await?;
```

### 3. Parachain Token Management

```rust
use crate::core::substrate_currency::SubstrateToken;

// Register new parachain token
let token = SubstrateToken {
    chain_id: "moonbeam".to_string(),
    asset_id: "42161".to_string(),
    symbol: "GLMR".to_string(),
    name: "Glimmer".to_string(),
    decimals: 18,
};

handler.register_parachain_token(&token).await?;

// Retrieve parachain token
let glmr = handler.get_parachain_token("moonbeam", "42161").await?;
```

## Conversion Workflows

### Workflow 1: Recording a New Transaction

```rust
// 1. User receives 10.5 DOT
let original_amount = "10.5";
let original_currency = "DOT";

// 2. Get user's primary currency setting
let settings = currency_service
    .get_account_settings(&profile_id)
    .await?
    .unwrap_or_default();
let primary_currency = settings.primary_currency; // "USD"

// 3. Get exchange rate (with caching)
let rate = match currency_service
    .get_cached_exchange_rate("DOT", &primary_currency)
    .await?
{
    Some(cached) => cached.rate,
    None => {
        // Fetch from CoinGecko
        let coingecko = CoinGeckoClient::new(settings.coingecko_api_key);
        let rate = coingecko.get_price("polkadot", "usd").await?;

        // Cache it
        let exchange_rate = ExchangeRate {
            id: uuid::Uuid::new_v4().to_string(),
            from_currency: "DOT".to_string(),
            to_currency: primary_currency.clone(),
            rate: rate.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            source: ExchangeRateSource::CoinGecko,
            ttl_seconds: 300,  // 5 minutes
            metadata: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        currency_service.cache_exchange_rate(&exchange_rate).await?;
        rate
    }
};

// 4. Calculate converted amount
use rust_decimal::Decimal;
use std::str::FromStr;

let amount_decimal = Decimal::from_str(original_amount)?;
let rate_decimal = Decimal::from_str(&rate)?;
let converted_amount = amount_decimal * rate_decimal;

// 5. Store transaction with ALL fields
sqlx::query(
    r#"
    INSERT INTO transactions (
        id, profile_id, chain, hash, timestamp,
        from_address, to_address, value,
        token_symbol, token_decimals,
        transaction_type, status,
        -- Currency fields
        original_amount, original_currency,
        converted_amount, conversion_rate,
        rate_timestamp, rate_source,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    "#
)
.bind(&transaction_id)
.bind(&profile_id)
.bind("polkadot")
.bind(&tx_hash)
.bind(&timestamp)
.bind(&from_address)
.bind(&to_address)
.bind(original_amount)  // Also store in value for compatibility
.bind(original_currency)
.bind(10)  // DOT decimals
.bind("receive")
.bind("completed")
// Currency conversion fields
.bind(original_amount)
.bind(original_currency)
.bind(converted_amount.to_string())
.bind(&rate)
.bind(chrono::Utc::now().to_rfc3339())
.bind("coingecko")
.execute(&pool)
.await?;
```

### Workflow 2: Displaying Transaction History

```rust
// Fetch transactions
let transactions = sqlx::query_as::<_, TransactionWithConversion>(
    "SELECT * FROM transactions WHERE profile_id = ? ORDER BY timestamp DESC LIMIT 50"
)
.bind(&profile_id)
.fetch_all(&pool)
.await?;

// Display with both currencies
for tx in transactions {
    println!(
        "{} {} (${}) on {}",
        tx.original_amount,
        tx.original_currency.unwrap_or_default(),
        tx.converted_amount.unwrap_or_default(),
        tx.timestamp
    );

    // Show exchange rate used
    if let Some(rate) = tx.conversion_rate {
        println!("  Rate: 1 {} = ${} (via {})",
            tx.original_currency.unwrap_or_default(),
            rate,
            tx.rate_source.unwrap_or_default()
        );
    }
}
```

### Workflow 3: Generating Reports

```rust
// Get transactions for a period
let transactions = sqlx::query_as::<_, TransactionWithConversion>(
    r#"
    SELECT * FROM transactions
    WHERE profile_id = ?
    AND timestamp BETWEEN ? AND ?
    "#
)
.bind(&profile_id)
.bind(&start_date)
.bind(&end_date)
.fetch_all(&pool)
.await?;

// Calculate totals by currency
let mut totals_by_currency: HashMap<String, Decimal> = HashMap::new();
let mut totals_converted: Decimal = Decimal::ZERO;

for tx in transactions {
    // Sum by original currency
    if let Some(currency) = &tx.original_currency {
        let amount = Decimal::from_str(&tx.original_amount)?;
        *totals_by_currency.entry(currency.clone()).or_insert(Decimal::ZERO) += amount;
    }

    // Sum converted amounts
    if let Some(converted) = &tx.converted_amount {
        let amount = Decimal::from_str(converted)?;
        totals_converted += amount;
    }
}

// Display report
println!("Transaction Summary ({} to {})", start_date, end_date);
println!("By Currency:");
for (currency, amount) in totals_by_currency {
    println!("  {}: {}", currency, amount);
}
println!("Total in USD: ${}", totals_converted);
```

## Error Handling

### Rate Fetch Failures

```rust
async fn get_exchange_rate_with_fallback(
    from: &str,
    to: &str,
    settings: &AccountSettings,
) -> Result<String> {
    // Try cache first
    if let Some(cached) = get_cached_rate(from, to).await? {
        return Ok(cached.rate);
    }

    // Try CoinGecko
    if let Some(api_key) = &settings.coingecko_api_key {
        match CoinGeckoClient::new(Some(api_key.clone()))
            .get_price(from, to)
            .await
        {
            Ok(rate) => return Ok(rate),
            Err(e) => log::warn!("CoinGecko failed: {}", e),
        }
    }

    // Try Fixer for fiat
    if is_fiat(from) && is_fiat(to) {
        if let Some(api_key) = &settings.fixer_api_key {
            match FixerClient::new(api_key.clone())
                .get_rate(from, to)
                .await
            {
                Ok(rate) => return Ok(rate),
                Err(e) => log::warn!("Fixer failed: {}", e),
            }
        }
    }

    // Fallback to manual/fixed rate
    if let Some(manual_rate) = get_manual_rate(from, to).await? {
        return Ok(manual_rate);
    }

    Err(anyhow::anyhow!("No exchange rate available"))
}
```

### Precision Loss Prevention

```rust
// NEVER do this:
let amount: f64 = 10.123456789012345678;  // ✗ Loses precision

// ALWAYS do this:
let amount = Decimal::from_str("10.123456789012345678")?;  // ✓ Preserves precision

// Store as TEXT in database:
sqlx::query("INSERT INTO transactions (amount) VALUES (?)")
    .bind(amount.to_string())  // Store as string
    .execute(&pool)
    .await?;

// Retrieve and parse:
let row: (String,) = sqlx::query_as("SELECT amount FROM transactions WHERE id = ?")
    .bind(id)
    .fetch_one(&pool)
    .await?;
let amount = Decimal::from_str(&row.0)?;  // Parse back to Decimal
```

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_precision() {
        let amount = Decimal::from_str("0.000000000000000001").unwrap();
        assert_eq!(amount.to_string(), "0.000000000000000001");
    }

    #[test]
    fn test_conversion() {
        let amount = Decimal::from_str("10.5").unwrap();
        let rate = Decimal::from_str("7.50").unwrap();
        let result = amount * rate;
        assert_eq!(result.to_string(), "78.75");
    }

    #[test]
    fn test_substrate_planck() {
        let planck = "10000000000";  // 1 DOT
        let dot = SubstrateCurrencyHandler::convert_from_planck(planck, 10).unwrap();
        assert_eq!(dot, "1");
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_end_to_end_transaction() {
    let pool = create_test_pool().await;
    let currency_service = CurrencyService::new(pool.clone());

    // Create transaction
    let tx_id = record_transaction(
        &pool,
        "10.5",
        "DOT",
        "test-profile"
    ).await.unwrap();

    // Verify conversion was stored
    let tx = get_transaction(&pool, &tx_id).await.unwrap();
    assert_eq!(tx.original_amount.unwrap(), "10.5");
    assert_eq!(tx.original_currency.unwrap(), "DOT");
    assert!(tx.converted_amount.is_some());
    assert!(tx.conversion_rate.is_some());
}
```

## Performance Optimization

### 1. Batch API Calls

```rust
// Bad: Multiple API calls
for currency in &["DOT", "KSM", "USDT", "USDC"] {
    let price = client.get_price(currency, "usd").await?;
}

// Good: Single batch call
let prices = client.get_multiple_prices(
    &["polkadot", "kusama", "tether", "usd-coin"],
    "usd"
).await?;
```

### 2. Aggressive Caching

```rust
// Cache strategy:
// - Crypto: 5 minutes
// - Fiat: 24 hours
// - Cleanup stale rates every hour

tokio::spawn(async move {
    loop {
        tokio::time::sleep(Duration::from_secs(3600)).await;
        let _ = currency_service.cleanup_stale_rates().await;
    }
});
```

### 3. Database Indexes

```sql
-- Already created in migrations:
CREATE INDEX idx_exchange_rates_mvp_pair ON exchange_rates_mvp(from_currency, to_currency, timestamp DESC);
CREATE INDEX idx_transactions_currency ON transactions(original_currency);
CREATE INDEX idx_transactions_rate_timestamp ON transactions(rate_timestamp);
```

## Migration from Existing Data

If you have existing transactions without currency fields:

```rust
async fn backfill_currency_data(pool: &Pool<Sqlite>) -> Result<()> {
    // Get all transactions without conversion data
    let transactions = sqlx::query_as::<_, OldTransaction>(
        "SELECT * FROM transactions WHERE original_currency IS NULL"
    )
    .fetch_all(pool)
    .await?;

    for tx in transactions {
        // Get historical rate for transaction date
        let rate = get_historical_rate(
            &tx.token_symbol,
            "USD",
            &tx.timestamp
        ).await?;

        // Calculate converted amount
        let amount = Decimal::from_str(&tx.value)?;
        let rate_decimal = Decimal::from_str(&rate)?;
        let converted = amount * rate_decimal;

        // Update transaction
        sqlx::query(
            r#"
            UPDATE transactions
            SET original_amount = ?,
                original_currency = ?,
                converted_amount = ?,
                conversion_rate = ?,
                rate_timestamp = ?,
                rate_source = 'historical_backfill'
            WHERE id = ?
            "#
        )
        .bind(&tx.value)
        .bind(&tx.token_symbol)
        .bind(converted.to_string())
        .bind(&rate)
        .bind(&tx.timestamp)
        .bind(&tx.id)
        .execute(pool)
        .await?;
    }

    Ok(())
}
```

## Production Checklist

- [ ] API keys configured (CoinGecko, Fixer.io)
- [ ] Rate caching enabled
- [ ] Stale rate cleanup scheduled
- [ ] High-precision decimals throughout
- [ ] Error handling for API failures
- [ ] Fallback rates configured
- [ ] Database indexes created
- [ ] XCM tracking enabled (for Polkadot)
- [ ] Parachain tokens registered
- [ ] All tests passing
- [ ] Performance monitoring enabled

## Next Steps (Phase 2)

After MVP is stable, expand to:
1. Add more cryptocurrencies (ETH, BTC, etc.)
2. Add more fiat currencies
3. Implement real-time price updates (WebSockets)
4. Add price alerts
5. Multi-currency portfolio reports
6. Tax optimization across currencies

## Support

For issues or questions:
- Check logs for API errors
- Verify API keys are valid
- Ensure network connectivity
- Review rate limits
- Check database indexes

## Resources

- CoinGecko API: https://www.coingecko.com/en/api/documentation
- Fixer.io API: https://fixer.io/documentation
- Polkadot.js: https://polkadot.js.org/docs/
- Rust Decimal: https://docs.rs/rust_decimal/
- SQLx: https://docs.rs/sqlx/

---

Last Updated: 2025-10-14
Version: 1.0.0 (MVP)
