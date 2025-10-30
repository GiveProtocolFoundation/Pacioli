#![allow(dead_code)]

use anyhow::Result;
use ethers::contract::abigen;
use ethers::prelude::*;
use std::sync::Arc;

// Generate ERC20 ABI bindings
abigen!(
    IERC20,
    r#"[
        function name() external view returns (string)
        function symbol() external view returns (string)
        function decimals() external view returns (uint8)
        function totalSupply() external view returns (uint256)
        function balanceOf(address owner) external view returns (uint256)
        function transfer(address to, uint256 amount) external returns (bool)
        function allowance(address owner, address spender) external view returns (uint256)
        function approve(address spender, uint256 amount) external returns (bool)
        function transferFrom(address from, address to, uint256 amount) external returns (bool)
        event Transfer(address indexed from, address indexed to, uint256 value)
        event Approval(address indexed owner, address indexed spender, uint256 value)
    ]"#
);

pub struct ERC20Scanner {
    provider: Arc<Provider<Ws>>,
}

impl ERC20Scanner {
    pub fn new(provider: Arc<Provider<Ws>>) -> Self {
        Self { provider }
    }

    pub async fn get_token_info(&self, token_address: Address) -> Result<TokenInfo> {
        let contract = IERC20::new(token_address, self.provider.clone());

        let name = contract.name().call().await?;
        let symbol = contract.symbol().call().await?;
        let decimals = contract.decimals().call().await?;
        let total_supply = contract.total_supply().call().await?;

        Ok(TokenInfo {
            address: token_address,
            name,
            symbol,
            decimals,
            total_supply,
        })
    }

    pub async fn get_token_balance(
        &self,
        token_address: Address,
        wallet_address: Address,
    ) -> Result<U256> {
        let contract = IERC20::new(token_address, self.provider.clone());
        let balance = contract.balance_of(wallet_address).call().await?;
        Ok(balance)
    }

    pub async fn scan_token_transfers(
        &self,
        token_address: Address,
        wallet_address: Address,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<TokenTransfer>> {
        let contract = IERC20::new(token_address, self.provider.clone());

        // Get all Transfer events involving the wallet
        let filter = contract
            .transfer_filter()
            .from_block(from_block)
            .to_block(to_block);

        let logs = filter.query_with_meta().await?;

        let mut transfers = Vec::new();
        for (log, meta) in logs {
            if log.from == wallet_address || log.to == wallet_address {
                transfers.push(TokenTransfer {
                    block_number: meta.block_number.as_u64(),
                    transaction_hash: meta.transaction_hash,
                    from: log.from,
                    to: log.to,
                    value: log.value,
                    token_address,
                });
            }
        }

        Ok(transfers)
    }
}

#[derive(Debug, Clone)]
pub struct TokenInfo {
    pub address: Address,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: U256,
}

#[derive(Debug, Clone)]
pub struct TokenTransfer {
    pub block_number: u64,
    pub transaction_hash: TxHash,
    pub from: Address,
    pub to: Address,
    pub value: U256,
    pub token_address: Address,
}
