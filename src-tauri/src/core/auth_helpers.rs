//! Authentication helper functions
//!
//! Provides password hashing (Argon2id) and JWT token management utilities.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use serde::{Deserialize, Serialize};

/// JWT claims structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenClaims {
    /// Subject (user ID)
    pub sub: String,
    /// User email
    pub email: String,
    /// Issued at (Unix timestamp)
    pub iat: usize,
    /// Expiration time (Unix timestamp)
    pub exp: usize,
    /// Token type: "access" or "refresh"
    pub token_type: String,
    /// Session ID (for refresh tokens)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// Result of successful authentication
#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

// ============================================================================
// Password Hashing
// ============================================================================

/// Hash a password using Argon2id
///
/// Uses secure defaults:
/// - Argon2id variant (hybrid of Argon2i and Argon2d)
/// - Random salt generated via OS RNG
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("Failed to hash password: {}", e))
}

/// Verify a password against its hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| format!("Invalid password hash format: {}", e))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

// ============================================================================
// JWT Token Management
// ============================================================================

/// Generate an access token (short-lived)
///
/// Default expiration: 15 minutes
pub fn generate_access_token(
    user_id: &str,
    email: &str,
    secret: &[u8],
    expiry_minutes: Option<i64>,
) -> Result<String, String> {
    let expiry = expiry_minutes.unwrap_or(15);
    let now = Utc::now();
    let exp = now + Duration::minutes(expiry);

    let claims = TokenClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        iat: now.timestamp() as usize,
        exp: exp.timestamp() as usize,
        token_type: "access".to_string(),
        session_id: None,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .map_err(|e| format!("Failed to generate access token: {}", e))
}

/// Generate a refresh token (long-lived)
///
/// Default expiration: 7 days
pub fn generate_refresh_token(
    user_id: &str,
    email: &str,
    session_id: &str,
    secret: &[u8],
    expiry_days: Option<i64>,
) -> Result<String, String> {
    let expiry = expiry_days.unwrap_or(7);
    let now = Utc::now();
    let exp = now + Duration::days(expiry);

    let claims = TokenClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        iat: now.timestamp() as usize,
        exp: exp.timestamp() as usize,
        token_type: "refresh".to_string(),
        session_id: Some(session_id.to_string()),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .map_err(|e| format!("Failed to generate refresh token: {}", e))
}

/// Verify and decode a JWT token
pub fn verify_token(token: &str, secret: &[u8]) -> Result<TokenClaims, String> {
    let validation = Validation::default();

    decode::<TokenClaims>(token, &DecodingKey::from_secret(secret), &validation)
        .map(|data| data.claims)
        .map_err(|e| format!("Invalid token: {}", e))
}

/// Verify an access token specifically (checks token_type)
pub fn verify_access_token(token: &str, secret: &[u8]) -> Result<TokenClaims, String> {
    let claims = verify_token(token, secret)?;

    if claims.token_type != "access" {
        return Err("Invalid token type: expected access token".to_string());
    }

    Ok(claims)
}

/// Verify a refresh token specifically (checks token_type)
pub fn verify_refresh_token(token: &str, secret: &[u8]) -> Result<TokenClaims, String> {
    let claims = verify_token(token, secret)?;

    if claims.token_type != "refresh" {
        return Err("Invalid token type: expected refresh token".to_string());
    }

    Ok(claims)
}

// ============================================================================
// Secure Random Generation
// ============================================================================

/// Generate a cryptographically secure random token
///
/// Returns a URL-safe base64-encoded string
pub fn generate_secure_token(length: usize) -> String {
    let mut bytes = vec![0u8; length];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(&bytes)
}

/// Generate an invitation token (32 bytes = 43 chars base64)
pub fn generate_invitation_token() -> String {
    generate_secure_token(32)
}

/// Generate a session ID (16 bytes = 22 chars base64)
pub fn generate_session_id() -> String {
    generate_secure_token(16)
}

