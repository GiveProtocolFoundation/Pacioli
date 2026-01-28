//! Data import functionality.
//!
//! Provides import of user data from encrypted JSON files.

use anyhow::{anyhow, Result};
use sqlx::SqlitePool;
use std::path::Path;

use super::{
    encryption::{decrypt, EncryptedData},
    profile_store, settings_store, wallet_store, ExportFile, ExportPayload, ImportPreview,
    ImportResult, ProfileInput, WalletInput,
};

/// Previews an import file without actually importing.
///
/// # Arguments
/// * `path` - Path to the import file
///
/// # Returns
/// Preview information about the import
pub async fn preview_import(path: &Path) -> Result<ImportPreview> {
    let content = std::fs::read_to_string(path)?;
    preview_import_string(&content, None).await
}

/// Previews an import from a string.
///
/// # Arguments
/// * `content` - The JSON content to preview
/// * `password` - Password if the content is encrypted
///
/// # Returns
/// Preview information about the import
pub async fn preview_import_string(content: &str, password: Option<&str>) -> Result<ImportPreview> {
    let export_file: ExportFile = serde_json::from_str(content)?;

    if export_file.encrypted {
        if password.is_none() {
            // Return basic info without decrypting
            return Ok(ImportPreview {
                version: export_file.version,
                exported_at: export_file.exported_at,
                encrypted: true,
                profile_count: 0,
                wallet_count: 0,
                transaction_count: 0,
            });
        }

        // Decrypt and parse
        let payload = decrypt_payload(&export_file, password.unwrap())?;

        Ok(ImportPreview {
            version: export_file.version,
            exported_at: export_file.exported_at,
            encrypted: true,
            profile_count: payload.profiles.len(),
            wallet_count: payload.wallets.len(),
            transaction_count: 0, // We don't export transactions yet
        })
    } else {
        let payload: ExportPayload = serde_json::from_str(&export_file.data)?;

        Ok(ImportPreview {
            version: export_file.version,
            exported_at: export_file.exported_at,
            encrypted: false,
            profile_count: payload.profiles.len(),
            wallet_count: payload.wallets.len(),
            transaction_count: 0,
        })
    }
}

/// Imports data from a file.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `path` - Path to the import file
/// * `password` - Password if the file is encrypted
///
/// # Returns
/// Result of the import operation
pub async fn import_data(
    pool: &SqlitePool,
    path: &Path,
    password: Option<&str>,
) -> Result<ImportResult> {
    let content = std::fs::read_to_string(path)?;
    import_from_string(pool, &content, password).await
}

/// Imports data from a JSON string.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `content` - The JSON content to import
/// * `password` - Password if the content is encrypted
///
/// # Returns
/// Result of the import operation
pub async fn import_from_string(
    pool: &SqlitePool,
    content: &str,
    password: Option<&str>,
) -> Result<ImportResult> {
    let export_file: ExportFile = serde_json::from_str(content)?;

    let payload = if export_file.encrypted {
        let pwd = password.ok_or_else(|| anyhow!("Password required for encrypted import"))?;
        decrypt_payload(&export_file, pwd)?
    } else {
        serde_json::from_str(&export_file.data)?
    };

    import_payload(pool, &payload).await
}

/// Imports an ExportPayload into the database.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `payload` - The payload to import
///
/// # Returns
/// Result of the import operation
async fn import_payload(pool: &SqlitePool, payload: &ExportPayload) -> Result<ImportResult> {
    let mut profiles_imported = 0;
    let mut wallets_imported = 0;
    let mut warnings = Vec::new();

    // Import profiles
    for profile in &payload.profiles {
        let input = ProfileInput {
            name: profile.name.clone(),
            avatar_url: profile.avatar_url.clone(),
            is_default: Some(profile.is_default),
        };

        match profile_store::create_profile(pool, input).await {
            Ok(_) => profiles_imported += 1,
            Err(e) => warnings.push(format!(
                "Failed to import profile '{}': {}",
                profile.name, e
            )),
        }
    }

    // Import wallets
    // We need to map old profile IDs to new ones
    // For now, we'll import wallets with the first available profile
    let profiles = profile_store::get_all_profiles(pool).await?;
    let default_profile_id = profiles
        .first()
        .map(|p| p.id.clone())
        .ok_or_else(|| anyhow!("No profile available to import wallets into"))?;

    for wallet in &payload.wallets {
        let input = WalletInput {
            profile_id: default_profile_id.clone(),
            address: wallet.address.clone(),
            chain: wallet.chain.clone(),
            nickname: wallet.nickname.clone(),
        };

        // Check if wallet already exists
        let exists =
            wallet_store::wallet_exists(pool, &default_profile_id, &wallet.address, &wallet.chain)
                .await?;

        if exists {
            warnings.push(format!(
                "Wallet {} on {} already exists, skipping",
                wallet.address, wallet.chain
            ));
            continue;
        }

        match wallet_store::create_wallet(pool, input).await {
            Ok(_) => wallets_imported += 1,
            Err(e) => warnings.push(format!(
                "Failed to import wallet '{}': {}",
                wallet.address, e
            )),
        }
    }

    // Import settings
    for setting in &payload.settings {
        if let Err(e) = settings_store::set_setting(pool, &setting.key, &setting.value).await {
            warnings.push(format!("Failed to import setting '{}': {}", setting.key, e));
        }
    }

    Ok(ImportResult {
        profiles_imported,
        wallets_imported,
        transactions_imported: 0,
        warnings,
    })
}

