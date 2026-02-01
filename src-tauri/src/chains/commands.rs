//! Tauri Commands for Chain Operations
//!
//! Exposes chain functionality to the frontend via Tauri's command system.
//! All commands are async and return JSON-serializable results.

use super::{ChainInfo, ChainManager, ChainTransaction, WalletBalances};
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

    // Collect successful results, return error if any fail
    let mut balances = Vec::new();
    for result in results {
        match result {
            Ok(balance) => balances.push(balance),
            Err(e) => return Err(e.to_string()),
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
    all_transactions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

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
    super::bitcoin::derive_addresses(&xpub, receiving_count, change_count).map_err(|e| e.to_string())
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
    let portfolio =
        super::bitcoin::derive_addresses(&xpub, receiving_count, change_count).map_err(|e| e.to_string())?;

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
    let portfolio =
        super::bitcoin::derive_addresses(&xpub, receiving_count, change_count).map_err(|e| e.to_string())?;

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

    #[test]
    fn test_create_chain_manager_state() {
        let state = create_chain_manager_state();
        // Just verify it creates without error
        assert!(Arc::strong_count(&state) == 1);
    }
}
