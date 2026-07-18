//! Tauri Commands for Fetcher System
//!
//! Exposes API key management and rate limit status to the frontend.

use super::api_keys::{ApiKeyManager, ApiProvider};
use serde::{Deserialize, Serialize};

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

/// Result of validating an API key against its provider.
#[derive(Debug, Serialize)]
pub struct ValidateApiKeyResult {
    /// Validation outcome: "valid", "invalid", "network_error", or "not_verifiable".
    pub status: String,
    /// Human-readable message.
    pub message: String,
}

/// Raw Etherscan V2 API response for validation calls.
#[derive(Debug, Deserialize)]
struct EtherscanValidationResponse {
    status: String,
    message: String,
    result: serde_json::Value,
}

/// Raw Subscan API response for validation calls.
#[derive(Debug, Deserialize)]
struct SubscanValidationResponse {
    code: i32,
    message: String,
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

/// Validate an API key by making a cheap test call to the provider.
///
/// For Etherscan-family providers, calls the `ethsupply` stats endpoint.
/// For Subscan, calls the `/api/now` timestamp endpoint.
/// Other providers return "not_verifiable".
#[tauri::command]
pub async fn validate_api_key(provider: String, api_key: String) -> ValidateApiKeyResult {
    let Some(api_provider) = ApiProvider::from_str(&provider) else {
        return ValidateApiKeyResult {
            status: "invalid".to_string(),
            message: format!("Unknown provider: {provider}"),
        };
    };

    match api_provider {
        ApiProvider::Etherscan
        | ApiProvider::Polygonscan
        | ApiProvider::Arbiscan
        | ApiProvider::Basescan
        | ApiProvider::Optimism
        | ApiProvider::Moonscan => validate_etherscan_key(&api_key).await,
        ApiProvider::Subscan => validate_subscan_key(&api_key).await,
        _ => ValidateApiKeyResult {
            status: "not_verifiable".to_string(),
            message: format!(
                "{} key validation is not available — key will be saved as-is",
                api_provider.display_name()
            ),
        },
    }
}

/// Validate an Etherscan-family API key via the V2 unified endpoint.
async fn validate_etherscan_key(api_key: &str) -> ValidateApiKeyResult {
    let url = format!(
        "https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethsupply&apikey={}",
        api_key
    );

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ValidateApiKeyResult {
                status: "network_error".to_string(),
                message: format!("Failed to create HTTP client: {e}"),
            }
        }
    };

    match client.get(&url).send().await {
        Ok(resp) => match resp.json::<EtherscanValidationResponse>().await {
            Ok(body) => {
                if body.status == "1" || body.message == "OK" {
                    ValidateApiKeyResult {
                        status: "valid".to_string(),
                        message: "API key is valid".to_string(),
                    }
                } else {
                    let detail = body.result.as_str().unwrap_or("Unknown error");
                    ValidateApiKeyResult {
                        status: "invalid".to_string(),
                        message: format!("Provider rejected the key: {detail}"),
                    }
                }
            }
            Err(e) => ValidateApiKeyResult {
                status: "network_error".to_string(),
                message: format!("Failed to parse provider response: {e}"),
            },
        },
        Err(e) => ValidateApiKeyResult {
            status: "network_error".to_string(),
            message: format!("Network error: {e}"),
        },
    }
}

/// Validate a Subscan API key via the `/api/now` timestamp endpoint.
async fn validate_subscan_key(api_key: &str) -> ValidateApiKeyResult {
    let url = "https://polkadot.api.subscan.io/api/now";

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ValidateApiKeyResult {
                status: "network_error".to_string(),
                message: format!("Failed to create HTTP client: {e}"),
            }
        }
    };

    match client
        .post(url)
        .header("X-API-Key", api_key)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
    {
        Ok(resp) => {
            let status_code = resp.status().as_u16();
            if status_code == 401 || status_code == 403 {
                return ValidateApiKeyResult {
                    status: "invalid".to_string(),
                    message: "Provider rejected the key".to_string(),
                };
            }
            match resp.json::<SubscanValidationResponse>().await {
                Ok(body) => {
                    if body.code == 0 {
                        ValidateApiKeyResult {
                            status: "valid".to_string(),
                            message: "API key is valid".to_string(),
                        }
                    } else {
                        ValidateApiKeyResult {
                            status: "invalid".to_string(),
                            message: format!("Provider rejected the key: {}", body.message),
                        }
                    }
                }
                Err(e) => ValidateApiKeyResult {
                    status: "network_error".to_string(),
                    message: format!("Failed to parse provider response: {e}"),
                },
            }
        }
        Err(e) => ValidateApiKeyResult {
            status: "network_error".to_string(),
            message: format!("Network error: {e}"),
        },
    }
}

/// Test the stored API key for a provider without exposing it to the frontend.
///
/// Reads the key from the OS keychain, validates it against the provider, and
/// returns the result. The key never leaves the Rust layer.
#[tauri::command]
pub async fn test_stored_api_key(provider: String) -> ValidateApiKeyResult {
    let Some(api_provider) = ApiProvider::from_str(&provider) else {
        return ValidateApiKeyResult {
            status: "invalid".to_string(),
            message: format!("Unknown provider: {provider}"),
        };
    };

    let key = match ApiKeyManager::get_api_key(api_provider) {
        Ok(Some(k)) => k,
        Ok(None) => {
            return ValidateApiKeyResult {
                status: "invalid".to_string(),
                message: "No API key stored for this provider".to_string(),
            }
        }
        Err(e) => {
            return ValidateApiKeyResult {
                status: "network_error".to_string(),
                message: format!("Failed to read keychain: {e}"),
            }
        }
    };

    validate_api_key(provider, key).await
}

/// Retrieve an API key for a provider from the system keychain.
#[tauri::command]
pub async fn get_api_key(provider: String) -> Option<String> {
    ApiProvider::from_str(&provider).and_then(|p| ApiKeyManager::get_api_key(p).ok().flatten())
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
