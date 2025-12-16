//! Authentication State Management
//!
//! Provides global authentication state including JWT secret and session caching.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};

/// Cached session information
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct CachedSession {
    pub user_id: String,
    pub email: String,
    pub cached_at: Instant,
}

/// Authentication state managed by Tauri
///
/// This struct is registered with Tauri's state management system
/// and provides thread-safe access to authentication-related state.
pub struct AuthState {
    /// JWT secret key (generated on startup)
    jwt_secret: Vec<u8>,

    /// In-memory session cache for fast validation
    /// Key: session_id, Value: cached session info
    session_cache: RwLock<HashMap<String, CachedSession>>,

    /// Cache TTL (how long to cache session info)
    #[allow(dead_code)]
    cache_ttl: Duration,
}

impl AuthState {
    /// Create a new AuthState with a randomly generated JWT secret
    pub fn new() -> Self {
        Self::with_cache_ttl(Duration::from_secs(300)) // 5 minute cache TTL
    }

    /// Create a new AuthState with a custom cache TTL
    pub fn with_cache_ttl(cache_ttl: Duration) -> Self {
        // Generate a 32-byte (256-bit) random secret
        let mut secret = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret);

        Self {
            jwt_secret: secret,
            session_cache: RwLock::new(HashMap::new()),
            cache_ttl,
        }
    }

    /// Create AuthState with a specific JWT secret (for testing)
    #[cfg(test)]
    pub fn with_secret(secret: Vec<u8>) -> Self {
        Self {
            jwt_secret: secret,
            session_cache: RwLock::new(HashMap::new()),
            cache_ttl: Duration::from_secs(300),
        }
    }

    /// Get the JWT secret for token signing/verification
    pub fn get_jwt_secret(&self) -> &[u8] {
        &self.jwt_secret
    }

    /// Get the JWT secret as a base64-encoded string (for display/debugging)
    #[allow(dead_code)]
    pub fn get_jwt_secret_base64(&self) -> String {
        URL_SAFE_NO_PAD.encode(&self.jwt_secret)
    }

    /// Cache a session for fast lookup
    pub fn cache_session(&self, session_id: &str, user_id: &str, email: &str) {
        if let Ok(mut cache) = self.session_cache.write() {
            cache.insert(
                session_id.to_string(),
                CachedSession {
                    user_id: user_id.to_string(),
                    email: email.to_string(),
                    cached_at: Instant::now(),
                },
            );
        }
    }

    /// Get a cached session if it exists and hasn't expired
    #[allow(dead_code)]
    pub fn get_cached_session(&self, session_id: &str) -> Option<CachedSession> {
        if let Ok(cache) = self.session_cache.read() {
            if let Some(session) = cache.get(session_id) {
                // Check if cache entry is still valid
                if session.cached_at.elapsed() < self.cache_ttl {
                    return Some(session.clone());
                }
            }
        }
        None
    }

    /// Invalidate a cached session
    pub fn invalidate_session(&self, session_id: &str) {
        if let Ok(mut cache) = self.session_cache.write() {
            cache.remove(session_id);
        }
    }

    /// Invalidate all sessions for a user
    pub fn invalidate_user_sessions(&self, user_id: &str) {
        if let Ok(mut cache) = self.session_cache.write() {
            cache.retain(|_, session| session.user_id != user_id);
        }
    }

    /// Clear expired entries from the cache
    #[allow(dead_code)]
    pub fn cleanup_expired(&self) {
        if let Ok(mut cache) = self.session_cache.write() {
            cache.retain(|_, session| session.cached_at.elapsed() < self.cache_ttl);
        }
    }

    /// Get the number of cached sessions (for monitoring)
    #[allow(dead_code)]
    pub fn cache_size(&self) -> usize {
        self.session_cache
            .read()
            .map(|cache| cache.len())
            .unwrap_or(0)
    }
}

impl Default for AuthState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_state_creation() {
        let state = AuthState::new();
        assert_eq!(state.get_jwt_secret().len(), 32);
    }

    #[test]
    fn test_session_caching() {
        let state = AuthState::new();

        // Cache a session
        state.cache_session("session_123", "user_456", "test@example.com");

        // Retrieve it
        let cached = state.get_cached_session("session_123");
        assert!(cached.is_some());

        let cached = cached.unwrap();
        assert_eq!(cached.user_id, "user_456");
        assert_eq!(cached.email, "test@example.com");
    }

    #[test]
    fn test_session_invalidation() {
        let state = AuthState::new();

        state.cache_session("session_123", "user_456", "test@example.com");
        assert!(state.get_cached_session("session_123").is_some());

        state.invalidate_session("session_123");
        assert!(state.get_cached_session("session_123").is_none());
    }

    #[test]
    fn test_user_sessions_invalidation() {
        let state = AuthState::new();

        // Cache multiple sessions for same user
        state.cache_session("session_1", "user_123", "test@example.com");
        state.cache_session("session_2", "user_123", "test@example.com");
        state.cache_session("session_3", "user_456", "other@example.com");

        assert_eq!(state.cache_size(), 3);

        // Invalidate all sessions for user_123
        state.invalidate_user_sessions("user_123");

        assert_eq!(state.cache_size(), 1);
        assert!(state.get_cached_session("session_1").is_none());
        assert!(state.get_cached_session("session_2").is_none());
        assert!(state.get_cached_session("session_3").is_some());
    }

    #[test]
    fn test_cache_expiry() {
        let state = AuthState::with_cache_ttl(Duration::from_millis(50));

        state.cache_session("session_123", "user_456", "test@example.com");
        assert!(state.get_cached_session("session_123").is_some());

        // Wait for cache to expire
        std::thread::sleep(Duration::from_millis(100));

        assert!(state.get_cached_session("session_123").is_none());
    }
}
