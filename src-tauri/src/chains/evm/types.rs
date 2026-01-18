//! EVM-specific types
//!
//! Types for EVM chain data including transactions, token transfers, and balances.
//! Includes conversion methods to unified chain types for the accounting engine.

use crate::chains::{ChainId, ChainTransaction, TokenTransfer, TransactionStatus, TransactionType};
use serde::{Deserialize, Serialize};

// =============================================================================
// TRANSACTION TYPES
// =============================================================================

/// EVM transaction from block explorer APIs (Etherscan format)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmTransaction {
    /// Transaction hash
    pub hash: String,
    /// Block number (as string from API)
    pub block_number: String,
    /// Unix timestamp (as string from API)
    pub time_stamp: String,
    /// Sender address
    pub from: String,
    /// Recipient address (empty for contract creation)
    pub to: String,
    /// Value in wei (as string for big numbers)
    pub value: String,
    /// Gas limit
    pub gas: String,
    /// Gas price in wei
    pub gas_price: String,
    /// Actual gas used
    pub gas_used: String,
    /// Transaction nonce
    #[serde(default)]
    pub nonce: String,
    /// Error flag ("0" = success, "1" = error)
    #[serde(default)]
    pub is_error: String,
    /// Receipt status ("1" = success, "0" = failure)
    #[serde(default)]
    pub tx_receipt_status: String,
    /// Input data (calldata)
    #[serde(default)]
    pub input: String,
    /// Created contract address (if contract deployment)
    #[serde(default)]
    pub contract_address: String,
    /// Decoded function name (if available)
    #[serde(default)]
    pub function_name: String,
    /// Method ID (first 4 bytes of input)
    #[serde(default)]
    pub method_id: String,
    /// Confirmations count
    #[serde(default)]
    pub confirmations: String,
    /// Cumulative gas used in block
    #[serde(default)]
    pub cumulative_gas_used: String,
    /// EIP-1559 max fee per gas (if applicable)
    #[serde(default)]
    pub max_fee_per_gas: String,
    /// EIP-1559 max priority fee per gas (if applicable)
    #[serde(default)]
    pub max_priority_fee_per_gas: String,
}

impl EvmTransaction {
    /// Convert to unified ChainTransaction format
    pub fn to_chain_transaction(&self, chain_id: ChainId) -> ChainTransaction {
        let block_number: u64 = self.block_number.parse().unwrap_or(0);
        let timestamp: i64 = self.time_stamp.parse().unwrap_or(0);

        let status = if self.is_error == "1" {
            TransactionStatus::Failed
        } else {
            TransactionStatus::Success
        };

        let tx_type = self.classify_transaction_type();

        // Calculate fee: gas_used * gas_price
        let gas_used: u128 = self.gas_used.parse().unwrap_or(0);
        let gas_price: u128 = self.gas_price.parse().unwrap_or(0);
        let fee = (gas_used * gas_price).to_string();

        ChainTransaction {
            hash: self.hash.clone(),
            chain_id,
            block_number,
            timestamp,
            from: self.from.clone(),
            to: if self.to.is_empty() {
                None
            } else {
                Some(self.to.clone())
            },
            value: self.value.clone(),
            fee,
            status,
            tx_type,
            token_transfers: Vec::new(),
            raw_data: Some(serde_json::to_value(self).unwrap_or_default()),
        }
    }

