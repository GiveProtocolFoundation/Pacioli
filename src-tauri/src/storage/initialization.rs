//! First-run initialization and app state management.
//!
//! Handles automatic initialization on first run, including:
//! - Default profile creation
//! - App state tracking (uninitialized, locked, unlocked)

use anyhow::Result;
use chrono::Utc;
use sqlx::SqlitePool;

use super::{profile_store, AppState, ProfileInput};

/// Key for tracking app initialization state.
const APP_INITIALIZED_KEY: &str = "app_initialized";
/// Key for tracking if password is set.
const PASSWORD_SET_KEY: &str = "password_set";
/// Key for storing password hash.
const PASSWORD_HASH_KEY: &str = "password_hash";

/// Result of initialization check.
#[derive(Debug, Clone, PartialEq)]
pub enum InitResult {
    /// App was just initialized (first run).
    JustInitialized {
        /// The ID of the created default profile.
        profile_id: String,
    },
    /// App was already initialized.
    AlreadyInitialized,
}

/// Ensures the app is initialized, creating a default profile if needed.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// InitResult indicating whether initialization just occurred or was already done
pub async fn ensure_initialized(pool: &SqlitePool) -> Result<InitResult> {
    // Check if app is already initialized
    let initialized = get_metadata(pool, APP_INITIALIZED_KEY).await?;

    if initialized.as_deref() == Some("true") {
        return Ok(InitResult::AlreadyInitialized);
    }

    // Check if any profiles exist (handles case where metadata is missing but data exists)
    let profile_count = profile_store::get_profile_count(pool).await?;

    if profile_count > 0 {
        // Mark as initialized since profiles exist
        set_metadata(pool, APP_INITIALIZED_KEY, "true").await?;
        return Ok(InitResult::AlreadyInitialized);
    }

    // First run - create default profile
    let default_profile = profile_store::create_profile(
        pool,
        ProfileInput {
            name: "Default Profile".to_string(),
            avatar_url: None,
            is_default: Some(true),
        },
    )
    .await?;

    // Mark as initialized
    set_metadata(pool, APP_INITIALIZED_KEY, "true").await?;

    Ok(InitResult::JustInitialized {
        profile_id: default_profile.id,
    })
}

/// Gets the current app state.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// The current AppState
pub async fn get_app_state(pool: &SqlitePool) -> Result<AppState> {
    // Check if initialized
    let initialized = get_metadata(pool, APP_INITIALIZED_KEY).await?;

    if initialized.as_deref() != Some("true") {
        // Also check for existing profiles
        let profile_count = profile_store::get_profile_count(pool).await?;
        if profile_count == 0 {
            return Ok(AppState::Uninitialized);
        }
    }

    // Check if password is set
    let password_set = get_metadata(pool, PASSWORD_SET_KEY).await?;

    if password_set.as_deref() == Some("true") {
        // Password is set - check if unlocked (this would be tracked in-memory, not in DB)
        // For now, we return Locked if password is set - the unlock state is managed by the caller
        return Ok(AppState::Locked);
    }

    Ok(AppState::Unlocked)
}

/// Resets the app to uninitialized state.
///
/// This deletes all data and resets the app as if it were a fresh install.
/// Use with extreme caution!
///
/// # Arguments
/// * `pool` - Database connection pool
pub async fn reset_app(pool: &SqlitePool) -> Result<()> {
    let mut tx = pool.begin().await?;

    // Delete all profiles (wallets and transactions cascade)
    sqlx::query("DELETE FROM profiles")
        .execute(&mut *tx)
        .await?;

    // Delete all settings
    sqlx::query("DELETE FROM settings")
        .execute(&mut *tx)
        .await?;

    // Reset app metadata
    sqlx::query("DELETE FROM app_metadata WHERE key IN (?, ?, ?)")
        .bind(APP_INITIALIZED_KEY)
        .bind(PASSWORD_SET_KEY)
        .bind(PASSWORD_HASH_KEY)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(())
}

/// Gets a value from app_metadata table.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Metadata key to look up
///
/// # Returns
/// The value if found, None otherwise
pub async fn get_metadata(pool: &SqlitePool, key: &str) -> Result<Option<String>> {
    let value = sqlx::query_scalar::<_, String>("SELECT value FROM app_metadata WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;

    Ok(value)
}

/// Sets a value in app_metadata table.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Metadata key
/// * `value` - Value to store
pub async fn set_metadata(pool: &SqlitePool, key: &str, value: &str) -> Result<()> {
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO app_metadata (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(key)
    .bind(value)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}

/// Deletes a value from app_metadata table.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Metadata key to delete
pub async fn delete_metadata(pool: &SqlitePool, key: &str) -> Result<()> {
    sqlx::query("DELETE FROM app_metadata WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

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
                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
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

        sqlx::query(
            r#"
            CREATE TABLE app_metadata (
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
    async fn test_first_run_initialization() {
        let pool = setup_test_db().await;

        // Should be uninitialized initially
        let state = get_app_state(&pool).await.unwrap();
        assert_eq!(state, AppState::Uninitialized);

        // Initialize
        let result = ensure_initialized(&pool).await.unwrap();
        assert!(matches!(result, InitResult::JustInitialized { .. }));

        // Should be unlocked now
        let state = get_app_state(&pool).await.unwrap();
        assert_eq!(state, AppState::Unlocked);

        // Second call should return AlreadyInitialized
        let result = ensure_initialized(&pool).await.unwrap();
        assert_eq!(result, InitResult::AlreadyInitialized);
    }

    #[tokio::test]
    async fn test_reset_app() {
        let pool = setup_test_db().await;

        // Initialize
        ensure_initialized(&pool).await.unwrap();

        // Verify initialized
        let state = get_app_state(&pool).await.unwrap();
        assert_eq!(state, AppState::Unlocked);

        // Reset
        reset_app(&pool).await.unwrap();

        // Should be uninitialized
        let state = get_app_state(&pool).await.unwrap();
        assert_eq!(state, AppState::Uninitialized);
    }

    #[tokio::test]
    async fn test_metadata_operations() {
        let pool = setup_test_db().await;

        // Set and get
        set_metadata(&pool, "test_key", "test_value").await.unwrap();
        let value = get_metadata(&pool, "test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));

        // Update
        set_metadata(&pool, "test_key", "new_value").await.unwrap();
        let value = get_metadata(&pool, "test_key").await.unwrap();
        assert_eq!(value, Some("new_value".to_string()));

        // Delete
        delete_metadata(&pool, "test_key").await.unwrap();
        let value = get_metadata(&pool, "test_key").await.unwrap();
        assert_eq!(value, None);
    }
}
