//! Etherscan-compatible API Client
//!
//! Supports Etherscan and compatible block explorer APIs (Polygonscan, Arbiscan, etc.)
//! Now uses the ResilientFetcher for Governor-based rate limiting and automatic retries.
//!
//! # API Key Handling
//!
//! Etherscan V2 requires an API key. For chains that use the V2 unified endpoint
//! (including Moonbeam/Moonriver), the client falls back to the Etherscan key
//! when no chain-specific key is configured.
//! - **Default Mode**: 1 req/sec with a free key
//! - **Turbo Mode**: Add a paid/higher-tier API key for 5 req/sec

use super::config::{get_chain_config, EvmChainConfig};
use super::types::{
    Erc1155Transfer, Erc20Transfer, Erc721Transfer, EvmTransaction, InternalTransaction,
};
use crate::chains::{ChainError, ChainResult};
use crate::fetchers::{ApiKeyManager, ApiProvider, FetcherConfig, ResilientFetcher};
use chrono::Utc;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::collections::HashSet;
use std::future::Future;
use std::time::Duration;
use tokio::time::sleep;

// =============================================================================
// CONSTANTS
// =============================================================================

/// Maximum results per API call (Etherscan limit)
const MAX_RESULTS_PER_PAGE: u32 = 10000;

/// Default page size for pagination
const DEFAULT_PAGE_SIZE: u32 = 1000;

/// Maximum retry attempts for rate-limited requests (handled by ResilientFetcher)
const MAX_RETRIES: u32 = 5;

/// Base delay for exponential backoff (milliseconds)
const BASE_RETRY_DELAY_MS: u64 = 200;

/// Safety cap on windowed fetches to prevent infinite loops
const MAX_WINDOW_FETCHES: u32 = 100;

const MOONBEAM_SUNSET_MESSAGE: &str = "The Moonbeam network ceased operations on 31 July 2026. \
     New transactions can no longer be synced; your previously synced \
     history remains available in Pacioli.";

/// Moonbeam/Moonriver ceased operations after 2026-07-31 23:59:59 UTC
/// (unix epoch 1785542399, matching MOONBEAM_SUNSET_UTC in moonscanService.ts).
fn is_moonbeam_sunset(chain_id: u64) -> bool {
    matches!(chain_id, 1284 | 1285) && Utc::now().timestamp() > 1_785_542_399
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/// Etherscan API response wrapper
#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    status: String,
    message: String,
    result: T,
}

/// Etherscan API error response (when result is a string error message)
#[derive(Debug, Deserialize)]
struct ApiErrorResponse {
    status: String,
    message: String,
    result: String,
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Get the ApiProvider for a chain ID (for keychain lookup)
fn get_api_provider_for_chain(chain_id: u64) -> ApiProvider {
    match chain_id {
        1 => ApiProvider::Etherscan,          // Ethereum
        137 => ApiProvider::Polygonscan,      // Polygon
        42161 => ApiProvider::Arbiscan,       // Arbitrum
        8453 => ApiProvider::Basescan,        // Base
        10 => ApiProvider::Optimism,          // Optimism
        56 => ApiProvider::Etherscan,         // BSC (uses Etherscan V2 API)
        1284 | 1285 => ApiProvider::Moonscan, // Moonbeam / Moonriver
        _ => ApiProvider::Etherscan,          // Default to Etherscan for unknown chains
    }
}

/// Get the rate limit for a chain based on API key availability
fn get_rate_limit_for_chain(chain_id: u64, has_api_key: bool) -> u32 {
    let provider = get_api_provider_for_chain(chain_id);
    if has_api_key {
        provider.turbo_rate_limit()
    } else {
        provider.default_rate_limit()
    }
}

// =============================================================================
// BLOCK-RANGE WINDOWED PAGINATION TRAIT
// =============================================================================

trait HasBlockAndHash {
    fn block_num(&self) -> u64;
    fn dedup_key(&self) -> String;
}

impl HasBlockAndHash for EvmTransaction {
    fn block_num(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }
    fn dedup_key(&self) -> String {
        self.hash.clone()
    }
}

impl HasBlockAndHash for InternalTransaction {
    fn block_num(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }
    fn dedup_key(&self) -> String {
        format!("{}:{}", self.hash, self.trace_id)
    }
}

impl HasBlockAndHash for Erc20Transfer {
    fn block_num(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }
    fn dedup_key(&self) -> String {
        format!("{}:{}", self.hash, self.log_index)
    }
}

impl HasBlockAndHash for Erc721Transfer {
    fn block_num(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }
    fn dedup_key(&self) -> String {
        format!("{}:{}", self.hash, self.log_index)
    }
}

impl HasBlockAndHash for Erc1155Transfer {
    fn block_num(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }
    fn dedup_key(&self) -> String {
        format!("{}:{}:{}", self.hash, self.token_id, self.token_value)
    }
}

// =============================================================================
// ETHERSCAN CLIENT
// =============================================================================

/// Etherscan-compatible API client with Governor rate limiting and automatic retries.
///
/// # "Batteries Included, Turbo Optional"
///
/// This client automatically checks the OS keychain for API keys:
/// - If found: Uses "Turbo Mode" (5 req/sec)
/// - If not found: Uses "Default Mode" (1 req/sec)
///
/// Users can add their API keys in Settings to unlock faster sync speeds.
pub struct EtherscanClient {
    /// Resilient fetcher with Governor rate limiter
    fetcher: ResilientFetcher,
    /// Base URL for the API
    base_url: String,
    /// Optional API key (from keychain or explicitly provided)
    api_key: Option<String>,
    /// Chain ID
    chain_id: u64,
    /// Chain name
    chain_name: String,
}

impl EtherscanClient {
    /// Create a new Etherscan client from chain ID.
    ///
    /// Automatically checks the OS keychain for an API key to enable Turbo Mode.
    pub fn from_chain_id(chain_id: u64, api_key: Option<String>) -> ChainResult<Self> {
        let config = get_chain_config(chain_id)
            .ok_or_else(|| ChainError::UnsupportedChain(format!("chain_id: {}", chain_id)))?;

        Self::new(&config, api_key)
    }

