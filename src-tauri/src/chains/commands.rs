//! Tauri Commands for Chain Operations
//!
//! Exposes chain functionality to the frontend via Tauri's command system.
//! All commands are async and return JSON-serializable results.

use super::{ChainInfo, ChainManager, ChainTransaction, WalletBalances};
use crate::api::persistence::DatabaseState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

/// Shared state type for ChainManager
pub type ChainManagerState = Arc<RwLock<ChainManager>>;

/// Create a new ChainManagerState for Tauri
pub fn create_chain_manager_state() -> ChainManagerState {
    Arc::new(RwLock::new(ChainManager::new()))
}

// =============================================================================
// TAURI COMMANDS
// =============================================================================

/// Get all supported chains
///
/// Returns a list of ChainInfo for all chains supported by the application.
#[tauri::command]
pub async fn chain_get_supported_chains() -> Result<Vec<ChainInfo>, String> {
    Ok(ChainManager::get_supported_chains())
}

/// Check if a chain is supported
///
/// # Arguments
/// * `chain_id` - Chain identifier (name or numeric ID)
#[tauri::command]
pub async fn chain_is_supported(chain_id: String) -> Result<bool, String> {
    Ok(ChainManager::is_chain_supported(&chain_id))
}

/// Validate an address for a specific chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `address` - Address to validate
#[tauri::command]
pub async fn chain_validate_address(
    state: State<'_, ChainManagerState>,
    chain_id: String,
    address: String,
) -> Result<bool, String> {
    let manager = state.read().await;
    manager
        .validate_address(&chain_id, &address)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch transactions for an address on a specific chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `address` - Wallet address
/// * `from_block` - Optional starting block number
#[tauri::command]
pub async fn chain_fetch_transactions(
    state: State<'_, ChainManagerState>,
    chain_id: String,
    address: String,
    from_block: Option<u64>,
) -> Result<Vec<ChainTransaction>, String> {
    let manager = state.read().await;
    manager
        .get_transactions(&chain_id, &address, from_block)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch transactions with resumable sync cursor and canonical persistence.
///
/// Loads the sync cursor from `address_sync_status` to resume from the
/// last synced block, fetches new transactions, **persists them into the
/// canonical `multi_chain_transactions` store (idempotent via
/// `UNIQUE(chain_id, transaction_hash)`)**, and only then advances the
/// cursor. The cursor NEVER advances past transactions that were not
/// durably stored — a persistence failure leaves the cursor untouched so
/// the next sync re-fetches the same range (idempotent upsert absorbs
/// the overlap). This guarantees a wallet's history is never silently
/// incomplete (Phase 4a mandate).
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `address` - Wallet address
#[tauri::command]
pub async fn chain_fetch_transactions_resumable(
    chain_state: State<'_, ChainManagerState>,
    db_state: State<'_, DatabaseState>,
    chain_id: String,
    address: String,
) -> Result<Vec<ChainTransaction>, String> {
    // 1. Load sync cursor
    let from_block = load_sync_cursor_impl(&db_state.pool, &chain_id, &address).await?;

    // 2. Fetch transactions from the cursor position
    let manager = chain_state.read().await;
    let txs = manager
        .get_transactions(&chain_id, &address, from_block)
        .await
        .map_err(|e| e.to_string())?;
    drop(manager);

    // 3. Persist into the canonical store BEFORE advancing the cursor.
    //    If this fails the cursor stays put and the range is re-fetched
    //    on the next sync — no silent gaps.
    if !txs.is_empty() {
        persist_chain_transactions_impl(&db_state.pool, &chain_id, &address, &txs).await?;

        // 4. Advance sync cursor to the highest durably-stored block.
        let max_block = txs.iter().map(|tx| tx.block_number).max().unwrap_or(0);
        update_sync_cursor_impl(&db_state.pool, &chain_id, &address, max_block as i64).await?;
    }

    Ok(txs)
}

/// Load the sync cursor (last synced block) for a chain+address pair.
async fn load_sync_cursor_impl(
    pool: &sqlx::SqlitePool,
    chain_id: &str,
    address: &str,
) -> Result<Option<u64>, String> {
    // MAX() always yields one row (NULL when no match) — decode as Option.
    let row = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT MAX(last_block_synced) FROM address_sync_status \
         WHERE chain_id = ? AND LOWER(address) = LOWER(?)",
    )
    .bind(chain_id)
    .bind(address)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .flatten();

    Ok(row.and_then(|b| if b > 0 { Some(b as u64) } else { None }))
}

/// Map a `TransactionStatus` to the `multi_chain_transactions.status`
/// CHECK-constrained value set ('success', 'failed', 'pending').
fn status_column_value(status: &super::TransactionStatus) -> &'static str {
    match status {
        super::TransactionStatus::Success => "success",
        super::TransactionStatus::Failed => "failed",
        super::TransactionStatus::Pending => "pending",
    }
}

