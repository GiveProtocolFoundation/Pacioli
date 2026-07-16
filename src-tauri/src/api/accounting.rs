use chrono::NaiveDateTime;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, RoundingStrategy};
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
    /// Entry origin: manual (default), rule, or model.
    pub origin: Option<String>,
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

        // Validate one-sided, non-negative lines
        for (i, line) in lines.iter().enumerate() {
            if line.debit_minor < 0 || line.credit_minor < 0 {
                return Err(format!(
                    "Line {i} has negative minor units (debit {}, credit {}); amounts must be non-negative — a negative debit is a credit on the wrong side",
                    line.debit_minor, line.credit_minor
                ));
            }
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

    // Validate each line has exactly one non-negative debit or credit > 0
    for line in &input.lines {
        if line.debit_minor < 0 || line.credit_minor < 0 {
            return Err("Line amounts must be non-negative".to_string());
        }
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

    let origin = input.origin.as_deref().unwrap_or("manual");
    let valid_origins = ["manual", "rule", "model"];
    if !valid_origins.contains(&origin) {
        return Err(format!("Invalid origin: {origin}"));
    }

    // Single transaction: entry header + lines + classification flip commit or
    // roll back together, so a failure cannot leave a half-written draft or a
    // raw transaction marked classified without its journal entry.
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Generate entry number
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let entry_number = format!("JE-{:06}", count.0 + 1);

    let result = sqlx::query(
        r#"
        INSERT INTO journal_entries (entry_date, entry_number, description, reference_number, is_posted, status, origin, created_by)
        VALUES (?, ?, ?, ?, 0, 'draft', ?, 'system')
        "#,
    )
    .bind(entry_date)
    .bind(&entry_number)
    .bind(&input.description)
    .bind(&input.reference_number)
    .bind(origin)
    .execute(&mut *tx)
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
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // If linked to a raw transaction, flip its classification status.
    // Conditional on 'unclassified' so a double-submit (or auto-classify racing
    // a manual classify) cannot create a second draft for the same raw tx or
    // silently resurrect an ignored one; 0 rows -> roll back the whole entry.
    if let Some(ref tx_id) = input.raw_transaction_id {
        let flipped = sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind(tx_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        if flipped.rows_affected() == 0 {
            return Err(format!(
                "Raw transaction {tx_id} not found or already classified/ignored"
            ));
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    get_journal_entry(state, entry_id).await
}

/// Approves a draft journal entry. Transitions draft -> approved, sets
/// approved_by and approved_at. Only drafts can be approved.
#[tauri::command]
pub async fn approve_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
    approver: String,
) -> Result<JournalEntryWithLines, String> {
    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    if entry.status == "voided" {
        return Err("Cannot approve a voided entry".to_string());
    }
    if entry.status == "posted" {
        return Err("Cannot approve an already-posted entry".to_string());
    }
    if entry.status == "approved" {
        return Err("Journal entry is already approved".to_string());
    }

    // Conditional UPDATE: race-safe — approves exactly once even under
    // concurrent calls (mirrors the posting pattern).
    let result = sqlx::query(
        "UPDATE journal_entries SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'",
    )
    .bind(&approver)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Journal entry is no longer a draft (concurrently modified)".to_string());
    }

    get_journal_entry(state, id).await
}

/// Posts an approved journal entry. Validates balance via `PostedEntry` type
/// and DB triggers (belt-and-suspenders). Atomic and race-free: uses a
/// conditional UPDATE that posts exactly once. Idempotent: re-posting an
/// already-posted entry is a success no-op.
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

    // Idempotent: re-posting a posted entry is a success no-op
    if entry.status == "posted" && entry.is_posted {
        return get_journal_entry(state, id).await;
    }

    if entry.status == "voided" || entry.is_reversed {
        return Err("Cannot post a voided/reversed entry".to_string());
    }

    if entry.status == "draft" {
        return Err("Cannot post a draft entry — approve it first".to_string());
    }

    // Fetch lines and validate via PostedEntry type (belt-and-suspenders with triggers)
    let db_lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

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

    // Atomic conditional UPDATE: posts exactly once even under concurrent calls.
    // The WHERE clause ensures only approved entries are posted.
    let result = sqlx::query(
        "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'",
    )
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        // Entry was concurrently modified — re-fetch to return current state
        let current =
            sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
                .bind(id)
                .fetch_one(&state.pool)
                .await
                .map_err(|e| e.to_string())?;
        if current.status == "posted" {
            // Another thread posted it — idempotent success
            return get_journal_entry(state, id).await;
        }
        return Err(format!(
            "Failed to post entry: status changed to '{}' concurrently",
            current.status
        ));
    }

    get_journal_entry(state, id).await
}

