//! Helius API Client
//!
//! Enhanced Solana RPC and REST client using Helius for enriched transaction data
//! and the DAS (Digital Asset Standard) API for token balances.

use crate::chains::{ChainError, ChainResult};
use crate::fetchers::{FetcherConfig, ResilientFetcher};

use std::num::NonZeroU32;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use governor::{Quota, RateLimiter};
use reqwest::Client;
use serde_json::json;

use crate::fetchers::GovernorLimiter;

use super::types::*;

/// Helius REST API base URL
const HELIUS_REST_BASE: &str = "https://api.helius.xyz/v0";

/// Helius RPC base URL
const HELIUS_RPC_BASE: &str = "https://mainnet.helius-rpc.com";

/// Default rate limit (free tier)
const DEFAULT_RATE_LIMIT_RPS: u32 = 5;

/// Turbo rate limit (paid tier)
const TURBO_RATE_LIMIT_RPS: u32 = 30;

/// Max transactions per page from Helius REST API
const TXS_PER_PAGE: usize = 100;

/// Helius-specific API client for enriched Solana data
pub struct HeliusClient {
    /// Resilient fetcher for REST GET requests
    rest_fetcher: ResilientFetcher,
    /// HTTP client for RPC POST requests
    rpc_client: Client,
    /// Governor rate limiter for RPC calls
    rpc_limiter: Arc<GovernorLimiter>,
    /// API key
    api_key: String,
    /// RPC endpoint URL (with API key)
    rpc_url: String,
    /// RPC request ID counter
    request_id: AtomicU64,
}

impl HeliusClient {
    /// Create a new Helius client with an API key
    pub fn new(api_key: &str) -> ChainResult<Self> {
        Self::with_rate_limit(api_key, DEFAULT_RATE_LIMIT_RPS)
    }

    /// Create a new Helius client with custom rate limit
    pub fn with_rate_limit(api_key: &str, rate_limit_rps: u32) -> ChainResult<Self> {
        // REST fetcher for GET requests
        let rest_config = FetcherConfig {
            base_url: HELIUS_REST_BASE.to_string(),
            api_key: Some(api_key.to_string()),
            requests_per_second: rate_limit_rps,
            timeout_secs: 30,
            max_retries: 3,
        };

        let rest_fetcher = ResilientFetcher::new(rest_config)
            .map_err(|e| ChainError::Internal(format!("Failed to create REST fetcher: {}", e)))?;

        // RPC client for POST requests
        let rpc_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ChainError::Internal(format!("Failed to create RPC client: {}", e)))?;

        let rps = NonZeroU32::new(rate_limit_rps)
            .ok_or_else(|| ChainError::ConfigError("Rate limit must be > 0".to_string()))?;
        let rpc_limiter = Arc::new(RateLimiter::direct(Quota::per_second(rps)));

        let rpc_url = format!("{}/?api-key={}", HELIUS_RPC_BASE, api_key);