    /// Create a new Etherscan client from chain config.
    ///
    /// # API Key Priority
    /// 1. Explicitly provided `api_key` parameter
    /// 2. Key from OS keychain for the chain's provider (via ApiKeyManager)
    /// 3. Etherscan key fallback (for chains using V2 unified endpoint, e.g. Moonscan)
    /// 4. No key (Default Mode — may fail on Etherscan V2 which requires a key)
    pub fn new(config: &EvmChainConfig, api_key: Option<String>) -> ChainResult<Self> {
        // Determine the API key (explicit > provider keychain > etherscan fallback > none)
        let provider = get_api_provider_for_chain(config.chain_id);
        let effective_api_key = api_key
            .or_else(|| ApiKeyManager::get_api_key(provider).ok().flatten())
            .or_else(|| {
                // Moonscan V1 deprecated; V2 runs through api.etherscan.io —
                // fall back to the Etherscan key when no Moonscan-specific key exists
                if provider == ApiProvider::Moonscan {
                    ApiKeyManager::get_api_key(ApiProvider::Etherscan)
                        .ok()
                        .flatten()
                } else {
                    None
                }
            });

        // Calculate rate limit based on API key presence
        let rate_limit = get_rate_limit_for_chain(config.chain_id, effective_api_key.is_some());

        // Create fetcher config
        let fetcher_config = FetcherConfig {
            base_url: config.explorer_api_url.clone(),
            api_key: effective_api_key.clone(),
            requests_per_second: rate_limit,
            timeout_secs: 30,
            max_retries: MAX_RETRIES,
        };

        // Create the resilient fetcher
        let fetcher = ResilientFetcher::new(fetcher_config)
            .map_err(|e| ChainError::Internal(format!("Failed to create fetcher: {}", e)))?;

        Ok(Self {
            fetcher,
            base_url: config.explorer_api_url.clone(),
            api_key: effective_api_key,
            chain_id: config.chain_id,
            chain_name: config.name.clone(),
        })
    }

    /// Check if running in Turbo Mode (has API key)
    pub fn is_turbo_mode(&self) -> bool {
        self.fetcher.is_turbo_mode()
    }

    /// Get the current rate limit (requests per second)
    pub fn rate_limit(&self) -> u32 {
        self.fetcher.rate_limit()
    }

    /// Get chain ID
    pub fn chain_id(&self) -> u64 {
        self.chain_id
    }

    /// Get chain name
    pub fn chain_name(&self) -> &str {
        &self.chain_name
    }

    // =========================================================================
    // URL BUILDING
    // =========================================================================

    /// Build API URL with parameters
    fn build_url(&self, module: &str, action: &str, params: &[(&str, &str)]) -> String {
        // V2 API requires chainid parameter
        let mut url = format!(
            "{}?chainid={}&module={}&action={}",
            self.base_url, self.chain_id, module, action
        );

        for (key, value) in params {
            url.push_str(&format!("&{}={}", key, value));
        }

        if let Some(ref api_key) = self.api_key {
            url.push_str(&format!("&apikey={}", api_key));
        }

        url
    }

    // =========================================================================
    // REQUEST HANDLING
    // =========================================================================

    /// Make API request with Governor rate limiting and automatic retries.
    ///
    /// The ResilientFetcher handles:
    /// - Proactive rate limiting (waits before request to prevent 429s)
    /// - Exponential backoff retries for transient failures
    async fn request<T: DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        if is_moonbeam_sunset(self.chain_id) {
            return Err(ChainError::ApiError(MOONBEAM_SUNSET_MESSAGE.to_string()));
        }

        // Wait for rate limiter (Governor GCRA algorithm)
        self.fetcher.wait_for_permit().await;

