use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// CoinGecko API client for cryptocurrency price feeds
pub struct CoinGeckoClient {
    api_key: Option<String>,
    base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CoinGeckoPriceResponse {
    #[serde(flatten)]
    prices: HashMap<String, HashMap<String, f64>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CoinGeckoHistoricalResponse {
    market_data: MarketData,
}

#[derive(Debug, Serialize, Deserialize)]
struct MarketData {
    current_price: HashMap<String, f64>,
}

impl CoinGeckoClient {
    /// Create a new CoinGecko client
    pub fn new(api_key: Option<String>) -> Self {
        let base_url = if api_key.is_some() {
            "https://pro-api.coingecko.com/api/v3".to_string()
        } else {
            "https://api.coingecko.com/api/v3".to_string()
        };

        Self { api_key, base_url }
    }

    /// Get current price for a cryptocurrency
    ///
    /// # Arguments
    /// * `coin_id` - CoinGecko coin ID (e.g., "polkadot", "kusama")
    /// * `vs_currency` - Target currency (e.g., "usd", "eur")
    ///
    /// # Example
    /// ```
    /// let client = CoinGeckoClient::new(None);
    /// let price = client.get_price("polkadot", "usd").await?;
    /// ```
    pub async fn get_price(&self, coin_id: &str, vs_currency: &str) -> Result<String> {
        let url = format!(
            "{}/simple/price?ids={}&vs_currencies={}",
            self.base_url,
            coin_id,
            vs_currency.to_lowercase()
        );

        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(key) = &self.api_key {
            headers.insert(
                "x-cg-pro-api-key",
                reqwest::header::HeaderValue::from_str(key)?,
            );
        }

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .context("Failed to fetch price from CoinGecko")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("CoinGecko API error ({}): {}", status, error_text);
        }

        let data: CoinGeckoPriceResponse = response
            .json()
            .await
            .context("Failed to parse CoinGecko response")?;

        let price = data
            .prices
            .get(coin_id)
            .and_then(|prices| prices.get(vs_currency.to_lowercase().as_str()))
            .context(format!(
                "Price not found for {} in {}",
                coin_id, vs_currency
            ))?;

        // Return as string to preserve precision
        Ok(format!("{:.18}", price))
    }

    /// Get prices for multiple cryptocurrencies at once
    ///
    /// # Arguments
    /// * `coin_ids` - Vec of CoinGecko coin IDs
    /// * `vs_currency` - Target currency
    pub async fn get_multiple_prices(
        &self,
        coin_ids: &[&str],
        vs_currency: &str,
    ) -> Result<HashMap<String, String>> {
        let ids = coin_ids.join(",");
        let url = format!(
            "{}/simple/price?ids={}&vs_currencies={}",
            self.base_url,
            ids,
            vs_currency.to_lowercase()
        );

        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(key) = &self.api_key {
            headers.insert(
                "x-cg-pro-api-key",
                reqwest::header::HeaderValue::from_str(key)?,
            );
        }

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .context("Failed to fetch prices from CoinGecko")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("CoinGecko API error ({}): {}", status, error_text);
        }

        let data: CoinGeckoPriceResponse = response
            .json()
            .await
            .context("Failed to parse CoinGecko response")?;

        let mut result = HashMap::new();
        for coin_id in coin_ids {
            if let Some(prices) = data.prices.get(*coin_id) {
                if let Some(price) = prices.get(vs_currency.to_lowercase().as_str()) {
                    result.insert(coin_id.to_string(), format!("{:.18}", price));
                }
            }
        }

        Ok(result)
    }

    /// Get historical price for a specific date
    ///
    /// # Arguments
    /// * `coin_id` - CoinGecko coin ID
    /// * `date` - Date in format "DD-MM-YYYY"
    /// * `vs_currency` - Target currency
    pub async fn get_historical_price(
        &self,
        coin_id: &str,
        date: &str,
        vs_currency: &str,
    ) -> Result<String> {
        let url = format!(
            "{}/coins/{}/history?date={}&localization=false",
            self.base_url, coin_id, date
        );

        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(key) = &self.api_key {
            headers.insert(
                "x-cg-pro-api-key",
                reqwest::header::HeaderValue::from_str(key)?,
            );
        }

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .context("Failed to fetch historical price from CoinGecko")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("CoinGecko API error ({}): {}", status, error_text);
        }

        let data: CoinGeckoHistoricalResponse = response
            .json()
            .await
            .context("Failed to parse CoinGecko historical response")?;

        let price = data
            .market_data
            .current_price
            .get(vs_currency.to_lowercase().as_str())
            .context(format!(
                "Historical price not found for {} in {} on {}",
                coin_id, vs_currency, date
            ))?;

        Ok(format!("{:.18}", price))
    }

    /// Get supported vs currencies
    #[allow(dead_code)]
    pub async fn get_supported_currencies(&self) -> Result<Vec<String>> {
        let url = format!("{}/simple/supported_vs_currencies", self.base_url);

        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(key) = &self.api_key {
            headers.insert(
                "x-cg-pro-api-key",
                reqwest::header::HeaderValue::from_str(key)?,
            );
        }

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .context("Failed to fetch supported currencies")?;

        let currencies: Vec<String> = response
            .json()
            .await
            .context("Failed to parse supported currencies")?;

        Ok(currencies)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires internet connection
    async fn test_get_price() {
        let client = CoinGeckoClient::new(None);
        let price = client.get_price("polkadot", "usd").await;
        assert!(price.is_ok());
        println!("DOT price: ${}", price.unwrap());
    }

    #[tokio::test]
    #[ignore] // Requires internet connection
    async fn test_get_multiple_prices() {
        let client = CoinGeckoClient::new(None);
        let prices = client
            .get_multiple_prices(&["polkadot", "kusama"], "usd")
            .await;
        assert!(prices.is_ok());
        let prices = prices.unwrap();
        println!("Prices: {:?}", prices);
        assert!(prices.contains_key("polkadot"));
        assert!(prices.contains_key("kusama"));
    }
}
