//! Resilient Fetcher System
//!
//! Implements the "Batteries Included, Turbo Optional" pattern for blockchain data fetching.
//!
//! # Architecture
//!
//! - **Default Mode**: Works out of the box with conservative rate limiting (no API key required)
//! - **Turbo Mode**: Users provide their own API keys in Settings to unlock higher rate limits
//!
//! # Components
//!
//! - `ResilientFetcher`: Core fetcher with Governor rate limiting and retry middleware
//! - `ApiKeyManager`: Secure API key storage using OS keychain
//! - `NormalizedTx`: Universal transaction model across all chains

// Allow dead code for infrastructure components not yet integrated
#![allow(dead_code)]

pub mod api_keys;
pub mod commands;

use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use governor::{
    clock::DefaultClock,
    middleware::NoOpMiddleware,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use reqwest::Client;
use reqwest_middleware::{ClientBuilder, ClientWithMiddleware};
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use api_keys::{ApiKeyManager, ApiProvider};

// =============================================================================
// TYPES
// =============================================================================

/// Governor rate limiter type alias for clarity.
pub type GovernorLimiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock, NoOpMiddleware>;

/// Errors that can occur during fetch operations.
#[derive(Debug, Error)]
pub enum FetchError {
    /// HTTP request failed.
    #[error("HTTP error: {0}")]
    HttpError(String),

    /// Rate limited by the API.
    #[error("Rate limited")]
    RateLimited,

    /// Failed to parse response.
    #[error("Parse error: {0}")]
    ParseError(String),

    /// API returned an error.
    #[error("API error: {0}")]
    ApiError(String),

    /// Invalid configuration.
    #[error("Config error: {0}")]
    ConfigError(String),

    /// Request timeout.
    #[error("Request timeout")]
    Timeout,
}

/// Result type for fetch operations.
pub type FetchResult<T> = Result<T, FetchError>;

// =============================================================================
// NORMALIZED TRANSACTION MODEL
// =============================================================================

/// Universal transaction representation across all blockchain types.
///
/// This model normalizes transaction data from different chains (EVM, Substrate, Bitcoin)
/// into a common format for consistent storage and display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedTx {
    /// Transaction hash (unique identifier).
    pub tx_hash: String,

    /// Block number containing this transaction.
    pub block_number: u64,

    /// Unix timestamp of the transaction.
    pub timestamp: i64,

    /// Sender address.
    pub from_address: String,

    /// Recipient address.
    pub to_address: String,

    /// Transaction amount (stored as String to preserve precision).
    pub amount: String,

    /// Transaction fee (stored as String to preserve precision).
    pub fee: String,

    /// Chain identifier (e.g., "ethereum", "polkadot", "bitcoin").
    pub chain: String,

    /// Transaction status.
    pub status: TxStatus,

    /// Transaction type classification.
    pub tx_type: TxType,

    /// Native currency symbol (e.g., "ETH", "DOT", "BTC").
    pub symbol: String,

    /// Number of decimals for the native currency.
    pub decimals: u8,

    /// Optional token transfers within this transaction.
    #[serde(default)]
    pub token_transfers: Vec<TokenTransfer>,

    /// Raw JSON data for audit/debugging purposes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_json: Option<serde_json::Value>,
}

/// Transaction status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TxStatus {
    /// Transaction succeeded.
    Success,
    /// Transaction failed.
    Failed,
    /// Transaction is pending confirmation.
    Pending,
}

/// Transaction type classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TxType {
    /// Simple value transfer.
    Transfer,
    /// Token swap on DEX.
    Swap,
    /// Cross-chain bridge.
    Bridge,
    /// Staking deposit.
    Stake,
    /// Staking withdrawal.
    Unstake,
    /// Reward claim.
    Claim,
    /// Token mint.
    Mint,
    /// Token burn.
    Burn,
    /// Token approval.
    Approve,
    /// Smart contract interaction.
    ContractCall,
    /// Unknown transaction type.
    Unknown,
}

/// Token transfer within a transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransfer {
    /// Token contract address.
    pub contract_address: String,
    /// Token symbol.
    pub symbol: String,
    /// Token name.
    pub name: Option<String>,
    /// Token decimals.
    pub decimals: u8,
    /// Sender address.
    pub from: String,
    /// Recipient address.
    pub to: String,
    /// Transfer amount (as String for precision).
    pub amount: String,
}

