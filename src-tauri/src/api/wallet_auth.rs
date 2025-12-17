//! Wallet Authentication API Commands
//!
//! Provides Tauri commands for Web3 wallet-based authentication,
//! supporting both Substrate (sr25519) and EVM (secp256k1) wallets.

use crate::api::auth::{AuthResponse, User};
use crate::api::persistence::DatabaseState;
use crate::core::auth_helpers::{
    generate_access_token, generate_secure_token, generate_session_id, hash_token,
};
use crate::core::auth_state::AuthState;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sp_core::Pair;
use sqlx::FromRow;
use tauri::State;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Wallet types supported for authentication
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WalletType {
    /// Substrate wallet type using sr25519 cryptography.
    Substrate,
    /// EVM wallet type using secp256k1 cryptography.
    Evm,
}

impl std::fmt::Display for WalletType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WalletType::Substrate => write!(f, "substrate"),
            WalletType::Evm => write!(f, "evm"),
        }
    }
}

impl std::str::FromStr for WalletType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "substrate" => Ok(WalletType::Substrate),
            "evm" => Ok(WalletType::Evm),
            _ => Err(format!("Unknown wallet type: {}", s)),
        }
    }
}

/// A linked wallet for a user
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserWallet {
    /// Unique identifier for the user wallet.
    pub id: String,
    /// Identifier of the user who owns this wallet.
    pub user_id: String,
    /// The wallet's blockchain address.
    pub wallet_address: String,
    /// The wallet type (e.g., "substrate" or "evm").
    pub wallet_type: String,
    /// Optional blockchain chain identifier.
    pub chain: Option<String>,
    /// Optional user-defined name for the wallet.
    pub wallet_name: Option<String>,
    /// Optional source or platform of the wallet.
    pub wallet_source: Option<String>,
    /// Indicates if this wallet is the primary one for the user.
    pub is_primary: bool,
    /// Timestamp when the wallet was created.
    pub created_at: DateTime<Utc>,
    /// Optional timestamp when the wallet was last used.
    pub last_used_at: Option<DateTime<Utc>>,
}

/// Challenge for wallet sign-in
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletChallenge {
    /// Unique identifier for the challenge.
    pub id: String,
    /// Nonce value that must be signed by the wallet.
    pub nonce: String,
    /// The message constructed for signing.
    pub message: String,
    /// Expiration time of the challenge.
    pub expires_at: DateTime<Utc>,
}

/// Input for generating a wallet challenge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeRequest {
    /// The wallet address requesting the challenge.
    pub wallet_address: String,
    /// The type of wallet (e.g., "substrate" or "evm").
    pub wallet_type: String,
}

/// Input for verifying a wallet signature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifySignatureRequest {
    /// Identifier of the challenge being verified.
    pub challenge_id: String,
    /// Wallet signature over the challenge message.
    pub signature: String,
    /// The wallet address used for verification.
    pub wallet_address: String,
    /// Optional user-defined name of the wallet.
    pub wallet_name: Option<String>,
    /// Optional source or platform of the wallet.
    pub wallet_source: Option<String>,
}

/// Input for linking a wallet to an existing account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkWalletRequest {
    /// Access token of the existing user session.
    pub access_token: String,
    /// Identifier of the challenge used for linking.
    pub challenge_id: String,
    /// Signature of the challenge message by the wallet.
    pub signature: String,
    /// The wallet address to link.
    pub wallet_address: String,
    /// The type of wallet being linked.
    pub wallet_type: String,
    /// Optional blockchain chain identifier.
    pub chain: Option<String>,
    /// Optional user-defined name for the wallet.
    pub wallet_name: Option<String>,
    /// Optional source or platform of the wallet.
    pub wallet_source: Option<String>,
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_EXPIRY_SECONDS: i64 = 300; // 5 minutes

// ============================================================================
// Tauri Commands
// ============================================================================