    /// Classify transaction type based on method signature
    fn classify_transaction_type(&self) -> TransactionType {
        // Contract deployment
        if self.to.is_empty() && !self.contract_address.is_empty() {
            return TransactionType::ContractDeploy;
        }

        // Get method ID (first 10 chars including 0x)
        let method_id = if self.input.len() >= 10 {
            &self.input[..10]
        } else {
            ""
        };

        match method_id {
            // ERC20 transfers
            "0xa9059cbb" => TransactionType::Transfer, // transfer(address,uint256)
            "0x23b872dd" => TransactionType::Transfer, // transferFrom(address,address,uint256)

            // Approvals
            "0x095ea7b3" => TransactionType::Approval, // approve(address,uint256)

            // Uniswap V2/V3 and common DEX swaps
            "0x38ed1739" | // swapExactTokensForTokens
            "0x8803dbee" | // swapTokensForExactTokens
            "0x7ff36ab5" | // swapExactETHForTokens
            "0x18cbafe5" | // swapExactTokensForETH
            "0xfb3bdb41" | // swapETHForExactTokens
            "0x5c11d795" | // swapExactTokensForTokensSupportingFeeOnTransferTokens
            "0x791ac947" | // swapExactTokensForETHSupportingFeeOnTransferTokens
            "0xb6f9de95" | // swapExactETHForTokensSupportingFeeOnTransferTokens
            "0x04e45aaf" | // exactInputSingle (V3)
            "0xc04b8d59" | // exactInput (V3)
            "0x414bf389"   // exactInputSingle (V3 old)
            => TransactionType::Swap,

            // Liquidity
            "0xe8e33700" | // addLiquidity
            "0xf305d719"   // addLiquidityETH
            => TransactionType::AddLiquidity,

            "0xbaa2abde" | // removeLiquidity
            "0x02751cec"   // removeLiquidityETH
            => TransactionType::RemoveLiquidity,

            // Staking (common patterns)
            "0xa694fc3a" | // stake(uint256)
            "0x3a4b66f1"   // stake()
            => TransactionType::Stake,

            "0x2e1a7d4d" | // withdraw(uint256)
            "0x853828b6"   // withdrawAll()
            => TransactionType::Unstake,

            // Minting
            "0x40c10f19" | // mint(address,uint256)
            "0xa0712d68"   // mint(uint256)
            => TransactionType::Mint,

            // Burning
            "0x42966c68" | // burn(uint256)
            "0x9dc29fac"   // burn(address,uint256)
            => TransactionType::Burn,

            // Plain ETH transfer or empty input
            "" | "0x" => {
                if self.value != "0" {
                    TransactionType::Transfer
                } else {
                    TransactionType::ContractCall
                }
            }

            _ => {
                if self.value != "0" && (self.input == "0x" || self.input.is_empty()) {
                    TransactionType::Transfer
                } else {
                    TransactionType::ContractCall
                }
            }
        }
    }

    /// Check if this is an EIP-1559 transaction
    pub fn is_eip1559(&self) -> bool {
        !self.max_fee_per_gas.is_empty() && self.max_fee_per_gas != "0"
    }

    /// Get effective gas price (actual price paid)
    pub fn effective_gas_price(&self) -> String {
        if self.is_eip1559() {
            // For EIP-1559, effective price is base fee + priority fee
            // But we typically just have gas_price which is already effective
            self.gas_price.clone()
        } else {
            self.gas_price.clone()
        }
    }
}

// =============================================================================
// TOKEN TRANSFER TYPES
// =============================================================================

/// ERC20 token transfer event from block explorer APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Erc20Transfer {
    /// Transaction hash
    pub hash: String,
    /// Block number
    pub block_number: String,
    /// Unix timestamp
    pub time_stamp: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Transfer value (in token's smallest unit)
    pub value: String,
    /// Token contract address
    pub contract_address: String,
    /// Token name
    pub token_name: String,
    /// Token symbol
    pub token_symbol: String,
    /// Token decimals
    pub token_decimal: String,
    /// Log index within the transaction
    #[serde(default)]
    pub log_index: String,
    /// Transaction index in block
    #[serde(default)]
    pub transaction_index: String,
    /// Gas used by this transfer
    #[serde(default)]
    pub gas_used: String,
    /// Gas price
    #[serde(default)]
    pub gas_price: String,
    /// Nonce
    #[serde(default)]
    pub nonce: String,
}

impl Erc20Transfer {
    /// Convert to unified TokenTransfer format
    pub fn to_token_transfer(&self) -> TokenTransfer {
        TokenTransfer {
            token_address: self.contract_address.clone(),
            token_symbol: Some(self.token_symbol.clone()),
            token_decimals: self.token_decimal.parse().ok(),
            from: self.from.clone(),
            to: self.to.clone(),
            value: self.value.clone(),
        }
    }

    /// Get timestamp as i64
    pub fn timestamp(&self) -> i64 {
        self.time_stamp.parse().unwrap_or(0)
    }

    /// Get block number as u64
    pub fn block(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }
}

/// ERC721 (NFT) transfer event from block explorer APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Erc721Transfer {
    /// Transaction hash
    pub hash: String,
    /// Block number
    pub block_number: String,
    /// Unix timestamp
    pub time_stamp: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// NFT contract address
    pub contract_address: String,
    /// Token ID
    pub token_id: String,
    /// Collection name
    pub token_name: String,
    /// Collection symbol
    pub token_symbol: String,
    /// Log index
    #[serde(default)]
    pub log_index: String,
    /// Gas used
    #[serde(default)]
    pub gas_used: String,
    /// Gas price
    #[serde(default)]
    pub gas_price: String,
}

