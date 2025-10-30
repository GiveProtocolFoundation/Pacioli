#![allow(dead_code)]

mod defi;
mod erc20;

use crate::core::{Token, Transaction as CoreTransaction};
use anyhow::Result;
use ethers::prelude::*;
use ethers::providers::{Http, Provider, Ws};
use std::collections::HashMap;
use std::sync::Arc;

pub use defi::{DeFiPosition, DeFiProtocolScanner};
pub use erc20::ERC20Scanner;

pub struct EVMIndexer {
    providers: HashMap<String, Arc<Provider<Ws>>>,
    http_providers: HashMap<String, Arc<Provider<Http>>>,
    chain_configs: HashMap<String, EVMChainConfig>,
}

#[derive(Clone, Debug)]
pub struct EVMChainConfig {
    pub name: String,
    pub chain_id: u64,
    pub rpc_url: String,
    pub ws_url: Option<String>,
    pub explorer_api: Option<String>,
    pub native_token: Token,
    pub multicall_address: Option<String>,
    pub substrate_features: bool, // For Moonbeam/Astar specific features
}

impl EVMIndexer {
    pub fn new() -> Self {
        let mut chain_configs = HashMap::new();

        // Moonbeam configuration
        chain_configs.insert(
            "moonbeam".to_string(),
            EVMChainConfig {
                name: "Moonbeam".to_string(),
                chain_id: 1284,
                rpc_url: "https://rpc.api.moonbeam.network".to_string(),
                ws_url: Some("wss://wss.api.moonbeam.network".to_string()),
                explorer_api: Some("https://api-moonbeam.moonscan.io/api".to_string()),
                native_token: Token {
                    symbol: "GLMR".to_string(),
                    decimals: 18,
                    chain: "moonbeam".to_string(),
                    contract_address: None,
                },
                multicall_address: Some("0x83e3b61886770de2F64AAcaD2724ED4f08F7f36B".to_string()),
                substrate_features: true,
            },
        );

        // Moonriver configuration
        chain_configs.insert(
            "moonriver".to_string(),
            EVMChainConfig {
                name: "Moonriver".to_string(),
                chain_id: 1285,
                rpc_url: "https://rpc.api.moonriver.moonbeam.network".to_string(),
                ws_url: Some("wss://wss.api.moonriver.moonbeam.network".to_string()),
                explorer_api: Some("https://api-moonriver.moonscan.io/api".to_string()),
                native_token: Token {
                    symbol: "MOVR".to_string(),
                    decimals: 18,
                    chain: "moonriver".to_string(),
                    contract_address: None,
                },
                multicall_address: Some("0x6477204E12A7236b9619385ea453F370aD897bb2".to_string()),
                substrate_features: true,
            },
        );

        // Astar configuration
        chain_configs.insert(
            "astar".to_string(),
            EVMChainConfig {
                name: "Astar".to_string(),
                chain_id: 592,
                rpc_url: "https://evm.astar.network".to_string(),
                ws_url: Some("wss://rpc.astar.network".to_string()),
                explorer_api: Some("https://blockscout.com/astar/api".to_string()),
                native_token: Token {
                    symbol: "ASTR".to_string(),
                    decimals: 18,
                    chain: "astar".to_string(),
                    contract_address: None,
                },
                multicall_address: Some("0xd11dfc2ab34abd3e1abfba80b99aefbd6255c4b8".to_string()),
                substrate_features: true,
            },
        );

        // Acala EVM+ configuration
        chain_configs.insert(
            "acala-evm".to_string(),
            EVMChainConfig {
                name: "Acala EVM+".to_string(),
                chain_id: 787,
                rpc_url: "https://eth-rpc-acala.aca-api.network".to_string(),
                ws_url: Some("wss://eth-rpc-acala.aca-api.network".to_string()),
                explorer_api: None,
                native_token: Token {
                    symbol: "ACA".to_string(),
                    decimals: 12, // Note: Acala uses 12 decimals
                    chain: "acala".to_string(),
                    contract_address: None,
                },
                multicall_address: None,
                substrate_features: true,
            },
        );

        // Paseo TestNet configuration (Polkadot Hub TestNet)
        chain_configs.insert(
            "paseo".to_string(),
            EVMChainConfig {
                name: "Polkadot Hub TestNet".to_string(),
                chain_id: 420420422, // 0x1911f0a6 in hex
                rpc_url: "https://testnet-passet-hub-eth-rpc.polkadot.io".to_string(),
                ws_url: None, // WebSocket not documented for Paseo yet
                explorer_api: Some(
                    "https://blockscout-passet-hub.parity-testnet.parity.io/api".to_string(),
                ),
                native_token: Token {
                    symbol: "PAS".to_string(),
                    decimals: 18,
                    chain: "paseo".to_string(),
                    contract_address: None,
                },
                multicall_address: None,  // To be determined
                substrate_features: true, // PolkaVM enabled
            },
        );

        Self {
            providers: HashMap::new(),
            http_providers: HashMap::new(),
            chain_configs,
        }
    }

    pub async fn connect(&mut self, chain: &str) -> Result<()> {
        if let Some(config) = self.chain_configs.get(chain) {
            // Connect via WebSocket if available
            if let Some(ws_url) = &config.ws_url {
                let provider = Provider::<Ws>::connect(ws_url).await?;
                self.providers.insert(chain.to_string(), Arc::new(provider));
            }

            // Also maintain HTTP provider for certain operations
            let http_provider = Provider::<Http>::try_from(config.rpc_url.clone())?;
            self.http_providers
                .insert(chain.to_string(), Arc::new(http_provider));
        }
        Ok(())
    }

