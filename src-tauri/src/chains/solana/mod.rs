//! Solana Chain Adapter
//!
//! Provides Solana blockchain integration using Helius (enriched) or
//! standard Solana JSON-RPC (fallback). Supports SOL native transfers,
//! SPL tokens, and DeFi interactions.

pub mod helius;
pub mod rpc;
pub mod types;

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::chains::{
    ChainAdapter, ChainError, ChainId, ChainResult, ChainTransaction, ChainType, NativeBalance,
    TokenBalance, TokenTransfer, TransactionStatus, TransactionType,
};

pub use types::{SolanaBalance, SolanaTransaction, SolanaTokenAccount};

/// Solana network configuration
#[derive(Debug, Clone)]
pub struct SolanaConfig {
    /// Network name
    pub name: String,
    /// Whether this is a testnet/devnet
    pub is_testnet: bool,
    /// RPC URL (standard Solana RPC)
    pub rpc_url: String,
    /// Currency symbol
    pub symbol: String,
    /// Currency decimals (9 for SOL)
    pub decimals: u8,
    /// Block explorer URL
    pub explorer_url: String,
}

impl SolanaConfig {
    /// Mainnet configuration
    pub fn mainnet() -> Self {
        Self {
            name: "solana".to_string(),
            is_testnet: false,
            rpc_url: "https://api.mainnet-beta.solana.com".to_string(),
            symbol: "SOL".to_string(),
            decimals: 9,
            explorer_url: "https://solscan.io".to_string(),
        }
    }

    /// Devnet configuration
    pub fn devnet() -> Self {
        Self {
            name: "solana_devnet".to_string(),
            is_testnet: true,
            rpc_url: "https://api.devnet.solana.com".to_string(),
            symbol: "SOL".to_string(),
            decimals: 9,
            explorer_url: "https://solscan.io/?cluster=devnet".to_string(),
        }
    }
}

/// Get all supported Solana network configs
pub fn get_all_configs() -> Vec<SolanaConfig> {
    vec![SolanaConfig::mainnet(), SolanaConfig::devnet()]
}

/// Get Solana config by network name
pub fn get_config_by_name(name: &str) -> Option<SolanaConfig> {
    match name.to_lowercase().as_str() {
        "solana" | "sol" | "solana_mainnet" => Some(SolanaConfig::mainnet()),
        "solana_devnet" | "sol_devnet" | "devnet" => Some(SolanaConfig::devnet()),
        _ => None,
    }
}

/// Solana chain adapter
pub struct SolanaAdapter {
    /// Chain identifier
    chain_id: ChainId,
    /// Network configuration
    config: SolanaConfig,
    /// Standard RPC client (always available)
    rpc_client: Arc<RwLock<Option<rpc::SolanaRpcClient>>>,
    /// Helius client (only when API key is provided)
    helius_client: Arc<RwLock<Option<helius::HeliusClient>>>,
    /// Helius API key (if configured)
    helius_api_key: Option<String>,
}

impl SolanaAdapter {
    /// Create a new Solana adapter with the given config
    pub fn new(config: SolanaConfig) -> ChainResult<Self> {
        let chain_id = ChainId {
            chain_type: ChainType::Solana,
            name: config.name.clone(),
            chain_id: None,
        };

        Ok(Self {
            chain_id,
            config,
            rpc_client: Arc::new(RwLock::new(None)),
            helius_client: Arc::new(RwLock::new(None)),
            helius_api_key: None,
        })
    }

    /// Create adapter by network name
    pub fn from_network(name: &str) -> ChainResult<Self> {
        let config = get_config_by_name(name)
            .ok_or_else(|| ChainError::UnsupportedChain(name.to_string()))?;
        Self::new(config)
    }

    /// Set the Helius API key (builder pattern)
    pub fn with_helius_api_key(mut self, key: String) -> Self {
        self.helius_api_key = Some(key);
        self
    }

    /// Get or initialize the standard RPC client
    async fn get_rpc_client(&self) -> ChainResult<rpc::SolanaRpcClient> {
        {
            let guard = self.rpc_client.read().await;
            if guard.is_some() {
                return rpc::SolanaRpcClient::with_url(&self.config.rpc_url, 2);
            }
        }

        let client = rpc::SolanaRpcClient::with_url(&self.config.rpc_url, 2)?;
        let mut guard = self.rpc_client.write().await;
        *guard = Some(rpc::SolanaRpcClient::with_url(&self.config.rpc_url, 2)?);

        Ok(client)
    }

