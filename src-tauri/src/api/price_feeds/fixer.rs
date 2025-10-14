use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Fixer.io API client for fiat currency exchange rates
pub struct FixerClient {
    api_key: String,
    base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct FixerResponse {
    success: bool,
    timestamp: Option<i64>,
    base: String,
    date: Option<String>,
    rates: HashMap<String, f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FixerHistoricalResponse {
    success: bool,
    historical: bool,
    date: String,
    timestamp: i64,
    base: String,
    rates: HashMap<String, f64>,
}

impl FixerClient {
    /// Create a new Fixer client
    ///
    /// # Arguments
    /// * `api_key` - Your Fixer.io API key
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://api.fixer.io".to_string(),
        }
    }

    /// Get current exchange rate
    ///
    /// # Arguments
    /// * `from_currency` - Base currency (e.g., "USD")
    /// * `to_currency` - Target currency (e.g., "EUR")
    ///
    /// # Example
    /// ```
    /// let client = FixerClient::new("your_api_key".to_string());
    /// let rate = client.get_rate("USD", "EUR").await?;
    /// ```
    pub async fn get_rate(&self, from_currency: &str, to_currency: &str) -> Result<String> {
        let url = format!(
            "{}/latest?access_key={}&base={}&symbols={}",
            self.base_url,
            self.api_key,
            from_currency.to_uppercase(),
            to_currency.to_uppercase()
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch exchange rate from Fixer.io")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "Fixer.io API error ({}): {}",
                status,
                error_text
            );
        }

        let data: FixerResponse = response
            .json()
            .await
            .context("Failed to parse Fixer.io response")?;

        if !data.success {
            anyhow::bail!("Fixer.io API returned success=false");
        }

        let rate = data
            .rates
            .get(to_currency.to_uppercase().as_str())
            .context(format!(
                "Exchange rate not found for {} to {}",
                from_currency, to_currency
            ))?;

        // Return as string to preserve precision
        Ok(format!("{:.18}", rate))
    }

    /// Get multiple exchange rates at once
    ///
    /// # Arguments
    /// * `base_currency` - Base currency
    /// * `target_currencies` - Vec of target currencies
    pub async fn get_multiple_rates(
        &self,
        base_currency: &str,
        target_currencies: &[&str],
    ) -> Result<HashMap<String, String>> {
        let symbols = target_currencies
            .iter()
            .map(|s| s.to_uppercase())
            .collect::<Vec<_>>()
            .join(",");

        let url = format!(
            "{}/latest?access_key={}&base={}&symbols={}",
            self.base_url,
            self.api_key,
            base_currency.to_uppercase(),
            symbols
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch exchange rates from Fixer.io")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "Fixer.io API error ({}): {}",
                status,
                error_text
            );
        }

        let data: FixerResponse = response
            .json()
            .await
            .context("Failed to parse Fixer.io response")?;

        if !data.success {
            anyhow::bail!("Fixer.io API returned success=false");
        }

        let mut result = HashMap::new();
        for (currency, rate) in data.rates {
            result.insert(currency, format!("{:.18}", rate));
        }

        Ok(result)
    }

    /// Get historical exchange rate for a specific date
    ///
    /// # Arguments
    /// * `from_currency` - Base currency
    /// * `to_currency` - Target currency
    /// * `date` - Date in format "YYYY-MM-DD"
    ///
    /// # Example
    /// ```
    /// let rate = client.get_historical_rate("USD", "EUR", "2025-01-01").await?;
    /// ```
    pub async fn get_historical_rate(
        &self,
        from_currency: &str,
        to_currency: &str,
        date: &str,
    ) -> Result<String> {
        let url = format!(
            "{}/{}?access_key={}&base={}&symbols={}",
            self.base_url,
            date,
            self.api_key,
            from_currency.to_uppercase(),
            to_currency.to_uppercase()
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch historical rate from Fixer.io")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "Fixer.io API error ({}): {}",
                status,
                error_text
            );
        }

        let data: FixerHistoricalResponse = response
            .json()
            .await
            .context("Failed to parse Fixer.io historical response")?;

        if !data.success {
            anyhow::bail!("Fixer.io API returned success=false");
        }

        let rate = data
            .rates
            .get(to_currency.to_uppercase().as_str())
            .context(format!(
                "Historical rate not found for {} to {} on {}",
                from_currency, to_currency, date
            ))?;

        Ok(format!("{:.18}", rate))
    }

    /// Get all available currencies
    pub async fn get_supported_currencies(&self) -> Result<Vec<String>> {
        let url = format!(
            "{}/symbols?access_key={}",
            self.base_url, self.api_key
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch supported currencies")?;

        #[derive(Deserialize)]
        struct SymbolsResponse {
            success: bool,
            symbols: HashMap<String, String>,
        }

        let data: SymbolsResponse = response
            .json()
            .await
            .context("Failed to parse symbols response")?;

        if !data.success {
            anyhow::bail!("Fixer.io API returned success=false");
        }

        Ok(data.symbols.keys().cloned().collect())
    }

    /// Convert amount from one currency to another
    ///
    /// # Arguments
    /// * `from_currency` - Base currency
    /// * `to_currency` - Target currency
    /// * `amount` - Amount to convert
    pub async fn convert(
        &self,
        from_currency: &str,
        to_currency: &str,
        amount: &str,
    ) -> Result<String> {
        let rate = self.get_rate(from_currency, to_currency).await?;

        // Use rust_decimal for precise calculation
        use rust_decimal::Decimal;
        use std::str::FromStr;

        let amount_decimal = Decimal::from_str(amount)
            .context("Failed to parse amount")?;
        let rate_decimal = Decimal::from_str(&rate)
            .context("Failed to parse rate")?;

        let result = amount_decimal * rate_decimal;
        Ok(result.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static FIXER_API_KEY: &str = "FIXER_API_KEY";

    #[tokio::test]
    #[ignore] // Requires API key and internet connection
    async fn test_get_rate() {
        let api_key = std::env::var(FIXER_API_KEY)
            .expect("FIXER_API_KEY environment variable not set");

        let client = FixerClient::new(api_key);
        let rate = client.get_rate("USD", "EUR").await;
        assert!(rate.is_ok());
        println!("USD to EUR rate: {}", rate.unwrap());
    }

    #[tokio::test]
    #[ignore] // Requires API key and internet connection
    async fn test_get_multiple_rates() {
        let api_key = std::env::var(FIXER_API_KEY)
            .expect("FIXER_API_KEY environment variable not set");

        let client = FixerClient::new(api_key);
        let rates = client
            .get_multiple_rates("USD", &["EUR", "GBP"])
            .await;
        assert!(rates.is_ok());
        let rates = rates.unwrap();
        println!("Rates: {:?}", rates);
        assert!(rates.contains_key("EUR"));
        assert!(rates.contains_key("GBP"));
    }
}
