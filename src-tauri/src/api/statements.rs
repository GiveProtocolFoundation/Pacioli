use csv::Writer;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

use super::persistence::DatabaseState;

// ============================================================================
// Types — Financial Statement Line Items
// ============================================================================

/// A single account row aggregated for a financial statement period.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct StatementLineItem {
    /// Account number (e.g. "1200").
    pub account_number: String,
    /// Human-readable account name.
    pub account_name: String,
    /// One of: Asset, Liability, Equity, Income, Expense.
    pub account_type: String,
    /// Net balance in minor units (USD cents), sign-corrected for reporting.
    pub balance_minor: i64,
}

/// A trial balance row for a specific period.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PeriodTrialBalanceRow {
    /// Account number.
    pub account_number: String,
    /// Account name.
    pub account_name: String,
    /// Account type.
    pub account_type: String,
    /// Debit balance in minor units (0 if net credit side).
    pub debit_balance: i64,
    /// Credit balance in minor units (0 if net debit side).
    pub credit_balance: i64,
}

// ============================================================================
// Types — Financial Statement Reports
// ============================================================================

/// A single section (e.g. "Assets") in a financial statement.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementSection {
    /// Section label (e.g. "Assets", "Income").
    pub label: String,
    /// Line items in this section.
    pub items: Vec<StatementLineItem>,
    /// Section subtotal in minor units.
    pub subtotal_minor: i64,
}

/// Balance sheet report as of `end_date` (cumulative from inception).
/// `start_date` scopes the current-period net income split only.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BalanceSheetReport {
    /// Start date of the reporting period (ISO 8601 date string).
    pub start_date: String,
    /// End date of the reporting period (ISO 8601 date string).
    pub end_date: String,
    /// Assets section (cumulative balances as of end_date).
    pub assets: StatementSection,
    /// Liabilities section (cumulative balances as of end_date).
    pub liabilities: StatementSection,
    /// Equity section (contributed equity accounts, excluding retained
    /// earnings and current-period net income).
    pub equity: StatementSection,
    /// Retained earnings in minor units: accumulated net income from
    /// inception through the day before start_date.
    pub retained_earnings_minor: i64,
    /// Current-period net income in minor units (start_date..=end_date).
    pub net_income_minor: i64,
    /// Total assets in minor units.
    pub total_assets_minor: i64,
    /// Total liabilities in minor units.
    pub total_liabilities_minor: i64,
    /// Total equity in minor units (including net income).
    pub total_equity_minor: i64,
    /// Whether the balance sheet ties (assets == liabilities + equity).
    pub is_balanced: bool,
}

/// Income statement report for a given date range.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomeStatementReport {
    /// Start date of the reporting period.
    pub start_date: String,
    /// End date of the reporting period.
    pub end_date: String,
    /// Revenue / income section.
    pub revenue: StatementSection,
    /// Expenses section.
    pub expenses: StatementSection,
    /// Total revenue in minor units.
    pub total_revenue_minor: i64,
    /// Total expenses in minor units.
    pub total_expenses_minor: i64,
    /// Net income in minor units (revenue - expenses).
    pub net_income_minor: i64,
}

/// Trial balance report for a given date range.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrialBalanceReport {
    /// Start date of the reporting period.
    pub start_date: String,
    /// End date of the reporting period.
    pub end_date: String,
    /// Account rows.
    pub rows: Vec<PeriodTrialBalanceRow>,
    /// Total debits in minor units.
    pub total_debits_minor: i64,
    /// Total credits in minor units.
    pub total_credits_minor: i64,
    /// Whether the trial balance is in balance.
    pub is_balanced: bool,
}

/// Comparative financial statement with current and prior period.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeBalanceSheet {
    /// Current period balance sheet.
    pub current: BalanceSheetReport,
    /// Prior period balance sheet (comparative).
    pub prior: BalanceSheetReport,
}

/// Comparative income statement with current and prior period.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeIncomeStatement {
    /// Current period income statement.
    pub current: IncomeStatementReport,
    /// Prior period income statement (comparative).
    pub prior: IncomeStatementReport,
}

/// Comparative trial balance with current and prior period.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparativeTrialBalance {
    /// Current period trial balance.
    pub current: TrialBalanceReport,
    /// Prior period trial balance (comparative).
    pub prior: TrialBalanceReport,
}

// ============================================================================
// Internal query helpers
// ============================================================================

/// Raw row from the period-filtered aggregation query.
#[derive(Debug, Clone, FromRow)]
struct PeriodAccountRow {
    account_number: String,
    account_name: String,
    account_type: String,
    total_debit_minor: i64,
    total_credit_minor: i64,
}

