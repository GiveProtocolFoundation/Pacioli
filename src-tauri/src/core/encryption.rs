use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use anyhow::Result;
use sha2::{Digest, Sha256};

pub struct Encryptor {
    cipher: Aes256Gcm,
}

impl Encryptor {
    pub fn new(password: &str) -> Result<Self> {
        // Derive key from password using SHA256
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let key = hasher.finalize();

        let cipher = Aes256Gcm::new(&key);

        Ok(Self { cipher })
    }

    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let nonce = Nonce::from_slice(b"unique nonce"); // Use random nonce in production
        let ciphertext = self
            .cipher
            .encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
        Ok(ciphertext)
    }

    pub fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        let nonce = Nonce::from_slice(b"unique nonce");
        let plaintext = self
            .cipher
            .decrypt(nonce, encrypted_data)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
        Ok(plaintext)
    }
}