    pub async fn get_block_number(&self, chain: &str) -> Result<u64> {
        if let Some(provider) = self.providers.get(chain) {
            let block_number = provider.get_block_number().await?;
            Ok(block_number.as_u64())
        } else {
            Err(anyhow::anyhow!(
                "Provider not connected for chain: {}",
                chain
            ))
        }
    }

    pub async fn get_balance(&self, chain: &str, address: &str) -> Result<U256> {
        let addr: Address = address.parse()?;

        if let Some(provider) = self.providers.get(chain) {
            let balance = provider.get_balance(addr, None).await?;
            Ok(balance)
        } else {
            Err(anyhow::anyhow!("Provider not connected"))
        }
    }

    pub async fn get_transactions(
        &self,
        chain: &str,
        address: &str,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CoreTransaction>> {
        let mut transactions = Vec::new();
        let addr: Address = address.parse()?;

        if let Some(provider) = self.providers.get(chain) {
            // Get transactions for the address
            // This is simplified - in production you'd need to:
            // 1. Query logs for ERC20 transfers
            // 2. Get internal transactions
            // 3. Handle different transaction types

            for block_num in from_block..=to_block {
                if let Ok(Some(block)) = provider.get_block_with_txs(block_num).await {
                    for tx in block.transactions {
                        if tx.from == addr || tx.to == Some(addr) {
                            transactions.push(self.convert_to_core_transaction(chain, tx)?);
                        }
                    }
                }
            }
        }

        Ok(transactions)
    }

    pub fn get_erc20_scanner(&self, chain: &str) -> Result<ERC20Scanner> {
        if let Some(provider) = self.providers.get(chain) {
            Ok(ERC20Scanner::new(provider.clone()))
        } else {
            Err(anyhow::anyhow!(
                "Provider not connected for chain: {}",
                chain
            ))
        }
    }

    pub fn get_defi_scanner(&self) -> DeFiProtocolScanner {
        DeFiProtocolScanner::new()
    }

    pub async fn scan_erc20_balances(
        &self,
        chain: &str,
        wallet_address: &str,
        token_addresses: Vec<&str>,
    ) -> Result<Vec<(String, U256)>> {
        let scanner = self.get_erc20_scanner(chain)?;
        let wallet_addr: Address = wallet_address.parse()?;

        let mut balances = Vec::new();

        for token_address in token_addresses {
            let token_addr: Address = token_address.parse()?;
            match scanner.get_token_balance(token_addr, wallet_addr).await {
                Ok(balance) => {
                    balances.push((token_address.to_string(), balance));
                }
                Err(e) => {
                    // Log error but continue scanning other tokens
                    eprintln!("Error scanning token {}: {}", token_address, e);
                }
            }
        }

        Ok(balances)
    }

    pub async fn scan_defi_positions(
        &self,
        chain: &str,
        user_address: &str,
        protocols: Vec<&str>,
    ) -> Result<Vec<DeFiPosition>> {
        let defi_scanner = self.get_defi_scanner();
        let user_addr: Address = user_address.parse()?;

        if let Some(provider) = self.providers.get(chain) {
            let mut all_positions = Vec::new();

            for protocol in protocols {
                match defi_scanner
                    .scan_defi_positions(provider.clone(), protocol, user_addr)
                    .await
                {
                    Ok(mut positions) => {
                        all_positions.append(&mut positions);
                    }
                    Err(e) => {
                        // Log error but continue scanning other protocols
                        eprintln!("Error scanning DeFi positions for {}: {}", protocol, e);
                    }
                }
            }

            Ok(all_positions)
        } else {
            Err(anyhow::anyhow!(
                "Provider not connected for chain: {}",
                chain
            ))
        }
    }

    fn convert_to_core_transaction(
        &self,
        chain: &str,
        tx: ethers::types::Transaction,
    ) -> Result<CoreTransaction> {
        let config = self
            .chain_configs
            .get(chain)
            .ok_or_else(|| anyhow::anyhow!("Unknown chain"))?;

        Ok(CoreTransaction {
            id: uuid::Uuid::new_v4(),
            profile_id: None,
            chain: chain.to_string(),
            hash: format!("0x{}", hex::encode(tx.hash)),
            from_address: format!("0x{}", hex::encode(tx.from)),
            to_address: tx.to.map(|a| format!("0x{}", hex::encode(a))),
            value: tx.value.to_string(),
            token_symbol: config.native_token.symbol.clone(),
            token_decimals: config.native_token.decimals as i32,
            timestamp: chrono::Utc::now(), // Would need to get from block
            block_number: tx.block_number.unwrap_or_default().as_u64() as i64,
            transaction_type: "transfer".to_string(),
            status: "confirmed".to_string(),
            fee: tx
                .gas_price
                .map(|gp| {
                    let gas_used = tx.gas;
                    (gp * gas_used).to_string()
                }),
            metadata: serde_json::json!({
                "nonce": tx.nonce.as_u64(),
                "gas_limit": tx.gas.as_u64(),
                "input": format!("0x{}", hex::encode(&tx.input)),
            }),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }
}
