//! Application settings storage.
//!
//! Provides key-value storage for application settings with JSON serialization.

use anyhow::Result;
use chrono::Utc;
use serde::{de::DeserializeOwned, Serialize};
use sqlx::SqlitePool;

use super::Setting;

/// Gets a setting value by key.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Setting key to look up
///
/// # Returns
/// The setting value as a string if found, None otherwise
pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>> {
    let value = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;

    Ok(value)
}

/// Gets a setting value and deserializes it from JSON.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Setting key to look up
///
/// # Returns
/// The deserialized value if found and valid, None otherwise
pub async fn get_setting_json<T: DeserializeOwned>(pool: &SqlitePool, key: &str) -> Result<Option<T>> {
    let value = get_setting(pool, key).await?;

    match value {
        Some(json_str) => {
            let parsed = serde_json::from_str(&json_str)?;
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

/// Sets a setting value.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Setting key
/// * `value` - Setting value as a string
pub async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<()> {
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO settings (key, value, updated_at)
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

/// Sets a setting value by serializing it to JSON.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Setting key
/// * `value` - Value to serialize and store
pub async fn set_setting_json<T: Serialize>(pool: &SqlitePool, key: &str, value: &T) -> Result<()> {
    let json_str = serde_json::to_string(value)?;
    set_setting(pool, key, &json_str).await
}

/// Deletes a setting by key.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Setting key to delete
pub async fn delete_setting(pool: &SqlitePool, key: &str) -> Result<()> {
    sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await?;

    Ok(())
}

/// Gets all settings from the database.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Vector of all settings
pub async fn get_all_settings(pool: &SqlitePool) -> Result<Vec<Setting>> {
    let settings = sqlx::query_as::<_, (String, String, chrono::DateTime<Utc>)>(
        "SELECT key, value, updated_at FROM settings ORDER BY key",
    )
    .fetch_all(pool)
    .await?;

    Ok(settings
        .into_iter()
        .map(|(key, value, updated_at)| Setting {
            key,
            value,
            updated_at,
        })
        .collect())
}

/// Checks if a setting exists.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `key` - Setting key to check
///
/// # Returns
/// True if the setting exists, false otherwise
pub async fn setting_exists(pool: &SqlitePool, key: &str) -> Result<bool> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM settings WHERE key = ?")
        .bind(key)
        .fetch_one(pool)
        .await?;

    Ok(count > 0)
}

/// Gets multiple settings by keys.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `keys` - Vector of setting keys to look up
///
/// # Returns
/// Vector of (key, value) tuples for found settings
pub async fn get_settings(pool: &SqlitePool, keys: &[&str]) -> Result<Vec<(String, String)>> {
    if keys.is_empty() {
        return Ok(Vec::new());
    }

    // Build a query with placeholders for each key
    let placeholders: Vec<&str> = keys.iter().map(|_| "?").collect();
    let query = format!(
        "SELECT key, value FROM settings WHERE key IN ({})",
        placeholders.join(", ")
    );

    let mut query_builder = sqlx::query_as::<_, (String, String)>(&query);
    for key in keys {
        query_builder = query_builder.bind(*key);
    }

    let settings = query_builder.fetch_all(pool).await?;
    Ok(settings)
}

/// Deletes multiple settings by keys.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `keys` - Vector of setting keys to delete
///
/// # Returns
/// Number of settings deleted
pub async fn delete_settings(pool: &SqlitePool, keys: &[&str]) -> Result<u64> {
    if keys.is_empty() {
        return Ok(0);
    }

    let placeholders: Vec<&str> = keys.iter().map(|_| "?").collect();
    let query = format!(
        "DELETE FROM settings WHERE key IN ({})",
        placeholders.join(", ")
    );

    let mut query_builder = sqlx::query(&query);
    for key in keys {
        query_builder = query_builder.bind(*key);
    }

    let result = query_builder.execute(pool).await?;
    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use sqlx::sqlite::SqlitePoolOptions;

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestConfig {
        theme: String,
        notifications: bool,
    }

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
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
    async fn test_set_and_get_setting() {
        let pool = setup_test_db().await;

        set_setting(&pool, "theme", "dark").await.unwrap();

        let value = get_setting(&pool, "theme").await.unwrap();
        assert_eq!(value, Some("dark".to_string()));
    }

    #[tokio::test]
    async fn test_set_and_get_json_setting() {
        let pool = setup_test_db().await;

        let config = TestConfig {
            theme: "dark".to_string(),
            notifications: true,
        };

        set_setting_json(&pool, "config", &config).await.unwrap();

        let fetched: Option<TestConfig> = get_setting_json(&pool, "config").await.unwrap();
        assert_eq!(fetched, Some(config));
    }

    #[tokio::test]
    async fn test_delete_setting() {
        let pool = setup_test_db().await;

        set_setting(&pool, "temp", "value").await.unwrap();
        assert!(setting_exists(&pool, "temp").await.unwrap());

        delete_setting(&pool, "temp").await.unwrap();
        assert!(!setting_exists(&pool, "temp").await.unwrap());
    }
}
