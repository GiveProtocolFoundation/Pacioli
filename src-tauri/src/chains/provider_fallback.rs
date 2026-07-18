//! Provider Fallback Registry
//!
//! Per-chain provider configuration with ordered fallback, health tracking,
//! and retry/backoff. Implements Phase 4a import resilience: when the primary
//! provider fails (5xx, timeout, rate limit), the import path automatically
//! tries the next provider in the chain without data loss.
//!
//! ## Fallback chains
//! - EVM: Etherscan V2 → Alchemy → direct RPC
//! - Solana: primary RPC → fallback RPC endpoints
//! - Bitcoin: Mempool.space → Blockstream.info

use std::fmt;
use std::sync::atomic::{AtomicI64, AtomicU32, AtomicU8, Ordering};
use std::time::Duration;

use crate::chains::ChainError;

// =============================================================================
// HEALTH TRACKING
// =============================================================================

/// Provider health states. Transitions:
/// Healthy → Degraded (after 1 transient failure)
/// Degraded → Unavailable (after `max_failures` consecutive failures)
/// Any → Healthy (on success)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum HealthState {
    /// Provider is responding normally.
    Healthy = 0,
    /// Provider has had recent failures but is still being tried.
    Degraded = 1,
    /// Provider has exceeded the failure threshold and is skipped.
    Unavailable = 2,
}

impl HealthState {
    fn from_u8(v: u8) -> Self {
        match v {
            0 => HealthState::Healthy,
            1 => HealthState::Degraded,
            _ => HealthState::Unavailable,
        }
    }
}

impl fmt::Display for HealthState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            HealthState::Healthy => write!(f, "healthy"),
            HealthState::Degraded => write!(f, "degraded"),
            HealthState::Unavailable => write!(f, "unavailable"),
        }
    }
}

// =============================================================================
// PROVIDER ENDPOINT
// =============================================================================

/// A single provider endpoint with health tracking.
///
/// Health is tracked via atomic counters so it can be shared across
/// async tasks without a lock. On success the failure count resets to 0
/// and health returns to Healthy. On failure the count increments; once
/// it passes `max_failures` the endpoint is marked Unavailable and
/// skipped by the fallback loop until a cooldown period elapses.
pub struct ProviderEndpoint {
    /// Human-readable provider name (e.g. "Etherscan V2", "Alchemy RPC").
    pub name: String,
    /// Base URL for this provider.
    pub url: String,
    /// Current health state (atomic for lock-free access).
    health: AtomicU8,
    /// Consecutive failure count.
    failure_count: AtomicU32,
    /// Unix timestamp (seconds) of the last successful request.
    last_success_ts: AtomicI64,
    /// Consecutive failures before marking unavailable.
    max_failures: u32,
}

impl ProviderEndpoint {
    /// Creates a new healthy provider endpoint.
    pub fn new(name: impl Into<String>, url: impl Into<String>, max_failures: u32) -> Self {
        Self {
            name: name.into(),
            url: url.into(),
            health: AtomicU8::new(HealthState::Healthy as u8),
            failure_count: AtomicU32::new(0),
            last_success_ts: AtomicI64::new(0),
            max_failures,
        }
    }

    /// Current health state.
    pub fn health(&self) -> HealthState {
        HealthState::from_u8(self.health.load(Ordering::Relaxed))
    }

    /// Consecutive failure count.
    pub fn failures(&self) -> u32 {
        self.failure_count.load(Ordering::Relaxed)
    }

    /// Record a successful request — resets health to Healthy.
    pub fn record_success(&self) {
        self.failure_count.store(0, Ordering::Relaxed);
        self.health
            .store(HealthState::Healthy as u8, Ordering::Relaxed);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        self.last_success_ts.store(now, Ordering::Relaxed);
    }

    /// Record a failed request — increments failure count and
    /// transitions health from Healthy→Degraded→Unavailable.
    pub fn record_failure(&self) {
        let new_count = self.failure_count.fetch_add(1, Ordering::Relaxed) + 1;
        if new_count >= self.max_failures {
            self.health
                .store(HealthState::Unavailable as u8, Ordering::Relaxed);
        } else {
            self.health
                .store(HealthState::Degraded as u8, Ordering::Relaxed);
        }
    }

