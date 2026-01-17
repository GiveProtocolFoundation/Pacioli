//! Transaction Storage
//!
//! Provides database storage for blockchain transactions fetched from various chains.

#![allow(dead_code)]

use crate::chains::{ChainId, ChainTransaction, ChainType, TransactionStatus, TransactionType};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, SqlitePool};

/// Stored transaction record from the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StoredTransaction {
    /// Unique database identifier.
    pub id: i64,
    /// Transaction hash.
    pub hash: String,
    /// Chain type (evm or substrate).
    pub chain_type: String,
    /// Chain name identifier.
    pub chain_name: String,
    /// Numeric chain ID for EVM chains.
    pub chain_id: Option<i64>,
    /// Block number containing this transaction.
    pub block_number: i64,
    /// Unix timestamp of the transaction.
    pub timestamp: i64,
    /// Sender address.
    pub from_address: String,
    /// Recipient address.
    pub to_address: Option<String>,
    /// Transaction value in native units.
    pub value: String,
    /// Transaction fee in native units.
    pub fee: String,
    /// Transaction status (success, failed, pending).
    pub status: String,
    /// Transaction type classification.
    pub tx_type: String,
    /// JSON-encoded token transfers.
    pub token_transfers_json: Option<String>,
    /// JSON-encoded raw transaction data.
    pub raw_data_json: Option<String>,
    /// Associated wallet ID.
    pub wallet_id: Option<i64>,
    /// Associated profile ID.
    pub profile_id: Option<i64>,
    /// Record creation timestamp.
    pub created_at: String,
    /// Record update timestamp.
    pub updated_at: String,
}

/// Transaction repository for database operations.
pub struct TransactionRepository {
    pool: SqlitePool,
}

