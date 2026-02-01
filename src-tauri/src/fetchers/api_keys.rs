//! Secure API Key Storage
//!
//! Uses the system keychain (via `keyring` crate) to securely store user API keys.
//! This enables the "Turbo Mode" feature where users can provide their own API keys
//! to unlock higher rate limits.

use keyring::Entry;
use thiserror::Error;

/// Service name for keychain entries
const KEYCHAIN_SERVICE: &str = "pacioli";

/// Errors that can occur during API key operations.
#[derive(Debug, Error)]
pub enum ApiKeyError {
    /// Failed to access the system keychain.
    #[error("Keychain access failed: {0}")]
    KeychainError(String),

    /// API key not found.
    #[error("API key not found for provider: {0}")]
    NotFound(String),

    /// Invalid provider name.
    #[error("Invalid provider: {0}")]
    InvalidProvider(String),
}

/// Result type for API key operations.
pub type ApiKeyResult<T> = Result<T, ApiKeyError>;

/// Supported API providers for "Turbo Mode".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ApiProvider {
    /// Etherscan (Ethereum mainnet).
    Etherscan,
    /// Polygonscan (Polygon).
    Polygonscan,
    /// Arbiscan (Arbitrum).
    Arbiscan,
    /// Basescan (Base).
    Basescan,
    /// Optimistic Etherscan (Optimism).
    Optimism,
    /// Subscan (Polkadot/Substrate).
    Subscan,
    /// Covalent (multi-chain).
    Covalent,
    /// Alchemy (multi-chain RPC).
    Alchemy,
}

impl ApiProvider {
    /// Get the keychain key name for this provider.
    pub fn keychain_key(&self) -> &'static str {
        match self {
            ApiProvider::Etherscan => "etherscan_api_key",
            ApiProvider::Polygonscan => "polygonscan_api_key",
            ApiProvider::Arbiscan => "arbiscan_api_key",
            ApiProvider::Basescan => "basescan_api_key",
            ApiProvider::Optimism => "optimism_api_key",
            ApiProvider::Subscan => "subscan_api_key",
            ApiProvider::Covalent => "covalent_api_key",
            ApiProvider::Alchemy => "alchemy_api_key",
        }
    }

    /// Get the display name for this provider.
    pub fn display_name(&self) -> &'static str {
        match self {
            ApiProvider::Etherscan => "Etherscan",
            ApiProvider::Polygonscan => "Polygonscan",
            ApiProvider::Arbiscan => "Arbiscan",
            ApiProvider::Basescan => "Basescan",
            ApiProvider::Optimism => "Optimistic Etherscan",
            ApiProvider::Subscan => "Subscan",
            ApiProvider::Covalent => "Covalent",
            ApiProvider::Alchemy => "Alchemy",
        }
    }

    /// Default rate limit (requests per second) without API key.
    pub fn default_rate_limit(&self) -> u32 {
        match self {
            // Etherscan-family: 1 req/5sec without key
            ApiProvider::Etherscan
            | ApiProvider::Polygonscan
            | ApiProvider::Arbiscan
            | ApiProvider::Basescan
            | ApiProvider::Optimism => 1,
            // Subscan: 2 req/sec without key
            ApiProvider::Subscan => 2,
            // Covalent: requires key
            ApiProvider::Covalent => 1,
            // Alchemy: limited without key
            ApiProvider::Alchemy => 2,
        }
    }

    /// "Turbo Mode" rate limit (requests per second) with API key.
    pub fn turbo_rate_limit(&self) -> u32 {
        match self {
            // Etherscan-family: 5 req/sec with free key
            ApiProvider::Etherscan
            | ApiProvider::Polygonscan
            | ApiProvider::Arbiscan
            | ApiProvider::Basescan
            | ApiProvider::Optimism => 5,
            // Subscan: 10 req/sec with key
            ApiProvider::Subscan => 10,
            // Covalent: 5 req/sec with key
            ApiProvider::Covalent => 5,
            // Alchemy: 10 req/sec with key
            ApiProvider::Alchemy => 10,
        }
    }

    /// Parse provider from string.
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "etherscan" => Some(ApiProvider::Etherscan),
            "polygonscan" => Some(ApiProvider::Polygonscan),
            "arbiscan" => Some(ApiProvider::Arbiscan),
            "basescan" => Some(ApiProvider::Basescan),
            "optimism" | "optimistic" => Some(ApiProvider::Optimism),
            "subscan" => Some(ApiProvider::Subscan),
            "covalent" => Some(ApiProvider::Covalent),
            "alchemy" => Some(ApiProvider::Alchemy),
            _ => None,
        }
    }

    /// Get all providers.
    pub fn all() -> &'static [ApiProvider] {
        &[
            ApiProvider::Etherscan,
            ApiProvider::Polygonscan,
            ApiProvider::Arbiscan,
            ApiProvider::Basescan,
            ApiProvider::Optimism,
            ApiProvider::Subscan,
            ApiProvider::Covalent,
            ApiProvider::Alchemy,
        ]
    }
}

