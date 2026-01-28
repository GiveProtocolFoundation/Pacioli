//! Wallet storage operations.
//!
//! Provides CRUD operations for blockchain wallets associated with profiles.

use anyhow::{anyhow, Result};
use chrono::Utc;
use sqlx::SqlitePool;
use ulid::Ulid;

use super::{Wallet, WalletInput};

/// Creates a new wallet in the database.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `input` - Wallet creation input
///
/// # Returns
/// The created wallet with generated ID and timestamps
pub async fn create_wallet(pool: &SqlitePool, input: WalletInput) -> Result<Wallet> {
    let id = Ulid::new().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO wallets (id, profile_id, address, chain, name, wallet_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'standard', ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.profile_id)
    .bind(&input.address)
    .bind(&input.chain)
    .bind(&input.nickname)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(Wallet {
        id,
        profile_id: input.profile_id,
        address: input.address,
        chain: input.chain,
        nickname: input.nickname,
        is_active: true,
        created_at: now,
        updated_at: now,
    })
}

/// Retrieves a wallet by its ID.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Wallet ID to look up
///
/// # Returns
/// The wallet if found, None otherwise
pub async fn get_wallet(pool: &SqlitePool, id: &str) -> Result<Option<Wallet>> {
    let wallet = sqlx::query_as::<_, (String, String, String, String, Option<String>, chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>)>(
        r#"
        SELECT id, profile_id, address, chain, name, created_at, updated_at
        FROM wallets
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(wallet.map(|(id, profile_id, address, chain, nickname, created_at, updated_at)| Wallet {
        id,
        profile_id,
        address,
        chain,
        nickname,
        is_active: true,
        created_at,
        updated_at: updated_at.unwrap_or(created_at),
    }))
}

/// Retrieves all wallets for a specific profile.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `profile_id` - Profile ID to filter by
///
/// # Returns
/// Vector of wallets belonging to the profile
pub async fn get_wallets_by_profile(pool: &SqlitePool, profile_id: &str) -> Result<Vec<Wallet>> {
    let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>, chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>)>(
        r#"
        SELECT id, profile_id, address, chain, name, created_at, updated_at
        FROM wallets
        WHERE profile_id = ?
        ORDER BY created_at DESC
        "#,
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, profile_id, address, chain, nickname, created_at, updated_at)| Wallet {
            id,
            profile_id,
            address,
            chain,
            nickname,
            is_active: true,
            created_at,
            updated_at: updated_at.unwrap_or(created_at),
        })
        .collect())
}

/// Retrieves all wallets from the database.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Vector of all wallets
pub async fn get_all_wallets(pool: &SqlitePool) -> Result<Vec<Wallet>> {
    let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>, chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>)>(
        r#"
        SELECT id, profile_id, address, chain, name, created_at, updated_at
        FROM wallets
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, profile_id, address, chain, nickname, created_at, updated_at)| Wallet {
            id,
            profile_id,
            address,
            chain,
            nickname,
            is_active: true,
            created_at,
            updated_at: updated_at.unwrap_or(created_at),
        })
        .collect())
}

/// Updates an existing wallet.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Wallet ID to update
/// * `input` - Updated wallet data
///
/// # Returns
/// The updated wallet
pub async fn update_wallet(pool: &SqlitePool, id: &str, input: WalletInput) -> Result<Wallet> {
    let now = Utc::now();

    sqlx::query(
        r#"
        UPDATE wallets
        SET address = ?, chain = ?, name = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&input.address)
    .bind(&input.chain)
    .bind(&input.nickname)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;

    get_wallet(pool, id)
        .await?
        .ok_or_else(|| anyhow!("Wallet not found after update"))
}

/// Deletes a wallet by its ID.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Wallet ID to delete
pub async fn delete_wallet(pool: &SqlitePool, id: &str) -> Result<()> {
    sqlx::query("DELETE FROM wallets WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Deletes all wallets for a profile.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `profile_id` - Profile ID whose wallets to delete
///
/// # Returns
/// Number of wallets deleted
#[allow(dead_code)]
pub async fn delete_wallets_by_profile(pool: &SqlitePool, profile_id: &str) -> Result<u64> {
    let result = sqlx::query("DELETE FROM wallets WHERE profile_id = ?")
        .bind(profile_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected())
}

/// Checks if a wallet with the given address exists for a profile.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `profile_id` - Profile ID to check
/// * `address` - Wallet address to check
/// * `chain` - Blockchain chain
///
/// # Returns
/// True if the wallet exists, false otherwise
pub async fn wallet_exists(
    pool: &SqlitePool,
    profile_id: &str,
    address: &str,
    chain: &str,
) -> Result<bool> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM wallets WHERE profile_id = ? AND address = ? AND chain = ?",
    )
    .bind(profile_id)
    .bind(address)
    .bind(chain)
    .fetch_one(pool)
    .await?;

    Ok(count > 0)
}

/// Gets the count of wallets for a profile.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `profile_id` - Profile ID to count wallets for
///
/// # Returns
/// The number of wallets
#[allow(dead_code)]
pub async fn get_wallet_count(pool: &SqlitePool, profile_id: &str) -> Result<i64> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM wallets WHERE profile_id = ?")
        .bind(profile_id)
        .fetch_one(pool)
        .await?;

    Ok(count)
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

        sqlx::query(
            r#"
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
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
            CREATE TABLE wallets (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                address TEXT NOT NULL,
                chain TEXT NOT NULL,
                name TEXT,
                wallet_type TEXT NOT NULL DEFAULT 'standard',
                created_at DATETIME NOT NULL,
                updated_at DATETIME,
                FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
                UNIQUE(profile_id, address, chain)
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create a test profile
        sqlx::query(
            "INSERT INTO profiles (id, name, created_at, updated_at) VALUES ('test-profile', 'Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_create_and_get_wallet() {
        let pool = setup_test_db().await;

        let input = WalletInput {
            profile_id: "test-profile".to_string(),
            address: "0x1234567890abcdef".to_string(),
            chain: "ethereum".to_string(),
            nickname: Some("My Wallet".to_string()),
        };

        let wallet = create_wallet(&pool, input).await.unwrap();
        assert_eq!(wallet.address, "0x1234567890abcdef");
        assert_eq!(wallet.nickname, Some("My Wallet".to_string()));

        let fetched = get_wallet(&pool, &wallet.id).await.unwrap().unwrap();
        assert_eq!(fetched.id, wallet.id);
    }

    #[tokio::test]
    async fn test_get_wallets_by_profile() {
        let pool = setup_test_db().await;

        create_wallet(
            &pool,
            WalletInput {
                profile_id: "test-profile".to_string(),
                address: "0x111".to_string(),
                chain: "ethereum".to_string(),
                nickname: None,
            },
        )
        .await
        .unwrap();

        create_wallet(
            &pool,
            WalletInput {
                profile_id: "test-profile".to_string(),
                address: "0x222".to_string(),
                chain: "polkadot".to_string(),
                nickname: None,
            },
        )
        .await
        .unwrap();

        let wallets = get_wallets_by_profile(&pool, "test-profile").await.unwrap();
        assert_eq!(wallets.len(), 2);
    }
}
