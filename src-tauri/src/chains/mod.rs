//! Chain Adapter System
//!
//! Provides a unified interface for interacting with multiple blockchain networks.
//! Supports EVM-compatible chains and Substrate-based chains (Polkadot ecosystem).

pub mod evm;
pub mod substrate;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// =============================================================================
// CORE TYPES
// =============================================================================

/// Supported chain types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainType {
    Evm,
    Substrate,
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

/// Manages multiple chain adapters
pub struct ChainManager {
    adapters: RwLock<HashMap<String, Arc<RwLock<Box<dyn ChainAdapter>>>>>,
}

impl ChainManager {
    /// Creates a new empty chain manager.
    pub fn new() -> Self {
        Self {
            adapters: RwLock::new(HashMap::new()),
        }
    }

    /// Register a chain adapter
    pub async fn register(&self, name: &str, adapter: Box<dyn ChainAdapter>) {
        let mut adapters = self.adapters.write().await;
        adapters.insert(name.to_string(), Arc::new(RwLock::new(adapter)));
    }

    /// Get an adapter by name
    pub async fn get(&self, name: &str) -> Option<Arc<RwLock<Box<dyn ChainAdapter>>>> {
        let adapters = self.adapters.read().await;
        adapters.get(name).cloned()
    }

    /// List all registered chain names
    pub async fn list_chains(&self) -> Vec<String> {
        let adapters = self.adapters.read().await;
        adapters.keys().cloned().collect()
    }

    /// Connect to a specific chain
    pub async fn connect(&self, name: &str) -> ChainResult<()> {
        let adapter = self
            .get(name)
            .await
            .ok_or_else(|| ChainError::UnsupportedChain(name.to_string()))?;

        let mut adapter = adapter.write().await;
        adapter.connect().await
    }

    /// Get native balance across multiple chains
    pub async fn get_native_balances(
        &self,
        address: &str,
        chains: &[&str],
    ) -> HashMap<String, ChainResult<NativeBalance>> {
        let mut results = HashMap::new();

        for chain in chains {
            let result = if let Some(adapter) = self.get(chain).await {
                let adapter = adapter.read().await;
                adapter.get_native_balance(address).await
            } else {
                Err(ChainError::UnsupportedChain(chain.to_string()))
            };
            results.insert(chain.to_string(), result);
        }

        results
    }

    /// Get transactions across multiple chains
    pub async fn get_all_transactions(
        &self,
        address: &str,
        chains: &[&str],
        from_block: Option<u64>,
        to_block: Option<u64>,
    ) -> HashMap<String, ChainResult<Vec<ChainTransaction>>> {
        let mut results = HashMap::new();

        for chain in chains {
            let result = if let Some(adapter) = self.get(chain).await {
                let adapter = adapter.read().await;
                adapter
                    .get_transactions(address, from_block, to_block)
                    .await
            } else {
                Err(ChainError::UnsupportedChain(chain.to_string()))
            };
            results.insert(chain.to_string(), result);
        }

        results
    }
}

impl Default for ChainManager {
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
}