impl Erc721Transfer {
    /// Get timestamp as i64
    pub fn timestamp(&self) -> i64 {
        self.time_stamp.parse().unwrap_or(0)
    }

    /// Get block number as u64
    pub fn block(&self) -> u64 {
        self.block_number.parse().unwrap_or(0)
    }

    /// Check if this is a mint (from zero address)
    pub fn is_mint(&self) -> bool {
        self.from == "0x0000000000000000000000000000000000000000"
    }

    /// Check if this is a burn (to zero address)
    pub fn is_burn(&self) -> bool {
        self.to == "0x0000000000000000000000000000000000000000"
    }
}

/// ERC1155 multi-token transfer event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Erc1155Transfer {
    /// Transaction hash
    pub hash: String,
    /// Block number
    pub block_number: String,
    /// Unix timestamp
    pub time_stamp: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Contract address
    pub contract_address: String,
    /// Token ID
    pub token_id: String,
    /// Token value (amount for semi-fungible)
    pub token_value: String,
    /// Token name
    #[serde(default)]
    pub token_name: String,
    /// Token symbol
    #[serde(default)]
    pub token_symbol: String,
}

// =============================================================================
// INTERNAL TRANSACTION
// =============================================================================

/// Internal transaction (trace) from contract calls
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InternalTransaction {
    /// Parent transaction hash
    pub hash: String,
    /// Block number
    pub block_number: String,
    /// Unix timestamp
    pub time_stamp: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Value transferred in wei
    pub value: String,
    /// Created contract address (for create traces)
    #[serde(default)]
    pub contract_address: String,
    /// Trace type (call, create, delegatecall, etc.)
    #[serde(rename = "type")]
    pub trace_type: String,
    /// Gas provided
    #[serde(default)]
    pub gas: String,
    /// Gas used
    #[serde(default)]
    pub gas_used: String,
    /// Error flag
    #[serde(default)]
    pub is_error: String,
    /// Error code/message
    #[serde(default)]
    pub err_code: String,
    /// Trace ID (position in trace tree)
    #[serde(default)]
    pub trace_id: String,
}

impl InternalTransaction {
    /// Check if this internal transaction failed
    pub fn is_failed(&self) -> bool {
        self.is_error == "1"
    }

    /// Get value as u128
    pub fn value_u128(&self) -> u128 {
        self.value.parse().unwrap_or(0)
    }

    /// Check if this is a contract creation
    pub fn is_create(&self) -> bool {
        self.trace_type == "create" || self.trace_type == "create2"
    }
}

// =============================================================================
// BALANCE TYPES
// =============================================================================

/// Complete wallet balance snapshot for an address
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletBalance {
    /// Wallet address
    pub address: String,
    /// Chain ID
    pub chain_id: u64,
    /// Chain name
    pub chain_name: String,
    /// Native token balance in wei
    pub native_balance: String,
    /// Native token symbol
    pub native_symbol: String,
    /// Formatted native balance (human readable)
    pub native_balance_formatted: String,
    /// Token balances
    pub tokens: Vec<EvmTokenBalance>,
    /// Last update timestamp (Unix)
    pub last_updated: i64,
}

impl WalletBalance {
    /// Create a new wallet balance
    pub fn new(address: String, chain_id: u64, chain_name: String) -> Self {
        Self {
            address,
            chain_id,
            chain_name,
            native_balance: "0".to_string(),
            native_symbol: "ETH".to_string(),
            native_balance_formatted: "0".to_string(),
            tokens: Vec::new(),
            last_updated: chrono::Utc::now().timestamp(),
        }
    }

    /// Get total number of tokens with non-zero balance
    pub fn token_count(&self) -> usize {
        self.tokens.iter().filter(|t| t.balance != "0").count()
    }

    /// Check if wallet has any balance
    pub fn has_balance(&self) -> bool {
        self.native_balance != "0" || self.tokens.iter().any(|t| t.balance != "0")
    }
}

