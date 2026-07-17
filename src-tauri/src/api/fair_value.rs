//! Fair-value measurement engine — ASU 2023-08 remeasurement (Phase 8, GIV-690).
//!
//! # Design
//!
//! - **Period-end remeasurement.** At each period close, the engine marks all
//!   in-scope digital-asset holdings to fair value by generating **draft**
//!   adjusting entries (unrealized gain/loss through net income per ASU 2023-08).
//! - **Configurable price source behind a trait.** `PriceSource` defines how
//!   fair-value prices are obtained. One concrete provider (`CoinGeckoPriceSource`)
//!   uses the existing CoinGecko integration; manual overrides are always
//!   available and take precedence.
//! - **Append-only provenance.** Every price observation (API or manual) is
//!   recorded in `price_observations`; every remeasurement run and its generated
//!   entries are recorded in `remeasurement_runs` / `remeasurement_entries`.
//!   DB triggers prevent UPDATE/DELETE on all three tables (Inv-7).
//! - **Draft → approved → posted approval gate.** Generated entries go through
//!   the standard approval queue (§5). The system never posts silently.
//! - **Exact arithmetic only.** Quantities are `rust_decimal::Decimal`; amounts
//!   are `i64` minor units. No floats in the money path (Inv-2).

use chrono::NaiveDate;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use std::str::FromStr;

use super::price_feeds::CoinGeckoClient;

// ============================================================================
// PriceSource Trait
// ============================================================================

/// A source of fair-value prices for digital assets.
///
/// Implementors fetch the price of a given asset on a given date in the
/// functional currency (USD). The returned price is a decimal string that
/// the caller converts to minor units at the accounting boundary.
#[async_trait::async_trait]
pub trait PriceSource: Send + Sync {
    /// Returns the price per unit as a decimal string (e.g. "42350.50")
    /// for the given CoinGecko coin ID on the given date (DD-MM-YYYY format).
    ///
    /// Returns `None` if the source has no price for the asset on that date.
    async fn get_price(&self, coin_id: &str, date: &str) -> Result<Option<String>, String>;

    /// The source name recorded in `price_observations.source`.
    #[allow(dead_code)]
    fn source_name(&self) -> &'static str;
}

// ============================================================================
// CoinGecko Price Source
// ============================================================================

/// Fetches prices from the CoinGecko historical API.
pub struct CoinGeckoPriceSource {
    client: CoinGeckoClient,
}

impl CoinGeckoPriceSource {
    /// Creates a new CoinGecko price source.
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            client: CoinGeckoClient::new(api_key),
        }
    }
}

#[async_trait::async_trait]
impl PriceSource for CoinGeckoPriceSource {
    async fn get_price(&self, coin_id: &str, date: &str) -> Result<Option<String>, String> {
        match self.client.get_historical_price(coin_id, date, "usd").await {
            Ok(price) => Ok(Some(price)),
            Err(e) => {
                let msg = e.to_string();
                // "not found" from CoinGecko means no data, not a failure
                if msg.contains("not found") {
                    Ok(None)
                } else {
                    Err(msg)
                }
            }
        }
    }

    fn source_name(&self) -> &'static str {
        "coingecko"
    }
}

// ============================================================================
// Types — serde structs are camelCase for Tauri v2
// ============================================================================

/// A recorded price observation (read from DB).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PriceObservation {
    /// Row ID.
    pub id: i64,
    /// Asset identifier (matches cost_basis_lots.asset_id).
    pub asset_id: String,
    /// Date the price applies to (ISO 8601 YYYY-MM-DD).
    pub price_date: String,
    /// Price per unit in functional-currency minor units (USD cents).
    pub price_minor: i64,
    /// Raw decimal price string from the source (full precision, audit).
    pub price_decimal: String,
    /// Price source ('coingecko', 'manual').
    pub source: String,
    /// CoinGecko coin ID for API sources; NULL for manual overrides.
    pub source_coin_id: Option<String>,
    /// Real authed user who recorded the price (never 'system').
    pub recorded_by: String,
    /// Optional note (manual overrides) explaining the price source.
    pub note: Option<String>,
    /// Immutable audit timestamp.
    pub created_at: String,
}

/// Input for recording a manual price override.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualPriceInput {
    /// Asset identifier (matches cost_basis_lots.asset_id).
    pub asset_id: String,
    /// Date the price applies to (ISO 8601 YYYY-MM-DD).
    pub price_date: String,
    /// Price per unit as a decimal string (e.g. "42350.50").
    pub price_decimal: String,
    /// The user recording this override (real authed user).
    pub recorded_by: String,
    /// Optional note explaining the price source.
    pub note: Option<String>,
}

/// Input for running a remeasurement.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemeasurementInput {
    /// The period-end date (ISO 8601 YYYY-MM-DD).
    pub run_date: String,
    /// The user initiating the remeasurement.
    pub initiated_by: String,
    /// GL account ID for "Unrealized gain on digital assets" (credit on gain).
    pub unrealized_gain_account_id: i64,
    /// GL account ID for "Unrealized loss on digital assets" (debit on loss).
    pub unrealized_loss_account_id: i64,
    /// Optional: map of asset_id -> CoinGecko coin_id for API lookups.
    /// Assets not in this map (and without a manual override) will be skipped.
    pub asset_coin_map: Option<std::collections::HashMap<String, String>>,
    /// Optional CoinGecko API key.
    pub api_key: Option<String>,
}

/// A remeasurement run record (read from DB).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RemeasurementRun {
    /// Row ID.
    pub id: i64,
    /// The period-end date remeasured (ISO 8601 YYYY-MM-DD).
    pub run_date: String,
    /// Real authed user who initiated the run.
    pub initiated_by: String,
    /// Holdings actually remeasured (priced), incl. zero-change ones.
    pub holdings_count: i64,
    /// Draft journal entries generated by this run.
    pub entries_generated: i64,
    /// Net unrealized gain/loss in minor units (positive = gain).
    pub total_unrealized_gain_loss_minor: i64,
    /// 'completed', or 'partial' if some assets had no price.
    pub status: String,
    /// Immutable audit timestamp.
    pub created_at: String,
}

/// A remeasurement entry detail (read from DB).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RemeasurementEntry {
    /// Row ID.
    pub id: i64,
    /// FK to the remeasurement run.
    pub run_id: i64,
    /// FK to the generated draft journal entry.
    pub journal_entry_id: i64,
    /// Asset remeasured.
    pub asset_id: String,
    /// Wallet holding the asset.
    pub wallet_id: String,
    /// FK to the price observation used.
    pub price_observation_id: i64,
    /// Carrying amount before remeasurement (minor units).
    pub carrying_amount_minor: i64,
    /// Fair value at remeasurement (minor units).
    pub fair_value_minor: i64,
    /// fair_value − carrying_amount (minor units).
    pub unrealized_gain_loss_minor: i64,
    /// Immutable audit timestamp.
    pub created_at: String,
}

/// Result of a remeasurement run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemeasurementResult {
    /// The run audit record.
    pub run: RemeasurementRun,
    /// Per-holding remeasurement details for this run.
    pub entries: Vec<RemeasurementEntry>,
    /// Assets that were skipped because no price was available.
    pub skipped_assets: Vec<String>,
    /// Holdings ("asset_id@wallet_id") skipped because a non-voided
    /// remeasurement entry already exists for the same run date
    /// (idempotency guard — re-running a date never duplicates drafts).
    pub already_remeasured: Vec<String>,
}

