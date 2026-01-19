//! Chain Adapter System
//!
//! Provides a unified interface for interacting with multiple blockchain networks.
//! Supports EVM-compatible chains and Substrate-based chains (Polkadot ecosystem).
//!
//! # Architecture
//!
//! - `ChainAdapter` trait: Common interface for all blockchain adapters
//! - `ChainManager`: Coordinates multiple adapters with lazy initialization
//! - Tauri commands in `commands` module expose functionality to frontend

#![allow(dead_code)]

pub mod commands;
pub mod evm;
pub mod substrate;

use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// Re-export Tauri commands for use in lib.rs
pub use commands::*;

// =============================================================================
// CORE TYPES
// =============================================================================

/// Supported chain families/types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainType {
    /// Ethereum Virtual Machine compatible chains
    Evm,
    /// Substrate-based chains (Polkadot ecosystem)
    Substrate,
    /// Solana blockchain (future support)
    Solana,
    /// Bitcoin and Bitcoin-like chains (future support)
    Bitcoin,
}

/// Chain identifier combining type, name, and numeric ID.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChainId {
    /// The blockchain type (EVM or Substrate).
    pub chain_type: ChainType,
    /// Human-readable chain name.
    pub name: String,
    /// Numeric chain ID (for EVM chains).
    pub chain_id: Option<u64>,
}

impl ChainId {
    /// Creates an EVM chain identifier.
    pub fn evm(name: impl Into<String>, chain_id: u64) -> Self {
        Self {
            chain_type: ChainType::Evm,
            name: name.into(),
            chain_id: Some(chain_id),
        }
    }

    /// Creates a Substrate chain identifier.
    pub fn substrate(name: impl Into<String>) -> Self {
        Self {
            chain_type: ChainType::Substrate,
            name: name.into(),
            chain_id: None,
        }
    }
}

/// Normalized transaction representation across all chains
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainTransaction {
    pub hash: String,
    pub chain_id: ChainId,
    pub block_number: u64,
    pub timestamp: i64,
    pub from: String,
    pub to: Option<String>,
    pub value: String,
    pub fee: String,
    pub status: TransactionStatus,
    pub tx_type: TransactionType,
    pub token_transfers: Vec<TokenTransfer>,
    pub raw_data: Option<serde_json::Value>,
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    Success,
    Failed,
    Pending,
}

/// Transaction type classification
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionType {
    Transfer,
    ContractCall,
    ContractDeploy,
    Swap,
    AddLiquidity,
    RemoveLiquidity,
    Stake,
    Unstake,
    Bridge,
    Mint,
    Burn,
    Approval,
    Unknown,
}

/// Token transfer within a transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransfer {
    pub token_address: String,
    pub token_symbol: Option<String>,
    pub token_decimals: Option<u8>,
    pub from: String,
    pub to: String,
    pub value: String,
}

/// Token balance for an ERC20 or similar token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    /// Token contract address.
    pub token_address: String,
    /// Token symbol (e.g., USDC).
    pub token_symbol: Option<String>,
    /// Token name (e.g., USD Coin).
    pub token_name: Option<String>,
    /// Token decimals for formatting.
    pub token_decimals: u8,
    /// Raw balance in smallest units.
    pub balance: String,
    /// Human-readable formatted balance.
    pub balance_formatted: String,
}

/// Native currency balance (e.g., ETH, DOT).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeBalance {
    /// Currency symbol (e.g., ETH).
    pub symbol: String,
    /// Currency decimals for formatting.
    pub decimals: u8,
    /// Raw balance in smallest units (wei, planck).
    pub balance: String,
    /// Human-readable formatted balance.
    pub balance_formatted: String,
}

/// Combined wallet balances for an address on a specific chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletBalances {
    /// Chain identifier
    pub chain_id: String,
    /// Wallet address
    pub address: String,
    /// Native currency balance
    pub native_balance: NativeBalance,
    /// Token balances
    pub token_balances: Vec<TokenBalance>,
    /// Total value in USD (if available)
    pub total_value_usd: Option<f64>,
    /// Timestamp when balances were fetched
    pub fetched_at: i64,
}