/// Aggregates posted journal-entry activity per GL account.
///
/// Filtering uses INNER JOINs with predicates in the WHERE clause. Putting the
/// posted/date predicates on a chained LEFT JOIN's ON clause only NULLs the
/// joined columns — the line rows still survive and get summed, which leaked
/// draft and out-of-period lines into statements (caught in CTO review).
///
/// * `start_date = None` — cumulative activity from inception through
///   `end_date` (balance-sheet / as-of semantics).
/// * `start_date = Some(d)` — activity within `[d, end_date]`
///   (income-statement / period semantics).
///
/// Only posted entries (is_posted = 1) are included — voided entries net out
/// via their reversing entries. Inactive accounts with posted history are
/// intentionally INCLUDED: excluding them would break the ties.
async fn query_account_activity(
    pool: &sqlx::SqlitePool,
    start_date: Option<&str>,
    end_date: &str,
) -> Result<Vec<PeriodAccountRow>, String> {
    sqlx::query_as::<_, PeriodAccountRow>(
        r#"
        SELECT
            ga.account_number,
            ga.account_name,
            ga.account_type,
            COALESCE(SUM(jel.debit_minor), 0) AS total_debit_minor,
            COALESCE(SUM(jel.credit_minor), 0) AS total_credit_minor
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
        INNER JOIN gl_accounts ga ON ga.id = jel.gl_account_id
        WHERE je.is_posted = 1
            AND DATE(je.entry_date) <= DATE(?)
            AND (? IS NULL OR DATE(je.entry_date) >= DATE(?))
        GROUP BY ga.id, ga.account_number, ga.account_name, ga.account_type
        HAVING COALESCE(SUM(jel.debit_minor), 0) != 0
            OR COALESCE(SUM(jel.credit_minor), 0) != 0
        ORDER BY ga.account_number
        "#,
    )
    .bind(end_date)
    .bind(start_date)
    .bind(start_date)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

/// Computes the sign-corrected balance for reporting.
/// Assets and Expenses have a natural debit balance (debit - credit).
/// Liabilities, Equity, and Income have a natural credit balance (credit - debit).
fn signed_balance(account_type: &str, debit: i64, credit: i64) -> i64 {
    match account_type {
        "Asset" | "Expense" => debit - credit,
        _ => credit - debit,
    }
}

/// Builds a section (Assets, Liabilities, Equity, Income, or Expense) from rows.
fn build_section(label: &str, rows: &[PeriodAccountRow], types: &[&str]) -> StatementSection {
    let items: Vec<StatementLineItem> = rows
        .iter()
        .filter(|r| types.contains(&r.account_type.as_str()))
        .map(|r| StatementLineItem {
            account_number: r.account_number.clone(),
            account_name: r.account_name.clone(),
            account_type: r.account_type.clone(),
            balance_minor: signed_balance(
                &r.account_type,
                r.total_debit_minor,
                r.total_credit_minor,
            ),
        })
        .filter(|item| item.balance_minor != 0)
        .collect();

    let subtotal_minor: i64 = items.iter().map(|i| i.balance_minor).sum();

    StatementSection {
        label: label.to_string(),
        items,
        subtotal_minor,
    }
}

// ============================================================================
// Statement Builders (pure logic, testable)
// ============================================================================

/// Builds a balance sheet as of `end_date`.
///
/// A balance sheet reports cumulative positions, not period movements:
/// `cumulative_rows` must cover inception..=end_date and `period_rows` must
/// cover start_date..=end_date (both posted-only). Building A/L/E from period
/// activity alone would drop every opening balance (caught in CTO review).
///
/// Equity decomposes as: contributed equity accounts (cumulative) + retained
/// earnings (net income accumulated before start_date) + current-period net
/// income. Tie: total_assets == total_liabilities + total_equity.
fn build_balance_sheet(
    cumulative_rows: &[PeriodAccountRow],
    period_rows: &[PeriodAccountRow],
    start_date: &str,
    end_date: &str,
) -> BalanceSheetReport {
    let assets = build_section("Assets", cumulative_rows, &["Asset"]);
    let liabilities = build_section("Liabilities", cumulative_rows, &["Liability"]);
    let equity = build_section("Equity", cumulative_rows, &["Equity"]);

    // Current-period net income = Income - Expenses over the period rows.
    let period_revenue = build_section("Income", period_rows, &["Income"]);
    let period_expense = build_section("Expenses", period_rows, &["Expense"]);
    let net_income_minor = period_revenue.subtotal_minor - period_expense.subtotal_minor;

    // Retained earnings = accumulated net income from inception through the
    // day before start_date (cumulative NI minus the current-period portion).
    let cumulative_revenue = build_section("Income", cumulative_rows, &["Income"]);
    let cumulative_expense = build_section("Expenses", cumulative_rows, &["Expense"]);
    let cumulative_net_income =
        cumulative_revenue.subtotal_minor - cumulative_expense.subtotal_minor;
    let retained_earnings_minor = cumulative_net_income - net_income_minor;

    let total_assets_minor = assets.subtotal_minor;
    let total_liabilities_minor = liabilities.subtotal_minor;
    let total_equity_minor = equity.subtotal_minor + retained_earnings_minor + net_income_minor;

    let is_balanced = total_assets_minor == total_liabilities_minor + total_equity_minor;

    BalanceSheetReport {
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        assets,
        liabilities,
        equity,
        retained_earnings_minor,
        net_income_minor,
        total_assets_minor,
        total_liabilities_minor,
        total_equity_minor,
        is_balanced,
    }
}

/// Builds an income statement from period account rows.
fn build_income_statement(
    rows: &[PeriodAccountRow],
    start_date: &str,
    end_date: &str,
) -> IncomeStatementReport {
    let revenue = build_section("Revenue", rows, &["Income"]);
    let expenses = build_section("Expenses", rows, &["Expense"]);

    let total_revenue_minor = revenue.subtotal_minor;
    let total_expenses_minor = expenses.subtotal_minor;
    let net_income_minor = total_revenue_minor - total_expenses_minor;

    IncomeStatementReport {
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        revenue,
        expenses,
        total_revenue_minor,
        total_expenses_minor,
        net_income_minor,
    }
}

/// Builds a trial balance as of `end_date` from cumulative account rows
/// (inception..=end_date, posted-only) — conventional "trial balance as at
/// date" semantics, consistent with the Phase 2 balances and the M4 views.
fn build_trial_balance(
    rows: &[PeriodAccountRow],
    start_date: &str,
    end_date: &str,
) -> TrialBalanceReport {
    let tb_rows: Vec<PeriodTrialBalanceRow> = rows
        .iter()
        .map(|r| {
            let net = r.total_debit_minor - r.total_credit_minor;
            PeriodTrialBalanceRow {
                account_number: r.account_number.clone(),
                account_name: r.account_name.clone(),
                account_type: r.account_type.clone(),
                debit_balance: if net > 0 { net } else { 0 },
                credit_balance: if net < 0 { -net } else { 0 },
            }
        })
        .collect();

    let total_debits_minor: i64 = tb_rows.iter().map(|r| r.debit_balance).sum();
    let total_credits_minor: i64 = tb_rows.iter().map(|r| r.credit_balance).sum();
    let is_balanced = total_debits_minor == total_credits_minor;

    TrialBalanceReport {
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        rows: tb_rows,
        total_debits_minor,
        total_credits_minor,
        is_balanced,
    }
}

// ============================================================================
// Verify — Non-Negotiable Tie Assertions
// ============================================================================

/// Verifies that financial statements tie correctly. Returns Ok(()) if all
/// assertions pass, or Err with a description of what failed.
///
/// Assertions:
/// 1. Balance sheet balances: assets == liabilities + equity
///    (incl. retained earnings and current-period net income)
/// 2. Net income on the income statement == the corresponding equity movement
/// 3. Trial balance is in balance: total debits == total credits
/// 4. Trial balance cumulative net income (Income − Expense as of end_date)
///    == balance sheet retained earnings + current-period net income
pub fn verify_ties(
    balance_sheet: &BalanceSheetReport,
    income_statement: &IncomeStatementReport,
    trial_balance: &TrialBalanceReport,
) -> Result<(), String> {
    // 1. Balance sheet must balance
    if !balance_sheet.is_balanced {
        return Err(format!(
            "Balance sheet does not tie: assets ({}) != liabilities ({}) + equity ({})",
            balance_sheet.total_assets_minor,
            balance_sheet.total_liabilities_minor,
            balance_sheet.total_equity_minor,
        ));
    }

    // 2. Net income must match between income statement and balance sheet
    if income_statement.net_income_minor != balance_sheet.net_income_minor {
        return Err(format!(
            "Net income mismatch: income statement ({}) != balance sheet net income plug ({})",
            income_statement.net_income_minor, balance_sheet.net_income_minor,
        ));
    }

    // 3. Trial balance must be in balance
    if !trial_balance.is_balanced {
        return Err(format!(
            "Trial balance does not tie: debits ({}) != credits ({})",
            trial_balance.total_debits_minor, trial_balance.total_credits_minor,
        ));
    }

    // 4. Cross-check: the trial balance is cumulative as of end_date, so its
    // Income − Expense total must equal retained earnings + current-period
    // net income on the balance sheet.
    let tb_income: i64 = trial_balance
        .rows
        .iter()
        .filter(|r| r.account_type == "Income")
        .map(|r| r.credit_balance - r.debit_balance)
        .sum();
    let tb_expense: i64 = trial_balance
        .rows
        .iter()
        .filter(|r| r.account_type == "Expense")
        .map(|r| r.debit_balance - r.credit_balance)
        .sum();
    let tb_net_income = tb_income - tb_expense;
    let bs_accumulated_income =
        balance_sheet.retained_earnings_minor + balance_sheet.net_income_minor;

    if tb_net_income != bs_accumulated_income {
        return Err(format!(
            "Trial balance cumulative net income ({}) != balance sheet retained earnings + net income ({})",
            tb_net_income, bs_accumulated_income,
        ));
    }

    Ok(())
}

// ============================================================================
// Helper: compute comparative prior period dates
// ============================================================================

/// Given a period (start, end), computes the prior period of the same duration.
fn compute_prior_period(start_date: &str, end_date: &str) -> Result<(String, String), String> {
    let start = chrono::NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date '{}': {}", start_date, e))?;
    let end = chrono::NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date '{}': {}", end_date, e))?;

    let duration = end.signed_duration_since(start);
    let days = duration.num_days();
    if days < 0 {
        return Err("end_date must be >= start_date".to_string());
    }

    let prior_end = start - chrono::Duration::days(1);
    let prior_start = prior_end - chrono::Duration::days(days);

    Ok((
        prior_start.format("%Y-%m-%d").to_string(),
        prior_end.format("%Y-%m-%d").to_string(),
    ))
}

// ============================================================================
// Shared builder — query, build, and verify all three statements
// ============================================================================

/// All three statements for one period, built together and verified as a set.
struct VerifiedStatements {
    balance_sheet: BalanceSheetReport,
    income_statement: IncomeStatementReport,
    trial_balance: TrialBalanceReport,
}

/// Queries cumulative (inception..=end) and period (start..=end) activity,
/// builds all three statements, and runs `verify_ties`. Every statement
/// handed to the UI or an export goes through this single gate — a statement
/// that does not tie is a hard error, never a silent render.
async fn build_verified_statements(
    pool: &sqlx::SqlitePool,
    start_date: &str,
    end_date: &str,
) -> Result<VerifiedStatements, String> {
    let cumulative_rows = query_account_activity(pool, None, end_date).await?;
    let period_rows = query_account_activity(pool, Some(start_date), end_date).await?;

    let balance_sheet = build_balance_sheet(&cumulative_rows, &period_rows, start_date, end_date);
    let income_statement = build_income_statement(&period_rows, start_date, end_date);
    let trial_balance = build_trial_balance(&cumulative_rows, start_date, end_date);

    verify_ties(&balance_sheet, &income_statement, &trial_balance)?;

    Ok(VerifiedStatements {
        balance_sheet,
        income_statement,
        trial_balance,
    })
}

// ============================================================================
// Tauri Commands — Financial Statements
// ============================================================================

/// Input parameters for financial statement generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementParams {
    /// Start date of the reporting period (ISO 8601 date, e.g. "2025-01-01").
    pub start_date: String,
    /// End date of the reporting period (ISO 8601 date, e.g. "2025-12-31").
    pub end_date: String,
}