/// Holding summary used internally for remeasurement.
struct HoldingSummary {
    asset_id: String,
    wallet_id: String,
    total_remaining_quantity: Decimal,
    total_cost_basis_minor: i64,
}

// ============================================================================
// Price Decimal → Minor Unit Conversion
// ============================================================================

/// Converts a price decimal string to minor units (cents) for a given quantity.
///
/// fair_value_minor = quantity × price_per_unit, rounded to nearest cent
/// (MidpointAwayFromZero, matching the cost basis convention).
fn fair_value_to_minor(quantity: Decimal, price_decimal: &str) -> Result<i64, String> {
    let price = Decimal::from_str(price_decimal)
        .map_err(|e| format!("Invalid price decimal '{price_decimal}': {e}"))?;
    let cents_per_dollar = Decimal::from(100);
    let value = quantity
        .checked_mul(price)
        .ok_or("Overflow multiplying quantity × price")?
        .checked_mul(cents_per_dollar)
        .ok_or("Overflow converting to minor units")?;
    value
        .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
        .ok_or_else(|| "Fair value overflows i64 minor units".to_string())
}

/// Converts a price decimal string to minor units per single unit.
fn price_to_minor(price_decimal: &str) -> Result<i64, String> {
    fair_value_to_minor(Decimal::ONE, price_decimal)
}

// ============================================================================
// Pool-level impl functions (testable without Tauri State)
// ============================================================================

