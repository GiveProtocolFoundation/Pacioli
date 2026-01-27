//! Profile storage operations.
//!
//! Provides CRUD operations for user profiles with support for
//! default profile designation and offline-first storage.

use anyhow::{anyhow, Result};
use chrono::Utc;
use sqlx::SqlitePool;
use ulid::Ulid;

use super::{Profile, ProfileInput};

/// Creates a new profile in the database.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `input` - Profile creation input
///
/// # Returns
/// The created profile with generated ID and timestamps
pub async fn create_profile(pool: &SqlitePool, input: ProfileInput) -> Result<Profile> {
    let id = Ulid::new().to_string();
    let now = Utc::now();
    let is_default = input.is_default.unwrap_or(false);

    // Start a transaction
    let mut tx = pool.begin().await?;

    // If this is the default profile, unset any existing default
    if is_default {
        sqlx::query("UPDATE profile_defaults SET is_default = FALSE WHERE is_default = TRUE")
            .execute(&mut *tx)
            .await?;
    }

    // Insert the profile
    sqlx::query(
        r#"
        INSERT INTO profiles (id, name, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.avatar_url)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Insert the default status
    sqlx::query(
        r#"
        INSERT INTO profile_defaults (profile_id, is_default)
        VALUES (?, ?)
        "#,
    )
    .bind(&id)
    .bind(is_default)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Profile {
        id,
        name: input.name,
        avatar_url: input.avatar_url,
        is_default,
        created_at: now,
        updated_at: now,
    })
}

/// Retrieves a profile by its ID.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Profile ID to look up
///
/// # Returns
/// The profile if found, None otherwise
pub async fn get_profile(pool: &SqlitePool, id: &str) -> Result<Option<Profile>> {
    let profile = sqlx::query_as::<_, (String, String, Option<String>, chrono::DateTime<Utc>, chrono::DateTime<Utc>)>(
        r#"
        SELECT id, name, avatar_url, created_at, updated_at
        FROM profiles
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    match profile {
        Some((id, name, avatar_url, created_at, updated_at)) => {
            let is_default = get_is_default(pool, &id).await?;
            Ok(Some(Profile {
                id,
                name,
                avatar_url,
                is_default,
                created_at,
                updated_at,
            }))
        }
        None => Ok(None),
    }
}

/// Retrieves all profiles from the database.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Vector of all profiles, ordered by creation date (newest first)
pub async fn get_all_profiles(pool: &SqlitePool) -> Result<Vec<Profile>> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>, chrono::DateTime<Utc>, chrono::DateTime<Utc>)>(
        r#"
        SELECT id, name, avatar_url, created_at, updated_at
        FROM profiles
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut profiles = Vec::with_capacity(rows.len());
    for (id, name, avatar_url, created_at, updated_at) in rows {
        let is_default = get_is_default(pool, &id).await?;
        profiles.push(Profile {
            id,
            name,
            avatar_url,
            is_default,
            created_at,
            updated_at,
        });
    }

    Ok(profiles)
}

/// Updates an existing profile.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Profile ID to update
/// * `input` - Updated profile data
///
/// # Returns
/// The updated profile
pub async fn update_profile(pool: &SqlitePool, id: &str, input: ProfileInput) -> Result<Profile> {
    let now = Utc::now();

    let mut tx = pool.begin().await?;

    // Update is_default if provided
    if let Some(is_default) = input.is_default {
        if is_default {
            // Unset any existing default
            sqlx::query("UPDATE profile_defaults SET is_default = FALSE WHERE is_default = TRUE")
                .execute(&mut *tx)
                .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO profile_defaults (profile_id, is_default)
            VALUES (?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET is_default = excluded.is_default
            "#,
        )
        .bind(id)
        .bind(is_default)
        .execute(&mut *tx)
        .await?;
    }

    // Update the profile
    sqlx::query(
        r#"
        UPDATE profiles
        SET name = ?, avatar_url = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&input.name)
    .bind(&input.avatar_url)
    .bind(now)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    get_profile(pool, id)
        .await?
        .ok_or_else(|| anyhow!("Profile not found after update"))
}

/// Deletes a profile by its ID.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Profile ID to delete
pub async fn delete_profile(pool: &SqlitePool, id: &str) -> Result<()> {
    // The profile_defaults row will be deleted via CASCADE
    sqlx::query("DELETE FROM profiles WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Gets the default profile if one exists.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// The default profile if one is set, None otherwise
pub async fn get_default_profile(pool: &SqlitePool) -> Result<Option<Profile>> {
    let default_id = sqlx::query_scalar::<_, String>(
        "SELECT profile_id FROM profile_defaults WHERE is_default = TRUE LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    match default_id {
        Some(id) => get_profile(pool, &id).await,
        None => Ok(None),
    }
}

/// Gets the count of profiles in the database.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// The number of profiles
pub async fn get_profile_count(pool: &SqlitePool) -> Result<i64> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM profiles")
        .fetch_one(pool)
        .await?;

    Ok(count)
}

/// Sets a profile as the default, unsetting any existing default.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `id` - Profile ID to set as default
pub async fn set_default_profile(pool: &SqlitePool, id: &str) -> Result<()> {
    let mut tx = pool.begin().await?;

    // Unset any existing default
    sqlx::query("UPDATE profile_defaults SET is_default = FALSE WHERE is_default = TRUE")
        .execute(&mut *tx)
        .await?;

    // Set the new default
    sqlx::query(
        r#"
        INSERT INTO profile_defaults (profile_id, is_default)
        VALUES (?, TRUE)
        ON CONFLICT(profile_id) DO UPDATE SET is_default = TRUE
        "#,
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Helper function to get the is_default status for a profile.
async fn get_is_default(pool: &SqlitePool, profile_id: &str) -> Result<bool> {
    let is_default = sqlx::query_scalar::<_, bool>(
        "SELECT is_default FROM profile_defaults WHERE profile_id = ?",
    )
    .bind(profile_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(false);

    Ok(is_default)
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

        pool
    }

    #[tokio::test]
    async fn test_create_and_get_profile() {
        let pool = setup_test_db().await;

        let input = ProfileInput {
            name: "Test Profile".to_string(),
            avatar_url: None,
            is_default: Some(true),
        };

        let profile = create_profile(&pool, input).await.unwrap();
        assert_eq!(profile.name, "Test Profile");
        assert!(profile.is_default);

        let fetched = get_profile(&pool, &profile.id).await.unwrap().unwrap();
        assert_eq!(fetched.id, profile.id);
        assert_eq!(fetched.name, "Test Profile");
    }

    #[tokio::test]
    async fn test_default_profile_switching() {
        let pool = setup_test_db().await;

        let profile1 = create_profile(
            &pool,
            ProfileInput {
                name: "Profile 1".to_string(),
                avatar_url: None,
                is_default: Some(true),
            },
        )
        .await
        .unwrap();

        let profile2 = create_profile(
            &pool,
            ProfileInput {
                name: "Profile 2".to_string(),
                avatar_url: None,
                is_default: Some(true),
            },
        )
        .await
        .unwrap();

        // Profile 2 should now be default, Profile 1 should not
        let fetched1 = get_profile(&pool, &profile1.id).await.unwrap().unwrap();
        let fetched2 = get_profile(&pool, &profile2.id).await.unwrap().unwrap();

        assert!(!fetched1.is_default);
        assert!(fetched2.is_default);
    }
}
