use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::str::FromStr;
use tauri::State;
use uuid::Uuid;

use super::accounting::{
    decimal_to_minor_units, JournalEntryLineInput, JournalEntryWithLines, NewJournalEntryInput,
};
use super::persistence::DatabaseState;

// ============================================================================
// Types
// ============================================================================

/// A bank or card account linked for statement import.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BankAccount {
    /// Unique identifier.
    pub id: String,
    /// Name of the financial institution.
    pub institution_name: String,
    /// User-chosen display name for this account.
    pub account_nickname: String,
    /// Account type (checking, savings, credit, etc.).
    pub account_type: String,
    /// ISO 4217 currency code.
    pub currency: String,
    /// Default GL account number for imported transactions.
    pub gl_account_number: String,
    /// External data source (e.g. "plaid", "manual").
    pub external_source: Option<String>,
    /// Identifier in the external system.
    pub external_account_id: Option<String>,
    /// Last four digits or masked account number.
    pub masked_account_number: Option<String>,
    /// Opening balance as a decimal string.
    pub opening_balance: Option<String>,
    /// Opening balance effective date (unix epoch seconds).
    pub opening_balance_date: Option<i64>,
    /// Associated entity ID, if any.
    pub entity_id: Option<String>,
    /// Whether this account is active (1) or archived (0).
    pub active: i64,
    /// Row creation timestamp (unix epoch seconds).
    pub created_at: i64,
    /// Row last-update timestamp (unix epoch seconds).
    pub updated_at: i64,
}

/// Input payload for creating a new bank account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankAccountInput {
    /// Name of the financial institution.
    pub institution_name: String,
    /// User-chosen display name.
    pub account_nickname: String,
    /// Account type (checking, savings, credit, etc.).
    pub account_type: String,
    /// ISO 4217 currency code.
    pub currency: String,
    /// GL account number (defaults to "1000").
    pub gl_account_number: Option<String>,
    /// External data source identifier.
    pub external_source: Option<String>,
    /// Identifier in the external system.
    pub external_account_id: Option<String>,
    /// Masked account number.
    pub masked_account_number: Option<String>,
    /// Opening balance as a decimal string.
    pub opening_balance: Option<String>,
    /// Opening balance effective date (unix epoch seconds).
    pub opening_balance_date: Option<i64>,
    /// Associated entity ID.
    pub entity_id: Option<String>,
}

/// A single imported bank or card transaction.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BankTransaction {
    /// Unique identifier (composite of account + external_id when available).
    pub id: String,
    /// Owning bank account.
    pub bank_account_id: String,
    /// Institution-assigned transaction ID (used for dedup).
    pub external_id: Option<String>,
    /// Settlement date (unix epoch seconds).
    pub posted_date: i64,
    /// Initiation date if different from posted_date.
    pub transaction_date: Option<i64>,
    /// Signed amount as a decimal string.
    pub amount: String,
    /// ISO 4217 currency code.
    pub currency: String,
    /// Payee or merchant name.
    pub payee: Option<String>,
    /// Free-text memo from the statement.
    pub memo: Option<String>,
    /// Check number or reference.
    pub reference_number: Option<String>,
    /// Transaction type code from the source file.
    pub tx_type: Option<String>,
    /// Running balance after this transaction.
    pub running_balance: Option<String>,
    /// Classification status (unclassified, classified, skipped).
    pub classification_status: String,
    /// Human note attached during classification.
    pub classification_note: Option<String>,
    /// Original row data preserved as JSON.
    pub raw_data: Option<String>,
    /// ID of the import batch that created this row.
    pub import_batch_id: Option<String>,
    /// Row creation timestamp (unix epoch seconds).
    pub created_at: i64,
    /// Row last-update timestamp (unix epoch seconds).
    pub updated_at: i64,
}

/// Input payload for creating bank transactions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankTransactionInput {
    /// Owning bank account.
    pub bank_account_id: String,
    /// Institution-assigned transaction ID (used for dedup).
    pub external_id: Option<String>,
    /// Settlement date (unix epoch seconds).
    pub posted_date: i64,
    /// Initiation date if different from posted_date.
    pub transaction_date: Option<i64>,
    /// Signed amount as a decimal string.
    pub amount: String,
    /// ISO 4217 currency code.
    pub currency: String,
    /// Payee or merchant name.
    pub payee: Option<String>,
    /// Free-text memo from the statement.
    pub memo: Option<String>,
    /// Check number or reference.
    pub reference_number: Option<String>,
    /// Transaction type code from the source file.
    pub tx_type: Option<String>,
    /// Running balance after this transaction.
    pub running_balance: Option<String>,
    /// Classification status (defaults to "unclassified").
    pub classification_status: Option<String>,
    /// Human note attached during classification.
    pub classification_note: Option<String>,
    /// Original row data preserved as JSON.
    pub raw_data: Option<String>,
    /// ID of the import batch that created this row.
    pub import_batch_id: Option<String>,
}

