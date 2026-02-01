//! Bitcoin xPub Address Derivation
//!
//! Provides extended public key (xPub/ypub/zpub) parsing and address derivation
//! for Bitcoin HD wallets using BIP32/44/49/84/86 standards.
//!
//! Supports:
//! - xpub: BIP44 Legacy P2PKH (1... addresses)
//! - ypub: BIP49 Nested SegWit P2SH-P2WPKH (3... addresses)
//! - zpub: BIP84 Native SegWit P2WPKH (bc1q... addresses)
//! - Taproot support for BIP86 (bc1p... addresses)

use bitcoin::bip32::{DerivationPath, Xpub};
use bitcoin::secp256k1::Secp256k1;
use bitcoin::{Address, CompressedPublicKey, Network, PublicKey};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

use crate::chains::{ChainError, ChainResult};

/// Address type derived from the xPub prefix
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AddressType {
    /// Legacy P2PKH (1... addresses) - BIP44
    Legacy,
    /// Nested SegWit P2SH-P2WPKH (3... addresses) - BIP49
    NestedSegwit,
    /// Native SegWit P2WPKH (bc1q... addresses) - BIP84
    NativeSegwit,
    /// Taproot P2TR (bc1p... addresses) - BIP86
    Taproot,
}

impl AddressType {
    /// Get the display name for this address type.
    pub fn display_name(&self) -> &'static str {
        match self {
            AddressType::Legacy => "Legacy (P2PKH)",
            AddressType::NestedSegwit => "Nested SegWit (P2SH-P2WPKH)",
            AddressType::NativeSegwit => "Native SegWit (P2WPKH)",
            AddressType::Taproot => "Taproot (P2TR)",
        }
    }
}

/// Result of xPub parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XpubInfo {
    /// The original xPub string
    pub original: String,
    /// Detected address type based on prefix
    pub address_type: AddressType,
    /// Whether this is a testnet key
    pub is_testnet: bool,
    /// Fingerprint of the master key (first 4 bytes of hash160 of public key)
    pub fingerprint: String,
}

/// A derived Bitcoin address
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DerivedAddress {
    /// The Bitcoin address string
    pub address: String,
    /// Derivation path relative to xPub (e.g., "0/0" for first receiving address)
    pub derivation_path: String,
    /// Index in the derivation (0-based)
    pub index: u32,
    /// Whether this is a change address (internal chain)
    pub is_change: bool,
    /// Address type
    pub address_type: AddressType,
}

/// Portfolio derived from an xPub
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XpubPortfolio {
    /// Information about the xPub
    pub info: XpubInfo,
    /// Derived receiving addresses (external chain, path 0/*)
    pub receiving_addresses: Vec<DerivedAddress>,
    /// Derived change addresses (internal chain, path 1/*)
    pub change_addresses: Vec<DerivedAddress>,
}

/// Detects the address type from an xPub prefix.
///
/// Mainnet prefixes:
/// - xpub: BIP44 Legacy (P2PKH)
/// - ypub: BIP49 Nested SegWit (P2SH-P2WPKH)
/// - zpub: BIP84 Native SegWit (P2WPKH)
///
/// Testnet prefixes:
/// - tpub: BIP44 Legacy (P2PKH)
/// - upub: BIP49 Nested SegWit (P2SH-P2WPKH)
/// - vpub: BIP84 Native SegWit (P2WPKH)
fn detect_xpub_type(xpub_str: &str) -> ChainResult<(AddressType, bool)> {
    let prefix = &xpub_str[..4];
    match prefix {
        "xpub" => Ok((AddressType::Legacy, false)),
        "ypub" => Ok((AddressType::NestedSegwit, false)),
        "zpub" => Ok((AddressType::NativeSegwit, false)),
        "tpub" => Ok((AddressType::Legacy, true)),
        "upub" => Ok((AddressType::NestedSegwit, true)),
        "vpub" => Ok((AddressType::NativeSegwit, true)),
        _ => Err(ChainError::InvalidAddress(format!(
            "Unknown xPub prefix: {}. Expected xpub/ypub/zpub (mainnet) or tpub/upub/vpub (testnet)",
            prefix
        ))),
    }
}