/// EVM token balance (ERC20)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmTokenBalance {
    /// Token contract address
    pub contract_address: String,
    /// Token symbol
    pub symbol: String,
    /// Token name
    pub name: String,
    /// Token decimals
    pub decimals: u8,
    /// Raw balance in smallest units
    pub balance: String,
    /// Formatted balance (human readable)
    pub balance_formatted: String,
    /// Token logo URL (if available)
    #[serde(default)]
    pub logo_url: Option<String>,
    /// USD value (if price available)
    #[serde(default)]
    pub usd_value: Option<String>,
}

impl EvmTokenBalance {
    /// Convert to unified TokenBalance
    pub fn to_chain_token_balance(&self) -> crate::chains::TokenBalance {
        crate::chains::TokenBalance {
            token_address: self.contract_address.clone(),
            token_symbol: Some(self.symbol.clone()),
            token_name: Some(self.name.clone()),
            token_decimals: self.decimals,
            balance: self.balance.clone(),
            balance_formatted: self.balance_formatted.clone(),
        }
    }

    /// Check if balance is zero
    pub fn is_zero(&self) -> bool {
        self.balance == "0" || self.balance.is_empty()
    }
}

// =============================================================================
// ADDITIONAL UTILITY TYPES
// =============================================================================

/// Token info from contract metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    /// Contract address
    pub address: String,
    /// Token name
    pub name: String,
    /// Token symbol
    pub symbol: String,
    /// Token decimals
    pub decimals: u8,
    /// Total supply
    pub total_supply: Option<String>,
}

/// Block info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockInfo {
    /// Block number
    pub number: u64,
    /// Block hash
    pub hash: String,
    /// Block timestamp
    pub timestamp: u64,
    /// Number of transactions
    pub transactions_count: usize,
    /// Base fee per gas (EIP-1559)
    #[serde(default)]
    pub base_fee_per_gas: Option<String>,
}

/// Gas price info (for gas estimation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasPrice {
    /// Slow confirmation speed
    pub slow: String,
    /// Standard confirmation speed
    pub standard: String,
    /// Fast confirmation speed
    pub fast: String,
    /// Instant confirmation
    pub instant: String,
    /// Base fee (EIP-1559)
    #[serde(default)]
    pub base_fee: Option<String>,
}

/// Contract verification status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractInfo {
    /// Contract address
    pub address: String,
    /// Whether source is verified
    pub is_verified: bool,
    /// Contract name
    pub contract_name: Option<String>,
    /// Compiler version used
    pub compiler_version: Option<String>,
    /// Contract ABI
    pub abi: Option<serde_json::Value>,
    /// Implementation address (for proxies)
    #[serde(default)]
    pub implementation: Option<String>,
}

/// Log event from transaction receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    /// Contract that emitted the event
    pub address: String,
    /// Event topics (indexed parameters)
    pub topics: Vec<String>,
    /// Event data (non-indexed parameters)
    pub data: String,
    /// Block number
    pub block_number: u64,
    /// Transaction hash
    pub transaction_hash: String,
    /// Log index in block
    pub log_index: u64,
    /// Transaction index in block
    #[serde(default)]
    pub transaction_index: u64,
    /// Whether log was removed (reorg)
    #[serde(default)]
    pub removed: bool,
}

/// Decoded method call information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedMethod {
    /// Method name
    pub name: String,
    /// Full method signature
    pub signature: String,
    /// Method selector (4 bytes)
    pub selector: String,
    /// Decoded parameters
    pub params: Vec<DecodedParam>,
}