impl TransactionRepository {
    /// Creates a new transaction repository with the given connection pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Initialize the transactions table
    pub async fn init(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS chain_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash TEXT NOT NULL,
                chain_type TEXT NOT NULL,
                chain_name TEXT NOT NULL,
                chain_id INTEGER,
                block_number INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                from_address TEXT NOT NULL,
                to_address TEXT,
                value TEXT NOT NULL,
                fee TEXT NOT NULL,
                status TEXT NOT NULL,
                tx_type TEXT NOT NULL,
                token_transfers_json TEXT,
                raw_data_json TEXT,
                wallet_id INTEGER,
                profile_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(hash, chain_name)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create indexes
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_chain_transactions_address
            ON chain_transactions(from_address, chain_name)
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_chain_transactions_timestamp
            ON chain_transactions(timestamp DESC)
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_chain_transactions_wallet
            ON chain_transactions(wallet_id)
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Save a transaction (upsert)
    pub async fn save(
        &self,
        tx: &ChainTransaction,
        wallet_id: Option<i64>,
        profile_id: Option<i64>,
    ) -> Result<i64, sqlx::Error> {
        let chain_type = match tx.chain_id.chain_type {
            ChainType::Evm => "evm",
            ChainType::Substrate => "substrate",
        };

        let status = match tx.status {
            TransactionStatus::Success => "success",
            TransactionStatus::Failed => "failed",
            TransactionStatus::Pending => "pending",
        };

        let tx_type =
            serde_json::to_string(&tx.tx_type).unwrap_or_else(|_| "\"unknown\"".to_string());
        let tx_type = tx_type.trim_matches('"');

        let token_transfers_json = if tx.token_transfers.is_empty() {
            None
        } else {
            Some(serde_json::to_string(&tx.token_transfers).unwrap_or_default())
        };

        let raw_data_json = tx.raw_data.as_ref().map(|d| d.to_string());

        let result = sqlx::query(
            r#"
            INSERT INTO chain_transactions (
                hash, chain_type, chain_name, chain_id, block_number, timestamp,
                from_address, to_address, value, fee, status, tx_type,
                token_transfers_json, raw_data_json, wallet_id, profile_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(hash, chain_name) DO UPDATE SET
                block_number = excluded.block_number,
                timestamp = excluded.timestamp,
                status = excluded.status,
                token_transfers_json = excluded.token_transfers_json,
                raw_data_json = excluded.raw_data_json,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
            "#,
        )
        .bind(&tx.hash)
        .bind(chain_type)
        .bind(&tx.chain_id.name)
        .bind(tx.chain_id.chain_id.map(|id| id as i64))
        .bind(tx.block_number as i64)
        .bind(tx.timestamp)
        .bind(&tx.from)
        .bind(&tx.to)
        .bind(&tx.value)
        .bind(&tx.fee)
        .bind(status)
        .bind(tx_type)
        .bind(&token_transfers_json)
        .bind(&raw_data_json)
        .bind(wallet_id)
        .bind(profile_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(result.get::<i64, _>("id"))
    }

    /// Save multiple transactions
    pub async fn save_batch(
        &self,
        transactions: &[ChainTransaction],
        wallet_id: Option<i64>,
        profile_id: Option<i64>,
    ) -> Result<usize, sqlx::Error> {
        let mut count = 0;
        for tx in transactions {
            if self.save(tx, wallet_id, profile_id).await.is_ok() {
                count += 1;
            }
        }
        Ok(count)
    }

    /// Get transaction by hash and chain
    pub async fn get_by_hash(
        &self,
        hash: &str,
        chain_name: &str,
    ) -> Result<Option<StoredTransaction>, sqlx::Error> {
        sqlx::query_as::<_, StoredTransaction>(
            "SELECT * FROM chain_transactions WHERE hash = ? AND chain_name = ?",
        )
        .bind(hash)
        .bind(chain_name)
        .fetch_optional(&self.pool)
        .await
    }

    /// Get transactions for an address
    pub async fn get_by_address(
        &self,
        address: &str,
        chain_name: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StoredTransaction>, sqlx::Error> {
        let address_lower = address.to_lowercase();

        if let Some(chain) = chain_name {
            sqlx::query_as::<_, StoredTransaction>(
                r#"
                SELECT * FROM chain_transactions
                WHERE (LOWER(from_address) = ? OR LOWER(to_address) = ?)
                AND chain_name = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(&address_lower)
            .bind(&address_lower)
            .bind(chain)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, StoredTransaction>(
                r#"
                SELECT * FROM chain_transactions
                WHERE LOWER(from_address) = ? OR LOWER(to_address) = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(&address_lower)
            .bind(&address_lower)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        }
    }

    /// Get transactions for a wallet
    pub async fn get_by_wallet(
        &self,
        wallet_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StoredTransaction>, sqlx::Error> {
        sqlx::query_as::<_, StoredTransaction>(
            r#"
            SELECT * FROM chain_transactions
            WHERE wallet_id = ?
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(wallet_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }

    /// Get transactions for a profile
    pub async fn get_by_profile(
        &self,
        profile_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StoredTransaction>, sqlx::Error> {
        sqlx::query_as::<_, StoredTransaction>(
            r#"
            SELECT * FROM chain_transactions
            WHERE profile_id = ?
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(profile_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }

    /// Get transactions in a time range
    pub async fn get_by_time_range(
        &self,
        from_timestamp: i64,
        to_timestamp: i64,
        chain_name: Option<&str>,
        limit: i64,
    ) -> Result<Vec<StoredTransaction>, sqlx::Error> {
        if let Some(chain) = chain_name {
            sqlx::query_as::<_, StoredTransaction>(
                r#"
                SELECT * FROM chain_transactions
                WHERE timestamp >= ? AND timestamp <= ?
                AND chain_name = ?
                ORDER BY timestamp DESC
                LIMIT ?
                "#,
            )
            .bind(from_timestamp)
            .bind(to_timestamp)
            .bind(chain)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, StoredTransaction>(
                r#"
                SELECT * FROM chain_transactions
                WHERE timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp DESC
                LIMIT ?
                "#,
            )
            .bind(from_timestamp)
            .bind(to_timestamp)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
        }
    }

    /// Count transactions for an address
    pub async fn count_by_address(
        &self,
        address: &str,
        chain_name: Option<&str>,
    ) -> Result<i64, sqlx::Error> {
        let address_lower = address.to_lowercase();

        let result = if let Some(chain) = chain_name {
            sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*) FROM chain_transactions
                WHERE (LOWER(from_address) = ? OR LOWER(to_address) = ?)
                AND chain_name = ?
                "#,
            )
            .bind(&address_lower)
            .bind(&address_lower)
            .bind(chain)
            .fetch_one(&self.pool)
            .await?
        } else {
            sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*) FROM chain_transactions
                WHERE LOWER(from_address) = ? OR LOWER(to_address) = ?
                "#,
            )
            .bind(&address_lower)
            .bind(&address_lower)
            .fetch_one(&self.pool)
            .await?
        };

        Ok(result)
    }

    /// Delete transactions older than a timestamp
    pub async fn delete_older_than(&self, timestamp: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM chain_transactions WHERE timestamp < ?")
            .bind(timestamp)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Get latest block number stored for a chain
    pub async fn get_latest_block(&self, chain_name: &str) -> Result<Option<i64>, sqlx::Error> {
        sqlx::query_scalar::<_, i64>(
            "SELECT MAX(block_number) FROM chain_transactions WHERE chain_name = ?",
        )
        .bind(chain_name)
        .fetch_optional(&self.pool)
        .await
    }

    /// Get transaction statistics
    pub async fn get_stats(
        &self,
        chain_name: Option<&str>,
    ) -> Result<TransactionStats, sqlx::Error> {
        let (total, chains) = if let Some(chain) = chain_name {
            let total: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM chain_transactions WHERE chain_name = ?")
                    .bind(chain)
                    .fetch_one(&self.pool)
                    .await?;

            (total, vec![chain.to_string()])
        } else {
            let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chain_transactions")
                .fetch_one(&self.pool)
                .await?;

            let chains: Vec<String> = sqlx::query_scalar(
                "SELECT DISTINCT chain_name FROM chain_transactions ORDER BY chain_name",
            )
            .fetch_all(&self.pool)
            .await?;

            (total, chains)
        };

        Ok(TransactionStats {
            total_transactions: total,
            chains,
        })
    }
}

/// Transaction statistics summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionStats {
    /// Total number of transactions.
    pub total_transactions: i64,
    /// List of chains with stored transactions.
    pub chains: Vec<String>,
}

impl StoredTransaction {
    /// Convert to ChainTransaction
    pub fn to_chain_transaction(&self) -> ChainTransaction {
        let chain_type = match self.chain_type.as_str() {
            "evm" => ChainType::Evm,
            _ => ChainType::Substrate,
        };

        let chain_id = ChainId {
            chain_type,
            name: self.chain_name.clone(),
            chain_id: self.chain_id.map(|id| id as u64),
        };

        let status = match self.status.as_str() {
            "success" => TransactionStatus::Success,
            "failed" => TransactionStatus::Failed,
            _ => TransactionStatus::Pending,
        };

        let tx_type: TransactionType = serde_json::from_str(&format!("\"{}\"", self.tx_type))
            .unwrap_or(TransactionType::Unknown);

        let token_transfers = self
            .token_transfers_json
            .as_ref()
            .and_then(|json| serde_json::from_str(json).ok())
            .unwrap_or_default();

        let raw_data = self
            .raw_data_json
            .as_ref()
            .and_then(|json| serde_json::from_str(json).ok());

        ChainTransaction {
            hash: self.hash.clone(),
            chain_id,
            block_number: self.block_number as u64,
            timestamp: self.timestamp,
            from: self.from_address.clone(),
            to: self.to_address.clone(),
            value: self.value.clone(),
            fee: self.fee.clone(),
            status,
            tx_type,
            token_transfers,
            raw_data,
        }
    }
}
