mod api;
mod chains;
mod core;
mod db;
mod evm_indexer;
mod indexer;
mod sync;

use api::persistence::DatabaseState;
use chains::commands::create_chain_manager_state;
use core::auth_state::AuthState;
use core::email;
use evm_indexer::EVMIndexer;
use tauri::{Manager, State};
use tokio::sync::Mutex;

// Environment variable names
const ENV_RESEND_API_KEY: &str = "RESEND_API_KEY";
const ENV_ETHERSCAN_API_KEY: &str = "ETHERSCAN_API_KEY";
const ENV_POLYGONSCAN_API_KEY: &str = "POLYGONSCAN_API_KEY";
const ENV_ARBISCAN_API_KEY: &str = "ARBISCAN_API_KEY";

// Global EVM indexer state
type EVMIndexerState = Mutex<EVMIndexer>;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn connect_evm_chain(
    state: State<'_, EVMIndexerState>,
    chain: String,
) -> Result<String, String> {
    let mut indexer = state.lock().await;
    indexer.connect(&chain).await.map_err(|e| e.to_string())?;
    Ok(format!("Connected to {}", chain))
}

#[tauri::command]
async fn get_evm_balance(
    state: State<'_, EVMIndexerState>,
    chain: String,
    address: String,
) -> Result<String, String> {
    let indexer = state.lock().await;
    let balance = indexer
        .get_balance(&chain, &address)
        .await
        .map_err(|e| e.to_string())?;
    Ok(balance.to_string())
}

#[tauri::command]
async fn get_evm_token_balances(
    state: State<'_, EVMIndexerState>,
    chain: String,
    address: String,
) -> Result<Vec<(String, String)>, String> {
    // Common ERC20 tokens for each chain
    let tokens = match chain.as_str() {
        "moonbeam" => vec![
            "0xAcc15dC74880C9944775448304B263D191c6077F", // WGLMR
            "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b", // USDC
        ],
        "moonriver" => vec![
            "0x98878B06940aE243284CA214f92Bb71a2b032B8A", // WMOVR
            "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D", // USDC
        ],
        "astar" => vec![
            "0xAeaaf0e2c81Af264101B9129C00F4440cCF0F720", // WASTR
        ],
        _ => vec![],
    };

    let indexer = state.lock().await;
    let balances = indexer
        .scan_erc20_balances(&chain, &address, tokens)
        .await
        .map_err(|e| e.to_string())?;

    Ok(balances
        .into_iter()
        .map(|(addr, balance)| (addr, balance.to_string()))
        .collect())
}

#[tauri::command]
async fn get_evm_transactions(
    state: State<'_, EVMIndexerState>,
    chain: String,
    address: String,
    from_block: u64,
    to_block: String,
) -> Result<Vec<String>, String> {
    let to_block_num = if to_block == "latest" {
        let indexer = state.lock().await;
        indexer
            .get_block_number(&chain)
            .await
            .map_err(|e| e.to_string())?
    } else {
        to_block.parse::<u64>().map_err(|e| e.to_string())?
    };

    let indexer = state.lock().await;
    let transactions = indexer
        .get_transactions(&chain, &address, from_block, to_block_num)
        .await
        .map_err(|e| e.to_string())?;

    // Convert transactions to JSON strings for frontend
    Ok(transactions
        .into_iter()
        .map(|tx| serde_json::to_string(&tx).unwrap_or_default())
        .collect())
}

#[tauri::command]
async fn scan_defi_positions(
    state: State<'_, EVMIndexerState>,
    chain: String,
    address: String,
) -> Result<Vec<String>, String> {
    let protocols = match chain.as_str() {
        "moonbeam" => vec!["stellaswap", "moonwell"],
        "astar" => vec!["arthswap"],
        "acala" => vec!["acala-swap"],
        _ => vec![],
    };

    let indexer = state.lock().await;
    let positions = indexer
        .scan_defi_positions(&chain, &address, protocols)
        .await
        .map_err(|e| e.to_string())?;

    // Convert positions to JSON strings for frontend
    Ok(positions
        .into_iter()
        .map(|pos| serde_json::to_string(&pos).unwrap_or_default())
        .collect())
}

#[tauri::command]
async fn sync_evm_transactions(
    state: State<'_, EVMIndexerState>,
    chain: String,
    address: String,
) -> Result<String, String> {
    // Get latest block and sync from last 1000 blocks
    let indexer = state.lock().await;
    let latest_block = indexer
        .get_block_number(&chain)
        .await
        .map_err(|e| e.to_string())?;
    let from_block = latest_block.saturating_sub(1000);

    let transactions = indexer
        .get_transactions(&chain, &address, from_block, latest_block)
        .await
        .map_err(|e| e.to_string())?;

    Ok(format!("Synced {} transactions", transactions.len()))
}

