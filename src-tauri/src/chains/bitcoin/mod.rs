//! Bitcoin Chain Adapter
//!
//! Provides Bitcoin blockchain integration using the Mempool.space API.
//! Supports transaction fetching, balance queries, address validation,
//! and xPub address derivation for HD wallet portfolio tracking.

pub mod mempool;
pub mod types;
pub mod xpub;

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::chains::{
    ChainAdapter, ChainError, ChainId, ChainResult, ChainTransaction, ChainType, NativeBalance,
    TokenBalance, TokenTransfer, TransactionStatus, TransactionType,
};

pub use mempool::{validate_bitcoin_address, MempoolClient};
pub use types::{BitcoinBalance, BitcoinTransaction, BitcoinUtxo};
pub use xpub::{derive_addresses, is_xpub, parse_xpub, DerivedAddress, XpubInfo, XpubPortfolio};

/// Bitcoin network configuration
#[derive(Debug, Clone)]
pub struct BitcoinConfig {
    /// Network name
    pub name: String,
    /// Whether this is testnet
    pub is_testnet: bool,
    /// Mempool.space API base URL
    pub api_url: String,
    /// Currency symbol
    pub symbol: String,
    /// Currency decimals (8 for BTC)
    pub decimals: u8,
}

impl BitcoinConfig {
    /// Mainnet configuration
    pub fn mainnet() -> Self {
        Self {
            name: "bitcoin".to_string(),
            is_testnet: false,
            api_url: "https://mempool.space/api".to_string(),
            symbol: "BTC".to_string(),
            decimals: 8,
        }
    }

    /// Testnet configuration
    pub fn testnet() -> Self {
        Self {
            name: "bitcoin_testnet".to_string(),
            is_testnet: true,
            api_url: "https://mempool.space/testnet/api".to_string(),
            symbol: "tBTC".to_string(),
            decimals: 8,
        }
    }

    /// Signet configuration
    pub fn signet() -> Self {
        Self {
            name: "bitcoin_signet".to_string(),
            is_testnet: true,
            api_url: "https://mempool.space/signet/api".to_string(),
            symbol: "sBTC".to_string(),
            decimals: 8,
        }
    }
}

/// Get all supported Bitcoin networks
pub fn get_all_configs() -> Vec<BitcoinConfig> {
    vec![
        BitcoinConfig::mainnet(),
        BitcoinConfig::testnet(),
        BitcoinConfig::signet(),
    ]
}

/// Get Bitcoin config by network name
pub fn get_config_by_name(name: &str) -> Option<BitcoinConfig> {
    match name.to_lowercase().as_str() {
        "bitcoin" | "btc" | "mainnet" => Some(BitcoinConfig::mainnet()),
        "bitcoin_testnet" | "btc_testnet" | "testnet" => Some(BitcoinConfig::testnet()),
        "bitcoin_signet" | "btc_signet" | "signet" => Some(BitcoinConfig::signet()),
        _ => None,
    }
}

/// Bitcoin chain adapter
pub struct BitcoinAdapter {
    /// Chain identifier
    chain_id: ChainId,
    /// Network configuration
    config: BitcoinConfig,
    /// Mempool.space API client
    client: Arc<RwLock<Option<MempoolClient>>>,
}

impl BitcoinAdapter {
    /// Create a new Bitcoin adapter for mainnet
    pub fn new() -> ChainResult<Self> {
        Self::with_config(BitcoinConfig::mainnet())
    }

    /// Create a new Bitcoin adapter with custom config
    pub fn with_config(config: BitcoinConfig) -> ChainResult<Self> {
        let chain_id = ChainId {
            chain_type: ChainType::Bitcoin,
            name: config.name.clone(),
            chain_id: None,
        };

        Ok(Self {
            chain_id,
            config,
            client: Arc::new(RwLock::new(None)),
        })
    }

    /// Create adapter by network name
    pub fn from_network(name: &str) -> ChainResult<Self> {
        let config = get_config_by_name(name)
            .ok_or_else(|| ChainError::UnsupportedChain(name.to_string()))?;
        Self::with_config(config)
    }