/// Metadata for a single file-import operation.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ImportBatch {
    /// Unique identifier.
    pub id: String,
    /// Bank account the transactions belong to.
    pub bank_account_id: String,
    /// Original filename.
    pub filename: Option<String>,
    /// File format (ofx, csv, qfx, qbo).
    pub format: Option<String>,
    /// Import timestamp (unix epoch seconds).
    pub imported_at: i64,
    /// Number of rows parsed from the file.
    pub row_count: Option<i64>,
    /// Number of duplicate rows detected.
    pub duplicate_count: Option<i64>,
    /// Batch status (staged, committed, rolled_back).
    pub status: String,
}

/// Input payload for creating an import batch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportBatchInput {
    /// Bank account the transactions belong to.
    pub bank_account_id: String,
    /// Original filename.
    pub filename: Option<String>,
    /// File format (ofx, csv, qfx, qbo).
    pub format: Option<String>,
    /// Number of rows parsed.
    pub row_count: Option<i64>,
    /// Number of duplicate rows detected.
    pub duplicate_count: Option<i64>,
    /// Batch status (defaults to "staged").
    pub status: Option<String>,
}

/// Saved CSV column-mapping profile for a particular institution.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatementProfile {
    /// Unique identifier.
    pub id: String,
    /// User-assigned profile name.
    pub name: String,
    /// Institution this profile was created for.
    pub institution_name: Option<String>,
    /// JSON-serialized column mapping.
    pub column_map: Option<String>,
    /// Date format string (e.g. "MM/DD/YYYY").
    pub date_format: Option<String>,
    /// How the source file represents debits/credits.
    pub amount_sign_convention: Option<String>,
    /// Default currency when the file omits it.
    pub currency_default: Option<String>,
    /// Row creation timestamp (unix epoch seconds).
    pub created_at: i64,
    /// Row last-update timestamp (unix epoch seconds).
    pub updated_at: i64,
}

/// Input payload for creating a statement profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementProfileInput {
    /// User-assigned profile name.
    pub name: String,
    /// Institution this profile is for.
    pub institution_name: Option<String>,
    /// JSON-serialized column mapping.
    pub column_map: Option<String>,
    /// Date format string.
    pub date_format: Option<String>,
    /// How the source file represents debits/credits.
    pub amount_sign_convention: Option<String>,
    /// Default currency when the file omits it.
    pub currency_default: Option<String>,
}

// ============================================================================
// Bank Account Commands
// ============================================================================

