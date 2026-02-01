//! Tauri Commands for Fetcher System
//!
//! Exposes API key management and rate limit status to the frontend.

use super::api_keys::{ApiKeyManager, ApiProvider};
use serde::Serialize;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/// API provider status for frontend display.
#[derive(Debug, Serialize)]
pub struct ProviderStatus {
    /// Provider identifier.
    pub provider: String,
    /// Display name.
    pub name: String,
    /// Whether an API key is configured.
    pub has_api_key: bool,
    /// Current rate limit (requests per second).
    pub rate_limit: u32,
    /// Maximum rate limit with API key.
    pub turbo_rate_limit: u32,
    /// Whether Turbo Mode is active.
    pub is_turbo_mode: bool,
}

/// Result of saving an API key.
#[derive(Debug, Serialize)]
pub struct SaveApiKeyResult {
    /// Whether the operation succeeded.
    pub success: bool,
    /// New rate limit after saving.
    pub new_rate_limit: u32,
    /// Error message if failed.
    pub error: Option<String>,
}

// =============================================================================
// COMMANDS
// =============================================================================

/// Save an API key for a provider.
///
/// Stores the key securely in the OS keychain and updates the rate limit.
#[tauri::command]
pub async fn save_api_key(provider: String, api_key: String) -> SaveApiKeyResult {
    let Some(api_provider) = ApiProvider::from_str(&provider) else {
        return SaveApiKeyResult {
            success: false,
            new_rate_limit: 0,
            error: Some(format!("Unknown provider: {}", provider)),
        };
    };

    match ApiKeyManager::save_api_key(api_provider, &api_key) {
        Ok(()) => SaveApiKeyResult {
            success: true,
            new_rate_limit: api_provider.turbo_rate_limit(),
            error: None,
        },
        Err(e) => SaveApiKeyResult {
            success: false,
            new_rate_limit: api_provider.default_rate_limit(),
            error: Some(e.to_string()),
        },
    }
}

/// Delete an API key for a provider.
#[tauri::command]
pub async fn delete_api_key(provider: String) -> SaveApiKeyResult {
    let Some(api_provider) = ApiProvider::from_str(&provider) else {
        return SaveApiKeyResult {
            success: false,
            new_rate_limit: 0,
            error: Some(format!("Unknown provider: {}", provider)),
        };
    };

    match ApiKeyManager::delete_api_key(api_provider) {
        Ok(()) => SaveApiKeyResult {
            success: true,
            new_rate_limit: api_provider.default_rate_limit(),
            error: None,
        },
        Err(e) => SaveApiKeyResult {
            success: false,
            new_rate_limit: api_provider.default_rate_limit(),
            error: Some(e.to_string()),
        },
    }
}

/// Check if an API key exists for a provider.
#[tauri::command]
pub async fn has_api_key(provider: String) -> bool {
    ApiProvider::from_str(&provider)
        .map(ApiKeyManager::has_api_key)
        .unwrap_or(false)
}

/// Get the status of a specific provider.
#[tauri::command]
pub async fn get_provider_status(provider: String) -> Option<ProviderStatus> {
    let api_provider = ApiProvider::from_str(&provider)?;
    let has_key = ApiKeyManager::has_api_key(api_provider);

    Some(ProviderStatus {
        provider,
        name: api_provider.display_name().to_string(),
        has_api_key: has_key,
        rate_limit: if has_key {
            api_provider.turbo_rate_limit()
        } else {
            api_provider.default_rate_limit()
        },
        turbo_rate_limit: api_provider.turbo_rate_limit(),
        is_turbo_mode: has_key,
    })
}

/// Get the status of all providers.
#[tauri::command]
pub async fn get_all_provider_statuses() -> Vec<ProviderStatus> {
    ApiProvider::all()
        .iter()
        .map(|p| {
            let has_key = ApiKeyManager::has_api_key(*p);
            ProviderStatus {
                provider: p.keychain_key().replace("_api_key", ""),
                name: p.display_name().to_string(),
                has_api_key: has_key,
                rate_limit: if has_key {
                    p.turbo_rate_limit()
                } else {
                    p.default_rate_limit()
                },
                turbo_rate_limit: p.turbo_rate_limit(),
                is_turbo_mode: has_key,
            }
        })
        .collect()
}

/// Get list of configured providers (those with API keys).
#[tauri::command]
pub async fn get_configured_providers() -> Vec<String> {
    ApiKeyManager::get_configured_providers()
        .iter()
        .map(|p| p.keychain_key().replace("_api_key", ""))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_provider_status_unknown() {
        let result = get_provider_status("unknown".to_string()).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_all_provider_statuses() {
        let statuses = get_all_provider_statuses().await;
        assert!(!statuses.is_empty());

        // Should have etherscan
        let etherscan = statuses.iter().find(|s| s.provider == "etherscan");
        assert!(etherscan.is_some());
    }

    #[tokio::test]
    async fn test_has_api_key_unknown() {
        let result = has_api_key("unknown".to_string()).await;
        assert!(!result);
    }
}
