//! EVM Chain Adapter
//!
//! Provides unified access to EVM-compatible blockchains including
//! Ethereum, Polygon, Arbitrum, Moonbeam, and more.

/// Alchemy/JSON-RPC client for RPC access to EVM chains.
pub mod alchemy;
/// Chain configuration for supported EVM networks.
pub mod config;
/// Etherscan-family API client for transaction history and token data.
pub mod etherscan;
/// EVM-specific types for transactions, tokens, and balances.
pub mod types;

use crate::chains::{
    ChainAdapter, ChainError, ChainId, ChainResult, ChainTransaction, NativeBalance, TokenBalance,
    TokenTransfer, TransactionStatus, TransactionType,
};
use alchemy::AlchemyClient;
use async_trait::async_trait;
use config::{get_all_chains, get_chain_by_name, get_chain_config, EvmChainConfig};
use etherscan::EtherscanClient;
use std::sync::Arc;
use tokio::sync::RwLock;

/// EVM Chain Adapter
///
/// Combines RPC (Alchemy) and Explorer API (Etherscan) for comprehensive chain access.
pub struct EvmAdapter {
    chain_id: ChainId,
    config: EvmChainConfig,
    rpc_client: Arc<RwLock<Option<AlchemyClient>>>,
    explorer_client: Arc<RwLock<Option<EtherscanClient>>>,
    explorer_api_key: Option<String>,
    rpc_url_override: Option<String>,
}

impl EvmAdapter {
    /// Create a new EVM adapter for a chain by name
    pub fn new(chain_name: &str) -> ChainResult<Self> {
        let config = get_chain_by_name(chain_name)
            .ok_or_else(|| ChainError::UnsupportedChain(chain_name.to_string()))?;

        let chain_id = ChainId::evm(&config.name, config.chain_id);

        Ok(Self {
            chain_id,
            config,
            rpc_client: Arc::new(RwLock::new(None)),
            explorer_client: Arc::new(RwLock::new(None)),
            explorer_api_key: None,
            rpc_url_override: None,
        })
    }

    /// Create a new EVM adapter for a chain by numeric chain ID
    pub fn from_chain_id(chain_id: u64) -> ChainResult<Self> {
        let config = get_chain_config(chain_id)
            .ok_or_else(|| ChainError::UnsupportedChain(format!("chain_id={}", chain_id)))?;

        let id = ChainId::evm(&config.name, config.chain_id);

        Ok(Self {
            chain_id: id,
            config,
            rpc_client: Arc::new(RwLock::new(None)),
            explorer_client: Arc::new(RwLock::new(None)),
            explorer_api_key: None,
            rpc_url_override: None,
        })
    }

    /// Get all supported EVM chain IDs
    pub fn supported_chains() -> Vec<u64> {
        get_all_chains().iter().map(|c| c.chain_id).collect()
    }

    /// Get the chain configuration
    pub fn config(&self) -> &EvmChainConfig {
        &self.config
    }