    /// Get or initialize the Helius client (only if API key is available)
    async fn get_helius_client(&self) -> Option<ChainResult<helius::HeliusClient>> {
        let api_key = self.helius_api_key.as_ref()?;

        {
            let guard = self.helius_client.read().await;
            if guard.is_some() {
                return Some(helius::HeliusClient::new(api_key));
            }
        }

        let client = helius::HeliusClient::new(api_key);
        let mut guard = self.helius_client.write().await;
        if let Ok(stored) = helius::HeliusClient::new(api_key) {
            *guard = Some(stored);
        }

        Some(client)
    }

    /// Get configuration
    pub fn config(&self) -> &SolanaConfig {
        &self.config
    }

    /// Fetch Solana transactions (native format)
    pub async fn fetch_transactions(
        &self,
        address: &str,
        max_pages: Option<usize>,
    ) -> ChainResult<Vec<SolanaTransaction>> {
        // Try Helius first for enriched data
        if let Some(helius_result) = self.get_helius_client().await {
            let helius = helius_result?;
            let helius_txs = helius.get_all_transactions(address, max_pages).await?;
            let txs = helius_txs
                .iter()
                .map(|t| t.to_solana_transaction())
                .collect();
            return Ok(txs);
        }

        // Fallback: use standard RPC
        let rpc = self.get_rpc_client().await?;
        let sigs = rpc
            .get_signatures_for_address(address, None, Some(100))
            .await?;

        let txs = sigs
            .into_iter()
            .map(|sig| SolanaTransaction {
                signature: sig.signature,
                slot: sig.slot,
                timestamp: sig.block_time.unwrap_or(0),
                fee: 0, // Not available from signatures endpoint
                status: if sig.err.is_some() {
                    types::SolanaTransactionStatus::Failed
                } else {
                    types::SolanaTransactionStatus::Success
                },
                tx_type: types::SolanaTransactionType::Unknown,
                native_transfers: vec![],
                token_transfers: vec![],
                description: String::new(),
                source_program: String::new(),
                fee_payer: String::new(),
            })
            .collect();

        Ok(txs)
    }

    /// Fetch Solana balance (native format)
    pub async fn fetch_balance(&self, address: &str) -> ChainResult<SolanaBalance> {
        // Try Helius first for DAS token data
        if let Some(helius_result) = self.get_helius_client().await {
            let helius = helius_result?;
            let balance = helius.get_balance(address).await?;
            let assets = helius.get_assets_by_owner(address, 1).await.ok();

            let token_accounts = if let Some(asset_list) = assets {
                asset_list
                    .items
                    .into_iter()
                    .filter(|a| a.interface == "FungibleToken" || a.interface == "FungibleAsset")
                    .filter_map(|a| {
                        let token_info = a.token_info?;
                        let name = a
                            .content
                            .and_then(|c| c.metadata)
                            .map(|m| m.name)
                            .unwrap_or_default();
                        let ui_balance = format_token_balance(&token_info.balance, token_info.decimals);
                        Some(SolanaTokenAccount {
                            mint: a.id,
                            symbol: if token_info.symbol.is_empty() {
                                None
                            } else {
                                Some(token_info.symbol)
                            },
                            name: if name.is_empty() { None } else { Some(name) },
                            balance: token_info.balance,
                            decimals: token_info.decimals,
                            ui_balance,
                        })
                    })
                    .collect()
            } else {
                vec![]
            };

            return Ok(SolanaBalance {
                address: address.to_string(),
                balance,
                token_accounts,
            });
        }

        // Fallback: standard RPC
        let rpc = self.get_rpc_client().await?;
        let balance = rpc.get_balance(address).await?;
        let token_entries = rpc.get_token_accounts_by_owner(address).await.unwrap_or_default();

        let token_accounts = token_entries
            .into_iter()
            .map(|entry| {
                let info = &entry.account.data.parsed.info;
                let ui_balance = info
                    .token_amount
                    .ui_amount
                    .map(|a| format!("{}", a))
                    .unwrap_or_else(|| info.token_amount.ui_amount_string.clone());
                SolanaTokenAccount {
                    mint: info.mint.clone(),
                    symbol: None, // Not available from standard RPC
                    name: None,
                    balance: info.token_amount.amount.clone(),
                    decimals: info.token_amount.decimals,
                    ui_balance,
                }
            })
            .collect();

        Ok(SolanaBalance {
            address: address.to_string(),
            balance,
            token_accounts,
        })
    }

