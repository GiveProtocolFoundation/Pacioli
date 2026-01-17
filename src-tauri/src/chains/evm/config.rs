//! EVM Chain Configurations
//!
//! Defines supported EVM chains and their configuration parameters.
//! Supports Ethereum mainnet and major Layer 2 networks.

use serde::{Deserialize, Serialize};
use std::env;
use std::sync::OnceLock;
use thiserror::Error;

/// Errors that can occur when working with chain configuration.
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Chain not found: {0}")]
    ChainNotFound(u64),

    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

/// Result type for configuration operations.
pub type ConfigResult<T> = Result<T, ConfigError>;

/// EVM chain configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmChainConfig {
    /// Numeric EVM chain ID.
    pub chain_id: u64,
    /// Chain name identifier (e.g., "ethereum", "arbitrum").
    pub name: String,
    /// Native token symbol (e.g., "ETH", "MATIC").
    pub symbol: String,
    /// Alchemy RPC URL pattern (without API key).
    pub rpc_url: String,
    /// Block explorer API base URL.
    pub explorer_api_url: String,
    /// Environment variable name for the explorer API key.
    pub explorer_api_key_env: String,
    /// Native token decimals (always 18 for EVM chains).
    pub decimals: u8,
    /// Whether this is a Layer 2 network.
    pub is_l2: bool,
    /// Average block time in seconds (for rate limiting).
    pub block_time_seconds: u64,
}

impl EvmChainConfig {
    /// Creates a new chain configuration.
    pub fn new(
        chain_id: u64,
        name: impl Into<String>,
        symbol: impl Into<String>,
        rpc_url: impl Into<String>,
        explorer_api_url: impl Into<String>,
        is_l2: bool,
        block_time_seconds: u64,
    ) -> Self {
        Self {
            chain_id,
            name: name.into(),
            symbol: symbol.into(),
            rpc_url: rpc_url.into(),
            explorer_api_url: explorer_api_url.into(),
            explorer_api_key_env: "ETHERSCAN_API_KEY".to_string(),
            decimals: 18,
            is_l2,
            block_time_seconds,
        }
    }

    /// Gets the full RPC URL with the Alchemy API key from environment.
    pub fn get_rpc_url(&self) -> ConfigResult<String> {
        let api_key = env::var("ALCHEMY_API_KEY")
            .map_err(|_| ConfigError::MissingEnvVar("ALCHEMY_API_KEY".to_string()))?;

        Ok(format!("{}/{}", self.rpc_url, api_key))
    }

    /// Gets the explorer API key from environment.
    pub fn get_explorer_api_key(&self) -> ConfigResult<String> {
        env::var(&self.explorer_api_key_env)
            .map_err(|_| ConfigError::MissingEnvVar(self.explorer_api_key_env.clone()))
    }

    /// Builds a full explorer API URL with the given endpoint and parameters.
    pub fn build_explorer_url(&self, params: &[(&str, &str)]) -> ConfigResult<String> {
        let api_key = self.get_explorer_api_key()?;

        let mut url = self.explorer_api_url.clone();
        url.push_str("?apikey=");
        url.push_str(&api_key);

        for (key, value) in params {
            url.push('&');
            url.push_str(key);
            url.push('=');
            url.push_str(value);
        }

        Ok(url)
    }
}

/// Static chain configurations indexed by chain_id.
static CHAIN_CONFIGS: OnceLock<Vec<EvmChainConfig>> = OnceLock::new();

/// Initialize environment variables from .env file.
fn init_env() {
    static ENV_INIT: OnceLock<()> = OnceLock::new();
    ENV_INIT.get_or_init(|| {
        let _ = dotenvy::dotenv(); // Ignore error if .env doesn't exist
    });
}

/// Get all chain configurations.
fn get_configs() -> &'static Vec<EvmChainConfig> {
    init_env();

    CHAIN_CONFIGS.get_or_init(|| {
        vec![
            // Ethereum Mainnet
            EvmChainConfig::new(
                1,
                "ethereum",
                "ETH",
                "https://eth-mainnet.g.alchemy.com/v2",
                "https://api.etherscan.io/api",
                false, // not L2
                12,    // ~12 second block time
            ),
            // Arbitrum One
            EvmChainConfig::new(
                42161,
                "arbitrum",
                "ETH",
                "https://arb-mainnet.g.alchemy.com/v2",
                "https://api.arbiscan.io/api",
                true, // L2
                1,    // ~0.25s but use 1 for rate limiting
            ),
            // Base
            EvmChainConfig::new(
                8453,
                "base",
                "ETH",
                "https://base-mainnet.g.alchemy.com/v2",
                "https://api.basescan.org/api",
                true, // L2
                2,    // ~2 second block time
            ),
            // Optimism
            EvmChainConfig::new(
                10,
                "optimism",
                "ETH",
                "https://opt-mainnet.g.alchemy.com/v2",
                "https://api-optimistic.etherscan.io/api",
                true, // L2
                2,    // ~2 second block time
            ),
            // Polygon
            EvmChainConfig::new(
                137,
                "polygon",
                "POL", // Rebranded from MATIC
                "https://polygon-mainnet.g.alchemy.com/v2",
                "https://api.polygonscan.com/api",
                false, // Sidechain, not technically L2
                2,     // ~2 second block time
            ),
        ]
    })
}