    /// Get or initialize the Mempool client
    async fn get_client(&self) -> ChainResult<MempoolClient> {
        {
            let guard = self.client.read().await;
            if guard.is_some() {
                return MempoolClient::with_base_url(&self.config.api_url);
            }
        }

        let client = MempoolClient::with_base_url(&self.config.api_url)?;
        let mut guard = self.client.write().await;
        *guard = Some(MempoolClient::with_base_url(&self.config.api_url)?);

        Ok(client)
    }

    /// Get configuration
    pub fn config(&self) -> &BitcoinConfig {
        &self.config
    }

    /// Fetch Bitcoin transactions (native format)
    pub async fn fetch_transactions(
        &self,
        address: &str,
        max_pages: Option<usize>,
    ) -> ChainResult<Vec<BitcoinTransaction>> {
        let client = self.get_client().await?;
        client.fetch_address_transactions(address, max_pages).await
    }

    /// Fetch Bitcoin balance (native format)
    pub async fn fetch_balance(&self, address: &str) -> ChainResult<BitcoinBalance> {
        let client = self.get_client().await?;
        client.fetch_address_balance(address).await
    }

    /// Fetch UTXOs for an address
    pub async fn fetch_utxos(&self, address: &str) -> ChainResult<Vec<BitcoinUtxo>> {
        let client = self.get_client().await?;
        client.get_address_utxos(address).await
    }

    /// Format satoshis to BTC string
    fn format_btc(satoshis: u64) -> String {
        let btc = satoshis as f64 / 100_000_000.0;
        format!("{:.8}", btc)
    }
}

impl Default for BitcoinAdapter {
    fn default() -> Self {
        Self::new().expect("Failed to create default BitcoinAdapter")
    }
}

#[async_trait]
impl ChainAdapter for BitcoinAdapter {
    fn chain_id(&self) -> &ChainId {
        &self.chain_id
    }

    async fn is_connected(&self) -> bool {
        let client = match self.get_client().await {
            Ok(c) => c,
            Err(_) => return false,
        };
        client.get_block_height().await.is_ok()
    }

    async fn connect(&mut self) -> ChainResult<()> {
        let _ = self.get_client().await?;
        Ok(())
    }

    async fn disconnect(&mut self) -> ChainResult<()> {
        let mut guard = self.client.write().await;
        *guard = None;
        Ok(())
    }

    async fn get_block_number(&self) -> ChainResult<u64> {
        let client = self.get_client().await?;
        client.get_block_height().await
    }

    async fn get_native_balance(&self, address: &str) -> ChainResult<NativeBalance> {
        let balance = self.fetch_balance(address).await?;

        Ok(NativeBalance {
            symbol: self.config.symbol.clone(),
            decimals: self.config.decimals,
            balance: balance.balance.to_string(),
            balance_formatted: Self::format_btc(balance.balance),
        })
    }

    async fn get_token_balances(&self, _address: &str) -> ChainResult<Vec<TokenBalance>> {
        // Bitcoin doesn't have native token support
        // Could add BRC-20/Ordinals support in the future
        Ok(vec![])
    }

