use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

use super::persistence::DatabaseState;

// ============================================================================
// Types — Chart of Accounts
// ============================================================================

/// A general-ledger account from the chart of accounts.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GlAccount {
    /// Auto-incremented primary key.
    pub id: i64,
    /// Unique account number (e.g. "1200", "5100").
    pub account_number: String,
    /// Human-readable account name.
    pub account_name: String,
    /// One of: Asset, Liability, Equity, Income, Expense.
    pub account_type: String,
    /// Optional parent account for sub-account hierarchy.
    pub parent_account_id: Option<i64>,
    /// Optional digital-asset sub-classification.
    pub digital_asset_type: Option<String>,
    /// Optional subcategory label.
    pub subcategory: Option<String>,
    /// Optional description of the account's purpose.
    pub description: Option<String>,
    /// Whether the account is active.
    pub is_active: bool,
    /// Whether the account can be edited or deleted by users.
    pub is_editable: bool,
    /// Either "debit" or "credit".
    pub normal_balance: Option<String>,
    /// Timestamp when the account was created.
    pub created_at: Option<NaiveDateTime>,
    /// Timestamp when the account was last updated.
    pub updated_at: Option<NaiveDateTime>,
}

/// Input for creating a new GL account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewGlAccountInput {
    /// Unique account number.
    pub account_number: String,
    /// Human-readable account name.
    pub account_name: String,
    /// One of: Asset, Liability, Equity, Income, Expense.
    pub account_type: String,
    /// Optional parent account ID for sub-accounts.
    pub parent_account_id: Option<i64>,
    /// Optional digital-asset sub-classification.
    pub digital_asset_type: Option<String>,
    /// Optional subcategory label.
    pub subcategory: Option<String>,
    /// Optional description.
    pub description: Option<String>,
    /// Either "debit" or "credit". Defaults based on account_type if omitted.
    pub normal_balance: Option<String>,
}

/// Input for updating an existing GL account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGlAccountInput {
    /// New account name.
    pub account_name: Option<String>,
    /// New description.
    pub description: Option<String>,
    /// New subcategory.
    pub subcategory: Option<String>,
    /// New digital-asset type.
    pub digital_asset_type: Option<String>,
    /// New parent account ID.
    pub parent_account_id: Option<i64>,
}

// ============================================================================
// Types — Journal Entries
// ============================================================================

/// A journal entry header (double-entry bookkeeping).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    /// Auto-incremented primary key.
    pub id: i64,
    /// Date of the accounting event.
    pub entry_date: NaiveDateTime,
    /// Unique sequential entry number.
    pub entry_number: Option<String>,
    /// Description of the entry.
    pub description: Option<String>,
    /// Free-form reference (e.g. transaction hash).
    pub reference_number: Option<String>,
    /// Whether the entry has been posted to the ledger.
    pub is_posted: bool,
    /// Whether the entry has been reversed.
    pub is_reversed: bool,
    /// ID of the reversing entry, if reversed.
    pub reversed_by_entry_id: Option<i64>,
    /// Who created this entry.
    pub created_by: Option<String>,
    /// Timestamp when the entry was created.
    pub created_at: Option<NaiveDateTime>,
    /// Timestamp when the entry was last updated.
    pub updated_at: Option<NaiveDateTime>,
}

/// A single debit or credit line within a journal entry.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryLine {
    /// Auto-incremented primary key.
    pub id: i64,
    /// FK to journal_entries.
    pub journal_entry_id: i64,
    /// FK to gl_accounts.
    pub gl_account_id: i64,
    /// Optional FK to tokens table.
    pub token_id: Option<i64>,
    /// Debit amount (0 if this is a credit line).
    pub debit_amount: f64,
    /// Credit amount (0 if this is a debit line).
    pub credit_amount: f64,
    /// Optional line-level description.
    pub description: Option<String>,
    /// Ordering within the entry.
    pub line_number: Option<i64>,
    /// Timestamp when the line was created.
    pub created_at: Option<NaiveDateTime>,
}

/// A journal entry with its lines, returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryWithLines {
    /// The journal entry header.
    #[serde(flatten)]
    pub entry: JournalEntry,
    /// The debit/credit lines.
    pub lines: Vec<JournalEntryLine>,
}

