//! EVM Chain Adapter
//!
//! Provides unified access to EVM-compatible blockchains including
//! Ethereum, Polygon, Arbitrum, Moonbeam, and more.

pub mod alchemy;
pub mod config;
pub mod etherscan;
pub mod types;

use crate::chains::{
    ChainAdapter, ChainError, ChainId, ChainResult, ChainTransaction, ChainType, NativeBalance,
    TokenBalance, TokenTransfer, TransactionStatus, TransactionType,
};
use alchemy::AlchemyClient;
use async_trait::async_trait;
use config::{get_chain_config, ChainConfig};
use etherscan::EtherscanClient;
use std::sync::Arc;
use tokio::sync::RwLock;

/// EVM Chain Adapter
///
/// Combines RPC (Alchemy) and Explorer API (Etherscan) for comprehensive chain access.
pub struct EvmAdapter {
    chain_id: ChainId,
    config: ChainConfig,
    rpc_client: Arc<RwLock<Option<AlchemyClient>>>,
    explorer_client: Arc<RwLock<Option<EtherscanClient>>>,
    explorer_api_key: Option<String>,
    rpc_url_override: Option<String>,
}

impl EvmAdapter {
    /// Create a new EVM adapter for a chain
    pub fn new(chain_name: &str) -> ChainResult<Self> {
        let config = get_chain_config(chain_name)
            .ok_or_else(|| ChainError::UnsupportedChain(chain_name.to_string()))?
            .clone();

        let chain_id = ChainId::evm(chain_name, config.chain_id);

        Ok(Self {
            chain_id,
            config,
            rpc_client: Arc::new(RwLock::new(None)),
            explorer_client: Arc::new(RwLock::new(None)),
            explorer_api_key: None,
            rpc_url_override: None,
        })
    }

    /// Set explorer API key (Etherscan, etc.)
    pub fn with_explorer_api_key(mut self, api_key: impl Into<String>) -> Self {
        self.explorer_api_key = Some(api_key.into());
        self
    }

    /// Set custom RPC URL
    pub fn with_rpc_url(mut self, url: impl Into<String>) -> Self {
        self.rpc_url_override = Some(url.into());
        self
    }

    /// Get RPC client
    async fn get_rpc(&self) -> ChainResult<AlchemyClient> {
        let guard = self.rpc_client.read().await;
        if let Some(client) = guard.as_ref() {
            return Ok(AlchemyClient::new(
                &self.config,
                self.rpc_url_override.as_deref(),
            )?);
        }
        drop(guard);

        // Create new client
        let client = AlchemyClient::new(&self.config, self.rpc_url_override.as_deref())?;

        let mut guard = self.rpc_client.write().await;
        *guard = Some(AlchemyClient::new(
            &self.config,
            self.rpc_url_override.as_deref(),
        )?);

        Ok(client)
    }

    /// Get explorer client
    async fn get_explorer(&self) -> ChainResult<EtherscanClient> {
        let guard = self.explorer_client.read().await;
        if guard.is_some() {
            return EtherscanClient::new(&self.config, self.explorer_api_key.clone());
        }
        drop(guard);

        // Create new client
        let client = EtherscanClient::new(&self.config, self.explorer_api_key.clone())?;

        let mut guard = self.explorer_client.write().await;
        *guard = Some(EtherscanClient::new(
            &self.config,
            self.explorer_api_key.clone(),
        )?);

        Ok(client)
    }

    /// Convert EVM transaction to normalized format
    fn normalize_transaction(&self, tx: &types::EvmTransaction) -> ChainResult<ChainTransaction> {
        let block_number: u64 = tx
            .block_number
            .parse()
            .map_err(|_| ChainError::ParseError("Invalid block number".to_string()))?;

        let timestamp: i64 = tx
            .time_stamp
            .parse()
            .map_err(|_| ChainError::ParseError("Invalid timestamp".to_string()))?;

        let status = if tx.is_error == "1" {
            TransactionStatus::Failed
        } else {
            TransactionStatus::Success
        };

        let tx_type = classify_transaction(tx);

        // Calculate fee
        let gas_used: u128 = tx.gas_used.parse().unwrap_or(0);
        let gas_price: u128 = tx.gas_price.parse().unwrap_or(0);
        let fee = (gas_used * gas_price).to_string();

        Ok(ChainTransaction {
            hash: tx.hash.clone(),
            chain_id: self.chain_id.clone(),
            block_number,
            timestamp,
            from: tx.from.clone(),
            to: if tx.to.is_empty() {
                None
            } else {
                Some(tx.to.clone())
            },
            value: tx.value.clone(),
            fee,
            status,
            tx_type,
            token_transfers: Vec::new(),
            raw_data: Some(serde_json::to_value(tx).unwrap_or_default()),
        })
    }

