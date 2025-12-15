mod address;
pub mod auth_helpers;
pub mod auth_state;
pub mod currency;
pub mod currency_service;
mod encryption;
pub mod substrate_currency;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Transaction {
    #[sqlx(try_from = "String")]
    pub id: Uuid,
    #[sqlx(default)]
    pub profile_id: Option<String>,
    pub chain: String,
    pub hash: String,
    pub from_address: String,
    pub to_address: Option<String>,
    pub value: String,
    pub token_symbol: String,
    pub token_decimals: i32,
    pub timestamp: DateTime<Utc>,
    pub block_number: i64,
    pub transaction_type: String,
    pub status: String,
    pub fee: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Transaction {
    #[allow(dead_code)]
    pub fn value_decimal(&self) -> Result<Decimal, rust_decimal::Error> {
        Decimal::from_str(&self.value)
    }

    #[allow(dead_code)]
    pub fn fee_decimal(&self) -> Result<Option<Decimal>, rust_decimal::Error> {
        self.fee.as_ref().map(|f| Decimal::from_str(f)).transpose()
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub symbol: String,
    pub decimals: u8,
    pub chain: String,
    pub contract_address: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: Uuid,
    pub address: String,
    pub chain: String,
    pub nickname: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    pub account_id: Uuid,
    pub token_symbol: String,
    pub chain: String,
    pub amount: Decimal,
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub name: String,
    pub rpc_endpoint: String,
    pub ws_endpoint: Option<String>,
    pub explorer_url: Option<String>,
    pub decimals: u8,
    pub symbol: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub chain: String,
    pub last_block: i64,
    pub current_block: i64,
    pub is_syncing: bool,
    pub progress: f64,
}