    /// Get supported transaction types for EVM chains
    pub fn supported_tx_types() -> Vec<TransactionType> {
        vec![
            TransactionType::Transfer,
            TransactionType::ContractCall,
            TransactionType::ContractDeploy,
            TransactionType::Swap,
            TransactionType::AddLiquidity,
            TransactionType::RemoveLiquidity,
            TransactionType::Stake,
            TransactionType::Unstake,
            TransactionType::Bridge,
            TransactionType::Mint,
            TransactionType::Burn,
            TransactionType::Approval,
        ]
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
        if guard.is_some() {
            return AlchemyClient::new(&self.config, self.rpc_url_override.as_deref());
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

    /// Get all transactions with token transfers, internal txs, and NFT transfers
    ///
    /// This method combines:
    /// - Normal transactions
    /// - Internal transactions (contract calls)
    /// - ERC20 token transfers
    /// - ERC721/ERC1155 NFT transfers
    ///
    /// All are converted to the unified ChainTransaction type and sorted by timestamp.
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

        // Get internal transactions (contract calls)
        let internal_txs = explorer
            .get_internal_transactions(address, from_block, to_block)
            .await
            .unwrap_or_default();

        // Get ERC20 transfers
        let erc20_transfers = explorer
            .get_erc20_transfers(address, None, from_block, to_block, 1, 1000)
            .await?;

        // Get ERC721 NFT transfers
        let nft_transfers = explorer
            .get_nft_transfers(address, None, from_block)
            .await
            .unwrap_or_default();

        // Get ERC1155 NFT transfers
        let erc1155_transfers = explorer
            .get_erc1155_transfers(address, None, from_block)
            .await
            .unwrap_or_default();

        // Normalize normal transactions
        let mut transactions: Vec<ChainTransaction> = normal_txs
            .iter()
            .filter_map(|tx| self.normalize_transaction(tx).ok())
            .collect();

        // Add internal transactions
        for itx in internal_txs {
            let block_number: u64 = itx.block_number.parse().unwrap_or(0);
            let timestamp: i64 = itx.time_stamp.parse().unwrap_or(0);

            // Check if parent transaction exists
            if !transactions.iter().any(|t| t.hash == itx.hash) {
                let status = if itx.is_error == "1" {
                    TransactionStatus::Failed
                } else {
                    TransactionStatus::Success
                };

                transactions.push(ChainTransaction {
                    hash: itx.hash.clone(),
                    chain_id: self.chain_id.clone(),
                    block_number,
                    timestamp,
                    from: itx.from.clone(),
                    to: if itx.to.is_empty() {
                        None
                    } else {
                        Some(itx.to.clone())
                    },
                    value: itx.value.clone(),
                    fee: "0".to_string(), // Internal txs don't have separate fees
                    status,
                    tx_type: TransactionType::ContractCall,
                    token_transfers: Vec::new(),
                    raw_data: Some(serde_json::to_value(&itx).unwrap_or_default()),
                });
            }
        }

        // Add ERC20 token transfers
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

        // Add ERC721 NFT transfers
        for nft in nft_transfers {
            let token_transfer = TokenTransfer {
                token_address: nft.contract_address.clone(),
                token_symbol: Some(nft.token_symbol.clone()),
                token_decimals: Some(0), // NFTs have 0 decimals
                from: nft.from.clone(),
                to: nft.to.clone(),
                value: nft.token_id.clone(), // For NFTs, value is the token ID
            };

            if let Some(tx) = transactions.iter_mut().find(|t| t.hash == nft.hash) {
                tx.token_transfers.push(token_transfer);
                tx.tx_type = TransactionType::Transfer; // Mark as NFT transfer
            } else {
                let block_number: u64 = nft.block_number.parse().unwrap_or(0);
                let timestamp: i64 = nft.time_stamp.parse().unwrap_or(0);

                transactions.push(ChainTransaction {
                    hash: nft.hash.clone(),
                    chain_id: self.chain_id.clone(),
                    block_number,
                    timestamp,
                    from: nft.from.clone(),
                    to: Some(nft.to.clone()),
                    value: "0".to_string(),
                    fee: "0".to_string(),
                    status: TransactionStatus::Success,
                    tx_type: TransactionType::Transfer,
                    token_transfers: vec![token_transfer],
                    raw_data: None,
                });
            }
        }

        // Add ERC1155 NFT transfers
        for nft in erc1155_transfers {
            let token_transfer = TokenTransfer {
                token_address: nft.contract_address.clone(),
                token_symbol: Some(nft.token_symbol.clone()),
                token_decimals: Some(0),
                from: nft.from.clone(),
                to: nft.to.clone(),
                value: format!("{}:{}", nft.token_id, nft.token_value), // tokenId:amount
            };

            if let Some(tx) = transactions.iter_mut().find(|t| t.hash == nft.hash) {
                tx.token_transfers.push(token_transfer);
            } else {
                let block_number: u64 = nft.block_number.parse().unwrap_or(0);
                let timestamp: i64 = nft.time_stamp.parse().unwrap_or(0);

                transactions.push(ChainTransaction {
                    hash: nft.hash.clone(),
                    chain_id: self.chain_id.clone(),
                    block_number,
                    timestamp,
                    from: nft.from.clone(),
                    to: Some(nft.to.clone()),
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
        let tx_data = rpc
            .get_transaction(hash)
            .await?
            .ok_or_else(|| ChainError::RpcError(format!("Transaction {} not found", hash)))?;
        let receipt = rpc.get_transaction_receipt(hash).await?;

        // Parse value from hex
        let value = u128::from_str_radix(tx_data.value.trim_start_matches("0x"), 16)
            .unwrap_or(0)
            .to_string();

        // Parse block number from hex
        let block_number = tx_data
            .block_number
            .as_ref()
            .and_then(|s: &String| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            .unwrap_or(0);

        // Get status and gas from receipt if available
        let (status, gas_used) = if let Some(ref rcpt) = receipt {
            let status = if rcpt.is_success() {
                TransactionStatus::Success
            } else {
                TransactionStatus::Failed
            };
            let gas = rcpt.gas_used_u64() as u128;
            (status, gas)
        } else {
            (TransactionStatus::Success, 0u128)
        };

        // Parse gas price from hex
        let gas_price = tx_data
            .gas_price
            .as_ref()
            .and_then(|s: &String| u128::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            .unwrap_or(0);

        let fee = (gas_used * gas_price).to_string();

        Ok(ChainTransaction {
            hash: hash.to_string(),
            chain_id: self.chain_id.clone(),
            block_number,
            timestamp: 0, // Would need to get block to get timestamp
            from: tx_data.from.clone(),
            to: tx_data.to.clone(),
            value,
            fee,
            status,
            tx_type: TransactionType::Unknown,
            token_transfers: Vec::new(),
            raw_data: Some(serde_json::to_value(&tx_data).unwrap_or_default()),
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

/// Classify transaction type based on input data and method signature
///
/// Uses known method selectors (first 4 bytes of keccak256 hash of function signature)
/// to categorize transactions into appropriate types.
fn classify_transaction(tx: &types::EvmTransaction) -> TransactionType {
    // Contract deployment (no 'to' address but creates contract)
    if tx.to.is_empty() && !tx.contract_address.is_empty() {
        return TransactionType::ContractDeploy;
    }

    // Check if target is a known DEX router
    let to_lower = tx.to.to_lowercase();
    let is_dex_router = is_known_dex_router(&to_lower);

    // Extract method selector (first 4 bytes = 10 chars including 0x)
    let method_id = if tx.input.len() >= 10 {
        &tx.input[..10]
    } else {
        ""
    };

    match method_id {
        // =================================================================
        // ERC20 Token Operations
        // =================================================================
        "0xa9059cbb" => TransactionType::Transfer, // transfer(address,uint256)
        "0x23b872dd" => TransactionType::Transfer, // transferFrom(address,address,uint256)
        "0x095ea7b3" => TransactionType::Approval, // approve(address,uint256)
        "0x39509351" => TransactionType::Approval, // increaseAllowance(address,uint256)
        "0xa457c2d7" => TransactionType::Approval, // decreaseAllowance(address,uint256)

        // =================================================================
        // ERC721 NFT Operations
        // =================================================================
        "0x42842e0e" => TransactionType::Transfer, // safeTransferFrom(address,address,uint256)
        "0xb88d4fde" => TransactionType::Transfer, // safeTransferFrom(address,address,uint256,bytes)
        "0xa22cb465" => TransactionType::Approval, // setApprovalForAll(address,bool)

        // =================================================================
        // ERC1155 Multi-Token Operations
        // =================================================================
        "0xf242432a" => TransactionType::Transfer, // safeTransferFrom(address,address,uint256,uint256,bytes)
        "0x2eb2c2d6" => TransactionType::Transfer, // safeBatchTransferFrom(...)

        // =================================================================
        // Uniswap V2 Router
        // =================================================================
        "0x38ed1739" => TransactionType::Swap, // swapExactTokensForTokens
        "0x8803dbee" => TransactionType::Swap, // swapTokensForExactTokens
        "0x7ff36ab5" => TransactionType::Swap, // swapExactETHForTokens
        "0x18cbafe5" => TransactionType::Swap, // swapExactTokensForETH
        "0xfb3bdb41" => TransactionType::Swap, // swapETHForExactTokens
        "0x5c11d795" => TransactionType::Swap, // swapExactTokensForTokensSupportingFeeOnTransferTokens
        "0x791ac947" => TransactionType::Swap, // swapExactTokensForETHSupportingFeeOnTransferTokens
        "0xb6f9de95" => TransactionType::Swap, // swapExactETHForTokensSupportingFeeOnTransferTokens

        // =================================================================
        // Uniswap V3 Router
        // =================================================================
        "0xc04b8d59" => TransactionType::Swap, // exactInput(ExactInputParams)
        "0xdb3e2198" => TransactionType::Swap, // exactInputSingle(ExactInputSingleParams)
        "0x09b81346" => TransactionType::Swap, // exactOutput(ExactOutputParams)
        "0x5023b4df" => TransactionType::Swap, // exactOutputSingle(ExactOutputSingleParams)
        "0xac9650d8" => TransactionType::Swap, // multicall(bytes[]) - often used for swaps

        // =================================================================
        // Liquidity Operations (Uniswap V2)
        // =================================================================
        "0xe8e33700" => TransactionType::AddLiquidity, // addLiquidity
        "0xf305d719" => TransactionType::AddLiquidity, // addLiquidityETH
        "0xbaa2abde" => TransactionType::RemoveLiquidity, // removeLiquidity
        "0x02751cec" => TransactionType::RemoveLiquidity, // removeLiquidityETH
        "0xaf2979eb" => TransactionType::RemoveLiquidity, // removeLiquidityETHSupportingFeeOnTransferTokens
        "0xded9382a" => TransactionType::RemoveLiquidity, // removeLiquidityETHWithPermit
        "0x5b0d5984" => TransactionType::RemoveLiquidity, // removeLiquidityETHWithPermitSupportingFeeOnTransferTokens

        // =================================================================
        // Liquidity Operations (Uniswap V3)
        // =================================================================
        "0x88316456" => TransactionType::AddLiquidity, // mint (NonfungiblePositionManager)
        "0x219f5d17" => TransactionType::AddLiquidity, // increaseLiquidity
        "0x0c49ccbe" => TransactionType::RemoveLiquidity, // decreaseLiquidity
        "0xfc6f7865" => TransactionType::RemoveLiquidity, // collect

        // =================================================================
        // Staking Operations
        // =================================================================
        "0xa694fc3a" => TransactionType::Stake, // stake(uint256)
        "0x7acb7757" => TransactionType::Stake, // deposit(uint256,address)
        "0xb6b55f25" => TransactionType::Stake, // deposit(uint256)
        "0xd0e30db0" => TransactionType::Stake, // deposit() - WETH wrap
        "0x2e1a7d4d" => TransactionType::Unstake, // withdraw(uint256) - WETH unwrap
        "0x853828b6" => TransactionType::Unstake, // withdrawAll()
        "0xe9fad8ee" => TransactionType::Unstake, // exit()
        "0x3d18b912" => TransactionType::Unstake, // getReward()

        // =================================================================
        // Compound/Aave Lending
        // =================================================================
        "0x1249c58b" => TransactionType::Stake, // mint() - cToken
        "0xa0712d68" => TransactionType::Stake, // mint(uint256) - cToken
        "0x852a12e3" => TransactionType::Unstake, // redeemUnderlying(uint256)
        "0xdb006a75" => TransactionType::Unstake, // redeem(uint256)
        "0xe9c714f2" => TransactionType::Unstake, // _acceptAdmin()
        "0x0e752702" => TransactionType::Stake, // supply(address,uint256) - Aave V3
        "0x69328dec" => TransactionType::Unstake, // withdraw(address,uint256,address) - Aave

        // =================================================================
        // Bridge Operations
        // =================================================================
        "0x3805550f" => TransactionType::Bridge, // bridgeToken
        "0x0f5287b0" => TransactionType::Bridge, // depositERC20
        "0x9a2ac6d5" => TransactionType::Bridge, // outboundTransfer (Arbitrum)
        "0xa44c80e3" => TransactionType::Bridge, // sendToL2 (Optimism)
        "0xbede39b5" => TransactionType::Bridge, // withdraw (Optimism)

        // =================================================================
        // Minting Operations (non-staking mints)
        // =================================================================
        "0x40c10f19" => TransactionType::Mint, // mint(address,uint256) - ERC20 mint to address
        "0x6a627842" => TransactionType::Mint, // mint(address) - NFT mint

        // =================================================================
        // Burning Operations
        // =================================================================
        "0x42966c68" => TransactionType::Burn, // burn(uint256)
        "0x79cc6790" => TransactionType::Burn, // burnFrom(address,uint256)
        "0x9dc29fac" => TransactionType::Burn, // burn(address,uint256)

        // =================================================================
        // Plain transfer or contract call
        // =================================================================
        "" | "0x" => {
            if tx.value != "0" {
                TransactionType::Transfer
            } else {
                TransactionType::ContractCall
            }
        }

        _ => {
            // If sending to a known DEX router, likely a swap
            if is_dex_router {
                return TransactionType::Swap;
            }

            // Check for ETH transfer with data (could be swap or other)
            if tx.value != "0" && tx.input == "0x" {
                TransactionType::Transfer
            } else {
                TransactionType::ContractCall
            }
        }
    }
}

/// Check if address is a known DEX router
fn is_known_dex_router(address: &str) -> bool {
    // Known DEX router addresses (lowercase)
    const DEX_ROUTERS: &[&str] = &[
        // Uniswap V2
        "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", // Ethereum
        // Uniswap V3
        "0xe592427a0aece92de3edee1f18e0157c05861564", // SwapRouter
        "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", // SwapRouter02
        // SushiSwap
        "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f", // Ethereum
        "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506", // Various L2s
        // PancakeSwap
        "0x10ed43c718714eb63d5aa57b78b54704e256024e", // BSC V2
        "0x13f4ea83d0bd40e75c8222255bc855a974568dd4", // BSC V3
        // QuickSwap (Polygon)
        "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff",
        // Trader Joe (Avalanche)
        "0x60ae616a2155ee3d9a68541ba4544862310933d4",
    ];

    DEX_ROUTERS.contains(&address)
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

    #[test]
    fn test_from_chain_id() {
        // Ethereum mainnet
        let adapter = EvmAdapter::from_chain_id(1).unwrap();
        assert_eq!(adapter.config().chain_id, 1);
        assert_eq!(adapter.config().name, "ethereum");

        // Arbitrum
        let adapter = EvmAdapter::from_chain_id(42161).unwrap();
        assert_eq!(adapter.config().chain_id, 42161);
        assert_eq!(adapter.config().name, "arbitrum");

        // Unsupported chain
        let result = EvmAdapter::from_chain_id(999999);
        assert!(result.is_err());
    }

    #[test]
    fn test_supported_chains() {
        let chains = EvmAdapter::supported_chains();
        assert!(!chains.is_empty());
        assert!(chains.contains(&1)); // Ethereum
        assert!(chains.contains(&137)); // Polygon
        assert!(chains.contains(&42161)); // Arbitrum
    }

    #[test]
    fn test_supported_tx_types() {
        let types = EvmAdapter::supported_tx_types();
        assert!(types.contains(&TransactionType::Transfer));
        assert!(types.contains(&TransactionType::Swap));
        assert!(types.contains(&TransactionType::Stake));
        assert!(types.contains(&TransactionType::Bridge));
    }

    #[test]
    fn test_classify_transaction_swap() {
        let tx = types::EvmTransaction {
            hash: "0x123".to_string(),
            block_number: "100".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: "0xdef".to_string(),
            value: "0".to_string(),
            gas: "21000".to_string(),
            gas_price: "1000000000".to_string(),
            gas_used: "21000".to_string(),
            input: "0x38ed1739".to_string(), // swapExactTokensForTokens
            contract_address: "".to_string(),
            is_error: "0".to_string(),
            nonce: "1".to_string(),
            confirmations: "10".to_string(),
            cumulative_gas_used: "21000".to_string(),
            tx_receipt_status: "1".to_string(),
            method_id: "0x38ed1739".to_string(),
            function_name: "swapExactTokensForTokens".to_string(),
            max_fee_per_gas: "".to_string(),
            max_priority_fee_per_gas: "".to_string(),
        };

        assert_eq!(classify_transaction(&tx), TransactionType::Swap);
    }

    #[test]
    fn test_classify_transaction_stake() {
        let tx = types::EvmTransaction {
            hash: "0x123".to_string(),
            block_number: "100".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: "0xdef".to_string(),
            value: "0".to_string(),
            gas: "21000".to_string(),
            gas_price: "1000000000".to_string(),
            gas_used: "21000".to_string(),
            input: "0xa694fc3a".to_string(), // stake(uint256)
            contract_address: "".to_string(),
            is_error: "0".to_string(),
            nonce: "1".to_string(),
            confirmations: "10".to_string(),
            cumulative_gas_used: "21000".to_string(),
            tx_receipt_status: "1".to_string(),
            method_id: "0xa694fc3a".to_string(),
            function_name: "stake".to_string(),
            max_fee_per_gas: "".to_string(),
            max_priority_fee_per_gas: "".to_string(),
        };

        assert_eq!(classify_transaction(&tx), TransactionType::Stake);
    }

    #[test]
    fn test_is_known_dex_router() {
        // Uniswap V2 Router
        assert!(is_known_dex_router(
            "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"
        ));
        // SushiSwap
        assert!(is_known_dex_router(
            "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f"
        ));
        // Random address
        assert!(!is_known_dex_router(
            "0x1234567890123456789012345678901234567890"
        ));
    }

    // =========================================================================
    // Integration tests - require network access and API keys
    // Run with: cargo test --test '*' -- --ignored
    // =========================================================================

    /// Test fetching transactions for a known address (Vitalik's public address)
    #[tokio::test]
    #[ignore = "Integration test requiring network access and API key"]
    async fn test_fetch_vitalik_transactions() {
        let address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        let adapter = EvmAdapter::from_chain_id(1).unwrap();

        let txs = adapter.get_transactions(address, None, None).await.unwrap();

        assert!(!txs.is_empty());
        println!("Found {} transactions", txs.len());
    }

    /// Test fetching balances for a known address
    #[tokio::test]
    #[ignore = "Integration test requiring network access and API key"]
    async fn test_fetch_balances() {
        let address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        let adapter = EvmAdapter::from_chain_id(1).unwrap();

        let native = adapter.get_native_balance(address).await.unwrap();
        let tokens = adapter.get_token_balances(address).await.unwrap();

        println!("ETH Balance: {} wei", native.balance);
        println!("Token count: {}", tokens.len());
    }
}
