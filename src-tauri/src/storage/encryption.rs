//! AES-256-GCM encryption utilities for data at rest.
//!
//! Provides symmetric encryption using:
//! - Argon2id for key derivation from passwords
//! - AES-256-GCM for authenticated encryption
//! - Random salt and nonce generation

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Result};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::rngs::OsRng;

/// Length of the AES-256 key in bytes.
const KEY_LENGTH: usize = 32;
/// Length of the GCM nonce in bytes.
const NONCE_LENGTH: usize = 12;
/// Length of the salt for Argon2 in bytes.
const SALT_LENGTH: usize = 32;

/// Encrypted data with metadata for decryption.
#[derive(Debug, Clone)]
pub struct EncryptedData {
    /// Salt used for key derivation (base64).
    pub salt: String,
    /// Nonce/IV used for encryption (base64).
    pub nonce: String,
    /// Encrypted ciphertext (base64).
    pub ciphertext: String,
}

/// Generates a random salt for key derivation.
pub fn generate_salt() -> Vec<u8> {
    use rand::RngCore;
    let mut salt = vec![0u8; SALT_LENGTH];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Generates a random nonce for AES-GCM.
pub fn generate_nonce() -> Vec<u8> {
    use rand::RngCore;
    let mut nonce = vec![0u8; NONCE_LENGTH];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Derives a 256-bit key from a password using Argon2id.
///
/// # Arguments
/// * `password` - The user's password
/// * `salt` - Random salt bytes
///
/// # Returns
/// A 32-byte key suitable for AES-256
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; KEY_LENGTH]> {
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|e| anyhow!("Failed to encode salt: {}", e))?;

    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| anyhow!("Failed to derive key: {}", e))?;

    let hash_bytes = hash.hash.ok_or_else(|| anyhow!("No hash output"))?;
    let hash_slice = hash_bytes.as_bytes();

    if hash_slice.len() < KEY_LENGTH {
        return Err(anyhow!("Hash output too short"));
    }

    let mut key = [0u8; KEY_LENGTH];
    key.copy_from_slice(&hash_slice[..KEY_LENGTH]);
    Ok(key)
}

/// Encrypts data using AES-256-GCM.
///
/// # Arguments
/// * `plaintext` - The data to encrypt
/// * `password` - The password to derive the encryption key from
///
/// # Returns
/// Encrypted data with salt and nonce for later decryption
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<EncryptedData> {
    let salt = generate_salt();
    let nonce_bytes = generate_nonce();
    let key = derive_key(password, &salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| anyhow!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;

    Ok(EncryptedData {
        salt: BASE64.encode(&salt),
        nonce: BASE64.encode(&nonce_bytes),
        ciphertext: BASE64.encode(&ciphertext),
    })
}

/// Decrypts data using AES-256-GCM.
///
/// # Arguments
/// * `encrypted` - The encrypted data with salt and nonce
/// * `password` - The password to derive the decryption key from
///
/// # Returns
/// The decrypted plaintext bytes
pub fn decrypt(encrypted: &EncryptedData, password: &str) -> Result<Vec<u8>> {
    let salt = BASE64
        .decode(&encrypted.salt)
        .map_err(|e| anyhow!("Failed to decode salt: {}", e))?;
    let nonce_bytes = BASE64
        .decode(&encrypted.nonce)
        .map_err(|e| anyhow!("Failed to decode nonce: {}", e))?;
    let ciphertext = BASE64
        .decode(&encrypted.ciphertext)
        .map_err(|e| anyhow!("Failed to decode ciphertext: {}", e))?;

    let key = derive_key(password, &salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| anyhow!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| anyhow!("Decryption failed - incorrect password or corrupted data"))?;

    Ok(plaintext)
}

/// Encrypts a string and returns base64-encoded result.
#[allow(dead_code)]
pub fn encrypt_string(plaintext: &str, password: &str) -> Result<EncryptedData> {
    encrypt(plaintext.as_bytes(), password)
}

/// Decrypts to a string.
#[allow(dead_code)]
pub fn decrypt_string(encrypted: &EncryptedData, password: &str) -> Result<String> {
    let bytes = decrypt(encrypted, password)?;
    String::from_utf8(bytes).map_err(|e| anyhow!("Invalid UTF-8 in decrypted data: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = "Hello, Pacioli!";
        let password = "test_password_123";

        let encrypted = encrypt_string(plaintext, password).unwrap();
        let decrypted = decrypt_string(&encrypted, password).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let plaintext = "Secret data";
        let password = "correct_password";
        let wrong_password = "wrong_password";

        let encrypted = encrypt_string(plaintext, password).unwrap();
        let result = decrypt_string(&encrypted, wrong_password);

        assert!(result.is_err());
    }

    #[test]
    fn test_different_encryptions_differ() {
        let plaintext = "Same data";
        let password = "same_password";

        let encrypted1 = encrypt_string(plaintext, password).unwrap();
        let encrypted2 = encrypt_string(plaintext, password).unwrap();

        // Different salt and nonce should produce different ciphertext
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);
    }
}
