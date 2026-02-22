#![allow(dead_code)]

use crate::core::{SyncStatus, Transaction};
use crate::db::Database;
use crate::indexer::PolkadotIndexer;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Manages synchronization of account transactions with the database for a given blockchain.
///
/// `SyncManager` maintains references to a `Database` and a `PolkadotIndexer` to
/// fetch and store transaction data.
pub struct SyncManager {
    db: Arc<Mutex<Database>>,
    indexer: Arc<Mutex<PolkadotIndexer>>,
}

impl SyncManager {
    /// Creates a new `SyncManager` with the given database.
    ///
    /// # Arguments
    ///
    /// * `db` - An `Arc<Mutex<Database>>` providing access to persisted data.
    ///
    /// # Returns
    ///
    /// A `SyncManager` instance ready to perform sync operations.
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self {
            db,
            indexer: Arc::new(Mutex::new(PolkadotIndexer::new())),
        }
    }

    /// Synchronizes transactions for a specific account on a blockchain.
    ///
    /// This method fetches new transactions for the given `address` between the last
    /// synced block stored in the database and the latest block on the chain. It saves
    /// retrieved transactions, updates the sync status, and returns the final status.
    ///
    /// # Arguments
    ///
    /// * `chain` - The identifier of the blockchain to sync against.
    /// * `address` - The account address whose transactions are being synchronized.
    /// * `profile_id` - The profile identifier associated with the account in the database.
    ///
    /// # Returns
    ///
    /// On success, returns a `SyncStatus` indicating the synchronization result. On failure,
    /// returns an error wrapped in `anyhow::Result`.
    pub async fn sync_account(
        &self,
        chain: &str,
        address: &str,
        profile_id: &str,
    ) -> Result<SyncStatus> {
        let mut indexer = self.indexer.lock().await;

        // Connect to chain if not already connected
        indexer.connect(chain).await?;

        // Get current block height
        let current_block = indexer.get_latest_block(chain).await?;

        // Get last synced block from database
        let db = self.db.lock().await;
        let last_synced_block = self.get_last_synced_block(&db, profile_id, chain).await?;

        // Fetch transactions
        let transactions = indexer
            .fetch_account_transactions(
                chain,
                address,
                Some(last_synced_block),
                Some(current_block),
            )
            .await?;

        // Save transactions to database
        self.save_transactions(&db, profile_id, &transactions)
            .await?;

        // Update sync status
        self.update_sync_status(&db, profile_id, chain, current_block)
            .await?;

        Ok(SyncStatus {
            chain: chain.to_string(),
            last_block: last_synced_block as i64,
            current_block: current_block as i64,
            is_syncing: false,
            progress: 100.0,
        })
    }

    async fn get_last_synced_block(
        &self,
        db: &Database,
        profile_id: &str,
        chain: &str,
    ) -> Result<u32> {
        let result: Option<(i64,)> = sqlx::query_as(
            "SELECT last_synced_block FROM sync_status WHERE profile_id = ? AND chain = ?",
        )
        .bind(profile_id)
        .bind(chain)
        .fetch_optional(&db.pool)
        .await?;

        Ok(result.map_or(0, |(block,)| block as u32))
    }

    async fn save_transactions(
        &self,
        db: &Database,
        profile_id: &str,
        transactions: &[Transaction],
    ) -> Result<()> {
        // Save transactions to database
        for tx in transactions {
            sqlx::query(
                r#"
                INSERT INTO transactions (
                    profile_id, chain, hash, block_number, timestamp,
                    from_address, to_address, value, token_symbol, token_decimals,
                    transaction_type, status, fee, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(hash, chain) DO NOTHING
                "#,
            )
            .bind(profile_id)
            .bind(&tx.chain)
            .bind(&tx.hash)
            .bind(tx.block_number)
            .bind(tx.timestamp)
            .bind(&tx.from_address)
            .bind(&tx.to_address)
            .bind(&tx.value)
            .bind(&tx.token_symbol)
            .bind(tx.token_decimals)
            .bind(&tx.transaction_type)
            .bind(&tx.status)
            .bind(&tx.fee)
            .bind(serde_json::to_string(&tx.metadata)?)
            .execute(&db.pool)
            .await?;
        }

        Ok(())
    }

    async fn update_sync_status(
        &self,
        db: &Database,
        profile_id: &str,
        chain: &str,
        block: u32,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO sync_status (profile_id, chain, last_synced_block, last_sync_time)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(profile_id, chain) DO UPDATE SET
                last_synced_block = excluded.last_synced_block,
                last_sync_time = excluded.last_sync_time
            "#,
        )
        .bind(profile_id)
        .bind(chain)
        .bind(block)
        .execute(&db.pool)
        .await?;

        Ok(())
    }
}