    /// Whether this endpoint should be tried (Healthy or Degraded, or
    /// Unavailable but past the cooldown window).
    pub fn is_available(&self) -> bool {
        let state = self.health();
        match state {
            HealthState::Healthy | HealthState::Degraded => true,
            HealthState::Unavailable => {
                // Allow retry after 60s cooldown
                let last = self.last_success_ts.load(Ordering::Relaxed);
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;
                now - last > 60
            }
        }
    }

    /// Reset health to Healthy (for tests or manual recovery).
    pub fn reset(&self) {
        self.failure_count.store(0, Ordering::Relaxed);
        self.health
            .store(HealthState::Healthy as u8, Ordering::Relaxed);
    }
}

impl fmt::Debug for ProviderEndpoint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProviderEndpoint")
            .field("name", &self.name)
            .field("url", &self.url)
            .field("health", &self.health())
            .field("failures", &self.failures())
            .finish()
    }
}

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

/// Ordered list of provider endpoints for a single chain.
///
/// `execute_with_fallback` tries each available endpoint in order.
/// When a provider fails with a transient error the next one is tried.
/// Permanent errors (invalid address, unsupported chain) short-circuit.
pub struct ProviderRegistry {
    /// Chain identifier (for error messages).
    pub chain_id: String,
    /// Ordered list of provider endpoints (primary first).
    pub endpoints: Vec<ProviderEndpoint>,
}

impl ProviderRegistry {
    /// Creates a new registry for the given chain.
    pub fn new(chain_id: impl Into<String>, endpoints: Vec<ProviderEndpoint>) -> Self {
        Self {
            chain_id: chain_id.into(),
            endpoints,
        }
    }

    /// Execute an async operation with provider fallback.
    ///
    /// The closure receives the provider URL and must return a `ChainResult`.
    /// Transient errors trigger fallback to the next provider. Permanent
    /// errors are returned immediately.
    ///
    /// If ALL providers fail, returns `ChainError::ProviderUnavailable`
    /// with a user-friendly message listing the tried providers.
    pub async fn execute_with_fallback<F, Fut, T>(&self, operation: F) -> Result<T, ChainError>
    where
        F: Fn(String) -> Fut,
        Fut: std::future::Future<Output = Result<T, ChainError>>,
    {
        let mut last_error = None;
        let mut tried_providers: Vec<String> = Vec::new();

        for endpoint in &self.endpoints {
            if !endpoint.is_available() {
                continue;
            }

            tried_providers.push(endpoint.name.clone());

            match operation(endpoint.url.clone()).await {
                Ok(result) => {
                    endpoint.record_success();
                    return Ok(result);
                }
                Err(e) => {
                    if is_permanent_error(&e) {
                        return Err(e);
                    }
                    endpoint.record_failure();
                    last_error = Some(e);
                }
            }
        }

        // All providers failed or unavailable
        if tried_providers.is_empty() {
            Err(ChainError::ProviderUnavailable(format!(
                "All providers for {} are temporarily unavailable. \
                 The system will retry automatically.",
                self.chain_id
            )))
        } else {
            Err(ChainError::ProviderUnavailable(format!(
                "Provider temporarily unavailable for {}. Tried: {}. \
                 Last error: {}",
                self.chain_id,
                tried_providers.join(", "),
                last_error
                    .as_ref()
                    .map_or("unknown".to_string(), |e| e.to_string()),
            )))
        }
    }

    /// Number of endpoints in the registry.
    pub fn len(&self) -> usize {
        self.endpoints.len()
    }

    /// Whether the registry is empty.
    pub fn is_empty(&self) -> bool {
        self.endpoints.is_empty()
    }

    /// Number of currently available (non-unavailable) endpoints.
    pub fn available_count(&self) -> usize {
        self.endpoints.iter().filter(|e| e.is_available()).count()
    }
}