/// Chain information for frontend display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainInfo {
    /// Unique chain identifier (e.g., "ethereum", "polygon", "polkadot")
    pub chain_id: String,
    /// Human-readable chain name
    pub name: String,
    /// Native currency symbol (e.g., ETH, MATIC, DOT)
    pub symbol: String,
    /// Chain family/type
    pub chain_type: ChainType,
    /// Numeric chain ID (for EVM chains)
    pub numeric_chain_id: Option<u64>,
    /// Native currency decimals
    pub decimals: u8,
    /// URL to chain logo
    pub logo_url: Option<String>,
    /// Whether this is a testnet
    pub is_testnet: bool,
    /// Block explorer URL
    pub explorer_url: Option<String>,
}

// =============================================================================
// CHAIN ADAPTER TRAIT
// =============================================================================

/// Errors that can occur during chain operations.
#[derive(Debug, thiserror::Error)]
pub enum ChainError {
    /// The requested chain is not supported.
    #[error("Chain not supported: {0}")]
    UnsupportedChain(String),

    /// Failed to connect to the chain.
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    /// RPC call failed.
    #[error("RPC error: {0}")]
    RpcError(String),

    /// API request failed.
    #[error("API error: {0}")]
    ApiError(String),

    /// Rate limit exceeded.
    #[error("Rate limited")]
    RateLimited,

    /// Invalid address format.
    #[error("Invalid address: {0}")]
    InvalidAddress(String),

    /// Transaction not found.
    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),

    /// Block not found.
    #[error("Block not found: {0}")]
    BlockNotFound(u64),

    /// Failed to parse response.
    #[error("Parse error: {0}")]
    ParseError(String),

    /// Configuration error.
    #[error("Configuration error: {0}")]
    ConfigError(String),

    /// Internal error.
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type for chain operations.
pub type ChainResult<T> = Result<T, ChainError>;

/// Chain adapter trait - implement this for each blockchain type
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    /// Get the chain identifier
    fn chain_id(&self) -> &ChainId;

    /// Check if connected to the chain
    async fn is_connected(&self) -> bool;

    /// Connect to the chain
    async fn connect(&mut self) -> ChainResult<()>;

    /// Disconnect from the chain
    async fn disconnect(&mut self) -> ChainResult<()>;

    /// Get current block number
    async fn get_block_number(&self) -> ChainResult<u64>;

    /// Get native currency balance
    async fn get_native_balance(&self, address: &str) -> ChainResult<NativeBalance>;

    /// Get token balances for an address
    async fn get_token_balances(&self, address: &str) -> ChainResult<Vec<TokenBalance>>;

    /// Get transactions for an address
    async fn get_transactions(
        &self,
        address: &str,
        from_block: Option<u64>,
        to_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>>;

    /// Get a specific transaction by hash
    async fn get_transaction(&self, hash: &str) -> ChainResult<ChainTransaction>;

    /// Validate an address format
    fn validate_address(&self, address: &str) -> bool;

    /// Format an address (checksum, etc.)
    fn format_address(&self, address: &str) -> ChainResult<String>;
}

// =============================================================================
// CHAIN MANAGER
// =============================================================================

/// Manages multiple chain adapters with lazy initialization
///
/// The ChainManager is the central coordinator for all blockchain interactions.
/// It maintains a registry of adapters and lazily initializes them when first requested.
pub struct ChainManager {
    /// Registered adapters (chain_id -> adapter)
    adapters: RwLock<HashMap<String, Arc<RwLock<Box<dyn ChainAdapter>>>>>,
    /// Explorer API keys for various chains
    explorer_api_keys: RwLock<HashMap<String, String>>,
    /// RPC URL overrides
    rpc_overrides: RwLock<HashMap<String, String>>,
}

impl ChainManager {
    /// Creates a new chain manager
    pub fn new() -> Self {
        Self {
            adapters: RwLock::new(HashMap::new()),
            explorer_api_keys: RwLock::new(HashMap::new()),
            rpc_overrides: RwLock::new(HashMap::new()),
        }
    }

