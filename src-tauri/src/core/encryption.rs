#![allow(dead_code)]

use aes_gcm{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::Result;
use sha2::{Digest, Sha256};

/// Encryptor provides functionality to encrypt and decrypt data
/// using AES-256-GCM with a key derived from a password.
pub struct Encryptor {
    cipher: Aes256Gcm,
}

impl Encryptor {
    /// Creates a new Encryptor instance by deriving a 256-bit key
    /// from the provided password using SHA-256.
    ///
    /// # Arguments
    /// * `password` - A string slice used to derive the encryption key.
    ///
    /// # Returns
    /// Returns an `Encryptor` wrapped in a `Result` on success.
    pub fn new(password: &str) -> Result<Self> {
        // Derive key from password using SHA256
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let key = hasher.finalize();

        let cipher = Aes256Gcm::new(&key);

        Ok(Self { cipher })
    }

    /// Encrypts the given data using AES-256-GCM.
    ///
    /// # Arguments
    /// * `data` - A byte slice of plaintext data to encrypt.
    ///
    /// # Returns
    /// Returns the ciphertext as a `Vec<u8>` wrapped in a `Result` on success.
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let nonce = Nonce::from_slice(b"unique nonce"); // Use random nonce in production
        let ciphertext = self
            .cipher
            .encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
        Ok(ciphertext)
    }

    /// Decrypts the given ciphertext using AES-256-GCM.
    ///
    /// # Arguments
    /// * `encrypted_data` - A byte slice of ciphertext to decrypt.
    ///
    /// # Returns
    /// Returns the decrypted plaintext as a `Vec<u8>` wrapped in a `Result` on success.
    pub fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        let nonce = Nonce::from_slice(b"unique nonce");
        let plaintext = self
            .cipher
            .decrypt(nonce, encrypted_data)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
        Ok(plaintext)
    }
}
}
