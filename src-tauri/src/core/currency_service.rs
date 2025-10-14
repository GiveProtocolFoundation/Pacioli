use anyhow::{Context, Result};
use rust_decimal::Decimal;
use sqlx::{Pool, Sqlite};
use std::str::FromStr;

use super::currency::{
    AccountSettings, ConversionMethod, Currency, CurrencyConversion, ExchangeRate,
    ExchangeRateSource, TransactionWithConversion,
};

/// Currency Service for database operations and conversions
pub struct CurrencyService {
    pool: Pool<Sqlite>,
}

impl CurrencyService {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Get all supported currencies
    pub async fn get_all_currencies(&self) -> Result<Vec<Currency>> {
        let currencies = sqlx::query_as::<_, Currency>("SELECT * FROM currencies WHERE is_supported = 1 ORDER BY code")
            .fetch_all(&self.pool)
            .await
            .context("Failed to fetch currencies")?;

        Ok(currencies)
    }

    /// Get currency by code
    pub async fn get_currency(&self, code: &str) -> Result<Option<Currency>> {
        let currency = sqlx::query_as::<_, Currency>("SELECT * FROM currencies WHERE code = ?")
            .bind(code)
            .fetch_optional(&self.pool)
            .await
            .context("Failed to fetch currency")?;

        Ok(currency)
    }

    /// Get currencies by type
    pub async fn get_currencies_by_type(&self, currency_type: &str) -> Result<Vec<Currency>> {
        let currencies = sqlx::query_as::<_, Currency>(
            "SELECT * FROM currencies WHERE type = ? AND is_supported = 1 ORDER BY code",
        )
        .bind(currency_type)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch currencies by type")?;

        Ok(currencies)
    }

    /// Get account settings for a profile
    pub async fn get_account_settings(&self, profile_id: &str) -> Result<Option<AccountSettings>> {
        let settings = sqlx::query_as::<_, AccountSettings>(
            "SELECT * FROM account_settings WHERE profile_id = ?",
        )
        .bind(profile_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch account settings")?;

        Ok(settings)
    }

    /// Update account settings
    pub async fn update_account_settings(&self, settings: &AccountSettings) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO account_settings (
                id, profile_id, primary_currency, reporting_currencies, conversion_method,
                decimal_places, use_thousands_separator, currency_display_format,
                auto_convert, cache_exchange_rates, coingecko_api_key, fixer_api_key,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(profile_id) DO UPDATE SET
                primary_currency = excluded.primary_currency,
                reporting_currencies = excluded.reporting_currencies,
                conversion_method = excluded.conversion_method,
                decimal_places = excluded.decimal_places,
                use_thousands_separator = excluded.use_thousands_separator,
                currency_display_format = excluded.currency_display_format,
                auto_convert = excluded.auto_convert,
                cache_exchange_rates = excluded.cache_exchange_rates,
                coingecko_api_key = excluded.coingecko_api_key,
                fixer_api_key = excluded.fixer_api_key,
                updated_at = datetime('now')
            "#,
        )
        .bind(&settings.id)
        .bind(&settings.profile_id)
        .bind(&settings.primary_currency)
        .bind(&settings.reporting_currencies)
        .bind(settings.conversion_method.to_string())
        .bind(settings.decimal_places)
        .bind(settings.use_thousands_separator)
        .bind(settings.currency_display_format.to_string())
        .bind(settings.auto_convert)
        .bind(settings.cache_exchange_rates)
        .bind(&settings.coingecko_api_key)
        .bind(&settings.fixer_api_key)
        .execute(&self.pool)
        .await
        .context("Failed to update account settings")?;

        Ok(())
    }

    /// Get exchange rate from cache
    pub async fn get_cached_exchange_rate(
        &self,
        from_currency: &str,
        to_currency: &str,
    ) -> Result<Option<ExchangeRate>> {
        // Get the most recent rate that's still valid
        let rate = sqlx::query_as::<_, ExchangeRate>(
            r#"
            SELECT * FROM exchange_rates
            WHERE from_currency = ? AND to_currency = ?
            AND (unixepoch('now') - unixepoch(timestamp)) <= ttl_seconds
            ORDER BY timestamp DESC
            LIMIT 1
            "#,
        )
        .bind(from_currency)
        .bind(to_currency)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch exchange rate")?;

        Ok(rate)
    }

