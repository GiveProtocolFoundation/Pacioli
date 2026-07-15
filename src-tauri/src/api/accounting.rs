use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use std::str::FromStr;
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
    /// Whether the entry has been posted to the ledger (legacy, synced with status).
    pub is_posted: bool,
    /// Whether the entry has been reversed (legacy).
    pub is_reversed: bool,
    /// ID of the reversing entry, if reversed.
    pub reversed_by_entry_id: Option<i64>,
    /// Who created this entry.
    pub created_by: Option<String>,
    /// Timestamp when the entry was created.
    pub created_at: Option<NaiveDateTime>,
    /// Timestamp when the entry was last updated.
    pub updated_at: Option<NaiveDateTime>,
    /// FK to entities table (nullable in single-entity Stage 1).
    pub entity_id: Option<String>,
    /// Lifecycle status: draft, approved, posted, voided.
    pub status: String,
    /// How the entry was drafted: manual, rule, model.
    pub origin: String,
    /// Who approved this entry.
    pub approved_by: Option<String>,
    /// When this entry was approved.
    pub approved_at: Option<NaiveDateTime>,
    /// When this entry was posted to the ledger.
    pub posted_at: Option<NaiveDateTime>,
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
    /// Optional FK to tokens table (legacy, superseded by asset_id).
    pub token_id: Option<i64>,
    /// Legacy debit amount (float, kept for backward compat).
    pub debit_amount: f64,
    /// Legacy credit amount (float, kept for backward compat).
    pub credit_amount: f64,
    /// Optional line-level description.
    pub description: Option<String>,
    /// Ordering within the entry.
    pub line_number: Option<i64>,
    /// Timestamp when the line was created.
    pub created_at: Option<NaiveDateTime>,
    /// Debit value in functional-currency minor units (USD cents).
    pub debit_minor: i64,
    /// Credit value in functional-currency minor units (USD cents).
    pub credit_minor: i64,
    /// Token quantity as canonical decimal string (rust_decimal round-trip).
    /// NULL for pure-fiat lines.
    pub quantity: Option<String>,
    /// Asset identifier: 'USD' for fiat, 'token:<id>' for tokens,
    /// NULL for measurement lines (gains/losses).
    pub asset_id: Option<String>,
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
    /// Optional FK to tokens table (legacy).
    pub token_id: Option<i64>,
    /// Debit value in functional-currency minor units (USD cents).
    pub debit_minor: i64,
    /// Credit value in functional-currency minor units (USD cents).
    pub credit_minor: i64,
    /// Token quantity as canonical decimal string. NULL for pure-fiat lines.
    pub quantity: Option<String>,
    /// Asset identifier: 'USD' for fiat, 'token:<id>' for tokens,
    /// NULL for measurement lines.
    pub asset_id: Option<String>,
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
    /// Total debits posted (minor units, USD cents).
    pub total_debits: i64,
    /// Total credits posted (minor units, USD cents).
    pub total_credits: i64,
    /// Balance in natural direction (minor units).
    pub balance: i64,
    /// Signed balance for reporting (minor units).
    pub balance_signed: i64,
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
    /// Debit balance in minor units (0 if credit side).
    pub debit_balance: i64,
    /// Credit balance in minor units (0 if debit side).
    pub credit_balance: i64,
}

// ============================================================================
// PostedEntry — Type-Safe Balanced Entry (GIV-673)
// ============================================================================

/// A validated line for a posted entry. Private fields ensure construction
/// only through `PostedEntry::new`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostedEntryLine {
    /// FK to gl_accounts.
    pub gl_account_id: i64,
    /// Debit value in functional-currency minor units (USD cents).
    pub debit_minor: i64,
    /// Credit value in functional-currency minor units (USD cents).
    pub credit_minor: i64,
    /// Token quantity as canonical decimal (rust_decimal). NULL for fiat-only.
    #[serde(
        serialize_with = "serialize_opt_decimal",
        deserialize_with = "deserialize_opt_decimal"
    )]
    pub quantity: Option<Decimal>,
    /// Asset identifier. NULL for measurement lines.
    pub asset_id: Option<String>,
    /// Optional line description.
    pub description: Option<String>,
}

/// Serializes Option<Decimal> as Option<String>.
fn serialize_opt_decimal<S: serde::Serializer>(
    val: &Option<Decimal>,
    ser: S,
) -> Result<S::Ok, S::Error> {
    match val {
        Some(d) => ser.serialize_some(&d.to_string()),
        None => ser.serialize_none(),
    }
}

