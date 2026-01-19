//! Alchemy/JSON-RPC Client
//!
//! Provides RPC access to EVM chains via Alchemy or any standard JSON-RPC endpoint.
//! Used for real-time balance queries, contract reads, gas estimation, and other
//! operations that Etherscan doesn't provide well.

use super::config::{get_chain_config, EvmChainConfig};
use crate::chains::{ChainError, ChainResult, NativeBalance, TokenBalance};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

// =============================================================================
// JSON-RPC TYPES
// =============================================================================

/// JSON-RPC request
#[derive(Debug, Serialize)]
struct RpcRequest {
    jsonrpc: &'static str,
    method: String,
    params: Value,
    id: u64,
}

/// JSON-RPC response
#[derive(Debug, Deserialize)]
struct RpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    result: Option<Value>,
    error: Option<RpcError>,
    #[allow(dead_code)]
    id: u64,
}

/// JSON-RPC error
#[derive(Debug, Deserialize)]
struct RpcError {
    code: i64,
    message: String,
    #[serde(default)]
    data: Option<Value>,
}

// =============================================================================
// TRANSACTION TYPES
// =============================================================================

/// Transaction from eth_getTransactionByHash
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcTransaction {
    /// Transaction hash
    pub hash: String,
    /// Nonce
    pub nonce: String,
    /// Block hash (null if pending)
    pub block_hash: Option<String>,
    /// Block number (null if pending)
    pub block_number: Option<String>,
    /// Transaction index in block
    pub transaction_index: Option<String>,
    /// Sender address
    pub from: String,
    /// Recipient address (null for contract creation)
    pub to: Option<String>,
    /// Value in wei
    pub value: String,
    /// Gas limit
    pub gas: String,
    /// Gas price
    pub gas_price: Option<String>,
    /// Input data
    pub input: String,
    /// ECDSA recovery id
    pub v: Option<String>,
    /// ECDSA signature r
    pub r: Option<String>,
    /// ECDSA signature s
    pub s: Option<String>,
    /// EIP-2718 transaction type
    #[serde(rename = "type")]
    pub tx_type: Option<String>,
    /// EIP-1559 max fee per gas
    pub max_fee_per_gas: Option<String>,
    /// EIP-1559 max priority fee per gas
    pub max_priority_fee_per_gas: Option<String>,
    /// Chain ID
    pub chain_id: Option<String>,
    /// Access list (EIP-2930)
    #[serde(default)]
    pub access_list: Option<Vec<AccessListItem>>,
}

/// Access list item for EIP-2930 transactions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessListItem {
    pub address: String,
    pub storage_keys: Vec<String>,
}

/// Transaction receipt from eth_getTransactionReceipt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionReceipt {
    /// Transaction hash
    pub transaction_hash: String,
    /// Transaction index in block
    pub transaction_index: String,
    /// Block hash
    pub block_hash: String,
    /// Block number
    pub block_number: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: Option<String>,
    /// Cumulative gas used in block
    pub cumulative_gas_used: String,
    /// Effective gas price
    #[serde(default)]
    pub effective_gas_price: Option<String>,
    /// Gas used by this transaction
    pub gas_used: String,
    /// Contract address created (if contract deployment)
    pub contract_address: Option<String>,
    /// Logs emitted
    pub logs: Vec<Log>,
    /// Logs bloom filter
    pub logs_bloom: String,
    /// Transaction type
    #[serde(rename = "type")]
    pub tx_type: Option<String>,
    /// Status (1 = success, 0 = failure)
    pub status: Option<String>,
    /// State root (pre-Byzantium)
    #[serde(default)]
    pub root: Option<String>,
}

impl TransactionReceipt {
    /// Check if transaction succeeded
    pub fn is_success(&self) -> bool {
        self.status.as_deref() == Some("0x1")
    }

    /// Get gas used as u64
    pub fn gas_used_u64(&self) -> u64 {
        hex_to_u64(&self.gas_used).unwrap_or(0)
    }

    /// Get block number as u64
    pub fn block_number_u64(&self) -> u64 {
        hex_to_u64(&self.block_number).unwrap_or(0)
    }
}

