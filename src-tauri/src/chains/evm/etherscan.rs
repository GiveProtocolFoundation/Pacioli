//! Etherscan-compatible API Client
//!
//! Supports Etherscan and compatible block explorer APIs (Polygonscan, Arbiscan, etc.)

use super::config::ChainConfig;
use super::types::{Erc20Transfer, Erc721Transfer, EvmTransaction, InternalTransaction};
use crate::chains::{ChainError, ChainResult};
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::time::Duration;

/// Etherscan API response wrapper
#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    status: String,
    message: String,
    result: T,
}

/// Etherscan-compatible API client
pub struct EtherscanClient {
    client: Client,
    api_url: String,
    api_key: Option<String>,
    chain_name: String,
}

impl EtherscanClient {
    /// Create a new Etherscan client from chain config
    pub fn new(config: &ChainConfig, api_key: Option<String>) -> ChainResult<Self> {
        let api_url = config
            .explorer_api_url
            .clone()
            .ok_or_else(|| ChainError::ConfigError("No explorer API URL configured".to_string()))?;

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ChainError::Internal(e.to_string()))?;

        Ok(Self {
            client,
            api_url,
            api_key,
            chain_name: config.name.clone(),
        })
    }

    /// Build API URL with parameters
    fn build_url(&self, module: &str, action: &str, params: &[(&str, &str)]) -> String {
        let mut url = format!("{}?module={}&action={}", self.api_url, module, action);

        for (key, value) in params {
            url.push_str(&format!("&{}={}", key, value));
        }

        if let Some(ref api_key) = self.api_key {
            url.push_str(&format!("&apikey={}", api_key));
        }

        url
    }

    /// Make API request
    async fn request<T: DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| ChainError::ApiError(e.to_string()))?;

        if response.status() == 429 {
            return Err(ChainError::RateLimited);
        }

        if !response.status().is_success() {
            return Err(ChainError::ApiError(format!(
                "HTTP {}: {}",
                response.status(),
                response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string())
            )));
        }

        let api_response: ApiResponse<T> = response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))?;

        if api_response.status != "1" && api_response.message != "OK" {
            // Check for "No transactions found" which is not an error
            if api_response.message.contains("No transactions found")
                || api_response.message.contains("No records found")
            {
                // Return empty result - caller should handle this
                return Err(ChainError::ApiError("No results".to_string()));
            }
            return Err(ChainError::ApiError(api_response.message));
        }

        Ok(api_response.result)
    }

    /// Get normal transactions for an address
    pub async fn get_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<EvmTransaction>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());

        let url = self.build_url(
            "account",
            "txlist",
            &[
                ("address", address),
                ("startblock", &start),
                ("endblock", &end),
                ("page", &page.to_string()),
                ("offset", &offset.to_string()),
                ("sort", "desc"),
            ],
        );

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get internal transactions for an address
    pub async fn get_internal_transactions(
        &self,
        address: &str,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<InternalTransaction>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());

        let url = self.build_url(
            "account",
            "txlistinternal",
            &[
                ("address", address),
                ("startblock", &start),
                ("endblock", &end),
                ("page", &page.to_string()),
                ("offset", &offset.to_string()),
                ("sort", "desc"),
            ],
        );

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get ERC20 token transfers for an address
    pub async fn get_erc20_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc20Transfer>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.to_string();

        let mut params = vec![
            ("address", address),
            ("startblock", start.as_str()),
            ("endblock", end.as_str()),
            ("page", page_str.as_str()),
            ("offset", offset_str.as_str()),
            ("sort", "desc"),
        ];

        let contract_str;
        if let Some(contract) = contract_address {
            contract_str = contract.to_string();
            params.push(("contractaddress", &contract_str));
        }

        let url = self.build_url("account", "tokentx", &params);

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get ERC721 (NFT) transfers for an address
    pub async fn get_erc721_transfers(
        &self,
        address: &str,
        contract_address: Option<&str>,
        start_block: Option<u64>,
        end_block: Option<u64>,
        page: u32,
        offset: u32,
    ) -> ChainResult<Vec<Erc721Transfer>> {
        let start = start_block.unwrap_or(0).to_string();
        let end = end_block.map_or_else(|| "99999999".to_string(), |b| b.to_string());
        let page_str = page.to_string();
        let offset_str = offset.to_string();

        let mut params = vec![
            ("address", address),
            ("startblock", start.as_str()),
            ("endblock", end.as_str()),
            ("page", page_str.as_str()),
            ("offset", offset_str.as_str()),
            ("sort", "desc"),
        ];

        let contract_str;
        if let Some(contract) = contract_address {
            contract_str = contract.to_string();
            params.push(("contractaddress", &contract_str));
        }

        let url = self.build_url("account", "tokennfttx", &params);

        match self.request(&url).await {
            Ok(txs) => Ok(txs),
            Err(ChainError::ApiError(msg)) if msg == "No results" => Ok(Vec::new()),
            Err(e) => Err(e),
        }
    }

    /// Get native balance for an address
    pub async fn get_balance(&self, address: &str) -> ChainResult<String> {
        let url = self.build_url(
            "account",
            "balance",
            &[("address", address), ("tag", "latest")],
        );

        self.request(&url).await
    }

    /// Get token balance for an address
    pub async fn get_token_balance(
        &self,
        address: &str,
        contract_address: &str,
    ) -> ChainResult<String> {
        let url = self.build_url(
            "account",
            "tokenbalance",
            &[
                ("address", address),
                ("contractaddress", contract_address),
                ("tag", "latest"),
            ],
        );

        self.request(&url).await
    }

    /// Get current block number
    pub async fn get_block_number(&self) -> ChainResult<u64> {
        let url = self.build_url("proxy", "eth_blockNumber", &[]);

        let result: String = self.request(&url).await?;

        // Result is hex string like "0x123abc"
        let block_num = u64::from_str_radix(result.trim_start_matches("0x"), 16)
            .map_err(|e| ChainError::ParseError(e.to_string()))?;

        Ok(block_num)
    }

    /// Get gas price
    pub async fn get_gas_price(&self) -> ChainResult<String> {
        let url = self.build_url("proxy", "eth_gasPrice", &[]);
        self.request(&url).await
    }

    /// Check if contract is verified
    pub async fn get_contract_abi(&self, address: &str) -> ChainResult<String> {
        let url = self.build_url("contract", "getabi", &[("address", address)]);
        self.request(&url).await
    }

    /// Get contract source code
    pub async fn get_contract_source(&self, address: &str) -> ChainResult<serde_json::Value> {
        let url = self.build_url("contract", "getsourcecode", &[("address", address)]);
        self.request(&url).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_url() {
        let config = ChainConfig::new(1, "ethereum", "Ethereum", "ETH")
            .with_explorer("https://etherscan.io", "https://api.etherscan.io/api");

        let client = EtherscanClient::new(&config, Some("TEST_KEY".to_string())).unwrap();

        let url = client.build_url("account", "txlist", &[("address", "0x123")]);

        assert!(url.contains("module=account"));
        assert!(url.contains("action=txlist"));
        assert!(url.contains("address=0x123"));
        assert!(url.contains("apikey=TEST_KEY"));
    }
}
