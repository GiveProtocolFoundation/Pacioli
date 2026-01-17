//! Substrate Chain Adapter
//!
//! Provides access to Substrate-based chains (Polkadot, Kusama, etc.)
//! This module serves as a wrapper around the existing indexer functionality.

use crate::chains::{
    ChainAdapter, ChainError, ChainId, ChainResult, ChainTransaction, NativeBalance, TokenBalance,
};
use async_trait::async_trait;

/// Substrate chain configuration parameters.
#[derive(Debug, Clone)]
pub struct SubstrateConfig {
    /// Internal chain name identifier.
    pub name: String,
    /// Human-readable display name.
    pub display_name: String,
    /// Native currency symbol (e.g., DOT).
    pub native_symbol: String,
    /// Native currency decimals.
    pub native_decimals: u8,
    /// WebSocket RPC endpoint URL.
    pub rpc_url: String,
    /// Subscan API URL for transaction indexing.
    pub subscan_url: Option<String>,
}

impl SubstrateConfig {
    /// Creates configuration for Polkadot mainnet.
    pub fn polkadot() -> Self {
        Self {
            name: "polkadot".to_string(),
            display_name: "Polkadot".to_string(),
            native_symbol: "DOT".to_string(),
            native_decimals: 10,
            rpc_url: "wss://rpc.polkadot.io".to_string(),
            subscan_url: Some("https://polkadot.api.subscan.io".to_string()),
        }
    }

    /// Creates configuration for Kusama mainnet.
    pub fn kusama() -> Self {
        Self {
            name: "kusama".to_string(),
            display_name: "Kusama".to_string(),
            native_symbol: "KSM".to_string(),
            native_decimals: 12,
            rpc_url: "wss://kusama-rpc.polkadot.io".to_string(),
            subscan_url: Some("https://kusama.api.subscan.io".to_string()),
        }
    }

    /// Creates configuration for Westend testnet.
    pub fn westend() -> Self {
        Self {
            name: "westend".to_string(),
            display_name: "Westend".to_string(),
            native_symbol: "WND".to_string(),
            native_decimals: 12,
            rpc_url: "wss://westend-rpc.polkadot.io".to_string(),
            subscan_url: Some("https://westend.api.subscan.io".to_string()),
        }
    }

    /// Creates configuration for Acala mainnet.
    pub fn acala() -> Self {
        Self {
            name: "acala".to_string(),
            display_name: "Acala".to_string(),
            native_symbol: "ACA".to_string(),
            native_decimals: 12,
            rpc_url: "wss://acala-rpc.aca-api.network".to_string(),
            subscan_url: Some("https://acala.api.subscan.io".to_string()),
        }
    }

    /// Creates configuration for Astar Substrate layer.
    pub fn astar_substrate() -> Self {
        Self {
            name: "astar-substrate".to_string(),
            display_name: "Astar (Substrate)".to_string(),
            native_symbol: "ASTR".to_string(),
            native_decimals: 18,
            rpc_url: "wss://rpc.astar.network".to_string(),
            subscan_url: Some("https://astar.api.subscan.io".to_string()),
        }
    }
}

/// Substrate Chain Adapter
///
/// Provides access to Substrate-based chains via RPC and Subscan API.
pub struct SubstrateAdapter {
    chain_id: ChainId,
    config: SubstrateConfig,
    connected: bool,
}

impl SubstrateAdapter {
    /// Create a new Substrate adapter
    pub fn new(config: SubstrateConfig) -> Self {
        let chain_id = ChainId::substrate(&config.name);

        Self {
            chain_id,
            config,
            connected: false,
        }
    }

    /// Create adapter for Polkadot
    pub fn polkadot() -> Self {
        Self::new(SubstrateConfig::polkadot())
    }

    /// Create adapter for Kusama
    pub fn kusama() -> Self {
        Self::new(SubstrateConfig::kusama())
    }
}

#[async_trait]
impl ChainAdapter for SubstrateAdapter {
    fn chain_id(&self) -> &ChainId {
        &self.chain_id
    }

    async fn is_connected(&self) -> bool {
        self.connected
    }

    async fn connect(&mut self) -> ChainResult<()> {
        // Placeholder: actual subxt connection not yet implemented
        self.connected = true;
        Ok(())
    }

    async fn disconnect(&mut self) -> ChainResult<()> {
        self.connected = false;
        Ok(())
    }

    async fn get_block_number(&self) -> ChainResult<u64> {
        // Placeholder: subxt integration pending
        Err(ChainError::Internal(
            "Substrate adapter not fully implemented".to_string(),
        ))
    }

    async fn get_native_balance(&self, _address: &str) -> ChainResult<NativeBalance> {
        // Placeholder: subxt integration pending
        Err(ChainError::Internal(
            "Substrate adapter not fully implemented".to_string(),
        ))
    }

    async fn get_token_balances(&self, _address: &str) -> ChainResult<Vec<TokenBalance>> {
        // Placeholder: assets pallet integration pending
        Ok(Vec::new())
    }

    async fn get_transactions(
        &self,
        _address: &str,
        _from_block: Option<u64>,
        _to_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>> {
        // Placeholder: Subscan API integration pending
        Ok(Vec::new())
    }

    async fn get_transaction(&self, _hash: &str) -> ChainResult<ChainTransaction> {
        // Placeholder: subxt integration pending
        Err(ChainError::Internal(
            "Substrate adapter not fully implemented".to_string(),
        ))
    }

    fn validate_address(&self, address: &str) -> bool {
        // Basic SS58 address validation
        // Valid addresses start with 1 (Polkadot), 2 (Kusama), or 5 (generic)
        // and are typically 47-48 characters
        if address.is_empty() {
            return false;
        }

        let first_char = address.chars().next().unwrap();
        let valid_prefix = matches!(first_char, '1' | '2' | '5' | 'D' | 'E' | 'F' | 'G' | 'H');

        valid_prefix && address.len() >= 46 && address.len() <= 48
    }

    fn format_address(&self, address: &str) -> ChainResult<String> {
        if !self.validate_address(address) {
            return Err(ChainError::InvalidAddress(address.to_string()));
        }
        Ok(address.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_substrate_config() {
        let polkadot = SubstrateConfig::polkadot();
        assert_eq!(polkadot.name, "polkadot");
        assert_eq!(polkadot.native_symbol, "DOT");
        assert_eq!(polkadot.native_decimals, 10);
    }

    #[test]
    fn test_validate_address() {
        let adapter = SubstrateAdapter::polkadot();

        // Valid Polkadot address (starts with 1)
        assert!(adapter.validate_address("15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5"));

        // Invalid addresses
        assert!(!adapter.validate_address(""));
        assert!(!adapter.validate_address("0x123")); // EVM format
    }
}
