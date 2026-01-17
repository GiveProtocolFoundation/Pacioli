//! Alchemy/JSON-RPC Client
//!
//! Provides RPC access to EVM chains via Alchemy or any standard JSON-RPC endpoint.

use super::config::EvmChainConfig;
use crate::chains::{ChainError, ChainResult, NativeBalance, TokenBalance};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

/// JSON-RPC request
#[derive(Debug, Serialize)]
struct RpcRequest {
    jsonrpc: &'static str,
    method: String,
    params: Value,
    id: u64,
}

/// JSON-RPC response
#[derive(Debug, Deserialize)]
struct RpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    result: Option<Value>,
    error: Option<RpcError>,
    #[allow(dead_code)]
    id: u64,
}

/// JSON-RPC error
#[derive(Debug, Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

/// Alchemy/JSON-RPC client
pub struct AlchemyClient {
    client: Client,
    rpc_url: String,
    chain_config: EvmChainConfig,
    request_id: std::sync::atomic::AtomicU64,
}

impl AlchemyClient {
    /// Create a new RPC client
    pub fn new(config: &EvmChainConfig, rpc_url: Option<&str>) -> ChainResult<Self> {
        // Use override URL if provided, otherwise construct from config
        let url = if let Some(override_url) = rpc_url {
            override_url.to_string()
        } else {
            config
                .get_rpc_url()
                .map_err(|e| ChainError::ConfigError(e.to_string()))?
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ChainError::Internal(e.to_string()))?;

        Ok(Self {
            client,
            rpc_url: url,
            chain_config: config.clone(),
            request_id: std::sync::atomic::AtomicU64::new(1),
        })
    }

    /// Get next request ID
    fn next_id(&self) -> u64 {
        self.request_id
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
    }

    /// Make RPC call
    async fn call(&self, method: &str, params: Value) -> ChainResult<Value> {
        let request = RpcRequest {
            jsonrpc: "2.0",
            method: method.to_string(),
            params,
            id: self.next_id(),
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| ChainError::RpcError(e.to_string()))?;

        if response.status() == 429 {
            return Err(ChainError::RateLimited);
        }

        if !response.status().is_success() {
            return Err(ChainError::RpcError(format!(
                "HTTP {}: {}",
                response.status(),
                response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string())
            )));
        }