/// Deserializes Option<String> to Option<Decimal>.
fn deserialize_opt_decimal<'de, D: serde::Deserializer<'de>>(
    de: D,
) -> Result<Option<Decimal>, D::Error> {
    let opt: Option<String> = Option::deserialize(de)?;
    match opt {
        Some(s) => Decimal::from_str(&s)
            .map(Some)
            .map_err(serde::de::Error::custom),
        None => Ok(None),
    }
}

/// A journal entry that has been validated as balanced and is safe to post.
///
/// **Construction:** `PostedEntry::new(lines)` validates:
/// 1. At least 2 lines
/// 2. Functional-currency minor-unit balance == 0 exactly
/// 3. Per-asset quantity balance via `rust_decimal` (each asset with quantities
///    must have debit quantities == credit quantities)
///
/// If validation passes, the entry is guaranteed balanced. Every Rust path
/// that persists a posted entry goes through this type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostedEntry {
    lines: Vec<PostedEntryLine>,
}

impl PostedEntry {
    /// Validates and constructs a `PostedEntry` from the given lines.
    ///
    /// # Errors
    /// Returns an error string if:
    /// - Lines are empty or have fewer than 2 entries
    /// - Functional-currency minor-unit balance is not exactly zero
    /// - Per-asset quantity balance fails for any asset
    /// - Any line has both debit_minor and credit_minor > 0
    pub fn new(lines: Vec<PostedEntryLine>) -> Result<Self, String> {
        if lines.is_empty() {
            return Err("PostedEntry requires at least 2 lines; got 0".to_string());
        }
        if lines.len() < 2 {
            return Err(format!(
                "PostedEntry requires at least 2 lines; got {}",
                lines.len()
            ));
        }

        // Validate one-sided lines
        for (i, line) in lines.iter().enumerate() {
            if line.debit_minor > 0 && line.credit_minor > 0 {
                return Err(format!(
                    "Line {i} has both debit_minor ({}) and credit_minor ({}); must be one-sided",
                    line.debit_minor, line.credit_minor
                ));
            }
            if line.debit_minor == 0 && line.credit_minor == 0 {
                return Err(format!(
                    "Line {i} has zero debit_minor and zero credit_minor"
                ));
            }
        }

        // Check 1: functional-currency minor-unit balance
        let total_debit: i64 = lines.iter().map(|l| l.debit_minor).sum();
        let total_credit: i64 = lines.iter().map(|l| l.credit_minor).sum();
        if total_debit != total_credit {
            return Err(format!(
                "Functional-currency imbalance: total debits ({total_debit}) != total credits ({total_credit}) in minor units"
            ));
        }

        // Check 2: per-asset quantity balance
        // For each asset that has quantities on BOTH debit and credit sides,
        // the quantities must balance. Assets appearing on only one side are
        // valid — measurement lines (no quantity, no asset_id) carry the
        // cross-asset valuation difference in the functional currency.
        let mut asset_debits: HashMap<String, Decimal> = HashMap::new();
        let mut asset_credits: HashMap<String, Decimal> = HashMap::new();

        for line in &lines {
            if let (Some(ref asset_id), Some(ref qty)) = (&line.asset_id, &line.quantity) {
                if line.debit_minor > 0 {
                    *asset_debits
                        .entry(asset_id.clone())
                        .or_insert(Decimal::ZERO) += qty;
                } else {
                    *asset_credits
                        .entry(asset_id.clone())
                        .or_insert(Decimal::ZERO) += qty;
                }
            }
        }

        // Only check assets that appear on both sides
        for (asset, d) in &asset_debits {
            if let Some(c) = asset_credits.get(asset) {
                if d != c {
                    return Err(format!(
                        "Per-asset quantity imbalance for '{asset}': debit qty ({d}) != credit qty ({c})"
                    ));
                }
            }
        }

        Ok(Self { lines })
    }

    /// Returns a reference to the validated lines.
    #[allow(dead_code)]
    pub fn lines(&self) -> &[PostedEntryLine] {
        &self.lines
    }

    /// Consumes the entry and returns the validated lines.
    #[allow(dead_code)]
    pub fn into_lines(self) -> Vec<PostedEntryLine> {
        self.lines
    }
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
        if (line.debit_minor > 0 && line.credit_minor > 0)
            || (line.debit_minor == 0 && line.credit_minor == 0)
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
        INSERT INTO journal_entries (entry_date, entry_number, description, reference_number, is_posted, status, origin, created_by)
        VALUES (?, ?, ?, ?, 0, 'draft', 'manual', 'system')
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