// =============================================================================
// RESILIENT FETCHER
// =============================================================================

/// Configuration for creating a ResilientFetcher.
#[derive(Debug, Clone)]
pub struct FetcherConfig {
    /// Base URL for the API.
    pub base_url: String,
    /// Optional API key (enables Turbo Mode).
    pub api_key: Option<String>,
    /// Requests per second (auto-configured based on API key).
    pub requests_per_second: u32,
    /// Request timeout in seconds.
    pub timeout_secs: u64,
    /// Maximum retry attempts.
    pub max_retries: u32,
}

impl FetcherConfig {
    /// Create a new configuration for a provider.
    ///
    /// Automatically sets rate limit based on API key presence.
    pub fn for_provider(provider: ApiProvider, base_url: impl Into<String>) -> Self {
        let api_key = ApiKeyManager::get_api_key(provider).ok().flatten();
        let requests_per_second = if api_key.is_some() {
            provider.turbo_rate_limit()
        } else {
            provider.default_rate_limit()
        };

        Self {
            base_url: base_url.into(),
            api_key,
            requests_per_second,
            timeout_secs: 30,
            max_retries: 3,
        }
    }

    /// Create with explicit rate limit.
    pub fn with_rate_limit(mut self, requests_per_second: u32) -> Self {
        self.requests_per_second = requests_per_second;
        self
    }

    /// Create with custom timeout.
    pub fn with_timeout(mut self, timeout_secs: u64) -> Self {
        self.timeout_secs = timeout_secs;
        self
    }

    /// Create with custom retry count.
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }
}

/// Resilient HTTP fetcher with rate limiting and automatic retries.
///
/// Uses Governor (GCRA/leaky bucket) for proactive rate limiting to prevent 429 errors,
/// and reqwest-retry middleware for handling transient failures with exponential backoff.
///
/// # Example
///
/// ```ignore
/// let fetcher = ResilientFetcher::new(FetcherConfig::for_provider(
///     ApiProvider::Etherscan,
///     "https://api.etherscan.io/api",
/// ))?;
///
/// // Rate limiter automatically throttles requests
/// let response = fetcher.get("/endpoint").await?;
/// ```
pub struct ResilientFetcher {
    /// Governor rate limiter (GCRA algorithm).
    limiter: Arc<GovernorLimiter>,
    /// HTTP client with retry middleware.
    client: ClientWithMiddleware,
    /// Base URL for API requests.
    base_url: String,
    /// Optional API key.
    api_key: Option<String>,
    /// Current rate limit (for display/logging).
    requests_per_second: u32,
}

impl ResilientFetcher {
    /// Create a new ResilientFetcher with the given configuration.
    pub fn new(config: FetcherConfig) -> FetchResult<Self> {
        // Validate rate limit
        let rps = NonZeroU32::new(config.requests_per_second)
            .ok_or_else(|| FetchError::ConfigError("Rate limit must be > 0".to_string()))?;

        // Initialize Governor with GCRA quota
        let quota = Quota::per_second(rps);
        let limiter = Arc::new(RateLimiter::direct(quota));

        // Initialize reqwest client with timeout
        let raw_client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .map_err(|e| FetchError::ConfigError(format!("Failed to create HTTP client: {}", e)))?;

        // Wrap with retry middleware (exponential backoff)
        let retry_policy = ExponentialBackoff::builder()
            .retry_bounds(
                Duration::from_millis(100),  // Min retry delay
                Duration::from_secs(10),     // Max retry delay
            )
            .build_with_max_retries(config.max_retries);

        let client = ClientBuilder::new(raw_client)
            .with(RetryTransientMiddleware::new_with_policy(retry_policy))
            .build();

        Ok(Self {
            limiter,
            client,
            base_url: config.base_url,
            api_key: config.api_key,
            requests_per_second: config.requests_per_second,
        })
    }

    /// Create a fetcher for a specific API provider.
    ///
    /// Automatically configures rate limiting based on API key presence.
    pub fn for_provider(provider: ApiProvider, base_url: impl Into<String>) -> FetchResult<Self> {
        Self::new(FetcherConfig::for_provider(provider, base_url))
    }

