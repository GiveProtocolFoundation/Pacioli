//! Standard Solana JSON-RPC Client
//!
//! Fallback client for when no Helius API key is available.
//! Uses the public Solana RPC endpoint with conservative rate limiting.

use std::num::NonZeroU32;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use governor::{Quota, RateLimiter};
use reqwest::Client;
use serde_json::json;

use crate::chains::{ChainError, ChainResult};
use crate::fetchers::GovernorLimiter;

use super::types::*;

/// Default Solana mainnet RPC endpoint
const DEFAULT_RPC_URL: &str = "https://api.mainnet-beta.solana.com";

/// Default rate limit for public RPC (requests per second)
const DEFAULT_RATE_LIMIT_RPS: u32 = 2;

/// Request timeout in seconds
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// Solana JSON-RPC client for standard RPC calls
pub struct SolanaRpcClient {
    /// HTTP client
    client: Client,
    /// Governor rate limiter
    limiter: Arc<GovernorLimiter>,
    /// RPC endpoint URL
    rpc_url: String,
    /// Request ID counter
    request_id: AtomicU64,
}

impl SolanaRpcClient {
    /// Create a new RPC client with default settings (public mainnet)
    pub fn new() -> ChainResult<Self> {
        Self::with_url(DEFAULT_RPC_URL, DEFAULT_RATE_LIMIT_RPS)
    }

    /// Create a new RPC client with custom URL and rate limit
    pub fn with_url(rpc_url: &str, rate_limit_rps: u32) -> ChainResult<Self> {
        let rps = NonZeroU32::new(rate_limit_rps)
            .ok_or_else(|| ChainError::ConfigError("Rate limit must be > 0".to_string()))?;

        let limiter = Arc::new(RateLimiter::direct(Quota::per_second(rps)));

        let client = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| ChainError::Internal(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            client,
            limiter,
            rpc_url: rpc_url.to_string(),
            request_id: AtomicU64::new(1),
        })
    }

    /// Get the next request ID
    fn next_id(&self) -> u64 {
        self.request_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Make a JSON-RPC 2.0 call
    async fn rpc_call<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> ChainResult<T> {
        // Wait for rate limiter
        self.limiter.until_ready().await;

        let id = self.next_id();
        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    ChainError::ConnectionFailed("RPC request timeout".to_string())
                } else {
                    ChainError::RpcError(format!("RPC request failed: {}", e))
                }
            })?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(ChainError::RateLimited);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ChainError::RpcError(format!("HTTP {}: {}", status, body)));
        }

        let rpc_response: RpcResponse<T> = response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(format!("Failed to parse RPC response: {}", e)))?;

        if let Some(error) = rpc_response.error {
            return Err(ChainError::RpcError(format!(
                "RPC error {}: {}",
                error.code, error.message
            )));
        }

        rpc_response
            .result
            .ok_or_else(|| ChainError::ParseError("RPC response missing result".to_string()))
    }

    /// Get SOL balance for an address (in lamports)
    pub async fn get_balance(&self, address: &str) -> ChainResult<u64> {
        let result: RpcBalanceResult = self
            .rpc_call("getBalance", json!([address]))
            .await?;
        Ok(result.value)
    }

    /// Get current slot
    pub async fn get_slot(&self) -> ChainResult<u64> {
        self.rpc_call("getSlot", json!([])).await
    }

    /// Get current block height
    pub async fn get_block_height(&self) -> ChainResult<u64> {
        self.rpc_call("getBlockHeight", json!([])).await
    }

    /// Get token accounts by owner (parsed JSON encoding)
    pub async fn get_token_accounts_by_owner(
        &self,
        owner: &str,
    ) -> ChainResult<Vec<RpcTokenAccountEntry>> {
        let result: RpcTokenAccountsResult = self
            .rpc_call(
                "getTokenAccountsByOwner",
                json!([
                    owner,
                    { "programId": TOKEN_PROGRAM },
                    { "encoding": "jsonParsed" }
                ]),
            )
            .await?;
        Ok(result.value)
    }

    /// Get transaction signatures for an address
    ///
    /// # Arguments
    /// * `address` - The address to query
    /// * `before` - Optional signature to paginate before
    /// * `limit` - Max signatures to return (default 1000, max 1000)
    pub async fn get_signatures_for_address(
        &self,
        address: &str,
        before: Option<&str>,
        limit: Option<u32>,
    ) -> ChainResult<Vec<RpcSignatureInfo>> {
        let mut config = serde_json::Map::new();
        if let Some(before_sig) = before {
            config.insert("before".to_string(), json!(before_sig));
        }
        if let Some(lim) = limit {
            config.insert("limit".to_string(), json!(lim));
        }

        self.rpc_call(
            "getSignaturesForAddress",
            json!([address, config]),
        )
        .await
    }

    /// Get a parsed transaction by signature
    pub async fn get_transaction(
        &self,
        signature: &str,
    ) -> ChainResult<serde_json::Value> {
        self.rpc_call(
            "getTransaction",
            json!([
                signature,
                { "encoding": "jsonParsed", "maxSupportedTransactionVersion": 0 }
            ]),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation_default() {
        let client = SolanaRpcClient::new();
        assert!(client.is_ok());
        let client = client.unwrap();
        assert_eq!(client.rpc_url, DEFAULT_RPC_URL);
    }

    #[test]
    fn test_client_creation_custom_url() {
        let client =
            SolanaRpcClient::with_url("https://api.devnet.solana.com", 5);
        assert!(client.is_ok());
        let client = client.unwrap();
        assert_eq!(client.rpc_url, "https://api.devnet.solana.com");
    }

    #[test]
    fn test_client_creation_invalid_rate_limit() {
        let result = SolanaRpcClient::with_url(DEFAULT_RPC_URL, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_request_id_increments() {
        let client = SolanaRpcClient::new().unwrap();
        let id1 = client.next_id();
        let id2 = client.next_id();
        assert_eq!(id2, id1 + 1);
    }
}
