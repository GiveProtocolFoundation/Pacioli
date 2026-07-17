//! Cost basis engine — FIFO lot tracking, realized gain/loss, non-realizing
//! own-wallet transfers (Phase 7, GIV-689).
//!
//! # Design
//!
//! - **Per-wallet, per-asset lots.** Each acquisition opens a lot scoped to a
//!   wallet address and asset identifier. The lot carries the original quantity,
//!   remaining quantity, and total cost basis in functional-currency minor units.
//! - **FIFO first; method behind a trait.** The `LotSelector` trait selects
//!   which lots to consume for a disposal. Only FIFO is implemented now;
//!   LIFO/HIFO/specific-ID can be added later without changing the consumption
//!   engine.
//! - **Transfers between own wallets move lots WITHOUT realization.** The
//!   source lot is partially or fully consumed, and a new lot is created in the
//!   destination wallet preserving the original cost basis and acquired date.
//!   No realized gain/loss is recorded.
//! - **Append-only consumption records.** `lot_consumptions` is the audit trail;
//!   `remaining_quantity` on `cost_basis_lots` is the derived running balance
//!   updated atomically in the same transaction.
//! - **Exact arithmetic only.** Quantities are `rust_decimal::Decimal`; cost
//!   basis / proceeds / gain-loss are `i64` minor units. No floats anywhere.
//! - **Journal entry integration.** Every lot event (acquisition, disposal,
//!   transfer) links to a posted journal entry. The cost basis engine does NOT
//!   post entries itself — callers create and post entries through the normal
//!   draft → approved → posted lifecycle, then call the engine to record lots.

use chrono::NaiveDate;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::str::FromStr;
use tauri::State;

use super::persistence::DatabaseState;

// ============================================================================
// Types
// ============================================================================

/// A cost basis lot: a quantity of an asset acquired at a specific cost,
/// scoped to a wallet.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CostBasisLot {
    /// Auto-incremented primary key.
    pub id: i64,
    /// Asset identifier (e.g. `token:42`).
    pub asset_id: String,
    /// Wallet address holding this lot.
    pub wallet_id: String,
    /// Date acquired (ISO 8601 date).
    pub acquired_date: String,
    /// Original quantity acquired (canonical decimal string).
    pub quantity: String,
    /// Remaining un-consumed quantity (canonical decimal string).
    pub remaining_quantity: String,
    /// Total cost basis in minor units (USD cents).
    pub cost_basis_minor: i64,
    /// Cost basis method (FIFO/LIFO/HIFO/SpecificID).
    pub cost_basis_method: String,
    /// FK to the journal entry that recorded the acquisition.
    pub journal_entry_id: Option<i64>,
    /// Whether the lot is fully consumed.
    pub is_closed: i64,
    /// Created timestamp.
    pub created_at: Option<String>,
    /// Updated timestamp.
    pub updated_at: Option<String>,
}

/// A consumption record documenting how a portion of a lot was used.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LotConsumption {
    /// Auto-incremented primary key.
    pub id: i64,
    /// The lot being consumed.
    pub lot_id: i64,
    /// Quantity consumed (canonical decimal string).
    pub quantity_consumed: String,
    /// Cost basis of consumed portion in minor units.
    pub cost_basis_minor: i64,
    /// Proceeds received in minor units (0 for transfers).
    pub proceeds_minor: i64,
    /// Realized gain/loss in minor units (0 for transfers).
    pub realized_gain_loss_minor: i64,
    /// Event type: disposal or transfer.
    pub event_type: String,
    /// Destination lot ID for transfers.
    pub destination_lot_id: Option<i64>,
    /// FK to the journal entry for this event.
    pub journal_entry_id: Option<i64>,
    /// Date of the event (ISO 8601 date).
    pub event_date: String,
    /// Holding period in days.
    pub holding_period_days: Option<i64>,
    /// Whether long-term (>= 365 days).
    pub is_long_term: Option<i64>,
    /// Created timestamp.
    pub created_at: Option<String>,
}

/// Input for recording a new acquisition (opening a lot).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcquireLotInput {
    /// Asset identifier (e.g. `token:42`).
    pub asset_id: String,
    /// Wallet address.
    pub wallet_id: String,
    /// Date acquired (ISO 8601 date, e.g. `2026-01-15`).
    pub acquired_date: String,
    /// Quantity acquired (decimal string).
    pub quantity: String,
    /// Total cost basis in minor units (USD cents).
    pub cost_basis_minor: i64,
    /// FK to the journal entry (must be posted).
    pub journal_entry_id: Option<i64>,
}

/// Input for recording a disposal (selling / swapping an asset).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisposeLotInput {
    /// Asset identifier to dispose.
    pub asset_id: String,
    /// Wallet address disposing from.
    pub wallet_id: String,
    /// Date of disposal (ISO 8601 date).
    pub disposal_date: String,
    /// Quantity to dispose (decimal string).
    pub quantity: String,
    /// Total proceeds received in minor units.
    pub proceeds_minor: i64,
    /// FK to the journal entry (must be posted).
    pub journal_entry_id: Option<i64>,
}

/// Input for transferring lots between own wallets without realization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferLotInput {
    /// Asset identifier to transfer.
    pub asset_id: String,
    /// Source wallet address.
    pub from_wallet_id: String,
    /// Destination wallet address.
    pub to_wallet_id: String,
    /// Date of transfer (ISO 8601 date).
    pub transfer_date: String,
    /// Quantity to transfer (decimal string).
    pub quantity: String,
    /// FK to the journal entry (must be posted).
    pub journal_entry_id: Option<i64>,
}

/// A single line in the disposal result showing which lot was consumed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisposalDetail {
    /// The lot that was consumed.
    pub lot_id: i64,
    /// Quantity taken from this lot.
    pub quantity_consumed: String,
    /// Cost basis of the consumed portion (minor units).
    pub cost_basis_minor: i64,
    /// Proceeds allocated to this portion (minor units).
    pub proceeds_minor: i64,
    /// Realized gain/loss for this portion (minor units).
    pub realized_gain_loss_minor: i64,
    /// Holding period in days.
    pub holding_period_days: i64,
    /// Whether long-term.
    pub is_long_term: bool,
}

/// Result of a disposal operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisposalResult {
    /// Per-lot consumption details.
    pub details: Vec<DisposalDetail>,
    /// Total realized gain/loss across all consumed lots (minor units).
    pub total_realized_gain_loss_minor: i64,
    /// Total cost basis consumed (minor units).
    pub total_cost_basis_minor: i64,
    /// Total proceeds (minor units, echoed from input).
    pub total_proceeds_minor: i64,
}