/// Map a `TransactionType` to the `multi_chain_transactions.transaction_type`
/// CHECK-constrained value set. The schema CHECK predates the full Rust enum,
/// so variants without a column-level equivalent map to 'unknown' — full
/// fidelity is preserved in `raw_json_data` (schema-debt note in tracker).
fn transaction_type_column_value(tx_type: &super::TransactionType) -> &'static str {
    use super::TransactionType as T;
    match tx_type {
        T::Transfer => "transfer",
        T::Swap => "swap",
        T::Bridge => "bridge",
        T::Stake => "stake",
        T::Unstake => "unstake",
        T::Mint => "mint",
        T::Burn => "burn",
        T::Approval => "approve",
        T::ContractCall => "contract_call",
        // No CHECK-allowed equivalent; raw_json_data keeps the real type.
        T::ContractDeploy | T::AddLiquidity | T::RemoveLiquidity | T::Unknown => "unknown",
    }
}

/// Persist fetched transactions into the canonical `multi_chain_transactions`
/// store. Idempotent: `ON CONFLICT(chain_id, transaction_hash)` upserts, so
/// re-importing the same transaction yields exactly one row (Inv: data-layer
/// dedupe, not service-level). `wallet_address` follows first-importer-wins
/// (matches `save_chain_transactions`, tracker Session 20). Per-row errors
/// propagate — callers must know when history is incomplete.
async fn persist_chain_transactions_impl(
    pool: &sqlx::SqlitePool,
    chain_id: &str,
    wallet_address: &str,
    txs: &[ChainTransaction],
) -> Result<usize, String> {
    let mut saved = 0;

    for tx in txs {
        let composite_id = format!("{}_{}", chain_id, tx.hash);
        let raw_json = serde_json::to_string(tx).map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO multi_chain_transactions (
                id, chain_id, transaction_hash, from_address, to_address,
                transfer_value, transaction_fee, timestamp, block_number,
                transaction_type, status, raw_json_data, wallet_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chain_id, transaction_hash) DO UPDATE SET
                from_address = excluded.from_address,
                to_address = excluded.to_address,
                transfer_value = excluded.transfer_value,
                transaction_fee = excluded.transaction_fee,
                timestamp = excluded.timestamp,
                block_number = excluded.block_number,
                transaction_type = excluded.transaction_type,
                status = excluded.status,
                raw_json_data = excluded.raw_json_data
            "#,
        )
        .bind(&composite_id)
        .bind(chain_id)
        .bind(&tx.hash)
        .bind(&tx.from)
        .bind(&tx.to)
        .bind(&tx.value)
        .bind(&tx.fee)
        .bind(tx.timestamp)
        .bind(tx.block_number as i64)
        .bind(transaction_type_column_value(&tx.tx_type))
        .bind(status_column_value(&tx.status))
        .bind(&raw_json)
        .bind(wallet_address)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        saved += 1;
    }

    Ok(saved)
}

