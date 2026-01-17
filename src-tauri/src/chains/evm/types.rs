//! EVM-specific types

use serde::{Deserialize, Serialize};

/// EVM transaction from block explorer APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmTransaction {
    pub hash: String,
    pub block_number: String,
    pub time_stamp: String,
    pub from: String,
    pub to: String,
    pub value: String,
    pub gas: String,
    pub gas_price: String,
    pub gas_used: String,
    #[serde(default)]
    pub is_error: String,
    #[serde(default)]
    pub input: String,
    #[serde(default)]
    pub contract_address: String,
    #[serde(default)]
    pub function_name: String,
    #[serde(default)]
    pub method_id: String,
}

/// ERC20 token transfer event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Erc20Transfer {
    pub hash: String,
    pub block_number: String,
    pub time_stamp: String,
    pub from: String,
    pub to: String,
    pub value: String,
    pub contract_address: String,
    pub token_name: String,
    pub token_symbol: String,
    pub token_decimal: String,
}

/// ERC721 (NFT) transfer event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Erc721Transfer {
    pub hash: String,
    pub block_number: String,
    pub time_stamp: String,
    pub from: String,
    pub to: String,
    pub contract_address: String,
    pub token_id: String,
    pub token_name: String,
    pub token_symbol: String,
}

/// Internal transaction (trace)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InternalTransaction {
    pub hash: String,
    pub block_number: String,
    pub time_stamp: String,
    pub from: String,
    pub to: String,
    pub value: String,
    #[serde(default)]
    pub contract_address: String,
    #[serde(rename = "type")]
    pub tx_type: String,
    #[serde(default)]
    pub is_error: String,
    #[serde(default)]
    pub err_code: String,
}

/// Token info from contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub address: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: Option<String>,
}

/// Block info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockInfo {
    pub number: u64,
    pub hash: String,
    pub timestamp: u64,
    pub transactions_count: usize,
}

/// Gas price info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasPrice {
    pub slow: String,
    pub standard: String,
    pub fast: String,
    pub instant: String,
}

/// Contract verification status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractInfo {
    pub address: String,
    pub is_verified: bool,
    pub contract_name: Option<String>,
    pub compiler_version: Option<String>,
    pub abi: Option<serde_json::Value>,
}

/// Log event from transaction receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    pub address: String,
    pub topics: Vec<String>,
    pub data: String,
    pub block_number: u64,
    pub transaction_hash: String,
    pub log_index: u64,
}

/// Decoded method call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedMethod {
    pub name: String,
    pub signature: String,
    pub params: Vec<DecodedParam>,
}

/// Decoded parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedParam {
    pub name: String,
    pub param_type: String,
    pub value: serde_json::Value,
}
