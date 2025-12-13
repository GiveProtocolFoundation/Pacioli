use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use tauri::State;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Wallet {
    pub id: String,
    pub profile_id: String,
    pub address: String,
    pub chain: String,
    pub name: Option<String>,
    pub wallet_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StoredTransaction {
    pub id: String,
    pub wallet_id: String,
    pub hash: String,
    pub block_number: Option<i64>,
    pub timestamp: Option<DateTime<Utc>>,
    pub from_address: Option<String>,
    pub to_address: Option<String>,
    pub value: Option<String>,
    pub fee: Option<String>,
    pub status: Option<String>,
    pub tx_type: Option<String>,
    pub token_symbol: Option<String>,
    pub token_decimals: Option<i32>,
    pub chain: String,
    pub raw_data: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInput {
    pub profile_id: String,
    pub address: String,
    pub chain: String,
    pub name: Option<String>,
    pub wallet_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInput {
    pub hash: String,
    pub block_number: Option<i64>,
    pub timestamp: Option<String>,
    pub from_address: Option<String>,
    pub to_address: Option<String>,
    pub value: Option<String>,
    pub fee: Option<String>,
    pub status: Option<String>,
    pub tx_type: Option<String>,
    pub token_symbol: Option<String>,
    pub token_decimals: Option<i32>,
    pub chain: String,
    pub raw_data: Option<String>,
}

// ============================================================================
// Database State
// ============================================================================

pub struct DatabaseState {
    pub pool: SqlitePool,
}

impl DatabaseState {
    pub async fn new(database_path: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(database_path).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self { pool })
    }
}

// ============================================================================
// Profile Commands
// ============================================================================

#[tauri::command]
pub async fn create_profile(
    state: State<'_, DatabaseState>,
    name: String,
) -> Result<Profile, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO profiles (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&name)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Profile {
        id,
        name,
        avatar_url: None,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_profiles(state: State<'_, DatabaseState>) -> Result<Vec<Profile>, String> {
    let profiles = sqlx::query_as::<_, Profile>("SELECT * FROM profiles ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

#[tauri::command]
pub async fn update_profile(
    state: State<'_, DatabaseState>,
    id: String,
    name: String,
) -> Result<Profile, String> {
    let now = Utc::now();

    sqlx::query("UPDATE profiles SET name = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(now)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let profile = sqlx::query_as::<_, Profile>("SELECT * FROM profiles WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub async fn delete_profile(state: State<'_, DatabaseState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM profiles WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Wallet Commands
// ============================================================================

#[tauri::command]
pub async fn save_wallet(
    state: State<'_, DatabaseState>,
    wallet: WalletInput,
) -> Result<Wallet, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO wallets (id, profile_id, address, chain, name, wallet_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, address, chain) DO UPDATE SET
            name = excluded.name,
            wallet_type = excluded.wallet_type,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&id)
    .bind(&wallet.profile_id)
    .bind(&wallet.address)
    .bind(&wallet.chain)
    .bind(&wallet.name)
    .bind(&wallet.wallet_type)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Fetch the wallet (might be the existing one if conflict occurred)
    let saved_wallet = sqlx::query_as::<_, Wallet>(
        "SELECT * FROM wallets WHERE profile_id = ? AND address = ? AND chain = ?",
    )
    .bind(&wallet.profile_id)
    .bind(&wallet.address)
    .bind(&wallet.chain)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(saved_wallet)
}

#[tauri::command]
pub async fn get_wallets(
    state: State<'_, DatabaseState>,
    profile_id: String,
) -> Result<Vec<Wallet>, String> {
    let wallets = sqlx::query_as::<_, Wallet>(
        "SELECT * FROM wallets WHERE profile_id = ? ORDER BY created_at DESC",
    )
    .bind(&profile_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(wallets)
}

#[tauri::command]
pub async fn get_wallet_by_id(
    state: State<'_, DatabaseState>,
    id: String,
) -> Result<Option<Wallet>, String> {
    let wallet = sqlx::query_as::<_, Wallet>("SELECT * FROM wallets WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(wallet)
}

#[tauri::command]
pub async fn delete_wallet(state: State<'_, DatabaseState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM wallets WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Transaction Commands
// ============================================================================

#[tauri::command]
pub async fn save_transactions(
    state: State<'_, DatabaseState>,
    wallet_id: String,
    transactions: Vec<TransactionInput>,
) -> Result<usize, String> {
    let now = Utc::now();
    let mut saved_count = 0;

    for tx in transactions {
        let id = Uuid::new_v4().to_string();
        let timestamp = tx
            .timestamp
            .as_ref()
            .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
            .map(|t| t.with_timezone(&Utc));

        let result = sqlx::query(
            r#"
            INSERT INTO transactions (
                id, wallet_id, hash, block_number, timestamp, from_address, to_address,
                value, fee, status, tx_type, token_symbol, token_decimals, chain, raw_data, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(wallet_id, hash) DO UPDATE SET
                block_number = excluded.block_number,
                timestamp = excluded.timestamp,
                status = excluded.status,
                raw_data = excluded.raw_data
            "#,
        )
        .bind(&id)
        .bind(&wallet_id)
        .bind(&tx.hash)
        .bind(tx.block_number)
        .bind(timestamp)
        .bind(&tx.from_address)
        .bind(&tx.to_address)
        .bind(&tx.value)
        .bind(&tx.fee)
        .bind(&tx.status)
        .bind(&tx.tx_type)
        .bind(&tx.token_symbol)
        .bind(tx.token_decimals)
        .bind(&tx.chain)
        .bind(&tx.raw_data)
        .bind(now)
        .execute(&state.pool)
        .await;

        if result.is_ok() {
            saved_count += 1;
        }
    }

    Ok(saved_count)
}

#[tauri::command]
pub async fn get_transactions(
    state: State<'_, DatabaseState>,
    wallet_id: String,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<StoredTransaction>, String> {
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let transactions = sqlx::query_as::<_, StoredTransaction>(
        r#"
        SELECT * FROM transactions
        WHERE wallet_id = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
        "#,
    )
    .bind(&wallet_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(transactions)
}

#[tauri::command]
pub async fn get_all_transactions(
    state: State<'_, DatabaseState>,
    profile_id: String,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<StoredTransaction>, String> {
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let transactions = sqlx::query_as::<_, StoredTransaction>(
        r#"
        SELECT t.* FROM transactions t
        INNER JOIN wallets w ON t.wallet_id = w.id
        WHERE w.profile_id = ?
        ORDER BY t.timestamp DESC
        LIMIT ? OFFSET ?
        "#,
    )
    .bind(&profile_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(transactions)
}

#[tauri::command]
pub async fn delete_transactions(
    state: State<'_, DatabaseState>,
    wallet_id: String,
) -> Result<u64, String> {
    let result = sqlx::query("DELETE FROM transactions WHERE wallet_id = ?")
        .bind(&wallet_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.rows_affected())
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
pub async fn get_setting(
    state: State<'_, DatabaseState>,
    key: String,
) -> Result<Option<String>, String> {
    let result = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn set_setting(
    state: State<'_, DatabaseState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&key)
    .bind(&value)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_setting(state: State<'_, DatabaseState>, key: String) -> Result<(), String> {
    sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(&key)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_all_settings(
    state: State<'_, DatabaseState>,
) -> Result<Vec<(String, String)>, String> {
    let settings = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(settings)
}