impl fmt::Debug for ProviderRegistry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProviderRegistry")
            .field("chain_id", &self.chain_id)
            .field("endpoint_count", &self.endpoints.len())
            .field("available", &self.available_count())
            .finish()
    }
}

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

/// Classify whether a `ChainError` is permanent (should NOT trigger fallback)
/// or transient (should try the next provider).
///
/// Permanent errors: invalid address, unsupported chain, parse errors.
/// Transient errors: connection failures, RPC errors, API errors, rate limits.
pub fn is_permanent_error(error: &ChainError) -> bool {
    matches!(
        error,
        ChainError::UnsupportedChain(_)
            | ChainError::InvalidAddress(_)
            | ChainError::ParseError(_)
            | ChainError::ConfigError(_)
    )
}

/// Classify whether a `ChainError` is transient (should trigger fallback).
pub fn is_transient_error(error: &ChainError) -> bool {
    !is_permanent_error(error)
}

// =============================================================================
// RETRY HELPER
// =============================================================================

/// Retry an operation with exponential backoff.
///
/// Only retries on transient errors. Permanent errors are returned immediately.
/// Maximum delay is capped at `max_delay`.
pub async fn retry_with_backoff<F, Fut, T>(
    operation: F,
    max_retries: u32,
    base_delay: Duration,
    max_delay: Duration,
) -> Result<T, ChainError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, ChainError>>,
{
    let mut last_error = ChainError::Internal("No attempts made".to_string());

    for attempt in 0..=max_retries {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                if is_permanent_error(&e) || attempt == max_retries {
                    return Err(e);
                }
                last_error = e;
                let delay = std::cmp::min(base_delay * 2u32.pow(attempt), max_delay);
                tokio::time::sleep(delay).await;
            }
        }
    }

    Err(last_error)
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/// Build an EVM provider registry for the given chain.
///
/// Fallback order: Etherscan V2 → Alchemy RPC → direct chain RPC.
pub fn build_evm_registry(
    chain_name: &str,
    etherscan_url: &str,
    alchemy_url: Option<&str>,
    rpc_url: Option<&str>,
) -> ProviderRegistry {
    let mut endpoints = Vec::with_capacity(3);

    // Primary: Etherscan V2 API
    endpoints.push(ProviderEndpoint::new(
        format!("Etherscan V2 ({})", chain_name),
        etherscan_url,
        3,
    ));

    // Secondary: Alchemy RPC (if available)
    if let Some(url) = alchemy_url {
        endpoints.push(ProviderEndpoint::new(
            format!("Alchemy ({})", chain_name),
            url,
            3,
        ));
    }

    // Tertiary: direct RPC
    if let Some(url) = rpc_url {
        endpoints.push(ProviderEndpoint::new(
            format!("Direct RPC ({})", chain_name),
            url,
            5,
        ));
    }

    ProviderRegistry::new(chain_name, endpoints)
}

/// Build a Solana provider registry.
///
/// Fallback order: primary RPC → fallback public RPC endpoint.
pub fn build_solana_registry(
    network: &str,
    primary_url: &str,
    helius_url: Option<&str>,
) -> ProviderRegistry {
    let mut endpoints = Vec::with_capacity(3);

    // Primary: configured RPC
    endpoints.push(ProviderEndpoint::new(
        format!("Solana RPC ({})", network),
        primary_url,
        3,
    ));

    // Secondary: Helius enriched (if API key available)
    if let Some(url) = helius_url {
        endpoints.push(ProviderEndpoint::new(
            format!("Helius ({})", network),
            url,
            3,
        ));
    }

    // Tertiary: public fallback
    let fallback = match network {
        "solana_devnet" | "sol_devnet" | "devnet" => "https://api.devnet.solana.com",
        _ => "https://api.mainnet-beta.solana.com",
    };
    // Only add fallback if it differs from primary
    if fallback != primary_url {
        endpoints.push(ProviderEndpoint::new(
            format!("Solana Public RPC ({})", network),
            fallback,
            5,
        ));
    }

    ProviderRegistry::new(network, endpoints)
}