/// Get chain configuration by chain ID.
///
/// # Arguments
/// * `chain_id` - The numeric EVM chain ID
///
/// # Returns
/// * `Some(EvmChainConfig)` if the chain is supported
/// * `None` if the chain is not found
///
/// # Example
/// ```
/// use pacioli_lib::chains::evm::config::get_chain_config;
///
/// if let Some(config) = get_chain_config(1) {
///     println!("Found chain: {}", config.name);
/// }
/// ```
pub fn get_chain_config(chain_id: u64) -> Option<EvmChainConfig> {
    get_configs()
        .iter()
        .find(|c| c.chain_id == chain_id)
        .cloned()
}

/// Get all supported chain configurations.
///
/// # Returns
/// A vector of all supported chain configurations.
///
/// # Example
/// ```
/// use pacioli_lib::chains::evm::config::get_all_chains;
///
/// for chain in get_all_chains() {
///     println!("{}: chain_id={}", chain.name, chain.chain_id);
/// }
/// ```
pub fn get_all_chains() -> Vec<EvmChainConfig> {
    get_configs().clone()
}

/// Get chain configuration by name.
///
/// # Arguments
/// * `name` - The chain name (e.g., "ethereum", "arbitrum")
///
/// # Returns
/// * `Some(EvmChainConfig)` if the chain is found
/// * `None` if the chain is not found
pub fn get_chain_by_name(name: &str) -> Option<EvmChainConfig> {
    get_configs()
        .iter()
        .find(|c| c.name.eq_ignore_ascii_case(name))
        .cloned()
}

/// Get all Layer 2 chains.
pub fn get_l2_chains() -> Vec<EvmChainConfig> {
    get_configs()
        .iter()
        .filter(|c| c.is_l2)
        .cloned()
        .collect()
}

/// Get all Layer 1 chains (including sidechains like Polygon).
pub fn get_l1_chains() -> Vec<EvmChainConfig> {
    get_configs()
        .iter()
        .filter(|c| !c.is_l2)
        .cloned()
        .collect()
}

/// Check if a chain ID is supported.
pub fn is_chain_supported(chain_id: u64) -> bool {
    get_configs().iter().any(|c| c.chain_id == chain_id)
}

/// Get the RPC URL for a chain with the API key.
///
/// # Arguments
/// * `chain_id` - The numeric EVM chain ID
///
/// # Returns
/// * `Ok(String)` - The full RPC URL with API key
/// * `Err(ConfigError)` - If chain not found or API key missing
pub fn get_rpc_url(chain_id: u64) -> ConfigResult<String> {
    let config = get_chain_config(chain_id).ok_or(ConfigError::ChainNotFound(chain_id))?;

    config.get_rpc_url()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_chain_config() {
        let eth = get_chain_config(1);
        assert!(eth.is_some());
        let eth = eth.unwrap();
        assert_eq!(eth.name, "ethereum");
        assert_eq!(eth.symbol, "ETH");
        assert_eq!(eth.decimals, 18);
        assert!(!eth.is_l2);
    }

    #[test]
    fn test_get_chain_config_l2() {
        let arb = get_chain_config(42161);
        assert!(arb.is_some());
        let arb = arb.unwrap();
        assert_eq!(arb.name, "arbitrum");
        assert!(arb.is_l2);
    }

    #[test]
    fn test_get_all_chains() {
        let chains = get_all_chains();
        assert_eq!(chains.len(), 5);

        let chain_ids: Vec<u64> = chains.iter().map(|c| c.chain_id).collect();
        assert!(chain_ids.contains(&1));      // Ethereum
        assert!(chain_ids.contains(&42161));  // Arbitrum
        assert!(chain_ids.contains(&8453));   // Base
        assert!(chain_ids.contains(&10));     // Optimism
        assert!(chain_ids.contains(&137));    // Polygon
    }

    #[test]
    fn test_get_chain_by_name() {
        let eth = get_chain_by_name("ethereum");
        assert!(eth.is_some());
        assert_eq!(eth.unwrap().chain_id, 1);

        let arb = get_chain_by_name("ARBITRUM"); // Case insensitive
        assert!(arb.is_some());
        assert_eq!(arb.unwrap().chain_id, 42161);
    }

    #[test]
    fn test_l2_separation() {
        let l2s = get_l2_chains();
        assert_eq!(l2s.len(), 3); // Arbitrum, Base, Optimism

        let l1s = get_l1_chains();
        assert_eq!(l1s.len(), 2); // Ethereum, Polygon
    }

    #[test]
    fn test_is_chain_supported() {
        assert!(is_chain_supported(1));
        assert!(is_chain_supported(42161));
        assert!(!is_chain_supported(999999));
    }

    #[test]
    fn test_chain_config_rpc_pattern() {
        let eth = get_chain_config(1).unwrap();
        assert!(eth.rpc_url.contains("alchemy.com"));
        assert!(eth.rpc_url.ends_with("/v2"));
    }

    #[test]
    fn test_explorer_api_url() {
        let eth = get_chain_config(1).unwrap();
        assert_eq!(eth.explorer_api_url, "https://api.etherscan.io/api");

        let arb = get_chain_config(42161).unwrap();
        assert_eq!(arb.explorer_api_url, "https://api.arbiscan.io/api");
    }
}