/// Decoded parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedParam {
    /// Parameter name
    pub name: String,
    /// Parameter type (address, uint256, etc.)
    pub param_type: String,
    /// Decoded value
    pub value: serde_json::Value,
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_transfer() {
        let tx = EvmTransaction {
            hash: "0x123".to_string(),
            block_number: "1000".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: "0xdef".to_string(),
            value: "1000000000000000000".to_string(),
            gas: "21000".to_string(),
            gas_price: "20000000000".to_string(),
            gas_used: "21000".to_string(),
            nonce: "1".to_string(),
            is_error: "0".to_string(),
            tx_receipt_status: "1".to_string(),
            input: "0x".to_string(),
            contract_address: String::new(),
            function_name: String::new(),
            method_id: String::new(),
            confirmations: "100".to_string(),
            cumulative_gas_used: "21000".to_string(),
            max_fee_per_gas: String::new(),
            max_priority_fee_per_gas: String::new(),
        };

        assert_eq!(tx.classify_transaction_type(), TransactionType::Transfer);
    }

    #[test]
    fn test_classify_swap() {
        let mut tx = EvmTransaction {
            hash: "0x123".to_string(),
            block_number: "1000".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: "0xdef".to_string(),
            value: "0".to_string(),
            gas: "200000".to_string(),
            gas_price: "20000000000".to_string(),
            gas_used: "150000".to_string(),
            nonce: "1".to_string(),
            is_error: "0".to_string(),
            tx_receipt_status: "1".to_string(),
            input: "0x38ed1739000000000000".to_string(), // swapExactTokensForTokens
            contract_address: String::new(),
            function_name: String::new(),
            method_id: String::new(),
            confirmations: "100".to_string(),
            cumulative_gas_used: "150000".to_string(),
            max_fee_per_gas: String::new(),
            max_priority_fee_per_gas: String::new(),
        };

        assert_eq!(tx.classify_transaction_type(), TransactionType::Swap);

        tx.input = "0x095ea7b3000000000000".to_string(); // approve
        assert_eq!(tx.classify_transaction_type(), TransactionType::Approval);
    }

    #[test]
    fn test_classify_contract_deploy() {
        let tx = EvmTransaction {
            hash: "0x123".to_string(),
            block_number: "1000".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: String::new(),
            value: "0".to_string(),
            gas: "500000".to_string(),
            gas_price: "20000000000".to_string(),
            gas_used: "400000".to_string(),
            nonce: "1".to_string(),
            is_error: "0".to_string(),
            tx_receipt_status: "1".to_string(),
            input: "0x608060405234801561001057600080fd5b50".to_string(),
            contract_address: "0xnewcontract".to_string(),
            function_name: String::new(),
            method_id: String::new(),
            confirmations: "100".to_string(),
            cumulative_gas_used: "400000".to_string(),
            max_fee_per_gas: String::new(),
            max_priority_fee_per_gas: String::new(),
        };

        assert_eq!(
            tx.classify_transaction_type(),
            TransactionType::ContractDeploy
        );
    }

    #[test]
    fn test_erc20_to_token_transfer() {
        let transfer = Erc20Transfer {
            hash: "0x123".to_string(),
            block_number: "1000".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: "0xdef".to_string(),
            value: "1000000".to_string(),
            contract_address: "0xtoken".to_string(),
            token_name: "Test Token".to_string(),
            token_symbol: "TEST".to_string(),
            token_decimal: "18".to_string(),
            log_index: "0".to_string(),
            transaction_index: "0".to_string(),
            gas_used: "50000".to_string(),
            gas_price: "20000000000".to_string(),
            nonce: "1".to_string(),
        };

        let unified = transfer.to_token_transfer();
        assert_eq!(unified.token_address, "0xtoken");
        assert_eq!(unified.token_symbol, Some("TEST".to_string()));
        assert_eq!(unified.value, "1000000");
    }

    #[test]
    fn test_wallet_balance() {
        let mut balance = WalletBalance::new("0x123".to_string(), 1, "ethereum".to_string());

        assert!(!balance.has_balance());
        assert_eq!(balance.token_count(), 0);

        balance.native_balance = "1000000000000000000".to_string();
        assert!(balance.has_balance());

        balance.tokens.push(EvmTokenBalance {
            contract_address: "0xtoken".to_string(),
            symbol: "USDC".to_string(),
            name: "USD Coin".to_string(),
            decimals: 6,
            balance: "1000000".to_string(),
            balance_formatted: "1.0".to_string(),
            logo_url: None,
            usd_value: None,
        });

        assert_eq!(balance.token_count(), 1);
    }

    #[test]
    fn test_internal_transaction() {
        let itx = InternalTransaction {
            hash: "0x123".to_string(),
            block_number: "1000".to_string(),
            time_stamp: "1234567890".to_string(),
            from: "0xabc".to_string(),
            to: "0xdef".to_string(),
            value: "1000000000000000000".to_string(),
            contract_address: String::new(),
            trace_type: "call".to_string(),
            gas: "100000".to_string(),
            gas_used: "50000".to_string(),
            is_error: "0".to_string(),
            err_code: String::new(),
            trace_id: "0".to_string(),
        };

        assert!(!itx.is_failed());
        assert!(!itx.is_create());
        assert_eq!(itx.value_u128(), 1000000000000000000u128);
    }
}