/// Update the sync cursor after transactions were durably persisted.
async fn update_sync_cursor_impl(
    pool: &sqlx::SqlitePool,
    chain_id: &str,
    address: &str,
    last_block: i64,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    sqlx::query(
        "INSERT INTO address_sync_status (chain_id, address, last_block_synced, \
         last_sync_timestamp, sync_state) \
         VALUES (?, ?, ?, ?, 'idle') \
         ON CONFLICT(chain_id, address) DO UPDATE SET \
         last_block_synced = MAX(address_sync_status.last_block_synced, excluded.last_block_synced), \
         last_sync_timestamp = excluded.last_sync_timestamp, \
         sync_state = 'idle', \
         error_message = NULL",
    )
    .bind(chain_id)
    .bind(address)
    .bind(last_block)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Fetch balances for an address on a specific chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `address` - Wallet address
#[tauri::command]
pub async fn chain_fetch_balances(
    state: State<'_, ChainManagerState>,
    chain_id: String,
    address: String,
) -> Result<WalletBalances, String> {
    let manager = state.read().await;
    manager
        .get_balances(&chain_id, &address)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch a single transaction by hash
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `hash` - Transaction hash
#[tauri::command]
pub async fn chain_fetch_transaction(
    state: State<'_, ChainManagerState>,
    chain_id: String,
    hash: String,
) -> Result<ChainTransaction, String> {
    let manager = state.read().await;
    manager
        .get_transaction(&chain_id, &hash)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch balances for multiple address/chain pairs
///
/// # Arguments
/// * `addresses` - List of (chain_id, address) pairs
#[tauri::command]
pub async fn chain_fetch_all_balances(
    state: State<'_, ChainManagerState>,
    addresses: Vec<(String, String)>,
) -> Result<Vec<WalletBalances>, String> {
    let manager = state.read().await;
    let results = manager.get_all_balances(addresses).await;

    // Collect successful results, skip unsupported or failed chains
    let mut balances = Vec::new();
    for result in results {
        match result {
            Ok(balance) => balances.push(balance),
            Err(e) => {
                eprintln!("Failed to fetch balance: {e}");
            }
        }
    }

    Ok(balances)
}

/// Fetch transactions for multiple chains for a single address
///
/// # Arguments
/// * `address` - Wallet address
/// * `chain_ids` - List of chain identifiers
/// * `from_block` - Optional starting block number
#[tauri::command]
pub async fn chain_fetch_all_transactions(
    state: State<'_, ChainManagerState>,
    address: String,
    chain_ids: Vec<String>,
    from_block: Option<u64>,
) -> Result<Vec<ChainTransaction>, String> {
    let manager = state.read().await;
    let chain_refs: Vec<&str> = chain_ids.iter().map(|s| s.as_str()).collect();
    let results = manager
        .get_all_transactions(&address, &chain_refs, from_block)
        .await;

    // Combine all transactions into a single list
    let mut all_transactions = Vec::new();
    for (chain_id, result) in results {
        match result {
            Ok(txs) => all_transactions.extend(txs),
            Err(e) => {
                // Log error but continue with other chains
                eprintln!("Error fetching transactions from {}: {}", chain_id, e);
            }
        }
    }

    // Sort by timestamp descending
    all_transactions.sort_by_key(|b| std::cmp::Reverse(b.timestamp));

    Ok(all_transactions)
}

/// Connect to a specific chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
#[tauri::command]
pub async fn chain_connect(
    state: State<'_, ChainManagerState>,
    chain_id: String,
) -> Result<String, String> {
    let manager = state.read().await;
    manager
        .connect(&chain_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("Connected to {}", chain_id))
}

/// Set an explorer API key for a chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `api_key` - API key for the block explorer
#[tauri::command]
pub async fn chain_set_explorer_api_key(
    state: State<'_, ChainManagerState>,
    chain_id: String,
    api_key: String,
) -> Result<(), String> {
    let manager = state.read().await;
    manager.set_explorer_api_key(&chain_id, api_key).await;
    Ok(())
}

/// Set a custom RPC URL for a chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
/// * `rpc_url` - Custom RPC endpoint URL
#[tauri::command]
pub async fn chain_set_rpc_url(
    state: State<'_, ChainManagerState>,
    chain_id: String,
    rpc_url: String,
) -> Result<(), String> {
    let manager = state.read().await;
    manager.set_rpc_override(&chain_id, rpc_url).await;
    Ok(())
}

/// Get current block number for a chain
///
/// # Arguments
/// * `chain_id` - Chain identifier
#[tauri::command]
pub async fn chain_get_block_number(
    state: State<'_, ChainManagerState>,
    chain_id: String,
) -> Result<u64, String> {
    let manager = state.read().await;
    let adapter = manager
        .get_adapter(&chain_id)
        .await
        .map_err(|e| e.to_string())?;
    let adapter = adapter.read().await;
    adapter.get_block_number().await.map_err(|e| e.to_string())
}

// =============================================================================
// BITCOIN-SPECIFIC COMMANDS
// =============================================================================

use super::bitcoin::{
    BitcoinAdapter, BitcoinBalance, BitcoinTransaction, BitcoinUtxo, DerivedAddress, XpubInfo,
    XpubPortfolio,
};

/// Get Bitcoin transactions for an address
///
/// # Arguments
/// * `address` - Bitcoin address (legacy, SegWit, or Taproot)
/// * `network` - Network name ("bitcoin", "testnet", "signet")
/// * `max_pages` - Maximum pages to fetch (25 txs per page)
#[tauri::command]
pub async fn get_bitcoin_transactions(
    address: String,
    network: Option<String>,
    max_pages: Option<usize>,
) -> Result<Vec<BitcoinTransaction>, String> {
    let network_name = network.as_deref().unwrap_or("bitcoin");
    let adapter = BitcoinAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    adapter
        .fetch_transactions(&address, max_pages)
        .await
        .map_err(|e| e.to_string())
}

/// Get Bitcoin balance for an address
///
/// # Arguments
/// * `address` - Bitcoin address
/// * `network` - Network name ("bitcoin", "testnet", "signet")
#[tauri::command]
pub async fn get_bitcoin_balance(
    address: String,
    network: Option<String>,
) -> Result<BitcoinBalance, String> {
    let network_name = network.as_deref().unwrap_or("bitcoin");
    let adapter = BitcoinAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    adapter
        .fetch_balance(&address)
        .await
        .map_err(|e| e.to_string())
}

/// Get Bitcoin UTXOs for an address
///
/// # Arguments
/// * `address` - Bitcoin address
/// * `network` - Network name ("bitcoin", "testnet", "signet")
#[tauri::command]
pub async fn get_bitcoin_utxos(
    address: String,
    network: Option<String>,
) -> Result<Vec<BitcoinUtxo>, String> {
    let network_name = network.as_deref().unwrap_or("bitcoin");
    let adapter = BitcoinAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    adapter
        .fetch_utxos(&address)
        .await
        .map_err(|e| e.to_string())
}

/// Validate a Bitcoin address
///
/// # Arguments
/// * `address` - Bitcoin address to validate
#[tauri::command]
pub async fn validate_bitcoin_address(address: String) -> Result<bool, String> {
    Ok(super::bitcoin::validate_bitcoin_address(&address).is_ok())
}

// =============================================================================
// SOLANA-SPECIFIC COMMANDS
// =============================================================================

use super::solana::{SolanaAdapter, SolanaBalance, SolanaTransaction};

/// Get Solana transactions for an address
///
/// # Arguments
/// * `address` - Solana address (base58 encoded)
/// * `network` - Network name ("solana", "solana_devnet")
/// * `max_pages` - Maximum pages to fetch (~100 txs per page)
#[tauri::command]
pub async fn get_solana_transactions(
    address: String,
    network: Option<String>,
    max_pages: Option<usize>,
) -> Result<Vec<SolanaTransaction>, String> {
    let network_name = network.as_deref().unwrap_or("solana");
    let adapter = SolanaAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    adapter
        .fetch_transactions(&address, max_pages)
        .await
        .map_err(|e| e.to_string())
}

/// Get Solana balance for an address
///
/// # Arguments
/// * `address` - Solana address
/// * `network` - Network name ("solana", "solana_devnet")
#[tauri::command]
pub async fn get_solana_balance(
    address: String,
    network: Option<String>,
) -> Result<SolanaBalance, String> {
    let network_name = network.as_deref().unwrap_or("solana");
    let adapter = SolanaAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    adapter
        .fetch_balance(&address)
        .await
        .map_err(|e| e.to_string())
}

/// Validate a Solana address
///
/// # Arguments
/// * `address` - Solana address to validate
#[tauri::command]
pub async fn validate_solana_address(address: String) -> Result<bool, String> {
    Ok(super::solana::validate_solana_address(&address).is_ok())
}

// =============================================================================
// BITCOIN XPUB COMMANDS (Phase 5)
// =============================================================================

/// Check if a string is a valid xPub format
///
/// # Arguments
/// * `input` - String to check (xpub/ypub/zpub/tpub/upub/vpub)
#[tauri::command]
pub async fn bitcoin_is_xpub(input: String) -> Result<bool, String> {
    Ok(super::bitcoin::is_xpub(&input))
}

/// Parse and validate an xPub string
///
/// # Arguments
/// * `xpub` - Extended public key string
///
/// # Returns
/// XpubInfo with address type, network, and fingerprint
#[tauri::command]
pub async fn bitcoin_parse_xpub(xpub: String) -> Result<XpubInfo, String> {
    super::bitcoin::parse_xpub(&xpub).map_err(|e| e.to_string())
}

/// Derive addresses from an xPub
///
/// # Arguments
/// * `xpub` - Extended public key string (xpub/ypub/zpub/tpub/upub/vpub)
/// * `receiving_count` - Number of receiving addresses to derive (external chain)
/// * `change_count` - Number of change addresses to derive (internal chain)
///
/// # Returns
/// XpubPortfolio containing xPub info and derived addresses
#[tauri::command]
pub async fn bitcoin_derive_addresses(
    xpub: String,
    receiving_count: u32,
    change_count: u32,
) -> Result<XpubPortfolio, String> {
    super::bitcoin::derive_addresses(&xpub, receiving_count, change_count)
        .map_err(|e| e.to_string())
}

/// Fetch balances for all addresses derived from an xPub
///
/// Derives addresses from the xPub and fetches balances for each using Mempool.space API.
///
/// # Arguments
/// * `xpub` - Extended public key string
/// * `receiving_count` - Number of receiving addresses to check
/// * `change_count` - Number of change addresses to check
/// * `network` - Network name ("bitcoin", "testnet", "signet")
///
/// # Returns
/// Vector of (address, balance) tuples for addresses with non-zero activity
#[tauri::command]
pub async fn bitcoin_fetch_xpub_balances(
    xpub: String,
    receiving_count: u32,
    change_count: u32,
    network: Option<String>,
) -> Result<Vec<(DerivedAddress, BitcoinBalance)>, String> {
    // Derive addresses
    let portfolio = super::bitcoin::derive_addresses(&xpub, receiving_count, change_count)
        .map_err(|e| e.to_string())?;

    // Create adapter for fetching balances
    let network_name = network.as_deref().unwrap_or("bitcoin");
    let adapter = BitcoinAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    // Fetch balances for receiving addresses
    for addr in portfolio.receiving_addresses {
        match adapter.fetch_balance(&addr.address).await {
            Ok(balance) => {
                // Only include addresses with activity
                if balance.tx_count > 0 || balance.balance > 0 {
                    results.push((addr, balance));
                }
            }
            Err(e) => {
                eprintln!("Failed to fetch balance for {}: {}", addr.address, e);
                // Continue with other addresses
            }
        }
    }

    // Fetch balances for change addresses
    for addr in portfolio.change_addresses {
        match adapter.fetch_balance(&addr.address).await {
            Ok(balance) => {
                // Only include addresses with activity
                if balance.tx_count > 0 || balance.balance > 0 {
                    results.push((addr, balance));
                }
            }
            Err(e) => {
                eprintln!("Failed to fetch balance for {}: {}", addr.address, e);
            }
        }
    }

    Ok(results)
}

/// Fetch transactions for all addresses derived from an xPub
///
/// # Arguments
/// * `xpub` - Extended public key string
/// * `receiving_count` - Number of receiving addresses to check
/// * `change_count` - Number of change addresses to check
/// * `network` - Network name ("bitcoin", "testnet", "signet")
/// * `max_pages_per_address` - Maximum pages of transactions per address
///
/// # Returns
/// Vector of transactions with the derived address info attached
#[tauri::command]
pub async fn bitcoin_fetch_xpub_transactions(
    xpub: String,
    receiving_count: u32,
    change_count: u32,
    network: Option<String>,
    max_pages_per_address: Option<usize>,
) -> Result<Vec<(DerivedAddress, Vec<BitcoinTransaction>)>, String> {
    // Derive addresses
    let portfolio = super::bitcoin::derive_addresses(&xpub, receiving_count, change_count)
        .map_err(|e| e.to_string())?;

    // Create adapter for fetching transactions
    let network_name = network.as_deref().unwrap_or("bitcoin");
    let adapter = BitcoinAdapter::from_network(network_name).map_err(|e| e.to_string())?;

    let max_pages = max_pages_per_address.or(Some(2)); // Default to 2 pages (50 txs) per address
    let mut results = Vec::new();

    // Combine all addresses
    let all_addresses: Vec<DerivedAddress> = portfolio
        .receiving_addresses
        .into_iter()
        .chain(portfolio.change_addresses)
        .collect();

    // Fetch transactions for each address
    for addr in all_addresses {
        match adapter.fetch_transactions(&addr.address, max_pages).await {
            Ok(txs) => {
                if !txs.is_empty() {
                    results.push((addr, txs));
                }
            }
            Err(e) => {
                eprintln!("Failed to fetch transactions for {}: {}", addr.address, e);
                // Continue with other addresses
            }
        }
    }

    Ok(results)
}

// =============================================================================
// COMMAND HANDLER MACRO
// =============================================================================

/// Generate the invoke handler for all chain commands
///
/// Use this in lib.rs:
/// ```ignore
/// .invoke_handler(tauri::generate_handler![
///     // ... other commands ...
///     chains::chain_get_supported_chains,
///     chains::chain_is_supported,
///     chains::chain_validate_address,
///     chains::chain_fetch_transactions,
///     chains::chain_fetch_balances,
///     chains::chain_fetch_transaction,
///     chains::chain_fetch_all_balances,
///     chains::chain_fetch_all_transactions,
///     chains::chain_connect,
///     chains::chain_set_explorer_api_key,
///     chains::chain_set_rpc_url,
///     chains::chain_get_block_number,
///     // Bitcoin commands
///     chains::get_bitcoin_transactions,
///     chains::get_bitcoin_balance,
///     chains::get_bitcoin_utxos,
///     chains::validate_bitcoin_address,
/// ])
/// ```
#[cfg(test)]
mod tests {
    use super::*;
    use crate::chains::{ChainId, TransactionStatus, TransactionType};

    #[test]
    fn test_create_chain_manager_state() {
        let state = create_chain_manager_state();
        // Just verify it creates without error
        assert!(Arc::strong_count(&state) == 1);
    }

    async fn test_pool() -> sqlx::SqlitePool {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .expect("in-memory pool");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations");
        pool
    }

    fn sample_tx(hash: &str, block: u64, tx_type: TransactionType) -> ChainTransaction {
        ChainTransaction {
            hash: hash.to_string(),
            chain_id: ChainId::evm("moonbeam", 1284),
            block_number: block,
            timestamp: 1_750_000_000,
            from: "0xfrom".to_string(),
            to: Some("0xto".to_string()),
            value: "1000000000000000000".to_string(),
            fee: "21000".to_string(),
            status: TransactionStatus::Success,
            tx_type,
            token_transfers: vec![],
            raw_data: None,
        }
    }

    #[tokio::test]
    async fn test_persist_is_idempotent_at_data_layer() {
        let pool = test_pool().await;
        let txs = vec![sample_tx("0xabc", 100, TransactionType::Transfer)];

        // Import the same transaction twice — exactly one row must exist.
        let n1 = persist_chain_transactions_impl(&pool, "moonbeam", "0xwallet", &txs)
            .await
            .unwrap();
        let n2 = persist_chain_transactions_impl(&pool, "moonbeam", "0xwallet", &txs)
            .await
            .unwrap();
        assert_eq!(n1, 1);
        assert_eq!(n2, 1);

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM multi_chain_transactions \
             WHERE chain_id = 'moonbeam' AND transaction_hash = '0xabc'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_persist_wallet_address_first_importer_wins() {
        let pool = test_pool().await;
        let txs = vec![sample_tx("0xshared", 50, TransactionType::Transfer)];

        persist_chain_transactions_impl(&pool, "moonbeam", "0xwallet_a", &txs)
            .await
            .unwrap();
        persist_chain_transactions_impl(&pool, "moonbeam", "0xwallet_b", &txs)
            .await
            .unwrap();

        let wallet: String = sqlx::query_scalar(
            "SELECT wallet_address FROM multi_chain_transactions \
             WHERE chain_id = 'moonbeam' AND transaction_hash = '0xshared'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        // Matches save_chain_transactions semantics (tracker Session 20).
        assert_eq!(wallet, "0xwallet_a");
    }

    #[tokio::test]
    async fn test_persist_maps_enum_variants_to_check_constraint_set() {
        let pool = test_pool().await;
        // Approval serializes as 'approval' but the column CHECK only allows
        // 'approve'; ContractDeploy has no column equivalent → 'unknown'.
        let txs = vec![
            sample_tx("0xapproval", 10, TransactionType::Approval),
            sample_tx("0xdeploy", 11, TransactionType::ContractDeploy),
        ];
        persist_chain_transactions_impl(&pool, "moonbeam", "0xw", &txs)
            .await
            .unwrap();

        let approve: String = sqlx::query_scalar(
            "SELECT transaction_type FROM multi_chain_transactions \
             WHERE transaction_hash = '0xapproval'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(approve, "approve");

        let deploy: (String, String) = sqlx::query_as(
            "SELECT transaction_type, raw_json_data FROM multi_chain_transactions \
             WHERE transaction_hash = '0xdeploy'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(deploy.0, "unknown");
        // Full fidelity preserved in raw_json_data.
        assert!(deploy.1.contains("contract_deploy"));
    }

    #[tokio::test]
    async fn test_sync_cursor_monotonic_and_resumes() {
        let pool = test_pool().await;

        // No cursor yet → full sync from genesis.
        assert_eq!(
            load_sync_cursor_impl(&pool, "moonbeam", "0xW")
                .await
                .unwrap(),
            None
        );

        update_sync_cursor_impl(&pool, "moonbeam", "0xW", 500)
            .await
            .unwrap();
        assert_eq!(
            load_sync_cursor_impl(&pool, "moonbeam", "0xW")
                .await
                .unwrap(),
            Some(500)
        );

        // Case-insensitive address match on load.
        assert_eq!(
            load_sync_cursor_impl(&pool, "moonbeam", "0xw")
                .await
                .unwrap(),
            Some(500)
        );

        // A lower value must never regress the cursor (MAX guard).
        update_sync_cursor_impl(&pool, "moonbeam", "0xW", 300)
            .await
            .unwrap();
        assert_eq!(
            load_sync_cursor_impl(&pool, "moonbeam", "0xW")
                .await
                .unwrap(),
            Some(500)
        );

        // Higher value advances it.
        update_sync_cursor_impl(&pool, "moonbeam", "0xW", 900)
            .await
            .unwrap();
        assert_eq!(
            load_sync_cursor_impl(&pool, "moonbeam", "0xW")
                .await
                .unwrap(),
            Some(900)
        );
    }
}
