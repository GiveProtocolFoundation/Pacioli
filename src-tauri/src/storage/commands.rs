//! Tauri commands for the storage layer.
//!
//! Exposes storage operations as Tauri commands for the frontend.

use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::State;

use super::{
    db_security, export, import, initialization, profile_store, settings_store, wallet_store,
    AppState, ImportPreview, ImportResult, Profile, ProfileInput, Setting, Wallet, WalletInput,
};

/// Database pool state for Tauri.
pub struct StorageState {
    /// The SQLite connection pool.
    pub pool: SqlitePool,
    /// Whether the database is currently unlocked.
    pub unlocked: std::sync::atomic::AtomicBool,
}

impl StorageState {
    /// Creates a new storage state.
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            unlocked: std::sync::atomic::AtomicBool::new(true),
        }
    }

    /// Checks if the database is unlocked.
    pub fn is_unlocked(&self) -> bool {
        self.unlocked.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Sets the unlocked state.
    pub fn set_unlocked(&self, unlocked: bool) {
        self.unlocked
            .store(unlocked, std::sync::atomic::Ordering::SeqCst);
    }
}

// =============================================================================
// Initialization Commands
// =============================================================================

/// Ensures the app is initialized on first run.
#[tauri::command]
pub async fn storage_ensure_initialized(
    state: State<'_, StorageState>,
) -> Result<String, String> {
    let result = initialization::ensure_initialized(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    match result {
        initialization::InitResult::JustInitialized { profile_id } => {
            Ok(format!("initialized:{}", profile_id))
        }
        initialization::InitResult::AlreadyInitialized => Ok("already_initialized".to_string()),
    }
}

/// Gets the current app state.
#[tauri::command]
pub async fn storage_get_app_state(state: State<'_, StorageState>) -> Result<AppState, String> {
    let app_state = initialization::get_app_state(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    // If password is set but we're unlocked in memory, return Unlocked
    if app_state == AppState::Locked && state.is_unlocked() {
        return Ok(AppState::Unlocked);
    }

    Ok(app_state)
}

/// Resets the app to uninitialized state.
#[tauri::command]
pub async fn storage_reset_app(state: State<'_, StorageState>) -> Result<(), String> {
    initialization::reset_app(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

// =============================================================================
// Profile Commands
// =============================================================================

/// Creates a new profile.
#[tauri::command]
pub async fn storage_create_profile(
    state: State<'_, StorageState>,
    input: ProfileInput,
) -> Result<Profile, String> {
    profile_store::create_profile(&state.pool, input)
        .await
        .map_err(|e| e.to_string())
}

/// Gets a profile by ID.
#[tauri::command]
pub async fn storage_get_profile(
    state: State<'_, StorageState>,
    id: String,
) -> Result<Option<Profile>, String> {
    profile_store::get_profile(&state.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

/// Gets all profiles.
#[tauri::command]
pub async fn storage_get_all_profiles(
    state: State<'_, StorageState>,
) -> Result<Vec<Profile>, String> {
    profile_store::get_all_profiles(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Updates a profile.
#[tauri::command]
pub async fn storage_update_profile(
    state: State<'_, StorageState>,
    id: String,
    input: ProfileInput,
) -> Result<Profile, String> {
    profile_store::update_profile(&state.pool, &id, input)
        .await
        .map_err(|e| e.to_string())
}

/// Deletes a profile.
#[tauri::command]
pub async fn storage_delete_profile(
    state: State<'_, StorageState>,
    id: String,
) -> Result<(), String> {
    profile_store::delete_profile(&state.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

/// Gets the default profile.
#[tauri::command]
pub async fn storage_get_default_profile(
    state: State<'_, StorageState>,
) -> Result<Option<Profile>, String> {
    profile_store::get_default_profile(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Sets a profile as the default.
#[tauri::command]
pub async fn storage_set_default_profile(
    state: State<'_, StorageState>,
    id: String,
) -> Result<(), String> {
    profile_store::set_default_profile(&state.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

// =============================================================================
// Wallet Commands
// =============================================================================

/// Creates a new wallet.
#[tauri::command]
pub async fn storage_create_wallet(
    state: State<'_, StorageState>,
    input: WalletInput,
) -> Result<Wallet, String> {
    wallet_store::create_wallet(&state.pool, input)
        .await
        .map_err(|e| e.to_string())
}

/// Gets a wallet by ID.
#[tauri::command]
pub async fn storage_get_wallet(
    state: State<'_, StorageState>,
    id: String,
) -> Result<Option<Wallet>, String> {
    wallet_store::get_wallet(&state.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

/// Gets all wallets for a profile.
#[tauri::command]
pub async fn storage_get_wallets_by_profile(
    state: State<'_, StorageState>,
    profile_id: String,
) -> Result<Vec<Wallet>, String> {
    wallet_store::get_wallets_by_profile(&state.pool, &profile_id)
        .await
        .map_err(|e| e.to_string())
}

/// Updates a wallet.
#[tauri::command]
pub async fn storage_update_wallet(
    state: State<'_, StorageState>,
    id: String,
    input: WalletInput,
) -> Result<Wallet, String> {
    wallet_store::update_wallet(&state.pool, &id, input)
        .await
        .map_err(|e| e.to_string())
}

/// Deletes a wallet.
#[tauri::command]
pub async fn storage_delete_wallet(
    state: State<'_, StorageState>,
    id: String,
) -> Result<(), String> {
    wallet_store::delete_wallet(&state.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

// =============================================================================
// Settings Commands
// =============================================================================

/// Gets a setting by key.
#[tauri::command]
pub async fn storage_get_setting(
    state: State<'_, StorageState>,
    key: String,
) -> Result<Option<String>, String> {
    settings_store::get_setting(&state.pool, &key)
        .await
        .map_err(|e| e.to_string())
}

/// Sets a setting.
#[tauri::command]
pub async fn storage_set_setting(
    state: State<'_, StorageState>,
    key: String,
    value: String,
) -> Result<(), String> {
    settings_store::set_setting(&state.pool, &key, &value)
        .await
        .map_err(|e| e.to_string())
}

/// Deletes a setting.
#[tauri::command]
pub async fn storage_delete_setting(
    state: State<'_, StorageState>,
    key: String,
) -> Result<(), String> {
    settings_store::delete_setting(&state.pool, &key)
        .await
        .map_err(|e| e.to_string())
}

/// Gets all settings.
#[tauri::command]
pub async fn storage_get_all_settings(
    state: State<'_, StorageState>,
) -> Result<Vec<Setting>, String> {
    settings_store::get_all_settings(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

// =============================================================================
// Security Commands
// =============================================================================

/// Sets a database password and returns a recovery phrase.
#[tauri::command]
pub async fn storage_set_password(
    state: State<'_, StorageState>,
    password: String,
) -> Result<String, String> {
    let recovery_phrase = db_security::set_password_with_recovery(&state.pool, &password)
        .await
        .map_err(|e| e.to_string())?;

    state.set_unlocked(true);
    Ok(recovery_phrase)
}

/// Changes the database password.
#[tauri::command]
pub async fn storage_change_password(
    state: State<'_, StorageState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    db_security::change_password(&state.pool, &current_password, &new_password)
        .await
        .map_err(|e| e.to_string())
}

/// Removes the database password.
#[tauri::command]
pub async fn storage_remove_password(
    state: State<'_, StorageState>,
    current_password: String,
) -> Result<(), String> {
    db_security::remove_password(&state.pool, &current_password)
        .await
        .map_err(|e| e.to_string())
}

/// Checks if a password is set.
#[tauri::command]
pub async fn storage_has_password(state: State<'_, StorageState>) -> Result<bool, String> {
    db_security::has_password(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Unlocks the database with the given password.
#[tauri::command]
pub async fn storage_unlock(
    state: State<'_, StorageState>,
    password: String,
) -> Result<bool, String> {
    let valid = db_security::unlock(&state.pool, &password)
        .await
        .map_err(|e| e.to_string())?;

    if valid {
        state.set_unlocked(true);
    }

    Ok(valid)
}

/// Locks the database.
#[tauri::command]
pub async fn storage_lock(state: State<'_, StorageState>) -> Result<(), String> {
    state.set_unlocked(false);
    Ok(())
}

/// Validates password strength.
#[tauri::command]
pub fn storage_validate_password_strength(password: String) -> Result<(), String> {
    db_security::validate_password_strength(&password).map_err(|e| e.to_string())
}

/// Checks if a recovery phrase is set.
#[tauri::command]
pub async fn storage_has_recovery_phrase(state: State<'_, StorageState>) -> Result<bool, String> {
    db_security::has_recovery_phrase(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Verifies a recovery phrase.
#[tauri::command]
pub async fn storage_verify_recovery_phrase(
    state: State<'_, StorageState>,
    phrase: String,
) -> Result<bool, String> {
    db_security::verify_recovery_phrase(&state.pool, &phrase)
        .await
        .map_err(|e| e.to_string())
}

/// Resets the password using a recovery phrase.
#[tauri::command]
pub async fn storage_reset_password_with_recovery(
    state: State<'_, StorageState>,
    recovery_phrase: String,
    new_password: String,
) -> Result<(), String> {
    db_security::reset_password_with_recovery(&state.pool, &recovery_phrase, &new_password)
        .await
        .map_err(|e| e.to_string())?;

    state.set_unlocked(true);
    Ok(())
}

// =============================================================================
// Export/Import Commands
// =============================================================================

/// Exports all data to a file.
#[tauri::command]
pub async fn storage_export_data(
    state: State<'_, StorageState>,
    path: String,
    password: Option<String>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    export::export_data(&state.pool, &path, password.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Gets export statistics.
#[tauri::command]
pub async fn storage_get_export_stats(
    state: State<'_, StorageState>,
) -> Result<(usize, usize, usize), String> {
    export::get_export_stats(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Previews an import file.
#[tauri::command]
pub async fn storage_preview_import(path: String) -> Result<ImportPreview, String> {
    let path = PathBuf::from(path);
    import::preview_import(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Imports data from a file.
#[tauri::command]
pub async fn storage_import_data(
    state: State<'_, StorageState>,
    path: String,
    password: Option<String>,
) -> Result<ImportResult, String> {
    let path = PathBuf::from(path);
    import::import_data(&state.pool, &path, password.as_deref())
        .await
        .map_err(|e| e.to_string())
}