/// Generates a balance sheet with comparative prior period.
/// Runs verify_ties before returning — a statement that does not tie is an error.
///
/// # Arguments
/// * `state` - Database state managed by Tauri.
/// * `params` - Period start and end dates.
///
/// # Returns
/// Comparative balance sheet with current and prior period.
///
/// # Errors
/// Returns a string error if the query fails or statements do not tie.
#[tauri::command]
pub async fn get_balance_sheet(
    state: State<'_, DatabaseState>,
    params: StatementParams,
) -> Result<ComparativeBalanceSheet, String> {
    let (prior_start, prior_end) = compute_prior_period(&params.start_date, &params.end_date)?;

    let current =
        build_verified_statements(&state.pool, &params.start_date, &params.end_date).await?;
    let prior = build_verified_statements(&state.pool, &prior_start, &prior_end).await?;

    Ok(ComparativeBalanceSheet {
        current: current.balance_sheet,
        prior: prior.balance_sheet,
    })
}

/// Generates an income statement with comparative prior period.
/// Runs verify_ties before returning.
///
/// # Arguments
/// * `state` - Database state managed by Tauri.
/// * `params` - Period start and end dates.
///
/// # Returns
/// Comparative income statement with current and prior period.
///
/// # Errors
/// Returns a string error if the query fails or statements do not tie.
#[tauri::command]
pub async fn get_income_statement(
    state: State<'_, DatabaseState>,
    params: StatementParams,
) -> Result<ComparativeIncomeStatement, String> {
    let (prior_start, prior_end) = compute_prior_period(&params.start_date, &params.end_date)?;

    let current =
        build_verified_statements(&state.pool, &params.start_date, &params.end_date).await?;
    let prior = build_verified_statements(&state.pool, &prior_start, &prior_end).await?;

    Ok(ComparativeIncomeStatement {
        current: current.income_statement,
        prior: prior.income_statement,
    })
}

