use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use tauri::State;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Represents a user profile with unique ID, name, optional avatar URL, and timestamps.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Profile {
    /// The unique identifier of the profile.
    pub id: String,
    /// The display name of the user.
    pub name: String,
    /// The optional URL of the user's avatar image.
    pub avatar_url: Option<String>,
    /// The timestamp when the profile was created.
    pub created_at: DateTime<Utc>,
    /// The timestamp when the profile was last updated.
    pub updated_at: DateTime<Utc>,
}

/// Represents a cryptocurrency wallet associated with a user profile.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Wallet {
    /// The unique identifier of the wallet.
    pub id: String,
    /// The identifier of the associated user profile.
    pub profile_id: String,
    /// The blockchain address of the wallet.
    pub address: String,
    /// The blockchain network identifier (e.g., Ethereum, Bitcoin).
    pub chain: String,
    /// An optional display name for the wallet.
    pub name: Option<String>,
    /// The type of the wallet (e.g., hardware, software).
    pub wallet_type: String,
    /// The timestamp when the wallet was created.
    pub created_at: DateTime<Utc>,
    /// The optional timestamp when the wallet was last updated.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Represents a stored transaction record with metadata and blockchain details.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StoredTransaction {
    /// The unique identifier of the stored transaction.
    pub id: String,
    /// The identifier of the wallet associated with the transaction.
    pub wallet_id: String,
    /// The blockchain transaction hash.
    pub hash: String,
    /// The optional block number where the transaction was recorded.
    pub block_number: Option<i64>,
    /// The optional timestamp of when the transaction occurred.
    pub timestamp: Option<DateTime<Utc>>,
    /// The optional sender address of the transaction.
    pub from_address: Option<String>,
    /// The optional recipient address of the transaction.
    pub to_address: Option<String>,
    /// The optional value transferred in the transaction.
    pub value: Option<String>,
    /// The optional transaction fee paid.
    pub fee: Option<String>,
    /// The optional status of the transaction (e.g., pending, confirmed).
    pub status: Option<String>,
    /// The optional type of the transaction.
    pub tx_type: Option<String>,
    /// The optional symbol of the token involved.
    pub token_symbol: Option<String>,
    /// The optional decimal precision of the token.
    pub token_decimals: Option<i32>,
    /// The blockchain network identifier for the transaction.
    pub chain: String,
    /// The optional raw data of the transaction.
    pub raw_data: Option<String>,
    /// The timestamp when the transaction was stored.
    pub created_at: DateTime<Utc>,
}

/// Input data for creating or updating a wallet in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInput {
    /// The identifier of the profile to which the wallet belongs.
    pub profile_id: String,
    /// The blockchain address of the wallet.
    pub address: String,
    /// The blockchain network identifier.
    pub chain: String,
    /// An optional display name for the wallet.
    pub name: Option<String>,
    /// The type of the wallet (e.g., hardware, software).
    pub wallet_type: String,
}

/// Input data for saving or updating transactions in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInput {
    /// The blockchain transaction hash.
    pub hash: String,
    /// The optional block number where the transaction was recorded.
    pub block_number: Option<i64>,
    /// The optional timestamp of when the transaction occurred, as an ISO 8601 string.
    pub timestamp: Option<String>,
    /// The optional sender address of the transaction.
    pub from_address: Option<String>,
    /// The optional recipient address of the transaction.
    pub to_address: Option<String>,
    /// The optional value transferred in the transaction.
    pub value: Option<String>,
    /// The optional transaction fee paid.
    pub fee: Option<String>,
    /// The optional status of the transaction (e.g., pending, confirmed).
    pub status: Option<String>,
    /// The optional type of the transaction.
    pub tx_type: Option<String>,
    /// The optional symbol of the token involved.
    pub token_symbol: Option<String>,
    /// The optional decimal precision of the token.
    pub token_decimals: Option<i32>,
    /// The blockchain network identifier for the transaction.
    pub chain: String,
    /// The optional raw data of the transaction.
    pub raw_data: Option<String>,
}