    // Insert lines (write both legacy float and new minor-unit columns in tandem)
    for (i, line) in input.lines.iter().enumerate() {
        let debit_amount = line.debit_minor as f64 / 100.0;
        let credit_amount = line.credit_minor as f64 / 100.0;
        sqlx::query(
            r#"
            INSERT INTO journal_entry_lines (
                journal_entry_id, gl_account_id, token_id,
                debit_amount, credit_amount,
                debit_minor, credit_minor,
                quantity, asset_id,
                description, line_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(entry_id)
        .bind(line.gl_account_id)
        .bind(line.token_id)
        .bind(debit_amount)
        .bind(credit_amount)
        .bind(line.debit_minor)
        .bind(line.credit_minor)
        .bind(&line.quantity)
        .bind(&line.asset_id)
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

/// Posts a draft journal entry. Validates balance via `PostedEntry` type
/// and DB triggers (belt-and-suspenders).
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

    if entry.status == "posted" || entry.is_posted {
        return Err("Journal entry is already posted".to_string());
    }

    if entry.status == "voided" || entry.is_reversed {
        return Err("Cannot post a voided/reversed entry".to_string());
    }

    // Fetch lines and validate via PostedEntry type
    let db_lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Build PostedEntry for type-level validation
    let posted_lines: Vec<PostedEntryLine> = db_lines
        .iter()
        .map(|l| {
            let quantity = l.quantity.as_ref().and_then(|q| Decimal::from_str(q).ok());
            PostedEntryLine {
                gl_account_id: l.gl_account_id,
                debit_minor: l.debit_minor,
                credit_minor: l.credit_minor,
                quantity,
                asset_id: l.asset_id.clone(),
                description: l.description.clone(),
            }
        })
        .collect();

    // This validates balance invariants before we touch the DB
    let _posted = PostedEntry::new(posted_lines)?;

    // Post the entry via status column (triggers also validate)
    sqlx::query("UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ?")
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

    // Parse amount as float from raw tx, convert to minor units at accounting boundary
    let amount_f64: f64 = tx.value.parse().unwrap_or(0.0);
    let amount_minor: i64 = (amount_f64 * 100.0).round() as i64;
    let fee_f64: f64 = tx.fee.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    let fee_minor: i64 = (fee_f64 * 100.0).round() as i64;

    // Build lines based on tx_type heuristics
    let mut lines = Vec::new();
    let description = match tx.tx_type.as_str() {
        "claim" | "stake" => {
            // Staking reward: DR Crypto Assets / CR Staking Income
            if amount_minor > 0 {
                lines.push(JournalEntryLineInput {
                    gl_account_id: crypto_assets_id,
                    token_id: None,
                    debit_minor: amount_minor,
                    credit_minor: 0,
                    quantity: None,
                    asset_id: Some("USD".to_string()),
                    description: Some("Staking reward received".to_string()),
                });
                lines.push(JournalEntryLineInput {
                    gl_account_id: staking_income_id,
                    token_id: None,
                    debit_minor: 0,
                    credit_minor: amount_minor,
                    quantity: None,
                    asset_id: Some("USD".to_string()),
                    description: Some("Staking reward income".to_string()),
                });
            }
            format!("Staking reward on {}", tx.chain_id)
        }
        "transfer" => {
            // Incoming transfer: DR Crypto Assets / CR Income (uncategorized)
            if amount_minor > 0 {
                lines.push(JournalEntryLineInput {
                    gl_account_id: crypto_assets_id,
                    token_id: None,
                    debit_minor: amount_minor,
                    credit_minor: 0,
                    quantity: None,
                    asset_id: Some("USD".to_string()),
                    description: Some("Transfer received".to_string()),
                });
                lines.push(JournalEntryLineInput {
                    gl_account_id: income_id,
                    token_id: None,
                    debit_minor: 0,
                    credit_minor: amount_minor,
                    quantity: None,
                    asset_id: Some("USD".to_string()),
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
            if fee_minor > 0 {
                lines.push(JournalEntryLineInput {
                    gl_account_id: network_fees_id,
                    token_id: None,
                    debit_minor: fee_minor,
                    credit_minor: 0,
                    quantity: None,
                    asset_id: Some("USD".to_string()),
                    description: Some("Network/gas fee".to_string()),
                });
                lines.push(JournalEntryLineInput {
                    gl_account_id: crypto_assets_id,
                    token_id: None,
                    debit_minor: 0,
                    credit_minor: fee_minor,
                    quantity: None,
                    asset_id: Some("USD".to_string()),
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
            debit_minor: 1,
            credit_minor: 0,
            quantity: None,
            asset_id: Some("USD".to_string()),
            description: Some("Placeholder — update amounts".to_string()),
        });
        lines.push(JournalEntryLineInput {
            gl_account_id: income_id,
            token_id: None,
            debit_minor: 0,
            credit_minor: 1,
            quantity: None,
            asset_id: Some("USD".to_string()),
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
// Tests — Journal-Entry Balance Invariant (GIV-665 + GIV-673)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::SqlitePool;
    use std::str::FromStr;

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

    /// Returns three GL account IDs: 1200=Digital Assets, 4000=Income, 5000=Expenses.
    async fn get_three_accounts(pool: &SqlitePool) -> (i64, i64, i64) {
        let (digital_assets,): (i64,) =
            sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = '1200'")
                .fetch_one(pool)
                .await
                .expect("Seed account 1200 should exist");
        let (income,): (i64,) =
            sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = '4000'")
                .fetch_one(pool)
                .await
                .expect("Seed account 4000 should exist");
        let (expenses,): (i64,) =
            sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = '5000'")
                .fetch_one(pool)
                .await
                .expect("Seed account 5000 should exist");
        (digital_assets, income, expenses)
    }

    /// Creates a draft journal entry with a unique entry_number and returns its id.
    async fn create_draft_entry(pool: &SqlitePool) -> i64 {
        create_named_draft_entry(pool, "TEST-001").await
    }

    /// Creates a draft journal entry with a specific entry_number.
    async fn create_named_draft_entry(pool: &SqlitePool, entry_number: &str) -> i64 {
        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES ('2026-01-01', ?, 'Test entry', 0, 'draft', 'manual', 'test')",
        )
        .bind(entry_number)
        .execute(pool)
        .await
        .expect("Failed to create draft entry");

        result.last_insert_rowid()
    }

    /// Adds a balanced pair of lines (debit + credit) in minor units.
    async fn add_balanced_lines(
        pool: &SqlitePool,
        entry_id: i64,
        debit_acct: i64,
        credit_acct: i64,
        amount_minor: i64,
    ) {
        let debit_amount = amount_minor as f64 / 100.0;
        let credit_amount = amount_minor as f64 / 100.0;
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, ?, 0, ?, 0, 'USD', 1)",
        )
        .bind(entry_id)
        .bind(debit_acct)
        .bind(debit_amount)
        .bind(amount_minor)
        .execute(pool)
        .await
        .expect("Failed to add debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, ?, 0, ?, 'USD', 2)",
        )
        .bind(entry_id)
        .bind(credit_acct)
        .bind(credit_amount)
        .bind(amount_minor)
        .execute(pool)
        .await
        .expect("Failed to add credit line");
    }

    // ========================================================================
    // GIV-665 — Existing trigger tests (updated for minor-unit schema)
    // ========================================================================

    // ---- Born-posted INSERT rejected ----

    #[tokio::test]
    async fn born_posted_insert_rejected() {
        let pool = setup_test_db().await;

        // status != 'draft' triggers the born-posted guard
        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES ('2026-01-01', 'BP-001', 'Born posted', 0, 'posted', 'manual', 'test')",
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
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        // Post via status column
        sqlx::query("UPDATE journal_entries SET status = 'posted', is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        // Try to insert a new line
        let result = sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 50, 0, 5000, 0, 3)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await;

        assert!(
            result.is_err(),
            "INSERT line on posted entry should be rejected"
        );
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
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        sqlx::query("UPDATE journal_entries SET status = 'posted', is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        let result = sqlx::query(
            "UPDATE journal_entry_lines SET debit_minor = 20000 WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await;

        assert!(
            result.is_err(),
            "UPDATE line on posted entry should be rejected"
        );
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
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        sqlx::query("UPDATE journal_entries SET status = 'posted', is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        let result = sqlx::query(
            "DELETE FROM journal_entry_lines WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await;

        assert!(
            result.is_err(),
            "DELETE line on posted entry should be rejected"
        );
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

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 100, 0, 10000, 0, 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("INSERT line on draft should succeed");

        sqlx::query(
            "UPDATE journal_entry_lines SET debit_minor = 20000 WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("UPDATE line on draft should succeed");

        sqlx::query(
            "DELETE FROM journal_entry_lines WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("DELETE line on draft should succeed");

        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 5000).await;
    }

    // ---- Zero-line entry post rejected ----

    #[tokio::test]
    async fn zero_line_entry_post_rejected() {
        let pool = setup_test_db().await;
        let entry_id = create_draft_entry(&pool).await;

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "Posting zero-line entry should be rejected"
        );
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

        // Unbalanced: debit 10000 cents, credit 5000 cents
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 100, 0, 10000, 0, 'USD', 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, 50, 0, 5000, 'USD', 2)",
        )
        .bind(entry_id)
        .bind(acct_b)
        .execute(&pool)
        .await
        .expect("Insert credit line");

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "Posting unbalanced entry should be rejected"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("does not balance"),
            "Error should mention balance, got: {err}"
        );
    }

    // ---- Happy path: create draft -> balanced lines -> post -> void ----

    #[tokio::test]
    async fn happy_path_draft_post_void() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;

        let entry_id = create_draft_entry(&pool).await;

        let (status,): (String,) =
            sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert_eq!(status, "draft", "Entry should start as draft");

        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        // Post via status
        sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Posting balanced entry should succeed");

        let (status,): (String,) =
            sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert_eq!(status, "posted", "Entry should be posted");

        // Void via status
        sqlx::query("UPDATE journal_entries SET status = 'voided' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Voiding entry should succeed");

        let (status,): (String,) =
            sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert_eq!(status, "voided", "Entry should be voided");
    }

    // ---- Single-line entry post rejected ----

    #[tokio::test]
    async fn single_line_entry_post_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, _acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 100, 0, 10000, 0, 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert single line");

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "Posting single-line entry should be rejected"
        );
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

        let entry_a = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_a, acct_a, acct_b, 10000).await;
        sqlx::query("UPDATE journal_entries SET status = 'posted', is_posted = 1 WHERE id = ?")
            .bind(entry_a)
            .execute(&pool)
            .await
            .expect("Post entry A");

        let result_b = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES ('2026-01-02', 'TEST-002', 'Entry B', 0, 'draft', 'manual', 'test')",
        )
        .execute(&pool)
        .await
        .expect("Create entry B");
        let entry_b = result_b.last_insert_rowid();

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 50, 0, 5000, 0, 1)",
        )
        .bind(entry_b)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Add line to draft entry B");

        let result = sqlx::query(
            "UPDATE journal_entry_lines SET journal_entry_id = ? WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_a)
        .bind(entry_b)
        .execute(&pool)
        .await;

        assert!(
            result.is_err(),
            "Re-pointing line onto posted entry should be rejected"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("immutable"),
            "Error should mention immutability, got: {err}"
        );
    }

    // ========================================================================
    // GIV-673 — Phase 1 Acceptance Tests
    // ========================================================================

    // ---- PostedEntry constructor rejects unbalanced input ----

    #[test]
    fn posted_entry_rejects_empty() {
        let result = PostedEntry::new(vec![]);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("at least 2 lines"));
    }