/// API Key Manager for secure storage and retrieval.
pub struct ApiKeyManager;

impl ApiKeyManager {
    /// Store an API key securely in the system keychain.
    pub fn save_api_key(provider: ApiProvider, api_key: &str) -> ApiKeyResult<()> {
        let entry = Entry::new(KEYCHAIN_SERVICE, provider.keychain_key())
            .map_err(|e| ApiKeyError::KeychainError(e.to_string()))?;

        entry
            .set_password(api_key)
            .map_err(|e| ApiKeyError::KeychainError(e.to_string()))?;

        Ok(())
    }

    /// Retrieve an API key from the system keychain.
    pub fn get_api_key(provider: ApiProvider) -> ApiKeyResult<Option<String>> {
        let entry = Entry::new(KEYCHAIN_SERVICE, provider.keychain_key())
            .map_err(|e| ApiKeyError::KeychainError(e.to_string()))?;

        match entry.get_password() {
            Ok(key) => Ok(Some(key)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(ApiKeyError::KeychainError(e.to_string())),
        }
    }

    /// Delete an API key from the system keychain.
    pub fn delete_api_key(provider: ApiProvider) -> ApiKeyResult<()> {
        let entry = Entry::new(KEYCHAIN_SERVICE, provider.keychain_key())
            .map_err(|e| ApiKeyError::KeychainError(e.to_string()))?;

        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(ApiKeyError::KeychainError(e.to_string())),
        }
    }

    /// Check if an API key exists for a provider.
    pub fn has_api_key(provider: ApiProvider) -> bool {
        Self::get_api_key(provider)
            .map(|k| k.is_some())
            .unwrap_or(false)
    }

    /// Get all configured providers (those with API keys).
    pub fn get_configured_providers() -> Vec<ApiProvider> {
        ApiProvider::all()
            .iter()
            .filter(|p| Self::has_api_key(**p))
            .copied()
            .collect()
    }

    /// Get the effective rate limit for a provider (considers Turbo Mode).
    pub fn get_effective_rate_limit(provider: ApiProvider) -> u32 {
        if Self::has_api_key(provider) {
            provider.turbo_rate_limit()
        } else {
            provider.default_rate_limit()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_keychain_keys() {
        assert_eq!(ApiProvider::Etherscan.keychain_key(), "etherscan_api_key");
        assert_eq!(ApiProvider::Subscan.keychain_key(), "subscan_api_key");
    }

    #[test]
    fn test_provider_rate_limits() {
        assert_eq!(ApiProvider::Etherscan.default_rate_limit(), 1);
        assert_eq!(ApiProvider::Etherscan.turbo_rate_limit(), 5);
        assert_eq!(ApiProvider::Subscan.default_rate_limit(), 2);
        assert_eq!(ApiProvider::Subscan.turbo_rate_limit(), 10);
    }

    #[test]
    fn test_provider_from_str() {
        assert_eq!(ApiProvider::from_str("etherscan"), Some(ApiProvider::Etherscan));
        assert_eq!(ApiProvider::from_str("SUBSCAN"), Some(ApiProvider::Subscan));
        assert_eq!(ApiProvider::from_str("invalid"), None);
    }

    #[test]
    fn test_all_providers() {
        let all = ApiProvider::all();
        assert_eq!(all.len(), 8);
        assert!(all.contains(&ApiProvider::Etherscan));
        assert!(all.contains(&ApiProvider::Subscan));
    }
}