/// Generate a challenge for wallet sign-in
///
/// Creates a unique nonce-based message that must be signed by the wallet.
/// The challenge expires after 5 minutes.
#[tauri::command]
pub async fn generate_wallet_challenge(
    db: State<'_, DatabaseState>,
    request: ChallengeRequest,
) -> Result<WalletChallenge, String> {
    let pool = &db.pool;
    let wallet_type: WalletType = request.wallet_type.parse()?;

    // Validate wallet address format
    validate_wallet_address(&request.wallet_address, &wallet_type)?;

    // Generate unique nonce and challenge ID
    let challenge_id = Uuid::new_v4().to_string();
    let nonce = generate_secure_token(16);
    let now = Utc::now();
    let expires_at = now + Duration::seconds(CHALLENGE_EXPIRY_SECONDS);

    // Create the message to be signed
    let message = create_sign_message(&request.wallet_address, &nonce, &wallet_type);

    // Store challenge in database
    sqlx::query(
        r#"
        INSERT INTO auth_challenges (id, nonce, wallet_address, wallet_type, message, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&challenge_id)
    .bind(&nonce)
    .bind(&request.wallet_address)
    .bind(wallet_type.to_string())
    .bind(&message)
    .bind(now)
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create challenge: {}", e))?;

    Ok(WalletChallenge {
        id: challenge_id,
        nonce,
        message,
        expires_at,
    })
}

/// Verify wallet signature and authenticate
///
/// Verifies the signature against the challenge message.
/// If the wallet is linked to an existing user, returns auth tokens.
/// If the wallet is new, creates a new user account.
#[tauri::command]
pub async fn verify_wallet_signature(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    request: VerifySignatureRequest,
) -> Result<AuthResponse, String> {
    let pool = &db.pool;

    // Fetch and validate challenge
    let challenge: Option<(String, String, String, String, Option<DateTime<Utc>>)> =
        sqlx::query_as(
            r#"
        SELECT nonce, wallet_address, wallet_type, message, used_at
        FROM auth_challenges
        WHERE id = ? AND expires_at > ?
        "#,
        )
        .bind(&request.challenge_id)
        .bind(Utc::now())
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let (_nonce, stored_address, wallet_type_str, message, used_at) =
        challenge.ok_or("Challenge not found or expired")?;

    // Check if challenge was already used
    if used_at.is_some() {
        return Err("Challenge has already been used".to_string());
    }

    // Verify address matches
    if !addresses_match(&stored_address, &request.wallet_address) {
        return Err("Wallet address mismatch".to_string());
    }

    let wallet_type: WalletType = wallet_type_str.parse()?;

    // Verify the signature
    verify_signature(
        &request.wallet_address,
        &message,
        &request.signature,
        &wallet_type,
    )?;

    // Mark challenge as used
    sqlx::query("UPDATE auth_challenges SET used_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(&request.challenge_id)
        .execute(pool)
        .await
        .ok();

    // Check if wallet is already linked to a user
    let existing_wallet: Option<(String,)> = sqlx::query_as(
        "SELECT user_id FROM user_wallet_auth WHERE wallet_address = ? AND wallet_type = ?",
    )
    .bind(&request.wallet_address)
    .bind(wallet_type.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let user_id = if let Some((uid,)) = existing_wallet {
        // Update last_used_at for existing wallet
        sqlx::query(
            "UPDATE user_wallet_auth SET last_used_at = ? WHERE wallet_address = ? AND wallet_type = ?",
        )
        .bind(Utc::now())
        .bind(&request.wallet_address)
        .bind(wallet_type.to_string())
        .execute(pool)
        .await
        .ok();

        uid
    } else {
        // Create new user with wallet auth
        create_user_with_wallet(
            pool,
            &request.wallet_address,
            &wallet_type,
            request.wallet_name.as_deref(),
            request.wallet_source.as_deref(),
        )
        .await?
    };

    // Get user email for token
    let user_email: (String,) = sqlx::query_as("SELECT email FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to get user: {}", e))?;

    // Update last login
    sqlx::query("UPDATE users SET last_login_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(&user_id)
        .execute(pool)
        .await
        .ok();

    // Log successful wallet login
    log_wallet_audit(pool, Some(&user_id), "wallet_login", "success", None).await;

    // Create session and return tokens
    create_wallet_session(&db, &auth, &user_id, &user_email.0).await
}

/// Link a wallet to an existing authenticated user
#[tauri::command]
pub async fn link_wallet_to_account(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    request: LinkWalletRequest,
) -> Result<UserWallet, String> {
    let pool = &db.pool;

    // Verify access token
    let claims = crate::core::auth_helpers::verify_access_token(
        &request.access_token,
        auth.get_jwt_secret(),
    )?;

    let wallet_type: WalletType = request.wallet_type.parse()?;

    // Validate wallet address
    validate_wallet_address(&request.wallet_address, &wallet_type)?;

    // Fetch and validate challenge
    let challenge: Option<(String, String, Option<DateTime<Utc>>)> = sqlx::query_as(
        r#"
        SELECT wallet_address, message, used_at
        FROM auth_challenges
        WHERE id = ? AND expires_at > ?
        "#,
    )
    .bind(&request.challenge_id)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (stored_address, message, used_at) = challenge.ok_or("Challenge not found or expired")?;

    if used_at.is_some() {
        return Err("Challenge has already been used".to_string());
    }

    if !addresses_match(&stored_address, &request.wallet_address) {
        return Err("Wallet address mismatch".to_string());
    }

    // Verify signature
    verify_signature(
        &request.wallet_address,
        &message,
        &request.signature,
        &wallet_type,
    )?;

    // Mark challenge as used
    sqlx::query("UPDATE auth_challenges SET used_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(&request.challenge_id)
        .execute(pool)
        .await
        .ok();

    // Check if wallet is already linked to any user
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT user_id FROM user_wallet_auth WHERE wallet_address = ? AND wallet_type = ?",
    )
    .bind(&request.wallet_address)
    .bind(wallet_type.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((existing_user_id,)) = existing {
        if existing_user_id == claims.sub {
            return Err("This wallet is already linked to your account".to_string());
        } else {
            return Err("This wallet is already linked to another account".to_string());
        }
    }

    // Check if user has any wallets to determine if this should be primary
    let wallet_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM user_wallet_auth WHERE user_id = ?")
            .bind(&claims.sub)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let is_primary = wallet_count.0 == 0;

    // Link wallet to user
    let wallet_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO user_wallet_auth (id, user_id, wallet_address, wallet_type, chain, wallet_name, wallet_source, is_primary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&wallet_id)
    .bind(&claims.sub)
    .bind(&request.wallet_address)
    .bind(wallet_type.to_string())
    .bind(&request.chain)
    .bind(&request.wallet_name)
    .bind(&request.wallet_source)
    .bind(is_primary)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to link wallet: {}", e))?;

    // Log wallet link
    log_wallet_audit(
        pool,
        Some(&claims.sub),
        "wallet_link",
        "success",
        Some(&format!(
            "Linked {} wallet: {}",
            wallet_type, &request.wallet_address
        )),
    )
    .await;

    Ok(UserWallet {
        id: wallet_id,
        user_id: claims.sub,
        wallet_address: request.wallet_address,
        wallet_type: wallet_type.to_string(),
        chain: request.chain,
        wallet_name: request.wallet_name,
        wallet_source: request.wallet_source,
        is_primary,
        created_at: now,
        last_used_at: None,
    })
}

/// Get all wallets linked to the authenticated user
#[tauri::command]
pub async fn get_user_wallets(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
) -> Result<Vec<UserWallet>, String> {
    let claims = crate::core::auth_helpers::verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    let wallets: Vec<UserWallet> = sqlx::query_as(
        r#"
        SELECT id, user_id, wallet_address, wallet_type, chain, wallet_name, wallet_source,
               is_primary, created_at, last_used_at
        FROM user_wallet_auth
        WHERE user_id = ?
        ORDER BY is_primary DESC, created_at ASC
        "#,
    )
    .bind(&claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get wallets: {}", e))?;

    Ok(wallets)
}

/// Unlink a wallet from the authenticated user
#[tauri::command]
pub async fn unlink_wallet(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    wallet_id: String,
) -> Result<(), String> {
    let claims = crate::core::auth_helpers::verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Verify wallet belongs to user
    let wallet: Option<(String, bool)> = sqlx::query_as(
        "SELECT wallet_address, is_primary FROM user_wallet_auth WHERE id = ? AND user_id = ?",
    )
    .bind(&wallet_id)
    .bind(&claims.sub)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (wallet_address, _is_primary) = wallet.ok_or("Wallet not found")?;

    // Check if user has password auth or other wallets
    let user_auth: (Option<String>, i64) = sqlx::query_as(
        r#"
        SELECT
            (SELECT password_hash FROM users WHERE id = ?),
            (SELECT COUNT(*) FROM user_wallet_auth WHERE user_id = ?)
        "#,
    )
    .bind(&claims.sub)
    .bind(&claims.sub)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (password_hash, wallet_count) = user_auth;

    // Ensure user has at least one auth method remaining
    if password_hash.is_none() && wallet_count <= 1 {
        return Err("Cannot remove your only authentication method".to_string());
    }

    // Remove wallet
    sqlx::query("DELETE FROM user_wallet_auth WHERE id = ?")
        .bind(&wallet_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to unlink wallet: {}", e))?;

    // Log wallet unlink
    log_wallet_audit(
        pool,
        Some(&claims.sub),
        "wallet_unlink",
        "success",
        Some(&format!("Unlinked wallet: {}", wallet_address)),
    )
    .await;

    Ok(())
}

/// Clean up expired challenges (maintenance command)
#[tauri::command]
pub async fn cleanup_expired_challenges(db: State<'_, DatabaseState>) -> Result<u64, String> {
    let pool = &db.pool;

    let result = sqlx::query("DELETE FROM auth_challenges WHERE expires_at < ?")
        .bind(Utc::now())
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to cleanup challenges: {}", e))?;

    Ok(result.rows_affected())
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Create the message to be signed by the wallet
fn create_sign_message(wallet_address: &str, nonce: &str, wallet_type: &WalletType) -> String {
    match wallet_type {
        WalletType::Substrate => {
            format!(
                "Sign this message to authenticate with Pacioli.\n\nWallet: {}\nNonce: {}\nTimestamp: {}",
                wallet_address,
                nonce,
                Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
            )
        }
        WalletType::Evm => {
            // EIP-4361 SIWE format
            format!(
                "pacioli.app wants you to sign in with your Ethereum account:\n{}\n\nSign in to Pacioli\n\nURI: tauri://localhost\nVersion: 1\nNonce: {}\nIssued At: {}",
                wallet_address,
                nonce,
                Utc::now().to_rfc3339()
            )
        }
    }
}

/// Validate wallet address format
fn validate_wallet_address(address: &str, wallet_type: &WalletType) -> Result<(), String> {
    match wallet_type {
        WalletType::Substrate => {
            // Substrate addresses are SS58 encoded, typically 47-48 characters
            if address.len() < 45 || address.len() > 50 {
                return Err("Invalid Substrate address format".to_string());
            }
            // Basic SS58 character validation
            if !address.chars().all(|c| c.is_alphanumeric()) {
                return Err("Invalid Substrate address characters".to_string());
            }
            Ok(())
        }
        WalletType::Evm => {
            // EVM addresses are 42 characters (0x + 40 hex chars)
            if !address.starts_with("0x") || address.len() != 42 {
                return Err("Invalid EVM address format".to_string());
            }
            // Validate hex characters
            if !address[2..].chars().all(|c| c.is_ascii_hexdigit()) {
                return Err("Invalid EVM address characters".to_string());
            }
            Ok(())
        }
    }
}

/// Compare wallet addresses (case-insensitive for EVM)
fn addresses_match(a: &str, b: &str) -> bool {
    a.to_lowercase() == b.to_lowercase()
}

/// Verify a signature from a wallet
fn verify_signature(
    address: &str,
    message: &str,
    signature: &str,
    wallet_type: &WalletType,
) -> Result<(), String> {
    match wallet_type {
        WalletType::Substrate => verify_substrate_signature(address, message, signature),
        WalletType::Evm => verify_evm_signature(address, message, signature),
    }
}

/// Verify a Substrate sr25519 signature
fn verify_substrate_signature(address: &str, message: &str, signature: &str) -> Result<(), String> {
    use sp_core::{crypto::Ss58Codec, sr25519};

    // Decode the SS58 address to get the public key
    let public_key = sr25519::Public::from_ss58check(address)
        .map_err(|e| format!("Invalid Substrate address: {:?}", e))?;

    // Decode the hex signature
    let sig_bytes = hex::decode(signature.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid signature hex: {}", e))?;

    if sig_bytes.len() != 64 {
        return Err("Invalid signature length for sr25519".to_string());
    }

    let signature = sr25519::Signature::from_raw(
        sig_bytes
            .try_into()
            .map_err(|_| "Failed to convert signature bytes")?,
    );

    // Substrate wraps messages with a prefix
    let wrapped_message = format!("<Bytes>{}</Bytes>", message);

    // Verify signature
    if sp_core::sr25519::Pair::verify(&signature, wrapped_message.as_bytes(), &public_key) {
        Ok(())
    } else {
        // Also try without wrapping (some wallets don't wrap)
        if sp_core::sr25519::Pair::verify(&signature, message.as_bytes(), &public_key) {
            Ok(())
        } else {
            Err("Invalid signature".to_string())
        }
    }
}

/// Verify an EVM secp256k1 signature
fn verify_evm_signature(address: &str, message: &str, signature: &str) -> Result<(), String> {
    use sha3::{Digest, Keccak256};

    // Decode signature
    let sig_bytes = hex::decode(signature.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid signature hex: {}", e))?;

    if sig_bytes.len() != 65 {
        return Err("Invalid signature length for EVM (expected 65 bytes)".to_string());
    }

    // EIP-191 personal message prefix
    let prefixed_message = format!("\x19Ethereum Signed Message:\n{}{}", message.len(), message);
    let message_hash = Keccak256::digest(prefixed_message.as_bytes());

    // Split signature into r, s, v
    let r = &sig_bytes[0..32];
    let s = &sig_bytes[32..64];
    let v = sig_bytes[64];

    // Normalize v (some wallets use 27/28, others use 0/1)
    let recovery_id = if v >= 27 { v - 27 } else { v };

    // Use secp256k1 for recovery
    let secp = secp256k1::Secp256k1::new();
    let recovery_id = secp256k1::ecdsa::RecoveryId::from_i32(recovery_id as i32)
        .map_err(|_| "Invalid recovery id")?;

    let mut sig_data = [0u8; 64];
    sig_data[0..32].copy_from_slice(r);
    sig_data[32..64].copy_from_slice(s);

    let recoverable_sig =
        secp256k1::ecdsa::RecoverableSignature::from_compact(&sig_data, recovery_id)
            .map_err(|e| format!("Invalid signature: {:?}", e))?;

    let msg = secp256k1::Message::from_digest_slice(&message_hash)
        .map_err(|e| format!("Invalid message hash: {:?}", e))?;

    let recovered_pubkey = secp
        .recover_ecdsa(&msg, &recoverable_sig)
        .map_err(|e| format!("Failed to recover public key: {:?}", e))?;

    // Compute address from public key
    let pubkey_bytes = recovered_pubkey.serialize_uncompressed();
    let pubkey_hash = Keccak256::digest(&pubkey_bytes[1..]); // Skip the 0x04 prefix
    let recovered_address = format!("0x{}", hex::encode(&pubkey_hash[12..]));

    // Compare addresses (case-insensitive)
    if recovered_address.to_lowercase() == address.to_lowercase() {
        Ok(())
    } else {
        Err("Signature does not match address".to_string())
    }
}

/// Create a new user account with wallet authentication
async fn create_user_with_wallet(
    pool: &sqlx::SqlitePool,
    wallet_address: &str,
    wallet_type: &WalletType,
    wallet_name: Option<&str>,
    wallet_source: Option<&str>,
) -> Result<String, String> {
    let user_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Generate a placeholder email from wallet address
    let email = format!(
        "{}@wallet.pacioli.local",
        &wallet_address[..12.min(wallet_address.len())]
    )
    .to_lowercase();

    // Default display name
    let display_name = wallet_name.map(String::from).unwrap_or_else(|| {
        format!(
            "{} Wallet",
            match wallet_type {
                WalletType::Substrate => "Substrate",
                WalletType::Evm => "Ethereum",
            }
        )
    });

    // Create user
    sqlx::query(
        r#"
        INSERT INTO users (id, email, display_name, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
        "#,
    )
    .bind(&user_id)
    .bind(&email)
    .bind(&display_name)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create user: {}", e))?;

    // Create default profile
    let profile_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO profiles (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        "#,
    )
    .bind(&profile_id)
    .bind(format!("{}'s Workspace", display_name))
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create profile: {}", e))?;

    // Assign owner role
    let role_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO user_profile_roles (id, user_id, profile_id, role, status, accepted_at, created_at, updated_at)
        VALUES (?, ?, ?, 'owner', 'active', ?, ?, ?)
        "#,
    )
    .bind(&role_id)
    .bind(&user_id)
    .bind(&profile_id)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to assign role: {}", e))?;

    // Link wallet to user
    let wallet_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO user_wallet_auth (id, user_id, wallet_address, wallet_type, wallet_name, wallet_source, is_primary, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        "#,
    )
    .bind(&wallet_id)
    .bind(&user_id)
    .bind(wallet_address)
    .bind(wallet_type.to_string())
    .bind(wallet_name)
    .bind(wallet_source)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to link wallet: {}", e))?;

    Ok(user_id)
}

/// Create session and return auth tokens for wallet login
async fn create_wallet_session(
    db: &State<'_, DatabaseState>,
    auth: &State<'_, AuthState>,
    user_id: &str,
    email: &str,
) -> Result<AuthResponse, String> {
    let pool = &db.pool;
    let session_id = generate_session_id();
    let now = Utc::now();
    let expires_at = now + Duration::days(7);

    // Generate tokens
    let access_token = generate_access_token(user_id, email, auth.get_jwt_secret(), Some(15))?;

    let refresh_token = crate::core::auth_helpers::generate_refresh_token(
        user_id,
        email,
        &session_id,
        auth.get_jwt_secret(),
        Some(7),
    )?;

    // Store session
    sqlx::query(
        r#"
        INSERT INTO sessions (id, user_id, refresh_token_hash, device_name, device_type, expires_at, created_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&session_id)
    .bind(user_id)
    .bind(hash_token(&refresh_token))
    .bind("Wallet")
    .bind("desktop")
    .bind(expires_at)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create session: {}", e))?;

    // Cache session
    auth.cache_session(&session_id, user_id, email);

    // Get user
    let user = get_user_by_id(pool, user_id).await?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        user,
        expires_in: 15 * 60,
    })
}

/// Get user by ID
async fn get_user_by_id(pool: &sqlx::SqlitePool, user_id: &str) -> Result<User, String> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, email_verified, display_name, avatar_url, status,
               two_factor_enabled, last_login_at, created_at, updated_at
        FROM users WHERE id = ?
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("User not found: {}", e))
}

/// Log wallet authentication audit event
async fn log_wallet_audit(
    pool: &sqlx::SqlitePool,
    user_id: Option<&str>,
    event_type: &str,
    event_status: &str,
    event_details: Option<&str>,
) {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO auth_audit_log (id, user_id, event_type, event_status, event_details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(user_id)
    .bind(event_type)
    .bind(event_status)
    .bind(event_details)
    .bind(Utc::now())
    .execute(pool)
    .await
    .ok();
}