    /// Set an explorer API key for a chain
    pub async fn set_explorer_api_key(&self, chain_id: &str, api_key: String) {
        let mut keys = self.explorer_api_keys.write().await;
        keys.insert(chain_id.to_string(), api_key);
    }

    /// Set an RPC URL override for a chain
    pub async fn set_rpc_override(&self, chain_id: &str, rpc_url: String) {
        let mut overrides = self.rpc_overrides.write().await;
        overrides.insert(chain_id.to_string(), rpc_url);
    }

    /// Register a chain adapter manually
    pub async fn register(&self, chain_id: &str, adapter: Box<dyn ChainAdapter>) {
        let mut adapters = self.adapters.write().await;
        adapters.insert(chain_id.to_string(), Arc::new(RwLock::new(adapter)));
    }

    /// Get or lazily initialize an adapter for a chain
    pub async fn get_adapter(
        &self,
        chain_id: &str,
    ) -> ChainResult<Arc<RwLock<Box<dyn ChainAdapter>>>> {
        // Check if already initialized
        {
            let adapters = self.adapters.read().await;
            if let Some(adapter) = adapters.get(chain_id) {
                return Ok(adapter.clone());
            }
        }

        // Try to initialize the adapter
        let adapter = self.create_adapter(chain_id).await?;

        let mut adapters = self.adapters.write().await;
        let arc_adapter = Arc::new(RwLock::new(adapter));
        adapters.insert(chain_id.to_string(), arc_adapter.clone());

        Ok(arc_adapter)
    }

    /// Create an adapter for a chain (lazy initialization)
    async fn create_adapter(&self, chain_id: &str) -> ChainResult<Box<dyn ChainAdapter>> {
        // Get any configured API keys or RPC overrides
        let explorer_key = {
            let keys = self.explorer_api_keys.read().await;
            keys.get(chain_id).cloned()
        };
        let rpc_override = {
            let overrides = self.rpc_overrides.read().await;
            overrides.get(chain_id).cloned()
        };

        // Try to create an EVM adapter first
        if evm::config::get_chain_by_name(chain_id).is_some() {
            let mut adapter = evm::EvmAdapter::new(chain_id)?;

            if let Some(key) = explorer_key {
                adapter = adapter.with_explorer_api_key(key);
            }
            if let Some(url) = rpc_override {
                adapter = adapter.with_rpc_url(url);
            }

            return Ok(Box::new(adapter));
        }

        // Try numeric chain ID for EVM
        if let Ok(numeric_id) = chain_id.parse::<u64>() {
            if evm::config::get_chain_config(numeric_id).is_some() {
                let mut adapter = evm::EvmAdapter::from_chain_id(numeric_id)?;

                if let Some(key) = explorer_key {
                    adapter = adapter.with_explorer_api_key(key);
                }
                if let Some(url) = rpc_override {
                    adapter = adapter.with_rpc_url(url);
                }

                return Ok(Box::new(adapter));
            }
        }

        // TODO: Add Substrate adapter initialization here
        // if substrate::is_supported(chain_id) { ... }

        Err(ChainError::UnsupportedChain(chain_id.to_string()))
    }

    /// Get all supported chains as ChainInfo
    pub fn get_supported_chains() -> Vec<ChainInfo> {
        let mut chains = Vec::new();

        // Add EVM chains
        for config in evm::config::get_all_chains() {
            // Determine if testnet based on chain name or ID
            let is_testnet = config.name.contains("sepolia")
                || config.name.contains("goerli")
                || config.name.contains("testnet")
                || config.chain_id == 11155111 // Sepolia
                || config.chain_id == 5; // Goerli

            chains.push(ChainInfo {
                chain_id: config.name.clone(),
                name: format_chain_name(&config.name),
                symbol: config.symbol.clone(),
                chain_type: ChainType::Evm,
                numeric_chain_id: Some(config.chain_id),
                decimals: config.decimals,
                logo_url: None, // TODO: Add logo URLs
                is_testnet,
                explorer_url: Some(config.explorer_api_url.replace("/api", "")),
            });
        }

        // TODO: Add Substrate chains
        // for config in substrate::get_all_chains() { ... }

        chains
    }