// ============================================================================
// Database State
// ============================================================================

/// Maintains the SQLite connection pool for database operations.
pub struct DatabaseState {
    /// The SQLite database connection pool for executing queries.
    pub pool: SqlitePool,
}

impl DatabaseState {
    /// Creates a new DatabaseState by connecting to the specified SQLite database path and running migrations.
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

/// Creates a new user profile with the given name and returns the created Profile.
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

/// Retrieves all user profiles ordered by creation time, newest first.
#[tauri::command]
pub async fn get_profiles(state: State<'_, DatabaseState>) -> Result<Vec<Profile>, String> {
    let profiles = sqlx::query_as::<_, Profile>("SELECT * FROM profiles ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

/// Updates the name of an existing profile by ID and returns the updated Profile.
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

/// Deletes a user profile by ID from the database.
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

/// Saves a new wallet or updates an existing one for a profile and returns the Wallet.
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

/// Retrieves all wallets for a given profile ordered by creation time.
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

/// Retrieves a wallet by its unique ID, or None if not found.
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

/// Deletes a wallet by its unique ID from the database.
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

/// Saves or updates a batch of transactions for the specified wallet and returns the number of saved records.
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

/// Retrieves a list of stored transactions for the specified wallet ID.
/// Transactions are ordered by descending timestamp with pagination support.
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

/// Retrieves all stored transactions for wallets associated with the given profile ID.
/// Transactions are ordered by descending timestamp with pagination support.
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

/// Deletes all transactions for the specified wallet ID and returns the number of rows deleted.
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

/// Retrieves the value associated with the given key from settings.
/// Returns `None` if the key does not exist.
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

/// Inserts or updates a setting value for the given key with the current timestamp.
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

/// Deletes the setting associated with the given key.
#[tauri::command]
pub async fn delete_setting(state: State<'_, DatabaseState>, key: String) -> Result<(), String> {
    sqlx::query("DELETE FROM settings WHERE key = ?")
        .bind(&key)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Retrieves all settings as a list of key-value pairs.
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

// ============================================================================
// Chain Transaction Commands (multi_chain_transactions table)
// ============================================================================

/// Input for chain-level transaction saving. The frontend serializes the full
/// Transaction object into raw_data so it can be reconstructed on read.
#[derive(Debug, Clone, Deserialize)]
pub struct ChainTransactionInput {
    #[allow(dead_code)]
    pub id: String,
    pub hash: String,
    pub block_number: Option<i64>,
    pub timestamp: i64,
    pub from_address: String,
    pub to_address: Option<String>,
    pub value: String,
    pub fee: Option<String>,
    pub status: String,
    pub tx_type: String,
    pub raw_data: String,
}

/// Row type for reading chain transactions back.
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ChainTransactionRow {
    pub id: String,
    pub chain_id: String,
    pub hash: String,
    pub from_address: String,
    pub to_address: Option<String>,
    pub value: String,
    pub fee: Option<String>,
    pub timestamp: i64,
    pub block_number: Option<i64>,
    pub tx_type: String,
    pub status: String,
    pub raw_data: Option<String>,
}

/// Row type for sync status.
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ChainSyncStatusRow {
    pub chain_id: String,
    pub address: String,
    pub last_block_synced: i64,
    pub last_sync_timestamp: Option<i64>,
    pub sync_state: Option<String>,
}

/// Saves chain transactions into multi_chain_transactions with upsert semantics.
/// The full frontend Transaction object is preserved in raw_data for lossless round-trips.
#[tauri::command]
pub async fn save_chain_transactions(
    state: State<'_, DatabaseState>,
    network: String,
    address: String,
    transactions: Vec<ChainTransactionInput>,
) -> Result<usize, String> {
    let _ = &address; // address captured for context; chain_id from network
    let mut saved = 0;

    for tx in &transactions {
        let composite_id = format!("{}_{}", network, tx.hash);

        let result = sqlx::query(
            r#"
            INSERT INTO multi_chain_transactions (
                id, chain_id, hash, from_address, to_address,
                value, fee, timestamp, block_number, tx_type,
                status, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chain_id, hash) DO UPDATE SET
                from_address = excluded.from_address,
                to_address = excluded.to_address,
                value = excluded.value,
                fee = excluded.fee,
                timestamp = excluded.timestamp,
                block_number = excluded.block_number,
                tx_type = excluded.tx_type,
                status = excluded.status,
                raw_data = excluded.raw_data
            "#,
        )
        .bind(&composite_id)
        .bind(&network)
        .bind(&tx.hash)
        .bind(&tx.from_address)
        .bind(&tx.to_address)
        .bind(&tx.value)
        .bind(&tx.fee)
        .bind(tx.timestamp)
        .bind(tx.block_number)
        .bind(&tx.tx_type)
        .bind(&tx.status)
        .bind(&tx.raw_data)
        .execute(&state.pool)
        .await;

        if result.is_ok() {
            saved += 1;
        }
    }

    Ok(saved)
}

/// Retrieves chain transactions for a network+address pair.
/// Returns rows with raw_data so the frontend can deserialize the full Transaction objects.
#[tauri::command]
pub async fn get_chain_transactions(
    state: State<'_, DatabaseState>,
    network: String,
    address: String,
) -> Result<Vec<ChainTransactionRow>, String> {
    let rows = sqlx::query_as::<_, ChainTransactionRow>(
        r#"
        SELECT id, chain_id, hash, from_address, to_address, value, fee,
               timestamp, block_number, tx_type, status, raw_data
        FROM multi_chain_transactions
        WHERE chain_id = ?
        AND (from_address = ? OR to_address = ?
             OR LOWER(from_address) = LOWER(?) OR LOWER(to_address) = LOWER(?))
        ORDER BY timestamp DESC
        "#,
    )
    .bind(&network)
    .bind(&address)
    .bind(&address)
    .bind(&address)
    .bind(&address)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Loads the sync status for a network+address pair.
#[tauri::command]
pub async fn load_chain_sync_status(
    state: State<'_, DatabaseState>,
    network: String,
    address: String,
) -> Result<Option<ChainSyncStatusRow>, String> {
    let row = sqlx::query_as::<_, ChainSyncStatusRow>(
        r#"
        SELECT chain_id, address, last_block_synced, last_sync_timestamp, sync_state
        FROM address_sync_status
        WHERE chain_id = ?
        AND (address = ? OR LOWER(address) = LOWER(?))
        "#,
    )
    .bind(&network)
    .bind(&address)
    .bind(&address)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row)
}

/// Saves/updates the sync status for a network+address pair.
#[tauri::command]
pub async fn save_chain_sync_status(
    state: State<'_, DatabaseState>,
    network: String,
    address: String,
    last_block: i64,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    sqlx::query(
        r#"
        INSERT INTO address_sync_status (chain_id, address, last_block_synced, last_sync_timestamp, sync_state)
        VALUES (?, ?, ?, ?, 'idle')
        ON CONFLICT(chain_id, address) DO UPDATE SET
            last_block_synced = excluded.last_block_synced,
            last_sync_timestamp = excluded.last_sync_timestamp,
            sync_state = 'idle',
            error_message = NULL
        "#,
    )
    .bind(&network)
    .bind(&address)
    .bind(last_block)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Clears all chain transactions from multi_chain_transactions.
#[tauri::command]
pub async fn clear_chain_transactions(
    state: State<'_, DatabaseState>,
) -> Result<u64, String> {
    let result = sqlx::query("DELETE FROM multi_chain_transactions")
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.rows_affected())
}
