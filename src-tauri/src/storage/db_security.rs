//! Database security and password protection.
//!
//! Provides optional password protection for the database using:
//! - Argon2id for password hashing and verification
//! - 12-word recovery phrase for password reset
//! - Secure password storage in app_metadata table

use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use sqlx::SqlitePool;

use super::bip39::{generate_recovery_phrase, normalize_recovery_phrase, validate_recovery_phrase};
use super::initialization::{delete_metadata, get_metadata, set_metadata};

/// Key for tracking if password is set.
const PASSWORD_SET_KEY: &str = "password_set";
/// Key for storing password hash.
const PASSWORD_HASH_KEY: &str = "password_hash";
/// Key for storing recovery phrase hash.
const RECOVERY_PHRASE_HASH_KEY: &str = "recovery_phrase_hash";

/// Sets a password for the database and generates a recovery phrase.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `password` - The password to set
///
/// # Returns
/// The 12-word recovery phrase that was generated
pub async fn set_password_with_recovery(pool: &SqlitePool, password: &str) -> Result<String> {
    if password.is_empty() {
        return Err(anyhow!("Password cannot be empty"));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    // Hash the password
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();

    // Generate recovery phrase
    let recovery_phrase = generate_recovery_phrase();

    // Hash the recovery phrase for storage
    let recovery_salt = SaltString::generate(&mut OsRng);
    let recovery_hash = argon2
        .hash_password(recovery_phrase.as_bytes(), &recovery_salt)
        .map_err(|e| anyhow!("Failed to hash recovery phrase: {}", e))?
        .to_string();

    // Store everything
    set_metadata(pool, PASSWORD_HASH_KEY, &password_hash).await?;
    set_metadata(pool, RECOVERY_PHRASE_HASH_KEY, &recovery_hash).await?;
    set_metadata(pool, PASSWORD_SET_KEY, "true").await?;

    Ok(recovery_phrase)
}

/// Sets a password for the database (without recovery phrase - legacy support).
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `password` - The password to set
///
/// # Returns
/// Ok if the password was set successfully
#[allow(dead_code)]
pub async fn set_password(pool: &SqlitePool, password: &str) -> Result<()> {
    if password.is_empty() {
        return Err(anyhow!("Password cannot be empty"));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();

    // Store the hash
    set_metadata(pool, PASSWORD_HASH_KEY, &password_hash).await?;
    set_metadata(pool, PASSWORD_SET_KEY, "true").await?;

    Ok(())
}

/// Verifies a recovery phrase against the stored hash.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `phrase` - The recovery phrase to verify
///
/// # Returns
/// True if the phrase matches, false otherwise
pub async fn verify_recovery_phrase(pool: &SqlitePool, phrase: &str) -> Result<bool> {
    // Validate format first
    if !validate_recovery_phrase(phrase) {
        return Ok(false);
    }

    let stored_hash = get_metadata(pool, RECOVERY_PHRASE_HASH_KEY).await?;

    match stored_hash {
        Some(hash_str) => {
            let parsed_hash = PasswordHash::new(&hash_str)
                .map_err(|e| anyhow!("Invalid recovery phrase hash format: {}", e))?;

            let normalized = normalize_recovery_phrase(phrase);
            let result = Argon2::default().verify_password(normalized.as_bytes(), &parsed_hash);

            Ok(result.is_ok())
        }
        None => {
            // No recovery phrase set
            Ok(false)
        }
    }
}

/// Checks if a recovery phrase is set.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// True if a recovery phrase is set, false otherwise
pub async fn has_recovery_phrase(pool: &SqlitePool) -> Result<bool> {
    let hash = get_metadata(pool, RECOVERY_PHRASE_HASH_KEY).await?;
    Ok(hash.is_some())
}

/// Resets the password using a valid recovery phrase.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `recovery_phrase` - The recovery phrase
/// * `new_password` - The new password to set
///
/// # Returns
/// Ok if the password was reset successfully
pub async fn reset_password_with_recovery(
    pool: &SqlitePool,
    recovery_phrase: &str,
    new_password: &str,
) -> Result<()> {
    // Verify the recovery phrase
    if !verify_recovery_phrase(pool, recovery_phrase).await? {
        return Err(anyhow!("Invalid recovery phrase"));
    }

    if new_password.is_empty() {
        return Err(anyhow!("New password cannot be empty"));
    }

    // Set the new password (keeps the same recovery phrase)
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();

    set_metadata(pool, PASSWORD_HASH_KEY, &password_hash).await?;

    Ok(())
}

/// Changes the database password.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `current_password` - The current password
/// * `new_password` - The new password to set
///
/// # Returns
/// Ok if the password was changed successfully
pub async fn change_password(
    pool: &SqlitePool,
    current_password: &str,
    new_password: &str,
) -> Result<()> {
    // Verify current password
    if !verify_password(pool, current_password).await? {
        return Err(anyhow!("Current password is incorrect"));
    }

    // Set new password (recovery phrase stays the same)
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();

    set_metadata(pool, PASSWORD_HASH_KEY, &password_hash).await?;

    Ok(())
}

/// Removes the database password.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `current_password` - The current password for verification
///
/// # Returns
/// Ok if the password was removed successfully
pub async fn remove_password(pool: &SqlitePool, current_password: &str) -> Result<()> {
    // Verify current password
    if !verify_password(pool, current_password).await? {
        return Err(anyhow!("Password is incorrect"));
    }

    // Remove password data
    delete_metadata(pool, PASSWORD_HASH_KEY).await?;
    delete_metadata(pool, PASSWORD_SET_KEY).await?;
    delete_metadata(pool, RECOVERY_PHRASE_HASH_KEY).await?;

    Ok(())
}

/// Verifies a password against the stored hash.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `password` - The password to verify
///
/// # Returns
/// True if the password matches, false otherwise
pub async fn verify_password(pool: &SqlitePool, password: &str) -> Result<bool> {
    let stored_hash = get_metadata(pool, PASSWORD_HASH_KEY).await?;

    match stored_hash {
        Some(hash_str) => {
            let parsed_hash = PasswordHash::new(&hash_str)
                .map_err(|e| anyhow!("Invalid password hash format: {}", e))?;

            let result = Argon2::default().verify_password(password.as_bytes(), &parsed_hash);

            Ok(result.is_ok())
        }
        None => {
            // No password set, any password is "valid"
            Ok(true)
        }
    }
}

/// Checks if a password is set for the database.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// True if a password is set, false otherwise
pub async fn has_password(pool: &SqlitePool) -> Result<bool> {
    let password_set = get_metadata(pool, PASSWORD_SET_KEY).await?;
    Ok(password_set.as_deref() == Some("true"))
}

/// Unlocks the database with the given password.
///
/// This doesn't actually unlock anything at the database level since we're using
/// application-level encryption, but it verifies the password is correct.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `password` - The password to unlock with
///
/// # Returns
/// True if the password is correct, false otherwise
pub async fn unlock(pool: &SqlitePool, password: &str) -> Result<bool> {
    verify_password(pool, password).await
}

/// Validates password strength.
///
/// # Arguments
/// * `password` - The password to validate
///
/// # Returns
/// Ok if the password meets minimum requirements
pub fn validate_password_strength(password: &str) -> Result<()> {
    if password.len() < 8 {
        return Err(anyhow!("Password must be at least 8 characters long"));
    }

    // Check for at least one letter and one number
    let has_letter = password.chars().any(|c| c.is_alphabetic());
    let has_digit = password.chars().any(|c| c.is_numeric());

    if !has_letter || !has_digit {
        return Err(anyhow!(
            "Password must contain at least one letter and one number"
        ));
    }

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

        sqlx::query(
            r#"
            CREATE TABLE app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_set_password_with_recovery() {
        let pool = setup_test_db().await;

        // No password initially
        assert!(!has_password(&pool).await.unwrap());

        // Set password and get recovery phrase
        let recovery_phrase = set_password_with_recovery(&pool, "TestPassword123")
            .await
            .unwrap();

        assert!(has_password(&pool).await.unwrap());
        assert!(has_recovery_phrase(&pool).await.unwrap());

        // Recovery phrase should be 12 words
        let words: Vec<&str> = recovery_phrase.split_whitespace().collect();
        assert_eq!(words.len(), 12);

        // Verify password works
        assert!(verify_password(&pool, "TestPassword123").await.unwrap());

        // Verify recovery phrase works
        assert!(verify_recovery_phrase(&pool, &recovery_phrase)
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn test_reset_password_with_recovery() {
        let pool = setup_test_db().await;

        // Set password and get recovery phrase
        let recovery_phrase = set_password_with_recovery(&pool, "OldPassword123")
            .await
            .unwrap();

        // Reset password using recovery phrase
        reset_password_with_recovery(&pool, &recovery_phrase, "NewPassword456")
            .await
            .unwrap();

        // Old password no longer works
        assert!(!verify_password(&pool, "OldPassword123").await.unwrap());

        // New password works
        assert!(verify_password(&pool, "NewPassword456").await.unwrap());

        // Recovery phrase still works
        assert!(verify_recovery_phrase(&pool, &recovery_phrase)
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn test_invalid_recovery_phrase() {
        let pool = setup_test_db().await;

        set_password_with_recovery(&pool, "TestPassword123")
            .await
            .unwrap();

        // Wrong phrase should fail
        assert!(!verify_recovery_phrase(
            &pool,
            "wrong phrase here with twelve words total now yes"
        )
        .await
        .unwrap());

        // Reset with wrong phrase should fail
        assert!(reset_password_with_recovery(
            &pool,
            "wrong phrase here with twelve words total now yes",
            "NewPassword456"
        )
        .await
        .is_err());
    }

    #[tokio::test]
    async fn test_set_and_verify_password() {
        let pool = setup_test_db().await;

        // No password initially
        assert!(!has_password(&pool).await.unwrap());

        // Set password
        set_password(&pool, "TestPassword123").await.unwrap();
        assert!(has_password(&pool).await.unwrap());

        // Verify correct password
        assert!(verify_password(&pool, "TestPassword123").await.unwrap());

        // Verify incorrect password
        assert!(!verify_password(&pool, "WrongPassword").await.unwrap());
    }

    #[tokio::test]
    async fn test_change_password() {
        let pool = setup_test_db().await;

        set_password(&pool, "OldPassword123").await.unwrap();

        // Change password
        change_password(&pool, "OldPassword123", "NewPassword456")
            .await
            .unwrap();

        // Old password no longer works
        assert!(!verify_password(&pool, "OldPassword123").await.unwrap());

        // New password works
        assert!(verify_password(&pool, "NewPassword456").await.unwrap());
    }

    #[tokio::test]
    async fn test_remove_password() {
        let pool = setup_test_db().await;

        set_password_with_recovery(&pool, "TestPassword123")
            .await
            .unwrap();
        assert!(has_password(&pool).await.unwrap());
        assert!(has_recovery_phrase(&pool).await.unwrap());

        remove_password(&pool, "TestPassword123").await.unwrap();
        assert!(!has_password(&pool).await.unwrap());
        assert!(!has_recovery_phrase(&pool).await.unwrap());
    }

    #[test]
    fn test_password_strength_validation() {
        // Too short
        assert!(validate_password_strength("Short1").is_err());

        // No number
        assert!(validate_password_strength("NoNumbers").is_err());

        // No letter
        assert!(validate_password_strength("12345678").is_err());

        // Valid password
        assert!(validate_password_strength("ValidPass123").is_ok());
    }
}