/// Summary of lots for an asset in a wallet.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LotSummary {
    /// Asset identifier.
    pub asset_id: String,
    /// Wallet address.
    pub wallet_id: String,
    /// Total remaining quantity across all open lots.
    pub total_remaining_quantity: String,
    /// Total cost basis of open lots (minor units).
    pub total_cost_basis_minor: i64,
    /// Number of open lots.
    pub open_lot_count: i64,
}

// ============================================================================
// Lot Selector Trait — Method Abstraction
// ============================================================================

/// Defines the order in which lots are selected for consumption.
/// Only FIFO is implemented now; LIFO/HIFO can be added later.
pub trait LotSelector: Send + Sync {
    /// Returns the SQL ORDER BY clause for selecting lots.
    fn order_clause(&self) -> &'static str;
    /// Returns the method name for labeling (used by future methods).
    #[allow(dead_code)]
    fn method_name(&self) -> &'static str;
}

/// First-In, First-Out: oldest lots consumed first.
pub struct FifoSelector;

impl LotSelector for FifoSelector {
    fn order_clause(&self) -> &'static str {
        "acquired_date ASC, id ASC"
    }
    fn method_name(&self) -> &'static str {
        "FIFO"
    }
}

// ============================================================================
// Internal Engine Functions
// ============================================================================

/// Computes proportional cost basis for a consumed quantity from a lot.
///
/// Formula: `(quantity_consumed / lot_quantity) * lot_cost_basis_minor`
///
/// Uses exact `rust_decimal` arithmetic and rounds to the nearest integer
/// (half-away-from-zero) for the final minor-unit result.
fn proportional_cost_basis(
    quantity_consumed: Decimal,
    lot_quantity: Decimal,
    lot_cost_basis_minor: i64,
) -> Result<i64, String> {
    if lot_quantity.is_zero() {
        return Err("Lot quantity is zero; cannot compute proportional cost basis".to_string());
    }
    let basis_decimal = Decimal::from(lot_cost_basis_minor);
    let proportion = quantity_consumed
        .checked_div(lot_quantity)
        .ok_or("Division overflow in proportional cost basis")?;
    let result = proportion
        .checked_mul(basis_decimal)
        .ok_or("Multiplication overflow in proportional cost basis")?;
    result
        .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
        .ok_or_else(|| "Proportional cost basis overflows i64".to_string())
}

/// Verifies that a journal entry exists and is `posted`.
///
/// Every lot event that references a journal entry must reference a POSTED
/// entry — lots derive from the posted ledger, never from drafts (the
/// draft → approved → posted lifecycle is the approval gate).
async fn verify_journal_entry_posted<'e, E>(executor: E, je_id: i64) -> Result<(), String>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let status: Option<(String,)> =
        sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
            .bind(je_id)
            .fetch_optional(executor)
            .await
            .map_err(|e| e.to_string())?;
    match status {
        Some((s,)) if s == "posted" => Ok(()),
        Some((s,)) => Err(format!(
            "Journal entry {je_id} is '{s}', must be 'posted' to record a lot event"
        )),
        None => Err(format!("Journal entry {je_id} not found")),
    }
}