    /// Format lamports to SOL string
    pub fn format_sol(lamports: u64) -> String {
        let sol = lamports as f64 / 1_000_000_000.0;
        format!("{:.9}", sol)
    }

    /// Convert SolanaTransaction to normalized ChainTransaction
    fn normalize_transaction(
        &self,
        tx: &SolanaTransaction,
        for_address: &str,
    ) -> ChainTransaction {
        // Determine from/to from native transfers
        let (from, to) = if !tx.native_transfers.is_empty() {
            let first = &tx.native_transfers[0];
            (first.from.clone(), Some(first.to.clone()))
        } else if !tx.token_transfers.is_empty() {
            let first = &tx.token_transfers[0];
            (first.from.clone(), Some(first.to.clone()))
        } else {
            (tx.fee_payer.clone(), None)
        };

        // Calculate total native value
        let value: u64 = tx
            .native_transfers
            .iter()
            .filter(|t| t.from == for_address || t.to == for_address)
            .map(|t| t.amount)
            .sum();

        let status = match tx.status {
            types::SolanaTransactionStatus::Success => TransactionStatus::Success,
            types::SolanaTransactionStatus::Failed => TransactionStatus::Failed,
        };

        let tx_type = match tx.tx_type {
            types::SolanaTransactionType::Transfer => TransactionType::Transfer,
            types::SolanaTransactionType::TokenTransfer => TransactionType::Transfer,
            types::SolanaTransactionType::Swap => TransactionType::Swap,
            types::SolanaTransactionType::Stake => TransactionType::Stake,
            types::SolanaTransactionType::Unstake => TransactionType::Unstake,
            types::SolanaTransactionType::Mint => TransactionType::Mint,
            types::SolanaTransactionType::Burn => TransactionType::Burn,
            types::SolanaTransactionType::CreateAccount => TransactionType::ContractCall,
            types::SolanaTransactionType::CloseAccount => TransactionType::ContractCall,
            types::SolanaTransactionType::NftSale => TransactionType::Transfer,
            types::SolanaTransactionType::Unknown => TransactionType::Unknown,
        };

        let token_transfers: Vec<TokenTransfer> = tx
            .token_transfers
            .iter()
            .map(|t| TokenTransfer {
                token_address: t.mint.clone(),
                token_symbol: None,
                token_decimals: None,
                from: t.from.clone(),
                to: t.to.clone(),
                value: t.amount.to_string(),
            })
            .collect();

        ChainTransaction {
            hash: tx.signature.clone(),
            chain_id: self.chain_id.clone(),
            block_number: tx.slot,
            timestamp: tx.timestamp,
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

/// Validate a Solana address (base58 encoded, 32 bytes)
pub fn validate_solana_address(address: &str) -> ChainResult<()> {
    let address = address.trim();

    if address.is_empty() {
        return Err(ChainError::InvalidAddress("Address is empty".to_string()));
    }

    // Solana addresses are 32-44 characters of base58
    if address.len() < 32 || address.len() > 44 {
        return Err(ChainError::InvalidAddress(format!(
            "Invalid Solana address length: {} (expected 32-44 characters)",
            address.len()
        )));
    }

    // Try to decode as base58
    let decoded = bs58::decode(address).into_vec().map_err(|_| {
        ChainError::InvalidAddress("Invalid base58 encoding".to_string())
    })?;

    // Must be exactly 32 bytes (ed25519 public key)
    if decoded.len() != 32 {
        return Err(ChainError::InvalidAddress(format!(
            "Invalid Solana address: decoded to {} bytes (expected 32)",
            decoded.len()
        )));
    }

    Ok(())
}

/// Format a token balance given raw amount and decimals
fn format_token_balance(raw: &str, decimals: u8) -> String {
    if decimals == 0 {
        return raw.to_string();
    }

    let raw_num: u128 = raw.parse().unwrap_or(0);
    let divisor = 10u128.pow(decimals as u32);
    let whole = raw_num / divisor;
    let frac = raw_num % divisor;

    if frac == 0 {
        format!("{}.0", whole)
    } else {
        let frac_str = format!("{:0>width$}", frac, width = decimals as usize);
        let trimmed = frac_str.trim_end_matches('0');
        format!("{}.{}", whole, trimmed)
    }
}

#[async_trait]
impl ChainAdapter for SolanaAdapter {
    fn chain_id(&self) -> &ChainId {
        &self.chain_id
    }

    async fn is_connected(&self) -> bool {
        match self.get_rpc_client().await {
            Ok(client) => client.get_slot().await.is_ok(),
            Err(_) => false,
        }
    }

    async fn connect(&mut self) -> ChainResult<()> {
        let _ = self.get_rpc_client().await?;
        Ok(())
    }

    async fn disconnect(&mut self) -> ChainResult<()> {
        let mut guard = self.rpc_client.write().await;
        *guard = None;
        let mut guard = self.helius_client.write().await;
        *guard = None;
        Ok(())
    }

    async fn get_block_number(&self) -> ChainResult<u64> {
        let client = self.get_rpc_client().await?;
        client.get_slot().await
    }

    async fn get_native_balance(&self, address: &str) -> ChainResult<NativeBalance> {
        let bal = self.fetch_balance(address).await?;

        Ok(NativeBalance {
            symbol: self.config.symbol.clone(),
            decimals: self.config.decimals,
            balance: bal.balance.to_string(),
            balance_formatted: Self::format_sol(bal.balance),
        })
    }

    async fn get_token_balances(&self, address: &str) -> ChainResult<Vec<TokenBalance>> {
        let bal = self.fetch_balance(address).await?;

        let token_balances = bal
            .token_accounts
            .into_iter()
            .map(|ta| TokenBalance {
                token_address: ta.mint,
                token_symbol: ta.symbol,
                token_name: ta.name,
                token_decimals: ta.decimals,
                balance: ta.balance,
                balance_formatted: ta.ui_balance,
            })
            .collect();

        Ok(token_balances)
    }

    async fn get_transactions(
        &self,
        address: &str,
        _from_block: Option<u64>,
        _to_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>> {
        let sol_txs = self.fetch_transactions(address, Some(10)).await?;

        let transactions = sol_txs
            .iter()
            .map(|tx| self.normalize_transaction(tx, address))
            .collect();

        Ok(transactions)
    }

    async fn get_transaction(&self, hash: &str) -> ChainResult<ChainTransaction> {
        // Fetch via RPC and build a minimal transaction
        let rpc = self.get_rpc_client().await?;
        let raw = rpc.get_transaction(hash).await?;

        // Build a minimal SolanaTransaction from the raw data
        let slot = raw.get("slot").and_then(|s| s.as_u64()).unwrap_or(0);
        let block_time = raw.get("blockTime").and_then(|t| t.as_i64()).unwrap_or(0);

        let meta = raw.get("meta");
        let fee = meta
            .and_then(|m| m.get("fee"))
            .and_then(|f| f.as_u64())
            .unwrap_or(0);

        let err = meta.and_then(|m| m.get("err"));
        let status = if err.is_some() && !err.unwrap().is_null() {
            types::SolanaTransactionStatus::Failed
        } else {
            types::SolanaTransactionStatus::Success
        };

        let sol_tx = SolanaTransaction {
            signature: hash.to_string(),
            slot,
            timestamp: block_time,
            fee,
            status,
            tx_type: types::SolanaTransactionType::Unknown,
            native_transfers: vec![],
            token_transfers: vec![],
            description: String::new(),
            source_program: String::new(),
            fee_payer: String::new(),
        };

        Ok(self.normalize_transaction(&sol_tx, ""))
    }

    fn validate_address(&self, address: &str) -> bool {
        validate_solana_address(address).is_ok()
    }

    fn format_address(&self, address: &str) -> ChainResult<String> {
        validate_solana_address(address)?;
        Ok(address.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solana_config_mainnet() {
        let config = SolanaConfig::mainnet();
        assert_eq!(config.name, "solana");
        assert_eq!(config.symbol, "SOL");
        assert_eq!(config.decimals, 9);
        assert!(!config.is_testnet);
    }

    #[test]
    fn test_solana_config_devnet() {
        let config = SolanaConfig::devnet();
        assert_eq!(config.name, "solana_devnet");
        assert!(config.is_testnet);
    }

    #[test]
    fn test_get_config_by_name() {
        assert!(get_config_by_name("solana").is_some());
        assert!(get_config_by_name("sol").is_some());
        assert!(get_config_by_name("solana_devnet").is_some());
        assert!(get_config_by_name("invalid").is_none());
        assert!(get_config_by_name("bitcoin").is_none());
    }

    #[test]
    fn test_format_sol() {
        assert_eq!(SolanaAdapter::format_sol(1_000_000_000), "1.000000000");
        assert_eq!(SolanaAdapter::format_sol(500_000_000), "0.500000000");
        assert_eq!(SolanaAdapter::format_sol(1), "0.000000001");
        assert_eq!(SolanaAdapter::format_sol(0), "0.000000000");
    }

    #[test]
    fn test_validate_solana_address_valid() {
        // Valid Solana addresses (32 bytes base58)
        assert!(validate_solana_address("11111111111111111111111111111111").is_ok());
        assert!(validate_solana_address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").is_ok());
        assert!(validate_solana_address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM").is_ok());
    }

    #[test]
    fn test_validate_solana_address_invalid() {
        // Empty
        assert!(validate_solana_address("").is_err());
        // Too short
        assert!(validate_solana_address("abc").is_err());
        // Ethereum address (not valid Solana)
        assert!(validate_solana_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44e").is_err());
        // Invalid base58 characters (0, O, I, l)
        assert!(validate_solana_address("0OIl111111111111111111111111111111").is_err());
    }

    #[test]
    fn test_format_token_balance() {
        assert_eq!(format_token_balance("1000000", 6), "1.0");
        assert_eq!(format_token_balance("1500000", 6), "1.5");
        assert_eq!(format_token_balance("100", 2), "1.0");
        assert_eq!(format_token_balance("0", 6), "0.0");
        assert_eq!(format_token_balance("1234567", 6), "1.234567");
    }

    #[test]
    fn test_normalize_transaction() {
        let adapter = SolanaAdapter::new(SolanaConfig::mainnet()).unwrap();

        let sol_tx = SolanaTransaction {
            signature: "TestSig123".to_string(),
            slot: 250_000_000,
            timestamp: 1700000000,
            fee: 5000,
            status: types::SolanaTransactionStatus::Success,
            tx_type: types::SolanaTransactionType::Transfer,
            native_transfers: vec![types::SolanaNativeTransfer {
                from: "Sender".to_string(),
                to: "Receiver".to_string(),
                amount: 1_000_000_000,
            }],
            token_transfers: vec![],
            description: "Transfer 1 SOL".to_string(),
            source_program: "System".to_string(),
            fee_payer: "Sender".to_string(),
        };

        let chain_tx = adapter.normalize_transaction(&sol_tx, "Sender");
        assert_eq!(chain_tx.hash, "TestSig123");
        assert_eq!(chain_tx.chain_id.chain_type, ChainType::Solana);
        assert_eq!(chain_tx.block_number, 250_000_000);
        assert_eq!(chain_tx.from, "Sender");
        assert_eq!(chain_tx.to, Some("Receiver".to_string()));
        assert_eq!(chain_tx.value, "1000000000");
        assert_eq!(chain_tx.fee, "5000");
        assert_eq!(chain_tx.status, TransactionStatus::Success);
        assert_eq!(chain_tx.tx_type, TransactionType::Transfer);
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = SolanaAdapter::new(SolanaConfig::mainnet()).unwrap();
        assert_eq!(adapter.chain_id().chain_type, ChainType::Solana);
        assert_eq!(adapter.chain_id().name, "solana");
    }

    #[test]
    fn test_adapter_with_helius_key() {
        let adapter = SolanaAdapter::new(SolanaConfig::mainnet())
            .unwrap()
            .with_helius_api_key("test_key".to_string());
        assert_eq!(adapter.helius_api_key, Some("test_key".to_string()));
    }
}