/// Generates a trial balance with comparative prior period.
/// Runs verify_ties before returning.
///
/// # Arguments
/// * `state` - Database state managed by Tauri.
/// * `params` - Period start and end dates.
///
/// # Returns
/// Comparative trial balance with current and prior period.
///
/// # Errors
/// Returns a string error if the query fails or statements do not tie.
#[tauri::command]
pub async fn get_period_trial_balance(
    state: State<'_, DatabaseState>,
    params: StatementParams,
) -> Result<ComparativeTrialBalance, String> {
    let (prior_start, prior_end) = compute_prior_period(&params.start_date, &params.end_date)?;

    let current =
        build_verified_statements(&state.pool, &params.start_date, &params.end_date).await?;
    let prior = build_verified_statements(&state.pool, &prior_start, &prior_end).await?;

    Ok(ComparativeTrialBalance {
        current: current.trial_balance,
        prior: prior.trial_balance,
    })
}

// ============================================================================
// CSV Export Commands
// ============================================================================

/// Exports a balance sheet to CSV at the specified file path.
///
/// # Arguments
/// * `state` - Database state managed by Tauri.
/// * `params` - Period start and end dates.
/// * `path` - File system path for the CSV output.
///
/// # Errors
/// Returns a string error if the query fails, statements do not tie, or file I/O fails.
#[tauri::command]
pub async fn export_balance_sheet_csv(
    state: State<'_, DatabaseState>,
    params: StatementParams,
    path: String,
) -> Result<(), String> {
    let statements =
        build_verified_statements(&state.pool, &params.start_date, &params.end_date).await?;
    let bs = statements.balance_sheet;

    let mut writer = Writer::from_path(&path).map_err(|e| e.to_string())?;

    writer
        .write_record(["Section", "Account #", "Account Name", "Balance"])
        .map_err(|e| e.to_string())?;

    for item in &bs.assets.items {
        writer
            .write_record([
                "Assets",
                &item.account_number,
                &item.account_name,
                &format_minor(item.balance_minor),
            ])
            .map_err(|e| e.to_string())?;
    }
    writer
        .write_record(["", "", "Total Assets", &format_minor(bs.total_assets_minor)])
        .map_err(|e| e.to_string())?;

    for item in &bs.liabilities.items {
        writer
            .write_record([
                "Liabilities",
                &item.account_number,
                &item.account_name,
                &format_minor(item.balance_minor),
            ])
            .map_err(|e| e.to_string())?;
    }
    writer
        .write_record([
            "",
            "",
            "Total Liabilities",
            &format_minor(bs.total_liabilities_minor),
        ])
        .map_err(|e| e.to_string())?;

    for item in &bs.equity.items {
        writer
            .write_record([
                "Equity",
                &item.account_number,
                &item.account_name,
                &format_minor(item.balance_minor),
            ])
            .map_err(|e| e.to_string())?;
    }
    writer
        .write_record([
            "Equity",
            "",
            "Retained Earnings",
            &format_minor(bs.retained_earnings_minor),
        ])
        .map_err(|e| e.to_string())?;
    writer
        .write_record([
            "Equity",
            "",
            "Net Income (current period)",
            &format_minor(bs.net_income_minor),
        ])
        .map_err(|e| e.to_string())?;
    writer
        .write_record(["", "", "Total Equity", &format_minor(bs.total_equity_minor)])
        .map_err(|e| e.to_string())?;

    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

/// Exports an income statement to CSV at the specified file path.
///
/// # Arguments
/// * `state` - Database state managed by Tauri.
/// * `params` - Period start and end dates.
/// * `path` - File system path for the CSV output.
///
/// # Errors
/// Returns a string error if the query fails, statements do not tie, or file I/O fails.
#[tauri::command]
pub async fn export_income_statement_csv(
    state: State<'_, DatabaseState>,
    params: StatementParams,
    path: String,
) -> Result<(), String> {
    let statements =
        build_verified_statements(&state.pool, &params.start_date, &params.end_date).await?;
    let is = statements.income_statement;

    let mut writer = Writer::from_path(&path).map_err(|e| e.to_string())?;

    writer
        .write_record(["Section", "Account #", "Account Name", "Amount"])
        .map_err(|e| e.to_string())?;

    for item in &is.revenue.items {
        writer
            .write_record([
                "Revenue",
                &item.account_number,
                &item.account_name,
                &format_minor(item.balance_minor),
            ])
            .map_err(|e| e.to_string())?;
    }
    writer
        .write_record([
            "",
            "",
            "Total Revenue",
            &format_minor(is.total_revenue_minor),
        ])
        .map_err(|e| e.to_string())?;

    for item in &is.expenses.items {
        writer
            .write_record([
                "Expenses",
                &item.account_number,
                &item.account_name,
                &format_minor(item.balance_minor),
            ])
            .map_err(|e| e.to_string())?;
    }
    writer
        .write_record([
            "",
            "",
            "Total Expenses",
            &format_minor(is.total_expenses_minor),
        ])
        .map_err(|e| e.to_string())?;

    writer
        .write_record(["", "", "Net Income", &format_minor(is.net_income_minor)])
        .map_err(|e| e.to_string())?;

    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

/// Exports a trial balance to CSV at the specified file path.
///
/// # Arguments
/// * `state` - Database state managed by Tauri.
/// * `params` - Period start and end dates.
/// * `path` - File system path for the CSV output.
///
/// # Errors
/// Returns a string error if the query fails, statements do not tie, or file I/O fails.
#[tauri::command]
pub async fn export_trial_balance_csv(
    state: State<'_, DatabaseState>,
    params: StatementParams,
    path: String,
) -> Result<(), String> {
    let statements =
        build_verified_statements(&state.pool, &params.start_date, &params.end_date).await?;
    let tb = statements.trial_balance;

    let mut writer = Writer::from_path(&path).map_err(|e| e.to_string())?;

    writer
        .write_record(["Account #", "Account Name", "Type", "Debit", "Credit"])
        .map_err(|e| e.to_string())?;

    for row in &tb.rows {
        writer
            .write_record([
                &row.account_number,
                &row.account_name,
                &row.account_type,
                &format_minor(row.debit_balance),
                &format_minor(row.credit_balance),
            ])
            .map_err(|e| e.to_string())?;
    }

    writer
        .write_record([
            "",
            "",
            "Totals",
            &format_minor(tb.total_debits_minor),
            &format_minor(tb.total_credits_minor),
        ])
        .map_err(|e| e.to_string())?;

    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

/// Formats minor units (cents) as a dollar string (e.g. 12345 -> "123.45").
fn format_minor(minor: i64) -> String {
    let sign = if minor < 0 { "-" } else { "" };
    let abs = minor.unsigned_abs();
    let dollars = abs / 100;
    let cents = abs % 100;
    format!("{sign}{dollars}.{cents:02}")
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: creates a PeriodAccountRow for testing.
    fn row(
        account_number: &str,
        account_name: &str,
        account_type: &str,
        debit: i64,
        credit: i64,
    ) -> PeriodAccountRow {
        PeriodAccountRow {
            account_number: account_number.to_string(),
            account_name: account_name.to_string(),
            account_type: account_type.to_string(),
            total_debit_minor: debit,
            total_credit_minor: credit,
        }
    }

    /// A balanced set of fixture rows for testing:
    /// Cash (Asset): dr 50000, cr 0 -> balance 50000
    /// Accounts Payable (Liability): dr 0, cr 10000 -> balance 10000
    /// Owner Equity (Equity): dr 0, cr 30000 -> balance 30000
    /// Donation Revenue (Income): dr 0, cr 20000 -> balance 20000
    /// Office Supplies (Expense): dr 10000, cr 0 -> balance 10000
    ///
    /// Check: TB debits = 60000, credits = 60000 (balanced)
    /// Net income = 20000 - 10000 = 10000
    /// Assets = 50000, Liabilities = 10000, Equity = 30000 + 10000 NI = 40000
    /// A = L + E: 50000 = 10000 + 40000 ✓
    fn balanced_fixture() -> Vec<PeriodAccountRow> {
        vec![
            row("1000", "Cash", "Asset", 50000, 0),
            row("2000", "Accounts Payable", "Liability", 0, 10000),
            row("3000", "Owner Equity", "Equity", 0, 30000),
            row("4000", "Donation Revenue", "Income", 0, 20000),
            row("5000", "Office Supplies", "Expense", 10000, 0),
        ]
    }

    #[test]
    fn test_balance_sheet_ties() {
        let rows = balanced_fixture();
        let bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");

        assert_eq!(bs.total_assets_minor, 50000);
        assert_eq!(bs.total_liabilities_minor, 10000);
        assert_eq!(bs.retained_earnings_minor, 0); // no pre-period history
        assert_eq!(bs.net_income_minor, 10000);
        assert_eq!(bs.total_equity_minor, 40000); // 30000 equity + 10000 NI
        assert!(bs.is_balanced);
        assert_eq!(
            bs.total_assets_minor,
            bs.total_liabilities_minor + bs.total_equity_minor
        );
    }

    #[test]
    fn test_income_statement_net_income() {
        let rows = balanced_fixture();
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");

        assert_eq!(is.total_revenue_minor, 20000);
        assert_eq!(is.total_expenses_minor, 10000);
        assert_eq!(is.net_income_minor, 10000);
    }

    #[test]
    fn test_trial_balance_balances() {
        let rows = balanced_fixture();
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        assert_eq!(tb.total_debits_minor, 60000);
        assert_eq!(tb.total_credits_minor, 60000);
        assert!(tb.is_balanced);
    }

    #[test]
    fn test_verify_ties_pass() {
        let rows = balanced_fixture();
        let bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        assert!(verify_ties(&bs, &is, &tb).is_ok());
    }

    #[test]
    fn test_verify_ties_fails_on_corrupted_balance_sheet() {
        let rows = balanced_fixture();
        let mut bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        // Corrupt the balance sheet
        bs.total_assets_minor += 100;
        bs.is_balanced = false;

        let result = verify_ties(&bs, &is, &tb);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Balance sheet does not tie"));
    }

    #[test]
    fn test_verify_ties_fails_on_net_income_mismatch() {
        let rows = balanced_fixture();
        let bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let mut is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        // Corrupt income statement
        is.net_income_minor += 500;

        let result = verify_ties(&bs, &is, &tb);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Net income mismatch"));
    }

    #[test]
    fn test_verify_ties_fails_on_unbalanced_trial_balance() {
        let rows = balanced_fixture();
        let bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let mut tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        // Corrupt trial balance
        tb.total_debits_minor += 1;
        tb.is_balanced = false;

        let result = verify_ties(&bs, &is, &tb);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Trial balance does not tie"));
    }

    #[test]
    fn test_voided_entry_neutrality() {
        // A voided entry creates a reversing entry. Both are posted.
        // The original: dr Cash 10000, cr Revenue 10000
        // The reversal: dr Revenue 10000, cr Cash 10000
        // Net effect: zero on all accounts.
        let rows = vec![
            // Original entry debits + reversal credits to Cash
            row("1000", "Cash", "Asset", 10000, 10000),
            // Original entry credits + reversal debits to Revenue
            row("4000", "Donation Revenue", "Income", 10000, 10000),
        ];

        let bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        // All zeros — voided entry nets out
        assert_eq!(bs.total_assets_minor, 0);
        assert_eq!(bs.total_liabilities_minor, 0);
        assert_eq!(bs.total_equity_minor, 0);
        assert_eq!(is.net_income_minor, 0);
        assert!(bs.is_balanced);

        // Trial balance with zero rows is trivially balanced
        assert!(tb.is_balanced);
    }

    #[test]
    fn test_comparative_period_dates() {
        // Full year 2025 (Jan 1 – Dec 31): 365 inclusive days.
        // Prior end = Dec 31 2024. Prior period is same gap (364 days between
        // start and end), so prior start = Jan 2 2024.
        let (prior_start, prior_end) = compute_prior_period("2025-01-01", "2025-12-31").unwrap();
        assert_eq!(prior_end, "2024-12-31");
        assert_eq!(prior_start, "2024-01-02");

        // Monthly: January 2025 (31 inclusive days, gap = 30).
        // Prior end = Dec 31 2024. Prior start = Dec 1 2024.
        let (prior_start, prior_end) = compute_prior_period("2025-01-01", "2025-01-31").unwrap();
        assert_eq!(prior_end, "2024-12-31");
        assert_eq!(prior_start, "2024-12-01");

        // Single day period
        let (prior_start, prior_end) = compute_prior_period("2025-06-15", "2025-06-15").unwrap();
        assert_eq!(prior_end, "2025-06-14");
        assert_eq!(prior_start, "2025-06-14");
    }

    #[test]
    fn test_format_minor() {
        assert_eq!(format_minor(12345), "123.45");
        assert_eq!(format_minor(100), "1.00");
        assert_eq!(format_minor(5), "0.05");
        assert_eq!(format_minor(0), "0.00");
        assert_eq!(format_minor(-500), "-5.00");
    }

    #[test]
    fn test_empty_period_produces_balanced_statements() {
        let rows: Vec<PeriodAccountRow> = vec![];
        let bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        assert!(bs.is_balanced);
        assert!(tb.is_balanced);
        assert_eq!(is.net_income_minor, 0);
        assert!(verify_ties(&bs, &is, &tb).is_ok());
    }

    #[test]
    fn test_section_items_exclude_zero_balances() {
        let rows = vec![
            row("1000", "Cash", "Asset", 5000, 0),
            row("1100", "Receivables", "Asset", 1000, 1000), // nets to zero
        ];
        let section = build_section("Assets", &rows, &["Asset"]);

        assert_eq!(section.items.len(), 1);
        assert_eq!(section.items[0].account_number, "1000");
        assert_eq!(section.subtotal_minor, 5000);
    }

    #[test]
    fn test_retained_earnings_split_from_prior_income() {
        // Entity history: 10000 contributed equity, 20000 total income
        // (15000 earned before the period, 5000 within the period).
        let cumulative = vec![
            row("1000", "Cash", "Asset", 30000, 0),
            row("3000", "Owner Equity", "Equity", 0, 10000),
            row("4000", "Donation Revenue", "Income", 0, 20000),
        ];
        let period = vec![
            row("1000", "Cash", "Asset", 5000, 0),
            row("4000", "Donation Revenue", "Income", 0, 5000),
        ];

        let bs = build_balance_sheet(&cumulative, &period, "2025-06-01", "2025-06-30");
        let is = build_income_statement(&period, "2025-06-01", "2025-06-30");
        let tb = build_trial_balance(&cumulative, "2025-06-01", "2025-06-30");

        // Opening balances survive: assets are cumulative, not period movement.
        assert_eq!(bs.total_assets_minor, 30000);
        assert_eq!(bs.net_income_minor, 5000);
        assert_eq!(bs.retained_earnings_minor, 15000);
        assert_eq!(bs.total_equity_minor, 30000); // 10000 + 15000 RE + 5000 NI
        assert!(bs.is_balanced);
        assert_eq!(is.net_income_minor, 5000);
        assert!(verify_ties(&bs, &is, &tb).is_ok());
    }

    #[test]
    fn test_verify_ties_fails_on_corrupted_retained_earnings() {
        let rows = balanced_fixture();
        let mut bs = build_balance_sheet(&rows, &rows, "2025-01-01", "2025-12-31");
        let is = build_income_statement(&rows, "2025-01-01", "2025-12-31");
        let tb = build_trial_balance(&rows, "2025-01-01", "2025-12-31");

        // Corrupt retained earnings while keeping the A = L + E arithmetic
        // consistent, so only the trial-balance cross-check can catch it.
        bs.retained_earnings_minor += 700;
        bs.total_equity_minor += 700;
        bs.total_assets_minor += 700;

        let result = verify_ties(&bs, &is, &tb);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Trial balance cumulative net income"));
    }

    // ========================================================================
    // DB integration tests — the SQL layer itself (draft / date filtering)
    // ========================================================================

    /// Creates an in-memory SQLite pool with all migrations applied.
    async fn setup_test_db() -> sqlx::SqlitePool {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory SQLite pool");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        pool
    }

    /// Looks up a seed GL account id by account number.
    async fn account_id(pool: &sqlx::SqlitePool, number: &str) -> i64 {
        let (id,): (i64,) = sqlx::query_as("SELECT id FROM gl_accounts WHERE account_number = ?")
            .bind(number)
            .fetch_one(pool)
            .await
            .expect("Seed account should exist");
        id
    }

    /// Creates a draft entry on a given date with one balanced debit/credit
    /// line pair, and returns its id.
    async fn create_draft_with_lines(
        pool: &sqlx::SqlitePool,
        entry_number: &str,
        entry_date: &str,
        debit_acct: i64,
        credit_acct: i64,
        amount_minor: i64,
    ) -> i64 {
        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, entry_number, description, is_posted, status, origin, created_by) VALUES (?, ?, 'Statement test entry', 0, 'draft', 'manual', 'test')",
        )
        .bind(entry_date)
        .bind(entry_number)
        .execute(pool)
        .await
        .expect("Failed to create draft entry");
        let entry_id = result.last_insert_rowid();

        let legacy_amount = amount_minor as f64 / 100.0;
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, ?, 0, ?, 0, 'USD', 1)",
        )
        .bind(entry_id)
        .bind(debit_acct)
        .bind(legacy_amount)
        .bind(amount_minor)
        .execute(pool)
        .await
        .expect("Failed to add debit line");
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, ?, 0, ?, 'USD', 2)",
        )
        .bind(entry_id)
        .bind(credit_acct)
        .bind(legacy_amount)
        .bind(amount_minor)
        .execute(pool)
        .await
        .expect("Failed to add credit line");

        entry_id
    }

    /// Walks an entry through draft -> approved -> posted via direct SQL.
    async fn approve_and_post(pool: &sqlx::SqlitePool, entry_id: i64) {
        sqlx::query(
            "UPDATE journal_entries SET status = 'approved', approved_by = 'test', approved_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("Failed to approve entry");
        sqlx::query(
            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("Failed to post entry");
    }

    /// Seeds: posted in-period (100.00), posted before period (555.00), and a
    /// DRAFT in-period (999.00) that must never reach any statement.
    async fn seed_statement_fixture(pool: &sqlx::SqlitePool) {
        let cash = account_id(pool, "1000").await;
        let income = account_id(pool, "4000").await;

        let in_period =
            create_draft_with_lines(pool, "ST-001", "2026-02-10", cash, income, 10000).await;
        approve_and_post(pool, in_period).await;

        let before_period =
            create_draft_with_lines(pool, "ST-002", "2026-01-05", cash, income, 55500).await;
        approve_and_post(pool, before_period).await;

        // Draft stays a draft — is_posted = 0.
        create_draft_with_lines(pool, "ST-003", "2026-02-15", cash, income, 99900).await;
    }

    #[tokio::test]
    async fn db_query_excludes_drafts_and_out_of_period_entries() {
        let pool = setup_test_db().await;
        seed_statement_fixture(&pool).await;

        // Period query: only the posted in-period entry.
        let period_rows = query_account_activity(&pool, Some("2026-02-01"), "2026-02-28")
            .await
            .expect("period query should succeed");
        let cash_row = period_rows
            .iter()
            .find(|r| r.account_number == "1000")
            .expect("Cash should have period activity");
        assert_eq!(
            cash_row.total_debit_minor, 10000,
            "Draft (99900) and January (55500) lines must be excluded"
        );

        // Cumulative query: both posted entries, still no draft.
        let cumulative_rows = query_account_activity(&pool, None, "2026-02-28")
            .await
            .expect("cumulative query should succeed");
        let cash_row = cumulative_rows
            .iter()
            .find(|r| r.account_number == "1000")
            .expect("Cash should have cumulative activity");
        assert_eq!(
            cash_row.total_debit_minor,
            10000 + 55500,
            "Cumulative must include prior posted entries and exclude drafts"
        );
    }

    #[tokio::test]
    async fn db_balance_sheet_includes_opening_balances_and_ties() {
        let pool = setup_test_db().await;
        seed_statement_fixture(&pool).await;

        let statements = build_verified_statements(&pool, "2026-02-01", "2026-02-28")
            .await
            .expect("statements should build and tie");

        let bs = &statements.balance_sheet;
        assert_eq!(bs.total_assets_minor, 65500, "Assets are as-of end date");
        assert_eq!(bs.net_income_minor, 10000, "NI is period-scoped");
        assert_eq!(
            bs.retained_earnings_minor, 55500,
            "Pre-period income lands in retained earnings"
        );
        assert!(bs.is_balanced);

        assert_eq!(statements.income_statement.net_income_minor, 10000);
        assert!(statements.trial_balance.is_balanced);
        assert_eq!(statements.trial_balance.total_debits_minor, 65500);
    }
}