    /// Get all transactions with token transfers
    pub async fn get_full_transactions(
        &self,
        address: &str,
        from_block: Option<u64>,
        to_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>> {
        let explorer = self.get_explorer().await?;

        // Get normal transactions
        let normal_txs = explorer
            .get_transactions(address, from_block, to_block, 1, 1000)
            .await?;

        // Get ERC20 transfers
        let erc20_transfers = explorer
            .get_erc20_transfers(address, None, from_block, to_block, 1, 1000)
            .await?;

        // Normalize and combine
        let mut transactions: Vec<ChainTransaction> = normal_txs
            .iter()
            .filter_map(|tx| self.normalize_transaction(tx).ok())
            .collect();

        // Add token transfers to matching transactions
        for transfer in erc20_transfers {
            let token_transfer = TokenTransfer {
                token_address: transfer.contract_address.clone(),
                token_symbol: Some(transfer.token_symbol.clone()),
                token_decimals: transfer.token_decimal.parse().ok(),
                from: transfer.from.clone(),
                to: transfer.to.clone(),
                value: transfer.value.clone(),
            };

            // Find matching transaction or create new one
            if let Some(tx) = transactions.iter_mut().find(|t| t.hash == transfer.hash) {
                tx.token_transfers.push(token_transfer);
            } else {
                // Create transaction entry for token transfer
                let block_number: u64 = transfer.block_number.parse().unwrap_or(0);
                let timestamp: i64 = transfer.time_stamp.parse().unwrap_or(0);

                transactions.push(ChainTransaction {
                    hash: transfer.hash.clone(),
                    chain_id: self.chain_id.clone(),
                    block_number,
                    timestamp,
                    from: transfer.from.clone(),
                    to: Some(transfer.to.clone()),
                    value: "0".to_string(),
                    fee: "0".to_string(),
                    status: TransactionStatus::Success,
                    tx_type: TransactionType::Transfer,
                    token_transfers: vec![token_transfer],
                    raw_data: None,
                });
            }
        }

        // Sort by timestamp descending
        transactions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(transactions)
    }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    fn chain_id(&self) -> &ChainId {
        &self.chain_id
    }

    async fn is_connected(&self) -> bool {
        if let Ok(rpc) = self.get_rpc().await {
            rpc.get_chain_id().await.is_ok()
        } else {
            false
        }
    }

    async fn connect(&mut self) -> ChainResult<()> {
        // Verify RPC connection
        let rpc = self.get_rpc().await?;
        let chain_id = rpc.get_chain_id().await?;

        if chain_id != self.config.chain_id {
            return Err(ChainError::ConfigError(format!(
                "Chain ID mismatch: expected {}, got {}",
                self.config.chain_id, chain_id
            )));
        }

        Ok(())
    }

    async fn disconnect(&mut self) -> ChainResult<()> {
        let mut rpc_guard = self.rpc_client.write().await;
        *rpc_guard = None;

        let mut explorer_guard = self.explorer_client.write().await;
        *explorer_guard = None;

        Ok(())
    }

    async fn get_block_number(&self) -> ChainResult<u64> {
        let rpc = self.get_rpc().await?;
        rpc.get_block_number().await
    }

    async fn get_native_balance(&self, address: &str) -> ChainResult<NativeBalance> {
        let rpc = self.get_rpc().await?;
        rpc.get_balance(address).await
    }

    async fn get_token_balances(&self, address: &str) -> ChainResult<Vec<TokenBalance>> {
        // Use explorer API to get token list, then RPC to get balances
        let explorer = self.get_explorer().await?;
        let rpc = self.get_rpc().await?;

        // Get recent token transfers to find tokens held
        let transfers = explorer
            .get_erc20_transfers(address, None, None, None, 1, 100)
            .await?;

        // Get unique token addresses
        let mut token_addresses: Vec<String> = transfers
            .iter()
            .map(|t| t.contract_address.clone())
            .collect();
        token_addresses.sort();
        token_addresses.dedup();

        // Get balances for each token
        let mut balances = Vec::new();
        for token_addr in token_addresses {
            if let Ok(balance) = rpc.get_token_info(address, &token_addr).await {
                if balance.balance != "0" {
                    balances.push(balance);
                }
            }
        }

        Ok(balances)
    }

    async fn get_transactions(
        &self,
        address: &str,
        from_block: Option<u64>,
        to_block: Option<u64>,
    ) -> ChainResult<Vec<ChainTransaction>> {
        self.get_full_transactions(address, from_block, to_block)
            .await
    }

    async fn get_transaction(&self, hash: &str) -> ChainResult<ChainTransaction> {
        let rpc = self.get_rpc().await?;
        let tx_data = rpc.get_transaction(hash).await?;
        let receipt = rpc.get_transaction_receipt(hash).await?;

        // Parse transaction data
        let from = tx_data["from"]
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Missing from".to_string()))?
            .to_string();

        let to = tx_data["to"].as_str().map(|s| s.to_string());

        let value = tx_data["value"]
            .as_str()
            .map(|s| {
                u128::from_str_radix(s.trim_start_matches("0x"), 16)
                    .unwrap_or(0)
                    .to_string()
            })
            .unwrap_or_else(|| "0".to_string());

        let block_number = tx_data["blockNumber"]
            .as_str()
            .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            .unwrap_or(0);

        let status = receipt["status"]
            .as_str()
            .map(|s| {
                if s == "0x1" {
                    TransactionStatus::Success
                } else {
                    TransactionStatus::Failed
                }
            })
            .unwrap_or(TransactionStatus::Success);

        let gas_used = receipt["gasUsed"]
            .as_str()
            .and_then(|s| u128::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            .unwrap_or(0);

        let gas_price = tx_data["gasPrice"]
            .as_str()
            .and_then(|s| u128::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            .unwrap_or(0);

        let fee = (gas_used * gas_price).to_string();

        Ok(ChainTransaction {
            hash: hash.to_string(),
            chain_id: self.chain_id.clone(),
            block_number,
            timestamp: 0, // Would need to get block to get timestamp
            from,
            to,
            value,
            fee,
            status,
            tx_type: TransactionType::Unknown,
            token_transfers: Vec::new(),
            raw_data: Some(tx_data),
        })
    }

    fn validate_address(&self, address: &str) -> bool {
        // Check if it's a valid Ethereum address (0x + 40 hex chars)
        if !address.starts_with("0x") {
            return false;
        }

        let hex_part = &address[2..];
        hex_part.len() == 40 && hex_part.chars().all(|c| c.is_ascii_hexdigit())
    }

    fn format_address(&self, address: &str) -> ChainResult<String> {
        if !self.validate_address(address) {
            return Err(ChainError::InvalidAddress(address.to_string()));
        }

        // Return checksummed address
        Ok(checksum_address(address))
    }
}

/// Classify transaction type based on input data and method
fn classify_transaction(tx: &types::EvmTransaction) -> TransactionType {
    // Contract deployment
    if tx.to.is_empty() && !tx.contract_address.is_empty() {
        return TransactionType::ContractDeploy;
    }

    // Check method signatures
    let method_id = if tx.input.len() >= 10 {
        &tx.input[..10]
    } else {
        ""
    };

    match method_id {
        // ERC20 transfers
        "0xa9059cbb" => TransactionType::Transfer, // transfer(address,uint256)
        "0x23b872dd" => TransactionType::Transfer, // transferFrom(address,address,uint256)

        // Approvals
        "0x095ea7b3" => TransactionType::Approval, // approve(address,uint256)

        // Uniswap/DEX swaps
        "0x38ed1739" | "0x8803dbee" | "0x7ff36ab5" | "0x18cbafe5" | "0xfb3bdb41" | "0x5c11d795" => {
            TransactionType::Swap
        }

        // Liquidity
        "0xe8e33700" | "0xf305d719" => TransactionType::AddLiquidity,
        "0xbaa2abde" | "0x02751cec" => TransactionType::RemoveLiquidity,

        // Plain transfer (no input or just 0x)
        "" | "0x" => {
            if tx.value != "0" {
                TransactionType::Transfer
            } else {
                TransactionType::ContractCall
            }
        }

        _ => {
            if tx.value != "0" && tx.input == "0x" {
                TransactionType::Transfer
            } else {
                TransactionType::ContractCall
            }
        }
    }
}

/// Generate EIP-55 checksum address
fn checksum_address(address: &str) -> String {
    use sha3::{Digest, Keccak256};

    let addr_lower = address.trim_start_matches("0x").to_lowercase();
    let hash = Keccak256::digest(addr_lower.as_bytes());
    let hash_hex = hex::encode(hash);

    let mut result = String::with_capacity(42);
    result.push_str("0x");

    for (i, c) in addr_lower.chars().enumerate() {
        if c.is_ascii_digit() {
            result.push(c);
        } else {
            let hash_char = hash_hex.chars().nth(i).unwrap_or('0');
            let hash_val = hash_char.to_digit(16).unwrap_or(0);
            if hash_val >= 8 {
                result.push(c.to_ascii_uppercase());
            } else {
                result.push(c);
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_address() {
        let adapter = EvmAdapter::new("ethereum").unwrap();

        assert!(adapter.validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f1d9E2"));
        assert!(adapter.validate_address("0x0000000000000000000000000000000000000000"));
        assert!(!adapter.validate_address("742d35Cc6634C0532925a3b844Bc9e7595f1d9E2"));
        assert!(!adapter.validate_address("0x742d35Cc6634C0532925a3b844Bc9e759")); // too short
        assert!(!adapter.validate_address("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"));
        // invalid hex
    }

    #[test]
    fn test_checksum_address() {
        // Test known checksummed addresses
        assert_eq!(
            checksum_address("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        );
    }
}