    async fn get_transactions(
        &self,
        address: &str,
        _from_block: Option<u64>,
        _to_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>> {
        let btc_txs = self.fetch_transactions(address, Some(10)).await?;

        let transactions = btc_txs
            .into_iter()
            .map(|tx| self.normalize_transaction(&tx, address))
            .collect();

        Ok(transactions)
    }

    async fn get_transaction(&self, hash: &str) -> ChainResult<ChainTransaction> {
        let client = self.get_client().await?;
        let current_height = client.get_block_height().await.ok();
        let mempool_tx = client.get_transaction(hash).await?;
        let btc_tx = mempool_tx.to_bitcoin_transaction(current_height);

        Ok(self.normalize_transaction(&btc_tx, ""))
    }

    fn validate_address(&self, address: &str) -> bool {
        validate_bitcoin_address(address).is_ok()
    }

    fn format_address(&self, address: &str) -> ChainResult<String> {
        validate_bitcoin_address(address)?;
        Ok(address.to_string())
    }
}

impl BitcoinAdapter {
    /// Convert Bitcoin transaction to normalized ChainTransaction
    fn normalize_transaction(
        &self,
        tx: &BitcoinTransaction,
        for_address: &str,
    ) -> ChainTransaction {
        // Determine if this is an incoming or outgoing transaction
        let is_incoming = tx
            .outputs
            .iter()
            .any(|o| o.address.as_deref() == Some(for_address));

        let is_outgoing = tx
            .inputs
            .iter()
            .any(|i| i.address.as_deref() == Some(for_address));

        // Calculate value relative to the address
        let value = if is_incoming && !is_outgoing {
            // Pure receive - sum outputs to this address
            tx.outputs
                .iter()
                .filter(|o| o.address.as_deref() == Some(for_address))
                .map(|o| o.value)
                .sum::<u64>()
        } else if is_outgoing {
            // Send - use total output minus change back to self
            tx.total_output
        } else {
            tx.total_output
        };

        // Determine from/to
        let from = tx
            .inputs
            .first()
            .and_then(|i| i.address.clone())
            .unwrap_or_else(|| "coinbase".to_string());

        let to = tx.outputs.first().and_then(|o| o.address.clone());

        // Status
        let status = if tx.confirmations > 0 {
            TransactionStatus::Success
        } else {
            TransactionStatus::Pending
        };

        // Transaction type
        let tx_type = if tx.is_coinbase {
            TransactionType::Mint
        } else {
            TransactionType::Transfer
        };

        // Token transfers (empty for Bitcoin, could add ordinals later)
        let token_transfers: Vec<TokenTransfer> = vec![];

        ChainTransaction {
            hash: tx.txid.clone(),
            chain_id: self.chain_id.clone(),
            block_number: tx.block_height.unwrap_or(0),
            timestamp: tx.timestamp.unwrap_or(0),
            from,
            to,
            value: value.to_string(),
            fee: tx.fee.to_string(),
            status,
            tx_type,
            token_transfers,
            raw_data: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bitcoin_config_mainnet() {
        let config = BitcoinConfig::mainnet();
        assert_eq!(config.name, "bitcoin");
        assert_eq!(config.symbol, "BTC");
        assert!(!config.is_testnet);
    }

    #[test]
    fn test_bitcoin_config_testnet() {
        let config = BitcoinConfig::testnet();
        assert_eq!(config.name, "bitcoin_testnet");
        assert_eq!(config.symbol, "tBTC");
        assert!(config.is_testnet);
    }

    #[test]
    fn test_get_config_by_name() {
        assert!(get_config_by_name("bitcoin").is_some());
        assert!(get_config_by_name("btc").is_some());
        assert!(get_config_by_name("testnet").is_some());
        assert!(get_config_by_name("invalid").is_none());
    }

    #[test]
    fn test_format_btc() {
        assert_eq!(BitcoinAdapter::format_btc(100_000_000), "1.00000000");
        assert_eq!(BitcoinAdapter::format_btc(50_000_000), "0.50000000");
        assert_eq!(BitcoinAdapter::format_btc(1), "0.00000001");
        assert_eq!(BitcoinAdapter::format_btc(0), "0.00000000");
    }

    #[test]
    fn test_validate_address() {
        let adapter = BitcoinAdapter::new().unwrap();

        // Valid addresses
        assert!(adapter.validate_address("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"));
        assert!(adapter.validate_address("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"));

        // Invalid addresses
        assert!(!adapter.validate_address("invalid"));
        assert!(!adapter.validate_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"));
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = BitcoinAdapter::new().unwrap();
        assert_eq!(adapter.chain_id().chain_type, ChainType::Bitcoin);
        assert_eq!(adapter.chain_id().name, "bitcoin");
    }
}
