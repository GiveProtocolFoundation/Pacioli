mod address;
/// Helper functions and utilities for authentication.
pub mod auth_helpers;
/// Types and utilities for authentication state management.
pub mod auth_state;
/// Module for currency-related types and operations.
pub mod currency;
/// Services for managing currency interactions.
pub mod currency_service;
/// Email utility functions and types.
pub mod email;
mod encryption;
/// Substrate-specific currency integration.
pub mod substrate_currency;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use uuid::Uuid;

/// Represents a blockchain transaction with associated metadata.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Transaction {
    #[sqlx(try_from = "String")]
    /// Unique identifier for the transaction.
    pub id: Uuid,
    #[sqlx(default)]
    /// Optional profile identifier associated with the transaction.
    pub profile_id: Option<String>,
    /// Blockchain network name.
    pub chain: String,
    /// Transaction hash.
    pub hash: String,
    /// Sender address.
    pub from_address: String,
    /// Optional recipient address.
    pub to_address: Option<String>,
    /// Transaction value as a string.
    pub value: String,
    /// Symbol of the token.
    pub token_symbol: String,
    /// Number of decimals of the token.
    pub token_decimals: i32,
    /// Timestamp of the transaction.
    pub timestamp: DateTime<Utc>,
    /// Block number containing the transaction.
    pub block_number: i64,
    /// Type or category of the transaction.
    pub transaction_type: String,
    /// Current status of the transaction.
    pub status: String,
    /// Optional transaction fee as a string.
    pub fee: Option<String>,
    /// Arbitrary JSON metadata associated with the transaction.
    pub metadata: serde_json::Value,
    /// Timestamp when the transaction record was created.
    pub created_at: DateTime<Utc>,
    /// Timestamp when the transaction record was last updated.
    /// The UTC timestamp indicating when this item was last updated.
    pub updated_at: DateTime<Utc>,
}
/// Provides method implementations for the `Transaction` struct.
impl Transaction {
    #[allow(dead_code)]
    /// Returns the transaction value as a Decimal.
    pub fn value_decimal(&self) -> Result<Decimal, rust_decimal::Error> {
        Decimal::from_str(&self.value)
    }

    #[allow(dead_code)]
    /// Returns the transaction fee as an Option<Decimal>.
    pub fn fee_decimal(&self) -> Result<Option<Decimal>, rust_decimal::Error> {
        self.fee.as_ref().map(|f| Decimal::from_str(f)).transpose()
    }
}

#[allow(dead_code)]
/// Represents a blockchain token with symbol, decimals, and optional contract address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    /// Token symbol (e.g., "ETH").
    pub symbol: String,
    /// Number of decimal places for the token.
    pub decimals: u8,
    /// Blockchain network name where the token resides.
    pub chain: String,
    /// Optional smart contract address for the token.
    pub contract_address: Option<String>,
}

#[allow(dead_code)]
/// Represents a user account on a blockchain with address and metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// Unique account identifier.
    pub id: Uuid,
    /// Blockchain account address.
    pub address: String,
    /// Blockchain network name.
    pub chain: String,
    /// Optional user-defined nickname for the account.
    pub nickname: Option<String>,
    /// Timestamp when the account was created.
    pub created_at: DateTime<Utc>,
    /// Timestamp when the account was last updated.
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
/// Represents the balance of an account for a specific token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    /// Identifier of the associated account.
    pub account_id: Uuid,
    /// Symbol of the token for which the balance is held.
    pub token_symbol: String,
    /// Blockchain network name where the balance applies.
    pub chain: String,
    /// Current token amount in the account.
    pub amount: Decimal,
    /// Timestamp when the balance was last updated.
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
/// Configuration settings for connecting to a blockchain network.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    /// Name of the blockchain network.
    pub name: String,
    /// RPC endpoint URL for network communication.
    pub rpc_endpoint: String,
    /// Optional WebSocket endpoint URL for real-time updates.
    pub ws_endpoint: Option<String>,
    /// Optional explorer URL for viewing transactions.
    pub explorer_url: Option<String>,
    /// Default number of decimals for the native token.
    pub decimals: u8,
    /// Symbol of the native token for the network.
    pub symbol: String,
}

#[allow(dead_code)]
/// Represents the synchronization status of a blockchain node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// Blockchain network name being monitored.
    pub chain: String,
    /// Last known block number processed.
    pub last_block: i64,
    /// Current block number up to which processing has occurred.
    pub current_block: i64,
    /// Indicates whether the node is currently syncing.
    pub is_syncing: bool,
    /// Synchronization progress as a fraction between 0.0 and 1.0.
    pub progress: f64,
}