    /// Cache exchange rate
    pub async fn cache_exchange_rate(&self, rate: &ExchangeRate) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO exchange_rates (
                id, from_currency, to_currency, rate, timestamp, source,
                ttl_seconds, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#,
        )
        .bind(&rate.id)
        .bind(&rate.from_currency)
        .bind(&rate.to_currency)
        .bind(&rate.rate)
        .bind(&rate.timestamp)
        .bind(rate.source.to_string())
        .bind(rate.ttl_seconds)
        .bind(&rate.metadata)
        .execute(&self.pool)
        .await
        .context("Failed to cache exchange rate")?;

        Ok(())
    }

    /// Convert amount from one currency to another
    pub async fn convert(
        &self,
        from_currency: &str,
        to_currency: &str,
        amount: &str,
        timestamp: Option<&str>,
        method: Option<ConversionMethod>,
    ) -> Result<CurrencyConversion> {
        // If same currency, no conversion needed
        if from_currency == to_currency {
            return Ok(CurrencyConversion {
                from_currency: from_currency.to_string(),
                to_currency: to_currency.to_string(),
                amount: amount.to_string(),
                converted_amount: amount.to_string(),
                exchange_rate: "1.0".to_string(),
                timestamp: timestamp.unwrap_or("").to_string(),
            });
        }

        let use_historical = method == Some(ConversionMethod::Historical);

        // Try to get cached rate if not using historical
        let exchange_rate = if !use_historical {
            self.get_cached_exchange_rate(from_currency, to_currency)
                .await?
        } else {
            // For historical rates, fetch from database based on timestamp
            // This would need a more sophisticated query
            None
        };

        let rate_value = if let Some(rate) = exchange_rate {
            Decimal::from_str(&rate.rate).context("Failed to parse exchange rate")?
        } else {
            // If no cached rate, would need to fetch from external API
            // For now, return an error
            anyhow::bail!("Exchange rate not available for {}/{}", from_currency, to_currency);
        };

        let amount_decimal = Decimal::from_str(amount).context("Failed to parse amount")?;
        let converted = amount_decimal * rate_value;

        Ok(CurrencyConversion {
            from_currency: from_currency.to_string(),
            to_currency: to_currency.to_string(),
            amount: amount.to_string(),
            converted_amount: converted.to_string(),
            exchange_rate: rate_value.to_string(),
            timestamp: timestamp.unwrap_or("").to_string(),
        })
    }

    /// Update transaction with currency conversion
    pub async fn update_transaction_conversion(
        &self,
        transaction_id: &str,
        amount_primary: &str,
        primary_currency: &str,
        exchange_rate: &str,
        exchange_rate_source: &str,
        exchange_rate_timestamp: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE transactions
            SET
                amount_primary = ?,
                primary_currency = ?,
                exchange_rate = ?,
                exchange_rate_source = ?,
                exchange_rate_timestamp = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(amount_primary)
        .bind(primary_currency)
        .bind(exchange_rate)
        .bind(exchange_rate_source)
        .bind(exchange_rate_timestamp)
        .bind(transaction_id)
        .execute(&self.pool)
        .await
        .context("Failed to update transaction conversion")?;

        Ok(())
    }

    /// Get transactions with conversions
    pub async fn get_transactions_with_conversions(
        &self,
        profile_id: &str,
        limit: i64,
    ) -> Result<Vec<TransactionWithConversion>> {
        let transactions = sqlx::query_as::<_, TransactionWithConversion>(
            r#"
            SELECT * FROM transactions
            WHERE profile_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            "#,
        )
        .bind(profile_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch transactions with conversions")?;

        Ok(transactions)
    }

    /// Clean up stale exchange rates
    pub async fn cleanup_stale_rates(&self) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM exchange_rates
            WHERE (unixepoch('now') - unixepoch(timestamp)) > ttl_seconds
            "#,
        )
        .execute(&self.pool)
        .await
        .context("Failed to cleanup stale rates")?;

        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Add tests here when ready
}