/// Converts a slip132 encoded key (ypub/zpub/etc) to standard xpub format.
///
/// SLIP-0132 defines different version bytes for different address types:
/// - xpub: 0x0488B21E (mainnet) / tpub: 0x043587CF (testnet)
/// - ypub: 0x049D7CB2 (mainnet) / upub: 0x044A5262 (testnet)
/// - zpub: 0x04B24746 (mainnet) / vpub: 0x045F1CF6 (testnet)
fn convert_to_standard_xpub(slip132_key: &str) -> ChainResult<String> {
    let prefix = &slip132_key[..4];

    // Check if it's already a standard xpub/tpub
    if prefix == "xpub" || prefix == "tpub" {
        return Ok(slip132_key.to_string());
    }

    // Decode the base58check
    let decoded = bs58::decode(slip132_key)
        .with_check(None)
        .into_vec()
        .map_err(|e| ChainError::InvalidAddress(format!("Invalid base58 encoding: {}", e)))?;

    if decoded.len() != 78 {
        return Err(ChainError::InvalidAddress(format!(
            "Invalid xPub length: expected 78 bytes, got {}",
            decoded.len()
        )));
    }

    // Determine target version bytes based on source prefix
    let target_version: [u8; 4] = match prefix {
        "ypub" | "zpub" => [0x04, 0x88, 0xB2, 0x1E], // mainnet xpub
        "upub" | "vpub" => [0x04, 0x35, 0x87, 0xCF], // testnet tpub
        _ => {
            return Err(ChainError::InvalidAddress(format!(
                "Unknown prefix: {}",
                prefix
            )))
        }
    };

    // Replace the version bytes
    let mut converted = decoded;
    converted[0..4].copy_from_slice(&target_version);

    // Re-encode with base58check
    let encoded = bs58::encode(&converted).with_check().into_string();

    Ok(encoded)
}

/// Validates an xPub string and returns information about it.
pub fn parse_xpub(xpub_str: &str) -> ChainResult<XpubInfo> {
    let xpub_str = xpub_str.trim();

    if xpub_str.len() < 111 || xpub_str.len() > 112 {
        return Err(ChainError::InvalidAddress(format!(
            "Invalid xPub length: {}. Expected 111-112 characters",
            xpub_str.len()
        )));
    }

    let (address_type, is_testnet) = detect_xpub_type(xpub_str)?;

    // Convert to standard xpub format for parsing
    let standard_xpub = convert_to_standard_xpub(xpub_str)?;

    // Parse the xpub to validate it
    let xpub = Xpub::from_str(&standard_xpub)
        .map_err(|e| ChainError::InvalidAddress(format!("Invalid xPub: {}", e)))?;

    Ok(XpubInfo {
        original: xpub_str.to_string(),
        address_type,
        is_testnet,
        fingerprint: hex::encode(xpub.fingerprint().as_bytes()),
    })
}

/// Derives a single address from an xPub at the given path.
fn derive_address(
    xpub: &Xpub,
    address_type: AddressType,
    network: Network,
    chain: u32,
    index: u32,
) -> ChainResult<DerivedAddress> {
    let secp = Secp256k1::new();

    // Derive child key: xpub / chain / index
    let path = DerivationPath::from_str(&format!("m/{}/{}", chain, index))
        .map_err(|e| ChainError::Internal(format!("Invalid derivation path: {}", e)))?;

    let derived = xpub
        .derive_pub(&secp, &path)
        .map_err(|e| ChainError::Internal(format!("Failed to derive public key: {}", e)))?;

    let public_key = PublicKey::new(derived.public_key);

    let address = match address_type {
        AddressType::Legacy => {
            // P2PKH: hash160(pubkey) -> 1... address
            Address::p2pkh(public_key, network)
        }
        AddressType::NestedSegwit => {
            // P2SH-P2WPKH: hash160(0x00 0x14 hash160(pubkey)) -> 3... address
            let compressed = CompressedPublicKey::try_from(public_key)
                .map_err(|e| ChainError::Internal(format!("Failed to compress public key: {}", e)))?;
            Address::p2shwpkh(&compressed, network)
        }
        AddressType::NativeSegwit => {
            // P2WPKH: bc1q... address
            let compressed = CompressedPublicKey::try_from(public_key)
                .map_err(|e| ChainError::Internal(format!("Failed to compress public key: {}", e)))?;
            Address::p2wpkh(&compressed, network)
        }
        AddressType::Taproot => {
            // P2TR: bc1p... address (using internal key directly)
            let internal_key = bitcoin::key::UntweakedPublicKey::from(derived.public_key);
            Address::p2tr(&secp, internal_key, None, network)
        }
    };

    Ok(DerivedAddress {
        address: address.to_string(),
        derivation_path: format!("{}/{}", chain, index),
        index,
        is_change: chain == 1,
        address_type,
    })
}