        // Execute request
        self.execute_request::<T>(url).await
    }

    /// Execute a single request with retry handling for rate limits
    async fn execute_request<T: DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        let mut last_error = ChainError::Internal("No attempts made".to_string());

        for attempt in 0..MAX_RETRIES {
            match self.do_request::<T>(url).await {
                Ok(result) => return Ok(result),
                Err(ChainError::RateLimited) => {
                    // Exponential backoff for rate limits (in case we still get 429)
                    let delay = BASE_RETRY_DELAY_MS * 2u64.pow(attempt);
                    sleep(Duration::from_millis(delay)).await;
                    last_error = ChainError::RateLimited;
                }
                Err(e) => {
                    // Don't retry other errors
                    return Err(e);
                }
            }
        }

        Err(last_error)
    }

    /// Execute a single HTTP request
    async fn do_request<T: DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        let text = self.fetcher.get(url).await.map_err(|e| match e {
            crate::fetchers::FetchError::RateLimited => ChainError::RateLimited,
            crate::fetchers::FetchError::Timeout => {
                ChainError::ConnectionFailed("Request timeout".to_string())
            }
            crate::fetchers::FetchError::HttpError(msg) => ChainError::ApiError(msg),
            crate::fetchers::FetchError::ParseError(msg) => ChainError::ParseError(msg),
            crate::fetchers::FetchError::ApiError(msg) => ChainError::ApiError(msg),
            crate::fetchers::FetchError::ConfigError(msg) => ChainError::ConfigError(msg),
        })?;

        // First try to parse as success response
        if let Ok(api_response) = serde_json::from_str::<ApiResponse<T>>(&text) {
            if api_response.status == "1" || api_response.message == "OK" {
                return Ok(api_response.result);
            }
        }

        // Try to parse as error response
        if let Ok(error_response) = serde_json::from_str::<ApiErrorResponse>(&text) {
            // Check for "No transactions found" which is not an error
            if error_response.message.contains("No transactions found")
                || error_response.message.contains("No records found")
                || error_response.result.contains("No transactions found")
            {
                return Err(ChainError::ApiError("No results".to_string()));
            }

            // Check for rate limit message
            if error_response.result.contains("rate limit")
                || error_response.message.contains("rate limit")
            {
                return Err(ChainError::RateLimited);
            }

            // Check for invalid address
            if error_response.message.contains("Invalid address")
                || error_response.result.contains("Invalid address")
            {
                return Err(ChainError::InvalidAddress(error_response.result));
            }

            // Detect Moonbeam/Moonriver chain deprecation errors
            if matches!(self.chain_id, 1284 | 1285) {
                let lower = error_response.result.to_lowercase();
                if lower.contains("chain")
                    || lower.contains("not supported")
                    || lower.contains("deprecated")
                {
                    return Err(ChainError::ApiError(MOONBEAM_SUNSET_MESSAGE.to_string()));
                }
            }

            return Err(ChainError::ApiError(format!(
                "{}: {}",
                error_response.message, error_response.result
            )));
        }

        Err(ChainError::ParseError(format!(
            "Failed to parse response: {}",
            &text[..text.len().min(200)]
        )))
    }

    // =========================================================================
    // TRANSACTION METHODS
    // =========================================================================

    /// Get normal transactions for an address
    pub async fn get_normal_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<EvmTransaction>> {
        self.get_normal_transactions_paginated(
            address,
            start_block,
            end_block,
            1,
            DEFAULT_PAGE_SIZE,
        )
        .await
    }

    /// Get normal transactions with pagination
    pub async fn get_normal_transactions_paginated(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<EvmTransaction>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.min(MAX_RESULTS_PER_PAGE).to_string();

        let url = self.build_url(
            "account",
            "txlist",
            &[
                ("address", address),
                ("startblock", &start),
                ("endblock", &end),
                ("page", &page_str),
                ("offset", &offset_str),
                ("sort", "desc"),
            ],
        );

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get all normal transactions using block-range windowing.
    ///
    /// Etherscan V2 rejects page × offset > 10 000, so deep history cannot
    /// be paged by incrementing the page number.  Instead we keep page=1
    /// with sort=asc and advance `startBlock` past each full window.
    /// Boundary-block overlap is removed by tx-hash dedup.
    pub async fn get_all_normal_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<EvmTransaction>> {
        self.fetch_all_windowed(start_block, end_block, |sb, eb| {
            let start = sb.to_string();
            let end = eb.map_or_else(|| "99999999".to_string(), |b| b.to_string());
            let url = self.build_url(
                "account",
                "txlist",
                &[
                    ("address", address),
                    ("startblock", &start),
                    ("endblock", &end),
                    ("page", "1"),
                    ("offset", &MAX_RESULTS_PER_PAGE.to_string()),
                    ("sort", "asc"),
                ],
            );
            async move {
                match self.request::<Vec<EvmTransaction>>(&url).await {
                    Ok(txs) => Ok(txs),
                    Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
                    Err(e) => Err(e),
                }
            }
        })
        .await
    }

    /// Get all internal transactions using block-range windowing.
    pub async fn get_all_internal_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<InternalTransaction>> {
        self.fetch_all_windowed(start_block, end_block, |sb, eb| {
            let start = sb.to_string();
            let end = eb.map_or_else(|| "99999999".to_string(), |b| b.to_string());
            let url = self.build_url(
                "account",
                "txlistinternal",
                &[
                    ("address", address),
                    ("startblock", &start),
                    ("endblock", &end),
                    ("page", "1"),
                    ("offset", &MAX_RESULTS_PER_PAGE.to_string()),
                    ("sort", "asc"),
                ],
            );
            async move {
                match self.request::<Vec<InternalTransaction>>(&url).await {
                    Ok(txs) => Ok(txs),
                    Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
                    Err(e) => Err(e),
                }
            }
        })
        .await
    }

    /// Get all ERC-20 token transfers using block-range windowing.
    pub async fn get_all_token_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<Erc20Transfer>> {
        self.fetch_all_windowed(start_block, end_block, |sb, eb| {
            let start = sb.to_string();
            let end = eb.map_or_else(|| "99999999".to_string(), |b| b.to_string());
            let offset_str = MAX_RESULTS_PER_PAGE.to_string();
            let mut params = vec![
                ("address", address),
                ("startblock", start.as_str()),
                ("endblock", end.as_str()),
                ("page", "1"),
                ("offset", offset_str.as_str()),
                ("sort", "asc"),
            ];
            let contract_str;
            if let Some(c) = contract_address {
                contract_str = c.to_string();
                params.push(("contractaddress", contract_str.as_str()));
            }
            let url = self.build_url("account", "tokentx", &params);
            async move {
                match self.request::<Vec<Erc20Transfer>>(&url).await {
                    Ok(txs) => Ok(txs),
                    Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
                    Err(e) => Err(e),
                }
            }
        })
        .await
    }

    /// Get all ERC-721 (NFT) transfers using block-range windowing.
    pub async fn get_all_nft_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<Erc721Transfer>> {
        self.fetch_all_windowed(start_block, end_block, |sb, eb| {
            let start = sb.to_string();
            let end = eb.map_or_else(|| "99999999".to_string(), |b| b.to_string());
            let offset_str = MAX_RESULTS_PER_PAGE.to_string();
            let mut params = vec![
                ("address", address),
                ("startblock", start.as_str()),
                ("endblock", end.as_str()),
                ("page", "1"),
                ("offset", offset_str.as_str()),
                ("sort", "asc"),
            ];
            let contract_str;
            if let Some(c) = contract_address {
                contract_str = c.to_string();
                params.push(("contractaddress", contract_str.as_str()));
            }
            let url = self.build_url("account", "tokennfttx", &params);
            async move {
                match self.request::<Vec<Erc721Transfer>>(&url).await {
                    Ok(txs) => Ok(txs),
                    Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
                    Err(e) => Err(e),
                }
            }
        })
        .await
    }

    /// Get all ERC-1155 transfers using block-range windowing.
    pub async fn get_all_erc1155_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<Erc1155Transfer>> {
        self.fetch_all_windowed(start_block, end_block, |sb, eb| {
            let start = sb.to_string();
            let end = eb.map_or_else(|| "99999999".to_string(), |b| b.to_string());
            let offset_str = MAX_RESULTS_PER_PAGE.to_string();
            let mut params = vec![
                ("address", address),
                ("startblock", start.as_str()),
                ("endblock", end.as_str()),
                ("page", "1"),
                ("offset", offset_str.as_str()),
                ("sort", "asc"),
            ];
            let contract_str;
            if let Some(c) = contract_address {
                contract_str = c.to_string();
                params.push(("contractaddress", contract_str.as_str()));
            }
            let url = self.build_url("account", "token1155tx", &params);
            async move {
                match self.request::<Vec<Erc1155Transfer>>(&url).await {
                    Ok(txs) => Ok(txs),
                    Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
                    Err(e) => Err(e),
                }
            }
        })
        .await
    }

    // =========================================================================
    // BLOCK-RANGE WINDOWED PAGINATION (private)
    // =========================================================================

    /// Generic block-range windowed fetcher.
    ///
    /// Keeps page=1 and advances `start_block` past each full window
    /// (sort=asc on the caller side).  Deduplicates boundary-block overlap
    /// by tx hash.
    async fn fetch_all_windowed<T, F, Fut>(
        &self,
        start_block: Option<u64>,
        end_block: Option<u64>,
        fetch_window: F,
    ) -> ChainResult<Vec<T>>
    where
        T: HasBlockAndHash,
        F: Fn(u64, Option<u64>) -> Fut,
        Fut: Future<Output = ChainResult<Vec<T>>>,
    {
        let mut all: Vec<T> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();
        let mut current_start = start_block.unwrap_or(0);

        for _ in 0..MAX_WINDOW_FETCHES {
            let window = fetch_window(current_start, end_block).await?;
            let count = window.len();

            for item in window {
                let key = item.dedup_key();
                if seen.insert(key) {
                    all.push(item);
                }
            }

            if count < MAX_RESULTS_PER_PAGE as usize {
                break;
            }

            let last_block = all.last().map(|t| t.block_num()).unwrap_or(current_start);
            current_start = if last_block > current_start {
                last_block
            } else {
                current_start + 1
            };
        }

        Ok(all)
    }

    /// Get internal transactions for an address
    pub async fn get_internal_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<InternalTransaction>> {
        self.get_internal_transactions_paginated(
            address,
            start_block,
            end_block,
            1,
            DEFAULT_PAGE_SIZE,
        )
        .await
    }

    /// Get internal transactions with pagination
    pub async fn get_internal_transactions_paginated(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<InternalTransaction>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.min(MAX_RESULTS_PER_PAGE).to_string();

        let url = self.build_url(
            "account",
            "txlistinternal",
            &[
                ("address", address),
                ("startblock", &start),
                ("endblock", &end),
                ("page", &page_str),
                ("offset", &offset_str),
                ("sort", "desc"),
            ],
        );

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    // =========================================================================
    // TOKEN TRANSFER METHODS
    // =========================================================================

    /// Get ERC-20 token transfers for an address
    pub async fn get_token_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
    ) -> ChainResult<Vec<Erc20Transfer>> {
        self.get_token_transfers_paginated(
            address,
            contract_address,
            start_block,
            None,
            1,
            DEFAULT_PAGE_SIZE,
        )
        .await
    }

    /// Get ERC-20 token transfers with pagination
    pub async fn get_token_transfers_paginated(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc20Transfer>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.min(MAX_RESULTS_PER_PAGE).to_string();

        let mut params = vec![
            ("address", address),
            ("startblock", start.as_str()),
            ("endblock", end.as_str()),
            ("page", page_str.as_str()),
            ("offset", offset_str.as_str()),
            ("sort", "desc"),
        ];

        let contract_str;
        if let Some(contract) = contract_address {
            contract_str = contract.to_string();
            params.push(("contractaddress", &contract_str));
        }

        let url = self.build_url("account", "tokentx", &params);

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get ERC-721 (NFT) transfers for an address
    pub async fn get_nft_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
    ) -> ChainResult<Vec<Erc721Transfer>> {
        self.get_nft_transfers_paginated(
            address,
            contract_address,
            start_block,
            None,
            1,
            DEFAULT_PAGE_SIZE,
        )
        .await
    }

    /// Get ERC-721 (NFT) transfers with pagination
    pub async fn get_nft_transfers_paginated(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc721Transfer>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.min(MAX_RESULTS_PER_PAGE).to_string();

        let mut params = vec![
            ("address", address),
            ("startblock", start.as_str()),
            ("endblock", end.as_str()),
            ("page", page_str.as_str()),
            ("offset", offset_str.as_str()),
            ("sort", "desc"),
        ];

        let contract_str;
        if let Some(contract) = contract_address {
            contract_str = contract.to_string();
            params.push(("contractaddress", &contract_str));
        }

        let url = self.build_url("account", "tokennfttx", &params);

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get ERC-1155 multi-token transfers for an address
    pub async fn get_erc1155_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
    ) -> ChainResult<Vec<Erc1155Transfer>> {
        self.get_erc1155_transfers_paginated(
            address,
            contract_address,
            start_block,
            None,
            1,
            DEFAULT_PAGE_SIZE,
        )
        .await
    }

    /// Get ERC-1155 transfers with pagination
    pub async fn get_erc1155_transfers_paginated(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc1155Transfer>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.min(MAX_RESULTS_PER_PAGE).to_string();

        let mut params = vec![
            ("address", address),
            ("startblock", start.as_str()),
            ("endblock", end.as_str()),
            ("page", page_str.as_str()),
            ("offset", offset_str.as_str()),
            ("sort", "desc"),
        ];

        let contract_str;
        if let Some(contract) = contract_address {
            contract_str = contract.to_string();
            params.push(("contractaddress", &contract_str));
        }

        let url = self.build_url("account", "token1155tx", &params);

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    // =========================================================================
    // BALANCE METHODS
    // =========================================================================

    /// Get native balance for an address (in wei)
    pub async fn get_native_balance(&self, address: &str) -> ChainResult<String> {
        let url = self.build_url(
            "account",
            "balance",
            &[("address", address), ("tag", "latest")],
        );

        self.request(&url).await
    }

    /// Get native balances for multiple addresses (batch)
    pub async fn get_native_balances(
        &self,
        addresses: &[&str],
    ) -> ChainResult<Vec<(String, String)>> {
        if addresses.is_empty() {
            return Ok(Vec::new());
        }

        // Etherscan supports up to 20 addresses per call
        let addresses_str = addresses.join(",");
        let url = self.build_url(
            "account",
            "balancemulti",
            &[("address", &addresses_str), ("tag", "latest")],
        );

        #[derive(Debug, Deserialize)]
        struct BalanceResult {
            account: String,
            balance: String,
        }

        let results: Vec<BalanceResult> = self.request(&url).await?;
        Ok(results
            .into_iter()
            .map(|r| (r.account, r.balance))
            .collect())
    }

    /// Get token balance for an address
    pub async fn get_token_balance(
        &self,
        address: &str,
        contract_address: &str,
    ) -> ChainResult<String> {
        let url = self.build_url(
            "account",
            "tokenbalance",
            &[
                ("address", address),
                ("contractaddress", contract_address),
                ("tag", "latest"),
            ],
        );

        self.request(&url).await
    }

    // =========================================================================
    // BLOCK & GAS METHODS
    // =========================================================================

    /// Get current block number
    pub async fn get_block_number(&self) -> ChainResult<u64> {
        let url = self.build_url("proxy", "eth_blockNumber", &[]);

        let result: String = self.request(&url).await?;

        // Result is hex string like "0x123abc"
        u64::from_str_radix(result.trim_start_matches("0x"), 16)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get gas price in wei
    pub async fn get_gas_price(&self) -> ChainResult<String> {
        let url = self.build_url("proxy", "eth_gasPrice", &[]);
        self.request(&url).await
    }

    /// Get gas oracle (safe, proposed, fast gas prices)
    pub async fn get_gas_oracle(&self) -> ChainResult<GasOracle> {
        let url = self.build_url("gastracker", "gasoracle", &[]);
        self.request(&url).await
    }

    // =========================================================================
    // CONTRACT METHODS
    // =========================================================================

    /// Get contract ABI if verified
    pub async fn get_contract_abi(&self, address: &str) -> ChainResult<String> {
        let url = self.build_url("contract", "getabi", &[("address", address)]);
        self.request(&url).await
    }

    /// Get contract source code
    pub async fn get_contract_source(&self, address: &str) -> ChainResult<Vec<ContractSource>> {
        let url = self.build_url("contract", "getsourcecode", &[("address", address)]);
        self.request(&url).await
    }

    /// Check if contract is verified
    pub async fn is_contract_verified(&self, address: &str) -> ChainResult<bool> {
        match self.get_contract_abi(address).await {
            Ok(abi) => Ok(!abi.is_empty() && abi != "Contract source code not verified"),
            Err(ChainError::ApiError(msg)) if msg.contains("not verified") => Ok(false),
            Err(e) => Err(e),
        }
    }
}

// =============================================================================
// ADDITIONAL TYPES
// =============================================================================

/// Gas oracle response
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct GasOracle {
    /// Safe gas price (slow)
    pub safe_gas_price: String,
    /// Proposed gas price (standard)
    pub propose_gas_price: String,
    /// Fast gas price
    pub fast_gas_price: String,
    /// Suggested base fee
    #[serde(default)]
    pub suggested_base_fee: Option<String>,
    /// Gas used ratio
    #[serde(default)]
    pub gas_used_ratio: Option<String>,
}

/// Contract source code response
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ContractSource {
    /// Source code
    pub source_code: String,
    /// ABI
    #[serde(rename = "ABI")]
    pub abi: String,
    /// Contract name
    pub contract_name: String,
    /// Compiler version
    pub compiler_version: String,
    /// Optimization used
    pub optimization_used: String,
    /// Number of optimization runs
    pub runs: String,
    /// Constructor arguments
    pub constructor_arguments: String,
    /// EVM version
    #[serde(rename = "EVMVersion")]
    pub evm_version: String,
    /// Library used
    pub library: String,
    /// License type
    pub license_type: String,
    /// Proxy contract (0 or 1)
    pub proxy: String,
    /// Implementation address (for proxy contracts)
    pub implementation: String,
    /// Swarm source
    pub swarm_source: String,
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

// Keep old method names for backward compatibility
impl EtherscanClient {
    /// Alias for get_normal_transactions_paginated (backward compatibility)
    pub async fn get_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<EvmTransaction>> {
        self.get_normal_transactions_paginated(address, start_block, end_block, page, offset)
            .await
    }

    /// Alias for get_token_transfers_paginated (backward compatibility)
    pub async fn get_erc20_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc20Transfer>> {
        self.get_token_transfers_paginated(
            address,
            contract_address,
            start_block,
            end_block,
            page,
            offset,
        )
        .await
    }

    /// Alias for get_nft_transfers_paginated (backward compatibility)
    pub async fn get_erc721_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc721Transfer>> {
        self.get_nft_transfers_paginated(
            address,
            contract_address,
            start_block,
            end_block,
            page,
            offset,
        )
        .await
    }

    /// Alias for get_native_balance (backward compatibility)
    pub async fn get_balance(&self, address: &str) -> ChainResult<String> {
        self.get_native_balance(address).await
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_client() -> EtherscanClient {
        let config = EvmChainConfig::new(
            1,
            "ethereum",
            "ETH",
            "https://eth-mainnet.g.alchemy.com/v2",
            "https://api.etherscan.io/api",
            false,
            12,
        );

        EtherscanClient::new(&config, Some("TEST_KEY".to_string())).unwrap()
    }

    #[test]
    fn test_build_url() {
        let client = create_test_client();

        let url = client.build_url("account", "txlist", &[("address", "0x123")]);

        assert!(url.contains("module=account"));
        assert!(url.contains("action=txlist"));
        assert!(url.contains("address=0x123"));
        assert!(url.contains("apikey=TEST_KEY"));
    }

    #[test]
    fn test_build_url_no_api_key() {
        let fetcher_config = FetcherConfig {
            base_url: "https://api.etherscan.io/api".to_string(),
            api_key: None,
            requests_per_second: 1,
            timeout_secs: 30,
            max_retries: 3,
        };
        let fetcher = ResilientFetcher::new(fetcher_config).unwrap();

        let client = EtherscanClient {
            fetcher,
            base_url: "https://api.etherscan.io/api".to_string(),
            api_key: None,
            chain_id: 1,
            chain_name: "ethereum".to_string(),
        };

        let url = client.build_url("account", "balance", &[("address", "0x123")]);

        assert!(!url.contains("apikey="));
    }

    #[test]
    fn test_from_chain_id() {
        let client = EtherscanClient::from_chain_id(1, Some("KEY".to_string()));
        assert!(client.is_ok());

        let client = client.unwrap();
        assert_eq!(client.chain_id(), 1);
        assert_eq!(client.chain_name(), "ethereum");
    }

    #[test]
    fn test_from_chain_id_unsupported() {
        let client = EtherscanClient::from_chain_id(999999, None);
        assert!(client.is_err());
    }

    #[test]
    fn test_turbo_mode_with_api_key() {
        let client = EtherscanClient::from_chain_id(1, Some("TEST_KEY".to_string())).unwrap();
        assert!(client.is_turbo_mode());
        assert_eq!(client.rate_limit(), 5); // Turbo Mode: 5 req/sec
    }

    #[test]
    fn test_default_mode_without_api_key() {
        // Without explicit key and no keychain key, should use default rate
        let config = EvmChainConfig::new(
            1,
            "ethereum",
            "ETH",
            "https://eth-mainnet.g.alchemy.com/v2",
            "https://api.etherscan.io/api",
            false,
            12,
        );
        let client = EtherscanClient::new(&config, None).unwrap();
        // Rate limit depends on whether there's a keychain key
        // In tests, there typically isn't, so it should be 1
        assert!(client.rate_limit() >= 1);
    }

    #[test]
    fn test_api_provider_mapping() {
        assert!(matches!(
            get_api_provider_for_chain(1),
            ApiProvider::Etherscan
        ));
        assert!(matches!(
            get_api_provider_for_chain(137),
            ApiProvider::Polygonscan
        ));
        assert!(matches!(
            get_api_provider_for_chain(42161),
            ApiProvider::Arbiscan
        ));
        assert!(matches!(
            get_api_provider_for_chain(8453),
            ApiProvider::Basescan
        ));
        assert!(matches!(
            get_api_provider_for_chain(10),
            ApiProvider::Optimism
        ));
    }

    #[test]
    fn test_gas_oracle_deserialize() {
        let json = r#"{
            "SafeGasPrice": "20",
            "ProposeGasPrice": "22",
            "FastGasPrice": "25",
            "suggestBaseFee": "19.5",
            "gasUsedRatio": "0.5,0.6,0.7"
        }"#;

        let oracle: GasOracle = serde_json::from_str(json).unwrap();
        assert_eq!(oracle.safe_gas_price, "20");
        assert_eq!(oracle.propose_gas_price, "22");
        assert_eq!(oracle.fast_gas_price, "25");
    }

    fn make_evm_tx(hash: &str, block: &str) -> EvmTransaction {
        EvmTransaction {
            hash: hash.to_string(),
            block_number: block.to_string(),
            time_stamp: "0".to_string(),
            from: String::new(),
            to: String::new(),
            value: "0".to_string(),
            gas: "0".to_string(),
            gas_price: "0".to_string(),
            gas_used: "0".to_string(),
            nonce: String::new(),
            is_error: "0".to_string(),
            tx_receipt_status: "1".to_string(),
            input: String::new(),
            contract_address: String::new(),
            function_name: String::new(),
            method_id: String::new(),
            confirmations: String::new(),
            cumulative_gas_used: String::new(),
            max_fee_per_gas: String::new(),
            max_priority_fee_per_gas: String::new(),
        }
    }

    #[test]
    fn test_has_block_and_hash_evm_tx() {
        let tx = make_evm_tx("0xabc", "12345");
        assert_eq!(tx.block_num(), 12345);
        assert_eq!(tx.dedup_key(), "0xabc");
    }

    #[test]
    fn test_has_block_and_hash_internal_tx() {
        let tx = InternalTransaction {
            hash: "0xabc".to_string(),
            block_number: "100".to_string(),
            time_stamp: "0".to_string(),
            from: String::new(),
            to: String::new(),
            value: "0".to_string(),
            contract_address: String::new(),
            trace_type: "call".to_string(),
            gas: String::new(),
            gas_used: String::new(),
            is_error: "0".to_string(),
            err_code: String::new(),
            trace_id: "0_1".to_string(),
        };
        assert_eq!(tx.block_num(), 100);
        assert_eq!(tx.dedup_key(), "0xabc:0_1");
    }

    #[test]
    fn test_has_block_and_hash_erc20() {
        let tx = Erc20Transfer {
            hash: "0xdef".to_string(),
            block_number: "200".to_string(),
            time_stamp: "0".to_string(),
            from: String::new(),
            to: String::new(),
            value: "0".to_string(),
            contract_address: String::new(),
            token_name: String::new(),
            token_symbol: String::new(),
            token_decimal: "18".to_string(),
            log_index: "3".to_string(),
            transaction_index: String::new(),
            gas_used: String::new(),
            gas_price: String::new(),
            nonce: String::new(),
        };
        assert_eq!(tx.block_num(), 200);
        assert_eq!(tx.dedup_key(), "0xdef:3");
    }

    #[tokio::test]
    async fn test_fetch_all_windowed_dedup() {
        let client = create_test_client();
        let call_count = std::sync::atomic::AtomicU32::new(0);

        let result: ChainResult<Vec<EvmTransaction>> = client
            .fetch_all_windowed(Some(0), None, |_sb, _eb| {
                let n = call_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                async move {
                    if n == 0 {
                        // Return 3 txs (< MAX_RESULTS_PER_PAGE so it stops)
                        Ok(vec![
                            make_evm_tx("0x1", "100"),
                            make_evm_tx("0x2", "100"),
                            make_evm_tx("0x1", "100"), // duplicate
                        ])
                    } else {
                        Ok(Vec::new())
                    }
                }
            })
            .await;

        let txs = result.unwrap();
        assert_eq!(txs.len(), 2);
        assert_eq!(txs[0].hash, "0x1");
        assert_eq!(txs[1].hash, "0x2");
        assert_eq!(call_count.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn test_fetch_all_windowed_advances_start_block() {
        let client = create_test_client();
        let starts = std::sync::Arc::new(std::sync::Mutex::new(Vec::<u64>::new()));
        let starts_clone = starts.clone();

        let result: ChainResult<Vec<EvmTransaction>> = client
            .fetch_all_windowed(Some(0), None, |sb, _eb| {
                starts_clone.lock().unwrap().push(sb);
                let n = starts_clone.lock().unwrap().len();
                async move {
                    if n == 1 {
                        // Return full page: len == MAX_RESULTS_PER_PAGE
                        let mut txs = Vec::new();
                        for i in 0..MAX_RESULTS_PER_PAGE {
                            txs.push(make_evm_tx(
                                &format!("0x{:04x}", i),
                                &(100 + i / 100).to_string(),
                            ));
                        }
                        Ok(txs)
                    } else {
                        // Second call returns partial page → stop
                        Ok(vec![make_evm_tx("0xfinal", "200")])
                    }
                }
            })
            .await;

        result.unwrap();
        let recorded = starts.lock().unwrap();
        assert_eq!(recorded.len(), 2);
        assert_eq!(recorded[0], 0);
        assert!(recorded[1] > 0, "start_block should advance past 0");
    }

    #[tokio::test]
    async fn test_fetch_all_windowed_same_block_guard() {
        let client = create_test_client();
        let call_count = std::sync::atomic::AtomicU32::new(0);
        let starts = std::sync::Arc::new(std::sync::Mutex::new(Vec::<u64>::new()));
        let starts_clone = starts.clone();

        let _result: ChainResult<Vec<EvmTransaction>> = client
            .fetch_all_windowed(Some(50), None, |sb, _eb| {
                starts_clone.lock().unwrap().push(sb);
                let n = call_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                async move {
                    if n == 0 {
                        // Full window, all in block 50 → triggers same-block guard
                        let txs: Vec<EvmTransaction> = (0..MAX_RESULTS_PER_PAGE)
                            .map(|i| make_evm_tx(&format!("0x{:04x}", i), "50"))
                            .collect();
                        Ok(txs)
                    } else {
                        Ok(Vec::new())
                    }
                }
            })
            .await;

        let recorded = starts.lock().unwrap();
        assert_eq!(recorded.len(), 2);
        // First call: start=50, last_block=50 → same → next start=51
        assert_eq!(recorded[0], 50);
        assert_eq!(recorded[1], 51);
    }
}