        let rpc_response: RpcResponse = response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))?;

        if let Some(error) = rpc_response.error {
            return Err(ChainError::RpcError(format!(
                "RPC error {}: {}",
                error.code, error.message
            )));
        }

        rpc_response
            .result
            .ok_or_else(|| ChainError::RpcError("Empty result".to_string()))
    }

    /// Get current block number
    pub async fn get_block_number(&self) -> ChainResult<u64> {
        let result = self.call("eth_blockNumber", json!([])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        u64::from_str_radix(hex_str.trim_start_matches("0x"), 16)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get native balance
    pub async fn get_balance(&self, address: &str) -> ChainResult<NativeBalance> {
        let result = self
            .call("eth_getBalance", json!([address, "latest"]))
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        let balance_wei = u128::from_str_radix(hex_str.trim_start_matches("0x"), 16).unwrap_or(0);

        let decimals = self.chain_config.decimals;
        let divisor = 10u128.pow(decimals as u32);
        let balance_formatted = format!(
            "{}.{}",
            balance_wei / divisor,
            format!(
                "{:0width$}",
                balance_wei % divisor,
                width = decimals as usize
            )
            .trim_end_matches('0')
            .trim_end_matches('.')
        );

        Ok(NativeBalance {
            symbol: self.chain_config.symbol.clone(),
            decimals,
            balance: balance_wei.to_string(),
            balance_formatted,
        })
    }

    /// Get ERC20 token balance
    pub async fn get_token_balance(
        &self,
        address: &str,
        token_address: &str,
    ) -> ChainResult<String> {
        // balanceOf(address) function selector: 0x70a08231
        let data = format!(
            "0x70a08231000000000000000000000000{}",
            address.trim_start_matches("0x")
        );

        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": data
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        // Parse the returned uint256
        let balance = u128::from_str_radix(hex_str.trim_start_matches("0x"), 16).unwrap_or(0);

        Ok(balance.to_string())
    }

    /// Get token decimals
    pub async fn get_token_decimals(&self, token_address: &str) -> ChainResult<u8> {
        // decimals() function selector: 0x313ce567
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": "0x313ce567"
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        let decimals = u8::from_str_radix(hex_str.trim_start_matches("0x"), 16).unwrap_or(18);

        Ok(decimals)
    }

    /// Get token symbol
    pub async fn get_token_symbol(&self, token_address: &str) -> ChainResult<String> {
        // symbol() function selector: 0x95d89b41
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": "0x95d89b41"
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        // Decode string from ABI encoding
        decode_abi_string(hex_str)
    }

    /// Get token name
    pub async fn get_token_name(&self, token_address: &str) -> ChainResult<String> {
        // name() function selector: 0x06fdde03
        let result = self
            .call(
                "eth_call",
                json!([
                    {
                        "to": token_address,
                        "data": "0x06fdde03"
                    },
                    "latest"
                ]),
            )
            .await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        decode_abi_string(hex_str)
    }

    /// Get full token info
    pub async fn get_token_info(
        &self,
        address: &str,
        token_address: &str,
    ) -> ChainResult<TokenBalance> {
        let balance = self.get_token_balance(address, token_address).await?;
        let decimals = self.get_token_decimals(token_address).await.unwrap_or(18);
        let symbol = self.get_token_symbol(token_address).await.ok();
        let name = self.get_token_name(token_address).await.ok();

        let balance_u128: u128 = balance.parse().unwrap_or(0);
        let divisor = 10u128.pow(decimals as u32);
        let balance_formatted = if divisor > 0 {
            format!(
                "{}.{}",
                balance_u128 / divisor,
                format!(
                    "{:0width$}",
                    balance_u128 % divisor,
                    width = decimals as usize
                )
                .trim_end_matches('0')
                .trim_end_matches('.')
            )
        } else {
            balance.clone()
        };

        Ok(TokenBalance {
            token_address: token_address.to_string(),
            token_symbol: symbol,
            token_name: name,
            token_decimals: decimals,
            balance,
            balance_formatted,
        })
    }

    /// Get transaction by hash
    pub async fn get_transaction(&self, hash: &str) -> ChainResult<Value> {
        self.call("eth_getTransactionByHash", json!([hash])).await
    }

    /// Get transaction receipt
    pub async fn get_transaction_receipt(&self, hash: &str) -> ChainResult<Value> {
        self.call("eth_getTransactionReceipt", json!([hash])).await
    }

    /// Get block by number
    pub async fn get_block(&self, block_number: u64, full_txs: bool) -> ChainResult<Value> {
        let block_hex = format!("0x{:x}", block_number);
        self.call("eth_getBlockByNumber", json!([block_hex, full_txs]))
            .await
    }

    /// Get chain ID
    pub async fn get_chain_id(&self) -> ChainResult<u64> {
        let result = self.call("eth_chainId", json!([])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        u64::from_str_radix(hex_str.trim_start_matches("0x"), 16)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get gas price
    pub async fn get_gas_price(&self) -> ChainResult<String> {
        let result = self.call("eth_gasPrice", json!([])).await?;

        result
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))
    }

    /// Estimate gas for a transaction
    pub async fn estimate_gas(&self, from: &str, to: &str, data: Option<&str>) -> ChainResult<u64> {
        let mut tx = json!({
            "from": from,
            "to": to
        });

        if let Some(d) = data {
            tx["data"] = json!(d);
        }

        let result = self.call("eth_estimateGas", json!([tx])).await?;

        let hex_str = result
            .as_str()
            .ok_or_else(|| ChainError::ParseError("Expected string".to_string()))?;

        u64::from_str_radix(hex_str.trim_start_matches("0x"), 16)
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get logs with filter
    pub async fn get_logs(
        &self,
        from_block: u64,
        to_block: u64,
        address: Option<&str>,
        topics: Option<Vec<Option<String>>>,
    ) -> ChainResult<Vec<Value>> {
        let mut filter = json!({
            "fromBlock": format!("0x{:x}", from_block),
            "toBlock": format!("0x{:x}", to_block)
        });

        if let Some(addr) = address {
            filter["address"] = json!(addr);
        }

        if let Some(t) = topics {
            filter["topics"] = json!(t);
        }

        let result = self.call("eth_getLogs", json!([filter])).await?;

        result
            .as_array()
            .cloned()
            .ok_or_else(|| ChainError::ParseError("Expected array".to_string()))
    }
}

/// Decode ABI-encoded string
fn decode_abi_string(hex: &str) -> ChainResult<String> {
    let bytes = hex::decode(hex.trim_start_matches("0x"))
        .map_err(|e| ChainError::ParseError(e.to_string()))?;

    if bytes.len() < 64 {
        return Err(ChainError::ParseError("Invalid ABI string".to_string()));
    }

    // Skip offset (32 bytes) and read length (32 bytes)
    let length = u64::from_be_bytes(bytes[56..64].try_into().unwrap_or([0; 8])) as usize;

    if bytes.len() < 64 + length {
        return Err(ChainError::ParseError("String data too short".to_string()));
    }

    String::from_utf8(bytes[64..64 + length].to_vec())
        .map_err(|e| ChainError::ParseError(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_abi_string() {
        // "USDC" encoded
        let encoded = "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000455534443000000000000000000000000000000000000000000000000000000";

        let result = decode_abi_string(encoded);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "USDC");
    }
}