    /// Get the current rate limit (requests per second).
    pub fn rate_limit(&self) -> u32 {
        self.requests_per_second
    }

    /// Check if running in "Turbo Mode" (has API key).
    pub fn is_turbo_mode(&self) -> bool {
        self.api_key.is_some()
    }

    /// Get the API key (if configured).
    pub fn api_key(&self) -> Option<&str> {
        self.api_key.as_deref()
    }

    /// Wait for rate limiter to allow a request.
    ///
    /// This is the key to preventing 429 errors - we wait *before* making the request.
    pub async fn wait_for_permit(&self) {
        self.limiter.until_ready().await;
    }

    /// Make a GET request with automatic rate limiting.
    ///
    /// # Arguments
    ///
    /// * `url` - Full URL to request
    ///
    /// # Returns
    ///
    /// Response text on success.
    pub async fn get(&self, url: &str) -> FetchResult<String> {
        // Wait for rate limiter (prevents 429s proactively)
        self.wait_for_permit().await;

        // Execute request with retry middleware
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    FetchError::Timeout
                } else {
                    FetchError::HttpError(e.to_string())
                }
            })?;

        // Check for rate limit response (in case we still get one)
        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(FetchError::RateLimited);
        }

        // Check for other HTTP errors
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(FetchError::ApiError(format!("HTTP {}: {}", status, body)));
        }

        response
            .text()
            .await
            .map_err(|e| FetchError::ParseError(e.to_string()))
    }

    /// Make a GET request and parse JSON response.
    pub async fn get_json<T: serde::de::DeserializeOwned>(&self, url: &str) -> FetchResult<T> {
        let text = self.get(url).await?;
        serde_json::from_str(&text).map_err(|e| FetchError::ParseError(e.to_string()))
    }

    /// Build a URL with the base URL.
    pub fn build_url(&self, path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            path.to_string()
        } else {
            format!(
                "{}/{}",
                self.base_url.trim_end_matches('/'),
                path.trim_start_matches('/')
            )
        }
    }

    /// Build a URL with query parameters.
    pub fn build_url_with_params(&self, path: &str, params: &[(&str, &str)]) -> String {
        let mut url = self.build_url(path);

        if !params.is_empty() {
            url.push('?');
            for (i, (key, value)) in params.iter().enumerate() {
                if i > 0 {
                    url.push('&');
                }
                url.push_str(key);
                url.push('=');
                url.push_str(value);
            }
        }

        // Append API key if available
        if let Some(ref key) = self.api_key {
            if url.contains('?') {
                url.push('&');
            } else {
                url.push('?');
            }
            url.push_str("apikey=");
            url.push_str(key);
        }

        url
    }

    /// Update the rate limit dynamically (e.g., when API key is added/removed).
    ///
    /// Note: This creates a new limiter. Existing in-flight requests will use the old limiter.
    pub fn update_rate_limit(&mut self, requests_per_second: u32) -> FetchResult<()> {
        let rps = NonZeroU32::new(requests_per_second)
            .ok_or_else(|| FetchError::ConfigError("Rate limit must be > 0".to_string()))?;

        let quota = Quota::per_second(rps);
        self.limiter = Arc::new(RateLimiter::direct(quota));
        self.requests_per_second = requests_per_second;

        Ok(())
    }
}

// =============================================================================
// FETCHER REGISTRY
// =============================================================================

/// Registry for managing multiple fetchers.
///
/// Provides centralized access to fetchers for different providers,
/// with automatic reinitialization when API keys change.
pub struct FetcherRegistry {
    fetchers: std::collections::HashMap<String, ResilientFetcher>,
}

impl FetcherRegistry {
    /// Create a new empty registry.
    pub fn new() -> Self {
        Self {
            fetchers: std::collections::HashMap::new(),
        }
    }

    /// Register a fetcher for a provider.
    pub fn register(&mut self, name: impl Into<String>, fetcher: ResilientFetcher) {
        self.fetchers.insert(name.into(), fetcher);
    }

    /// Get a fetcher by name.
    pub fn get(&self, name: &str) -> Option<&ResilientFetcher> {
        self.fetchers.get(name)
    }

    /// Get a mutable fetcher by name.
    pub fn get_mut(&mut self, name: &str) -> Option<&mut ResilientFetcher> {
        self.fetchers.get_mut(name)
    }

