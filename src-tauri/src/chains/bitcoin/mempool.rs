//! Mempool.space API Client
//!
//! Client for interacting with the Mempool.space REST API for Bitcoin data.
//! API documentation: https://mempool.space/docs/api/rest

use crate::chains::{ChainError, ChainResult};
use reqwest::Client;
use std::time::Duration;

use super::types::{
    BitcoinBalance, BitcoinTransaction, BitcoinUtxo, MempoolAddressInfo, MempoolTransaction,
};

/// Default Mempool.space API base URL
const DEFAULT_BASE_URL: &str = "https://mempool.space/api";

/// Transactions per page from Mempool API
const TXS_PER_PAGE: usize = 25;

/// Rate limiting: requests per second
const RATE_LIMIT_DELAY_MS: u64 = 100;

/// Mempool.space API client
pub struct MempoolClient {
    /// HTTP client
    client: Client,
    /// Base URL for API requests
    base_url: String,
}

impl MempoolClient {
    /// Create a new Mempool client with default settings
    pub fn new() -> ChainResult<Self> {
        Self::with_base_url(DEFAULT_BASE_URL)
    }

    /// Create a new Mempool client with custom base URL
    pub fn with_base_url(base_url: &str) -> ChainResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| ChainError::Internal(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        })
    }

    /// Get current block height
    pub async fn get_block_height(&self) -> ChainResult<u64> {
        let url = format!("{}/blocks/tip/height", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ChainError::ConnectionFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(ChainError::ApiError(format!(
                "API returned status {}",
                response.status()
            )));
        }

        let height: u64 = response
            .text()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))?
            .trim()
            .parse()
            .map_err(|e| ChainError::ParseError(format!("Invalid block height: {}", e)))?;

        Ok(height)
    }

    /// Get address information (balance stats)
    pub async fn get_address_info(&self, address: &str) -> ChainResult<MempoolAddressInfo> {
        validate_bitcoin_address(address)?;

        let url = format!("{}/address/{}", self.base_url, address);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ChainError::ConnectionFailed(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(ChainError::InvalidAddress(format!(
                "Address not found: {}",
                address
            )));
        }

        if !response.status().is_success() {
            return Err(ChainError::ApiError(format!(
                "API returned status {}",
                response.status()
            )));
        }

        response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get UTXOs for an address
    pub async fn get_address_utxos(&self, address: &str) -> ChainResult<Vec<BitcoinUtxo>> {
        validate_bitcoin_address(address)?;

        let url = format!("{}/address/{}/utxo", self.base_url, address);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ChainError::ConnectionFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(ChainError::ApiError(format!(
                "API returned status {}",
                response.status()
            )));
        }

        response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get transactions for an address (single page)
    async fn get_address_txs_page(
        &self,
        address: &str,
        after_txid: Option<&str>,
    ) -> ChainResult<Vec<MempoolTransaction>> {
        let url = match after_txid {
            Some(txid) => format!("{}/address/{}/txs/chain/{}", self.base_url, address, txid),
            None => format!("{}/address/{}/txs", self.base_url, address),
        };

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ChainError::ConnectionFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(ChainError::ApiError(format!(
                "API returned status {}",
                response.status()
            )));
        }

        response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get all transactions for an address with pagination
    ///
    /// # Arguments
    /// * `address` - Bitcoin address
    /// * `max_pages` - Maximum number of pages to fetch (None for all)
    pub async fn get_address_transactions(
        &self,
        address: &str,
        max_pages: Option<usize>,
    ) -> ChainResult<Vec<MempoolTransaction>> {
        validate_bitcoin_address(address)?;

        let current_height = self.get_block_height().await.ok();
        let mut all_txs = Vec::new();
        let mut after_txid: Option<String> = None;
        let mut page = 0;

        loop {
            // Rate limiting
            if page > 0 {
                tokio::time::sleep(Duration::from_millis(RATE_LIMIT_DELAY_MS)).await;
            }

            let txs = self
                .get_address_txs_page(address, after_txid.as_deref())
                .await?;

            let count = txs.len();
            if count == 0 {
                break;
            }

            // Get the last txid for pagination
            after_txid = txs.last().map(|tx| tx.txid.clone());
            all_txs.extend(txs);
            page += 1;

            // Check if we've reached max pages
            if let Some(max) = max_pages {
                if page >= max {
                    break;
                }
            }

            // If we got fewer than TXS_PER_PAGE, we've reached the end
            if count < TXS_PER_PAGE {
                break;
            }
        }

        // Current height is used in fetch_address_transactions for normalization
        let _ = current_height;

        Ok(all_txs)
    }

    /// Get a specific transaction by txid
    pub async fn get_transaction(&self, txid: &str) -> ChainResult<MempoolTransaction> {
        let url = format!("{}/tx/{}", self.base_url, txid);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ChainError::ConnectionFailed(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(ChainError::TransactionNotFound(txid.to_string()));
        }

        if !response.status().is_success() {
            return Err(ChainError::ApiError(format!(
                "API returned status {}",
                response.status()
            )));
        }

        response
            .json()
            .await
            .map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Fetch address balance
    pub async fn fetch_address_balance(&self, address: &str) -> ChainResult<BitcoinBalance> {
        let info = self.get_address_info(address).await?;
        let utxos = self.get_address_utxos(address).await?;

        Ok(info.to_bitcoin_balance(utxos.len()))
    }

    /// Fetch address transactions (normalized)
    pub async fn fetch_address_transactions(
        &self,
        address: &str,
        max_pages: Option<usize>,
    ) -> ChainResult<Vec<BitcoinTransaction>> {
        let current_height = self.get_block_height().await.ok();
        let mempool_txs = self.get_address_transactions(address, max_pages).await?;

        let transactions = mempool_txs
            .into_iter()
            .map(|tx| tx.to_bitcoin_transaction(current_height))
            .collect();

        Ok(transactions)
    }
}

impl Default for MempoolClient {
    fn default() -> Self {
        Self::new().expect("Failed to create default MempoolClient")
    }
}

/// Validate Bitcoin address format
///
/// Supports:
/// - Legacy addresses starting with '1' (P2PKH)
/// - Script addresses starting with '3' (P2SH)
/// - Native SegWit addresses starting with 'bc1' (Bech32)
/// - Testnet addresses starting with 'm', 'n', '2', 'tb1'
pub fn validate_bitcoin_address(address: &str) -> ChainResult<()> {
    let address = address.trim();

    if address.is_empty() {
        return Err(ChainError::InvalidAddress("Address is empty".to_string()));
    }

    // Check length bounds
    if address.len() < 26 || address.len() > 90 {
        return Err(ChainError::InvalidAddress(format!(
            "Invalid address length: {}",
            address.len()
        )));
    }

    // Mainnet addresses
    if address.starts_with('1') {
        // P2PKH (26-35 chars)
        if address.len() >= 26 && address.len() <= 35 {
            return Ok(());
        }
    } else if address.starts_with('3') {
        // P2SH (34-35 chars)
        if address.len() >= 34 && address.len() <= 35 {
            return Ok(());
        }
    } else if address.starts_with("bc1q") {
        // Native SegWit P2WPKH (42 chars) or P2WSH (62 chars)
        if address.len() == 42 || address.len() == 62 {
            return Ok(());
        }
    } else if address.starts_with("bc1p") {
        // Taproot P2TR (62 chars)
        if address.len() == 62 {
            return Ok(());
        }
    }
    // Testnet addresses
    else if address.starts_with('m') || address.starts_with('n') {
        // Testnet P2PKH
        if address.len() >= 26 && address.len() <= 35 {
            return Ok(());
        }
    } else if address.starts_with('2') {
        // Testnet P2SH
        if address.len() >= 34 && address.len() <= 35 {
            return Ok(());
        }
    } else if address.starts_with("tb1") {
        // Testnet SegWit
        if address.len() >= 42 && address.len() <= 62 {
            return Ok(());
        }
    }

    Err(ChainError::InvalidAddress(format!(
        "Invalid Bitcoin address format: {}",
        address
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_bitcoin_address_legacy() {
        assert!(validate_bitcoin_address("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").is_ok());
        assert!(validate_bitcoin_address("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2").is_ok());
    }

    #[test]
    fn test_validate_bitcoin_address_segwit() {
        assert!(validate_bitcoin_address("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq").is_ok());
        assert!(validate_bitcoin_address("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4").is_ok());
    }

    #[test]
    fn test_validate_bitcoin_address_p2sh() {
        assert!(validate_bitcoin_address("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy").is_ok());
    }

    #[test]
    fn test_validate_bitcoin_address_taproot() {
        assert!(validate_bitcoin_address(
            "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297"
        )
        .is_ok());
    }

    #[test]
    fn test_validate_bitcoin_address_invalid() {
        assert!(validate_bitcoin_address("").is_err());
        assert!(validate_bitcoin_address("invalid").is_err());
        assert!(validate_bitcoin_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44e").is_err());
    }

    #[test]
    fn test_validate_bitcoin_address_testnet() {
        // Testnet P2PKH
        assert!(validate_bitcoin_address("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn").is_ok());
        // Testnet SegWit
        assert!(validate_bitcoin_address("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx").is_ok());
    }
}