/// Decrypts an encrypted export payload.
fn decrypt_payload(export_file: &ExportFile, password: &str) -> Result<ExportPayload> {
    let salt = export_file
        .salt
        .as_ref()
        .ok_or_else(|| anyhow!("Missing salt for encrypted data"))?;
    let nonce = export_file
        .nonce
        .as_ref()
        .ok_or_else(|| anyhow!("Missing nonce for encrypted data"))?;

    let encrypted = EncryptedData {
        salt: salt.clone(),
        nonce: nonce.clone(),
        ciphertext: export_file.data.clone(),
    };

    let decrypted_bytes = decrypt(&encrypted, password)?;
    let decrypted_str = String::from_utf8(decrypted_bytes)?;
    let payload: ExportPayload = serde_json::from_str(&decrypted_str)?;

    Ok(payload)
}

/// Validates import file format.
///
/// # Arguments
/// * `content` - The JSON content to validate
///
/// # Returns
/// Ok if the format is valid
#[allow(dead_code)]
pub fn validate_import_format(content: &str) -> Result<()> {
    let export_file: ExportFile =
        serde_json::from_str(content).map_err(|e| anyhow!("Invalid export file format: {}", e))?;

    // Check version compatibility
    if export_file.version != "1.0" {
        return Err(anyhow!(
            "Unsupported export version: {}. Expected 1.0",
            export_file.version
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{export, ProfileInput};
    use sqlx::sqlite::SqlitePoolOptions;
    use tempfile::tempdir;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

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
                updated_at DATETIME,
                UNIQUE(profile_id, address, chain)
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
    async fn test_import_unencrypted() {
        let source_pool = setup_test_db().await;
        let dest_pool = setup_test_db().await;

        // Create data in source
        profile_store::create_profile(
            &source_pool,
            ProfileInput {
                name: "Exported Profile".to_string(),
                avatar_url: None,
                is_default: Some(true),
            },
        )
        .await
        .unwrap();

        settings_store::set_setting(&source_pool, "theme", "dark")
            .await
            .unwrap();

        // Export
        let export_str = export::export_to_string(&source_pool, None).await.unwrap();

        // Preview
        let preview = preview_import_string(&export_str, None).await.unwrap();
        assert_eq!(preview.profile_count, 1);
        assert!(!preview.encrypted);

        // Import
        let result = import_from_string(&dest_pool, &export_str, None)
            .await
            .unwrap();
        assert_eq!(result.profiles_imported, 1);

        // Verify imported data
        let profiles = profile_store::get_all_profiles(&dest_pool).await.unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "Exported Profile");
    }

    #[tokio::test]
    async fn test_import_encrypted() {
        let source_pool = setup_test_db().await;
        let dest_pool = setup_test_db().await;

        profile_store::create_profile(
            &source_pool,
            ProfileInput {
                name: "Secret Profile".to_string(),
                avatar_url: None,
                is_default: None,
            },
        )
        .await
        .unwrap();

        let password = "TestPassword123";
        let export_str = export::export_to_string(&source_pool, Some(password))
            .await
            .unwrap();

        // Preview without password shows encrypted but no counts
        let preview = preview_import_string(&export_str, None).await.unwrap();
        assert!(preview.encrypted);
        assert_eq!(preview.profile_count, 0);

        // Preview with password shows counts
        let preview = preview_import_string(&export_str, Some(password))
            .await
            .unwrap();
        assert_eq!(preview.profile_count, 1);

        // Import
        let result = import_from_string(&dest_pool, &export_str, Some(password))
            .await
            .unwrap();
        assert_eq!(result.profiles_imported, 1);
    }

    #[tokio::test]
    async fn test_import_from_file() {
        let pool = setup_test_db().await;
        let temp_dir = tempdir().unwrap();
        let export_path = temp_dir.path().join("test_export.json");

        // Create a valid export file manually
        let export_file = ExportFile {
            version: "1.0".to_string(),
            exported_at: chrono::Utc::now(),
            encrypted: false,
            salt: None,
            nonce: None,
            data: serde_json::to_string(&ExportPayload {
                version: "1.0".to_string(),
                exported_at: chrono::Utc::now(),
                profiles: vec![],
                wallets: vec![],
                settings: vec![],
            })
            .unwrap(),
        };

        std::fs::write(&export_path, serde_json::to_string(&export_file).unwrap()).unwrap();

        let preview = preview_import(&export_path).await.unwrap();
        assert_eq!(preview.version, "1.0");
    }

    #[test]
    fn test_validate_import_format() {
        let valid = r#"{"version":"1.0","exported_at":"2025-01-26T00:00:00Z","encrypted":false,"salt":null,"nonce":null,"data":"{}"}"#;
        assert!(validate_import_format(valid).is_ok());

        let invalid_version = r#"{"version":"2.0","exported_at":"2025-01-26T00:00:00Z","encrypted":false,"salt":null,"nonce":null,"data":"{}"}"#;
        assert!(validate_import_format(invalid_version).is_err());

        let invalid_json = "not json";
        assert!(validate_import_format(invalid_json).is_err());
    }
}
