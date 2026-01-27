//! Data export functionality.
//!
//! Provides export of all user data to encrypted JSON files.

use anyhow::Result;
use chrono::Utc;
use sqlx::SqlitePool;
use std::path::Path;

use super::{
    encryption::encrypt,
    profile_store, settings_store, wallet_store, ExportFile, ExportPayload,
};

/// Current export format version.
const EXPORT_VERSION: &str = "1.0";

/// Exports all data to a JSON file.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `path` - Path to write the export file
/// * `password` - Optional password to encrypt the export
///
/// # Returns
/// Ok if the export was successful
pub async fn export_data(
    pool: &SqlitePool,
    path: &Path,
    password: Option<&str>,
) -> Result<()> {
    // Gather all data
    let profiles = profile_store::get_all_profiles(pool).await?;
    let wallets = wallet_store::get_all_wallets(pool).await?;
    let settings = settings_store::get_all_settings(pool).await?;

    let payload = ExportPayload {
        version: EXPORT_VERSION.to_string(),
        exported_at: Utc::now(),
        profiles,
        wallets,
        settings,
    };

    // Serialize the payload
    let payload_json = serde_json::to_string_pretty(&payload)?;

    // Create export file
    let export_file = match password {
        Some(pwd) => {
            // Encrypt the payload
            let encrypted = encrypt(payload_json.as_bytes(), pwd)?;

            ExportFile {
                version: EXPORT_VERSION.to_string(),
                exported_at: Utc::now(),
                encrypted: true,
                salt: Some(encrypted.salt),
                nonce: Some(encrypted.nonce),
                data: encrypted.ciphertext,
            }
        }
        None => {
            // Store unencrypted
            ExportFile {
                version: EXPORT_VERSION.to_string(),
                exported_at: Utc::now(),
                encrypted: false,
                salt: None,
                nonce: None,
                data: payload_json,
            }
        }
    };

    // Write to file
    let export_json = serde_json::to_string_pretty(&export_file)?;
    std::fs::write(path, export_json)?;

    Ok(())
}

/// Exports data to a JSON string (for testing or in-memory use).
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `password` - Optional password to encrypt the export
///
/// # Returns
/// The export as a JSON string
pub async fn export_to_string(pool: &SqlitePool, password: Option<&str>) -> Result<String> {
    // Gather all data
    let profiles = profile_store::get_all_profiles(pool).await?;
    let wallets = wallet_store::get_all_wallets(pool).await?;
    let settings = settings_store::get_all_settings(pool).await?;

    let payload = ExportPayload {
        version: EXPORT_VERSION.to_string(),
        exported_at: Utc::now(),
        profiles,
        wallets,
        settings,
    };

    // Serialize the payload
    let payload_json = serde_json::to_string_pretty(&payload)?;

    // Create export file
    let export_file = match password {
        Some(pwd) => {
            let encrypted = encrypt(payload_json.as_bytes(), pwd)?;

            ExportFile {
                version: EXPORT_VERSION.to_string(),
                exported_at: Utc::now(),
                encrypted: true,
                salt: Some(encrypted.salt),
                nonce: Some(encrypted.nonce),
                data: encrypted.ciphertext,
            }
        }
        None => ExportFile {
            version: EXPORT_VERSION.to_string(),
            exported_at: Utc::now(),
            encrypted: false,
            salt: None,
            nonce: None,
            data: payload_json,
        },
    };

    Ok(serde_json::to_string_pretty(&export_file)?)
}

/// Gets export statistics without actually exporting.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Tuple of (profile_count, wallet_count, settings_count)
pub async fn get_export_stats(pool: &SqlitePool) -> Result<(usize, usize, usize)> {
    let profiles = profile_store::get_all_profiles(pool).await?;
    let wallets = wallet_store::get_all_wallets(pool).await?;
    let settings = settings_store::get_all_settings(pool).await?;

    Ok((profiles.len(), wallets.len(), settings.len()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::ProfileInput;
    use sqlx::sqlite::SqlitePoolOptions;
    use tempfile::tempdir;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        // Create required tables
        sqlx::query(
            r#"
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar_url TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            r#"
            CREATE TABLE profile_defaults (
                profile_id TEXT PRIMARY KEY,
                is_default BOOLEAN NOT NULL DEFAULT FALSE
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            r#"
            CREATE TABLE wallets (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                address TEXT NOT NULL,
                chain TEXT NOT NULL,
                name TEXT,
                wallet_type TEXT NOT NULL DEFAULT 'standard',
                created_at DATETIME NOT NULL,
                updated_at DATETIME
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            r#"
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_export_unencrypted() {
        let pool = setup_test_db().await;

        // Create some test data
        profile_store::create_profile(
            &pool,
            ProfileInput {
                name: "Test Profile".to_string(),
                avatar_url: None,
                is_default: Some(true),
            },
        )
        .await
        .unwrap();

        settings_store::set_setting(&pool, "theme", "dark").await.unwrap();

        // Export to string
        let export = export_to_string(&pool, None).await.unwrap();
        let export_file: ExportFile = serde_json::from_str(&export).unwrap();

        assert!(!export_file.encrypted);
        assert_eq!(export_file.version, "1.0");
        assert!(export_file.salt.is_none());
        assert!(export_file.nonce.is_none());

        // Parse the data
        let payload: ExportPayload = serde_json::from_str(&export_file.data).unwrap();
        assert_eq!(payload.profiles.len(), 1);
        assert_eq!(payload.profiles[0].name, "Test Profile");
        assert_eq!(payload.settings.len(), 1);
    }

    #[tokio::test]
    async fn test_export_encrypted() {
        let pool = setup_test_db().await;

        profile_store::create_profile(
            &pool,
            ProfileInput {
                name: "Secret Profile".to_string(),
                avatar_url: None,
                is_default: None,
            },
        )
        .await
        .unwrap();

        let export = export_to_string(&pool, Some("TestPassword123")).await.unwrap();
        let export_file: ExportFile = serde_json::from_str(&export).unwrap();

        assert!(export_file.encrypted);
        assert!(export_file.salt.is_some());
        assert!(export_file.nonce.is_some());
    }

    #[tokio::test]
    async fn test_export_to_file() {
        let pool = setup_test_db().await;
        let temp_dir = tempdir().unwrap();
        let export_path = temp_dir.path().join("export.json");

        profile_store::create_profile(
            &pool,
            ProfileInput {
                name: "File Export Test".to_string(),
                avatar_url: None,
                is_default: None,
            },
        )
        .await
        .unwrap();

        export_data(&pool, &export_path, None).await.unwrap();

        assert!(export_path.exists());

        let content = std::fs::read_to_string(&export_path).unwrap();
        let export_file: ExportFile = serde_json::from_str(&content).unwrap();
        assert!(!export_file.encrypted);
    }
}