/// Computes holding period in days between two ISO 8601 dates.
fn holding_period_days(acquired_date: &str, event_date: &str) -> Result<i64, String> {
    let acq = NaiveDate::parse_from_str(acquired_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid acquired_date '{acquired_date}': {e}"))?;
    let evt = NaiveDate::parse_from_str(event_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid event_date '{event_date}': {e}"))?;
    Ok((evt - acq).num_days())
}

/// Parses a lot's `remaining_quantity` and `quantity` into exact decimals.
fn lot_quantities(lot: &CostBasisLot) -> Result<(Decimal, Decimal), String> {
    let remaining = Decimal::from_str(&lot.remaining_quantity)
        .map_err(|e| format!("Invalid remaining_quantity in lot {}: {e}", lot.id))?;
    let quantity = Decimal::from_str(&lot.quantity)
        .map_err(|e| format!("Invalid quantity in lot {}: {e}", lot.id))?;
    Ok((remaining, quantity))
}

/// Parses and validates a positive decimal quantity from input.
fn parse_positive_quantity(raw: &str) -> Result<Decimal, String> {
    let qty = Decimal::from_str(raw).map_err(|e| format!("Invalid quantity '{raw}': {e}"))?;
    if qty <= Decimal::ZERO {
        return Err("Quantity must be positive".to_string());
    }
    Ok(qty)
}

/// Fetches open lots for an asset+wallet inside the transaction (in the
/// given selection order) and verifies the total remaining quantity covers
/// `needed`.
async fn fetch_open_lots_checked(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    asset_id: &str,
    wallet_id: &str,
    order: &str,
    needed: Decimal,
    op: &str,
) -> Result<Vec<CostBasisLot>, String> {
    let query = format!(
        "SELECT * FROM cost_basis_lots WHERE asset_id = ? AND wallet_id = ? AND is_closed = 0 ORDER BY {order}"
    );
    let lots = sqlx::query_as::<_, CostBasisLot>(&query)
        .bind(asset_id)
        .bind(wallet_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

    let mut total_available = Decimal::ZERO;
    for lot in &lots {
        total_available += lot_quantities(lot)?.0;
    }
    if total_available < needed {
        return Err(format!(
            "Insufficient lots for {op}: need {needed} but only {total_available} available for asset '{asset_id}' in wallet '{wallet_id}'"
        ));
    }
    Ok(lots)
}

/// Applies the conditional consumption UPDATE to a source lot.
///
/// The UPDATE is keyed on the `remaining_quantity` that was read: if a
/// concurrent writer consumed from this lot between our SELECT and this
/// UPDATE, 0 rows match, we error, and the whole transaction rolls back
/// (no read-check-write double-spend).
async fn update_lot_remaining(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    lot: &CostBasisLot,
    new_remaining: Decimal,
    op: &str,
) -> Result<(), String> {
    let is_closed = if new_remaining.is_zero() { 1 } else { 0 };
    let updated = sqlx::query(
        "UPDATE cost_basis_lots SET remaining_quantity = ?, is_closed = ? WHERE id = ? AND remaining_quantity = ? AND is_closed = 0",
    )
    .bind(new_remaining.to_string())
    .bind(is_closed)
    .bind(lot.id)
    .bind(&lot.remaining_quantity)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    if updated.rows_affected() != 1 {
        return Err(format!(
            "Lot {} was modified concurrently; {op} aborted and rolled back",
            lot.id
        ));
    }
    Ok(())
}

/// Allocates proceeds to a consumed portion: proportional
/// `(take / total_qty) × total_proceeds` with MidpointAwayFromZero rounding.
fn allocate_proceeds(
    take: Decimal,
    total_qty: Decimal,
    total_proceeds: i64,
) -> Result<i64, String> {
    let proportion = take
        .checked_div(total_qty)
        .ok_or("Division overflow in proceeds allocation")?;
    let alloc = proportion
        .checked_mul(Decimal::from(total_proceeds))
        .ok_or("Multiplication overflow in proceeds allocation")?;
    alloc
        .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
        .ok_or_else(|| "Proceeds allocation overflows i64".to_string())
}

/// Consumes `take` from a lot for a disposal: conditional lot update,
/// consumption record insert, and the per-lot `DisposalDetail`.
async fn consume_lot_for_disposal(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    lot: &CostBasisLot,
    take: Decimal,
    lot_remaining: Decimal,
    lot_quantity: Decimal,
    portion_proceeds: i64,
    input: &DisposeLotInput,
) -> Result<DisposalDetail, String> {
    let portion_cost = proportional_cost_basis(take, lot_quantity, lot.cost_basis_minor)?;
    let realized = portion_proceeds - portion_cost;
    let days = holding_period_days(&lot.acquired_date, &input.disposal_date)?;
    let long_term = days >= 365;

    update_lot_remaining(tx, lot, lot_remaining - take, "disposal").await?;

    sqlx::query(
        r#"
        INSERT INTO lot_consumptions (
            lot_id, quantity_consumed, cost_basis_minor, proceeds_minor,
            realized_gain_loss_minor, event_type, journal_entry_id,
            event_date, holding_period_days, is_long_term
        )
        VALUES (?, ?, ?, ?, ?, 'disposal', ?, ?, ?, ?)
        "#,
    )
    .bind(lot.id)
    .bind(take.to_string())
    .bind(portion_cost)
    .bind(portion_proceeds)
    .bind(realized)
    .bind(input.journal_entry_id)
    .bind(&input.disposal_date)
    .bind(days)
    .bind(if long_term { 1 } else { 0 })
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    Ok(DisposalDetail {
        lot_id: lot.id,
        quantity_consumed: take.to_string(),
        cost_basis_minor: portion_cost,
        proceeds_minor: portion_proceeds,
        realized_gain_loss_minor: realized,
        holding_period_days: days,
        is_long_term: long_term,
    })
}

/// Moves `take` from a source lot to a destination wallet for a transfer:
/// conditional source update, destination lot insert preserving
/// acquired_date and proportional cost basis, and the transfer consumption
/// record. Returns the destination lot id.
async fn move_lot_portion(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    lot: &CostBasisLot,
    take: Decimal,
    lot_remaining: Decimal,
    lot_quantity: Decimal,
    input: &TransferLotInput,
) -> Result<i64, String> {
    let portion_cost = proportional_cost_basis(take, lot_quantity, lot.cost_basis_minor)?;

    update_lot_remaining(tx, lot, lot_remaining - take, "transfer").await?;

    // Create destination lot preserving acquired_date and cost basis
    let dest_result = sqlx::query(
        r#"
        INSERT INTO cost_basis_lots (
            asset_id, wallet_id, acquired_date, quantity, remaining_quantity,
            cost_basis_minor, cost_basis_method, journal_entry_id
        )
        VALUES (?, ?, ?, ?, ?, ?, 'FIFO', ?)
        "#,
    )
    .bind(&input.asset_id)
    .bind(&input.to_wallet_id)
    .bind(&lot.acquired_date) // preserve original acquired_date
    .bind(take.to_string())
    .bind(take.to_string())
    .bind(portion_cost) // preserve proportional cost basis
    .bind(input.journal_entry_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    let dest_lot_id = dest_result.last_insert_rowid();
    let days = holding_period_days(&lot.acquired_date, &input.transfer_date)?;

    // Record consumption (transfer type — no realization)
    sqlx::query(
        r#"
        INSERT INTO lot_consumptions (
            lot_id, quantity_consumed, cost_basis_minor, proceeds_minor,
            realized_gain_loss_minor, event_type, destination_lot_id,
            journal_entry_id, event_date, holding_period_days, is_long_term
        )
        VALUES (?, ?, ?, 0, 0, 'transfer', ?, ?, ?, ?, ?)
        "#,
    )
    .bind(lot.id)
    .bind(take.to_string())
    .bind(portion_cost)
    .bind(dest_lot_id)
    .bind(input.journal_entry_id)
    .bind(&input.transfer_date)
    .bind(days)
    .bind(if days >= 365 { 1 } else { 0 })
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    Ok(dest_lot_id)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Records a new acquisition by opening a lot.
///
/// Call this after a posted journal entry debiting the digital-asset account.
/// The lot records the wallet, asset, quantity, and cost basis for future
/// FIFO consumption on disposal.
#[tauri::command]
pub async fn acquire_lot(
    state: State<'_, DatabaseState>,
    input: AcquireLotInput,
) -> Result<CostBasisLot, String> {
    acquire_lot_impl(&state.pool, &input).await
}

/// Pool-level acquisition engine (testable without Tauri `State`).
pub(crate) async fn acquire_lot_impl(
    pool: &sqlx::SqlitePool,
    input: &AcquireLotInput,
) -> Result<CostBasisLot, String> {
    // Validate quantity
    let qty = Decimal::from_str(&input.quantity)
        .map_err(|e| format!("Invalid quantity '{}': {e}", input.quantity))?;
    if qty <= Decimal::ZERO {
        return Err("Quantity must be positive".to_string());
    }

    // Validate date
    NaiveDate::parse_from_str(&input.acquired_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid acquired_date '{}': {e}", input.acquired_date))?;

    // Validate cost basis is non-negative
    if input.cost_basis_minor < 0 {
        return Err("Cost basis must be non-negative".to_string());
    }

    // If journal_entry_id provided, verify it is posted
    if let Some(je_id) = input.journal_entry_id {
        verify_journal_entry_posted(pool, je_id).await?;
    }

    let qty_str = qty.to_string();

    let result = sqlx::query(
        r#"
        INSERT INTO cost_basis_lots (
            asset_id, wallet_id, acquired_date, quantity, remaining_quantity,
            cost_basis_minor, cost_basis_method, journal_entry_id
        )
        VALUES (?, ?, ?, ?, ?, ?, 'FIFO', ?)
        "#,
    )
    .bind(&input.asset_id)
    .bind(&input.wallet_id)
    .bind(&input.acquired_date)
    .bind(&qty_str)
    .bind(&qty_str)
    .bind(input.cost_basis_minor)
    .bind(input.journal_entry_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let lot_id = result.last_insert_rowid();

    sqlx::query_as::<_, CostBasisLot>("SELECT * FROM cost_basis_lots WHERE id = ?")
        .bind(lot_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

/// Disposes of an asset quantity using FIFO lot selection, computing
/// realized gain/loss for each consumed lot.
///
/// Call this after posting a journal entry for the sale/swap. The engine:
/// 1. Selects open lots for the asset+wallet in FIFO order.
/// 2. Consumes lots until the disposal quantity is fulfilled.
/// 3. Records per-lot consumption with proportional cost basis.
/// 4. Computes realized gain/loss = proceeds − cost basis per lot portion.
///
/// Returns the detailed consumption breakdown and total realized gain/loss,
/// from which the caller builds the gain/loss journal entry lines. Those
/// entries go through the normal draft → approved → posted lifecycle; the
/// engine itself never writes to the ledger.
#[tauri::command]
pub async fn dispose_lots(
    state: State<'_, DatabaseState>,
    input: DisposeLotInput,
) -> Result<DisposalResult, String> {
    let selector = FifoSelector;
    dispose_lots_with_method(&state.pool, &input, &selector).await
}

/// Internal disposal engine parameterized by lot-selection method.
pub(crate) async fn dispose_lots_with_method(
    pool: &sqlx::SqlitePool,
    input: &DisposeLotInput,
    selector: &dyn LotSelector,
) -> Result<DisposalResult, String> {
    let dispose_qty = parse_positive_quantity(&input.quantity)?;

    NaiveDate::parse_from_str(&input.disposal_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid disposal_date '{}': {e}", input.disposal_date))?;

    if input.proceeds_minor < 0 {
        return Err("Proceeds must be non-negative".to_string());
    }

    // ONE transaction for the entire disposal — atomicity ensures no
    // partial consumption if a later lot fails or there is insufficient
    // quantity.
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // Lots derive only from posted entries (approval gate).
    if let Some(je_id) = input.journal_entry_id {
        verify_journal_entry_posted(&mut *tx, je_id).await?;
    }

    let lots = fetch_open_lots_checked(
        &mut tx,
        &input.asset_id,
        &input.wallet_id,
        selector.order_clause(),
        dispose_qty,
        "disposal",
    )
    .await?;

    let mut remaining_to_dispose = dispose_qty;
    let mut remaining_proceeds = input.proceeds_minor;
    let mut details = Vec::new();
    let mut total_cost_basis = 0i64;

    for lot in &lots {
        if remaining_to_dispose.is_zero() {
            break;
        }

        let (lot_remaining, lot_quantity) = lot_quantities(lot)?;

        // Take as much as we need or as much as the lot has
        let take = remaining_to_dispose.min(lot_remaining);
        let next_remaining = remaining_to_dispose - take;

        // Proceeds allocation: proportional per lot; the LAST lot receives
        // all remaining proceeds to avoid rounding drift.
        let portion_proceeds = if next_remaining.is_zero() {
            remaining_proceeds
        } else {
            allocate_proceeds(take, dispose_qty, input.proceeds_minor)?
        };

        let detail = consume_lot_for_disposal(
            &mut tx,
            lot,
            take,
            lot_remaining,
            lot_quantity,
            portion_proceeds,
            input,
        )
        .await?;

        total_cost_basis += detail.cost_basis_minor;
        remaining_proceeds -= detail.proceeds_minor;
        details.push(detail);
        remaining_to_dispose = next_remaining;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    let total_realized = input.proceeds_minor - total_cost_basis;

    Ok(DisposalResult {
        details,
        total_realized_gain_loss_minor: total_realized,
        total_cost_basis_minor: total_cost_basis,
        total_proceeds_minor: input.proceeds_minor,
    })
}

/// Transfers lots between own wallets WITHOUT realization.
///
/// The source lots are consumed in FIFO order, and new lots are created
/// in the destination wallet preserving the original cost basis and
/// acquired date. No gain/loss is realized.
#[tauri::command]
pub async fn transfer_lots(
    state: State<'_, DatabaseState>,
    input: TransferLotInput,
) -> Result<Vec<CostBasisLot>, String> {
    transfer_lots_impl(&state.pool, &input).await
}

/// Pool-level transfer engine (testable without Tauri `State`).
pub(crate) async fn transfer_lots_impl(
    pool: &sqlx::SqlitePool,
    input: &TransferLotInput,
) -> Result<Vec<CostBasisLot>, String> {
    let transfer_qty = parse_positive_quantity(&input.quantity)?;

    NaiveDate::parse_from_str(&input.transfer_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid transfer_date '{}': {e}", input.transfer_date))?;

    if input.from_wallet_id == input.to_wallet_id {
        return Err("Source and destination wallets must be different".to_string());
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // Lots derive only from posted entries (approval gate).
    if let Some(je_id) = input.journal_entry_id {
        verify_journal_entry_posted(&mut *tx, je_id).await?;
    }

    let lots = fetch_open_lots_checked(
        &mut tx,
        &input.asset_id,
        &input.from_wallet_id,
        FifoSelector.order_clause(),
        transfer_qty,
        "transfer",
    )
    .await?;

    let mut remaining_to_transfer = transfer_qty;
    let mut new_lot_ids = Vec::new();

    for lot in &lots {
        if remaining_to_transfer.is_zero() {
            break;
        }

        let (lot_remaining, lot_quantity) = lot_quantities(lot)?;
        let take = remaining_to_transfer.min(lot_remaining);

        let dest_lot_id =
            move_lot_portion(&mut tx, lot, take, lot_remaining, lot_quantity, input).await?;

        new_lot_ids.push(dest_lot_id);
        remaining_to_transfer -= take;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    // Return the new destination lots
    let mut result = Vec::new();
    for lot_id in new_lot_ids {
        let lot = sqlx::query_as::<_, CostBasisLot>("SELECT * FROM cost_basis_lots WHERE id = ?")
            .bind(lot_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
        result.push(lot);
    }

    Ok(result)
}

/// Returns all open (non-closed) lots for a given asset and wallet.
#[tauri::command]
pub async fn get_open_lots(
    state: State<'_, DatabaseState>,
    asset_id: String,
    wallet_id: String,
) -> Result<Vec<CostBasisLot>, String> {
    sqlx::query_as::<_, CostBasisLot>(
        "SELECT * FROM cost_basis_lots WHERE asset_id = ? AND wallet_id = ? AND is_closed = 0 ORDER BY acquired_date ASC, id ASC",
    )
    .bind(&asset_id)
    .bind(&wallet_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Returns a summary of lots per asset per wallet.
#[tauri::command]
pub async fn get_lot_summary(
    state: State<'_, DatabaseState>,
    asset_id: Option<String>,
    wallet_id: Option<String>,
) -> Result<Vec<LotSummary>, String> {
    // Build query with optional filters
    let mut query = String::from(
        "SELECT asset_id, wallet_id, remaining_quantity, cost_basis_minor FROM cost_basis_lots WHERE is_closed = 0",
    );
    let mut binds: Vec<String> = Vec::new();

    if let Some(ref a) = asset_id {
        query.push_str(" AND asset_id = ?");
        binds.push(a.clone());
    }
    if let Some(ref w) = wallet_id {
        query.push_str(" AND wallet_id = ?");
        binds.push(w.clone());
    }
    query.push_str(" ORDER BY asset_id, wallet_id, acquired_date ASC");

    #[derive(FromRow)]
    struct RawRow {
        asset_id: String,
        wallet_id: String,
        remaining_quantity: String,
        cost_basis_minor: i64,
    }

    let mut q = sqlx::query_as::<_, RawRow>(&query);
    for b in &binds {
        q = q.bind(b);
    }

    let rows = q.fetch_all(&state.pool).await.map_err(|e| e.to_string())?;

    // Aggregate in Rust with exact decimal
    let mut map: std::collections::BTreeMap<(String, String), (Decimal, i64, i64)> =
        std::collections::BTreeMap::new();

    for row in &rows {
        let key = (row.asset_id.clone(), row.wallet_id.clone());
        let entry = map.entry(key).or_insert((Decimal::ZERO, 0, 0));
        let qty = Decimal::from_str(&row.remaining_quantity).unwrap_or(Decimal::ZERO);
        entry.0 += qty;
        entry.1 += row.cost_basis_minor;
        entry.2 += 1;
    }

    let result = map
        .into_iter()
        .map(|((asset_id, wallet_id), (qty, basis, count))| LotSummary {
            asset_id,
            wallet_id,
            total_remaining_quantity: qty.to_string(),
            total_cost_basis_minor: basis,
            open_lot_count: count,
        })
        .collect();

    Ok(result)
}

/// Returns consumption history for a given lot.
#[tauri::command]
pub async fn get_lot_consumptions(
    state: State<'_, DatabaseState>,
    lot_id: i64,
) -> Result<Vec<LotConsumption>, String> {
    sqlx::query_as::<_, LotConsumption>(
        "SELECT * FROM lot_consumptions WHERE lot_id = ? ORDER BY event_date ASC, id ASC",
    )
    .bind(lot_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

/// Returns all realized gains/losses within a date range.
#[tauri::command]
pub async fn get_realized_gains_losses(
    state: State<'_, DatabaseState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<LotConsumption>, String> {
    NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date: {e}"))?;
    NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date: {e}"))?;

    sqlx::query_as::<_, LotConsumption>(
        "SELECT * FROM lot_consumptions WHERE event_type = 'disposal' AND event_date >= ? AND event_date <= ? ORDER BY event_date ASC, id ASC",
    )
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
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

    /// Helper: insert a lot directly for testing.
    async fn insert_lot(
        pool: &SqlitePool,
        asset_id: &str,
        wallet_id: &str,
        acquired_date: &str,
        quantity: &str,
        cost_basis_minor: i64,
    ) -> i64 {
        let result = sqlx::query(
            r#"
            INSERT INTO cost_basis_lots (
                asset_id, wallet_id, acquired_date, quantity, remaining_quantity,
                cost_basis_minor, cost_basis_method
            )
            VALUES (?, ?, ?, ?, ?, ?, 'FIFO')
            "#,
        )
        .bind(asset_id)
        .bind(wallet_id)
        .bind(acquired_date)
        .bind(quantity)
        .bind(quantity)
        .bind(cost_basis_minor)
        .execute(pool)
        .await
        .expect("Failed to insert test lot");

        result.last_insert_rowid()
    }

    /// Helper: run a transfer through the real engine path.
    async fn run_transfer(
        pool: &SqlitePool,
        asset_id: &str,
        from_wallet_id: &str,
        to_wallet_id: &str,
        transfer_date: &str,
        quantity: &str,
    ) -> Vec<CostBasisLot> {
        let input = TransferLotInput {
            asset_id: asset_id.to_string(),
            from_wallet_id: from_wallet_id.to_string(),
            to_wallet_id: to_wallet_id.to_string(),
            transfer_date: transfer_date.to_string(),
            quantity: quantity.to_string(),
            journal_entry_id: None,
        };
        transfer_lots_impl(pool, &input)
            .await
            .expect("Transfer should succeed")
    }

    /// Helper: run a disposal directly against the pool.
    async fn run_disposal(
        pool: &SqlitePool,
        asset_id: &str,
        wallet_id: &str,
        disposal_date: &str,
        quantity: &str,
        proceeds_minor: i64,
    ) -> DisposalResult {
        let input = DisposeLotInput {
            asset_id: asset_id.to_string(),
            wallet_id: wallet_id.to_string(),
            disposal_date: disposal_date.to_string(),
            quantity: quantity.to_string(),
            proceeds_minor,
            journal_entry_id: None,
        };
        let selector = FifoSelector;
        dispose_lots_with_method(pool, &input, &selector)
            .await
            .expect("Disposal should succeed")
    }

    // ---- proportional_cost_basis ----

    #[test]
    fn proportional_cost_basis_full_lot() {
        // Consuming the entire lot returns the full cost basis
        let result = proportional_cost_basis(
            Decimal::from(10),
            Decimal::from(10),
            10000, // $100.00
        )
        .unwrap();
        assert_eq!(result, 10000);
    }

    #[test]
    fn proportional_cost_basis_half_lot() {
        // Consuming half the lot returns half the cost basis
        let result = proportional_cost_basis(
            Decimal::from(5),
            Decimal::from(10),
            10000, // $100.00
        )
        .unwrap();
        assert_eq!(result, 5000);
    }

    #[test]
    fn proportional_cost_basis_one_third() {
        // 1/3 of a lot: cost basis $100.00 → $33.33 (rounds to 3333 cents)
        let result = proportional_cost_basis(Decimal::from(1), Decimal::from(3), 10000).unwrap();
        assert_eq!(result, 3333);
    }

    #[test]
    fn proportional_cost_basis_rounding() {
        // 2/3 of $100.00 = 6666.666... → rounds to 6667 (half away from zero)
        let result = proportional_cost_basis(Decimal::from(2), Decimal::from(3), 10000).unwrap();
        assert_eq!(result, 6667);
    }

    #[test]
    fn proportional_cost_basis_zero_lot_errors() {
        let result = proportional_cost_basis(Decimal::from(1), Decimal::ZERO, 10000);
        assert!(result.is_err());
    }

    // ---- holding_period_days ----

    #[test]
    fn holding_period_same_day() {
        assert_eq!(holding_period_days("2026-01-15", "2026-01-15").unwrap(), 0);
    }

    #[test]
    fn holding_period_one_year() {
        assert_eq!(
            holding_period_days("2025-01-15", "2026-01-15").unwrap(),
            365
        );
    }

    #[test]
    fn holding_period_short_term() {
        assert_eq!(
            holding_period_days("2026-01-15", "2026-06-15").unwrap(),
            151
        );
    }

    // ---- FIFO disposal: buy, buy, sell ----

    #[tokio::test]
    async fn fifo_buy_buy_sell_realized_gain() {
        let pool = setup_test_db().await;

        // Buy 10 ETH at $100 each ($1000 total) on Jan 1
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // Buy 5 ETH at $200 each ($1000 total) on Feb 1
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-02-01", "5", 100000).await;

        // Sell 12 ETH at $250 each ($3000 total) on Jul 1
        let result = run_disposal(&pool, "token:ETH", "wallet-A", "2025-07-01", "12", 300000).await;

        // FIFO: first lot fully consumed (10 ETH at $100), then 2 ETH from second lot
        assert_eq!(result.details.len(), 2);

        // First lot: 10 ETH, cost $1000, proceeds proportional
        assert_eq!(result.details[0].quantity_consumed, "10");
        assert_eq!(result.details[0].cost_basis_minor, 100000);
        // Proportional proceeds: (10/12) * 300000 = 250000
        assert_eq!(result.details[0].proceeds_minor, 250000);
        assert_eq!(result.details[0].realized_gain_loss_minor, 150000); // $1500 gain
        assert_eq!(result.details[0].holding_period_days, 181); // Jan 1 → Jul 1
        assert!(!result.details[0].is_long_term);

        // Second lot: 2 ETH, cost proportional (2/5 * $1000 = $400)
        assert_eq!(result.details[1].quantity_consumed, "2");
        assert_eq!(result.details[1].cost_basis_minor, 40000);
        // Remaining proceeds: 300000 - 250000 = 50000
        assert_eq!(result.details[1].proceeds_minor, 50000);
        assert_eq!(result.details[1].realized_gain_loss_minor, 10000); // $100 gain
        assert_eq!(result.details[1].holding_period_days, 150); // Feb 1 → Jul 1

        // Totals
        assert_eq!(result.total_cost_basis_minor, 140000); // $1400
        assert_eq!(result.total_proceeds_minor, 300000); // $3000
        assert_eq!(result.total_realized_gain_loss_minor, 160000); // $1600 gain

        // Verify lot states
        let lot1: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(lot1.remaining_quantity, "0");
        assert_eq!(lot1.is_closed, 1);

        let lot2: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = 2")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(lot2.remaining_quantity, "3");
        assert_eq!(lot2.is_closed, 0);
    }

    // ---- Insufficient lots ----

    #[tokio::test]
    async fn disposal_insufficient_lots_errors() {
        let pool = setup_test_db().await;

        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "5", 50000).await;

        let input = DisposeLotInput {
            asset_id: "token:ETH".to_string(),
            wallet_id: "wallet-A".to_string(),
            disposal_date: "2025-07-01".to_string(),
            quantity: "10".to_string(),
            proceeds_minor: 100000,
            journal_entry_id: None,
        };
        let result = dispose_lots_with_method(&pool, &input, &FifoSelector).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Insufficient lots"));
    }

    // ---- Transfer between own wallets ----

    #[tokio::test]
    async fn transfer_preserves_cost_basis_and_acquired_date() {
        let pool = setup_test_db().await;

        // Buy 10 ETH at $100 each on Jan 1 in wallet-A
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // Transfer 4 ETH from wallet-A to wallet-B on Mar 1 (real engine path)
        run_transfer(
            &pool,
            "token:ETH",
            "wallet-A",
            "wallet-B",
            "2025-03-01",
            "4",
        )
        .await;

        // Verify source lot: 6 ETH remaining
        let src_lot: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(src_lot.remaining_quantity, "6");
        assert_eq!(src_lot.is_closed, 0);

        // Verify destination lot: 4 ETH with same acquired_date and proportional cost
        let dest_lot: CostBasisLot =
            sqlx::query_as("SELECT * FROM cost_basis_lots WHERE wallet_id = 'wallet-B'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(dest_lot.quantity, "4");
        assert_eq!(dest_lot.remaining_quantity, "4");
        assert_eq!(dest_lot.acquired_date, "2025-01-01"); // preserved!
        assert_eq!(dest_lot.cost_basis_minor, 40000); // 4/10 * $1000 = $400
        assert_eq!(dest_lot.is_closed, 0);

        // Verify consumption record is a transfer (no realization)
        let consumption: LotConsumption =
            sqlx::query_as("SELECT * FROM lot_consumptions WHERE lot_id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(consumption.event_type, "transfer");
        assert_eq!(consumption.proceeds_minor, 0);
        assert_eq!(consumption.realized_gain_loss_minor, 0);
        assert_eq!(consumption.destination_lot_id, Some(dest_lot.id));
    }

    // ---- Full acceptance test: buy, buy, transfer, sell ----

    #[tokio::test]
    async fn acceptance_buy_buy_transfer_sell() {
        let pool = setup_test_db().await;

        // === Step 1: Buy 10 ETH at $100/ea ($1000) in wallet-A on Jan 1 ===
        let lot1_id = insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // === Step 2: Buy 5 ETH at $200/ea ($1000) in wallet-A on Feb 1 ===
        let lot2_id = insert_lot(&pool, "token:ETH", "wallet-A", "2025-02-01", "5", 100000).await;

        // === Step 3: Transfer 8 ETH from wallet-A to wallet-B on Mar 1 ===
        // FIFO: 8 ETH taken from lot1 (which has 10) — real engine path.
        run_transfer(
            &pool,
            "token:ETH",
            "wallet-A",
            "wallet-B",
            "2025-03-01",
            "8",
        )
        .await;

        // Verify after transfer:
        // wallet-A: lot1 has 2 ETH remaining (cost 2/10 * $1000 = $200 remaining basis)
        //           lot2 has 5 ETH remaining (cost $1000)
        // wallet-B: 8 ETH from lot1 (acquired Jan 1, cost 8/10 * $1000 = $800)
        let src_lot1: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = ?")
            .bind(lot1_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(src_lot1.remaining_quantity, "2");

        let src_lot2: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = ?")
            .bind(lot2_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(src_lot2.remaining_quantity, "5");

        let dest_lots: Vec<CostBasisLot> = sqlx::query_as(
            "SELECT * FROM cost_basis_lots WHERE wallet_id = 'wallet-B' ORDER BY id",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(dest_lots.len(), 1);
        assert_eq!(dest_lots[0].quantity, "8");
        assert_eq!(dest_lots[0].acquired_date, "2025-01-01"); // preserved
        assert_eq!(dest_lots[0].cost_basis_minor, 80000); // $800

        // === Step 4: Sell 6 ETH from wallet-B at $300/ea ($1800) on Aug 1 ===
        let disposal = run_disposal(
            &pool,
            "token:ETH",
            "wallet-B",
            "2025-08-01",
            "6",
            180000, // $1800
        )
        .await;

        // wallet-B has one lot with 8 ETH at cost $800 (acquired Jan 1)
        // Selling 6: cost basis = 6/8 * $800 = $600
        // Proceeds = $1800
        // Realized gain = $1800 - $600 = $1200
        assert_eq!(disposal.details.len(), 1);
        assert_eq!(disposal.details[0].quantity_consumed, "6");
        assert_eq!(disposal.details[0].cost_basis_minor, 60000); // $600
        assert_eq!(disposal.details[0].proceeds_minor, 180000); // $1800
        assert_eq!(disposal.details[0].realized_gain_loss_minor, 120000); // $1200 gain

        // Holding period: Jan 1 to Aug 1 = 212 days
        assert_eq!(disposal.details[0].holding_period_days, 212);
        assert!(!disposal.details[0].is_long_term); // < 365

        assert_eq!(disposal.total_realized_gain_loss_minor, 120000);
        assert_eq!(disposal.total_cost_basis_minor, 60000);
        assert_eq!(disposal.total_proceeds_minor, 180000);

        // Verify remaining: wallet-B has 2 ETH left
        let remaining_lot: CostBasisLot = sqlx::query_as(
            "SELECT * FROM cost_basis_lots WHERE wallet_id = 'wallet-B' AND is_closed = 0",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(remaining_lot.remaining_quantity, "2");
        assert_eq!(remaining_lot.is_closed, 0);
    }

    // ---- Long-term holding ----

    #[tokio::test]
    async fn long_term_holding_detection() {
        let pool = setup_test_db().await;

        // Buy on Jan 1 2025
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // Sell on Jan 2 2026 (366 days later)
        let result = run_disposal(&pool, "token:ETH", "wallet-A", "2026-01-02", "5", 75000).await;

        assert_eq!(result.details[0].holding_period_days, 366);
        assert!(result.details[0].is_long_term);
    }

    // ---- Exact consumption: full lot disposal closes lot ----

    #[tokio::test]
    async fn full_lot_disposal_closes_lot() {
        let pool = setup_test_db().await;

        let lot_id = insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        let _result =
            run_disposal(&pool, "token:ETH", "wallet-A", "2025-07-01", "10", 200000).await;

        let lot: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = ?")
            .bind(lot_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(lot.remaining_quantity, "0");
        assert_eq!(lot.is_closed, 1);
    }

    // ---- Multiple partial disposals ----

    #[tokio::test]
    async fn multiple_partial_disposals() {
        let pool = setup_test_db().await;

        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // First disposal: sell 3
        let r1 = run_disposal(&pool, "token:ETH", "wallet-A", "2025-03-01", "3", 45000).await;
        assert_eq!(r1.total_cost_basis_minor, 30000); // 3/10 * $1000
        assert_eq!(r1.total_realized_gain_loss_minor, 15000); // $450 - $300

        // Second disposal: sell 4
        let r2 = run_disposal(&pool, "token:ETH", "wallet-A", "2025-06-01", "4", 80000).await;
        assert_eq!(r2.total_cost_basis_minor, 40000); // 4/10 * $1000
        assert_eq!(r2.total_realized_gain_loss_minor, 40000); // $800 - $400

        // Remaining: 3 ETH
        let lot: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(lot.remaining_quantity, "3");
    }

    // ---- Consumption records are append-only ----

    #[tokio::test]
    async fn consumption_records_are_append_only() {
        let pool = setup_test_db().await;

        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        run_disposal(&pool, "token:ETH", "wallet-A", "2025-03-01", "3", 45000).await;
        run_disposal(&pool, "token:ETH", "wallet-A", "2025-06-01", "4", 80000).await;

        let consumptions: Vec<LotConsumption> =
            sqlx::query_as("SELECT * FROM lot_consumptions ORDER BY id")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert_eq!(consumptions.len(), 2);
        assert_eq!(consumptions[0].quantity_consumed, "3");
        assert_eq!(consumptions[0].event_type, "disposal");
        assert_eq!(consumptions[1].quantity_consumed, "4");
        assert_eq!(consumptions[1].event_type, "disposal");
    }

    // ---- Transfer does not realize gain ----

    #[tokio::test]
    async fn transfer_no_realization() {
        let pool = setup_test_db().await;

        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // Transfer through the real engine path
        let dest_lots = run_transfer(
            &pool,
            "token:ETH",
            "wallet-A",
            "wallet-B",
            "2025-03-01",
            "4",
        )
        .await;
        let dest_id = dest_lots[0].id;

        // Verify NO realization
        let consumptions: Vec<LotConsumption> =
            sqlx::query_as("SELECT * FROM lot_consumptions WHERE event_type = 'transfer'")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(consumptions.len(), 1);
        assert_eq!(consumptions[0].realized_gain_loss_minor, 0);
        assert_eq!(consumptions[0].proceeds_minor, 0);

        // Verify destination lot has correct cost basis
        let dest_lot: CostBasisLot = sqlx::query_as("SELECT * FROM cost_basis_lots WHERE id = ?")
            .bind(dest_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(dest_lot.cost_basis_minor, 40000); // 4/10 * $1000
        assert_eq!(dest_lot.acquired_date, "2025-01-01"); // preserved
    }

    // ---- Sub-decimal quantities (18 decimals) ----

    #[tokio::test]
    async fn subdecimal_quantity_precision() {
        let pool = setup_test_db().await;

        // Buy 0.000000000000000001 ETH (1 wei) at $1
        insert_lot(
            &pool,
            "token:ETH",
            "wallet-A",
            "2025-01-01",
            "0.000000000000000001",
            100,
        )
        .await;

        // Sell it
        let result = run_disposal(
            &pool,
            "token:ETH",
            "wallet-A",
            "2025-07-01",
            "0.000000000000000001",
            200,
        )
        .await;

        assert_eq!(result.details[0].quantity_consumed, "0.000000000000000001");
        assert_eq!(result.details[0].cost_basis_minor, 100);
        assert_eq!(result.details[0].realized_gain_loss_minor, 100);
    }

    // ---- Lifecycle gate: lot events only reference POSTED journal entries ----

    /// Helper: insert a journal entry with a given status.
    async fn insert_journal_entry(pool: &SqlitePool, status: &str) -> i64 {
        let result = sqlx::query(
            "INSERT INTO journal_entries (entry_date, description, status, is_posted) VALUES ('2025-01-01', 'test', ?, 0)",
        )
        .bind(status)
        .execute(pool)
        .await
        .expect("Failed to insert test journal entry");
        result.last_insert_rowid()
    }

    #[tokio::test]
    async fn dispose_rejects_unposted_journal_entry() {
        let pool = setup_test_db().await;
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;
        let draft_je = insert_journal_entry(&pool, "draft").await;

        let input = DisposeLotInput {
            asset_id: "token:ETH".to_string(),
            wallet_id: "wallet-A".to_string(),
            disposal_date: "2025-07-01".to_string(),
            quantity: "5".to_string(),
            proceeds_minor: 100000,
            journal_entry_id: Some(draft_je),
        };
        let err = dispose_lots_with_method(&pool, &input, &FifoSelector)
            .await
            .unwrap_err();
        assert!(err.contains("must be 'posted'"), "unexpected error: {err}");

        // Nothing consumed
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM lot_consumptions")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count.0, 0);
    }

    #[tokio::test]
    async fn transfer_rejects_unposted_journal_entry() {
        let pool = setup_test_db().await;
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;
        let draft_je = insert_journal_entry(&pool, "draft").await;

        let input = TransferLotInput {
            asset_id: "token:ETH".to_string(),
            from_wallet_id: "wallet-A".to_string(),
            to_wallet_id: "wallet-B".to_string(),
            transfer_date: "2025-03-01".to_string(),
            quantity: "4".to_string(),
            journal_entry_id: Some(draft_je),
        };
        let err = transfer_lots_impl(&pool, &input).await.unwrap_err();
        assert!(err.contains("must be 'posted'"), "unexpected error: {err}");
    }

    // ---- DB-layer append-only / immutability enforcement (Inv-7) ----

    #[tokio::test]
    async fn lot_consumptions_are_append_only_at_db_layer() {
        let pool = setup_test_db().await;
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;
        run_disposal(&pool, "token:ETH", "wallet-A", "2025-03-01", "3", 45000).await;

        // UPDATE is rejected by trigger
        let upd =
            sqlx::query("UPDATE lot_consumptions SET realized_gain_loss_minor = 0 WHERE id = 1")
                .execute(&pool)
                .await;
        assert!(upd.is_err());
        assert!(upd.unwrap_err().to_string().contains("append-only"));

        // DELETE is rejected by trigger
        let del = sqlx::query("DELETE FROM lot_consumptions WHERE id = 1")
            .execute(&pool)
            .await;
        assert!(del.is_err());
        assert!(del.unwrap_err().to_string().contains("append-only"));
    }

    #[tokio::test]
    async fn lots_cannot_be_deleted_and_core_columns_are_immutable() {
        let pool = setup_test_db().await;
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        // DELETE rejected
        let del = sqlx::query("DELETE FROM cost_basis_lots WHERE id = 1")
            .execute(&pool)
            .await;
        assert!(del.is_err());

        // Rewriting acquisition facts rejected
        let upd = sqlx::query("UPDATE cost_basis_lots SET cost_basis_minor = 1 WHERE id = 1")
            .execute(&pool)
            .await;
        assert!(upd.is_err());
        assert!(upd.unwrap_err().to_string().contains("immutable"));

        // Running-balance columns remain updatable (engine path)
        let ok = sqlx::query(
            "UPDATE cost_basis_lots SET remaining_quantity = '5', is_closed = 0 WHERE id = 1",
        )
        .execute(&pool)
        .await;
        assert!(ok.is_ok());
    }

    #[tokio::test]
    async fn conditional_lot_update_rejects_stale_remaining_quantity() {
        // SQL-semantics check for the anti-double-spend guard: an UPDATE keyed
        // on a stale remaining_quantity must affect 0 rows.
        let pool = setup_test_db().await;
        insert_lot(&pool, "token:ETH", "wallet-A", "2025-01-01", "10", 100000).await;

        let stale = sqlx::query(
            "UPDATE cost_basis_lots SET remaining_quantity = '0', is_closed = 1 WHERE id = 1 AND remaining_quantity = '7' AND is_closed = 0",
        )
        .execute(&pool)
        .await
        .unwrap();
        assert_eq!(stale.rows_affected(), 0);

        let fresh = sqlx::query(
            "UPDATE cost_basis_lots SET remaining_quantity = '0', is_closed = 1 WHERE id = 1 AND remaining_quantity = '10' AND is_closed = 0",
        )
        .execute(&pool)
        .await
        .unwrap();
        assert_eq!(fresh.rows_affected(), 1);
    }
}
