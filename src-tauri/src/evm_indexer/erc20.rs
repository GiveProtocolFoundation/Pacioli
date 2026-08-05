#![allow(dead_code)]

use super::RpcClient;
use alloy_primitives::{Address, B256, U256};
use alloy_sol_types::{sol, SolCall, SolEvent};
use anyhow::Result;
use serde_json::json;
use std::sync::Arc;

// ERC20 ABI definitions using alloy-sol-types (no alloy-provider required)
sol! {
    interface IERC20 {
        function name() external view returns (string);
        function symbol() external view returns (string);
        function decimals() external view returns (uint8);
        function totalSupply() external view returns (uint256);
        function balanceOf(address owner) external view returns (uint256);
        function transfer(address to, uint256 amount) external returns (bool);
        function allowance(address owner, address spender) external view returns (uint256);
        function approve(address spender, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        event Transfer(address indexed from, address indexed to, uint256 value);
        event Approval(address indexed owner, address indexed spender, uint256 value);
    }
}

/// ERC20Scanner provides functionality to scan ERC20 token data via JSON-RPC.
pub struct ERC20Scanner {
    client: Arc<RpcClient>,
}

impl ERC20Scanner {
    /// Creates a new `ERC20Scanner` with the given RPC client.
    pub fn new(client: Arc<RpcClient>) -> Self {
        Self { client }
    }

    /// Fetches token information for the specified ERC20 token contract address.
    pub async fn get_token_info(&self, token_address: Address) -> Result<TokenInfo> {
        let name = self
            .eth_call_decode::<IERC20::nameCall>(token_address, IERC20::nameCall {})
            .await
            .map(|r| r._0)
            .unwrap_or_default();

        let symbol = self
            .eth_call_decode::<IERC20::symbolCall>(token_address, IERC20::symbolCall {})
            .await
            .map(|r| r._0)
            .unwrap_or_default();

        let decimals = self
            .eth_call_decode::<IERC20::decimalsCall>(token_address, IERC20::decimalsCall {})
            .await
            .map(|r| r._0)
            .unwrap_or(18);

        let total_supply = self
            .eth_call_decode::<IERC20::totalSupplyCall>(token_address, IERC20::totalSupplyCall {})
            .await
            .map(|r| r._0)
            .unwrap_or_default();

        Ok(TokenInfo {
            address: token_address,
            name,
            symbol,
            decimals,
            total_supply,
        })
    }

    /// Retrieves the ERC20 token balance for a given wallet.
    pub async fn get_token_balance(
        &self,
        token_address: Address,
        wallet_address: Address,
    ) -> Result<U256> {
        let ret = self
            .eth_call_decode::<IERC20::balanceOfCall>(
                token_address,
                IERC20::balanceOfCall {
                    owner: wallet_address,
                },
            )
            .await?;
        Ok(ret._0)
    }

    /// Scans `Transfer` events for the given ERC-20 token and wallet address.
    pub async fn scan_token_transfers(
        &self,
        token_address: Address,
        wallet_address: Address,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<TokenTransfer>> {
        let sig_hash = IERC20::Transfer::SIGNATURE_HASH;
        let filter = json!({
            "address": format!("{token_address:#x}"),
            "topics": [format!("{sig_hash:#x}")],
            "fromBlock": format!("0x{:x}", from_block),
            "toBlock": format!("0x{:x}", to_block),
        });

        let raw_logs = self.client.get_logs(&filter).await?;

        let mut transfers = Vec::new();
        for log in &raw_logs {
            let topics: Vec<B256> = log["topics"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|t| t.as_str().and_then(|s| s.parse::<B256>().ok()))
                .collect();

            let data_hex = log["data"].as_str().unwrap_or("0x");
            let data_bytes = hex::decode(data_hex.trim_start_matches("0x")).unwrap_or_default();

            let primitive_log =
                alloy_primitives::Log::new_unchecked(token_address, topics, data_bytes.into());

            if let Ok(decoded) = IERC20::Transfer::decode_log(&primitive_log, true) {
                if decoded.from == wallet_address || decoded.to == wallet_address {
                    let block_number = log["blockNumber"]
                        .as_str()
                        .map(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).unwrap_or(0))
                        .unwrap_or(0);

                    let transaction_hash = log["transactionHash"]
                        .as_str()
                        .and_then(|s| s.parse::<B256>().ok())
                        .unwrap_or_default();

                    transfers.push(TokenTransfer {
                        block_number,
                        transaction_hash,
                        from: decoded.from,
                        to: decoded.to,
                        value: decoded.value,
                        token_address,
                    });
                }
            }
        }

        Ok(transfers)
    }

    async fn eth_call_decode<C: SolCall>(&self, to: Address, call: C) -> Result<C::Return> {
        let data = call.abi_encode();
        let ret_bytes = self.client.eth_call(to, data).await?;
        Ok(C::abi_decode_returns(&ret_bytes, false)?)
    }
}

/// Metadata information for an ERC-20 token.
#[derive(Debug, Clone)]
pub struct TokenInfo {
    /// The Ethereum address of the token contract.
    pub address: Address,
    /// The name of the token (e.g., "MyToken").
    pub name: String,
    /// The symbol of the token (e.g., "MTK").
    pub symbol: String,
    /// The number of decimal places used by the token.
    pub decimals: u8,
    /// The total token supply as reported by the contract.
    pub total_supply: U256,
}

/// Represents a single ERC-20 token transfer event involving a specific wallet.
#[derive(Debug, Clone)]
pub struct TokenTransfer {
    /// The block number in which the transfer occurred.
    pub block_number: u64,
    /// The hash of the transaction that included the transfer.
    pub transaction_hash: B256,
    /// The address that sent the tokens.
    pub from: Address,
    /// The address that received the tokens.
    pub to: Address,
    /// The amount of tokens transferred.
    pub value: U256,
    /// The address of the token contract.
    pub token_address: Address,
}
