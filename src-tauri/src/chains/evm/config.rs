//! EVM Chain Configurations
//!
//! Defines supported EVM chains and their configuration parameters.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

/// Chain configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: String,
    pub display_name: String,
    pub native_symbol: String,
    pub native_decimals: u8,
    pub rpc_urls: Vec<String>,
    pub explorer_url: Option<String>,
    pub explorer_api_url: Option<String>,
    pub is_testnet: bool,
}

impl ChainConfig {
    pub fn new(
        chain_id: u64,
        name: impl Into<String>,
        display_name: impl Into<String>,
        native_symbol: impl Into<String>,
    ) -> Self {
        Self {
            chain_id,
            name: name.into(),
            display_name: display_name.into(),
            native_symbol: native_symbol.into(),
            native_decimals: 18,
            rpc_urls: Vec::new(),
            explorer_url: None,
            explorer_api_url: None,
            is_testnet: false,
        }
    }

    pub fn with_rpc(mut self, url: impl Into<String>) -> Self {
        self.rpc_urls.push(url.into());
        self
    }

    pub fn with_explorer(mut self, url: impl Into<String>, api_url: impl Into<String>) -> Self {
        self.explorer_url = Some(url.into());
        self.explorer_api_url = Some(api_url.into());
        self
    }

    pub fn testnet(mut self) -> Self {
        self.is_testnet = true;
        self
    }
}

/// Static chain configurations
static CHAIN_CONFIGS: OnceLock<HashMap<String, ChainConfig>> = OnceLock::new();

/// Get all chain configurations
pub fn get_chain_configs() -> &'static HashMap<String, ChainConfig> {
    CHAIN_CONFIGS.get_or_init(|| {
        let mut configs = HashMap::new();

        // Ethereum Mainnet
        configs.insert(
            "ethereum".to_string(),
            ChainConfig::new(1, "ethereum", "Ethereum", "ETH")
                .with_rpc("https://eth.llamarpc.com")
                .with_rpc("https://rpc.ankr.com/eth")
                .with_explorer("https://etherscan.io", "https://api.etherscan.io/api"),
        );

        // Polygon
        configs.insert(
            "polygon".to_string(),
            ChainConfig::new(137, "polygon", "Polygon", "MATIC")
                .with_rpc("https://polygon-rpc.com")
                .with_rpc("https://rpc.ankr.com/polygon")
                .with_explorer("https://polygonscan.com", "https://api.polygonscan.com/api"),
        );

        // Arbitrum One
        configs.insert(
            "arbitrum".to_string(),
            ChainConfig::new(42161, "arbitrum", "Arbitrum One", "ETH")
                .with_rpc("https://arb1.arbitrum.io/rpc")
                .with_rpc("https://rpc.ankr.com/arbitrum")
                .with_explorer("https://arbiscan.io", "https://api.arbiscan.io/api"),
        );

        // Optimism
        configs.insert(
            "optimism".to_string(),
            ChainConfig::new(10, "optimism", "Optimism", "ETH")
                .with_rpc("https://mainnet.optimism.io")
                .with_rpc("https://rpc.ankr.com/optimism")
                .with_explorer(
                    "https://optimistic.etherscan.io",
                    "https://api-optimistic.etherscan.io/api",
                ),
        );

        // Base
        configs.insert(
            "base".to_string(),
            ChainConfig::new(8453, "base", "Base", "ETH")
                .with_rpc("https://mainnet.base.org")
                .with_rpc("https://rpc.ankr.com/base")
                .with_explorer("https://basescan.org", "https://api.basescan.org/api"),
        );

        // Avalanche C-Chain
        configs.insert(
            "avalanche".to_string(),
            ChainConfig::new(43114, "avalanche", "Avalanche C-Chain", "AVAX")
                .with_rpc("https://api.avax.network/ext/bc/C/rpc")
                .with_rpc("https://rpc.ankr.com/avalanche")
                .with_explorer("https://snowtrace.io", "https://api.snowtrace.io/api"),
        );

        // BNB Smart Chain
        configs.insert(
            "bsc".to_string(),
            ChainConfig::new(56, "bsc", "BNB Smart Chain", "BNB")
                .with_rpc("https://bsc-dataseed.binance.org")
                .with_rpc("https://rpc.ankr.com/bsc")
                .with_explorer("https://bscscan.com", "https://api.bscscan.com/api"),
        );

        // Moonbeam (Polkadot EVM)
        configs.insert(
            "moonbeam".to_string(),
            ChainConfig::new(1284, "moonbeam", "Moonbeam", "GLMR")
                .with_rpc("https://rpc.api.moonbeam.network")
                .with_rpc("https://moonbeam.public.blastapi.io")
                .with_explorer(
                    "https://moonscan.io",
                    "https://api-moonbeam.moonscan.io/api",
                ),
        );

        // Moonriver (Kusama EVM)
        configs.insert(
            "moonriver".to_string(),
            ChainConfig::new(1285, "moonriver", "Moonriver", "MOVR")
                .with_rpc("https://rpc.api.moonriver.moonbeam.network")
                .with_rpc("https://moonriver.public.blastapi.io")
                .with_explorer(
                    "https://moonriver.moonscan.io",
                    "https://api-moonriver.moonscan.io/api",
                ),
        );

        // Astar (Polkadot EVM)
        configs.insert(
            "astar".to_string(),
            ChainConfig::new(592, "astar", "Astar", "ASTR")
                .with_rpc("https://evm.astar.network")
                .with_rpc("https://astar.public.blastapi.io")
                .with_explorer("https://astar.subscan.io", "https://astar.api.subscan.io"),
        );

        // Gnosis Chain (formerly xDai)
        configs.insert(
            "gnosis".to_string(),
            ChainConfig::new(100, "gnosis", "Gnosis Chain", "xDAI")
                .with_rpc("https://rpc.gnosischain.com")
                .with_rpc("https://rpc.ankr.com/gnosis")
                .with_explorer("https://gnosisscan.io", "https://api.gnosisscan.io/api"),
        );

        // Fantom
        configs.insert(
            "fantom".to_string(),
            ChainConfig::new(250, "fantom", "Fantom", "FTM")
                .with_rpc("https://rpc.ftm.tools")
                .with_rpc("https://rpc.ankr.com/fantom")
                .with_explorer("https://ftmscan.com", "https://api.ftmscan.com/api"),
        );

        // zkSync Era
        configs.insert(
            "zksync".to_string(),
            ChainConfig::new(324, "zksync", "zkSync Era", "ETH")
                .with_rpc("https://mainnet.era.zksync.io")
                .with_explorer(
                    "https://explorer.zksync.io",
                    "https://block-explorer-api.mainnet.zksync.io/api",
                ),
        );

        // Linea
        configs.insert(
            "linea".to_string(),
            ChainConfig::new(59144, "linea", "Linea", "ETH")
                .with_rpc("https://rpc.linea.build")
                .with_explorer("https://lineascan.build", "https://api.lineascan.build/api"),
        );

        // Scroll
        configs.insert(
            "scroll".to_string(),
            ChainConfig::new(534352, "scroll", "Scroll", "ETH")
                .with_rpc("https://rpc.scroll.io")
                .with_explorer("https://scrollscan.com", "https://api.scrollscan.com/api"),
        );

        // ============ TESTNETS ============

        // Sepolia (Ethereum testnet)
        configs.insert(
            "sepolia".to_string(),
            ChainConfig::new(11155111, "sepolia", "Sepolia", "ETH")
                .with_rpc("https://rpc.sepolia.org")
                .with_rpc("https://rpc.ankr.com/eth_sepolia")
                .with_explorer(
                    "https://sepolia.etherscan.io",
                    "https://api-sepolia.etherscan.io/api",
                )
                .testnet(),
        );

        // Mumbai (Polygon testnet)
        configs.insert(
            "mumbai".to_string(),
            ChainConfig::new(80001, "mumbai", "Polygon Mumbai", "MATIC")
                .with_rpc("https://rpc-mumbai.maticvigil.com")
                .with_explorer(
                    "https://mumbai.polygonscan.com",
                    "https://api-testnet.polygonscan.com/api",
                )
                .testnet(),
        );

        // Moonbase Alpha (Moonbeam testnet)
        configs.insert(
            "moonbase".to_string(),
            ChainConfig::new(1287, "moonbase", "Moonbase Alpha", "DEV")
                .with_rpc("https://rpc.api.moonbase.moonbeam.network")
                .with_explorer(
                    "https://moonbase.moonscan.io",
                    "https://api-moonbase.moonscan.io/api",
                )
                .testnet(),
        );

        configs
    })
}

