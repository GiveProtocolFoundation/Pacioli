#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Currency type enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum CurrencyType {
    #[serde(rename = "fiat")]
    Fiat,
    #[serde(rename = "crypto")]
    Crypto,
}

impl std::fmt::Display for CurrencyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CurrencyType::Fiat => write!(f, "fiat"),
            CurrencyType::Crypto => write!(f, "crypto"),
        }
    }
}

/// Currency model representing a supported currency
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Currency {
    pub id: String,
    pub code: String,
    pub name: String,
    #[sqlx(rename = "type")]
    pub currency_type: CurrencyType,
    pub decimals: i32,
    pub is_supported: bool,
    pub coingecko_id: Option<String>,
    pub fixer_id: Option<String>,
    pub symbol: Option<String>,
    pub icon_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Exchange rate source enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum ExchangeRateSource {
    #[serde(rename = "coingecko")]
    CoinGecko,
    #[serde(rename = "fixer")]
    Fixer,
    #[serde(rename = "manual")]
    Manual,
    #[serde(rename = "compound")]
    Compound,
}

impl std::fmt::Display for ExchangeRateSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExchangeRateSource::CoinGecko => write!(f, "coingecko"),
            ExchangeRateSource::Fixer => write!(f, "fixer"),
            ExchangeRateSource::Manual => write!(f, "manual"),
            ExchangeRateSource::Compound => write!(f, "compound"),
        }
    }
}

/// Exchange rate model for currency conversions
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExchangeRate {
    pub id: String,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: String, // Stored as string to preserve precision
    pub timestamp: String,
    pub source: ExchangeRateSource,
    pub ttl_seconds: i32,
    pub metadata: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Conversion method enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum ConversionMethod {
    #[serde(rename = "spot")]
    Spot,
    #[serde(rename = "historical")]
    Historical,
    #[serde(rename = "fixed")]
    Fixed,
}

impl std::fmt::Display for ConversionMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConversionMethod::Spot => write!(f, "spot"),
            ConversionMethod::Historical => write!(f, "historical"),
            ConversionMethod::Fixed => write!(f, "fixed"),
        }
    }
}

/// Currency display format enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum CurrencyDisplayFormat {
    #[serde(rename = "symbol")]
    Symbol,
    #[serde(rename = "code")]
    Code,
    #[serde(rename = "name")]
    Name,
}

impl std::fmt::Display for CurrencyDisplayFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CurrencyDisplayFormat::Symbol => write!(f, "symbol"),
            CurrencyDisplayFormat::Code => write!(f, "code"),
            CurrencyDisplayFormat::Name => write!(f, "name"),
        }
    }
}

/// Account settings for currency preferences
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AccountSettings {
    pub id: String,
    pub profile_id: String,
    pub primary_currency: String,
    pub reporting_currencies: Option<String>, // Comma-separated list
    pub conversion_method: ConversionMethod,
    pub decimal_places: i32,
    pub use_thousands_separator: bool,
    pub currency_display_format: CurrencyDisplayFormat,
    pub auto_convert: bool,
    pub cache_exchange_rates: bool,
    pub coingecko_api_key: Option<String>,
    pub fixer_api_key: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl AccountSettings {
    /// Parse reporting currencies from comma-separated string
    pub fn get_reporting_currencies(&self) -> Vec<String> {
        self.reporting_currencies
            .as_ref()
            .map(|s| s.split(',').map(|c| c.trim().to_string()).collect())
            .unwrap_or_default()
    }

    /// Set reporting currencies from a vector
    pub fn set_reporting_currencies(&mut self, currencies: Vec<String>) {
        self.reporting_currencies = if currencies.is_empty() {
            None
        } else {
            Some(currencies.join(","))
        };
    }
}

/// Enhanced transaction structure with currency conversion
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TransactionWithConversion {
    pub id: String,
    pub profile_id: String,
    pub chain: String,
    pub hash: String,
    pub block_number: i64,
    pub timestamp: String,
    pub from_address: String,
    pub to_address: Option<String>,
    pub value: String,
    pub token_symbol: String,
    pub token_decimals: i32,
    pub transaction_type: String,
    pub status: String,
    pub fee: Option<String>,
    pub metadata: Option<String>,
    // Currency conversion fields
    pub amount_primary: Option<String>,
    pub primary_currency: Option<String>,
    pub exchange_rate: Option<String>,
    pub exchange_rate_source: Option<String>,
    pub exchange_rate_timestamp: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Helper struct for currency conversion calculations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyConversion {
    pub from_currency: String,
    pub to_currency: String,
    pub amount: String,
    pub converted_amount: String,
    pub exchange_rate: String,
    pub timestamp: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_settings_reporting_currencies() {
        let mut settings = AccountSettings {
            id: "test-1".to_string(),
            profile_id: "profile-1".to_string(),
            primary_currency: "USD".to_string(),
            reporting_currencies: Some("EUR,GBP,JPY".to_string()),
            conversion_method: ConversionMethod::Historical,
            decimal_places: 2,
            use_thousands_separator: true,
            currency_display_format: CurrencyDisplayFormat::Symbol,
            auto_convert: true,
            cache_exchange_rates: true,
            coingecko_api_key: None,
            fixer_api_key: None,
            created_at: "2025-01-01".to_string(),
            updated_at: "2025-01-01".to_string(),
        };

        let currencies = settings.get_reporting_currencies();
        assert_eq!(currencies, vec!["EUR", "GBP", "JPY"]);

        settings.set_reporting_currencies(vec!["CAD".to_string(), "AUD".to_string()]);
        assert_eq!(settings.reporting_currencies, Some("CAD,AUD".to_string()));
    }
}
