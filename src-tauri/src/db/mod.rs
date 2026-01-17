pub mod transactions;

use anyhow::Result;
use sqlx::{Pool, Sqlite, SqlitePool};

pub struct Database {
    pub pool: Pool<Sqlite>,
}

#[allow(dead_code)]
impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = SqlitePool::connect(database_url).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self { pool })
    }

    pub async fn get_transactions(
        &self,
        profile_id: &str,
        start_date: Option<String>,
        end_date: Option<String>,
    ) -> Result<Vec<crate::core::Transaction>> {
        let mut query = "SELECT * FROM transactions WHERE profile_id = ?".to_string();

        if let Some(start) = start_date {
            query.push_str(&format!(" AND timestamp >= '{}'", start));
        }

        if let Some(end) = end_date {
            query.push_str(&format!(" AND timestamp <= '{}'", end));
        }

        query.push_str(" ORDER BY timestamp DESC");

        let transactions = sqlx::query_as(&query)
            .bind(profile_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(transactions)
    }

    pub async fn init_tables(&self) -> Result<()> {
        // Create tables if they don't exist
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                address TEXT NOT NULL,
                chain TEXT NOT NULL,
                nickname TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profile_id) REFERENCES profiles (id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                chain TEXT NOT NULL,
                hash TEXT NOT NULL,
                block_number INTEGER NOT NULL,
                timestamp DATETIME NOT NULL,
                from_address TEXT NOT NULL,
                to_address TEXT,
                value TEXT NOT NULL,
                token_symbol TEXT NOT NULL,
                token_decimals INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                status TEXT NOT NULL,
                fee TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(hash, chain),
                FOREIGN KEY (profile_id) REFERENCES profiles (id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sync_status (
                profile_id TEXT NOT NULL,
                chain TEXT NOT NULL,
                last_synced_block INTEGER NOT NULL DEFAULT 0,
                last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (profile_id, chain),
                FOREIGN KEY (profile_id) REFERENCES profiles (id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