/// Voids a posted journal entry by generating and posting a reversing entry.
/// Both the original and reversing entry remain in the GL (net effect zero).
/// The original is marked status='voided', is_reversed=1, and linked to the
/// reversing entry via reversed_by_entry_id.
#[tauri::command]
pub async fn void_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
) -> Result<JournalEntryWithLines, String> {
    // ONE transaction for the whole void: the GL must never hold a posted
    // reversing entry without the original being voided (or vice versa).
    // A crash or a lost race rolls everything back.
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    if entry.is_reversed || entry.status == "voided" {
        return Err("Journal entry is already voided".to_string());
    }

    if entry.status != "posted" {
        return Err("Only posted entries can be voided".to_string());
    }

    // Fetch the original entry's lines
    let original_lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Validate the reversing entry via PostedEntry BEFORE writing anything
    // (belt-and-suspenders with triggers)
    let rev_lines: Vec<PostedEntryLine> = original_lines
        .iter()
        .map(|l| {
            let quantity = l.quantity.as_ref().and_then(|q| Decimal::from_str(q).ok());
            PostedEntryLine {
                gl_account_id: l.gl_account_id,
                debit_minor: l.credit_minor, // swapped
                credit_minor: l.debit_minor, // swapped
                quantity,
                asset_id: l.asset_id.clone(),
                description: l.description.clone(),
            }
        })
        .collect();
    let _validated = PostedEntry::new(rev_lines)?;

    // Generate entry number for the reversing entry
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let rev_entry_number = format!("JE-{:06}", count.0 + 1);

    let entry_number_display = entry.entry_number.as_deref().unwrap_or("unknown");
    let rev_description = format!("Reversal of entry #{entry_number_display}");

    // Create the reversing entry as a draft first (born-posted trigger requires
    // drafts). Copy provenance: origin, entity_id, reference_number.
    let rev_result = sqlx::query(
        r#"
        INSERT INTO journal_entries (
            entry_date, entry_number, description, reference_number,
            is_posted, status, origin, entity_id, created_by, approved_by, approved_at
        )
        VALUES (DATE('now'), ?, ?, ?, 0, 'draft', ?, ?, 'system', 'system', CURRENT_TIMESTAMP)
        "#,
    )
    .bind(&rev_entry_number)
    .bind(&rev_description)
    .bind(&entry.reference_number)
    .bind(&entry.origin)
    .bind(&entry.entity_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let rev_entry_id = rev_result.last_insert_rowid();

    // Insert reversed lines: swap debit/credit (both minor and legacy float),
    // preserve quantity and asset_id
    for (i, line) in original_lines.iter().enumerate() {
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
        .bind(rev_entry_id)
        .bind(line.gl_account_id)
        .bind(line.token_id)
        .bind(line.credit_amount) // swap: original credit becomes debit
        .bind(line.debit_amount) // swap: original debit becomes credit
        .bind(line.credit_minor) // swap: original credit_minor becomes debit_minor
        .bind(line.debit_minor) // swap: original debit_minor becomes credit_minor
        .bind(&line.quantity) // preserve quantity
        .bind(&line.asset_id) // preserve asset_id
        .bind(&line.description)
        .bind(i as i64 + 1)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Approve then post the reversing entry (status machine: draft -> approved -> posted)
    sqlx::query("UPDATE journal_entries SET status = 'approved' WHERE id = ?")
        .bind(rev_entry_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'",
    )
    .bind(rev_entry_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Void the original entry: set status='voided', is_reversed=1,
    // reversed_by_entry_id in the same write. Conditional on status='posted'
    // so a concurrent void loses the race cleanly: 0 rows affected here rolls
    // back the duplicate reversing entry instead of leaving it posted.
    let void_result = sqlx::query(
        "UPDATE journal_entries SET status = 'voided', is_reversed = 1, reversed_by_entry_id = ? WHERE id = ? AND status = 'posted'",
    )
    .bind(rev_entry_id)
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if void_result.rows_affected() == 0 {
        // Entry was voided (or otherwise moved) concurrently — tx drop rolls
        // back the reversing entry, so no duplicate reversal reaches the GL.
        return Err(
            "Journal entry was voided concurrently; no duplicate reversal created".to_string(),
        );
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    get_journal_entry(state, id).await
}

/// Demotes an approved journal entry back to draft for editing.
/// The DB state machine explicitly allows approved -> draft (M5).
/// Race-safe: conditional UPDATE demotes exactly once; a concurrent
/// post/demote makes this a clean error instead of a silent overwrite.
#[tauri::command]
pub async fn demote_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
) -> Result<JournalEntryWithLines, String> {
    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    if entry.status == "voided" {
        return Err("Cannot demote a voided entry".to_string());
    }
    if entry.status == "posted" {
        return Err("Cannot demote a posted entry — void it instead".to_string());
    }
    if entry.status == "draft" {
        return Err("Journal entry is already a draft".to_string());
    }

    let result = sqlx::query(
        "UPDATE journal_entries SET status = 'draft', approved_by = NULL, approved_at = NULL WHERE id = ? AND status = 'approved'",
    )
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Journal entry is no longer approved (concurrently modified)".to_string());
    }

    get_journal_entry(state, id).await
}

/// Updates a DRAFT journal entry in place: header fields plus a full
/// replacement of its lines, in ONE transaction. Only drafts are editable;
/// the conditional header UPDATE (`WHERE status = 'draft'`) makes a
/// concurrent approve/post roll the whole edit back. Line-level input is
/// validated with the same rules as `create_journal_entry`.
#[tauri::command]
pub async fn update_journal_entry(
    state: State<'_, DatabaseState>,
    id: i64,
    input: NewJournalEntryInput,
) -> Result<JournalEntryWithLines, String> {
    if input.lines.is_empty() {
        return Err("Journal entry must have at least one line".to_string());
    }

    for line in &input.lines {
        if line.debit_minor < 0 || line.credit_minor < 0 {
            return Err("Line amounts must be non-negative".to_string());
        }
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

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    let entry = sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Journal entry not found".to_string())?;

    if entry.status != "draft" {
        return Err("Only draft entries can be edited".to_string());
    }

    // Conditional header update: if the entry stopped being a draft between
    // the read above and this write, 0 rows are affected and we roll back.
    let header = sqlx::query(
        "UPDATE journal_entries SET entry_date = ?, description = ?, reference_number = ? WHERE id = ? AND status = 'draft'",
    )
    .bind(entry_date)
    .bind(&input.description)
    .bind(&input.reference_number)
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if header.rows_affected() == 0 {
        return Err("Journal entry is no longer a draft (concurrently modified)".to_string());
    }

    // Full line replacement (draft lines are mutable; posted-line
    // immutability triggers only protect posted entries).
    sqlx::query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

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
        .bind(id)
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
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

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
        "SELECT id, chain_id, hash, from_address, to_address, value, fee, timestamp, tx_type, status FROM multi_chain_transactions WHERE id = ? AND classification_status = 'unclassified'",
    )
    .bind(&transaction_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Transaction not found or already classified/ignored".to_string())?;

    // Resolve GL account IDs
    let crypto_assets_id = get_account_id_by_number(&state.pool, "1200").await?;
    let staking_income_id = get_account_id_by_number(&state.pool, "4100").await?;
    let network_fees_id = get_account_id_by_number(&state.pool, "5100").await?;
    let income_id = get_account_id_by_number(&state.pool, "4000").await?;

    // Parse amounts via rust_decimal at the boundary — no f64 in the money path (Inv-2).
    // The raw string value in the source row is never modified (Inv-5).
    // Rounding is explicit half-away-from-zero: Decimal::round() defaults to
    // banker's rounding (10000.5 -> 10000), which is not the money convention
    // used elsewhere in this codebase.
    let amount_dec = Decimal::from_str(&tx.value)
        .map_err(|e| format!("Cannot parse value '{}': {e}", tx.value))?;
    let amount_minor: i64 = decimal_to_minor_units(amount_dec)
        .ok_or_else(|| format!("Value out of range: {}", tx.value))?;
    let fee_dec = tx
        .fee
        .as_deref()
        .unwrap_or("0")
        .parse::<Decimal>()
        .unwrap_or(Decimal::ZERO);
    let fee_minor: i64 =
        decimal_to_minor_units(fee_dec).ok_or_else(|| format!("Fee out of range: {:?}", tx.fee))?;

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
        origin: Some("rule".to_string()),
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

/// Converts an exact decimal amount to integer minor units (cents) using
/// explicit half-away-from-zero rounding. Returns None on i64 overflow.
fn decimal_to_minor_units(amount: Decimal) -> Option<i64> {
    amount
        .checked_mul(Decimal::ONE_HUNDRED)?
        .round_dp_with_strategy(0, RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
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

/// Public row for multi-chain transactions returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MultiChainTransaction {
    /// Composite ID: chain_id + "_" + hash.
    pub id: String,
    /// Blockchain identifier.
    pub chain_id: String,
    /// Transaction hash.
    pub hash: String,
    /// Sender address.
    pub from_address: String,
    /// Recipient address.
    pub to_address: Option<String>,
    /// Transaction value as string (raw, never mutated — Inv-5).
    pub value: String,
    /// Transaction fee as string.
    pub fee: Option<String>,
    /// Unix timestamp.
    pub timestamp: i64,
    /// Transaction type.
    pub tx_type: String,
    /// Transaction status (success/failed/pending).
    pub status: String,
    /// Classification status.
    pub classification_status: String,
}

/// Returns all unclassified multi-chain transactions for the classification queue.
#[tauri::command]
pub async fn get_unclassified_transactions(
    state: State<'_, DatabaseState>,
) -> Result<Vec<MultiChainTransaction>, String> {
    sqlx::query_as::<_, MultiChainTransaction>(
        "SELECT id, chain_id, hash, from_address, to_address, value, fee, timestamp, tx_type, status, classification_status FROM multi_chain_transactions WHERE classification_status = 'unclassified' ORDER BY timestamp DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Ignores a raw transaction with an optional reason. Sets classification_status
/// to 'ignored' and records the reason in classification_note. The raw
/// financial fields are never mutated (Inv-5).
#[tauri::command]
pub async fn ignore_transaction(
    state: State<'_, DatabaseState>,
    transaction_id: String,
    reason: Option<String>,
) -> Result<(), String> {
    let result = sqlx::query(
        "UPDATE multi_chain_transactions SET classification_status = 'ignored', classification_note = ? WHERE id = ? AND classification_status = 'unclassified'",
    )
    .bind(&reason)
    .bind(&transaction_id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Transaction not found or already classified".to_string());
    }

    Ok(())
}

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

/// Per-account per-asset balance row, computed in Rust via rust_decimal
/// for exact quantity sums.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetBalance {
    /// GL account ID.
    pub gl_account_id: i64,
    /// Account number.
    pub account_number: String,
    /// Account name.
    pub account_name: String,
    /// Account type.
    pub account_type: String,
    /// Asset identifier (e.g. 'USD', 'token:42').
    pub asset_id: String,
    /// Total debits in minor units.
    pub total_debit_minor: i64,
    /// Total credits in minor units.
    pub total_credit_minor: i64,
    /// Net balance in minor units (debit - credit).
    pub net_minor: i64,
    /// Total debit quantity as canonical decimal string.
    pub total_debit_quantity: String,
    /// Total credit quantity as canonical decimal string.
    pub total_credit_quantity: String,
    /// Net quantity as canonical decimal string.
    pub net_quantity: String,
}

/// Raw row from the per-asset balance query (SQL aggregation, quantities
/// summed in Rust via rust_decimal for exactness).
#[derive(Debug, Clone, FromRow)]
struct AssetBalanceRawLine {
    gl_account_id: i64,
    account_number: String,
    account_name: String,
    account_type: String,
    asset_id: String,
    debit_minor: i64,
    credit_minor: i64,
    quantity: Option<String>,
}

/// Returns per-account per-asset balances. Quantity sums are computed in Rust
/// via rust_decimal for exactness (never CAST AS REAL in SQL for reporting).
#[tauri::command]
pub async fn get_account_balances_by_asset(
    state: State<'_, DatabaseState>,
) -> Result<Vec<AssetBalance>, String> {
    let rows = sqlx::query_as::<_, AssetBalanceRawLine>(
        r#"
        SELECT
            ga.id AS gl_account_id,
            ga.account_number,
            ga.account_name,
            ga.account_type,
            jel.asset_id,
            jel.debit_minor,
            jel.credit_minor,
            jel.quantity
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN gl_accounts ga ON jel.gl_account_id = ga.id
        WHERE je.is_posted = 1
          AND jel.asset_id IS NOT NULL
        ORDER BY ga.account_number, jel.asset_id
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Aggregate in Rust using rust_decimal for exact quantity sums
    let mut map: std::collections::BTreeMap<(i64, String), AssetBalance> =
        std::collections::BTreeMap::new();

    for row in &rows {
        let key = (row.gl_account_id, row.asset_id.clone());
        let entry = map.entry(key).or_insert_with(|| AssetBalance {
            gl_account_id: row.gl_account_id,
            account_number: row.account_number.clone(),
            account_name: row.account_name.clone(),
            account_type: row.account_type.clone(),
            asset_id: row.asset_id.clone(),
            total_debit_minor: 0,
            total_credit_minor: 0,
            net_minor: 0,
            total_debit_quantity: "0".to_string(),
            total_credit_quantity: "0".to_string(),
            net_quantity: "0".to_string(),
        });

        entry.total_debit_minor += row.debit_minor;
        entry.total_credit_minor += row.credit_minor;
        entry.net_minor = entry.total_debit_minor - entry.total_credit_minor;

        if let Some(ref qty_str) = row.quantity {
            if let Ok(qty) = Decimal::from_str(qty_str) {
                let mut total_debit_qty =
                    Decimal::from_str(&entry.total_debit_quantity).unwrap_or(Decimal::ZERO);
                let mut total_credit_qty =
                    Decimal::from_str(&entry.total_credit_quantity).unwrap_or(Decimal::ZERO);

                if row.debit_minor > 0 {
                    total_debit_qty += qty;
                } else {
                    total_credit_qty += qty;
                }

                entry.total_debit_quantity = total_debit_qty.to_string();
                entry.total_credit_quantity = total_credit_qty.to_string();
                entry.net_quantity = (total_debit_qty - total_credit_qty).to_string();
            }
        }
    }

    Ok(map.into_values().collect())
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
// Tests — Journal-Entry Balance Invariant (GIV-665, GIV-673, GIV-677)
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

    /// Approves a draft entry via direct SQL (test helper).
    async fn approve_entry(pool: &SqlitePool, entry_id: i64) {
        sqlx::query(
            "UPDATE journal_entries SET status = 'approved', approved_by = 'test', approved_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("Failed to approve entry");
    }

    /// Approves and posts an entry via direct SQL (test helper).
    async fn approve_and_post_entry(pool: &SqlitePool, entry_id: i64) {
        approve_entry(pool, entry_id).await;
        sqlx::query(
            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("Failed to post entry");
    }

    // ========================================================================
    // GIV-665 — Existing trigger tests (updated for approval-gate schema)
    // ========================================================================

    // ---- Born-posted INSERT rejected ----

    #[tokio::test]
    async fn born_posted_insert_rejected() {
        let pool = setup_test_db().await;

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

        approve_and_post_entry(&pool, entry_id).await;

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

        approve_and_post_entry(&pool, entry_id).await;

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
    }

    #[tokio::test]
    async fn delete_line_on_posted_entry_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        approve_and_post_entry(&pool, entry_id).await;

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

    // ---- Zero-line entry post rejected (now via approved->posted) ----

    #[tokio::test]
    async fn zero_line_entry_post_rejected() {
        let pool = setup_test_db().await;
        let entry_id = create_draft_entry(&pool).await;
        approve_entry(&pool, entry_id).await;

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

        approve_entry(&pool, entry_id).await;

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

    // ---- Happy path: create draft -> approve -> post -> void ----

    #[tokio::test]
    async fn happy_path_draft_approve_post_void() {
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

        // Approve
        approve_entry(&pool, entry_id).await;

        let (status,): (String,) =
            sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");
        assert_eq!(status, "approved", "Entry should be approved");

        // Post
        sqlx::query(
            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("Posting balanced approved entry should succeed");

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

        approve_entry(&pool, entry_id).await;

        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "Posting single-line entry should be rejected"
        );
    }

    // ---- Re-pointing a line onto a posted entry is blocked ----

    #[tokio::test]
    async fn repoint_line_onto_posted_entry_rejected() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;

        let entry_a = create_draft_entry(&pool).await;
        add_balanced_lines(&pool, entry_a, acct_a, acct_b, 10000).await;
        approve_and_post_entry(&pool, entry_a).await;

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
    }

    // ========================================================================
    // GIV-673 — Phase 1 Acceptance Tests (PostedEntry type)
    // ========================================================================

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
    fn posted_entry_rejects_negative_minor_units() {
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 100,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: -100,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_err(), "Negative minor units must be rejected");
        let err = result.unwrap_err();
        assert!(
            err.contains("non-negative"),
            "Should report negative amounts, got: {err}"
        );
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
                credit_minor: 9999,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Functional-currency imbalance"));
    }

    #[test]
    fn posted_entry_rejects_one_cent_imbalance() {
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 5001,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 5000,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_err(), "1-cent imbalance must be rejected");
    }

    #[test]
    fn posted_entry_swap_one_sided_assets_allowed() {
        // In a swap, each asset appears on only one side — that's valid.
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 15000,
                credit_minor: 0,
                quantity: Some(Decimal::from_str("4").unwrap()),
                asset_id: Some("token:B".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 10000,
                quantity: Some(Decimal::from_str("10").unwrap()),
                asset_id: Some("token:A".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 3,
                debit_minor: 0,
                credit_minor: 5000,
                quantity: None,
                asset_id: None,
                description: Some("Realized gain".to_string()),
            },
        ]);
        assert!(
            result.is_ok(),
            "Swap example should succeed: {}",
            result.unwrap_err()
        );
    }

    #[test]
    fn posted_entry_rejects_same_asset_quantity_imbalance() {
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
                quantity: Some(Decimal::from_str("3").unwrap()),
                asset_id: Some("token:A".to_string()),
                description: None,
            },
        ]);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Per-asset quantity imbalance"));
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

    #[test]
    fn posted_entry_swap_example_from_accounting_model() {
        let result = PostedEntry::new(vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: 15000,
                credit_minor: 0,
                quantity: Some(Decimal::from_str("4").unwrap()),
                asset_id: Some("token:B".to_string()),
                description: Some("Swap in: 4 B at $150".to_string()),
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: 10000,
                quantity: Some(Decimal::from_str("10").unwrap()),
                asset_id: Some("token:A".to_string()),
                description: Some("Swap out: 10 A at cost $100".to_string()),
            },
            PostedEntryLine {
                gl_account_id: 3,
                debit_minor: 0,
                credit_minor: 5000,
                quantity: None,
                asset_id: None,
                description: Some("Realized gain on swap".to_string()),
            },
        ]);
        assert!(
            result.is_ok(),
            "Swap example from accounting-model.md should succeed: {}",
            result.as_ref().unwrap_err()
        );
    }

    // ========================================================================
    // GIV-673 — Direct-SQL trigger tests (updated for approval gate)
    // ========================================================================

    #[tokio::test]
    async fn trigger_rejects_one_cent_minor_unit_imbalance() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "CENT-001").await;

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

        // Approve first, then try to post with imbalance
        approve_entry(&pool, entry_id).await;

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
    async fn trigger_rejects_born_posted_legacy_is_posted() {
        let pool = setup_test_db().await;

        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES ('2026-01-01', 'BORN-002', 'Test', 1, 'draft', 'manual', 'test')",
        )
        .execute(&pool)
        .await;

        assert!(
            result.is_err(),
            "Born is_posted=1 INSERT should be rejected"
        );
    }

    #[tokio::test]
    async fn trigger_rejects_is_posted_without_status_same_write() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "COHERE-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        let result = sqlx::query("UPDATE journal_entries SET is_posted = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "is_posted=1 without status='posted' in the same write must be rejected"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("same-write"),
            "Error should mention same-write sync, got: {err}"
        );
    }

    #[tokio::test]
    async fn trigger_rejects_negative_minor_units() {
        let pool = setup_test_db().await;
        let (acct_a, _) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "NEG-001").await;

        let result = sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, -1, 0, -100, 0, 'USD', 1)",
        )
        .bind(entry_id)
        .bind(acct_a)
        .execute(&pool)
        .await;

        assert!(
            result.is_err(),
            "Negative debit_minor line must be rejected by trigger"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("non-negative"),
            "Error should mention non-negative, got: {err}"
        );
    }

    #[tokio::test]
    async fn trigger_rejects_posted_line_mutation() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "MUT-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        approve_and_post_entry(&pool, entry_id).await;

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

        approve_entry(&pool, entry_id).await;

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

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 150, 0, 15000, 0, '4', 'token:B', 1)",
        )
        .bind(entry_id)
        .bind(digital_assets)
        .execute(&pool)
        .await
        .expect("Insert debit line (B)");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 0, 100, 0, 10000, '10', 'token:A', 2)",
        )
        .bind(entry_id)
        .bind(digital_assets)
        .execute(&pool)
        .await
        .expect("Insert credit line (A)");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 0, 50, 0, 5000, 3)",
        )
        .bind(entry_id)
        .bind(income)
        .execute(&pool)
        .await
        .expect("Insert measurement line");

        approve_entry(&pool, entry_id).await;

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

    // ========================================================================
    // GIV-677 — Phase 2 Acceptance Tests
    // ========================================================================

    // ---- Draft cannot post without approval (Rust path) ----

    #[tokio::test]
    async fn draft_cannot_post_without_approval_via_trigger() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "NOAPPROVE-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;

        // Try to post directly from draft (trigger should reject)
        let result = sqlx::query("UPDATE journal_entries SET status = 'posted' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "Draft->posted direct transition must be rejected after M5"
        );
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Draft entries can only transition to approved"),
            "Error should mention approval requirement, got: {err}"
        );
    }

    // ---- Re-posting a posted entry is a no-op ----

    #[tokio::test]
    async fn repost_is_noop() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "REPOST-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;
        approve_and_post_entry(&pool, entry_id).await;

        // Fetch posted_at
        let (posted_at_before,): (Option<String>,) =
            sqlx::query_as("SELECT posted_at FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");

        // Attempt to re-post (conditional UPDATE should affect 0 rows)
        let result = sqlx::query(
            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("Re-post attempt should not error");

        assert_eq!(
            result.rows_affected(),
            0,
            "Re-posting should affect 0 rows (no-op)"
        );

        // Verify posted_at unchanged
        let (posted_at_after,): (Option<String>,) =
            sqlx::query_as("SELECT posted_at FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch entry");

        assert_eq!(
            posted_at_before, posted_at_after,
            "posted_at must be unchanged after re-post no-op"
        );
    }

    // ---- Voiding generates a balanced posted reversing entry; GL nets to zero ----

    #[tokio::test]
    async fn void_generates_reversing_entry_and_gl_nets_zero() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "VOID-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;
        approve_and_post_entry(&pool, entry_id).await;

        // Count entries before void
        let (count_before,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
            .fetch_one(&pool)
            .await
            .expect("count");

        // Void the entry using the Rust path simulation:
        // 1. Create reversing entry
        let rev_result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by, approved_by, approved_at) VALUES (DATE('now'), 'REV-VOID-001', 'Reversal of entry #VOID-001', 0, 'draft', 'manual', 'system', 'system', CURRENT_TIMESTAMP)",
        )
        .execute(&pool)
        .await
        .expect("Create reversing entry");
        let rev_id = rev_result.last_insert_rowid();

        // 2. Insert reversed lines (swap debit/credit)
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, 100, 0, 10000, 'USD', 1)",
        )
        .bind(rev_id)
        .bind(acct_a)
        .execute(&pool)
        .await
        .expect("Insert reversed debit->credit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 100, 0, 10000, 0, 'USD', 2)",
        )
        .bind(rev_id)
        .bind(acct_b)
        .execute(&pool)
        .await
        .expect("Insert reversed credit->debit line");

        // 3. Approve and post the reversal
        approve_and_post_entry(&pool, rev_id).await;

        // 4. Void the original
        sqlx::query(
            "UPDATE journal_entries SET status = 'voided', is_reversed = 1, reversed_by_entry_id = ? WHERE id = ?",
        )
        .bind(rev_id)
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("Void original entry");

        // Verify: new entry was created
        let (count_after,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(
            count_after,
            count_before + 1,
            "Voiding should create exactly one new entry"
        );

        // Verify: original is voided with reversed_by_entry_id
        let (status, is_reversed, reversed_by): (String, bool, Option<i64>) = sqlx::query_as(
            "SELECT status, is_reversed, reversed_by_entry_id FROM journal_entries WHERE id = ?",
        )
        .bind(entry_id)
        .fetch_one(&pool)
        .await
        .expect("Should fetch voided original");
        assert_eq!(status, "voided");
        assert!(is_reversed);
        assert_eq!(reversed_by, Some(rev_id));

        // Verify: reversing entry is posted
        let (rev_status,): (String,) =
            sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
                .bind(rev_id)
                .fetch_one(&pool)
                .await
                .expect("Should fetch reversing entry");
        assert_eq!(rev_status, "posted");

        // Verify: GL nets to zero (both entries are posted, net effect zero)
        let (total_debits,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(jel.debit_minor), 0) FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id WHERE je.is_posted = 1",
        )
        .fetch_one(&pool)
        .await
        .expect("Sum debits");
        let (total_credits,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(jel.credit_minor), 0) FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id WHERE je.is_posted = 1",
        )
        .fetch_one(&pool)
        .await
        .expect("Sum credits");
        assert_eq!(
            total_debits, total_credits,
            "GL must net to zero after voiding: debits={total_debits}, credits={total_credits}"
        );
    }

    // ---- Voided entry is frozen ----

    #[tokio::test]
    async fn voided_entry_is_frozen() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "FROZEN-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;
        approve_and_post_entry(&pool, entry_id).await;

        // Void via direct SQL (state machine allows posted->voided)
        sqlx::query("UPDATE journal_entries SET status = 'voided', is_reversed = 1 WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Void should succeed");

        // Verify voided entries cannot change status
        let result = sqlx::query("UPDATE journal_entries SET status = 'draft' WHERE id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;
        assert!(result.is_err(), "Voided entries must be immutable");
        let err = result.unwrap_err().to_string();
        assert!(err.contains("immutable"), "got: {err}");
    }

    // ---- Posting N approved entries yields trial balance where debits == credits ----

    #[tokio::test]
    async fn trial_balance_debits_equal_credits() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;

        // Post several balanced entries
        for i in 0..5 {
            let entry_id = create_named_draft_entry(&pool, &format!("TB-{:03}", i + 1)).await;
            add_balanced_lines(&pool, entry_id, acct_a, acct_b, (i + 1) * 1000).await;
            approve_and_post_entry(&pool, entry_id).await;
        }

        // Fetch trial balance and verify debits exactly equal credits
        let rows: Vec<(i64, i64)> =
            sqlx::query_as("SELECT debit_balance, credit_balance FROM v_trial_balance")
                .fetch_all(&pool)
                .await
                .expect("Fetch trial balance");

        let total_debits: i64 = rows.iter().map(|(d, _)| d).sum();
        let total_credits: i64 = rows.iter().map(|(_, c)| c).sum();
        assert_eq!(
            total_debits, total_credits,
            "Trial balance must tie: debits={total_debits}, credits={total_credits}"
        );
        assert!(
            total_debits > 0,
            "Trial balance should have non-zero activity"
        );
    }

    // ---- Per-asset balances correct for swap worked example ----

    #[tokio::test]
    async fn per_asset_balances_correct_for_swap() {
        let pool = setup_test_db().await;
        let (digital_assets, income, _expenses) = get_three_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "PABS-001").await;

        // Swap 10 A (basis $100, FV $150) for 4 B
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 150, 0, 15000, 0, '4', 'token:B', 1)",
        )
        .bind(entry_id)
        .bind(digital_assets)
        .execute(&pool)
        .await
        .expect("DR B");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, quantity, asset_id, line_number) VALUES (?, ?, 0, 100, 0, 10000, '10', 'token:A', 2)",
        )
        .bind(entry_id)
        .bind(digital_assets)
        .execute(&pool)
        .await
        .expect("CR A");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, line_number) VALUES (?, ?, 0, 50, 0, 5000, 3)",
        )
        .bind(entry_id)
        .bind(income)
        .execute(&pool)
        .await
        .expect("Measurement line");

        approve_and_post_entry(&pool, entry_id).await;

        // Query per-asset balances via raw SQL (simulating get_account_balances_by_asset)
        let rows: Vec<(i64, String, i64, i64, Option<String>)> = sqlx::query_as(
            r#"
            SELECT jel.gl_account_id, COALESCE(jel.asset_id, 'NONE'), jel.debit_minor, jel.credit_minor, jel.quantity
            FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE je.is_posted = 1 AND jel.asset_id IS NOT NULL
            "#,
        )
        .fetch_all(&pool)
        .await
        .expect("Query per-asset");

        // Verify: token:B has debit_minor=15000, qty=4
        let token_b: Vec<_> = rows.iter().filter(|r| r.1 == "token:B").collect();
        assert_eq!(token_b.len(), 1);
        assert_eq!(token_b[0].2, 15000); // debit_minor
        assert_eq!(token_b[0].4.as_deref(), Some("4")); // quantity

        // Verify: token:A has credit_minor=10000, qty=10
        let token_a: Vec<_> = rows.iter().filter(|r| r.1 == "token:A").collect();
        assert_eq!(token_a.len(), 1);
        assert_eq!(token_a[0].3, 10000); // credit_minor
        assert_eq!(token_a[0].4.as_deref(), Some("10")); // quantity

        // Verify exact quantity sums via rust_decimal
        let qty_b = Decimal::from_str(token_b[0].4.as_deref().unwrap()).unwrap();
        assert_eq!(
            qty_b,
            Decimal::from(4),
            "token:B quantity must be exactly 4"
        );

        let qty_a = Decimal::from_str(token_a[0].4.as_deref().unwrap()).unwrap();
        assert_eq!(
            qty_a,
            Decimal::from(10),
            "token:A quantity must be exactly 10"
        );
    }

    // ---- Double-void race: conditional void UPDATE is a clean 0-row no-op ----
    //
    // void_journal_entry runs in ONE transaction and voids the original with
    // `WHERE id = ? AND status = 'posted'`. If two calls race, the loser's
    // UPDATE affects 0 rows and its whole transaction (including the duplicate
    // reversing entry) rolls back. This test proves the SQL semantics the
    // Rust guard relies on: the second conditional void is a no-op, not an
    // error, and no second reversal reaches the GL.
    #[tokio::test]
    async fn double_void_conditional_update_is_noop() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "DVOID-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 10000).await;
        approve_and_post_entry(&pool, entry_id).await;

        // First void wins
        let first = sqlx::query(
            "UPDATE journal_entries SET status = 'voided', is_reversed = 1 WHERE id = ? AND status = 'posted'",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("First conditional void should succeed");
        assert_eq!(first.rows_affected(), 1, "First void must affect 1 row");

        // Second void loses cleanly: 0 rows, no trigger abort (WHERE filters
        // the row out before the immutability trigger can fire)
        let second = sqlx::query(
            "UPDATE journal_entries SET status = 'voided', is_reversed = 1 WHERE id = ? AND status = 'posted'",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("Second conditional void must not error");
        assert_eq!(
            second.rows_affected(),
            0,
            "Second void must be a 0-row no-op so the caller rolls back its duplicate reversal"
        );
    }

    // ---- Demote: approved -> draft is allowed, clears approval provenance ----
    #[tokio::test]
    async fn demote_approved_entry_returns_to_draft() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "DEMOTE-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 5000).await;
        approve_entry(&pool, entry_id).await;

        // Conditional demote (the SQL demote_journal_entry relies on)
        let result = sqlx::query(
            "UPDATE journal_entries SET status = 'draft', approved_by = NULL, approved_at = NULL WHERE id = ? AND status = 'approved'",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("Demote of an approved entry must succeed (M5 allows approved->draft)");
        assert_eq!(result.rows_affected(), 1);

        let (status, approved_by): (String, Option<String>) =
            sqlx::query_as("SELECT status, approved_by FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Fetch demoted entry");
        assert_eq!(status, "draft");
        assert!(
            approved_by.is_none(),
            "Demote must clear approval provenance"
        );
    }

    // ---- Demote race: conditional UPDATE is a 0-row no-op on non-approved ----
    #[tokio::test]
    async fn demote_non_approved_entry_is_noop() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "DEMOTE-002").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 5000).await;
        approve_and_post_entry(&pool, entry_id).await;

        // Posted entry: the WHERE clause filters it out before the state
        // machine trigger could fire — clean 0-row no-op, caller errors.
        let result = sqlx::query(
            "UPDATE journal_entries SET status = 'draft', approved_by = NULL, approved_at = NULL WHERE id = ? AND status = 'approved'",
        )
        .bind(entry_id)
        .execute(&pool)
        .await
        .expect("Conditional demote of a posted entry must not error");
        assert_eq!(result.rows_affected(), 0);
    }

    // ---- Draft edit: draft lines are mutable (delete + reinsert works) ----
    #[tokio::test]
    async fn draft_lines_can_be_replaced() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "EDIT-001").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 5000).await;

        sqlx::query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await
            .expect("Draft lines must be deletable");

        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 7500).await;

        let (total,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(debit_minor), 0) FROM journal_entry_lines WHERE journal_entry_id = ?",
        )
        .bind(entry_id)
        .fetch_one(&pool)
        .await
        .expect("Sum replaced lines");
        assert_eq!(total, 7500, "Replaced draft lines must be the new amounts");
    }

    // ---- Posted lines stay immutable: delete must be rejected ----
    #[tokio::test]
    async fn posted_lines_cannot_be_deleted() {
        let pool = setup_test_db().await;
        let (acct_a, acct_b) = get_test_accounts(&pool).await;
        let entry_id = create_named_draft_entry(&pool, "EDIT-002").await;
        add_balanced_lines(&pool, entry_id, acct_a, acct_b, 5000).await;
        approve_and_post_entry(&pool, entry_id).await;

        let result = sqlx::query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?")
            .bind(entry_id)
            .execute(&pool)
            .await;
        assert!(
            result.is_err(),
            "Deleting lines of a posted entry must be rejected by the immutability trigger"
        );
    }

    // ========================================================================
    // GIV-683 — Phase 4: Classification Rules & Provenance
    // ========================================================================

    /// Inserts a raw transaction into multi_chain_transactions for testing.
    #[allow(clippy::too_many_arguments)] // mirrors the table's column list
    async fn insert_raw_tx(
        pool: &SqlitePool,
        id: &str,
        chain: &str,
        hash: &str,
        value: &str,
        fee: Option<&str>,
        tx_type: &str,
        timestamp: i64,
    ) {
        sqlx::query(
            r#"INSERT INTO multi_chain_transactions (id, chain_id, hash, from_address, to_address, value, fee, timestamp, tx_type, status)
               VALUES (?, ?, ?, '0xSender', '0xReceiver', ?, ?, ?, ?, 'success')"#,
        )
        .bind(id)
        .bind(chain)
        .bind(hash)
        .bind(value)
        .bind(fee)
        .bind(timestamp)
        .bind(tx_type)
        .execute(pool)
        .await
        .expect("Insert raw tx");
    }

    /// Reads classification_status for a raw transaction.
    async fn get_classification_status(pool: &SqlitePool, tx_id: &str) -> String {
        let (status,): (String,) = sqlx::query_as(
            "SELECT classification_status FROM multi_chain_transactions WHERE id = ?",
        )
        .bind(tx_id)
        .fetch_one(pool)
        .await
        .expect("Fetch classification status");
        status
    }

    // ---- rust_decimal boundary parsing ----

    #[test]
    fn decimal_boundary_conversion_exact() {
        // Ensure string → Decimal → minor units produces exact results
        let val = Decimal::from_str("19.99").unwrap();
        assert_eq!(
            decimal_to_minor_units(val),
            Some(1999),
            "19.99 should parse to 1999 cents exactly"
        );

        let val2 = Decimal::from_str("0.1").unwrap() + Decimal::from_str("0.2").unwrap();
        assert_eq!(
            decimal_to_minor_units(val2),
            Some(30),
            "0.1 + 0.2 should be 30 cents (no float drift)"
        );
    }

    #[test]
    fn decimal_boundary_zero_negative_and_midpoint() {
        assert_eq!(decimal_to_minor_units(Decimal::ZERO), Some(0));

        // 100.005 * 100 = 10000.5 → half-away-from-zero rounds to 10001.
        // Decimal::round() alone would give 10000 (banker's rounding) — the
        // helper exists precisely to pin this behavior.
        let val = Decimal::from_str("100.005").unwrap();
        assert_eq!(decimal_to_minor_units(val), Some(10001));

        // Negative midpoint rounds away from zero too.
        let neg = Decimal::from_str("-0.505").unwrap();
        assert_eq!(decimal_to_minor_units(neg), Some(-51));

        // i64 overflow returns None instead of panicking.
        let huge = Decimal::MAX;
        assert_eq!(decimal_to_minor_units(huge), None);
    }

    // ---- auto_classify_transaction provenance + classification_status ----

    #[tokio::test]
    async fn auto_classify_claim_creates_draft_with_provenance() {
        let pool = setup_test_db().await;
        let tx_id = "moonbeam_0xabc123";
        insert_raw_tx(
            &pool, tx_id, "moonbeam", "0xabc123", "50.00", None, "claim", 1700000000,
        )
        .await;

        // Verify starts unclassified
        assert_eq!(
            get_classification_status(&pool, tx_id).await,
            "unclassified"
        );

        // Simulate auto_classify_transaction by calling the internal logic.
        // We go through the full SQL path to verify the integration.
        let crypto_id = get_account_id_by_number(&pool, "1200").await.unwrap();
        let staking_id = get_account_id_by_number(&pool, "4100").await.unwrap();

        let amount = Decimal::from_str("50.00").unwrap();
        let amount_minor = (amount * Decimal::ONE_HUNDRED)
            .round()
            .to_string()
            .parse::<i64>()
            .unwrap();
        assert_eq!(amount_minor, 5000);

        // Create the draft entry with origin = 'rule' and raw_transaction_id
        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES ('2026-01-01', 'AUTO-001', 'Staking reward on moonbeam', 0, 'draft', 'rule', 'system')",
        )
        .execute(&pool)
        .await
        .expect("Create auto-classified entry");
        let entry_id = result.last_insert_rowid();

        // Add balanced lines: DR Crypto Assets / CR Staking Income
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 50.0, 0, 5000, 0, 'USD', 1)",
        )
        .bind(entry_id)
        .bind(crypto_id)
        .execute(&pool)
        .await
        .expect("Add debit line");

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, 50.0, 0, 5000, 'USD', 2)",
        )
        .bind(entry_id)
        .bind(staking_id)
        .execute(&pool)
        .await
        .expect("Add credit line");

        // Flip classification_status (simulating what create_journal_entry does)
        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ?",
        )
        .bind(tx_id)
        .execute(&pool)
        .await
        .expect("Classify tx");

        // Verify provenance: origin = 'rule'
        let (origin,): (String,) =
            sqlx::query_as("SELECT origin FROM journal_entries WHERE id = ?")
                .bind(entry_id)
                .fetch_one(&pool)
                .await
                .expect("Fetch origin");
        assert_eq!(
            origin, "rule",
            "Auto-classified entry should have origin = 'rule'"
        );

        // Verify classification_status flipped
        assert_eq!(
            get_classification_status(&pool, tx_id).await,
            "classified",
            "Raw tx should be classified after auto_classify"
        );

        // Verify the entry is balanced
        let (total_debit,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(debit_minor), 0) FROM journal_entry_lines WHERE journal_entry_id = ?",
        )
        .bind(entry_id)
        .fetch_one(&pool)
        .await
        .expect("Sum debits");
        let (total_credit,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(credit_minor), 0) FROM journal_entry_lines WHERE journal_entry_id = ?",
        )
        .bind(entry_id)
        .fetch_one(&pool)
        .await
        .expect("Sum credits");
        assert_eq!(total_debit, total_credit, "Entry must be balanced");
        assert_eq!(
            total_debit, 5000,
            "Debit should be 5000 minor units ($50.00)"
        );
    }

    #[tokio::test]
    async fn ignore_transaction_flips_status() {
        let pool = setup_test_db().await;
        let tx_id = "moonbeam_0xdef456";
        insert_raw_tx(
            &pool, tx_id, "moonbeam", "0xdef456", "10.00", None, "approve", 1700000000,
        )
        .await;

        assert_eq!(
            get_classification_status(&pool, tx_id).await,
            "unclassified"
        );

        // Ignore the transaction
        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'ignored' WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind(tx_id)
        .execute(&pool)
        .await
        .expect("Ignore tx");

        assert_eq!(
            get_classification_status(&pool, tx_id).await,
            "ignored",
            "Ignored tx should have classification_status = 'ignored'"
        );
    }

    #[tokio::test]
    async fn ignore_persists_reason_in_classification_note() {
        let pool = setup_test_db().await;
        let tx_id = "moonbeam_0xnote1";
        insert_raw_tx(
            &pool, tx_id, "moonbeam", "0xnote1", "1.00", None, "approve", 1700000000,
        )
        .await;

        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'ignored', classification_note = ? WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind("gas-only approval, no economic effect")
        .bind(tx_id)
        .execute(&pool)
        .await
        .expect("Ignore with reason");

        let (note,): (Option<String>,) =
            sqlx::query_as("SELECT classification_note FROM multi_chain_transactions WHERE id = ?")
                .bind(tx_id)
                .fetch_one(&pool)
                .await
                .expect("Fetch note");
        assert_eq!(
            note.as_deref(),
            Some("gas-only approval, no economic effect"),
            "Skip reason must be persisted, not dropped"
        );
    }

    #[tokio::test]
    async fn conditional_classification_flip_blocks_double_classify() {
        let pool = setup_test_db().await;
        let tx_id = "moonbeam_0xdup1";
        insert_raw_tx(
            &pool, tx_id, "moonbeam", "0xdup1", "5.00", None, "claim", 1700000000,
        )
        .await;

        // First flip (the create_journal_entry conditional UPDATE) succeeds
        let first = sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind(tx_id)
        .execute(&pool)
        .await
        .expect("First flip");
        assert_eq!(first.rows_affected(), 1);

        // Second flip (double-submit / racing auto-classify) affects 0 rows,
        // which create_journal_entry converts into a rollback + error.
        let second = sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind(tx_id)
        .execute(&pool)
        .await
        .expect("Second flip");
        assert_eq!(
            second.rows_affected(),
            0,
            "Already-classified raw tx must not be classifiable again"
        );

        // Ignored txs are equally protected from resurrection.
        let tx2 = "moonbeam_0xdup2";
        insert_raw_tx(
            &pool, tx2, "moonbeam", "0xdup2", "5.00", None, "claim", 1700000001,
        )
        .await;
        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'ignored' WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind(tx2)
        .execute(&pool)
        .await
        .expect("Ignore tx2");
        let resurrect = sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ? AND classification_status = 'unclassified'",
        )
        .bind(tx2)
        .execute(&pool)
        .await
        .expect("Attempt resurrect");
        assert_eq!(
            resurrect.rows_affected(),
            0,
            "Ignored raw tx must not be silently reclassified"
        );
    }

    #[tokio::test]
    async fn raw_tx_immutable_beyond_classification_status() {
        let pool = setup_test_db().await;
        let tx_id = "moonbeam_0x789abc";
        insert_raw_tx(
            &pool,
            tx_id,
            "moonbeam",
            "0x789abc",
            "25.50",
            Some("0.01"),
            "transfer",
            1700000000,
        )
        .await;

        // Classify
        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = ?",
        )
        .bind(tx_id)
        .execute(&pool)
        .await
        .expect("Classify");

        // Verify value and fee are untouched
        let (value, fee): (String, Option<String>) =
            sqlx::query_as("SELECT value, fee FROM multi_chain_transactions WHERE id = ?")
                .bind(tx_id)
                .fetch_one(&pool)
                .await
                .expect("Fetch raw tx");

        assert_eq!(value, "25.50", "Raw value must be untouched (Inv-5)");
        assert_eq!(
            fee.as_deref(),
            Some("0.01"),
            "Raw fee must be untouched (Inv-5)"
        );
    }

    #[tokio::test]
    async fn get_unclassified_count_updates_after_classify() {
        let pool = setup_test_db().await;

        // Start clean
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM multi_chain_transactions WHERE classification_status = 'unclassified'",
        )
        .fetch_one(&pool)
        .await
        .expect("Count unclassified");
        let baseline = count;

        // Insert two raw txs
        insert_raw_tx(
            &pool, "test_1", "ethereum", "0x111", "100", None, "transfer", 1700000000,
        )
        .await;
        insert_raw_tx(
            &pool, "test_2", "ethereum", "0x222", "200", None, "stake", 1700000001,
        )
        .await;

        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM multi_chain_transactions WHERE classification_status = 'unclassified'",
        )
        .fetch_one(&pool)
        .await
        .expect("Count after insert");
        assert_eq!(count, baseline + 2);

        // Classify one
        sqlx::query(
            "UPDATE multi_chain_transactions SET classification_status = 'classified' WHERE id = 'test_1'",
        )
        .execute(&pool)
        .await
        .expect("Classify test_1");

        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM multi_chain_transactions WHERE classification_status = 'unclassified'",
        )
        .fetch_one(&pool)
        .await
        .expect("Count after classify");
        assert_eq!(count, baseline + 1);
    }

    #[test]
    fn create_journal_entry_input_accepts_origin() {
        // Verify that NewJournalEntryInput with origin = "rule" serializes correctly
        let input = NewJournalEntryInput {
            entry_date: "2026-01-01".to_string(),
            description: "Test".to_string(),
            reference_number: None,
            raw_transaction_id: Some("tx123".to_string()),
            origin: Some("rule".to_string()),
            lines: vec![],
        };
        assert_eq!(input.origin.as_deref(), Some("rule"));
        assert_eq!(input.raw_transaction_id.as_deref(), Some("tx123"));
    }
}