/// Input for creating a journal entry line.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryLineInput {
    /// FK to gl_accounts.
    pub gl_account_id: i64,
    /// Optional FK to tokens table.
    pub token_id: Option<i64>,
    /// Debit amount (0 if credit line).
    pub debit_amount: f64,
    /// Credit amount (0 if debit line).
    pub credit_amount: f64,
    /// Optional memo for this line.
    pub description: Option<String>,
}

/// Input for creating a new journal entry with lines.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewJournalEntryInput {
    /// Date of the accounting event (ISO 8601).
    pub entry_date: String,
    /// Description of the entry.
    pub description: String,
    /// Free-form reference (e.g. transaction hash).
    pub reference_number: Option<String>,
    /// Optional: link to a raw transaction ID.
    pub raw_transaction_id: Option<String>,
    /// The debit/credit lines.
    pub lines: Vec<JournalEntryLineInput>,
}

// ============================================================================
// Types — Account Balance
// ============================================================================

/// Account balance from the v_account_balances view.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccountBalance {
    /// GL account ID.
    pub account_id: i64,
    /// Account number.
    pub account_number: String,
    /// Account name.
    pub account_name: String,
    /// Account type (Asset/Liability/Equity/Income/Expense).
    pub account_type: String,
    /// Digital asset type, if applicable.
    pub digital_asset_type: Option<String>,
    /// Normal balance direction (debit/credit).
    pub normal_balance: Option<String>,
    /// Total debits posted.
    pub total_debits: f64,
    /// Total credits posted.
    pub total_credits: f64,
    /// Balance in natural direction.
    pub balance: f64,
    /// Signed balance for reporting.
    pub balance_signed: f64,
}

/// Trial balance row from the v_trial_balance view.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrialBalanceRow {
    /// Account number.
    pub account_number: String,
    /// Account name.
    pub account_name: String,
    /// Account type.
    pub account_type: String,
    /// Debit balance (0 if credit side).
    pub debit_balance: f64,
    /// Credit balance (0 if debit side).
    pub credit_balance: f64,
}

// ============================================================================
// Chart of Accounts Commands
// ============================================================================