/// Log entry from transaction receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Log {
    /// Contract address that emitted the log
    pub address: String,
    /// Log topics (indexed parameters)
    pub topics: Vec<String>,
    /// Log data (non-indexed parameters)
    pub data: String,
    /// Block number
    pub block_number: Option<String>,
    /// Transaction hash
    pub transaction_hash: Option<String>,
    /// Transaction index
    pub transaction_index: Option<String>,
    /// Block hash
    pub block_hash: Option<String>,
    /// Log index in block
    pub log_index: Option<String>,
    /// Whether log was removed (reorg)
    #[serde(default)]
    pub removed: Option<bool>,
}

/// Block header from eth_getBlockByNumber
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    /// Block number
    pub number: Option<String>,
    /// Block hash
    pub hash: Option<String>,
    /// Parent block hash
    pub parent_hash: String,
    /// Nonce
    pub nonce: Option<String>,
    /// SHA3 of uncles
    pub sha3_uncles: String,
    /// Logs bloom filter
    pub logs_bloom: Option<String>,
    /// Transactions root
    pub transactions_root: String,
    /// State root
    pub state_root: String,
    /// Receipts root
    pub receipts_root: String,
    /// Miner address
    pub miner: String,
    /// Difficulty
    pub difficulty: Option<String>,
    /// Total difficulty
    pub total_difficulty: Option<String>,
    /// Extra data
    pub extra_data: String,
    /// Block size
    pub size: Option<String>,
    /// Gas limit
    pub gas_limit: String,
    /// Gas used
    pub gas_used: String,
    /// Block timestamp
    pub timestamp: String,
    /// Transactions (hashes or full objects)
    #[serde(default)]
    pub transactions: Vec<Value>,
    /// Uncle hashes
    #[serde(default)]
    pub uncles: Vec<String>,
    /// Base fee per gas (EIP-1559)
    pub base_fee_per_gas: Option<String>,
}

impl Block {
    /// Get block number as u64
    pub fn number_u64(&self) -> Option<u64> {
        self.number.as_ref().and_then(|n| hex_to_u64(n).ok())
    }

    /// Get timestamp as u64
    pub fn timestamp_u64(&self) -> u64 {
        hex_to_u64(&self.timestamp).unwrap_or(0)
    }

    /// Get base fee as u128
    pub fn base_fee_u128(&self) -> Option<u128> {
        self.base_fee_per_gas
            .as_ref()
            .and_then(|f| hex_to_u128(f).ok())
    }
}

// =============================================================================
// ALCHEMY CLIENT
// =============================================================================

/// Alchemy/JSON-RPC client for EVM chains
pub struct AlchemyClient {
    client: Client,
    rpc_url: String,
    chain_config: EvmChainConfig,
    request_id: AtomicU64,
}

impl AlchemyClient {
    /// Create a new RPC client from chain ID
    ///
    /// Looks up the chain configuration and constructs the RPC URL.
    pub fn from_chain_id(chain_id: u64, api_key: Option<&str>) -> ChainResult<Self> {
        let config = get_chain_config(chain_id)
            .ok_or_else(|| ChainError::UnsupportedChain(format!("chain_id: {}", chain_id)))?;

        // If API key provided, construct URL with it
        let rpc_url = if let Some(key) = api_key {
            format!("{}/{}", config.rpc_url, key)
        } else {
            config
                .get_rpc_url()
                .map_err(|e| ChainError::ConfigError(e.to_string()))?
        };

        Self::with_url(&config, &rpc_url)
    }

    /// Create a new RPC client from config
    pub fn new(config: &EvmChainConfig, rpc_url: Option<&str>) -> ChainResult<Self> {
        let url = if let Some(override_url) = rpc_url {
            override_url.to_string()
        } else {
            config
                .get_rpc_url()
                .map_err(|e| ChainError::ConfigError(e.to_string()))?
        };

        Self::with_url(config, &url)
    }

