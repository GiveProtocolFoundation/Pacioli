use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;
use uuid::Uuid;

use super::persistence::DatabaseState;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BankAccount {
    pub id: String,
    pub institution_name: String,
    pub account_nickname: String,
    pub account_type: String,
    pub currency: String,
    pub gl_account_number: String,
    pub external_source: Option<String>,
    pub external_account_id: Option<String>,
    pub masked_account_number: Option<String>,
    pub opening_balance: Option<String>,
    pub opening_balance_date: Option<i64>,
    pub entity_id: Option<String>,
    pub active: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankAccountInput {
    pub institution_name: String,
    pub account_nickname: String,
    pub account_type: String,
    pub currency: String,
    pub gl_account_number: Option<String>,
    pub external_source: Option<String>,
    pub external_account_id: Option<String>,
    pub masked_account_number: Option<String>,
    pub opening_balance: Option<String>,
    pub opening_balance_date: Option<i64>,
    pub entity_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BankTransaction {
    pub id: String,
    pub bank_account_id: String,
    pub external_id: Option<String>,
    pub posted_date: i64,
    pub transaction_date: Option<i64>,
    pub amount: String,
    pub currency: String,
    pub payee: Option<String>,
    pub memo: Option<String>,
    pub reference_number: Option<String>,
    pub tx_type: Option<String>,
    pub running_balance: Option<String>,
    pub classification_status: String,
    pub classification_note: Option<String>,
    pub raw_data: Option<String>,
    pub import_batch_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankTransactionInput {
    pub bank_account_id: String,
    pub external_id: Option<String>,
    pub posted_date: i64,
    pub transaction_date: Option<i64>,
    pub amount: String,
    pub currency: String,
    pub payee: Option<String>,
    pub memo: Option<String>,
    pub reference_number: Option<String>,
    pub tx_type: Option<String>,
    pub running_balance: Option<String>,
    pub classification_status: Option<String>,
    pub classification_note: Option<String>,
    pub raw_data: Option<String>,
    pub import_batch_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ImportBatch {
    pub id: String,
    pub bank_account_id: String,
    pub filename: Option<String>,
    pub format: Option<String>,
    pub imported_at: i64,
    pub row_count: Option<i64>,
    pub duplicate_count: Option<i64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportBatchInput {
    pub bank_account_id: String,
    pub filename: Option<String>,
    pub format: Option<String>,
    pub row_count: Option<i64>,
    pub duplicate_count: Option<i64>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatementProfile {
    pub id: String,
    pub name: String,
    pub institution_name: Option<String>,
    pub column_map: Option<String>,
    pub date_format: Option<String>,
    pub amount_sign_convention: Option<String>,
    pub currency_default: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementProfileInput {
    pub name: String,
    pub institution_name: Option<String>,
    pub column_map: Option<String>,
    pub date_format: Option<String>,
    pub amount_sign_convention: Option<String>,
    pub currency_default: Option<String>,
}

// ============================================================================
// Bank Account Commands
// ============================================================================

#[tauri::command]
pub async fn get_bank_accounts(
    state: State<'_, DatabaseState>,
) -> Result<Vec<BankAccount>, String> {
    sqlx::query_as::<_, BankAccount>(
        "SELECT * FROM bank_accounts ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

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

// ============================================================================
// Bank Transaction Commands
// ============================================================================

#[tauri::command]
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
    let mut sql = String::from(
        "SELECT * FROM bank_transactions WHERE bank_account_id = ?",
    );
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
        sqlx::query_as::<_, ImportBatch>(
            "SELECT * FROM import_batches ORDER BY imported_at DESC",
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
    }
}

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

#[tauri::command]
pub async fn get_statement_profiles(
    state: State<'_, DatabaseState>,
) -> Result<Vec<StatementProfile>, String> {
    sqlx::query_as::<_, StatementProfile>(
        "SELECT * FROM statement_profiles ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

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

    sqlx::query_as::<_, StatementProfile>(
        "SELECT * FROM statement_profiles WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())
}