/// Generate a password reset token (32 bytes)
#[allow(dead_code)]
pub fn generate_password_reset_token() -> String {
    generate_secure_token(32)
}

/// Generate an email verification token (32 bytes)
#[allow(dead_code)]
pub fn generate_email_verification_token() -> String {
    generate_secure_token(32)
}

/// Hash a token for storage (using SHA-256)
///
/// Used for refresh tokens and other sensitive tokens stored in DB
pub fn hash_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let result = hasher.finalize();
    URL_SAFE_NO_PAD.encode(result)
}

// ============================================================================
// Password Validation
// ============================================================================

/// Validate password strength
///
/// Returns Ok(()) if password is strong enough, Err with reason otherwise
pub fn validate_password_strength(password: &str, min_length: usize) -> Result<(), String> {
    if password.len() < min_length {
        return Err(format!(
            "Password must be at least {} characters long",
            min_length
        ));
    }

    // Check for at least one lowercase letter
    if !password.chars().any(|c| c.is_ascii_lowercase()) {
        return Err("Password must contain at least one lowercase letter".to_string());
    }

    // Check for at least one uppercase letter
    if !password.chars().any(|c| c.is_ascii_uppercase()) {
        return Err("Password must contain at least one uppercase letter".to_string());
    }

    // Check for at least one digit
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("Password must contain at least one number".to_string());
    }

    Ok(())
}

/// Validate email format (basic validation)
pub fn validate_email(email: &str) -> Result<(), String> {
    if email.is_empty() {
        return Err("Email cannot be empty".to_string());
    }

    if !email.contains('@') || !email.contains('.') {
        return Err("Invalid email format".to_string());
    }

    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return Err("Invalid email format".to_string());
    }

    if parts[0].is_empty() || parts[1].is_empty() {
        return Err("Invalid email format".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hash_and_verify() {
        let password = "SecureP@ssw0rd!";
        let hash = hash_password(password).unwrap();

        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_jwt_generation_and_verification() {
        let secret = b"test_secret_key_32_bytes_long!!!";
        let user_id = "user_123";
        let email = "test@example.com";

        let token = generate_access_token(user_id, email, secret, Some(15)).unwrap();
        let claims = verify_access_token(&token, secret).unwrap();

        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.email, email);
        assert_eq!(claims.token_type, "access");
    }

    #[test]
    fn test_refresh_token() {
        let secret = b"test_secret_key_32_bytes_long!!!";
        let user_id = "user_123";
        let email = "test@example.com";
        let session_id = "session_456";

        let token = generate_refresh_token(user_id, email, session_id, secret, Some(7)).unwrap();
        let claims = verify_refresh_token(&token, secret).unwrap();

        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.session_id, Some(session_id.to_string()));
    }

    #[test]
    fn test_secure_token_generation() {
        let token1 = generate_secure_token(32);
        let token2 = generate_secure_token(32);

        assert_ne!(token1, token2);
        assert!(!token1.is_empty());
    }

    #[test]
    fn test_password_validation() {
        // Valid password
        assert!(validate_password_strength("SecureP@ss1", 8).is_ok());

        // Too short
        assert!(validate_password_strength("Short1", 8).is_err());

        // No uppercase
        assert!(validate_password_strength("lowercase1", 8).is_err());

        // No lowercase
        assert!(validate_password_strength("UPPERCASE1", 8).is_err());

        // No digit
        assert!(validate_password_strength("NoDigits!", 8).is_err());
    }

    #[test]
    fn test_email_validation() {
        assert!(validate_email("test@example.com").is_ok());
        assert!(validate_email("user.name@domain.org").is_ok());

        assert!(validate_email("").is_err());
        assert!(validate_email("no_at_sign").is_err());
        assert!(validate_email("@no_local.com").is_err());
        assert!(validate_email("no_domain@").is_err());
    }
}