/// Get configuration for a specific chain
pub fn get_chain_config(name: &str) -> Option<&'static ChainConfig> {
    get_chain_configs().get(name)
}

/// Get chain config by chain ID
pub fn get_chain_by_id(chain_id: u64) -> Option<&'static ChainConfig> {
    get_chain_configs()
        .values()
        .find(|c| c.chain_id == chain_id)
}

/// List all supported chain names
pub fn list_chains() -> Vec<&'static str> {
    get_chain_configs().keys().map(|s| s.as_str()).collect()
}

/// List mainnet chains only
pub fn list_mainnet_chains() -> Vec<&'static str> {
    get_chain_configs()
        .iter()
        .filter(|(_, c)| !c.is_testnet)
        .map(|(k, _)| k.as_str())
        .collect()
}

/// List testnet chains only
pub fn list_testnet_chains() -> Vec<&'static str> {
    get_chain_configs()
        .iter()
        .filter(|(_, c)| c.is_testnet)
        .map(|(k, _)| k.as_str())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_configs_exist() {
        let configs = get_chain_configs();
        assert!(configs.contains_key("ethereum"));
        assert!(configs.contains_key("moonbeam"));
        assert!(configs.contains_key("polygon"));
    }

    #[test]
    fn test_get_chain_by_id() {
        let eth = get_chain_by_id(1);
        assert!(eth.is_some());
        assert_eq!(eth.unwrap().name, "ethereum");
    }

    #[test]
    fn test_mainnet_testnet_separation() {
        let mainnets = list_mainnet_chains();
        let testnets = list_testnet_chains();

        assert!(mainnets.contains(&"ethereum"));
        assert!(!mainnets.contains(&"sepolia"));

        assert!(testnets.contains(&"sepolia"));
        assert!(!testnets.contains(&"ethereum"));
    }
}