        Ok(Self {
            rest_fetcher,
            rpc_client,
            rpc_limiter,
            api_key: api_key.to_string(),
            rpc_url,
            request_id: AtomicU64::new(1),
        })
    }

    /// Get the next RPC request ID
    fn next_id(&self) -> u64 {
        self.request_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Make a JSON-RPC call to Helius enhanced RPC
    async fn rpc_call<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> ChainResult<T> {
        self.rpc_limiter.until_ready().await;

        let id = self.next_id();
        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let response = self
            .rpc_client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    ChainError::ConnectionFailed("Helius RPC request timeout".to_string())
                } else {
                    ChainError::RpcError(format!("Helius RPC request failed: {}", e))
                }
            })?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(ChainError::RateLimited);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ChainError::ApiError(format!(
                "Helius RPC HTTP {}: {}",
                status, body
            )));
        }

        let rpc_response: RpcResponse<T> = response.json().await.map_err(|e| {
            ChainError::ParseError(format!("Failed to parse Helius RPC response: {}", e))
        })?;

        if let Some(error) = rpc_response.error {
            return Err(ChainError::RpcError(format!(
                "Helius RPC error {}: {}",
                error.code, error.message
            )));
        }

        rpc_response
            .result
            .ok_or_else(|| ChainError::ParseError("Helius RPC response missing result".to_string()))
    }

    /// Fetch parsed transactions for an address (single page)
    ///
    /// Uses Helius REST API: GET /v0/addresses/{address}/transactions
    /// Returns enriched transactions with DeFi metadata.
    pub async fn get_parsed_transactions(
        &self,
        address: &str,
        before: Option<&str>,
        limit: Option<usize>,
    ) -> ChainResult<Vec<HeliusTransaction>> {
        let limit = limit.unwrap_or(TXS_PER_PAGE).min(TXS_PER_PAGE);

        let mut url = format!(
            "{}/addresses/{}/transactions?api-key={}&type=ALL&limit={}",
            HELIUS_REST_BASE, address, self.api_key, limit
        );

        if let Some(before_sig) = before {
            url.push_str(&format!("&before={}", before_sig));
        }

        let text = self.rest_fetcher.get(&url).await.map_err(|e| match e {
            crate::fetchers::FetchError::RateLimited => ChainError::RateLimited,
            crate::fetchers::FetchError::Timeout => {
                ChainError::ConnectionFailed("Helius REST request timeout".to_string())
            }
            crate::fetchers::FetchError::HttpError(msg) => ChainError::ApiError(msg),
            crate::fetchers::FetchError::ParseError(msg) => ChainError::ParseError(msg),
            crate::fetchers::FetchError::ApiError(msg) => ChainError::ApiError(msg),
            crate::fetchers::FetchError::ConfigError(msg) => ChainError::ConfigError(msg),
        })?;

        serde_json::from_str(&text)
            .map_err(|e| ChainError::ParseError(format!("Failed to parse Helius transactions: {}", e)))
    }

    /// Fetch all transactions for an address with pagination
    ///
    /// # Arguments
    /// * `address` - Solana address
    /// * `max_pages` - Maximum pages to fetch (None for all, each page is ~100 txs)
    pub async fn get_all_transactions(
        &self,
        address: &str,
        max_pages: Option<usize>,
    ) -> ChainResult<Vec<HeliusTransaction>> {
        let mut all_txs = Vec::new();
        let mut before: Option<String> = None;
        let mut page = 0;

        loop {
            let txs = self
                .get_parsed_transactions(address, before.as_deref(), None)
                .await?;

            let count = txs.len();
            if count == 0 {
                break;
            }

            // Get last signature for pagination cursor
            before = txs.last().map(|tx| tx.signature.clone());
            all_txs.extend(txs);
            page += 1;

            // Check page limit
            if let Some(max) = max_pages {
                if page >= max {
                    break;
                }
            }

            // If we got fewer than a full page, we've reached the end
            if count < TXS_PER_PAGE {
                break;
            }
        }

        Ok(all_txs)
    }

    /// Get all token assets for an address using DAS API
    ///
    /// Uses Helius enhanced RPC: `getAssetsByOwner`
    pub async fn get_assets_by_owner(
        &self,
        owner: &str,
        page: u32,
    ) -> ChainResult<DasAssetList> {
        self.rpc_call(
            "getAssetsByOwner",
            json!({
                "ownerAddress": owner,
                "page": page,
                "displayOptions": {
                    "showFungible": true
                }
            }),
        )
        .await
    }

    /// Get SOL balance via Helius RPC
    pub async fn get_balance(&self, address: &str) -> ChainResult<u64> {
        let result: RpcBalanceResult = self
            .rpc_call("getBalance", json!([address]))
            .await?;
        Ok(result.value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rest_url_construction() {
        let url = format!(
            "{}/addresses/{}/transactions?api-key={}&type=ALL&limit=100",
            HELIUS_REST_BASE, "TestAddress", "test_key"
        );
        assert!(url.contains("api.helius.xyz/v0"));
        assert!(url.contains("TestAddress"));
        assert!(url.contains("api-key=test_key"));
    }

    #[test]
    fn test_rpc_url_construction() {
        let rpc_url = format!("{}/?api-key={}", HELIUS_RPC_BASE, "test_key");
        assert!(rpc_url.contains("mainnet.helius-rpc.com"));
        assert!(rpc_url.contains("api-key=test_key"));
    }

    #[test]
    fn test_das_request_building() {
        let params = json!({
            "ownerAddress": "TestOwner",
            "page": 1,
            "displayOptions": {
                "showFungible": true
            }
        });

        assert_eq!(params["ownerAddress"], "TestOwner");
        assert_eq!(params["page"], 1);
        assert_eq!(params["displayOptions"]["showFungible"], true);
    }

    #[test]
    fn test_rate_limits() {
        assert_eq!(DEFAULT_RATE_LIMIT_RPS, 5);
        assert_eq!(TURBO_RATE_LIMIT_RPS, 30);
    }
}
