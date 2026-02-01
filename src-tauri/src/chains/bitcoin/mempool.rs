//! Mempool.space API Client
//!
//! Client for interacting with the Mempool.space REST API for Bitcoin data.
//! Now uses the ResilientFetcher for Governor-based rate limiting.
//!
//! API documentation: https://mempool.space/docs/api/rest

use crate::chains::{ChainError, ChainResult};
use crate::fetchers::{FetcherConfig, ResilientFetcher};

use super::types::{
    BitcoinBalance, BitcoinTransaction, BitcoinUtxo, MempoolAddressInfo, MempoolTransaction,
};

/// Default Mempool.space API base URL
const DEFAULT_BASE_URL: &str = "https://mempool.space/api";

/// Transactions per page from Mempool API
const TXS_PER_PAGE: usize = 25;

/// Rate limit for Mempool.space (requests per second)
/// Mempool.space is generally permissive, but we'll be conservative
const RATE_LIMIT_RPS: u32 = 10;

/// Mempool.space API client with resilient fetching
pub struct MempoolClient {
    /// Resilient fetcher with Governor rate limiting
    fetcher: ResilientFetcher,
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
        let base_url = base_url.trim_end_matches('/').to_string();

        // Create fetcher config with rate limiting
        let config = FetcherConfig {
            base_url: base_url.clone(),
            api_key: None, // Mempool.space doesn't require API keys
            requests_per_second: RATE_LIMIT_RPS,
            timeout_secs: 30,
            max_retries: 3,
        };

        let fetcher = ResilientFetcher::new(config)
            .map_err(|e| ChainError::Internal(format!("Failed to create fetcher: {}", e)))?;

        Ok(Self {
            fetcher,
            base_url,
        })
    }

    /// Get the current rate limit
    pub fn rate_limit(&self) -> u32 {
        self.fetcher.rate_limit()
    }

    /// Helper to make a GET request with rate limiting
    async fn get(&self, url: &str) -> ChainResult<String> {
        self.fetcher.get(url).await.map_err(|e| {
            match e {
                crate::fetchers::FetchError::RateLimited => ChainError::RateLimited,
                crate::fetchers::FetchError::Timeout => ChainError::ConnectionFailed("Request timeout".to_string()),
                crate::fetchers::FetchError::HttpError(msg) => ChainError::ApiError(msg),
                crate::fetchers::FetchError::ParseError(msg) => ChainError::ParseError(msg),
                crate::fetchers::FetchError::ApiError(msg) => ChainError::ApiError(msg),
                crate::fetchers::FetchError::ConfigError(msg) => ChainError::ConfigError(msg),
            }
        })
    }

    /// Helper to make a GET request and parse JSON
    async fn get_json<T: serde::de::DeserializeOwned>(&self, url: &str) -> ChainResult<T> {
        let text = self.get(url).await?;
        serde_json::from_str(&text).map_err(|e| ChainError::ParseError(e.to_string()))
    }

    /// Get current block height
    pub async fn get_block_height(&self) -> ChainResult<u64> {
        let url = format!("{}/blocks/tip/height", self.base_url);
        let text = self.get(&url).await?;

        text.trim()
            .parse()
            .map_err(|e| ChainError::ParseError(format!("Invalid block height: {}", e)))
    }

    /// Get address information (balance stats)
    pub async fn get_address_info(&self, address: &str) -> ChainResult<MempoolAddressInfo> {
        validate_bitcoin_address(address)?;

        let url = format!("{}/address/{}", self.base_url, address);
        self.get_json(&url).await
    }

    /// Get UTXOs for an address
    pub async fn get_address_utxos(&self, address: &str) -> ChainResult<Vec<BitcoinUtxo>> {
        validate_bitcoin_address(address)?;

        let url = format!("{}/address/{}/utxo", self.base_url, address);
        self.get_json(&url).await
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

        self.get_json(&url).await
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
            // Rate limiting is handled by the fetcher automatically
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
        self.get_json(&url).await
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
