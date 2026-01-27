//! Offline-first storage layer for Pacioli.
//!
//! This module provides a decoupled storage system that operates independently
//! of any authentication mechanism. It supports:
//! - Profile-centric data organization
//! - Optional AES-256-GCM encryption at rest
//! - Export/import via encrypted JSON files
//! - First-run auto-initialization

/// BIP39 wordlist for recovery phrase generation.
pub mod bip39;
/// AES-256-GCM encryption utilities for data at rest.
pub mod encryption;
/// First-run initialization and app state management.
pub mod initialization;
/// Profile storage operations.
pub mod profile_store;
/// Application settings storage.
pub mod settings_store;
/// Wallet storage operations.
pub mod wallet_store;
/// Database security and password protection.
pub mod db_security;
/// Data export functionality.
pub mod export;
/// Data import functionality.
pub mod import;
/// Tauri commands for the storage layer.
pub mod commands;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents the application initialization state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AppState {
    /// First run - no profiles exist yet.
    Uninitialized,
    /// App is initialized but locked with password.
    Locked,
    /// App is initialized and unlocked (no password or password entered).
    Unlocked,
}

/// Profile data structure for storage.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Profile {
    /// Unique profile identifier (ULID).
    pub id: String,
    /// Display name for the profile.
    pub name: String,
    /// Optional avatar URL or base64 data.
    pub avatar_url: Option<String>,
    /// Whether this is the default profile.
    pub is_default: bool,
    /// Profile creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Input for creating or updating a profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInput {
    /// Display name for the profile.
    pub name: String,
    /// Optional avatar URL or base64 data.
    pub avatar_url: Option<String>,
    /// Whether this is the default profile.
    pub is_default: Option<bool>,
}

/// Wallet data structure for storage.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Wallet {
    /// Unique wallet identifier (ULID).
    pub id: String,
    /// Associated profile ID.
    pub profile_id: String,
    /// Wallet address.
    pub address: String,
    /// Blockchain chain identifier.
    pub chain: String,
    /// User-defined nickname.
    pub nickname: Option<String>,
    /// Whether this wallet is active for syncing.
    pub is_active: bool,
    /// Wallet creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Input for creating or updating a wallet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInput {
    /// Associated profile ID.
    pub profile_id: String,
    /// Wallet address.
    pub address: String,
    /// Blockchain chain identifier.
    pub chain: String,
    /// User-defined nickname.
    pub nickname: Option<String>,
}

/// Application setting key-value pair.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Setting {
    /// Setting key.
    pub key: String,
    /// Setting value (JSON string).
    pub value: String,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Result of an import operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    /// Number of profiles imported.
    pub profiles_imported: usize,
    /// Number of wallets imported.
    pub wallets_imported: usize,
    /// Number of transactions imported.
    pub transactions_imported: usize,
    /// Any warnings during import.
    pub warnings: Vec<String>,
}

/// Preview of data to be imported.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    /// Export file version.
    pub version: String,
    /// When the export was created.
    pub exported_at: DateTime<Utc>,
    /// Whether the export is encrypted.
    pub encrypted: bool,
    /// Number of profiles in the export.
    pub profile_count: usize,
    /// Number of wallets in the export.
    pub wallet_count: usize,
    /// Number of transactions in the export.
    pub transaction_count: usize,
}

/// Complete export payload containing all user data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportPayload {
    /// Export format version.
    pub version: String,
    /// Export timestamp.
    pub exported_at: DateTime<Utc>,
    /// All profiles.
    pub profiles: Vec<Profile>,
    /// All wallets.
    pub wallets: Vec<Wallet>,
    /// All settings.
    pub settings: Vec<Setting>,
}

/// Export file format with optional encryption.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFile {
    /// Export format version.
    pub version: String,
    /// Export timestamp.
    pub exported_at: DateTime<Utc>,
    /// Whether the data is encrypted.
    pub encrypted: bool,
    /// Salt for key derivation (base64, only if encrypted).
    pub salt: Option<String>,
    /// Nonce/IV for decryption (base64, only if encrypted).
    pub nonce: Option<String>,
    /// Data payload (JSON string if unencrypted, base64 ciphertext if encrypted).
    pub data: String,
}