/// Returns all active GL accounts ordered by account number.
#[tauri::command]
pub async fn get_chart_of_accounts(
    state: State<'_, DatabaseState>,
) -> Result<Vec<GlAccount>, String> {
    sqlx::query_as::<_, GlAccount>(
        "SELECT * FROM gl_accounts WHERE is_active = 1 ORDER BY account_number",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Creates a new GL account and returns it.
#[tauri::command]
pub async fn create_gl_account(
    state: State<'_, DatabaseState>,
    input: NewGlAccountInput,
) -> Result<GlAccount, String> {
    // Default normal_balance based on account_type
    let normal_balance =
        input
            .normal_balance
            .unwrap_or_else(|| match input.account_type.as_str() {
                "Asset" | "Expense" => "debit".to_string(),
                _ => "credit".to_string(),
            });

    let result = sqlx::query(
        r#"
        INSERT INTO gl_accounts (
            account_number, account_name, account_type,
            parent_account_id, digital_asset_type, subcategory,
            description, normal_balance, is_editable
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        "#,
    )
    .bind(&input.account_number)
    .bind(&input.account_name)
    .bind(&input.account_type)
    .bind(input.parent_account_id)
    .bind(&input.digital_asset_type)
    .bind(&input.subcategory)
    .bind(&input.description)
    .bind(&normal_balance)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let id = result.last_insert_rowid();

    sqlx::query_as::<_, GlAccount>("SELECT * FROM gl_accounts WHERE id = ?")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Updates an existing GL account. Only editable accounts can be modified.
#[tauri::command]
pub async fn update_gl_account(
    state: State<'_, DatabaseState>,
    id: i64,
    input: UpdateGlAccountInput,
) -> Result<GlAccount, String> {
    // Verify the account is editable
    let account = sqlx::query_as::<_, GlAccount>("SELECT * FROM gl_accounts WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Account not found".to_string())?;

    if !account.is_editable {
        return Err("System accounts cannot be modified".to_string());
    }

    sqlx::query(
        r#"
        UPDATE gl_accounts SET
            account_name = COALESCE(?, account_name),
            description = COALESCE(?, description),
            subcategory = COALESCE(?, subcategory),
            digital_asset_type = COALESCE(?, digital_asset_type),
            parent_account_id = COALESCE(?, parent_account_id)
        WHERE id = ?
        "#,
    )
    .bind(&input.account_name)
    .bind(&input.description)
    .bind(&input.subcategory)
    .bind(&input.digital_asset_type)
    .bind(input.parent_account_id)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, GlAccount>("SELECT * FROM gl_accounts WHERE id = ?")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Deactivates a GL account (soft delete). Only editable accounts can be deactivated.
#[tauri::command]
pub async fn deactivate_gl_account(state: State<'_, DatabaseState>, id: i64) -> Result<(), String> {
    let account = sqlx::query_as::<_, GlAccount>("SELECT * FROM gl_accounts WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Account not found".to_string())?;

    if !account.is_editable {
        return Err("System accounts cannot be deactivated".to_string());
    }

    sqlx::query("UPDATE gl_accounts SET is_active = 0 WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Journal Entry Commands
// ============================================================================

/// Returns journal entries matching the given status filter.
#[tauri::command]
pub async fn get_journal_entries(
    state: State<'_, DatabaseState>,
    status_filter: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<JournalEntryWithLines>, String> {
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let entries = match status_filter.as_deref() {
        Some("posted") => {
            sqlx::query_as::<_, JournalEntry>(
                "SELECT * FROM journal_entries WHERE is_posted = 1 AND is_reversed = 0 ORDER BY entry_date DESC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
        }
        Some("draft") => {
            sqlx::query_as::<_, JournalEntry>(
                "SELECT * FROM journal_entries WHERE is_posted = 0 AND is_reversed = 0 ORDER BY entry_date DESC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
        }
        Some("void") => {
            sqlx::query_as::<_, JournalEntry>(
                "SELECT * FROM journal_entries WHERE is_reversed = 1 ORDER BY entry_date DESC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
        }
        _ => {
            sqlx::query_as::<_, JournalEntry>(
                "SELECT * FROM journal_entries ORDER BY entry_date DESC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
        }
    }
    .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(entries.len());
    for entry in entries {
        let lines = sqlx::query_as::<_, JournalEntryLine>(
            "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
        )
        .bind(entry.id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

        result.push(JournalEntryWithLines { entry, lines });
    }

    Ok(result)
}

/// Returns a single journal entry with its lines.
#[tauri::command]
pub async fn get_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
) -> Result<JournalEntryWithLines, String> {
    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    let lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
    )
    .bind(entry.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(JournalEntryWithLines { entry, lines })
}

/// Creates a new journal entry as a draft with the given lines.
#[tauri::command]
pub async fn create_journal_entry(
    state: State<'_, DatabaseState>,
    input: NewJournalEntryInput,
) -> Result<JournalEntryWithLines, String> {
    if input.lines.is_empty() {
        return Err("Journal entry must have at least one line".to_string());
    }

    // Validate each line has exactly one of debit or credit > 0
    for line in &input.lines {
        if (line.debit_amount > 0.0 && line.credit_amount > 0.0)
            || (line.debit_amount == 0.0 && line.credit_amount == 0.0)
        {
            return Err("Each line must have exactly one of debit or credit amount".to_string());
        }
    }

    let entry_date = NaiveDateTime::parse_from_str(&input.entry_date, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| {
            NaiveDateTime::parse_from_str(
                &format!("{}T00:00:00", input.entry_date),
                "%Y-%m-%dT%H:%M:%S",
            )
        })
        .map_err(|e| format!("Invalid date format: {e}"))?;

    // Generate entry number
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    let entry_number = format!("JE-{:06}", count.0 + 1);

    let result = sqlx::query(
        r#"
        INSERT INTO journal_entries (entry_date, entry_number, description, reference_number, is_posted, created_by)
        VALUES (?, ?, ?, ?, 0, 'system')
        "#,
    )
    .bind(entry_date)
    .bind(&entry_number)
    .bind(&input.description)
    .bind(&input.reference_number)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let entry_id = result.last_insert_rowid();

    // Insert lines
    for (i, line) in input.lines.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, token_id, debit_amount, credit_amount, description, line_number)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(entry_id)
        .bind(line.gl_account_id)
        .bind(line.token_id)
        .bind(line.debit_amount)
        .bind(line.credit_amount)
        .bind(&line.description)
        .bind(i as i64 + 1)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    // If linked to a raw transaction, update its classification status
    if let Some(ref tx_id) = input.raw_transaction_id {
        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ?",
        )
        .bind(tx_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    get_journal_entry(state, entry_id).await
}

/// Posts a draft journal entry (validates debits = credits via DB trigger).
#[tauri::command]
pub async fn post_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
) -> Result<JournalEntryWithLines, String> {
    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    if entry.is_posted {
        return Err("Journal entry is already posted".to_string());
    }

    if entry.is_reversed {
        return Err("Cannot post a reversed entry".to_string());
    }

    // Friendly line-count check (DB trigger is the authority, this gives a better message)
    let line_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if line_count.0 == 0 {
        return Err("Cannot post: entry has no lines".to_string());
    }
    if line_count.0 < 2 {
        return Err("Cannot post: entry needs at least 2 lines (debit and credit)".to_string());
    }

    // Validate balance before posting (the DB trigger also enforces this)
    let balance: (f64,) = sqlx::query_as(
        "SELECT ABS(COALESCE(SUM(debit_amount) - SUM(credit_amount), 1e18)) FROM journal_entry_lines WHERE journal_entry_id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if balance.0 > 0.01 {
        return Err(format!(
            "Journal entry is not balanced. Difference: {:.2}",
            balance.0
        ));
    }

    // Post the entry (DB trigger validates balance)
    sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    get_journal_entry(state, id).await
}

/// Voids a posted journal entry by marking it as reversed.
#[tauri::command]
pub async fn void_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
) -> Result<JournalEntryWithLines, String> {
    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    if entry.is_reversed {
        return Err("Journal entry is already voided".to_string());
    }

    sqlx::query("UPDATE journal_entries SET is_reversed = 1 WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    get_journal_entry(state, id).await
}

// ============================================================================
// Auto-Classify Command
// ============================================================================

/// Auto-classifies a raw multi_chain_transaction into a draft journal entry
/// using basic heuristics based on the transaction type.
#[tauri::command]
pub async fn auto_classify_transaction(
    state: State<'_, DatabaseState>,
    transaction_id: String,
) -> Result<JournalEntryWithLines, String> {
    // Fetch the raw transaction
    let tx = sqlx::query_as::<_, MultiChainTx>(
        "SELECT id, chain_id, hash, from_address, to_address, value, fee, timestamp, tx_type, status FROM multi_chain_transactions WHERE id = ?",
    )
    .bind(&transaction_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Transaction not found".to_string())?;

    // Resolve GL account IDs
    let crypto_assets_id = get_account_id_by_number(&state.pool, "1200").await?;
    let staking_income_id = get_account_id_by_number(&state.pool, "4100").await?;
    let network_fees_id = get_account_id_by_number(&state.pool, "5100").await?;
    let income_id = get_account_id_by_number(&state.pool, "4000").await?;

    // Parse amount
    let amount: f64 = tx.value.parse().unwrap_or(0.0);
    let fee_amount: f64 = tx.fee.as_deref().unwrap_or("0").parse().unwrap_or(0.0);

    // Build lines based on tx_type heuristics
    let mut lines = Vec::new();
    let description = match tx.tx_type.as_str() {
        "claim" | "stake" => {
            // Staking reward: DR Crypto Assets / CR Staking Income
            if amount > 0.0 {
                lines.push(JournalEntryLineInput {
                    gl_account_id: crypto_assets_id,
                    token_id: None,
                    debit_amount: amount,
                    credit_amount: 0.0,
                    description: Some("Staking reward received".to_string()),
                });
                lines.push(JournalEntryLineInput {
                    gl_account_id: staking_income_id,
                    token_id: None,
                    debit_amount: 0.0,
                    credit_amount: amount,
                    description: Some("Staking reward income".to_string()),
                });
            }
            format!("Staking reward on {}", tx.chain_id)
        }
        "transfer" => {
            // Incoming transfer: DR Crypto Assets / CR Income (uncategorized)
            if amount > 0.0 {
                lines.push(JournalEntryLineInput {
                    gl_account_id: crypto_assets_id,
                    token_id: None,
                    debit_amount: amount,
                    credit_amount: 0.0,
                    description: Some("Transfer received".to_string()),
                });
                lines.push(JournalEntryLineInput {
                    gl_account_id: income_id,
                    token_id: None,
                    debit_amount: 0.0,
                    credit_amount: amount,
                    description: Some("Uncategorized income — review and reclassify".to_string()),
                });
            }
            format!(
                "Transfer on {} ({})",
                tx.chain_id,
                &tx.hash[..8.min(tx.hash.len())]
            )
        }
        _ => {
            // Default: if there's a fee, record it as an expense
            if fee_amount > 0.0 {
                lines.push(JournalEntryLineInput {
                    gl_account_id: network_fees_id,
                    token_id: None,
                    debit_amount: fee_amount,
                    credit_amount: 0.0,
                    description: Some("Network/gas fee".to_string()),
                });
                lines.push(JournalEntryLineInput {
                    gl_account_id: crypto_assets_id,
                    token_id: None,
                    debit_amount: 0.0,
                    credit_amount: fee_amount,
                    description: Some("Fee paid from crypto assets".to_string()),
                });
            }
            format!(
                "{} on {} ({})",
                tx.tx_type,
                tx.chain_id,
                &tx.hash[..8.min(tx.hash.len())]
            )
        }
    };

    // If we have no lines at all, create a placeholder
    if lines.is_empty() {
        lines.push(JournalEntryLineInput {
            gl_account_id: crypto_assets_id,
            token_id: None,
            debit_amount: 0.01,
            credit_amount: 0.0,
            description: Some("Placeholder — update amounts".to_string()),
        });
        lines.push(JournalEntryLineInput {
            gl_account_id: income_id,
            token_id: None,
            debit_amount: 0.0,
            credit_amount: 0.01,
            description: Some("Placeholder — update amounts".to_string()),
        });
    }

    // Format timestamp
    let entry_date = chrono::DateTime::from_timestamp(tx.timestamp, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    let input = NewJournalEntryInput {
        entry_date,
        description,
        reference_number: Some(tx.hash.clone()),
        raw_transaction_id: Some(transaction_id),
        lines,
    };

    create_journal_entry(state, input).await
}

/// Lightweight row for reading multi_chain_transactions during auto-classify.
#[derive(Debug, Clone, FromRow)]
struct MultiChainTx {
    /// Transaction composite ID.
    #[allow(dead_code)]
    id: String,
    /// Blockchain identifier.
    chain_id: String,
    /// Transaction hash.
    hash: String,
    /// Sender address.
    #[allow(dead_code)]
    from_address: String,
    /// Recipient address.
    #[allow(dead_code)]
    to_address: Option<String>,
    /// Transaction value as string.
    value: String,
    /// Transaction fee as string.
    fee: Option<String>,
    /// Unix timestamp.
    timestamp: i64,
    /// Transaction type classification.
    tx_type: String,
    /// Transaction status.
    #[allow(dead_code)]
    status: String,
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

// ============================================================================
// Transaction Classification Commands
// ============================================================================

/// Updates the classification status of a multi-chain transaction.
#[tauri::command]
pub async fn update_transaction_classification(
    state: State<'_, DatabaseState>,
    transaction_id: String,
    classification_status: String,
) -> Result<(), String> {
    let valid = ["unclassified", "classified", "ignored", "split"];
    if !valid.contains(&classification_status.as_str()) {
        return Err(format!(
            "Invalid classification status: {classification_status}"
        ));
    }

    sqlx::query("UPDATE multi_chain_transactions SET classification_status = ? WHERE id = ?")
        .bind(&classification_status)
        .bind(&transaction_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Ledger Query Commands
// ============================================================================

/// Returns account balances from the v_account_balances view.
#[tauri::command]
pub async fn get_account_balances(
    state: State<'_, DatabaseState>,
) -> Result<Vec<AccountBalance>, String> {
    sqlx::query_as::<_, AccountBalance>("SELECT * FROM v_account_balances ORDER BY account_number")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Returns the trial balance from the v_trial_balance view.
#[tauri::command]
pub async fn get_trial_balance(
    state: State<'_, DatabaseState>,
) -> Result<Vec<TrialBalanceRow>, String> {
    sqlx::query_as::<_, TrialBalanceRow>("SELECT * FROM v_trial_balance ORDER BY account_number")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

/// Returns the count of unclassified multi-chain transactions.
#[tauri::command]
pub async fn get_unclassified_transaction_count(
    state: State<'_, DatabaseState>,
) -> Result<i64, String> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM multi_chain_transactions WHERE classification_status = 'unclassified'",
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.0)
}

/// Returns the count of draft (unposted, non-reversed) journal entries.
#[tauri::command]
pub async fn get_draft_journal_entry_count(state: State<'_, DatabaseState>) -> Result<i64, String> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM journal_entries WHERE is_posted = 0 AND is_reversed = 0",
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.0)
}

// ============================================================================
// Tests — Journal-Entry Balance Invariant (GIV-665)
// ============================================================================

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::SqlitePool;

    /// Creates an in-memory SQLite pool with all migrations applied.
    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory SQLite pool");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        pool
    }

    /// Returns two GL account IDs from the seed data (1000=Cash, 4000=Income).
    async fn get_test_accounts(pool: &SqlitePool) -> (i64, i64) {
        let (acct_a,): (i64,) =
            sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = '1000'")
                .fetch_one(pool)
                .await
                .expect("Seed account 1000 should exist");
        let (acct_b,): (i64,) =
            sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = '4000'")
                .fetch_one(pool)
                .await
                .expect("Seed account 4000 should exist");
        (acct_a, acct_b)
    }

    /// Creates a draft journal entry and returns its id.
    async fn create_draft_entry(pool: &SqlitePool) -> i64 {
        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, created_by) VALUES ('2026-01-01', 'TEST-001', 'Test entry', 0, 'test')",
        )
        .execute(pool)
        .await
        .expect("Failed to create draft entry");

        result.last_insert_rowid()
    }

    /// Adds a balanced pair of lines (debit + credit) to the given entry.
    async fn add_balanced_lines(pool: &SqlitePool, entry_id: i64, debit_acct: i64, credit_acct: i64, amount: f64) {
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, ?, 0, 1)",
        )
        .bind(entry_id)
        .bind(debit_acct)
        .bind(amount)
        .execute(pool)
        .await
        .expect("Failed to add debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 0, ?, 2)",
        )
        .bind(entry_id)
        .bind(credit_acct)
        .bind(amount)
        .execute(pool)
        .await
        .expect("Failed to add credit line");
    }

    // ---- Born-posted INSERT rejected ----

    #[tokio::test]
    async fn born_posted_insert_rejected() {
        let pool = setup_test_db().await;

        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, created_by) VALUES ('2026-01-01', 'BP-001', 'Born posted', 1, 'test')",
        )
        .execute(&pool)
        .await;

        assert!(result.is_err(), "Born-posted INSERT should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("must be created as drafts"),
            "Error should mention drafts, got: {err}"
        );
    }

    // ---- Line immutability on posted entries ----

    #[tokio::test]
    async fn insert_line_on_posted_entry_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 100.0).await;

        // Post it
        sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        // Try to insert a new line
        let result = sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 50, 0, 3)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await;

        assert!(result.is_err(), "INSERT line on posted entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("immutable"),
            "Error should mention immutability, got: {err}"
        );
    }

    #[tokio::test]
    async fn update_line_on_posted_entry_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 100.0).await;

        sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        // Try to update a line
        let result = sqlx::query(
            "UPDATE journal_entry_lines SET debit_amount = 200 WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await;

        assert!(result.is_err(), "UPDATE line on posted entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("immutable"),
            "Error should mention immutability, got: {err}"
        );
    }

    #[tokio::test]
    async fn delete_line_on_posted_entry_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 100.0).await;

        sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        // Try to delete a line
        let result = sqlx::query(
            "DELETE FROM journal_entry_lines WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await;

        assert!(result.is_err(), "DELETE line on posted entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("immutable"),
            "Error should mention immutability, got: {err}"
        );
    }

    // ---- Draft entry line ops still allowed ----

    #[tokio::test]
    async fn crud_lines_on_draft_entry_allowed() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;

        // INSERT
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 100, 0, 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("INSERT line on draft should succeed");

        // UPDATE
        sqlx::query(
            "UPDATE journal_entry_lines SET debit_amount = 200 WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("UPDATE line on draft should succeed");

        // DELETE
        sqlx::query(
            "DELETE FROM journal_entry_lines WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("DELETE line on draft should succeed");

        // Re-add balanced lines for completeness
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 50.0).await;
    }

    // ---- Zero-line entry post rejected ----

    #[tokio::test]
    async fn zero_line_entry_post_rejected() {
        let pool = setup_test_db().await;
        let entry_id = create_draft_entry(&pool).await;

        let result = sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(result.is_err(), "Posting zero-line entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("at least 2 lines"),
            "Error should mention minimum lines, got: {err}"
        );
    }

    // ---- Unbalanced post rejected (direct SQL, proves trigger) ----

    #[tokio::test]
    async fn unbalanced_post_rejected_via_direct_sql() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;

        // Add unbalanced lines: debit 100, credit 50
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 100, 0, 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 0, 50, 2)",
        )
        .bind(entry_id)
        .bind(acct_b)
        .execute(&pool)
        .await
        .expect("Insert credit line");

        let result = sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(result.is_err(), "Posting unbalanced entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("debits must equal credits"),
            "Error should mention balance, got: {err}"
        );
    }

    // ---- Happy path: create draft -> balanced lines -> post -> void ----

    #[tokio::test]
    async fn happy_path_draft_post_void() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;

        // Create draft
        let entry_id = create_draft_entry(&pool).await;

        // Verify it's a draft
        let (is_posted,): (bool,) =
            sqlx::query_as("SELECT is_posted FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert!(!is_posted, "Entry should start as draft");

        // Add balanced lines
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 100.0).await;

        // Post
        sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        let (is_posted,): (bool,) =
            sqlx::query_as("SELECT is_posted FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert!(is_posted, "Entry should be posted");

        // Void
        sqlx::query("UPDATE journal_entries SET is_reversed = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Voiding entry should succeed");

        let (is_reversed,): (bool,) =
            sqlx::query_as("SELECT is_reversed FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert!(is_reversed, "Entry should be voided");
    }

    // ---- Single-line entry post rejected ----

    #[tokio::test]
    async fn single_line_entry_post_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, _acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;

        // Add only one line
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 100, 0, 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert single line");

        let result = sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(result.is_err(), "Posting single-line entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("at least 2 lines"),
            "Error should mention minimum lines, got: {err}"
        );
    }

    // ---- Re-pointing a line onto a posted entry is blocked ----

    #[tokio::test]
    async fn repoint_line_onto_posted_entry_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;

        // Create and post entry A
        let entry_a = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_a, acct_a, acct_b, 100.0).await;
        sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_a)
            .execute(&pool)
            .await
            .expect("Post entry A");

        // Create draft entry B with a line
        let result_b = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, created_by) VALUES ('2026-01-02', 'TEST-002', 'Entry B', 0, 'test')",
        )
        .execute(&pool)
        .await
        .expect("Create entry B");
        let entry_b = result_b.last_insert_rowid();

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, line_number) VALUES (?, ?, 50, 0, 1)",
        )
        .bind(entry_b)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Add line to draft entry B");

        // Try to re-point entry B's line onto posted entry A
        let result = sqlx::query(
            "UPDATE journal_entry_lines SET journal_entry_id = ? WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_a)
        .bind(entry_b)
        .execute(&pool)
        .await;

        assert!(result.is_err(), "Re-pointing line onto posted entry should be rejected");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("immutable"),
            "Error should mention immutability, got: {err}"
        );
    }
}