    /// Create a new RPC client with explicit URL
    pub fn with_url(config: &EvmChainConfig, rpc_url: &str) -> ChainResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ChainError::Internal(e.to_string()))?;

        Ok(Self {
            client,
            rpc_url: rpc_url.to_string(),
            chain_config: config.clone(),
            request_id: AtomicU64::new(1),
        })
    }

    /// Get the chain configuration
    pub fn chain_config(&self) -> &EvmChainConfig {
        &self.chain_config
    }

    /// Get the RPC URL
    pub fn rpc_url(&self) -> &str {
        &self.rpc_url
    }

    // =========================================================================
    // CORE RPC METHOD
    // =========================================================================

    /// Get next request ID
    fn next_id(&self) -> u64 {
        self.request_id.fetch_add(1, Ordering::SeqCst)
    }

    /// Make a JSON-RPC call
    ///
    /// This is the core method that all other methods use.
    pub async fn rpc_call<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: Value,
    ) -> ChainResult<T> {
        let result = self.call_raw(method, params).await?;
        serde_json::from_value(result).map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Make a raw JSON-RPC call returning Value
    async fn call_raw(&self, method: &str, params: Value) -> ChainResult<Value> {
        let request = RpcRequest {
            jsonrpc: "2.0",
            method: method.to_string(),
            params,
            id: self.next_id(),
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| ChainError::RpcError(format!("Network error: {}", e)))?;

        if response.status() == 429 {
            return Err(ChainError::RateLimited);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ChainError::RpcError(format!("HTTP {}: {}", status, body)));
        }

        let rpc_response: RpcResponse = response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))?;

        if let Some(error) = rpc_response.error {
            return Err(ChainError::RpcError(format!(
                "RPC error {}: {}",
                error.code, error.message
            )));
        }

        rpc_response
            .result
            .ok_or_else(|| ChainError::RpcError("Empty result".to_string()))
    }

    // Backward compatibility alias
    async fn call(&self, method: &str, params: Value) -> ChainResult<Value> {
        self.call_raw(method, params).await
    }

    // =========================================================================
    // BALANCE METHODS
    // =========================================================================

    /// Get native balance (eth_getBalance)
    pub async fn get_balance(&self, address: &str) -> ChainResult<NativeBalance> {
        let result = self
            .call("eth_getBalance", json!([address, "latest"]))
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        let balance_wei = hex_to_u128(hex_str).unwrap_or(0);
        let balance_formatted = format_wei(balance_wei, self.chain_config.decimals);

        Ok(NativeBalance {
            symbol: self.chain_config.symbol.clone(),
            decimals: self.chain_config.decimals,
            balance: balance_wei.to_string(),
            balance_formatted,
        })
    }

    /// Get native balance as raw wei string
    pub async fn get_balance_raw(&self, address: &str) -> ChainResult<String> {
        let result = self
            .call("eth_getBalance", json!([address, "latest"]))
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        let balance = hex_to_u128(hex_str).unwrap_or(0);
        Ok(balance.to_string())
    }

    /// Get ERC-20 token balance
    pub async fn get_token_balance(
        &self,
        address: &str,
        token_address: &str,
    ) -> ChainResult<String> {
        // balanceOf(address) function selector: 0x70a08231
        let data = encode_balance_of_call(address);

        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": data
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        // Parse the returned uint256 (handle both u128 and larger values)
        let balance = hex_to_decimal_string(hex_str);
        Ok(balance)
    }

    /// Get token decimals
    pub async fn get_token_decimals(&self, token_address: &str) -> ChainResult<u8> {
        // decimals() function selector: 0x313ce567
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": "0x313ce567"
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        // Decimals is typically a small number, u8 is sufficient
        let decimals = hex_to_u64(hex_str).unwrap_or(18) as u8;
        Ok(decimals)
    }

    /// Get token symbol
    pub async fn get_token_symbol(&self, token_address: &str) -> ChainResult<String> {
        // symbol() function selector: 0x95d89b41
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": "0x95d89b41"
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        decode_abi_string(hex_str)
    }

    /// Get token name
    pub async fn get_token_name(&self, token_address: &str) -> ChainResult<String> {
        // name() function selector: 0x06fdde03
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": "0x06fdde03"
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        decode_abi_string(hex_str)
    }

    /// Get full token info including balance
    pub async fn get_token_info(
        &self,
        address: &str,
        token_address: &str,
    ) -> ChainResult<TokenBalance> {
        let balance = self.get_token_balance(address, token_address).await?;
        let decimals = self.get_token_decimals(token_address).await.unwrap_or(18);
        let symbol = self.get_token_symbol(token_address).await.ok();
        let name = self.get_token_name(token_address).await.ok();

        let balance_u128: u128 = balance.parse().unwrap_or(0);
        let balance_formatted = format_wei(balance_u128, decimals);

        Ok(TokenBalance {
            token_address: token_address.to_string(),
            token_symbol: symbol,
            token_name: name,
            token_decimals: decimals,
            balance,
            balance_formatted,
        })
    }

    // =========================================================================
    // TRANSACTION METHODS
    // =========================================================================

    /// Get transaction by hash (eth_getTransactionByHash)
    pub async fn get_transaction(&self, hash: &str) -> ChainResult<Option<RpcTransaction>> {
        let result = self.call("eth_getTransactionByHash", json!([hash])).await?;

        if result.is_null() {
            return Ok(None);
        }

        serde_json::from_value(result)
            .map(Some)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get transaction by hash as raw Value
    pub async fn get_transaction_raw(&self, hash: &str) -> ChainResult<Value> {
        self.call("eth_getTransactionByHash", json!([hash])).await
    }

    /// Get transaction receipt (eth_getTransactionReceipt)
    pub async fn get_transaction_receipt(
        &self,
        hash: &str,
    ) -> ChainResult<Option<TransactionReceipt>> {
        let result = self
            .call("eth_getTransactionReceipt", json!([hash]))
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        serde_json::from_value(result)
            .map(Some)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get transaction receipt as raw Value
    pub async fn get_transaction_receipt_raw(&self, hash: &str) -> ChainResult<Value> {
        self.call("eth_getTransactionReceipt", json!([hash])).await
    }

    /// Get transaction count (nonce) for address
    pub async fn get_transaction_count(&self, address: &str) -> ChainResult<u64> {
        let result = self
            .call("eth_getTransactionCount", json!([address, "latest"]))
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        hex_to_u64(hex_str)
    }

    // =========================================================================
    // BLOCK METHODS
    // =========================================================================

    /// Get current block number (eth_blockNumber)
    pub async fn get_block_number(&self) -> ChainResult<u64> {
        let result = self.call("eth_blockNumber", json!([])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        hex_to_u64(hex_str)
    }

    /// Get block by number
    pub async fn get_block(&self, block_number: u64, full_txs: bool) -> ChainResult<Option<Block>> {
        let block_hex = format!("0x{:x}", block_number);
        let result = self
            .call("eth_getBlockByNumber", json!([block_hex, full_txs]))
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        serde_json::from_value(result)
            .map(Some)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get block by hash
    pub async fn get_block_by_hash(
        &self,
        hash: &str,
        full_txs: bool,
    ) -> ChainResult<Option<Block>> {
        let result = self
            .call("eth_getBlockByHash", json!([hash, full_txs]))
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        serde_json::from_value(result)
            .map(Some)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get latest block
    pub async fn get_latest_block(&self, full_txs: bool) -> ChainResult<Option<Block>> {
        let result = self
            .call("eth_getBlockByNumber", json!(["latest", full_txs]))
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        serde_json::from_value(result)
            .map(Some)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    // =========================================================================
    // CHAIN INFO METHODS
    // =========================================================================

    /// Get chain ID (eth_chainId)
    pub async fn get_chain_id(&self) -> ChainResult<u64> {
        let result = self.call("eth_chainId", json!([])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        hex_to_u64(hex_str)
    }

    /// Get gas price (eth_gasPrice)
    pub async fn get_gas_price(&self) -> ChainResult<String> {
        let result = self.call("eth_gasPrice", json!([])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        Ok(hex_to_decimal_string(hex_str))
    }

    /// Get gas price as hex
    pub async fn get_gas_price_hex(&self) -> ChainResult<String> {
        let result = self.call("eth_gasPrice", json!([])).await?;

        result
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))
    }

    /// Get max priority fee per gas (EIP-1559)
    pub async fn get_max_priority_fee(&self) -> ChainResult<String> {
        let result = self.call("eth_maxPriorityFeePerGas", json!([])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        Ok(hex_to_decimal_string(hex_str))
    }

    /// Estimate gas for a transaction (eth_estimateGas)
    pub async fn estimate_gas(
        &self,
        from: &str,
        to: &str,
        value: Option<&str>,
        data: Option<&str>,
    ) -> ChainResult<u64> {
        let mut tx = json!({
            "from": from,
            "to": to
        });

        if let Some(v) = value {
            tx["value"] = json!(v);
        }

        if let Some(d) = data {
            tx["data"] = json!(d);
        }

        let result = self.call("eth_estimateGas", json!([tx])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        hex_to_u64(hex_str)
    }

    /// Get fee history (EIP-1559)
    pub async fn get_fee_history(
        &self,
        block_count: u64,
        newest_block: &str,
        reward_percentiles: &[f64],
    ) -> ChainResult<Value> {
        self.call(
            "eth_feeHistory",
            json!([
                format!("0x{:x}", block_count),
                newest_block,
                reward_percentiles
            ]),
        )
        .await
    }

    // =========================================================================
    // LOG METHODS
    // =========================================================================

    /// Get logs with filter (eth_getLogs)
    pub async fn get_logs(
        &self,
        from_block: u64,
        to_block: u64,
        address: Option<&str>,
        topics: Option<Vec<Option<String>>>,
    ) -> ChainResult<Vec<Log>> {
        let mut filter = json!({
            "fromBlock": format!("0x{:x}", from_block),
            "toBlock": format!("0x{:x}", to_block)
        });

        if let Some(addr) = address {
            filter["address"] = json!(addr);
        }

        if let Some(t) = topics {
            filter["topics"] = json!(t);
        }

        let result = self.call("eth_getLogs", json!([filter])).await?;

        serde_json::from_value(result).map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get logs as raw Value
    pub async fn get_logs_raw(
        &self,
        from_block: u64,
        to_block: u64,
        address: Option<&str>,
        topics: Option<Vec<Option<String>>>,
    ) -> ChainResult<Vec<Value>> {
        let mut filter = json!({
            "fromBlock": format!("0x{:x}", from_block),
            "toBlock": format!("0x{:x}", to_block)
        });

        if let Some(addr) = address {
            filter["address"] = json!(addr);
        }

        if let Some(t) = topics {
            filter["topics"] = json!(t);
        }

        let result = self.call("eth_getLogs", json!([filter])).await?;

        result
            .as_array()
            .cloned()
            .ok_or_else(|| ChainError::ParseError("Expected array".to_string()))
    }

    // =========================================================================
    // CODE METHODS
    // =========================================================================

    /// Get contract code (eth_getCode)
    pub async fn get_code(&self, address: &str) -> ChainResult<String> {
        let result = self.call("eth_getCode", json!([address, "latest"])).await?;

        result
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))
    }

    /// Check if address is a contract
    pub async fn is_contract(&self, address: &str) -> ChainResult<bool> {
        let code = self.get_code(address).await?;
        Ok(code != "0x" && !code.is_empty())
    }

    /// Generic contract call (eth_call)
    pub async fn eth_call(&self, to: &str, data: &str) -> ChainResult<String> {
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": to,
                        "data": data
                    },
                    "latest"
                ]),
            )
            .await?;

        result
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Encode balanceOf(address) call data
fn encode_balance_of_call(address: &str) -> String {
    // balanceOf(address) selector: 0x70a08231
    // Pad address to 32 bytes (64 hex chars)
    format!(
        "0x70a08231000000000000000000000000{}",
        address.trim_start_matches("0x")
    )
}

/// Convert hex string to u64
pub fn hex_to_u64(hex: &str) -> ChainResult<u64> {
    u64::from_str_radix(hex.trim_start_matches("0x"), 16)
        .map_err(|e| ChainError::ParseError(format!("Invalid hex u64: {}", e)))
}

/// Convert hex string to u128
pub fn hex_to_u128(hex: &str) -> ChainResult<u128> {
    u128::from_str_radix(hex.trim_start_matches("0x"), 16)
        .map_err(|e| ChainError::ParseError(format!("Invalid hex u128: {}", e)))
}

/// Convert hex string to decimal string (handles large numbers)
pub fn hex_to_decimal_string(hex: &str) -> String {
    let hex_clean = hex.trim_start_matches("0x");

    // Try u128 first (covers most cases)
    if let Ok(value) = u128::from_str_radix(hex_clean, 16) {
        return value.to_string();
    }

    // For larger numbers, use big integer parsing
    // Parse hex digit by digit
    let mut result = vec![0u8];

    for c in hex_clean.chars() {
        let digit = c.to_digit(16).unwrap_or(0) as u8;

        // Multiply result by 16
        let mut carry = 0u16;
        for byte in result.iter_mut().rev() {
            let prod = (*byte as u16) * 16 + carry;
            *byte = (prod % 10) as u8;
            carry = prod / 10;
        }
        while carry > 0 {
            result.insert(0, (carry % 10) as u8);
            carry /= 10;
        }

        // Add digit
        let mut carry = digit as u16;
        for byte in result.iter_mut().rev() {
            let sum = (*byte as u16) + carry;
            *byte = (sum % 10) as u8;
            carry = sum / 10;
        }
        while carry > 0 {
            result.insert(0, (carry % 10) as u8);
            carry /= 10;
        }
    }

    // Convert to string
    result.iter().map(|d| (b'0' + d) as char).collect()
}

/// Format wei balance with decimals
pub fn format_wei(wei: u128, decimals: u8) -> String {
    if decimals == 0 {
        return wei.to_string();
    }

    let divisor = 10u128.pow(decimals as u32);
    let whole = wei / divisor;
    let frac = wei % divisor;

    if frac == 0 {
        whole.to_string()
    } else {
        let frac_str = format!("{:0width$}", frac, width = decimals as usize);
        let trimmed = frac_str.trim_end_matches('0');
        if trimmed.is_empty() {
            whole.to_string()
        } else {
            format!("{}.{}", whole, trimmed)
        }
    }
}

/// Decode ABI-encoded string
pub fn decode_abi_string(hex: &str) -> ChainResult<String> {
    let bytes = hex::decode(hex.trim_start_matches("0x"))
        .map_err(|e| ChainError::ParseError(format!("Invalid hex: {}", e)))?;

    if bytes.len() < 64 {
        return Err(ChainError::ParseError(
            "Invalid ABI string encoding".to_string(),
        ));
    }

    // Skip offset (32 bytes) and read length (32 bytes)
    let length = u64::from_be_bytes(bytes[56..64].try_into().unwrap_or([0; 8])) as usize;

    if bytes.len() < 64 + length {
        return Err(ChainError::ParseError("String data too short".to_string()));
    }

    String::from_utf8(bytes[64..64 + length].to_vec())
        .map_err(|e| ChainError::ParseError(format!("Invalid UTF-8: {}", e)))
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_abi_string() {
        // "USDC" encoded
        let encoded = "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000455534443000000000000000000000000000000000000000000000000000000";

        let result = decode_abi_string(encoded);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "USDC");
    }

    #[test]
    fn test_hex_to_u64() {
        assert_eq!(hex_to_u64("0x1").unwrap(), 1);
        assert_eq!(hex_to_u64("0xff").unwrap(), 255);
        assert_eq!(hex_to_u64("0x100").unwrap(), 256);
        assert_eq!(hex_to_u64("1234").unwrap(), 0x1234);
    }

    #[test]
    fn test_hex_to_u128() {
        assert_eq!(
            hex_to_u128("0xde0b6b3a7640000").unwrap(),
            1_000_000_000_000_000_000
        ); // 1 ETH in wei
    }

    #[test]
    fn test_hex_to_decimal_string() {
        assert_eq!(hex_to_decimal_string("0x1"), "1");
        assert_eq!(hex_to_decimal_string("0xff"), "255");
        assert_eq!(
            hex_to_decimal_string("0xde0b6b3a7640000"),
            "1000000000000000000"
        );
    }

    #[test]
    fn test_format_wei() {
        assert_eq!(format_wei(1_000_000_000_000_000_000, 18), "1");
        assert_eq!(format_wei(1_500_000_000_000_000_000, 18), "1.5");
        assert_eq!(format_wei(1_234_567_890_000_000_000, 18), "1.23456789");
        assert_eq!(format_wei(100_000, 6), "0.1"); // USDC style
    }

    #[test]
    fn test_encode_balance_of() {
        let data = encode_balance_of_call("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
        assert!(data.starts_with("0x70a08231"));
        assert_eq!(data.len(), 74); // 0x + 8 (selector) + 64 (padded address)
    }

    #[test]
    fn test_from_chain_id() {
        // This will fail without API key in env, but tests the path
        let result = AlchemyClient::from_chain_id(1, Some("test_key"));
        assert!(result.is_ok());

        let client = result.unwrap();
        assert!(client.rpc_url().contains("test_key"));
    }

    #[test]
    fn test_transaction_receipt_helpers() {
        let receipt = TransactionReceipt {
            transaction_hash: "0x123".to_string(),
            transaction_index: "0x0".to_string(),
            block_hash: "0xabc".to_string(),
            block_number: "0x100".to_string(),
            from: "0x111".to_string(),
            to: Some("0x222".to_string()),
            cumulative_gas_used: "0x5208".to_string(),
            effective_gas_price: Some("0x3b9aca00".to_string()),
            gas_used: "0x5208".to_string(),
            contract_address: None,
            logs: vec![],
            logs_bloom: "0x00".to_string(),
            tx_type: Some("0x2".to_string()),
            status: Some("0x1".to_string()),
            root: None,
        };

        assert!(receipt.is_success());
        assert_eq!(receipt.gas_used_u64(), 21000);
        assert_eq!(receipt.block_number_u64(), 256);
    }
}