    /// Check if a chain is supported
    pub fn is_chain_supported(chain_id: &str) -> bool {
        // Check EVM by name
        if evm::config::get_chain_by_name(chain_id).is_some() {
            return true;
        }

        // Check EVM by numeric ID
        if let Ok(numeric_id) = chain_id.parse::<u64>() {
            if evm::config::get_chain_config(numeric_id).is_some() {
                return true;
            }
        }

        // TODO: Check Substrate chains

        false
    }

    /// List all registered chain IDs
    pub async fn list_chains(&self) -> Vec<String> {
        let adapters = self.adapters.read().await;
        adapters.keys().cloned().collect()
    }

    /// Connect to a specific chain
    pub async fn connect(&self, chain_id: &str) -> ChainResult<()> {
        let adapter = self.get_adapter(chain_id).await?;
        let mut adapter = adapter.write().await;
        adapter.connect().await
    }

    /// Validate an address for a specific chain
    pub async fn validate_address(&self, chain_id: &str, address: &str) -> ChainResult<bool> {
        let adapter = self.get_adapter(chain_id).await?;
        let adapter = adapter.read().await;
        Ok(adapter.validate_address(address))
    }

    /// Get transactions for an address on a specific chain
    pub async fn get_transactions(
        &self,
        chain_id: &str,
        address: &str,
        from_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>> {
        let adapter = self.get_adapter(chain_id).await?;
        let adapter = adapter.read().await;
        adapter.get_transactions(address, from_block, None).await
    }

    /// Get balances for an address on a specific chain
    pub async fn get_balances(&self, chain_id: &str, address: &str) -> ChainResult<WalletBalances> {
        let adapter = self.get_adapter(chain_id).await?;
        let adapter = adapter.read().await;

        let native_balance = adapter.get_native_balance(address).await?;
        let token_balances = adapter.get_token_balances(address).await?;

        Ok(WalletBalances {
            chain_id: chain_id.to_string(),
            address: address.to_string(),
            native_balance,
            token_balances,
            total_value_usd: None, // TODO: Add price lookups
            fetched_at: Utc::now().timestamp(),
        })
    }

    /// Get balances for multiple address/chain pairs
    pub async fn get_all_balances(
        &self,
        addresses: Vec<(String, String)>, // [(chain_id, address), ...]
    ) -> Vec<ChainResult<WalletBalances>> {
        let mut results = Vec::new();

        for (chain_id, address) in addresses {
            let result = self.get_balances(&chain_id, &address).await;
            results.push(result);
        }

        results
    }

    /// Get native balances across multiple chains for a single address
    pub async fn get_native_balances(
        &self,
        address: &str,
        chain_ids: &[&str],
    ) -> HashMap<String, ChainResult<NativeBalance>> {
        let mut results = HashMap::new();

        for chain_id in chain_ids {
            let result = match self.get_adapter(chain_id).await {
                Ok(adapter) => {
                    let adapter = adapter.read().await;
                    adapter.get_native_balance(address).await
                }
                Err(e) => Err(e),
            };
            results.insert(chain_id.to_string(), result);
        }

        results
    }

    /// Get transactions across multiple chains for a single address
    pub async fn get_all_transactions(
        &self,
        address: &str,
        chain_ids: &[&str],
        from_block: Option<u64>,
    ) -> HashMap<String, ChainResult<Vec<ChainTransaction>>> {
        let mut results = HashMap::new();

        for chain_id in chain_ids {
            let result = self.get_transactions(chain_id, address, from_block).await;
            results.insert(chain_id.to_string(), result);
        }

        results
    }

    /// Get a single transaction by hash
    pub async fn get_transaction(
        &self,
        chain_id: &str,
        hash: &str,
    ) -> ChainResult<ChainTransaction> {
        let adapter = self.get_adapter(chain_id).await?;
        let adapter = adapter.read().await;
        adapter.get_transaction(hash).await
    }
}

/// Format chain name for display (capitalize first letter of each word)
fn format_chain_name(name: &str) -> String {
    name.split('_')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::default(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_id_creation() {
        let evm = ChainId::evm("ethereum", 1);
        assert_eq!(evm.chain_type, ChainType::Evm);
        assert_eq!(evm.name, "ethereum");
        assert_eq!(evm.chain_id, Some(1));

        let substrate = ChainId::substrate("polkadot");
        assert_eq!(substrate.chain_type, ChainType::Substrate);
        assert_eq!(substrate.name, "polkadot");
        assert_eq!(substrate.chain_id, None);
    }

    #[test]
    fn test_chain_type_serialization() {
        assert_eq!(serde_json::to_string(&ChainType::Evm).unwrap(), "\"evm\"");
        assert_eq!(
            serde_json::to_string(&ChainType::Substrate).unwrap(),
            "\"substrate\""
        );
        assert_eq!(
            serde_json::to_string(&ChainType::Solana).unwrap(),
            "\"solana\""
        );
    }

    #[test]
    fn test_get_supported_chains() {
        let chains = ChainManager::get_supported_chains();
        assert!(!chains.is_empty());

        // Should have Ethereum
        let eth = chains.iter().find(|c| c.chain_id == "ethereum");
        assert!(eth.is_some());
        let eth = eth.unwrap();
        assert_eq!(eth.symbol, "ETH");
        assert_eq!(eth.chain_type, ChainType::Evm);
        assert_eq!(eth.numeric_chain_id, Some(1));
        assert!(!eth.is_testnet);
    }

    #[test]
    fn test_is_chain_supported() {
        // EVM chains by name
        assert!(ChainManager::is_chain_supported("ethereum"));
        assert!(ChainManager::is_chain_supported("polygon"));
        assert!(ChainManager::is_chain_supported("arbitrum"));

        // EVM chains by numeric ID
        assert!(ChainManager::is_chain_supported("1")); // Ethereum
        assert!(ChainManager::is_chain_supported("137")); // Polygon

        // Unsupported
        assert!(!ChainManager::is_chain_supported("unsupported_chain"));
        assert!(!ChainManager::is_chain_supported("999999"));
    }

    #[test]
    fn test_wallet_balances_serialization() {
        let balances = WalletBalances {
            chain_id: "ethereum".to_string(),
            address: "0x742d35Cc6634C0532925a3b844Bc9e7595f1d9E2".to_string(),
            native_balance: NativeBalance {
                symbol: "ETH".to_string(),
                decimals: 18,
                balance: "1000000000000000000".to_string(),
                balance_formatted: "1.0".to_string(),
            },
            token_balances: vec![],
            total_value_usd: Some(2500.0),
            fetched_at: 1234567890,
        };

        let json = serde_json::to_string(&balances).unwrap();
        assert!(json.contains("ethereum"));
        assert!(json.contains("0x742d35Cc"));
    }

    #[tokio::test]
    async fn test_chain_manager_new() {
        let manager = ChainManager::new();
        let chains = manager.list_chains().await;
        assert!(chains.is_empty()); // No adapters registered yet
    }

    #[tokio::test]
    async fn test_chain_manager_get_adapter() {
        let manager = ChainManager::new();

        // Get adapter (lazy initialization)
        let result = manager.get_adapter("ethereum").await;
        assert!(result.is_ok());

        // Same adapter should be returned
        let result2 = manager.get_adapter("ethereum").await;
        assert!(result2.is_ok());

        // Now chain should be in the list
        let chains = manager.list_chains().await;
        assert!(chains.contains(&"ethereum".to_string()));
    }

    #[tokio::test]
    async fn test_chain_manager_unsupported_chain() {
        let manager = ChainManager::new();
        let result = manager.get_adapter("unsupported_chain").await;
        assert!(result.is_err());
    }
}
