#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Currency type enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum CurrencyType {
    /// Represents fiat currencies such as USD, EUR, etc.
    #[serde(rename = "fiat")]
    Fiat,
    /// Represents cryptocurrencies such as Bitcoin, Ethereum, etc.
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
    /// Unique identifier for the currency.
    pub id: String,
    /// Currency code, e.g., "USD" or "BTC".
    pub code: String,
    /// Full name of the currency.
    pub name: String,
    /// Type of the currency (fiat or crypto).
    #[sqlx(rename = "type")]
    pub currency_type: CurrencyType,
    /// Number of decimal places supported by the currency.
    pub decimals: i32,
    /// Indicates if the currency is currently supported.
    pub is_supported: bool,
    /// Optional CoinGecko API identifier for the currency.
    pub coingecko_id: Option<String>,
    /// Optional Fixer API identifier for the currency.
    pub fixer_id: Option<String>,
    /// Optional currency symbol, e.g., "$" or "₿".
    pub symbol: Option<String>,
    /// Optional URL to the currency icon.
    pub icon_url: Option<String>,
    /// Timestamp when the currency record was created.
    pub created_at: String,
    /// Timestamp when the currency record was last updated.
    pub updated_at: String,
}

/// Exchange rate source enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum ExchangeRateSource {
    /// Rate sourced from the CoinGecko API.
    #[serde(rename = "coingecko")]
    CoinGecko,
    /// Rate sourced from the Fixer API.
    #[serde(rename = "fixer")]
    Fixer,
    /// Manually entered exchange rate.
    #[serde(rename = "manual")]
    Manual,
    /// Exchange rate from Compound protocol.
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
    /// Unique identifier for the exchange rate entry.
    pub id: String,
    /// Source currency code.
    pub from_currency: String,
    /// Target currency code.
    pub to_currency: String,
    /// Conversion rate stored as a string to preserve precision.
    pub rate: String,
    /// Timestamp when the rate was recorded.
    pub timestamp: String,
    /// Source of the exchange rate.
    pub source: ExchangeRateSource,
    /// Time-to-live for the rate in seconds.
    pub ttl_seconds: i32,
    /// Optional metadata for the exchange rate entry.
    pub metadata: Option<String>,
    /// Timestamp when the exchange rate record was created.
    pub created_at: String,
    /// Timestamp when the exchange rate record was last updated.
    pub updated_at: String,
}

/// Conversion method enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum ConversionMethod {
    /// Spot conversion method using current market rate.
    #[serde(rename = "spot")]
    Spot,
    /// Historical conversion method using rates at transaction time.
    #[serde(rename = "historical")]
    Historical,
    /// Fixed conversion method using a predetermined rate.
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
    /// Display currency by symbol, e.g., "$".
    #[serde(rename = "symbol")]
    Symbol,
    /// Display currency by code, e.g., "USD".
    #[serde(rename = "code")]
    Code,
    /// Display currency by full name, e.g., "US Dollar".
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
    /// Unique identifier for the account settings entry.
    pub id: String,
    /// Profile identifier associated with these settings.
    pub profile_id: String,
    /// Primary currency code for the account.
    pub primary_currency: String,
    /// Optional comma-separated list of reporting currency codes.
    pub reporting_currencies: Option<String>,
    /// Preferred conversion method for currency values.
    pub conversion_method: ConversionMethod,
    /// Number of decimal places to display.
    pub decimal_places: i32,
    /// Whether to use a thousands separator in formatted output.
    pub use_thousands_separator: bool,
    /// Preferred format for displaying currency values.
    pub currency_display_format: CurrencyDisplayFormat,
    /// Whether to automatically convert currencies for display.
    pub auto_convert: bool,
    /// Whether to cache exchange rate responses.
    pub cache_exchange_rates: bool,
    /// Optional API key for CoinGecko.
    pub coingecko_api_key: Option<String>,
    /// Optional API key for Fixer.
    pub fixer_api_key: Option<String>,
    /// Timestamp when the account settings were created.
    pub created_at: String,
    /// Timestamp when the account settings were last updated.
    pub updated_at: String,
}

impl AccountSettings {
    /// Parse reporting currencies from a comma-separated string into a vector.
    pub fn get_reporting_currencies(&self) -> Vec<String> {
        self.reporting_currencies
            .as_ref()
            .map(|s| s.split(',').map(|c| c.trim().to_string()).collect())
            .unwrap_or_default()
    }

    /// Set reporting currencies from a vector of currency codes.
    pub fn set_reporting_currencies(&mut self, currencies: Vec<String>) {
        self.reporting_currencies = if currencies.is_empty() {
            None
        } else {
            Some(currencies.join(","))
        };
    }
}

/// Enhanced transaction structure with currency conversion fields
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TransactionWithConversion {
    /// Unique transaction identifier.
    pub id: String,
    /// Profile identifier associated with the transaction.
    pub profile_id: String,
    /// Blockchain network or chain name.
    pub chain: String,
    /// Transaction hash value.
    pub hash: String,
    /// Block number where the transaction was recorded.
    pub block_number: i64,
    /// Timestamp when the transaction occurred.
    pub timestamp: String,
    /// Sender address of the transaction.
    pub from_address: String,
    /// Optional recipient address of the transaction.
    pub to_address: Option<String>,
    /// Transaction value as a string.
    pub value: String,
    /// Token symbol involved in the transaction.
    pub token_symbol: String,
    /// Number of decimals for the token.
    pub token_decimals: i32,
    /// Type of the transaction (e.g., transfer, trade).
    pub transaction_type: String,
    /// Status of the transaction (e.g., pending, confirmed).
    pub status: String,
    /// Optional transaction fee as a string.
    pub fee: Option<String>,
    /// Optional metadata associated with the transaction.
    pub metadata: Option<String>,
    /// Optional converted primary amount after currency conversion.
    pub amount_primary: Option<String>,
    /// Optional primary currency code after conversion.
    pub primary_currency: Option<String>,
    /// Optional exchange rate used for conversion.
    pub exchange_rate: Option<String>,
    /// Optional source of the exchange rate.
    pub exchange_rate_source: Option<String>,
    /// Optional timestamp when exchange rate was applied.
    pub exchange_rate_timestamp: Option<String>,
    /// Timestamp when the transaction record was created.
    pub created_at: String,
    /// Timestamp when the transaction record was last updated.
    pub updated_at: String,
}

/// Helper struct for currency conversion calculations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyConversion {
    /// Source currency code for conversion.
    pub from_currency: String,
    /// Target currency code for conversion.
    pub to_currency: String,
    /// Original amount to be converted, as a string.
    pub amount: String,
    /// Converted amount as a string.
    pub converted_amount: String,
    /// Exchange rate applied during conversion.
    pub exchange_rate: String,
    /// Timestamp when the conversion occurred.
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