/// Runs the Tauri application with all configured plugins and commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Ensure directory exists
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            let db_path = app_data_dir.join("pacioli.db");
            let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

            // Initialize database state using tokio runtime
            let db_state = tauri::async_runtime::block_on(async {
                DatabaseState::new(&db_url)
                    .await
                    .expect("Failed to initialize database")
            });

            app.manage(db_state);

            // Initialize authentication state
            app.manage(AuthState::new());

            // Initialize email service
            // Load from environment variable or .env file
            let _ = dotenvy::dotenv(); // Ignore error if .env doesn't exist
            if let Ok(api_key) = std::env::var(ENV_RESEND_API_KEY) {
                email::init(api_key);
                println!("Email service initialized");
            } else {
                eprintln!(
                    "Warning: {} not set, email sending disabled",
                    ENV_RESEND_API_KEY
                );
            }

            // Initialize chain manager
            let chain_manager = create_chain_manager_state();

            // Set up API keys from environment if available
            if let Ok(etherscan_key) = std::env::var(ENV_ETHERSCAN_API_KEY) {
                let manager = chain_manager.blocking_read();
                tauri::async_runtime::block_on(async {
                    manager
                        .set_explorer_api_key("ethereum", etherscan_key.clone())
                        .await;
                    manager.set_explorer_api_key("1", etherscan_key).await;
                });
            }
            if let Ok(polygonscan_key) = std::env::var(ENV_POLYGONSCAN_API_KEY) {
                let manager = chain_manager.blocking_read();
                tauri::async_runtime::block_on(async {
                    manager
                        .set_explorer_api_key("polygon", polygonscan_key.clone())
                        .await;
                    manager.set_explorer_api_key("137", polygonscan_key).await;
                });
            }
            if let Ok(arbiscan_key) = std::env::var(ENV_ARBISCAN_API_KEY) {
                let manager = chain_manager.blocking_read();
                tauri::async_runtime::block_on(async {
                    manager
                        .set_explorer_api_key("arbitrum", arbiscan_key.clone())
                        .await;
                    manager.set_explorer_api_key("42161", arbiscan_key).await;
                });
            }

            app.manage(chain_manager);
            println!("Chain manager initialized");

            Ok(())
        })
        .manage(EVMIndexerState::new(EVMIndexer::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            connect_evm_chain,
            get_evm_balance,
            get_evm_token_balances,
            get_evm_transactions,
            scan_defi_positions,
            sync_evm_transactions,
            api::export::export_transactions_csv,
            api::export::export_tax_report,
            api::backup::create_backup,
            api::backup::restore_backup,
            // Persistence commands
            api::persistence::create_profile,
            api::persistence::get_profiles,
            api::persistence::update_profile,
            api::persistence::delete_profile,
            api::persistence::save_wallet,
            api::persistence::get_wallets,
            api::persistence::get_wallet_by_id,
            api::persistence::delete_wallet,
            api::persistence::save_transactions,
            api::persistence::get_transactions,
            api::persistence::get_all_transactions,
            api::persistence::delete_transactions,
            api::persistence::get_setting,
            api::persistence::set_setting,
            api::persistence::delete_setting,
            api::persistence::get_all_settings,
            // Entity commands
            api::entities::create_entity,
            api::entities::get_entities,
            api::entities::get_entity_by_id,
            api::entities::update_entity,
            api::entities::delete_entity,
            api::entities::add_entity_address,
            api::entities::get_entity_addresses,
            api::entities::delete_entity_address,
            api::entities::lookup_address,
            api::entities::batch_lookup_addresses,
            api::entities::get_known_addresses,
            api::entities::create_entity_from_known,
            api::entities::search_entities,
            api::entities::find_entity_by_address,
            // Authentication commands
            api::auth::register,
            api::auth::login,
            api::auth::logout,
            api::auth::refresh_token,
            api::auth::verify_token,
            api::auth::get_current_user,
            api::auth::update_user,
            api::auth::change_password,
            api::auth::request_email_change,
            api::auth::verify_email_change,
            api::auth::cancel_email_change,
            api::auth::get_email_change_status,
            api::auth::get_user_sessions,
            api::auth::revoke_session,
            api::auth::revoke_all_sessions,
            api::auth::get_user_profiles,
            api::auth::get_profile_users,
            api::auth::update_user_role,
            api::auth::remove_user_from_profile,
            api::auth::create_invitation,
            api::auth::get_profile_invitations,
            api::auth::accept_invitation,
            api::auth::revoke_invitation,
            // Wallet authentication commands
            api::wallet_auth::generate_wallet_challenge,
            api::wallet_auth::verify_wallet_signature,
            api::wallet_auth::link_wallet_to_account,
            api::wallet_auth::get_user_wallets,
            api::wallet_auth::unlink_wallet,
            api::wallet_auth::cleanup_expired_challenges,
            // Chain management commands
            chains::chain_get_supported_chains,
            chains::chain_is_supported,
            chains::chain_validate_address,
            chains::chain_fetch_transactions,
            chains::chain_fetch_balances,
            chains::chain_fetch_transaction,
            chains::chain_fetch_all_balances,
            chains::chain_fetch_all_transactions,
            chains::chain_connect,
            chains::chain_set_explorer_api_key,
            chains::chain_set_rpc_url,
            chains::chain_get_block_number
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
