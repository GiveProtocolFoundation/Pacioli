#![allow(dead_code)]

mod defi;
mod erc20;

use crate::core::{Token, Transaction as CoreTransaction};
use alloy_primitives::{Address, U256};
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

/// Re-exports DeFiPosition and DeFiProtocolScanner for public use.
pub use defi::{DeFiPosition, DeFiProtocolScanner};

/// Re-exports ERC20Scanner for public use.
pub use erc20::ERC20Scanner;

// ──────────────────────────────────────────────────────────────────────────────
// JSON-RPC client
// ──────────────────────────────────────────────────────────────────────────────

/// Thin JSON-RPC client backed by reqwest 0.12 (uses rustls-tls, not rustls 0.21).
#[derive(Clone)]
pub struct RpcClient {
    client: reqwest::Client,
    url: String,
}

impl RpcClient {
    fn new(url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            url,
        }
    }

    async fn call_raw(&self, method: &str, params: Value) -> Result<Value> {
        let body = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        });
        let resp = self
            .client
            .post(&self.url)
            .json(&body)
            .send()
            .await?
            .json::<Value>()
            .await?;

        if let Some(err) = resp.get("error") {
            return Err(anyhow!("RPC error: {}", err));
        }
        Ok(resp["result"].clone())
    }

    async fn get_block_number(&self) -> Result<u64> {
        let v = self.call_raw("eth_blockNumber", json!([])).await?;
        let hex = v.as_str().ok_or_else(|| anyhow!("bad blockNumber"))?;
        Ok(parse_hex_u64(hex))
    }

    async fn get_balance(&self, address: Address) -> Result<U256> {
        let v = self
            .call_raw(
                "eth_getBalance",
                json!([format!("{address:#x}"), "latest"]),
            )
            .await?;
        let hex = v.as_str().unwrap_or("0x0");
        Ok(parse_hex_u256(hex))
    }

    async fn get_block_by_number(&self, block_num: u64) -> Result<Option<Value>> {
        let v = self
            .call_raw(
                "eth_getBlockByNumber",
                json!([format!("0x{:x}", block_num), true]),
            )
            .await?;
        if v.is_null() {
            Ok(None)
        } else {
            Ok(Some(v))
        }
    }

    pub async fn get_logs(&self, filter: &Value) -> Result<Vec<Value>> {
        let v = self.call_raw("eth_getLogs", json!([filter])).await?;
        Ok(serde_json::from_value(v)?)
    }

    pub async fn eth_call(&self, to: Address, data: Vec<u8>) -> Result<Vec<u8>> {
        let v = self
            .call_raw(
                "eth_call",
                json!([
                    {"to": format!("{to:#x}"), "data": format!("0x{}", hex::encode(&data))},
                    "latest"
                ]),
            )
            .await?;
        let hex_str = v.as_str().unwrap_or("0x");
        Ok(hex::decode(hex_str.trim_start_matches("0x"))?)
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

fn parse_hex_u64(s: &str) -> u64 {
    u64::from_str_radix(s.trim_start_matches("0x"), 16).unwrap_or(0)
}

fn parse_hex_u256(s: &str) -> U256 {
    U256::from_str_radix(s.trim_start_matches("0x"), 16).unwrap_or_default()
}

fn parse_address(v: &Value) -> Option<Address> {
    v.as_str()
        .and_then(|s| s.parse::<Address>().ok())
}

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
/// Configuration for connecting to and interacting with an EVM-compatible chain.
pub struct EVMChainConfig {
    /// Human-readable name of the chain.
    pub name: String,
    /// Unique numeric identifier of the chain (chain ID).
    pub chain_id: u64,
    /// HTTP RPC endpoint URL of the chain node.
    pub rpc_url: String,
    /// Optional WebSocket endpoint URL for subscribing to chain events.
    pub ws_url: Option<String>,
    /// Optional API endpoint for the chain explorer (e.g., Etherscan).
    pub explorer_api: Option<String>,
    /// Native token metadata for the chain.
    pub native_token: Token,
    /// Optional address of the multicall contract.
    pub multicall_address: Option<String>,
    /// Indicates if the chain supports substrate-specific features.
    pub substrate_features: bool,
}

// ──────────────────────────────────────────────────────────────────────────────
// EVMIndexer
// ──────────────────────────────────────────────────────────────────────────────

/// An indexer for Ethereum Virtual Machine (EVM) compatible blockchains.
///
/// Uses direct HTTP JSON-RPC calls via reqwest 0.12 (rustls-tls).
pub struct EVMIndexer {
    clients: HashMap<String, Arc<RpcClient>>,
    chain_configs: HashMap<String, EVMChainConfig>,
}

impl EVMIndexer {
    /// Creates a new `EVMIndexer` with default configurations for supported EVM chains.
    pub fn new() -> Self {
        let mut chain_configs = HashMap::new();

        chain_configs.insert(
            "moonbeam".to_string(),
            EVMChainConfig {
                name: "Moonbeam".to_string(),
                chain_id: 1284,
                rpc_url: "https://rpc.api.moonbeam.network".to_string(),
                ws_url: Some("wss://wss.api.moonbeam.network".to_string()),
                explorer_api: Some("https://api.etherscan.io/v2/api".to_string()),
                native_token: Token {
                    symbol: "GLMR".to_string(),
                    decimals: 18,
                    chain: "moonbeam".to_string(),
                    contract_address: None,
                },
                multicall_address: Some(
                    "0x83e3b61886770de2F64AAcaD2724ED4f08F7f36B".to_string(),
                ),
                substrate_features: true,
            },
        );

        chain_configs.insert(
            "moonriver".to_string(),
            EVMChainConfig {
                name: "Moonriver".to_string(),
                chain_id: 1285,
                rpc_url: "https://rpc.api.moonriver.moonbeam.network".to_string(),
                ws_url: Some("wss://wss.api.moonriver.moonbeam.network".to_string()),
                explorer_api: Some("https://api.etherscan.io/v2/api".to_string()),
                native_token: Token {
                    symbol: "MOVR".to_string(),
                    decimals: 18,
                    chain: "moonriver".to_string(),
                    contract_address: None,
                },
                multicall_address: Some(
                    "0x6477204E12A7236b9619385ea453F370aD897bb2".to_string(),
                ),
                substrate_features: true,
            },
        );

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
                multicall_address: Some(
                    "0xd11dfc2ab34abd3e1abfba80b99aefbd6255c4b8".to_string(),
                ),
                substrate_features: true,
            },
        );

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
                    decimals: 12,
                    chain: "acala".to_string(),
                    contract_address: None,
                },
                multicall_address: None,
                substrate_features: true,
            },
        );

        chain_configs.insert(
            "paseo".to_string(),
            EVMChainConfig {
                name: "Polkadot Hub TestNet".to_string(),
                chain_id: 420420422,
                rpc_url: "https://testnet-passet-hub-eth-rpc.polkadot.io".to_string(),
                ws_url: None,
                explorer_api: Some(
                    "https://blockscout-passet-hub.parity-testnet.parity.io/api".to_string(),
                ),
                native_token: Token {
                    symbol: "PAS".to_string(),
                    decimals: 18,
                    chain: "paseo".to_string(),
                    contract_address: None,
                },
                multicall_address: None,
                substrate_features: true,
            },
        );

        Self {
            clients: HashMap::new(),
            chain_configs,
        }
    }

    /// Establishes an HTTP JSON-RPC connection to the given chain.
    pub async fn connect(&mut self, chain: &str) -> Result<()> {
        if let Some(config) = self.chain_configs.get(chain) {
            let client = Arc::new(RpcClient::new(config.rpc_url.clone()));
            self.clients.insert(chain.to_string(), client);
        }
        Ok(())
    }

    /// Retrieves the latest block number for the given chain.
    pub async fn get_block_number(&self, chain: &str) -> Result<u64> {
        let client = self
            .clients
            .get(chain)
            .ok_or_else(|| anyhow!("Provider not connected for chain: {}", chain))?;
        client.get_block_number().await
    }

    /// Retrieves the native token balance of `address` on `chain`.
    pub async fn get_balance(&self, chain: &str, address: &str) -> Result<U256> {
        let addr: Address = address.parse()?;
        let client = self
            .clients
            .get(chain)
            .ok_or_else(|| anyhow!("Provider not connected"))?;
        client.get_balance(addr).await
    }

    /// Retrieves transactions for `address` on `chain` between `from_block` and `to_block`.
    pub async fn get_transactions(
        &self,
        chain: &str,
        address: &str,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CoreTransaction>> {
        let addr: Address = address.parse()?;
        let client = self
            .clients
            .get(chain)
            .ok_or_else(|| anyhow!("Provider not connected for chain: {}", chain))?;

        let mut transactions = Vec::new();

        for block_num in from_block..=to_block {
            if let Some(block) = client.get_block_by_number(block_num).await? {
                if let Some(txs) = block["transactions"].as_array() {
                    for tx in txs {
                        let from = parse_address(&tx["from"]);
                        let to = parse_address(&tx["to"]);
                        if from == Some(addr) || to == Some(addr) {
                            if let Some(core_tx) = self.convert_tx(chain, tx) {
                                transactions.push(core_tx);
                            }
                        }
                    }
                }
            }
        }

        Ok(transactions)
    }

    /// Returns an `ERC20Scanner` for the given chain if connected.
    pub fn get_erc20_scanner(&self, chain: &str) -> Result<ERC20Scanner> {
        let client = self
            .clients
            .get(chain)
            .ok_or_else(|| anyhow!("Provider not connected for chain: {}", chain))?;
        Ok(ERC20Scanner::new(client.clone()))
    }

    /// Creates a new `DeFiProtocolScanner`.
    pub fn get_defi_scanner(&self) -> DeFiProtocolScanner {
        DeFiProtocolScanner::new()
    }

    /// Scans ERC20 token balances for `wallet_address` on `chain`.
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
                    eprintln!("Error scanning token {}: {}", token_address, e);
                }
            }
        }

        Ok(balances)
    }

    /// Scans DeFi positions for `user_address` across `protocols` on `chain`.
    pub async fn scan_defi_positions(
        &self,
        chain: &str,
        user_address: &str,
        protocols: Vec<&str>,
    ) -> Result<Vec<DeFiPosition>> {
        let defi_scanner = self.get_defi_scanner();
        let user_addr: Address = user_address.parse()?;
        let client = self
            .clients
            .get(chain)
            .ok_or_else(|| anyhow!("Provider not connected for chain: {}", chain))?;

        let mut all_positions = Vec::new();

        for protocol in protocols {
            match defi_scanner
                .scan_defi_positions(client.clone(), protocol, user_addr)
                .await
            {
                Ok(mut positions) => all_positions.append(&mut positions),
                Err(e) => eprintln!("Error scanning DeFi positions for {}: {}", protocol, e),
            }
        }

        Ok(all_positions)
    }

    fn convert_tx(&self, chain: &str, tx: &Value) -> Option<CoreTransaction> {
        let config = self.chain_configs.get(chain)?;

        let hash = tx["hash"].as_str().unwrap_or("0x").to_string();
        let from = tx["from"].as_str().unwrap_or("0x").to_string();
        let to = tx["to"].as_str().map(String::from);
        let value_str = tx["value"].as_str().unwrap_or("0x0");
        let gas_price_str = tx["gasPrice"].as_str().unwrap_or("0x0");
        let gas_str = tx["gas"].as_str().unwrap_or("0x0");
        let nonce_str = tx["nonce"].as_str().unwrap_or("0x0");
        let input = tx["input"].as_str().unwrap_or("0x").to_string();
        let block_number = tx["blockNumber"]
            .as_str()
            .map(parse_hex_u64)
            .unwrap_or(0);

        let gas_price = parse_hex_u64(gas_price_str) as u128;
        let gas = parse_hex_u64(gas_str);
        let fee = if gas_price > 0 {
            Some((gas_price * gas as u128).to_string())
        } else {
            None
        };

        Some(CoreTransaction {
            id: uuid::Uuid::new_v4(),
            profile_id: None,
            chain: chain.to_string(),
            hash,
            from_address: from,
            to_address: to,
            value: parse_hex_u256(value_str).to_string(),
            token_symbol: config.native_token.symbol.clone(),
            token_decimals: config.native_token.decimals as i32,
            timestamp: chrono::Utc::now(),
            block_number: block_number as i64,
            transaction_type: "transfer".to_string(),
            status: "confirmed".to_string(),
            fee,
            metadata: json!({
                "nonce": parse_hex_u64(nonce_str),
                "gas_limit": gas,
                "input": input,
            }),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }
}
