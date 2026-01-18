//! Etherscan-compatible API Client
//!
//! Supports Etherscan and compatible block explorer APIs (Polygonscan, Arbiscan, etc.)
//! Includes rate limiting, automatic retry, and pagination handling.

use super::config::{get_chain_config, EvmChainConfig};
use super::types::{
    Erc1155Transfer, Erc20Transfer, Erc721Transfer, EvmTransaction, InternalTransaction,
};
use crate::chains::{ChainError, ChainResult};
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::time::sleep;

// =============================================================================
// CONSTANTS
// =============================================================================

/// Maximum results per API call (Etherscan limit)
const MAX_RESULTS_PER_PAGE: u32 = 10000;

/// Default page size for pagination
const DEFAULT_PAGE_SIZE: u32 = 1000;

/// Maximum retry attempts for rate-limited requests
const MAX_RETRIES: u32 = 5;

/// Base delay for exponential backoff (milliseconds)
const BASE_RETRY_DELAY_MS: u64 = 200;

/// Rate limit: 5 requests per second
const RATE_LIMIT_PERMITS: usize = 5;

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
// RATE LIMITER
// =============================================================================

/// Simple rate limiter using a semaphore with time-based permit release
#[derive(Clone)]
pub struct RateLimiter {
    semaphore: Arc<Semaphore>,
    delay_ms: u64,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(permits_per_second: usize) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(permits_per_second)),
            delay_ms: 1000 / permits_per_second as u64,
        }
    }

    /// Acquire a permit, waiting if necessary
    pub async fn acquire(&self) {
        let permit = self.semaphore.clone().acquire_owned().await.unwrap();

        // Spawn a task to release the permit after the rate limit window
        let delay = self.delay_ms;
        tokio::spawn(async move {
            sleep(Duration::from_millis(delay)).await;
            drop(permit);
        });
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new(RATE_LIMIT_PERMITS)
    }
}

// =============================================================================
// ETHERSCAN CLIENT
// =============================================================================

/// Etherscan-compatible API client with rate limiting and retry logic
pub struct EtherscanClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    chain_id: u64,
    chain_name: String,
    rate_limiter: RateLimiter,
}

impl EtherscanClient {
    /// Create a new Etherscan client from chain ID
    ///
    /// Looks up the chain configuration and constructs the client.
    pub fn from_chain_id(chain_id: u64, api_key: Option<String>) -> ChainResult<Self> {
        let config = get_chain_config(chain_id)
            .ok_or_else(|| ChainError::UnsupportedChain(format!("chain_id: {}", chain_id)))?;

        Self::new(&config, api_key)
    }

    /// Create a new Etherscan client from chain config
    pub fn new(config: &EvmChainConfig, api_key: Option<String>) -> ChainResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ChainError::Internal(e.to_string()))?;

        Ok(Self {
            client,
            base_url: config.explorer_api_url.clone(),
            api_key,
            chain_id: config.chain_id,
            chain_name: config.name.clone(),
            rate_limiter: RateLimiter::default(),
        })
    }

    /// Create with custom rate limiter
    pub fn with_rate_limiter(mut self, rate_limiter: RateLimiter) -> Self {
        self.rate_limiter = rate_limiter;
        self
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
        let mut url = format!("{}?module={}&action={}", self.base_url, module, action);

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

    /// Make API request with rate limiting and retry logic
    async fn request<T: DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        let mut last_error = ChainError::Internal("No attempts made".to_string());

        for attempt in 0..MAX_RETRIES {
            // Apply rate limiting
            self.rate_limiter.acquire().await;

            match self.execute_request::<T>(url).await {
                Ok(result) => return Ok(result),
                Err(ChainError::RateLimited) => {
                    // Exponential backoff for rate limits
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

    /// Execute a single request without retry
    async fn execute_request<T: DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| ChainError::ApiError(format!("Network error: {}", e)))?;

        // Check HTTP status
        if response.status() == 429 {
            return Err(ChainError::RateLimited);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ChainError::ApiError(format!("HTTP {}: {}", status, body)));
        }

        // Get response text for parsing
        let text = response
            .text()
            .await
            .map_err(|e| ChainError::ParseError(format!("Failed to read response: {}", e)))?;

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

    /// Get all normal transactions with automatic pagination
    pub async fn get_all_normal_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
    ) -> ChainResult<Vec<EvmTransaction>> {
        let mut all_txs = Vec::new();
        let mut page = 1u32;

        loop {
            let txs = self
                .get_normal_transactions_paginated(
                    address,
                    start_block,
                    end_block,
                    page,
                    MAX_RESULTS_PER_PAGE,
                )
                .await?;

            let count = txs.len();
            all_txs.extend(txs);

            // If we got less than max, we've reached the end
            if count < MAX_RESULTS_PER_PAGE as usize {
                break;
            }

            page += 1;

            // Safety limit to prevent infinite loops
            if page > 100 {
                break;
            }
        }

        Ok(all_txs)
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
    fn test_rate_limiter_creation() {
        let limiter = RateLimiter::new(5);
        assert_eq!(limiter.delay_ms, 200); // 1000ms / 5 permits = 200ms
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
}