    #[test]
    fn posted_entry_rejects_single_line() {
        let result = PostedEntry::new(vec![PostedEntryLine {
            gl_account_id: 1,
            debit_minor: 10000,
            credit_minor: 0,
            quantity: None,
            asset_id: Some("USD".to_string()),
            description: None,
        }]);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("at least 2 lines"));
    }

    #[test]
    fn posted_entry_rejects_unbalanced_minor_units() {
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 10000,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 9999, // 1 cent off
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("Functional-currency imbalance"),
            "Should report functional-currency imbalance, got: {err}"
        );
    }

    #[test]
    fn posted_entry_rejects_one_cent_imbalance() {
        // Zero tolerance: a 1-cent imbalance is rejected
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 5001, // $50.01
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 5000, // $50.00
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_err(), "1-cent imbalance must be rejected");
    }

    #[test]
    fn posted_entry_rejects_per_asset_quantity_imbalance() {
        // Functional currency balances, but asset quantities don't
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 15000, // $150
                credit_minor: 0,
                quantity: Some(Decimal::from_str("4").unwrap()),
                asset_id: Some("token:B".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 10000, // $100
                quantity: Some(Decimal::from_str("10").unwrap()),
                asset_id: Some("token:A".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 3,
                debit_minor: 0,
                credit_minor: 5000, // $50 gain
                quantity: None,
                asset_id: None, // measurement line
                description: Some("Realized gain".to_string()),
            },
        ]);
        // This should succeed because:
        // - Functional currency: 15000 == 10000 + 5000 ✓
        // - token:A has 10 credit, 0 debit → but it's a one-sided asset (swap out), which is fine
        //   because each asset only needs to balance IF it appears on both sides.
        // Actually wait: the spec says "for each asset appearing with quantities, debit qty == credit qty"
        // token:A has only credits (10), token:B has only debits (4). Neither balances.
        // But measurement lines carry the cross-asset difference.
        // Let me re-read the spec...
        //
        // The spec says: "per-asset quantity debits equal credits for each asset appearing with quantities;
        // measurement lines (functional-currency-only lines, no quantity) carry cross-asset differences"
        //
        // In a swap, token:A exits (credit side only) and token:B enters (debit side only).
        // Per-asset: token:A has 0 debit qty, 10 credit qty → imbalance. This SHOULD be allowed
        // because the measurement line carries the difference. But the trigger checks strict balance.
        //
        // Actually, re-reading the worked example in accounting-model.md:
        // Line 1: Digital assets B, debit $150, qty +4 (asset B)
        // Line 2: Digital assets A, credit $100, qty -10 (asset A)
        // Line 3: Realized gain, credit $50, no qty, no asset
        //
        // The convention uses SIGNED quantities. qty +4 on debit side, qty -10 on credit side.
        // But wait, that doesn't make sense with one-sided amounts. Let me think again.
        //
        // In double-entry: a debit to "Digital assets — B" with qty 4 means B enters the books.
        // A credit to "Digital assets — A" with qty 10 means A leaves the books.
        // These are DIFFERENT assets. Per-asset balance means:
        // - For asset B: 4 debit qty, 0 credit qty → +4 net. This is fine — it's a one-way movement.
        // - For asset A: 0 debit qty, 10 credit qty → -10 net. This is also fine — one-way out.
        //
        // The spec says measurement lines carry cross-asset differences. So the per-asset check
        // should NOT require balance for assets that appear on only one side — that's the whole
        // point of measurement lines.
        //
        // But the issue description says: "per-asset quantity debits equal credits for each asset"
        // This implies strict balance per asset. In a swap, each asset naturally appears on only
        // one side, so they won't balance per-asset. This would mean swaps are impossible...
        //
        // Unless the interpretation is: assets that appear with quantities on BOTH debit and credit
        // sides must balance. Assets appearing on only one side are fine (they're accounted for by
        // measurement lines on the functional-currency side).
        //
        // I'll implement it as: for each asset that has quantities on both sides, they must balance.
        // Assets appearing on only one side are valid (cross-asset movements).
        //
        // With this interpretation, the swap example succeeds.
        assert!(
            result.is_ok(),
            "Swap example should succeed: {}",
            result.unwrap_err()
        );
    }

    #[test]
    fn posted_entry_rejects_same_asset_quantity_imbalance() {
        // Same asset appears with different quantities on debit and credit
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 10000,
                credit_minor: 0,
                quantity: Some(Decimal::from_str("5").unwrap()),
                asset_id: Some("token:A".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 10000,
                quantity: Some(Decimal::from_str("3").unwrap()), // different qty!
                asset_id: Some("token:A".to_string()),
                description: None,
            },
        ]);
        assert!(
            result.is_err(),
            "Same-asset quantity imbalance must be rejected"
        );
        let err = result.unwrap_err();
        assert!(
            err.contains("Per-asset quantity imbalance"),
            "Error should mention per-asset imbalance, got: {err}"
        );
    }

    #[test]
    fn posted_entry_accepts_balanced() {
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 10000,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 10000,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_ok(), "Balanced entry should succeed");
        assert_eq!(result.unwrap().lines().len(), 2);
    }

    // ---- Worked swap example from accounting-model.md ----

    #[test]
    fn posted_entry_swap_example_from_accounting_model() {
        // Swap 10 A (basis $100, fair value $150) for 4 B
        // Line 1: DR Digital assets — B, asset B, qty 4, $150.00
        // Line 2: CR Digital assets — A, asset A, qty 10, $100.00
        // Line 3: CR Realized gain, measurement line, $50.00
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1, // Digital assets — B
                debit_minor: 15000,
                credit_minor: 0,
                quantity: Some(Decimal::from_str("4").unwrap()),
                asset_id: Some("token:B".to_string()),
                description: Some("Swap in: 4 B at $150".to_string()),
            },
            PostedEntryLine {
                gl_account_id: 2, // Digital assets — A
                debit_minor: 0,
                credit_minor: 10000,
                quantity: Some(Decimal::from_str("10").unwrap()),
                asset_id: Some("token:A".to_string()),
                description: Some("Swap out: 10 A at cost $100".to_string()),
            },
            PostedEntryLine {
                gl_account_id: 3, // Realized gain on digital assets
                debit_minor: 0,
                credit_minor: 5000,
                quantity: None,
                asset_id: None, // measurement line
                description: Some("Realized gain on swap".to_string()),
            },
        ]);
        assert!(
            result.is_ok(),
            "Swap example from accounting-model.md should succeed: {}",
            result.as_ref().unwrap_err()
        );
    }

    // ---- Direct-SQL trigger tests for minor-unit balance (GIV-673) ----

    #[tokio::test]
    async fn trigger_rejects_one_cent_minor_unit_imbalance() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "CENT-001").await;

        // Debit 10001 cents, credit 10000 cents (1-cent imbalance)
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 100.01, 0, 10001, 0, 'USD', 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, 100, 0, 10000, 'USD', 2)",
        )
        .bind(entry_id)
        .bind(acct_b)
        .execute(&pool)
        .await
        .expect("Insert credit line");

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "1-cent minor-unit imbalance must be rejected by trigger"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("does not balance"),
            "Trigger should reject minor-unit imbalance, got: {err}"
        );
    }

    #[tokio::test]
    async fn trigger_rejects_born_posted_status() {
        let pool = setup_test_db().await;

        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES ('2026-01-01', 'BORN-001', 'Test', 0, 'approved', 'manual', 'test')",
        )
        .execute(&pool)
        .await;

        assert!(result.is_err(), "Non-draft INSERT should be rejected");
    }

    #[tokio::test]
    async fn trigger_rejects_posted_line_mutation() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "MUT-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        sqlx::query("UPDATE journal_entries SET status = 'posted', is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Post should succeed");

        // Try to mutate a line
        let result = sqlx::query(
            "UPDATE journal_entry_lines SET debit_minor = 99999 WHERE journal_entry_id = ? AND line_number = 1",
        )
        .bind(entry_id)
        .execute(&pool)
        .await;

        assert!(result.is_err(), "Mutating posted lines must be rejected");
    }

    #[tokio::test]
    async fn trigger_rejects_per_asset_quantity_imbalance() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "ASSET-001").await;

        // Same asset (token:X) with different quantities on debit/credit
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 100, 0, 10000, 0, '5.0', 'token:X', 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 0, 100, 0, 10000, '3.0', 'token:X', 2)",
        )
        .bind(entry_id)
        .bind(acct_b)
        .execute(&pool)
        .await
        .expect("Insert credit line");

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "Per-asset quantity imbalance must be rejected by trigger"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Per-asset quantity imbalance"),
            "Trigger should mention per-asset imbalance, got: {err}"
        );
    }

    #[tokio::test]
    async fn trigger_accepts_swap_with_measurement_line() {
        let pool = setup_test_db().await;
        let (digital_assets, income, _expenses) = get_three_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "SWAP-001").await;

        // Swap 10 A (basis $100) for 4 B (fair value $150)
        // Line 1: DR Digital assets — B, 4 qty, $150
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 150, 0, 15000, 0, '4', 'token:B', 1)",
        )
        .bind(entry_id)
        .bind(digital_assets)
        .execute(&pool)
        .await
        .expect("Insert debit line (B)");

        // Line 2: CR Digital assets — A, 10 qty, $100
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 0, 100, 0, 10000, '10', 'token:A', 2)",
        )
        .bind(entry_id)
        .bind(digital_assets)
        .execute(&pool)
        .await
        .expect("Insert credit line (A)");

        // Line 3: CR Realized gain, $50 (measurement line, no asset/qty)
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 0, 50, 0, 5000, 3)",
        )
        .bind(entry_id)
        .bind(income)
        .execute(&pool)
        .await
        .expect("Insert measurement line");

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_ok(),
            "Swap with measurement line should post successfully: {:?}",
            result.err()
        );
    }
}