/// Derives multiple addresses from an xPub.
///
/// # Arguments
/// * `xpub_str` - The extended public key (xpub/ypub/zpub/tpub/upub/vpub)
/// * `receiving_count` - Number of receiving addresses to derive (external chain)
/// * `change_count` - Number of change addresses to derive (internal chain)
///
/// # Returns
/// An XpubPortfolio containing the derived addresses.
pub fn derive_addresses(
    xpub_str: &str,
    receiving_count: u32,
    change_count: u32,
) -> ChainResult<XpubPortfolio> {
    let info = parse_xpub(xpub_str)?;

    // Convert to standard format and parse
    let standard_xpub = convert_to_standard_xpub(xpub_str)?;
    let xpub = Xpub::from_str(&standard_xpub)
        .map_err(|e| ChainError::InvalidAddress(format!("Invalid xPub: {}", e)))?;

    let network = if info.is_testnet {
        Network::Testnet
    } else {
        Network::Bitcoin
    };

    // Derive receiving addresses (external chain: 0/*)
    let mut receiving_addresses = Vec::with_capacity(receiving_count as usize);
    for i in 0..receiving_count {
        let addr = derive_address(&xpub, info.address_type, network, 0, i)?;
        receiving_addresses.push(addr);
    }

    // Derive change addresses (internal chain: 1/*)
    let mut change_addresses = Vec::with_capacity(change_count as usize);
    for i in 0..change_count {
        let addr = derive_address(&xpub, info.address_type, network, 1, i)?;
        change_addresses.push(addr);
    }

    Ok(XpubPortfolio {
        info,
        receiving_addresses,
        change_addresses,
    })
}

/// Checks if a string is a valid xPub format (xpub/ypub/zpub/tpub/upub/vpub).
pub fn is_xpub(input: &str) -> bool {
    let input = input.trim();
    if input.len() < 111 || input.len() > 112 {
        return false;
    }

    let valid_prefixes = ["xpub", "ypub", "zpub", "tpub", "upub", "vpub"];
    valid_prefixes.iter().any(|prefix| input.starts_with(prefix))
}

/// Gets the address type display name for a given xPub.
pub fn get_xpub_address_type_name(xpub_str: &str) -> ChainResult<String> {
    let (address_type, _) = detect_xpub_type(xpub_str)?;
    Ok(address_type.display_name().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test xpub (BIP44 Legacy) - this is a well-known test vector
    const TEST_XPUB: &str = "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8";

    #[test]
    fn test_is_xpub() {
        assert!(is_xpub(TEST_XPUB));
        assert!(is_xpub("zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs"));
        assert!(!is_xpub("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"));
        assert!(!is_xpub("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"));
        assert!(!is_xpub("invalid"));
    }

    #[test]
    fn test_detect_xpub_type() {
        assert_eq!(
            detect_xpub_type("xpub123...").unwrap(),
            (AddressType::Legacy, false)
        );
        assert_eq!(
            detect_xpub_type("ypub123...").unwrap(),
            (AddressType::NestedSegwit, false)
        );
        assert_eq!(
            detect_xpub_type("zpub123...").unwrap(),
            (AddressType::NativeSegwit, false)
        );
        assert_eq!(
            detect_xpub_type("tpub123...").unwrap(),
            (AddressType::Legacy, true)
        );
        assert!(detect_xpub_type("invalid").is_err());
    }

    #[test]
    fn test_parse_xpub() {
        let info = parse_xpub(TEST_XPUB).unwrap();
        assert_eq!(info.address_type, AddressType::Legacy);
        assert!(!info.is_testnet);
        assert!(!info.fingerprint.is_empty());
    }

    #[test]
    fn test_derive_addresses() {
        let portfolio = derive_addresses(TEST_XPUB, 5, 2).unwrap();

        assert_eq!(portfolio.receiving_addresses.len(), 5);
        assert_eq!(portfolio.change_addresses.len(), 2);

        // First receiving address should be at path 0/0
        assert_eq!(portfolio.receiving_addresses[0].derivation_path, "0/0");
        assert!(!portfolio.receiving_addresses[0].is_change);

        // First change address should be at path 1/0
        assert_eq!(portfolio.change_addresses[0].derivation_path, "1/0");
        assert!(portfolio.change_addresses[0].is_change);

        // Legacy addresses should start with '1'
        assert!(portfolio.receiving_addresses[0].address.starts_with('1'));
    }

    #[test]
    fn test_invalid_xpub() {
        assert!(parse_xpub("invalid").is_err());
        assert!(parse_xpub("xpub123").is_err());
        assert!(derive_addresses("invalid", 5, 2).is_err());
    }
}