/// Records a manual price override.
///
/// Inserts into `price_observations` with source='manual'. The observation
/// is append-only (DB triggers prevent UPDATE/DELETE).
pub async fn record_manual_price_impl(
    pool: &SqlitePool,
    input: &ManualPriceInput,
) -> Result<PriceObservation, String> {
    // Validate date
    NaiveDate::parse_from_str(&input.price_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid price_date '{}': {e}", input.price_date))?;

    // Validate price decimal
    let _price = Decimal::from_str(&input.price_decimal)
        .map_err(|e| format!("Invalid price_decimal '{}': {e}", input.price_decimal))?;

    // Convert to minor units
    let price_minor = price_to_minor(&input.price_decimal)?;

    let result = sqlx::query(
        r#"
        INSERT INTO price_observations (
            asset_id, price_date, price_minor, price_decimal,
            source, source_coin_id, recorded_by, note
        )
        VALUES (?, ?, ?, ?, 'manual', NULL, ?, ?)
        "#,
    )
    .bind(&input.asset_id)
    .bind(&input.price_date)
    .bind(price_minor)
    .bind(&input.price_decimal)
    .bind(&input.recorded_by)
    .bind(&input.note)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let obs_id = result.last_insert_rowid();

    sqlx::query_as::<_, PriceObservation>("SELECT * FROM price_observations WHERE id = ?")
        .bind(obs_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

/// Returns price observations for an asset on a date, most recent first.
pub async fn get_price_observations_impl(
    pool: &SqlitePool,
    asset_id: &str,
    price_date: &str,
) -> Result<Vec<PriceObservation>, String> {
    sqlx::query_as::<_, PriceObservation>(
        "SELECT * FROM price_observations WHERE asset_id = ? AND price_date = ? ORDER BY created_at DESC",
    )
    .bind(asset_id)
    .bind(price_date)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

/// Fetches the latest price observation for an asset on a date.
/// Manual overrides take precedence (returned first when tie-breaking by created_at).
async fn get_latest_price(
    pool: &SqlitePool,
    asset_id: &str,
    price_date: &str,
) -> Result<Option<PriceObservation>, String> {
    // Manual prices take precedence: order by source='manual' DESC, then created_at DESC
    sqlx::query_as::<_, PriceObservation>(
        r#"
        SELECT * FROM price_observations
        WHERE asset_id = ? AND price_date = ?
        ORDER BY CASE WHEN source = 'manual' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1
        "#,
    )
    .bind(asset_id)
    .bind(price_date)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())
}

/// Fetches holdings (open lots) grouped by asset+wallet using the same
/// aggregation logic as `get_lot_summary`.
async fn get_holdings(pool: &SqlitePool) -> Result<Vec<HoldingSummary>, String> {
    #[derive(FromRow)]
    struct RawRow {
        asset_id: String,
        wallet_id: String,
        remaining_quantity: String,
        cost_basis_minor: i64,
    }

    let rows = sqlx::query_as::<_, RawRow>(
        "SELECT asset_id, wallet_id, remaining_quantity, cost_basis_minor FROM cost_basis_lots WHERE is_closed = 0 ORDER BY asset_id, wallet_id",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut map: std::collections::BTreeMap<(String, String), (Decimal, i64)> =
        std::collections::BTreeMap::new();

    for row in &rows {
        let key = (row.asset_id.clone(), row.wallet_id.clone());
        let entry = map.entry(key).or_insert((Decimal::ZERO, 0));
        let qty = Decimal::from_str(&row.remaining_quantity).unwrap_or(Decimal::ZERO);
        entry.0 += qty;
        entry.1 += row.cost_basis_minor;
    }

    Ok(map
        .into_iter()
        .filter(|(_, (qty, _))| *qty > Decimal::ZERO)
        .map(
            |((asset_id, wallet_id), (total_remaining_quantity, total_cost_basis_minor))| {
                HoldingSummary {
                    asset_id,
                    wallet_id,
                    total_remaining_quantity,
                    total_cost_basis_minor,
                }
            },
        )
        .collect())
}

/// Pushes `value` into `list` if not already present.
fn push_unique(list: &mut Vec<String>, value: &str) {
    if !list.iter().any(|v| v == value) {
        list.push(value.to_string());
    }
}

/// Step 1 of remeasurement: make sure a price observation exists for every
/// holding on `run_date`, fetching from the configured `PriceSource` where
/// an asset→coin mapping is provided.
///
/// Deliberately runs OUTSIDE the accounting transaction:
/// - network I/O must never hold the SQLite write lock, and
/// - price observations are provenance (Inv-7): once fetched they are
///   recorded even if the accounting phase later fails.
///
/// Returns the list of asset_ids with no price available (skipped).
async fn ensure_price_observations(
    pool: &SqlitePool,
    holdings: &[HoldingSummary],
    input: &RemeasurementInput,
    cg_date: &str,
) -> Result<Vec<String>, String> {
    let cg_source = input
        .asset_coin_map
        .as_ref()
        .map(|_| CoinGeckoPriceSource::new(input.api_key.clone()));
    let asset_coin_map = input.asset_coin_map.as_ref().cloned().unwrap_or_default();

    let mut skipped_assets: Vec<String> = Vec::new();

    for holding in holdings {
        if get_latest_price(pool, &holding.asset_id, &input.run_date)
            .await?
            .is_some()
        {
            continue;
        }

        // No price yet — try to fetch from CoinGecko if mapped
        let (Some(coin_id), Some(source)) =
            (asset_coin_map.get(&holding.asset_id), cg_source.as_ref())
        else {
            push_unique(&mut skipped_assets, &holding.asset_id);
            continue;
        };

        match source.get_price(coin_id, cg_date).await {
            Ok(Some(price_str)) => {
                let pm = price_to_minor(&price_str)?;
                sqlx::query(
                    r#"
                    INSERT INTO price_observations (
                        asset_id, price_date, price_minor, price_decimal,
                        source, source_coin_id, recorded_by, note
                    )
                    VALUES (?, ?, ?, ?, 'coingecko', ?, ?, NULL)
                    "#,
                )
                .bind(&holding.asset_id)
                .bind(&input.run_date)
                .bind(pm)
                .bind(&price_str)
                .bind(coin_id)
                .bind(&input.initiated_by)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
            }
            Ok(None) => push_unique(&mut skipped_assets, &holding.asset_id),
            Err(e) => {
                return Err(format!(
                    "Failed to fetch price for '{}' (coin: {coin_id}): {e}",
                    holding.asset_id
                ));
            }
        }
    }

    Ok(skipped_assets)
}

type SqliteTx<'a> = sqlx::Transaction<'a, sqlx::Sqlite>;

/// Returns true if a non-voided remeasurement journal entry already exists
/// for this asset+wallet on `run_date` (idempotency guard).
async fn has_remeasurement_for_date(
    tx: &mut SqliteTx<'_>,
    asset_id: &str,
    wallet_id: &str,
    run_date: &str,
) -> Result<bool, String> {
    let dup: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM remeasurement_entries re
        INNER JOIN journal_entries je ON je.id = re.journal_entry_id
        WHERE re.asset_id = ? AND re.wallet_id = ?
          AND je.entry_date = ? AND je.status != 'voided'
        "#,
    )
    .bind(asset_id)
    .bind(wallet_id)
    .bind(run_date)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(dup.0 > 0)
}

/// Net unrealized gain/loss of prior POSTED remeasurement entries for the
/// asset+wallet. Voided entries are excluded (their reversing entries net
/// them out of the GL).
async fn prior_posted_adjustment(
    tx: &mut SqliteTx<'_>,
    asset_id: &str,
    wallet_id: &str,
) -> Result<i64, String> {
    let prior: (i64,) = sqlx::query_as(
        r#"
        SELECT COALESCE(SUM(re.unrealized_gain_loss_minor), 0)
        FROM remeasurement_entries re
        INNER JOIN journal_entries je ON je.id = re.journal_entry_id
        WHERE re.asset_id = ? AND re.wallet_id = ?
          AND je.status = 'posted'
        "#,
    )
    .bind(asset_id)
    .bind(wallet_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(prior.0)
}

/// Finds the digital-asset GL account for an asset: the Asset-type account
/// debited for it in posted entries. Returns None if the asset was never
/// acquired through the journal engine.
async fn find_asset_account(tx: &mut SqliteTx<'_>, asset_id: &str) -> Result<Option<i64>, String> {
    let row: Option<(i64,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT jel.gl_account_id
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
        INNER JOIN gl_accounts ga ON ga.id = jel.gl_account_id
        WHERE jel.asset_id = ?
          AND je.status IN ('posted', 'voided')
          AND ga.account_type = 'Asset'
          AND jel.debit_minor > 0
        LIMIT 1
        "#,
    )
    .bind(asset_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(row.map(|(id,)| id))
}

/// Inserts one journal entry line. Exactly one of debit_minor/credit_minor
/// is non-zero; the legacy f64 display columns mirror the authoritative
/// minor units (same convention as the accounting.rs create path).
#[allow(clippy::too_many_arguments)]
async fn insert_je_line(
    tx: &mut SqliteTx<'_>,
    entry_id: i64,
    gl_account_id: i64,
    debit_minor: i64,
    credit_minor: i64,
    asset_id: Option<&str>,
    description: &str,
    line_number: i64,
) -> Result<(), String> {
    sqlx::query(
        r#"
        INSERT INTO journal_entry_lines (
            journal_entry_id, gl_account_id, token_id,
            debit_amount, credit_amount,
            debit_minor, credit_minor,
            quantity, asset_id,
            description, line_number
        )
        VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)
        "#,
    )
    .bind(entry_id)
    .bind(gl_account_id)
    .bind(debit_minor as f64 / 100.0)
    .bind(credit_minor as f64 / 100.0)
    .bind(debit_minor)
    .bind(credit_minor)
    .bind(asset_id)
    .bind(description)
    .bind(line_number)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Creates the draft adjusting journal entry for one holding:
/// - Gain (unrealized > 0): Dr Digital Assets / Cr Unrealized Gain.
/// - Loss (unrealized < 0): Dr Unrealized Loss / Cr Digital Assets.
///
/// Returns the new journal entry ID.
async fn create_draft_adjusting_entry(
    tx: &mut SqliteTx<'_>,
    input: &RemeasurementInput,
    holding: &HoldingSummary,
    asset_acct_id: i64,
    unrealized: i64,
) -> Result<i64, String> {
    // Known pre-existing debt (tracker): COUNT(*)+1 entry numbers can
    // collide after deletes — same convention as the create path.
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let entry_number = format!("JE-{:06}", count.0 + 1);

    let direction = if unrealized > 0 { "gain" } else { "loss" };
    let description = format!(
        "ASU 2023-08 fair-value remeasurement: unrealized {direction} on {} ({}) as of {}",
        holding.asset_id, holding.wallet_id, input.run_date
    );

    let entry_result = sqlx::query(
        r#"
        INSERT INTO journal_entries (
            entry_date, entry_number, description, reference_number,
            is_posted, status, origin, created_by
        )
        VALUES (?, ?, ?, NULL, 0, 'draft', 'rule', ?)
        "#,
    )
    .bind(&input.run_date)
    .bind(&entry_number)
    .bind(&description)
    .bind(&input.initiated_by)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    let entry_id = entry_result.last_insert_rowid();
    let amount = unrealized.unsigned_abs() as i64;

    if unrealized > 0 {
        insert_je_line(
            tx,
            entry_id,
            asset_acct_id,
            amount,
            0,
            Some(&holding.asset_id),
            "Fair-value adjustment (ASU 2023-08)",
            1,
        )
        .await?;
        insert_je_line(
            tx,
            entry_id,
            input.unrealized_gain_account_id,
            0,
            amount,
            None,
            "Unrealized gain on digital assets (ASU 2023-08)",
            2,
        )
        .await?;
    } else {
        insert_je_line(
            tx,
            entry_id,
            input.unrealized_loss_account_id,
            amount,
            0,
            None,
            "Unrealized loss on digital assets (ASU 2023-08)",
            1,
        )
        .await?;
        insert_je_line(
            tx,
            entry_id,
            asset_acct_id,
            0,
            amount,
            Some(&holding.asset_id),
            "Fair-value adjustment (ASU 2023-08)",
            2,
        )
        .await?;
    }

    Ok(entry_id)
}

/// Core remeasurement engine.
///
/// For each holding (asset+wallet with open lots):
/// 1. Looks up the latest price observation for the asset on run_date.
///    If no price exists and the asset is in asset_coin_map, fetches from
///    CoinGecko and records the observation.
/// 2. Computes fair value = quantity × price_per_unit.
/// 3. Computes unrealized gain/loss = fair value − carrying amount (cost basis).
/// 4. If gain/loss ≠ 0, creates a draft adjusting journal entry:
///    - Gain: Dr Digital Assets (carrying → fair value), Cr Unrealized Gain
///    - Loss: Dr Unrealized Loss, Cr Digital Assets (carrying → fair value)
/// 5. Records the run and entry linkage in remeasurement_runs/entries.
pub async fn run_remeasurement_impl(
    pool: &SqlitePool,
    input: &RemeasurementInput,
) -> Result<RemeasurementResult, String> {
    // Validate date
    let run_date = NaiveDate::parse_from_str(&input.run_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid run_date '{}': {e}", input.run_date))?;

    // Convert to CoinGecko DD-MM-YYYY format for API calls
    let cg_date = run_date.format("%d-%m-%Y").to_string();

    let holdings = get_holdings(pool).await?;
    if holdings.is_empty() {
        // No holdings — create a no-op run record
        let result = sqlx::query(
            "INSERT INTO remeasurement_runs (run_date, initiated_by, holdings_count, entries_generated, total_unrealized_gain_loss_minor, status) VALUES (?, ?, 0, 0, 0, 'completed')",
        )
        .bind(&input.run_date)
        .bind(&input.initiated_by)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        let run_id = result.last_insert_rowid();
        let run =
            sqlx::query_as::<_, RemeasurementRun>("SELECT * FROM remeasurement_runs WHERE id = ?")
                .bind(run_id)
                .fetch_one(pool)
                .await
                .map_err(|e| e.to_string())?;

        return Ok(RemeasurementResult {
            run,
            entries: Vec::new(),
            skipped_assets: Vec::new(),
            already_remeasured: Vec::new(),
        });
    }

    let mut entries_generated = 0i64;
    let mut total_unrealized = 0i64;
    let mut remeasured_holdings = 0i64;
    let mut already_remeasured: Vec<String> = Vec::new();
    let mut remeasurement_entry_data: Vec<(i64, String, String, i64, i64, i64, i64)> = Vec::new();

    // Step 1: Ensure price observations exist (outside the accounting tx —
    // see ensure_price_observations for why).
    let mut skipped_assets = ensure_price_observations(pool, &holdings, input, &cg_date).await?;

    // Step 2: ONE transaction for the accounting writes (draft entries,
    // run record, entry linkage). All-or-nothing.
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    for holding in &holdings {
        if skipped_assets.contains(&holding.asset_id) {
            continue;
        }

        // Idempotency guard: re-running a period-end date must never create
        // duplicate draft adjustments (a duplicated draft that got
        // approved+posted would double-adjust the GL). Voided entries don't
        // count — voiding re-opens the slot.
        if has_remeasurement_for_date(
            &mut tx,
            &holding.asset_id,
            &holding.wallet_id,
            &input.run_date,
        )
        .await?
        {
            already_remeasured.push(format!("{}@{}", holding.asset_id, holding.wallet_id));
            continue;
        }

        let price_obs = sqlx::query_as::<_, PriceObservation>(
            r#"
            SELECT * FROM price_observations
            WHERE asset_id = ? AND price_date = ?
            ORDER BY CASE WHEN source = 'manual' THEN 0 ELSE 1 END, created_at DESC
            LIMIT 1
            "#,
        )
        .bind(&holding.asset_id)
        .bind(&input.run_date)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let Some(price_obs) = price_obs else {
            push_unique(&mut skipped_assets, &holding.asset_id);
            continue;
        };

        // Compute fair value = quantity × price (in minor units)
        let fv_minor =
            fair_value_to_minor(holding.total_remaining_quantity, &price_obs.price_decimal)?;

        // Carrying amount = cost basis of open lots PLUS the net effect of
        // prior POSTED remeasurement adjustments for this asset+wallet.
        // Under ASU 2023-08 the GL carries the asset at the fair value set
        // by the last posted remeasurement, not at original cost — using
        // raw cost here would re-recognize every prior period's gain/loss
        // on each subsequent run (double counting).
        let prior_adj =
            prior_posted_adjustment(&mut tx, &holding.asset_id, &holding.wallet_id).await?;
        let carrying = holding.total_cost_basis_minor + prior_adj;
        let unrealized = fv_minor - carrying;

        remeasured_holdings += 1;

        if unrealized == 0 {
            // No adjustment needed — but still counted as remeasured
            continue;
        }

        let Some(asset_acct_id) = find_asset_account(&mut tx, &holding.asset_id).await? else {
            // Never acquired through the journal engine — skip
            push_unique(&mut skipped_assets, &holding.asset_id);
            continue;
        };

        let entry_id =
            create_draft_adjusting_entry(&mut tx, input, holding, asset_acct_id, unrealized)
                .await?;

        entries_generated += 1;
        total_unrealized += unrealized;

        // Collect data for remeasurement_entries (inserted after run record)
        remeasurement_entry_data.push((
            entry_id,
            holding.asset_id.clone(),
            holding.wallet_id.clone(),
            price_obs.id,
            carrying,
            fv_minor,
            unrealized,
        ));
    }

    // Determine run status
    let status = if skipped_assets.is_empty() {
        "completed"
    } else {
        "partial"
    };

    // Count holdings actually remeasured (priced, incl. zero-change ones).
    // NOTE: holdings are per asset+wallet while skipped_assets is per asset,
    // so subtracting list lengths would miscount multi-wallet assets.
    let holdings_count = remeasured_holdings;

    // Insert remeasurement run
    let run_result = sqlx::query(
        r#"
        INSERT INTO remeasurement_runs (
            run_date, initiated_by, holdings_count, entries_generated,
            total_unrealized_gain_loss_minor, status
        )
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&input.run_date)
    .bind(&input.initiated_by)
    .bind(holdings_count)
    .bind(entries_generated)
    .bind(total_unrealized)
    .bind(status)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let run_id = run_result.last_insert_rowid();

    // Insert remeasurement entry linkage records
    for (entry_id, asset_id, wallet_id, obs_id, carrying, fv, unrealized) in
        &remeasurement_entry_data
    {
        sqlx::query(
            r#"
            INSERT INTO remeasurement_entries (
                run_id, journal_entry_id, asset_id, wallet_id,
                price_observation_id, carrying_amount_minor,
                fair_value_minor, unrealized_gain_loss_minor
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(run_id)
        .bind(entry_id)
        .bind(asset_id)
        .bind(wallet_id)
        .bind(obs_id)
        .bind(carrying)
        .bind(fv)
        .bind(unrealized)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    // Re-fetch from committed data
    let run =
        sqlx::query_as::<_, RemeasurementRun>("SELECT * FROM remeasurement_runs WHERE id = ?")
            .bind(run_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

    let entries = sqlx::query_as::<_, RemeasurementEntry>(
        "SELECT * FROM remeasurement_entries WHERE run_id = ? ORDER BY id",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(RemeasurementResult {
        run,
        entries,
        skipped_assets,
        already_remeasured,
    })
}

/// Returns all remeasurement runs, most recent first.
pub async fn list_remeasurement_runs_impl(
    pool: &SqlitePool,
) -> Result<Vec<RemeasurementRun>, String> {
    sqlx::query_as::<_, RemeasurementRun>(
        "SELECT * FROM remeasurement_runs ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

/// Returns entries for a specific remeasurement run.
pub async fn get_remeasurement_entries_impl(
    pool: &SqlitePool,
    run_id: i64,
) -> Result<Vec<RemeasurementEntry>, String> {
    sqlx::query_as::<_, RemeasurementEntry>(
        "SELECT * FROM remeasurement_entries WHERE run_id = ? ORDER BY id",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

// ============================================================================
// Tauri Commands
// ============================================================================

use crate::api::persistence::DatabaseState;
use tauri::State;

/// Records a manual price override for an asset on a given date.
///
/// The observation is recorded with source='manual' and the provided user
/// identity. Manual overrides take precedence over API-sourced prices in
/// remeasurement.
#[tauri::command]
pub async fn record_manual_price(
    state: State<'_, DatabaseState>,
    input: ManualPriceInput,
) -> Result<PriceObservation, String> {
    record_manual_price_impl(&state.pool, &input).await
}

/// Returns price observations for an asset on a date.
#[tauri::command]
pub async fn get_price_observations(
    state: State<'_, DatabaseState>,
    asset_id: String,
    price_date: String,
) -> Result<Vec<PriceObservation>, String> {
    get_price_observations_impl(&state.pool, &asset_id, &price_date).await
}

/// Runs the period-end fair-value remeasurement engine.
///
/// For each holding with an available price, generates a draft adjusting
/// journal entry for the unrealized gain/loss. Entries go through the
/// standard approval queue — the system never posts silently.
#[tauri::command]
pub async fn run_remeasurement(
    state: State<'_, DatabaseState>,
    input: RemeasurementInput,
) -> Result<RemeasurementResult, String> {
    run_remeasurement_impl(&state.pool, &input).await
}

/// Returns all remeasurement runs.
#[tauri::command]
pub async fn list_remeasurement_runs(
    state: State<'_, DatabaseState>,
) -> Result<Vec<RemeasurementRun>, String> {
    list_remeasurement_runs_impl(&state.pool).await
}

/// Returns entries for a specific remeasurement run.
#[tauri::command]
pub async fn get_remeasurement_entries(
    state: State<'_, DatabaseState>,
    run_id: i64,
) -> Result<Vec<RemeasurementEntry>, String> {
    get_remeasurement_entries_impl(&state.pool, run_id).await
}

/// Returns the latest price for an asset on a given date.
#[tauri::command]
pub async fn get_latest_asset_price(
    state: State<'_, DatabaseState>,
    asset_id: String,
    price_date: String,
) -> Result<Option<PriceObservation>, String> {
    get_latest_price(&state.pool, &asset_id, &price_date).await
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

    /// Helper: seed a GL account. Returns the account ID.
    async fn seed_account(pool: &SqlitePool, name: &str, account_type: &str) -> i64 {
        // Auto-generate a unique account number from the current count
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM gl_accounts")
            .fetch_one(pool)
            .await
            .expect("Failed to count accounts");
        let num = format!("{:04}", count.0 + 1);
        let result = sqlx::query(
            "INSERT INTO gl_accounts (account_number, account_name, account_type, is_active) VALUES (?, ?, ?, 1)",
        )
        .bind(&num)
        .bind(name)
        .bind(account_type)
        .execute(pool)
        .await
        .expect("Failed to seed account");
        result.last_insert_rowid()
    }

    /// Helper: seed a cost basis lot.
    async fn seed_lot(
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
        .expect("Failed to seed lot");
        result.last_insert_rowid()
    }

    /// Helper: seed a posted journal entry for an asset acquisition through
    /// the standard draft → approved → posted lifecycle (DB triggers enforce it).
    async fn seed_posted_entry(
        pool: &SqlitePool,
        asset_acct_id: i64,
        cash_acct_id: i64,
        asset_id: &str,
        amount_minor: i64,
        entry_date: &str,
    ) -> i64 {
        let amount_f = amount_minor as f64 / 100.0;

        // Count existing entries for unique entry_number
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
            .fetch_one(pool)
            .await
            .expect("count");
        let entry_number = format!("JE-{:06}", count.0 + 1);

        // Step 1: Create as draft (triggers enforce this)
        let entry = sqlx::query(
            r#"
            INSERT INTO journal_entries (
                entry_date, entry_number, description, is_posted, status, origin, created_by
            )
            VALUES (?, ?, 'Seed acquisition', 0, 'draft', 'manual', 'test@example.com')
            "#,
        )
        .bind(entry_date)
        .bind(&entry_number)
        .execute(pool)
        .await
        .expect("Failed to seed entry");
        let entry_id = entry.last_insert_rowid();

        // Debit asset account
        sqlx::query(
            r#"
            INSERT INTO journal_entry_lines (
                journal_entry_id, gl_account_id, token_id,
                debit_amount, credit_amount, debit_minor, credit_minor,
                quantity, asset_id, description, line_number
            )
            VALUES (?, ?, NULL, ?, 0.0, ?, 0, ?, ?, 'Acquire asset', 1)
            "#,
        )
        .bind(entry_id)
        .bind(asset_acct_id)
        .bind(amount_f)
        .bind(amount_minor)
        .bind("10")
        .bind(asset_id)
        .execute(pool)
        .await
        .expect("Failed to seed debit line");

        // Credit cash account
        sqlx::query(
            r#"
            INSERT INTO journal_entry_lines (
                journal_entry_id, gl_account_id, token_id,
                debit_amount, credit_amount, debit_minor, credit_minor,
                quantity, asset_id, description, line_number
            )
            VALUES (?, ?, NULL, 0.0, ?, 0, ?, NULL, NULL, 'Cash paid', 2)
            "#,
        )
        .bind(entry_id)
        .bind(cash_acct_id)
        .bind(amount_f)
        .bind(amount_minor)
        .execute(pool)
        .await
        .expect("Failed to seed credit line");

        // Step 2: Approve
        sqlx::query(
            "UPDATE journal_entries SET status = 'approved', approved_by = 'test@example.com', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("Failed to approve entry");

        // Step 3: Post
        sqlx::query(
            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("Failed to post entry");

        entry_id
    }

    // ---- price conversion ----

    #[test]
    fn fair_value_to_minor_basic() {
        // 10 units × $100.00 = $1,000.00 = 100_000 cents
        let result = fair_value_to_minor(Decimal::from(10), "100.00").unwrap();
        assert_eq!(result, 100_000);
    }

    #[test]
    fn fair_value_to_minor_fractional() {
        // 2.5 units × $42.50 = $106.25 = 10_625 cents
        let qty = Decimal::from_str("2.5").unwrap();
        let result = fair_value_to_minor(qty, "42.50").unwrap();
        assert_eq!(result, 10_625);
    }

    #[test]
    fn fair_value_to_minor_rounding() {
        // 1/3 unit × $10.00 = $3.333... → rounds to 333 cents
        let qty = Decimal::from_str("0.333333333333333333").unwrap();
        let result = fair_value_to_minor(qty, "10.00").unwrap();
        assert_eq!(result, 333);
    }

    #[test]
    fn price_to_minor_basic() {
        assert_eq!(price_to_minor("42350.50").unwrap(), 4_235_050);
    }

    // ---- manual price override ----

    #[tokio::test]
    async fn manual_price_records_observation() {
        let pool = setup_test_db().await;

        let input = ManualPriceInput {
            asset_id: "token:ETH".to_string(),
            price_date: "2026-06-30".to_string(),
            price_decimal: "3500.00".to_string(),
            recorded_by: "cfo@example.com".to_string(),
            note: Some("Bloomberg terminal quote".to_string()),
        };

        let obs = record_manual_price_impl(&pool, &input).await.unwrap();
        assert_eq!(obs.asset_id, "token:ETH");
        assert_eq!(obs.price_minor, 350_000);
        assert_eq!(obs.source, "manual");
        assert_eq!(obs.recorded_by, "cfo@example.com");
        assert!(obs.note.as_deref() == Some("Bloomberg terminal quote"));
    }

    #[tokio::test]
    async fn manual_price_takes_precedence() {
        let pool = setup_test_db().await;

        // Insert an API price first
        sqlx::query(
            "INSERT INTO price_observations (asset_id, price_date, price_minor, price_decimal, source, source_coin_id, recorded_by) VALUES ('token:ETH', '2026-06-30', 340000, '3400.00', 'coingecko', 'ethereum', 'user@example.com')",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Then a manual override
        let input = ManualPriceInput {
            asset_id: "token:ETH".to_string(),
            price_date: "2026-06-30".to_string(),
            price_decimal: "3500.00".to_string(),
            recorded_by: "cfo@example.com".to_string(),
            note: None,
        };
        record_manual_price_impl(&pool, &input).await.unwrap();

        // Latest price should be the manual one
        let latest = get_latest_price(&pool, "token:ETH", "2026-06-30")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(latest.source, "manual");
        assert_eq!(latest.price_minor, 350_000);
    }

    // ---- append-only triggers ----

    #[tokio::test]
    async fn price_observation_cannot_be_updated() {
        let pool = setup_test_db().await;

        sqlx::query(
            "INSERT INTO price_observations (asset_id, price_date, price_minor, price_decimal, source, recorded_by) VALUES ('token:ETH', '2026-06-30', 350000, '3500.00', 'manual', 'user@example.com')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let result = sqlx::query("UPDATE price_observations SET price_minor = 360000 WHERE id = 1")
            .execute(&pool)
            .await;

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("immutable") || err.contains("append-only"));
    }

    #[tokio::test]
    async fn price_observation_cannot_be_deleted() {
        let pool = setup_test_db().await;

        sqlx::query(
            "INSERT INTO price_observations (asset_id, price_date, price_minor, price_decimal, source, recorded_by) VALUES ('token:ETH', '2026-06-30', 350000, '3500.00', 'manual', 'user@example.com')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let result = sqlx::query("DELETE FROM price_observations WHERE id = 1")
            .execute(&pool)
            .await;

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("immutable")
                || err.contains("append-only")
                || err.contains("cannot be deleted")
        );
    }

    // ---- remeasurement engine: hand-computed fixtures ----

    #[tokio::test]
    async fn remeasurement_gain_fixture() {
        // Scenario: 10 ETH acquired at $3,000/ea = $30,000 cost basis.
        // Period-end price: $3,500/ea → FV = $35,000 → unrealized gain = $5,000.
        let pool = setup_test_db().await;

        let asset_acct = seed_account(&pool, "Digital Assets — ETH", "Asset").await;
        let cash_acct = seed_account(&pool, "Cash", "Asset").await;
        let gain_acct = seed_account(&pool, "Unrealized Gain on Digital Assets", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss on Digital Assets", "Expense").await;

        // Seed the acquisition entry (posted) so asset lookup works
        seed_posted_entry(
            &pool,
            asset_acct,
            cash_acct,
            "token:ETH",
            3_000_000,
            "2026-01-15",
        )
        .await;

        // Seed lot: 10 ETH @ $3,000 = $30,000
        seed_lot(
            &pool,
            "token:ETH",
            "0xWallet1",
            "2026-01-15",
            "10",
            3_000_000,
        )
        .await;

        // Record price at period end
        let price_input = ManualPriceInput {
            asset_id: "token:ETH".to_string(),
            price_date: "2026-06-30".to_string(),
            price_decimal: "3500.00".to_string(),
            recorded_by: "cfo@example.com".to_string(),
            note: Some("Hand-computed test fixture".to_string()),
        };
        record_manual_price_impl(&pool, &price_input).await.unwrap();

        // Run remeasurement
        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        // Verify run
        assert_eq!(result.run.status, "completed");
        assert_eq!(result.run.holdings_count, 1);
        assert_eq!(result.run.entries_generated, 1);
        // Unrealized gain: FV ($35,000) - carrying ($30,000) = $5,000 = 500,000 cents
        assert_eq!(result.run.total_unrealized_gain_loss_minor, 500_000);

        // Verify entry detail
        assert_eq!(result.entries.len(), 1);
        let entry = &result.entries[0];
        assert_eq!(entry.carrying_amount_minor, 3_000_000);
        assert_eq!(entry.fair_value_minor, 3_500_000);
        assert_eq!(entry.unrealized_gain_loss_minor, 500_000);

        // Verify the journal entry lines
        let lines: Vec<(i64, i64, i64, i64)> = sqlx::query_as(
            "SELECT gl_account_id, debit_minor, credit_minor, line_number FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
        )
        .bind(entry.journal_entry_id)
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(lines.len(), 2);
        // Line 1: Dr Digital Assets 500,000
        assert_eq!(lines[0].0, asset_acct);
        assert_eq!(lines[0].1, 500_000); // debit
        assert_eq!(lines[0].2, 0); // credit
                                   // Line 2: Cr Unrealized Gain 500,000
        assert_eq!(lines[1].0, gain_acct);
        assert_eq!(lines[1].1, 0); // debit
        assert_eq!(lines[1].2, 500_000); // credit

        // Verify the journal entry is a draft with origin='rule'
        let je: (String, String) =
            sqlx::query_as("SELECT status, origin FROM journal_entries WHERE id = ?")
                .bind(entry.journal_entry_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(je.0, "draft");
        assert_eq!(je.1, "rule");
    }

    #[tokio::test]
    async fn remeasurement_loss_fixture() {
        // Scenario: 5 DOT acquired at $8.00/ea = $40.00 cost basis.
        // Period-end price: $6.50/ea → FV = $32.50 → unrealized loss = $7.50.
        let pool = setup_test_db().await;

        let asset_acct = seed_account(&pool, "Digital Assets — DOT", "Asset").await;
        let cash_acct = seed_account(&pool, "Cash", "Asset").await;
        let gain_acct = seed_account(&pool, "Unrealized Gain on Digital Assets", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss on Digital Assets", "Expense").await;

        seed_posted_entry(
            &pool,
            asset_acct,
            cash_acct,
            "token:DOT",
            4_000,
            "2026-03-01",
        )
        .await;

        // Seed lot: 5 DOT @ $8.00 = $40.00 = 4,000 cents
        seed_lot(&pool, "token:DOT", "0xWallet1", "2026-03-01", "5", 4_000).await;

        // Record price at period end
        let price_input = ManualPriceInput {
            asset_id: "token:DOT".to_string(),
            price_date: "2026-06-30".to_string(),
            price_decimal: "6.50".to_string(),
            recorded_by: "cfo@example.com".to_string(),
            note: None,
        };
        record_manual_price_impl(&pool, &price_input).await.unwrap();

        // Run remeasurement
        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        assert_eq!(result.run.status, "completed");
        assert_eq!(result.run.entries_generated, 1);
        // Unrealized loss: FV ($32.50 = 3,250 cents) - carrying ($40.00 = 4,000 cents) = -750 cents
        assert_eq!(result.run.total_unrealized_gain_loss_minor, -750);

        let entry = &result.entries[0];
        assert_eq!(entry.carrying_amount_minor, 4_000);
        assert_eq!(entry.fair_value_minor, 3_250);
        assert_eq!(entry.unrealized_gain_loss_minor, -750);

        // Verify lines: loss entry
        let lines: Vec<(i64, i64, i64, i64)> = sqlx::query_as(
            "SELECT gl_account_id, debit_minor, credit_minor, line_number FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_number",
        )
        .bind(entry.journal_entry_id)
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(lines.len(), 2);
        // Line 1: Dr Unrealized Loss 750
        assert_eq!(lines[0].0, loss_acct);
        assert_eq!(lines[0].1, 750); // debit
        assert_eq!(lines[0].2, 0); // credit
                                   // Line 2: Cr Digital Assets 750
        assert_eq!(lines[1].0, asset_acct);
        assert_eq!(lines[1].1, 0); // debit
        assert_eq!(lines[1].2, 750); // credit
    }

    #[tokio::test]
    async fn remeasurement_no_change() {
        // Scenario: price equals carrying amount → no entry generated
        let pool = setup_test_db().await;

        let asset_acct = seed_account(&pool, "Digital Assets — ETH", "Asset").await;
        let cash_acct = seed_account(&pool, "Cash", "Asset").await;
        let gain_acct = seed_account(&pool, "Unrealized Gain", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss", "Expense").await;

        seed_posted_entry(
            &pool,
            asset_acct,
            cash_acct,
            "token:ETH",
            100_000,
            "2026-01-15",
        )
        .await;

        // 10 ETH @ $100 each = $1,000 = 100,000 cents
        seed_lot(&pool, "token:ETH", "0xWallet1", "2026-01-15", "10", 100_000).await;

        // Price at period end: $100/ea → FV = $1,000 = carrying amount
        let price_input = ManualPriceInput {
            asset_id: "token:ETH".to_string(),
            price_date: "2026-06-30".to_string(),
            price_decimal: "100.00".to_string(),
            recorded_by: "cfo@example.com".to_string(),
            note: None,
        };
        record_manual_price_impl(&pool, &price_input).await.unwrap();

        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        assert_eq!(result.run.entries_generated, 0);
        assert_eq!(result.run.total_unrealized_gain_loss_minor, 0);
        assert!(result.entries.is_empty());
    }

    #[tokio::test]
    async fn remeasurement_multiple_holdings() {
        // Scenario: two different assets, one gain, one loss
        let pool = setup_test_db().await;

        let eth_acct = seed_account(&pool, "Digital Assets — ETH", "Asset").await;
        let dot_acct = seed_account(&pool, "Digital Assets — DOT", "Asset").await;
        let cash_acct = seed_account(&pool, "Cash", "Asset").await;
        let gain_acct = seed_account(&pool, "Unrealized Gain", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss", "Expense").await;

        // ETH: 2 units @ $3,000 = $6,000 = 600,000 cents
        seed_posted_entry(
            &pool,
            eth_acct,
            cash_acct,
            "token:ETH",
            600_000,
            "2026-01-15",
        )
        .await;
        seed_lot(&pool, "token:ETH", "0xWallet1", "2026-01-15", "2", 600_000).await;

        // DOT: 100 units @ $7.00 = $700 = 70,000 cents
        seed_posted_entry(
            &pool,
            dot_acct,
            cash_acct,
            "token:DOT",
            70_000,
            "2026-02-01",
        )
        .await;
        seed_lot(&pool, "token:DOT", "0xWallet1", "2026-02-01", "100", 70_000).await;

        // Prices at period end
        // ETH: $3,200/ea → FV = 2 × 3200 = $6,400 → gain $400
        record_manual_price_impl(
            &pool,
            &ManualPriceInput {
                asset_id: "token:ETH".to_string(),
                price_date: "2026-06-30".to_string(),
                price_decimal: "3200.00".to_string(),
                recorded_by: "cfo@example.com".to_string(),
                note: None,
            },
        )
        .await
        .unwrap();

        // DOT: $5.50/ea → FV = 100 × 5.50 = $550 → loss $150
        record_manual_price_impl(
            &pool,
            &ManualPriceInput {
                asset_id: "token:DOT".to_string(),
                price_date: "2026-06-30".to_string(),
                price_decimal: "5.50".to_string(),
                recorded_by: "cfo@example.com".to_string(),
                note: None,
            },
        )
        .await
        .unwrap();

        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        assert_eq!(result.run.entries_generated, 2);
        assert_eq!(result.run.holdings_count, 2);
        // Net: 40,000 (gain) + (-15,000) (loss) = 25,000 cents
        assert_eq!(result.run.total_unrealized_gain_loss_minor, 25_000);
        assert!(result.skipped_assets.is_empty());
    }

    #[tokio::test]
    async fn remeasurement_no_holdings() {
        // No lots in the DB → run completes with 0 entries
        let pool = setup_test_db().await;

        let gain_acct = seed_account(&pool, "Unrealized Gain", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss", "Expense").await;

        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        assert_eq!(result.run.status, "completed");
        assert_eq!(result.run.holdings_count, 0);
        assert_eq!(result.run.entries_generated, 0);
    }

    #[tokio::test]
    async fn remeasurement_skips_unmapped_assets() {
        // Asset without a price observation or coin map → skipped, partial status
        let pool = setup_test_db().await;

        let asset_acct = seed_account(&pool, "Digital Assets — ETH", "Asset").await;
        let cash_acct = seed_account(&pool, "Cash", "Asset").await;
        let gain_acct = seed_account(&pool, "Unrealized Gain", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss", "Expense").await;

        seed_posted_entry(
            &pool,
            asset_acct,
            cash_acct,
            "token:ETH",
            100_000,
            "2026-01-15",
        )
        .await;
        seed_lot(&pool, "token:ETH", "0xWallet1", "2026-01-15", "10", 100_000).await;

        // No price recorded and no coin map → skipped
        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        assert_eq!(result.run.status, "partial");
        assert_eq!(result.run.entries_generated, 0);
        assert_eq!(result.skipped_assets, vec!["token:ETH"]);
    }

    #[tokio::test]
    async fn remeasurement_run_is_immutable() {
        let pool = setup_test_db().await;

        let gain_acct = seed_account(&pool, "Unrealized Gain", "Income").await;
        let loss_acct = seed_account(&pool, "Unrealized Loss", "Expense").await;

        let input = RemeasurementInput {
            run_date: "2026-06-30".to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        };

        let result = run_remeasurement_impl(&pool, &input).await.unwrap();

        // Try to update the run
        let update_result =
            sqlx::query("UPDATE remeasurement_runs SET status = 'partial' WHERE id = ?")
                .bind(result.run.id)
                .execute(&pool)
                .await;

        assert!(update_result.is_err());
    }

    // ---- review-hardening tests (GIV-690) ----

    /// Helper: push a draft entry through the approve → post funnel.
    /// Proves the remeasurement drafts survive the M3/M5 posting triggers.
    async fn approve_and_post(pool: &SqlitePool, entry_id: i64) {
        let approved = sqlx::query(
            "UPDATE journal_entries SET status = 'approved', approved_by = 'cfo@example.com', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("approve failed");
        assert_eq!(approved.rows_affected(), 1, "entry was not in draft");

        let posted = sqlx::query(
            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'",
        )
        .bind(entry_id)
        .execute(pool)
        .await
        .expect("post failed (balance/per-asset triggers?)");
        assert_eq!(posted.rows_affected(), 1, "entry was not approved");
    }

    /// Helper: standard ETH fixture — 10 ETH @ $3,000 = $30,000 cost basis,
    /// with the acquisition posted so the asset-account lookup works.
    /// Returns (asset_acct, gain_acct, loss_acct).
    async fn seed_eth_fixture(pool: &SqlitePool) -> (i64, i64, i64) {
        let asset_acct = seed_account(pool, "Digital Assets — ETH", "Asset").await;
        let cash_acct = seed_account(pool, "Cash", "Asset").await;
        let gain_acct = seed_account(pool, "Unrealized Gain", "Income").await;
        let loss_acct = seed_account(pool, "Unrealized Loss", "Expense").await;
        seed_posted_entry(
            pool,
            asset_acct,
            cash_acct,
            "token:ETH",
            3_000_000,
            "2026-01-15",
        )
        .await;
        seed_lot(
            pool,
            "token:ETH",
            "0xWallet1",
            "2026-01-15",
            "10",
            3_000_000,
        )
        .await;
        (asset_acct, gain_acct, loss_acct)
    }

    fn remeasure_input(run_date: &str, gain_acct: i64, loss_acct: i64) -> RemeasurementInput {
        RemeasurementInput {
            run_date: run_date.to_string(),
            initiated_by: "cfo@example.com".to_string(),
            unrealized_gain_account_id: gain_acct,
            unrealized_loss_account_id: loss_acct,
            asset_coin_map: None,
            api_key: None,
        }
    }

    async fn record_price(pool: &SqlitePool, asset_id: &str, date: &str, price: &str) {
        record_manual_price_impl(
            pool,
            &ManualPriceInput {
                asset_id: asset_id.to_string(),
                price_date: date.to_string(),
                price_decimal: price.to_string(),
                recorded_by: "cfo@example.com".to_string(),
                note: None,
            },
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn second_period_measures_against_posted_fair_value_not_cost() {
        // Period 1: 10 ETH, cost $30,000, price $3,500 → +$5,000 gain, POSTED.
        // Period 2: price $3,800 → adjustment must be FV2 − FV1 = $3,000,
        // NOT FV2 − cost = $8,000 (which would double-count period 1's gain).
        let pool = setup_test_db().await;
        let (asset_acct, gain_acct, loss_acct) = seed_eth_fixture(&pool).await;

        record_price(&pool, "token:ETH", "2026-06-30", "3500.00").await;
        let r1 =
            run_remeasurement_impl(&pool, &remeasure_input("2026-06-30", gain_acct, loss_acct))
                .await
                .unwrap();
        assert_eq!(r1.run.total_unrealized_gain_loss_minor, 500_000);

        // Post the period-1 draft through the standard funnel — this also
        // proves the generated entry passes the M3/M5 posting triggers.
        approve_and_post(&pool, r1.entries[0].journal_entry_id).await;

        // Period 2
        record_price(&pool, "token:ETH", "2026-09-30", "3800.00").await;
        let r2 =
            run_remeasurement_impl(&pool, &remeasure_input("2026-09-30", gain_acct, loss_acct))
                .await
                .unwrap();

        assert_eq!(r2.run.entries_generated, 1);
        let e2 = &r2.entries[0];
        // Carrying = cost 3,000,000 + posted prior adjustment 500,000 = 3,500,000
        assert_eq!(e2.carrying_amount_minor, 3_500_000);
        assert_eq!(e2.fair_value_minor, 3_800_000);
        assert_eq!(e2.unrealized_gain_loss_minor, 300_000);

        // Post period 2 as well; GL asset balance must equal FV2 exactly.
        approve_and_post(&pool, e2.journal_entry_id).await;
        let gl: (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(jel.debit_minor - jel.credit_minor), 0) FROM journal_entry_lines jel INNER JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE jel.gl_account_id = ? AND je.status = 'posted'",
        )
        .bind(asset_acct)
        .fetch_one(&pool)
        .await
        .unwrap();
        // acquisition 3,000,000 + 500,000 + 300,000 = 3,800,000 = FV2
        assert_eq!(gl.0, 3_800_000);
    }

    #[tokio::test]
    async fn rerun_same_date_creates_no_duplicate_drafts() {
        let pool = setup_test_db().await;
        let (_asset_acct, gain_acct, loss_acct) = seed_eth_fixture(&pool).await;

        record_price(&pool, "token:ETH", "2026-06-30", "3500.00").await;
        let input = remeasure_input("2026-06-30", gain_acct, loss_acct);

        let r1 = run_remeasurement_impl(&pool, &input).await.unwrap();
        assert_eq!(r1.run.entries_generated, 1);

        let count_before: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
            .fetch_one(&pool)
            .await
            .unwrap();

        // Re-run for the same date — the pending draft must NOT be duplicated
        // (a duplicate that got approved+posted would double-adjust the GL).
        let r2 = run_remeasurement_impl(&pool, &input).await.unwrap();
        assert_eq!(r2.run.entries_generated, 0);
        assert_eq!(
            r2.already_remeasured,
            vec!["token:ETH@0xWallet1".to_string()]
        );

        let count_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count_before.0, count_after.0);
    }

    #[tokio::test]
    async fn voided_remeasurement_is_excluded_from_carrying_and_rerun_guard() {
        let pool = setup_test_db().await;
        let (_asset_acct, gain_acct, loss_acct) = seed_eth_fixture(&pool).await;

        record_price(&pool, "token:ETH", "2026-06-30", "3500.00").await;
        let r1 =
            run_remeasurement_impl(&pool, &remeasure_input("2026-06-30", gain_acct, loss_acct))
                .await
                .unwrap();
        approve_and_post(&pool, r1.entries[0].journal_entry_id).await;

        // Void the posted remeasurement (posted → voided is the void path).
        sqlx::query(
            "UPDATE journal_entries SET status = 'voided' WHERE id = ? AND status = 'posted'",
        )
        .bind(r1.entries[0].journal_entry_id)
        .execute(&pool)
        .await
        .unwrap();

        // Re-running the SAME date is allowed again (voided re-opens the slot)
        // and the carrying amount falls back to cost basis (voided adjustments
        // are netted out of the GL by their reversing entries).
        let r2 =
            run_remeasurement_impl(&pool, &remeasure_input("2026-06-30", gain_acct, loss_acct))
                .await
                .unwrap();
        assert_eq!(r2.run.entries_generated, 1);
        assert_eq!(r2.entries[0].carrying_amount_minor, 3_000_000);
        assert_eq!(r2.entries[0].unrealized_gain_loss_minor, 500_000);
    }
}