    /// Remove a fetcher.
    pub fn remove(&mut self, name: &str) -> Option<ResilientFetcher> {
        self.fetchers.remove(name)
    }

    /// Reinitialize a fetcher (e.g., after API key change).
    pub fn reinit(&mut self, name: &str, config: FetcherConfig) -> FetchResult<()> {
        let fetcher = ResilientFetcher::new(config)?;
        self.fetchers.insert(name.to_string(), fetcher);
        Ok(())
    }
}

impl Default for FetcherRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalized_tx_serialization() {
        let tx = NormalizedTx {
            tx_hash: "0x123".to_string(),
            block_number: 12345,
            timestamp: 1234567890,
            from_address: "0xabc".to_string(),
            to_address: "0xdef".to_string(),
            amount: "1000000000000000000".to_string(),
            fee: "21000000000000".to_string(),
            chain: "ethereum".to_string(),
            status: TxStatus::Success,
            tx_type: TxType::Transfer,
            symbol: "ETH".to_string(),
            decimals: 18,
            token_transfers: vec![],
            raw_json: None,
        };

        let json = serde_json::to_string(&tx).unwrap();
        assert!(json.contains("0x123"));
        assert!(json.contains("ethereum"));
    }

    #[test]
    fn test_tx_status_serialization() {
        assert_eq!(
            serde_json::to_string(&TxStatus::Success).unwrap(),
            "\"success\""
        );
        assert_eq!(
            serde_json::to_string(&TxStatus::Failed).unwrap(),
            "\"failed\""
        );
    }

    #[test]
    fn test_tx_type_serialization() {
        assert_eq!(
            serde_json::to_string(&TxType::Transfer).unwrap(),
            "\"transfer\""
        );
        assert_eq!(
            serde_json::to_string(&TxType::ContractCall).unwrap(),
            "\"contract_call\""
        );
    }

    #[test]
    fn test_fetcher_config_for_provider() {
        // Without API key (default mode)
        let config = FetcherConfig::for_provider(ApiProvider::Etherscan, "https://api.etherscan.io");
        assert_eq!(config.requests_per_second, 1); // Default rate limit
        assert!(config.api_key.is_none());
    }

    #[test]
    fn test_fetcher_registry() {
        let mut registry = FetcherRegistry::new();

        let config = FetcherConfig {
            base_url: "https://example.com".to_string(),
            api_key: None,
            requests_per_second: 1,
            timeout_secs: 30,
            max_retries: 3,
        };

        let fetcher = ResilientFetcher::new(config).unwrap();
        registry.register("test", fetcher);

        assert!(registry.get("test").is_some());
        assert!(registry.get("unknown").is_none());
    }

    #[test]
    fn test_resilient_fetcher_build_url() {
        let config = FetcherConfig {
            base_url: "https://api.example.com".to_string(),
            api_key: Some("TEST_KEY".to_string()),
            requests_per_second: 5,
            timeout_secs: 30,
            max_retries: 3,
        };

        let fetcher = ResilientFetcher::new(config).unwrap();

        // Test basic URL building
        assert_eq!(
            fetcher.build_url("/endpoint"),
            "https://api.example.com/endpoint"
        );

        // Test with params and API key
        let url = fetcher.build_url_with_params("/tx", &[("address", "0x123")]);
        assert!(url.contains("address=0x123"));
        assert!(url.contains("apikey=TEST_KEY"));
    }

    #[test]
    fn test_resilient_fetcher_turbo_mode() {
        let config = FetcherConfig {
            base_url: "https://api.example.com".to_string(),
            api_key: Some("TEST_KEY".to_string()),
            requests_per_second: 5,
            timeout_secs: 30,
            max_retries: 3,
        };

        let fetcher = ResilientFetcher::new(config).unwrap();
        assert!(fetcher.is_turbo_mode());
        assert_eq!(fetcher.rate_limit(), 5);

        let config_no_key = FetcherConfig {
            base_url: "https://api.example.com".to_string(),
            api_key: None,
            requests_per_second: 1,
            timeout_secs: 30,
            max_retries: 3,
        };

        let fetcher_no_key = ResilientFetcher::new(config_no_key).unwrap();
        assert!(!fetcher_no_key.is_turbo_mode());
        assert_eq!(fetcher_no_key.rate_limit(), 1);
    }
}
