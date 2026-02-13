//! Price Feed Commands
//!
//! Tauri commands for fetching cryptocurrency prices from CoinGecko.
//! Used to add USD values to imported transactions.

use super::price_feeds::CoinGeckoClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Response for a single price lookup.
#[derive(Debug, Serialize, Deserialize)]
pub struct PriceResponse {
    /// The CoinGecko coin ID.
    pub coin_id: String,
    /// The price in the requested currency.
    pub price: String,
    /// The currency the price is denominated in.
    pub currency: String,
}

/// Response for a historical price lookup.
#[derive(Debug, Serialize, Deserialize)]
pub struct HistoricalPriceResponse {
    /// The CoinGecko coin ID.
    pub coin_id: String,
    /// The price at the specified date.
    pub price: String,
    /// The currency the price is denominated in.
    pub currency: String,
    /// The date of the price (DD-MM-YYYY format).
    pub date: String,
}

/// Response for batch historical price lookups.
#[derive(Debug, Serialize, Deserialize)]
pub struct BatchHistoricalPriceResponse {
    /// Map of coin_id to price (or error message if failed).
    pub prices: HashMap<String, Result<String, String>>,
    /// The currency the prices are denominated in.
    pub currency: String,
    /// The date of the prices.
    pub date: String,
}

/// Get current price for a cryptocurrency.
///
/// # Arguments
/// * `coin_id` - CoinGecko coin ID (e.g., "polkadot", "kusama", "ethereum")
/// * `vs_currency` - Target currency (e.g., "usd", "eur"). Defaults to "usd".
#[tauri::command]
pub async fn get_crypto_price(
    coin_id: String,
    vs_currency: Option<String>,
) -> Result<PriceResponse, String> {
    let currency = vs_currency.unwrap_or_else(|| "usd".to_string());

    // Load API key from environment if available
    let api_key = std::env::var("COINGECKO_API_KEY").ok();
    let client = CoinGeckoClient::new(api_key);

    let price = client
        .get_price(&coin_id, &currency)
        .await
        .map_err(|e| e.to_string())?;

    Ok(PriceResponse {
        coin_id,
        price,
        currency,
    })
}

/// Get current prices for multiple cryptocurrencies.
///
/// # Arguments
/// * `coin_ids` - List of CoinGecko coin IDs
/// * `vs_currency` - Target currency. Defaults to "usd".
#[tauri::command]
pub async fn get_crypto_prices(
    coin_ids: Vec<String>,
    vs_currency: Option<String>,
) -> Result<HashMap<String, String>, String> {
    let currency = vs_currency.unwrap_or_else(|| "usd".to_string());

    let api_key = std::env::var("COINGECKO_API_KEY").ok();
    let client = CoinGeckoClient::new(api_key);

    let ids: Vec<&str> = coin_ids.iter().map(|s| s.as_str()).collect();
    let prices = client
        .get_multiple_prices(&ids, &currency)
        .await
        .map_err(|e| e.to_string())?;

    Ok(prices)
}

/// Get historical price for a cryptocurrency on a specific date.
///
/// # Arguments
/// * `coin_id` - CoinGecko coin ID (e.g., "polkadot", "kusama")
/// * `date` - Date in DD-MM-YYYY format (CoinGecko's required format)
/// * `vs_currency` - Target currency. Defaults to "usd".
#[tauri::command]
pub async fn get_historical_crypto_price(
    coin_id: String,
    date: String,
    vs_currency: Option<String>,
) -> Result<HistoricalPriceResponse, String> {
    let currency = vs_currency.unwrap_or_else(|| "usd".to_string());

    let api_key = std::env::var("COINGECKO_API_KEY").ok();
    let client = CoinGeckoClient::new(api_key);

    let price = client
        .get_historical_price(&coin_id, &date, &currency)
        .await
        .map_err(|e| e.to_string())?;

    Ok(HistoricalPriceResponse {
        coin_id,
        price,
        currency,
        date,
    })
}

/// Get historical prices for multiple cryptocurrencies on a specific date.
/// This is useful for batch processing transactions from the same day.
///
/// # Arguments
/// * `coin_ids` - List of CoinGecko coin IDs
/// * `date` - Date in DD-MM-YYYY format
/// * `vs_currency` - Target currency. Defaults to "usd".
///
/// Note: CoinGecko's free API has rate limits. This function makes sequential
/// requests with a small delay to avoid hitting rate limits.
#[tauri::command]
pub async fn get_batch_historical_prices(
    coin_ids: Vec<String>,
    date: String,
    vs_currency: Option<String>,
) -> Result<BatchHistoricalPriceResponse, String> {
    let currency = vs_currency.unwrap_or_else(|| "usd".to_string());

    let api_key = std::env::var("COINGECKO_API_KEY").ok();
    let client = CoinGeckoClient::new(api_key);

    let mut prices: HashMap<String, Result<String, String>> = HashMap::new();

    for coin_id in &coin_ids {
        // Add delay between requests to respect rate limits (10-30 calls/min for free tier)
        if !prices.is_empty() {
            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
        }

        match client.get_historical_price(coin_id, &date, &currency).await {
            Ok(price) => {
                prices.insert(coin_id.clone(), Ok(price));
            }
            Err(e) => {
                prices.insert(coin_id.clone(), Err(e.to_string()));
            }
        }
    }

    Ok(BatchHistoricalPriceResponse {
        prices,
        currency,
        date: date.clone(),
    })
}

/// Convert a timestamp to CoinGecko's required date format (DD-MM-YYYY).
///
/// # Arguments
/// * `timestamp_ms` - Unix timestamp in milliseconds
#[tauri::command]
pub fn timestamp_to_coingecko_date(timestamp_ms: i64) -> String {
    use chrono::{TimeZone, Utc};

    let datetime = Utc
        .timestamp_millis_opt(timestamp_ms)
        .single()
        .unwrap_or_else(Utc::now);

    datetime.format("%d-%m-%Y").to_string()
}
