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

/// ERC20Scanner provides functionality to scan ERC20 token data from a blockchain provider.
pub struct ERC20Scanner {
    provider: Arc<Provider<Ws>>,
}

impl ERC20Scanner {
    /// Creates a new ERC20Scanner with the given WebSocket provider.
    ///
    /// # Arguments
    ///
    /// * `provider` - An `Arc<Provider<Ws>>` instance used to interact with the Ethereum network.
    pub fn new(provider: Arc<Provider<Ws>>) -> Self {
        Self { provider }
    }

    /// Fetches token information for the specified ERC20 token contract address.
    ///
    /// This method calls the token contract to retrieve its name, symbol, decimals,
    /// and total supply, and returns a `TokenInfo` struct containing these details.
    ///
    /// # Arguments
    ///
    /// * `token_address` - The Ethereum address of the ERC20 token contract.
    ///
    /// # Returns
    ///
    /// A `Result` containing `TokenInfo` on success or an error if the calls fail.
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
}

    /// Retrieves the ERC20 token balance for a given wallet.
    ///
    /// # Arguments
    ///
    /// * `token_address` - The address of the ERC20 token contract.
    /// * `wallet_address` - The address of the wallet to query the balance for.
    ///
    /// # Returns
    ///
    /// A `Result` containing the token balance as a `U256` on success, or an error on failure.
    pub async fn get_token_balance(
        &self,
        token_address: Address,
        wallet_address: Address,
    ) -> Result<U256> {
        let contract = IERC20::new(token_address, self.provider.clone());
        let balance = contract.balance_of(wallet_address).call().await?;
        Ok(balance)
    }

    /// Scans `Transfer` events for the given ERC-20 token and wallet address between `from_block` and `to_block`.
    /// Returns a `Vec<TokenTransfer>` containing each transfer event involving the wallet.
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
    pub transaction_hash: TxHash,
    /// The address that sent the tokens.
    pub from: Address,
    /// The address that received the tokens.
    pub to: Address,
    /// The amount of tokens transferred.
    pub value: U256,
    /// The address of the token contract.
    pub token_address: Address,
}