/// Returns all bank accounts ordered by creation date (newest first).
#[tauri::command]
pub async fn get_bank_accounts(
    state: State<'_, DatabaseState>,
) -> Result<Vec<BankAccount>, String> {
    sqlx::query_as::<_, BankAccount>("SELECT * FROM bank_accounts ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Creates a new bank account and returns the persisted row.
#[tauri::command]
pub async fn save_bank_account(
    state: State<'_, DatabaseState>,
    account: BankAccountInput,
) -> Result<BankAccount, String> {
    let id = Uuid::new_v4().to_string();
    let gl = account.gl_account_number.as_deref().unwrap_or("1000");

    sqlx::query(
        r#"
        INSERT INTO bank_accounts (
            id, institution_name, account_nickname, account_type,
            currency, gl_account_number, external_source, external_account_id,
            masked_account_number, opening_balance, opening_balance_date, entity_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&account.institution_name)
    .bind(&account.account_nickname)
    .bind(&account.account_type)
    .bind(&account.currency)
    .bind(gl)
    .bind(&account.external_source)
    .bind(&account.external_account_id)
    .bind(&account.masked_account_number)
    .bind(&account.opening_balance)
    .bind(account.opening_balance_date)
    .bind(&account.entity_id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, BankAccount>("SELECT * FROM bank_accounts WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Sets a bank account's active flag to false (soft-delete).
#[tauri::command]
pub async fn archive_bank_account(
    state: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("UPDATE bank_accounts SET active = 0, updated_at = unixepoch() WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================================
// Bank Transaction Commands
// ============================================================================

/// Queries bank transactions for an account with optional filters and pagination.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn get_bank_transactions(
    state: State<'_, DatabaseState>,
    bank_account_id: String,
    from_date: Option<i64>,
    to_date: Option<i64>,
    classification_status: Option<String>,
    import_batch_id: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<BankTransaction>, String> {
    let mut sql = String::from("SELECT * FROM bank_transactions WHERE bank_account_id = ?");
    let mut bind_values: Vec<String> = vec![bank_account_id.clone()];

    if let Some(fd) = from_date {
        sql.push_str(" AND posted_date >= ?");
        bind_values.push(fd.to_string());
    }
    if let Some(td) = to_date {
        sql.push_str(" AND posted_date <= ?");
        bind_values.push(td.to_string());
    }
    if let Some(ref cs) = classification_status {
        sql.push_str(" AND classification_status = ?");
        bind_values.push(cs.clone());
    }
    if let Some(ref ib) = import_batch_id {
        sql.push_str(" AND import_batch_id = ?");
        bind_values.push(ib.clone());
    }

    sql.push_str(" ORDER BY posted_date DESC");

    let lim = limit.unwrap_or(1000);
    let off = offset.unwrap_or(0);
    sql.push_str(" LIMIT ? OFFSET ?");
    bind_values.push(lim.to_string());
    bind_values.push(off.to_string());

    let mut query = sqlx::query_as::<_, BankTransaction>(&sql);
    for v in &bind_values {
        query = query.bind(v);
    }

    query
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Upserts bank transactions (dedup on composite ID). Returns the inserted count.
#[tauri::command]
pub async fn save_bank_transactions(
    state: State<'_, DatabaseState>,
    rows: Vec<BankTransactionInput>,
) -> Result<usize, String> {
    let mut count = 0usize;

    for row in &rows {
        let id = match &row.external_id {
            Some(ext) => format!("{}_{}", row.bank_account_id, ext),
            None => Uuid::new_v4().to_string(),
        };
        let cls = row
            .classification_status
            .as_deref()
            .unwrap_or("unclassified");

        sqlx::query(
            r#"
            INSERT INTO bank_transactions (
                id, bank_account_id, external_id, posted_date, transaction_date,
                amount, currency, payee, memo, reference_number, tx_type,
                running_balance, classification_status, classification_note,
                raw_data, import_batch_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                posted_date = excluded.posted_date,
                transaction_date = excluded.transaction_date,
                amount = excluded.amount,
                payee = excluded.payee,
                memo = excluded.memo,
                reference_number = excluded.reference_number,
                tx_type = excluded.tx_type,
                running_balance = excluded.running_balance,
                classification_status = excluded.classification_status,
                classification_note = excluded.classification_note,
                raw_data = excluded.raw_data,
                import_batch_id = excluded.import_batch_id
            "#,
        )
        .bind(&id)
        .bind(&row.bank_account_id)
        .bind(&row.external_id)
        .bind(row.posted_date)
        .bind(row.transaction_date)
        .bind(&row.amount)
        .bind(&row.currency)
        .bind(&row.payee)
        .bind(&row.memo)
        .bind(&row.reference_number)
        .bind(&row.tx_type)
        .bind(&row.running_balance)
        .bind(cls)
        .bind(&row.classification_note)
        .bind(&row.raw_data)
        .bind(&row.import_batch_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

        count += 1;
    }

    Ok(count)
}

// ============================================================================
// Import Batch Commands
// ============================================================================

/// Returns import batches, optionally filtered by bank account.
#[tauri::command]
pub async fn get_import_batches(
    state: State<'_, DatabaseState>,
    bank_account_id: Option<String>,
) -> Result<Vec<ImportBatch>, String> {
    if let Some(ref acct_id) = bank_account_id {
        sqlx::query_as::<_, ImportBatch>(
            "SELECT * FROM import_batches WHERE bank_account_id = ? ORDER BY imported_at DESC",
        )
        .bind(acct_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
    } else {
        sqlx::query_as::<_, ImportBatch>("SELECT * FROM import_batches ORDER BY imported_at DESC")
            .fetch_all(&state.pool)
            .await
            .map_err(|e| e.to_string())
    }
}

/// Creates a new import batch record and returns the persisted row.
#[tauri::command]
pub async fn save_import_batch(
    state: State<'_, DatabaseState>,
    batch: ImportBatchInput,
) -> Result<ImportBatch, String> {
    let id = Uuid::new_v4().to_string();
    let status = batch.status.as_deref().unwrap_or("staged");

    sqlx::query(
        r#"
        INSERT INTO import_batches (
            id, bank_account_id, filename, format,
            row_count, duplicate_count, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&batch.bank_account_id)
    .bind(&batch.filename)
    .bind(&batch.format)
    .bind(batch.row_count)
    .bind(batch.duplicate_count)
    .bind(status)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ImportBatch>("SELECT * FROM import_batches WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Statement Profile Commands
// ============================================================================

/// Returns all saved statement profiles ordered by name.
#[tauri::command]
pub async fn get_statement_profiles(
    state: State<'_, DatabaseState>,
) -> Result<Vec<StatementProfile>, String> {
    sqlx::query_as::<_, StatementProfile>("SELECT * FROM statement_profiles ORDER BY name")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Creates a new statement profile and returns the persisted row.
#[tauri::command]
pub async fn save_statement_profile(
    state: State<'_, DatabaseState>,
    profile: StatementProfileInput,
) -> Result<StatementProfile, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO statement_profiles (
            id, name, institution_name, column_map,
            date_format, amount_sign_convention, currency_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&profile.name)
    .bind(&profile.institution_name)
    .bind(&profile.column_map)
    .bind(&profile.date_format)
    .bind(&profile.amount_sign_convention)
    .bind(&profile.currency_default)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, StatementProfile>("SELECT * FROM statement_profiles WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Bank Classification Queue Commands (GIV-828)
// ============================================================================

/// Bank transaction with joined account info for queue display.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BankQueueItem {
    /// Transaction ID.
    pub id: String,
    /// Owning bank account ID.
    pub bank_account_id: String,
    /// Account nickname from bank_accounts.
    pub account_nickname: String,
    /// Institution name from bank_accounts.
    pub institution_name: String,
    /// Settlement date (unix epoch seconds).
    pub posted_date: i64,
    /// Signed amount as decimal string.
    pub amount: String,
    /// ISO 4217 currency code.
    pub currency: String,
    /// Payee or merchant name.
    pub payee: Option<String>,
    /// Free-text memo from the statement.
    pub memo: Option<String>,
    /// Check number or reference.
    pub reference_number: Option<String>,
    /// Transaction type code from the source file.
    pub tx_type: Option<String>,
    /// Classification status.
    pub classification_status: String,
}

/// Returns all unclassified bank transactions with account metadata.
#[tauri::command]
pub async fn get_unclassified_bank_transactions(
    state: State<'_, DatabaseState>,
) -> Result<Vec<BankQueueItem>, String> {
    sqlx::query_as::<_, BankQueueItem>(
        r#"SELECT
             bt.id, bt.bank_account_id,
             ba.account_nickname, ba.institution_name,
             bt.posted_date, bt.amount, bt.currency,
             bt.payee, bt.memo, bt.reference_number, bt.tx_type,
             bt.classification_status
           FROM bank_transactions bt
           JOIN bank_accounts ba ON ba.id = bt.bank_account_id
           WHERE bt.classification_status = 'unclassified'
           ORDER BY bt.posted_date DESC"#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Auto-classifies a bank transaction by creating a journal entry from its
/// fiat amount. Bank amounts are already in the functional currency, so no
/// price enrichment is needed.
#[tauri::command]
pub async fn auto_classify_bank_transaction(
    state: State<'_, DatabaseState>,
    transaction_id: String,
) -> Result<JournalEntryWithLines, String> {
    let tx = sqlx::query_as::<_, BankQueueItem>(
        r#"SELECT
             bt.id, bt.bank_account_id,
             ba.account_nickname, ba.institution_name,
             bt.posted_date, bt.amount, bt.currency,
             bt.payee, bt.memo, bt.reference_number, bt.tx_type,
             bt.classification_status
           FROM bank_transactions bt
           JOIN bank_accounts ba ON ba.id = bt.bank_account_id
           WHERE bt.id = ? AND bt.classification_status = 'unclassified'"#,
    )
    .bind(&transaction_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Bank transaction not found or already classified/ignored".to_string())?;

    let gl_account_number: (String,) =
        sqlx::query_as("SELECT gl_account_number FROM bank_accounts WHERE id = ?")
            .bind(&tx.bank_account_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| format!("Bank account not found: {e}"))?;

    let bank_account_id = get_account_id_by_number(&state.pool, &gl_account_number.0).await?;
    let uncategorized_id = get_uncategorized_account(&state.pool, &tx.amount).await?;

    let amount = Decimal::from_str(&tx.amount)
        .map_err(|e| format!("Cannot parse amount '{}': {e}", tx.amount))?;
    let abs_amount = amount.abs();
    let amount_minor = decimal_to_minor_units(abs_amount)
        .ok_or_else(|| format!("Amount out of range: {abs_amount}"))?;

    let is_debit = amount < Decimal::ZERO;

    let payee_display = tx.payee.as_deref().unwrap_or("Unknown payee");
    let description = format!(
        "{} — {} ({})",
        payee_display, tx.institution_name, tx.account_nickname
    );

    let lines = if is_debit {
        vec![
            JournalEntryLineInput {
                gl_account_id: uncategorized_id,
                token_id: None,
                debit_minor: amount_minor,
                credit_minor: 0,
                quantity: None,
                asset_id: Some(tx.currency.clone()),
                description: Some(format!("{payee_display} (debit)")),
                functional_classification: None,
            },
            JournalEntryLineInput {
                gl_account_id: bank_account_id,
                token_id: None,
                debit_minor: 0,
                credit_minor: amount_minor,
                quantity: None,
                asset_id: Some(tx.currency.clone()),
                description: Some(format!("Bank withdrawal — {payee_display}")),
                functional_classification: None,
            },
        ]
    } else {
        vec![
            JournalEntryLineInput {
                gl_account_id: bank_account_id,
                token_id: None,
                debit_minor: amount_minor,
                credit_minor: 0,
                quantity: None,
                asset_id: Some(tx.currency.clone()),
                description: Some(format!("Bank deposit — {payee_display}")),
                functional_classification: None,
            },
            JournalEntryLineInput {
                gl_account_id: uncategorized_id,
                token_id: None,
                debit_minor: 0,
                credit_minor: amount_minor,
                quantity: None,
                asset_id: Some(tx.currency.clone()),
                description: Some(format!("{payee_display} (credit)")),
                functional_classification: None,
            },
        ]
    };

    let entry_date = chrono::DateTime::from_timestamp(tx.posted_date, 0).map_or_else(
        || chrono::Utc::now().format("%Y-%m-%d").to_string(),
        |dt| dt.format("%Y-%m-%d").to_string(),
    );

    let input = NewJournalEntryInput {
        entry_date,
        description,
        reference_number: tx.reference_number.clone(),
        raw_transaction_id: None,
        bank_transaction_id: Some(transaction_id),
        origin: Some("rule".to_string()),
        lines,
    };

    super::accounting::create_journal_entry(state, input).await
}

/// Ignores a bank transaction with an optional reason.
#[tauri::command]
pub async fn ignore_bank_transaction(
    state: State<'_, DatabaseState>,
    transaction_id: String,
    reason: Option<String>,
) -> Result<(), String> {
    let result = sqlx::query(
        "UPDATE bank_transactions SET classification_status = 'ignored', classification_note = ? WHERE id = ? AND classification_status = 'unclassified'",
    )
    .bind(&reason)
    .bind(&transaction_id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Bank transaction not found or already classified".to_string());
    }

    Ok(())
}

/// Resolves a GL account number to its database ID.
async fn get_account_id_by_number(pool: &sqlx::SqlitePool, number: &str) -> Result<i64, String> {
    let row: (i64,) =
        sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = ? AND is_active = 1")
            .bind(number)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("GL account {number} not found: {e}"))?;
    Ok(row.0)
}

/// Returns the appropriate uncategorized income or expense account based on
/// the transaction amount sign. Tries primary accounts (5000/4000) first,
/// then falls back to 5100/4100.
async fn get_uncategorized_account(pool: &sqlx::SqlitePool, amount: &str) -> Result<i64, String> {
    let is_negative = amount.starts_with('-');
    let (primary, fallback) = if is_negative {
        ("5000", "5100")
    } else {
        ("4000", "4100")
    };
    match get_account_id_by_number(pool, primary).await {
        Ok(id) => Ok(id),
        Err(_) => get_account_id_by_number(pool, fallback).await,
    }
}