/// Build a Bitcoin provider registry.
///
/// Fallback order: Mempool.space → Blockstream.info.
pub fn build_bitcoin_registry(network: &str, primary_url: &str) -> ProviderRegistry {
    let mut endpoints = Vec::with_capacity(2);

    // Primary: Mempool.space
    endpoints.push(ProviderEndpoint::new(
        format!("Mempool.space ({})", network),
        primary_url,
        3,
    ));

    // Secondary: Blockstream.info
    let blockstream_url = match network {
        "bitcoin_testnet" | "btc_testnet" | "testnet" => "https://blockstream.info/testnet/api",
        "bitcoin_signet" | "btc_signet" | "signet" => {
            // Blockstream doesn't support signet, skip
            return ProviderRegistry::new(network, endpoints);
        }
        _ => "https://blockstream.info/api",
    };

    endpoints.push(ProviderEndpoint::new(
        format!("Blockstream ({})", network),
        blockstream_url,
        3,
    ));

    ProviderRegistry::new(network, endpoints)
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_state_transitions() {
        let ep = ProviderEndpoint::new("test", "http://example.com", 3);
        assert_eq!(ep.health(), HealthState::Healthy);
        assert_eq!(ep.failures(), 0);

        // First failure → Degraded
        ep.record_failure();
        assert_eq!(ep.health(), HealthState::Degraded);
        assert_eq!(ep.failures(), 1);

        // Second failure → still Degraded
        ep.record_failure();
        assert_eq!(ep.health(), HealthState::Degraded);
        assert_eq!(ep.failures(), 2);

        // Third failure → Unavailable (max_failures = 3)
        ep.record_failure();
        assert_eq!(ep.health(), HealthState::Unavailable);
        assert_eq!(ep.failures(), 3);

        // Success resets to Healthy
        ep.record_success();
        assert_eq!(ep.health(), HealthState::Healthy);
        assert_eq!(ep.failures(), 0);
    }

    #[test]
    fn test_endpoint_availability() {
        let ep = ProviderEndpoint::new("test", "http://example.com", 2);
        assert!(ep.is_available());

        ep.record_failure();
        assert!(ep.is_available()); // Degraded is still available

        ep.record_failure();
        // Unavailable, but cooldown check may pass if last_success_ts is 0 (> 60s ago)
        // Since last_success_ts is 0, now - 0 > 60 → still "available" for retry
        assert!(ep.is_available());
    }

    #[test]
    fn test_endpoint_reset() {
        let ep = ProviderEndpoint::new("test", "http://example.com", 1);
        ep.record_failure();
        assert_eq!(ep.health(), HealthState::Unavailable);

        ep.reset();
        assert_eq!(ep.health(), HealthState::Healthy);
        assert_eq!(ep.failures(), 0);
    }

    #[test]
    fn test_error_classification() {
        assert!(is_permanent_error(&ChainError::UnsupportedChain(
            "x".into()
        )));
        assert!(is_permanent_error(&ChainError::InvalidAddress("x".into())));
        assert!(is_permanent_error(&ChainError::ParseError("x".into())));
        assert!(is_permanent_error(&ChainError::ConfigError("x".into())));

        assert!(is_transient_error(&ChainError::ConnectionFailed(
            "x".into()
        )));
        assert!(is_transient_error(&ChainError::RpcError("x".into())));
        assert!(is_transient_error(&ChainError::ApiError("x".into())));
        assert!(is_transient_error(&ChainError::RateLimited));
        assert!(is_transient_error(&ChainError::Internal("x".into())));
    }

    #[test]
    fn test_build_evm_registry() {
        let reg = build_evm_registry(
            "ethereum",
            "https://api.etherscan.io/v2/api",
            Some("https://eth-mainnet.g.alchemy.com/v2"),
            Some("https://rpc.ankr.com/eth"),
        );
        assert_eq!(reg.chain_id, "ethereum");
        assert_eq!(reg.len(), 3);
        assert_eq!(reg.available_count(), 3);
    }

    #[test]
    fn test_build_evm_registry_no_alchemy() {
        let reg = build_evm_registry("moonbeam", "https://api.etherscan.io/v2/api", None, None);
        assert_eq!(reg.len(), 1);
    }

    #[test]
    fn test_build_solana_registry() {
        let reg = build_solana_registry(
            "solana",
            "https://api.mainnet-beta.solana.com",
            Some("https://mainnet.helius-rpc.com"),
        );
        // primary + helius (no fallback since primary == public)
        assert_eq!(reg.len(), 2);
    }

    #[test]
    fn test_build_solana_registry_custom_primary() {
        let reg = build_solana_registry("solana", "https://my-custom-rpc.example.com", None);
        // custom primary + public fallback
        assert_eq!(reg.len(), 2);
    }

    #[test]
    fn test_build_bitcoin_registry() {
        let reg = build_bitcoin_registry("bitcoin", "https://mempool.space/api");
        assert_eq!(reg.len(), 2);
        assert_eq!(reg.endpoints[0].name, "Mempool.space (bitcoin)");
        assert_eq!(reg.endpoints[1].name, "Blockstream (bitcoin)");
    }

    #[test]
    fn test_build_bitcoin_registry_signet() {
        let reg = build_bitcoin_registry("bitcoin_signet", "https://mempool.space/signet/api");
        // Signet has no Blockstream fallback
        assert_eq!(reg.len(), 1);
    }

    #[tokio::test]
    async fn test_execute_with_fallback_primary_success() {
        let reg = ProviderRegistry::new(
            "test",
            vec![
                ProviderEndpoint::new("primary", "http://primary", 3),
                ProviderEndpoint::new("fallback", "http://fallback", 3),
            ],
        );

        let result = reg
            .execute_with_fallback(|url| async move {
                if url == "http://primary" {
                    Ok(42)
                } else {
                    Err(ChainError::ApiError("unexpected".into()))
                }
            })
            .await;

        assert_eq!(result.unwrap(), 42);
        assert_eq!(reg.endpoints[0].health(), HealthState::Healthy);
    }

    #[tokio::test]
    async fn test_execute_with_fallback_primary_fails() {
        let reg = ProviderRegistry::new(
            "test",
            vec![
                ProviderEndpoint::new("primary", "http://primary", 3),
                ProviderEndpoint::new("fallback", "http://fallback", 3),
            ],
        );

        let result = reg
            .execute_with_fallback(|url| async move {
                if url == "http://primary" {
                    Err(ChainError::ConnectionFailed("timeout".into()))
                } else {
                    Ok(99)
                }
            })
            .await;

        assert_eq!(result.unwrap(), 99);
        assert_eq!(reg.endpoints[0].health(), HealthState::Degraded);
        assert_eq!(reg.endpoints[1].health(), HealthState::Healthy);
    }

    #[tokio::test]
    async fn test_execute_with_fallback_all_fail() {
        let reg = ProviderRegistry::new(
            "ethereum",
            vec![
                ProviderEndpoint::new("primary", "http://primary", 3),
                ProviderEndpoint::new("fallback", "http://fallback", 3),
            ],
        );

        let result: Result<i32, _> = reg
            .execute_with_fallback(|_url| async move {
                Err(ChainError::ApiError("server error".into()))
            })
            .await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ChainError::ProviderUnavailable(msg) => {
                assert!(msg.contains("ethereum"));
                assert!(msg.contains("primary"));
                assert!(msg.contains("fallback"));
            }
            other => panic!("Expected ProviderUnavailable, got: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_execute_with_fallback_permanent_error_no_fallback() {
        let reg = ProviderRegistry::new(
            "test",
            vec![
                ProviderEndpoint::new("primary", "http://primary", 3),
                ProviderEndpoint::new("fallback", "http://fallback", 3),
            ],
        );

        let result: Result<i32, _> = reg
            .execute_with_fallback(|_url| async move {
                Err(ChainError::InvalidAddress("bad address".into()))
            })
            .await;

        // Permanent error returned immediately without trying fallback
        assert!(matches!(result, Err(ChainError::InvalidAddress(_))));
        // Primary health not degraded for permanent errors
        // (record_failure is only called for transient)
        assert_eq!(reg.endpoints[0].health(), HealthState::Healthy);
    }

    #[tokio::test]
    async fn test_execute_with_fallback_rate_limit_triggers_fallback() {
        let reg = ProviderRegistry::new(
            "test",
            vec![
                ProviderEndpoint::new("primary", "http://primary", 3),
                ProviderEndpoint::new("fallback", "http://fallback", 3),
            ],
        );

        let result = reg
            .execute_with_fallback(|url| async move {
                if url == "http://primary" {
                    Err(ChainError::RateLimited)
                } else {
                    Ok("ok")
                }
            })
            .await;

        assert_eq!(result.unwrap(), "ok");
    }

    #[tokio::test]
    async fn test_health_degradation_across_calls() {
        let reg = ProviderRegistry::new(
            "test",
            vec![
                ProviderEndpoint::new("primary", "http://primary", 2),
                ProviderEndpoint::new("fallback", "http://fallback", 2),
            ],
        );

        // First call: primary fails, fallback succeeds
        let _r = reg
            .execute_with_fallback(|url| async move {
                if url == "http://primary" {
                    Err(ChainError::ApiError("500".into()))
                } else {
                    Ok(1)
                }
            })
            .await;
        assert_eq!(reg.endpoints[0].health(), HealthState::Degraded);
        assert_eq!(reg.endpoints[0].failures(), 1);

        // Second call: primary fails again → becomes Unavailable
        let _r = reg
            .execute_with_fallback(|url| async move {
                if url == "http://primary" {
                    Err(ChainError::ApiError("500".into()))
                } else {
                    Ok(2)
                }
            })
            .await;
        assert_eq!(reg.endpoints[0].health(), HealthState::Unavailable);
        assert_eq!(reg.endpoints[0].failures(), 2);
    }

    #[tokio::test]
    async fn test_intermittent_recovery() {
        let reg = ProviderRegistry::new(
            "test",
            vec![ProviderEndpoint::new("primary", "http://primary", 3)],
        );

        // Fail once
        let _r: Result<i32, _> = reg
            .execute_with_fallback(|_url| async move { Err(ChainError::ApiError("503".into())) })
            .await;
        assert_eq!(reg.endpoints[0].health(), HealthState::Degraded);

        // Succeed — should recover
        let _r = reg
            .execute_with_fallback(|_url| async move { Ok(42) })
            .await;
        assert_eq!(reg.endpoints[0].health(), HealthState::Healthy);
        assert_eq!(reg.endpoints[0].failures(), 0);
    }

    #[tokio::test]
    async fn test_retry_with_backoff_success_first_try() {
        let result = retry_with_backoff(
            || async { Ok::<_, ChainError>(42) },
            3,
            Duration::from_millis(10),
            Duration::from_millis(100),
        )
        .await;
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_retry_with_backoff_eventual_success() {
        use std::sync::atomic::{AtomicU32, Ordering};
        let attempt = AtomicU32::new(0);

        let result = retry_with_backoff(
            || {
                let a = attempt.fetch_add(1, Ordering::Relaxed);
                async move {
                    if a < 2 {
                        Err(ChainError::ApiError("retry me".into()))
                    } else {
                        Ok(99)
                    }
                }
            },
            3,
            Duration::from_millis(1),
            Duration::from_millis(10),
        )
        .await;
        assert_eq!(result.unwrap(), 99);
    }

    #[tokio::test]
    async fn test_retry_with_backoff_permanent_error() {
        let result: Result<i32, _> = retry_with_backoff(
            || async { Err(ChainError::InvalidAddress("bad".into())) },
            3,
            Duration::from_millis(1),
            Duration::from_millis(10),
        )
        .await;
        assert!(matches!(result, Err(ChainError::InvalidAddress(_))));
    }

    #[tokio::test]
    async fn test_retry_with_backoff_exhausted() {
        let result: Result<i32, _> = retry_with_backoff(
            || async { Err(ChainError::ApiError("always fails".into())) },
            2,
            Duration::from_millis(1),
            Duration::from_millis(10),
        )
        .await;
        assert!(matches!(result, Err(ChainError::ApiError(_))));
    }
}
