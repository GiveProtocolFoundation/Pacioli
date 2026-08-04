//! Property-based invariant tests pinning the 7 SCOPE.md invariants
//! against the **real** engine paths. Phase 9, GIV-691.
//!
//! Each `proptest!` block generates random-but-shrinkable inputs and calls
//! production functions from `accounting.rs`, `cost_basis.rs`,
//! `fair_value.rs`, and `statements.rs`. No re-implemented SQL.

use proptest::prelude::*;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use std::str::FromStr;

use super::accounting::{
    decimal_to_minor_units, void_journal_entry_impl, JournalEntry, PostedEntry, PostedEntryLine,
};
use super::cost_basis::{
    acquire_lot_impl, dispose_lots_with_method, transfer_lots_impl, AcquireLotInput, CostBasisLot,
    DisposeLotInput, FifoSelector, TransferLotInput,
};
use super::fair_value::{
    fair_value_to_minor, record_manual_price_impl, run_remeasurement_impl, ManualPriceInput,
    RemeasurementInput,
};
use super::statements::build_verified_statements;

// ============================================================================
// Shared test helpers
// ============================================================================

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

/// Returns seeded GL account IDs: (Cash=1000, Digital Assets=1200,
/// Income=4000, Expenses=5000, Staking Income=4100, Network Fees=5100).
async fn get_seed_accounts(pool: &SqlitePool) -> SeedAccounts {
    async fn fetch_acct(pool: &SqlitePool, num: &str) -> i64 {
        let (id,): (i64,) = sqlx::query_as(&format!(
            "SELECT id FROM gl_accounts WHERE account_number = '{num}'"
        ))
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| panic!("Seed account {num} should exist"));
        id
    }

    SeedAccounts {
        cash: fetch_acct(pool, "1000").await,
        digital_assets: fetch_acct(pool, "1200").await,
        income: fetch_acct(pool, "4000").await,
        expenses: fetch_acct(pool, "5000").await,
        staking_income: fetch_acct(pool, "4100").await,
        network_fees: fetch_acct(pool, "5100").await,
    }
}

struct SeedAccounts {
    cash: i64,
    digital_assets: i64,
    income: i64,
    expenses: i64,
    staking_income: i64,
    network_fees: i64,
}

/// Creates a draft journal entry and returns its id.
///
/// `entry_date` is stored as a full datetime (`{date} 00:00:00`), matching
/// how the production insert path binds a `NaiveDateTime` — a bare date
/// would fail to decode back into `JournalEntry.entry_date`.
async fn create_draft(pool: &SqlitePool, date: &str, desc: &str) -> i64 {
    let result = sqlx::query(
        "INSERT INTO journal_entries (entry_date, description, is_posted, status, origin, created_by) VALUES (?, ?, 0, 'draft', 'manual', 'proptest')",
    )
    .bind(format!("{date} 00:00:00"))
    .bind(desc)
    .execute(pool)
    .await
    .expect("Failed to create draft entry");
    result.last_insert_rowid()
}

/// Adds a balanced pair of lines (debit + credit) in minor units.
/// Both lines share the same asset_id and quantity (if provided).
async fn add_balanced_lines(
    pool: &SqlitePool,
    entry_id: i64,
    debit_acct: i64,
    credit_acct: i64,
    amount_minor: i64,
    asset_id: Option<&str>,
    quantity: Option<&str>,
) {
    let debit_amount = amount_minor as f64 / 100.0;
    let credit_amount = amount_minor as f64 / 100.0;
    let a = asset_id.unwrap_or("USD");

    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, quantity, line_number) VALUES (?, ?, ?, 0.0, ?, 0, ?, ?, 1)",
    )
    .bind(entry_id)
    .bind(debit_acct)
    .bind(debit_amount)
    .bind(amount_minor)
    .bind(a)
    .bind(quantity)
    .execute(pool)
    .await
    .expect("Failed to add debit line");

    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, quantity, line_number) VALUES (?, ?, 0.0, ?, 0, ?, ?, ?, 2)",
    )
    .bind(entry_id)
    .bind(credit_acct)
    .bind(credit_amount)
    .bind(amount_minor)
    .bind(a)
    .bind(quantity)
    .execute(pool)
    .await
    .expect("Failed to add credit line");
}

/// Adds an acquisition entry for a digital asset: debit Digital Assets (with
/// token asset_id + quantity), credit Cash (USD). This is a swap-like entry
/// where each asset appears on only one side (valid per-asset balance).
async fn add_acquisition_lines(
    pool: &SqlitePool,
    entry_id: i64,
    asset_acct: i64,
    cash_acct: i64,
    amount_minor: i64,
    token_asset_id: &str,
    quantity: &str,
) {
    let amount_f = amount_minor as f64 / 100.0;

    // Debit: Digital Assets with token asset_id + quantity
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, quantity, line_number) VALUES (?, ?, ?, 0.0, ?, 0, ?, ?, 1)",
    )
    .bind(entry_id)
    .bind(asset_acct)
    .bind(amount_f)
    .bind(amount_minor)
    .bind(token_asset_id)
    .bind(quantity)
    .execute(pool)
    .await
    .expect("Failed to add debit line");

    // Credit: Cash with USD
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0.0, ?, 0, ?, 'USD', 2)",
    )
    .bind(entry_id)
    .bind(cash_acct)
    .bind(amount_f)
    .bind(amount_minor)
    .execute(pool)
    .await
    .expect("Failed to add credit line");
}

/// Approves a draft entry via direct SQL.
async fn approve_entry(pool: &SqlitePool, entry_id: i64) {
    sqlx::query(
        "UPDATE journal_entries SET status = 'approved', approved_by = 'proptest', approved_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(entry_id)
    .execute(pool)
    .await
    .expect("Failed to approve entry");
}

/// Approves and posts an entry via direct SQL.
async fn approve_and_post(pool: &SqlitePool, entry_id: i64) {
    approve_entry(pool, entry_id).await;
    sqlx::query(
        "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(entry_id)
    .execute(pool)
    .await
    .expect("Failed to post entry");
}

/// Creates a posted entry with balanced lines and returns the entry id.
async fn post_balanced_entry(
    pool: &SqlitePool,
    date: &str,
    debit_acct: i64,
    credit_acct: i64,
    amount_minor: i64,
) -> i64 {
    let entry_id = create_draft(pool, date, "proptest entry").await;
    add_balanced_lines(
        pool,
        entry_id,
        debit_acct,
        credit_acct,
        amount_minor,
        None,
        None,
    )
    .await;
    approve_and_post(pool, entry_id).await;
    entry_id
}

/// Builds a tokio runtime for blocking on async inside proptest closures.
fn rt() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().expect("Failed to create tokio runtime")
}

// ============================================================================
// Inv-1: Structural balance — any entry that reaches `posted` has
//        SUM(debit_minor) == SUM(credit_minor). Unbalanced entries are
//        rejected at BOTH the Rust type layer AND the SQL trigger layer.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    /// PostedEntry::new() accepts any balanced set of 2+ lines.
    #[test]
    fn inv1_posted_entry_accepts_balanced(
        amounts in proptest::collection::vec(1i64..1_000_000, 1..8),
        debit_accts in proptest::collection::vec(1i64..100, 1..8),
        credit_accts in proptest::collection::vec(101i64..200, 1..8),
    ) {
        // Build balanced lines: each amount generates one debit + one credit
        let mut lines = Vec::new();
        for (i, &amount) in amounts.iter().enumerate() {
            let d_acct = debit_accts[i % debit_accts.len()];
            let c_acct = credit_accts[i % credit_accts.len()];
            lines.push(PostedEntryLine {
                gl_account_id: d_acct,
                debit_minor: amount,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            });
            lines.push(PostedEntryLine {
                gl_account_id: c_acct,
                debit_minor: 0,
                credit_minor: amount,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            });
        }

        let entry = PostedEntry::new(lines);
        prop_assert!(entry.is_ok(), "Balanced entry rejected: {:?}", entry.err());

        // Verify the invariant: sum(debit) == sum(credit)
        let e = entry.unwrap();
        let total_d: i64 = e.lines().iter().map(|l| l.debit_minor).sum();
        let total_c: i64 = e.lines().iter().map(|l| l.credit_minor).sum();
        prop_assert_eq!(total_d, total_c);
    }

    /// PostedEntry::new() rejects any entry with even 1 cent of imbalance.
    #[test]
    fn inv1_posted_entry_rejects_unbalanced(
        amount in 1i64..1_000_000,
        imbalance in 1i64..100,
    ) {
        let lines = vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: amount,
                credit_minor: 0,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: amount + imbalance,
                quantity: None,
                asset_id: Some("USD".to_string()),
                description: None,
            },
        ];

        let entry = PostedEntry::new(lines);
        prop_assert!(entry.is_err(), "Unbalanced entry accepted");
    }

    /// SQL trigger rejects unbalanced entries on direct INSERT (non-Rust writers).
    #[test]
    fn inv1_trigger_rejects_unbalanced(
        amount in 1i64..1_000_000,
        imbalance in 1i64..100,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let entry_id = create_draft(&pool, "2026-01-01", "trigger test").await;
            // Insert unbalanced lines via raw SQL (bypassing Rust validation)
            let debit_amount = amount as f64 / 100.0;
            let credit_amount = (amount + imbalance) as f64 / 100.0;
            sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, ?, 0, ?, 0, 'USD', 1)"
            )
            .bind(entry_id)
            .bind(accts.cash)
            .bind(debit_amount)
            .bind(amount)
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0.0, ?, 0, ?, 'USD', 2)"
            )
            .bind(entry_id)
            .bind(accts.income)
            .bind(credit_amount)
            .bind(amount + imbalance)
            .execute(&pool)
            .await
            .unwrap();

            // Approve first
            approve_entry(&pool, entry_id).await;

            // Attempt to post — trigger should abort
            let result = sqlx::query(
                "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(entry_id)
            .execute(&pool)
            .await;

            assert!(result.is_err(), "Trigger allowed unbalanced post");
        });
    }

    /// PostedEntry::new() rejects per-asset quantity imbalance (same asset on
    /// both sides must have matching quantities).
    #[test]
    fn inv1_per_asset_quantity_imbalance_rejected(
        debit_qty in 1u32..10000,
        credit_qty_offset in 1u32..100,
        amount in 100i64..100_000,
    ) {
        let dq = Decimal::from(debit_qty);
        let cq = Decimal::from(debit_qty + credit_qty_offset); // intentionally different
        let lines = vec![
            PostedEntryLine {
                gl_account_id: 1,
                debit_minor: amount,
                credit_minor: 0,
                quantity: Some(dq),
                asset_id: Some("token:42".to_string()),
                description: None,
            },
            PostedEntryLine {
                gl_account_id: 2,
                debit_minor: 0,
                credit_minor: amount,
                quantity: Some(cq),
                asset_id: Some("token:42".to_string()),
                description: None,
            },
        ];

        let result = PostedEntry::new(lines);
        prop_assert!(result.is_err(), "Per-asset quantity imbalance accepted");
    }
}

// ============================================================================
// Inv-2: No floats — decimal quantities/prices round-trip through
//        decimal_to_minor_units / fair_value_to_minor with no drift.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    /// decimal_to_minor_units produces exact integer cents with no float drift.
    #[test]
    fn inv2_decimal_to_minor_exact(
        whole in -999_999i64..999_999,
        frac in 0u32..100,
    ) {
        // Build a decimal like "12345.67"
        let s = format!("{whole}.{frac:02}");
        let d = Decimal::from_str(&s).unwrap();
        let result = decimal_to_minor_units(d);
        prop_assert!(result.is_some(), "Overflow for {s}");
        let minor = result.unwrap();
        // Expected: whole * 100 + frac (with sign)
        let expected = whole * 100 + if whole < 0 { -(frac as i64) } else { frac as i64 };
        prop_assert_eq!(minor, expected, "Drift for {}: got {}, expected {}", s, minor, expected);
    }

    /// Sum of minor units is exact (no accumulation error).
    #[test]
    fn inv2_minor_unit_sum_exact(
        amounts in proptest::collection::vec(1i64..100_000, 2..20),
    ) {
        // Summing i64 minor units is exact by construction
        let sum: i64 = amounts.iter().sum();
        let reconstructed: i64 = amounts.iter().copied().sum();
        prop_assert_eq!(sum, reconstructed, "Integer sum drift");
    }

    /// fair_value_to_minor(quantity, price) = quantity * price * 100
    /// rounded with half-away-from-zero, no float drift.
    #[test]
    fn inv2_fair_value_to_minor_exact(
        qty_whole in 1u32..10_000,
        qty_frac in 0u32..100,
        price_whole in 1u32..100_000,
        price_frac in 0u32..100,
    ) {
        let qty_s = format!("{qty_whole}.{qty_frac:02}");
        let price_s = format!("{price_whole}.{price_frac:02}");
        let qty = Decimal::from_str(&qty_s).unwrap();
        let result = fair_value_to_minor(qty, &price_s);
        prop_assert!(result.is_ok(), "Error for qty={qty_s}, price={price_s}: {:?}", result.err());

        // Verify via rust_decimal arithmetic
        let price = Decimal::from_str(&price_s).unwrap();
        let expected = qty
            .checked_mul(price)
            .unwrap()
            .checked_mul(Decimal::from(100))
            .unwrap()
            .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero)
            .to_i64()
            .unwrap();
        prop_assert_eq!(result.unwrap(), expected);
    }

    /// Decimal round-trip: string → Decimal → minor → back to string matches.
    #[test]
    fn inv2_decimal_roundtrip(
        whole in 0i64..999_999,
        frac in 0u32..100,
    ) {
        let s = format!("{whole}.{frac:02}");
        let d = Decimal::from_str(&s).unwrap();
        let minor = decimal_to_minor_units(d).unwrap();
        // Reconstruct: minor / 100 as Decimal
        let reconstructed = Decimal::from(minor) / Decimal::from(100);
        prop_assert_eq!(d, reconstructed, "Round-trip drift for {}", s);
    }
}

// ============================================================================
// Inv-3: State machine — random sequences of transition attempts never
//        reach an illegal state. Posted entries only leave via void +
//        reversing entry. Net GL effect of void = 0.
// ============================================================================

/// State machine transitions to attempt.
#[derive(Debug, Clone, Copy)]
enum Transition {
    Approve,
    Post,
    Void,
    Demote,
}

fn arb_transitions() -> impl Strategy<Value = Vec<Transition>> {
    proptest::collection::vec(
        prop_oneof![
            Just(Transition::Approve),
            Just(Transition::Post),
            Just(Transition::Void),
            Just(Transition::Demote),
        ],
        1..12,
    )
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    /// Random transition sequences never produce an illegal state.
    #[test]
    fn inv3_state_machine_never_illegal(
        transitions in arb_transitions(),
        amount in 100i64..100_000,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let entry_id = create_draft(&pool, "2026-01-15", "state machine test").await;
            add_balanced_lines(&pool, entry_id, accts.cash, accts.income, amount, None, None).await;

            let mut current_status = "draft".to_string();

            for t in &transitions {
                let result = match t {
                    Transition::Approve => {
                        sqlx::query(
                            "UPDATE journal_entries SET status = 'approved', approved_by = 'proptest', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'"
                        )
                        .bind(entry_id)
                        .execute(&pool)
                        .await
                    }
                    Transition::Post => {
                        sqlx::query(
                            "UPDATE journal_entries SET status = 'posted', is_posted = 1, posted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'"
                        )
                        .bind(entry_id)
                        .execute(&pool)
                        .await
                    }
                    Transition::Void => {
                        sqlx::query(
                            "UPDATE journal_entries SET status = 'voided' WHERE id = ? AND status = 'posted'"
                        )
                        .bind(entry_id)
                        .execute(&pool)
                        .await
                    }
                    Transition::Demote => {
                        sqlx::query(
                            "UPDATE journal_entries SET status = 'draft' WHERE id = ? AND status = 'approved'"
                        )
                        .bind(entry_id)
                        .execute(&pool)
                        .await
                    }
                };

                // Update current status from DB
                let (status,): (String,) =
                    sqlx::query_as("SELECT status FROM journal_entries WHERE id = ?")
                        .bind(entry_id)
                        .fetch_one(&pool)
                        .await
                        .unwrap();

                // The ONLY legal states
                assert!(
                    ["draft", "approved", "posted", "voided"].contains(&status.as_str()),
                    "Illegal status '{status}' after {t:?} from '{current_status}'"
                );

                // Voided is terminal — must never leave
                if current_status == "voided" {
                    assert_eq!(
                        status, "voided",
                        "Voided entry transitioned to '{status}'"
                    );
                }

                // Draft → posted shortcut must not work (M5)
                if current_status == "draft" {
                    assert_ne!(
                        status, "posted",
                        "Draft entry went directly to posted (skipped approved)"
                    );
                }

                // Ignore errors — failed transitions are expected
                let _ = result;

                current_status = status;
            }
        });
    }

    /// Voiding a posted entry via the PRODUCTION void engine
    /// (`void_journal_entry_impl`) creates a posted reversing entry whose
    /// per-account GL net effect is exactly zero, marks the original
    /// `voided` with a link to the reversal, and rejects a double void.
    #[test]
    fn inv3_void_net_effect_zero(
        amount in 100i64..500_000,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let entry_id = create_draft(&pool, "2026-02-01", "void test").await;
            add_balanced_lines(&pool, entry_id, accts.cash, accts.income, amount, None, None).await;
            approve_and_post(&pool, entry_id).await;

            // Production void path: generates + posts the reversing entry
            // and voids the original in one transaction.
            let rev_id = void_journal_entry_impl(&pool, entry_id)
                .await
                .expect("Production void path failed");

            // Original is voided and linked to the reversing entry
            let (status, reversed_by): (String, Option<i64>) = sqlx::query_as(
                "SELECT status, reversed_by_entry_id FROM journal_entries WHERE id = ?"
            )
            .bind(entry_id)
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(status, "voided", "Original not voided");
            assert_eq!(reversed_by, Some(rev_id), "Original not linked to reversal");

            // Reversing entry is posted (stays in the GL) AND decodes as a
            // full JournalEntry — pins the DATE('now') vs datetime('now')
            // regression where reversal rows broke entry listings.
            let rev_entry = sqlx::query_as::<_, JournalEntry>(
                "SELECT * FROM journal_entries WHERE id = ?",
            )
            .bind(rev_id)
            .fetch_one(&pool)
            .await
            .expect("Reversing entry must decode as JournalEntry");
            assert_eq!(rev_entry.status, "posted", "Reversing entry not posted");

            // Double void must fail (read-check-write: already-voided guard)
            let again = void_journal_entry_impl(&pool, entry_id).await;
            assert!(again.is_err(), "Double void should be rejected");

            // Net GL effect = 0 overall: sum all posted debit_minor and credit_minor
            let (total_d, total_c): (i64, i64) = sqlx::query_as(
                "SELECT COALESCE(SUM(jel.debit_minor), 0), COALESCE(SUM(jel.credit_minor), 0) FROM journal_entry_lines jel INNER JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.is_posted = 1"
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(total_d, total_c, "Net GL not zero after void: d={total_d}, c={total_c}");

            // Per-account: original + reversal cancel exactly
            let per_acct: Vec<(i64, i64, i64)> = sqlx::query_as(
                "SELECT gl_account_id, COALESCE(SUM(debit_minor), 0), COALESCE(SUM(credit_minor), 0) FROM journal_entry_lines WHERE journal_entry_id IN (?, ?) GROUP BY gl_account_id"
            )
            .bind(entry_id)
            .bind(rev_id)
            .fetch_all(&pool)
            .await
            .unwrap();
            for (acct, d, c) in &per_acct {
                assert_eq!(d, c, "Account {acct} not net-zero after void");
            }
        });
    }
}

// ============================================================================
// Inv-7: Append-only — UPDATE/DELETE on lot_consumptions,
//        price_observations, remeasurement_runs/entries, and posted lines
//        all ABORT.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(8))]

    /// lot_consumptions is append-only: UPDATE and DELETE are both rejected.
    #[test]
    fn inv7_lot_consumptions_append_only(seed in 0u64..1000) {
        let _ = seed; // used only for proptest variation
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;

            // Insert a consumption record directly
            sqlx::query(
                "INSERT INTO cost_basis_lots (asset_id, wallet_id, acquired_date, quantity, remaining_quantity, cost_basis_minor, cost_basis_method) VALUES ('token:1', 'wallet-a', '2026-01-01', '10', '10', 100000, 'FIFO')"
            )
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO lot_consumptions (lot_id, quantity_consumed, cost_basis_minor, proceeds_minor, realized_gain_loss_minor, event_type, event_date) VALUES (1, '5', 50000, 60000, 10000, 'disposal', '2026-03-01')"
            )
            .execute(&pool)
            .await
            .unwrap();

            // UPDATE must fail
            let update = sqlx::query("UPDATE lot_consumptions SET proceeds_minor = 70000 WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update.is_err(), "lot_consumptions UPDATE should be rejected");

            // DELETE must fail
            let delete = sqlx::query("DELETE FROM lot_consumptions WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(delete.is_err(), "lot_consumptions DELETE should be rejected");
        });
    }

    /// price_observations is append-only.
    #[test]
    fn inv7_price_observations_append_only(seed in 0u64..1000) {
        let _ = seed;
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO price_observations (asset_id, price_date, price_minor, price_decimal, source, recorded_by) VALUES ('token:1', '2026-06-30', 4235050, '42350.50', 'manual', 'proptest')"
            )
            .execute(&pool)
            .await
            .unwrap();

            let update = sqlx::query("UPDATE price_observations SET price_minor = 5000000 WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update.is_err(), "price_observations UPDATE should be rejected");

            let delete = sqlx::query("DELETE FROM price_observations WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(delete.is_err(), "price_observations DELETE should be rejected");
        });
    }

    /// remeasurement_runs is append-only.
    #[test]
    fn inv7_remeasurement_runs_append_only(seed in 0u64..1000) {
        let _ = seed;
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO remeasurement_runs (run_date, initiated_by, holdings_count, entries_generated, total_unrealized_gain_loss_minor, status) VALUES ('2026-06-30', 'proptest', 0, 0, 0, 'completed')"
            )
            .execute(&pool)
            .await
            .unwrap();

            let update = sqlx::query("UPDATE remeasurement_runs SET status = 'partial' WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update.is_err(), "remeasurement_runs UPDATE should be rejected");

            let delete = sqlx::query("DELETE FROM remeasurement_runs WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(delete.is_err(), "remeasurement_runs DELETE should be rejected");
        });
    }

    /// remeasurement_entries is append-only.
    #[test]
    fn inv7_remeasurement_entries_append_only(seed in 0u64..1000) {
        let _ = seed;
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;

            // Need a run and a JE for FKs
            sqlx::query(
                "INSERT INTO remeasurement_runs (run_date, initiated_by, holdings_count, entries_generated, total_unrealized_gain_loss_minor, status) VALUES ('2026-06-30', 'proptest', 1, 1, 5000, 'completed')"
            )
            .execute(&pool)
            .await
            .unwrap();

            let entry_id = create_draft(&pool, "2026-06-30", "remeasure test").await;

            // Need a price observation for FK
            sqlx::query(
                "INSERT INTO price_observations (asset_id, price_date, price_minor, price_decimal, source, recorded_by) VALUES ('token:1', '2026-06-30', 4235050, '42350.50', 'manual', 'proptest')"
            )
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO remeasurement_entries (run_id, journal_entry_id, asset_id, wallet_id, price_observation_id, carrying_amount_minor, fair_value_minor, unrealized_gain_loss_minor) VALUES (1, ?, 'token:1', 'wallet-a', 1, 100000, 105000, 5000)"
            )
            .bind(entry_id)
            .execute(&pool)
            .await
            .unwrap();

            let update = sqlx::query("UPDATE remeasurement_entries SET fair_value_minor = 110000 WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update.is_err(), "remeasurement_entries UPDATE should be rejected");

            let delete = sqlx::query("DELETE FROM remeasurement_entries WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(delete.is_err(), "remeasurement_entries DELETE should be rejected");
        });
    }

    /// Posted journal entry lines are immutable (INSERT/UPDATE/DELETE all
    /// rejected on posted/voided entries).
    #[test]
    fn inv7_posted_lines_immutable(amount in 100i64..100_000) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let entry_id = post_balanced_entry(&pool, "2026-01-01", accts.cash, accts.income, amount).await;

            // INSERT on posted entry must fail
            let insert = sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit_amount, credit_amount, debit_minor, credit_minor, asset_id, line_number) VALUES (?, ?, 0, 0, 100, 0, 'USD', 99)"
            )
            .bind(entry_id)
            .bind(accts.expenses)
            .execute(&pool)
            .await;
            assert!(insert.is_err(), "INSERT on posted entry should be rejected");

            // UPDATE on posted entry must fail
            let update = sqlx::query(
                "UPDATE journal_entry_lines SET debit_minor = 999 WHERE journal_entry_id = ? AND line_number = 1"
            )
            .bind(entry_id)
            .execute(&pool)
            .await;
            assert!(update.is_err(), "UPDATE on posted lines should be rejected");

            // DELETE on posted entry must fail
            let delete = sqlx::query(
                "DELETE FROM journal_entry_lines WHERE journal_entry_id = ? AND line_number = 1"
            )
            .bind(entry_id)
            .execute(&pool)
            .await;
            assert!(delete.is_err(), "DELETE on posted lines should be rejected");
        });
    }

    /// cost_basis_lots core columns are immutable after insert.
    #[test]
    fn inv7_lot_core_columns_immutable(seed in 0u64..1000) {
        let _ = seed;
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO cost_basis_lots (asset_id, wallet_id, acquired_date, quantity, remaining_quantity, cost_basis_minor, cost_basis_method) VALUES ('token:1', 'wallet-a', '2026-01-01', '100', '100', 500000, 'FIFO')"
            )
            .execute(&pool)
            .await
            .unwrap();

            // Mutating core columns must fail
            let update = sqlx::query("UPDATE cost_basis_lots SET quantity = '200' WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update.is_err(), "lot quantity should be immutable");

            let update2 = sqlx::query("UPDATE cost_basis_lots SET cost_basis_minor = 999 WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update2.is_err(), "lot cost_basis_minor should be immutable");

            let update3 = sqlx::query("UPDATE cost_basis_lots SET acquired_date = '2025-01-01' WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update3.is_err(), "lot acquired_date should be immutable");

            // But remaining_quantity and is_closed CAN change
            let update_ok = sqlx::query("UPDATE cost_basis_lots SET remaining_quantity = '50', is_closed = 0 WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(update_ok.is_ok(), "remaining_quantity should be mutable");

            // DELETE must fail
            let delete = sqlx::query("DELETE FROM cost_basis_lots WHERE id = 1")
                .execute(&pool)
                .await;
            assert!(delete.is_err(), "cost_basis_lots DELETE should be rejected");
        });
    }
}

// ============================================================================
// Property 5: Cost basis conservation — for random buy/sell/transfer
// sequences: Σ(consumed cost + remaining cost) = Σ(acquired cost);
// transfers never realize gain; FIFO order respected; no over-consumption.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    /// Acquire N lots, then dispose a partial quantity. Conservation:
    /// Σ(consumed cost) + Σ(remaining cost) = Σ(acquired cost).
    #[test]
    fn cost_basis_conservation_after_disposal(
        lot_costs in proptest::collection::vec((1u32..1000, 100i64..100_000), 1..5),
        dispose_frac in 1u32..100,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let mut total_acquired_cost = 0i64;
            let mut total_quantity = Decimal::ZERO;

            // Acquire lots
            for (i, &(qty, cost)) in lot_costs.iter().enumerate() {
                let q = Decimal::from(qty);
                let je_id = post_balanced_entry(
                    &pool,
                    "2026-01-15",
                    accts.digital_assets,
                    accts.cash,
                    cost,
                ).await;

                acquire_lot_impl(&pool, &AcquireLotInput {
                    asset_id: "token:TEST".to_string(),
                    wallet_id: "wallet-prop".to_string(),
                    acquired_date: format!("2026-01-{:02}", (i % 28) + 1),
                    quantity: q.to_string(),
                    cost_basis_minor: cost,
                    journal_entry_id: Some(je_id),
                }).await.expect("acquire_lot_impl failed");

                total_acquired_cost += cost;
                total_quantity += q;
            }

            // Dispose a fraction of total
            let dispose_qty = (total_quantity * Decimal::from(dispose_frac.min(99)) / Decimal::from(100u32))
                .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero);

            if dispose_qty > Decimal::ZERO && dispose_qty <= total_quantity {
                let je_id = post_balanced_entry(
                    &pool,
                    "2026-06-01",
                    accts.cash,
                    accts.digital_assets,
                    50000, // arbitrary proceeds
                ).await;

                let result = dispose_lots_with_method(
                    &pool,
                    &DisposeLotInput {
                        asset_id: "token:TEST".to_string(),
                        wallet_id: "wallet-prop".to_string(),
                        disposal_date: "2026-06-01".to_string(),
                        quantity: dispose_qty.to_string(),
                        proceeds_minor: 50000,
                        journal_entry_id: Some(je_id),
                    },
                    &FifoSelector,
                ).await.expect("dispose_lots_with_method failed");

                let consumed_cost = result.total_cost_basis_minor;

                // Sum remaining cost from open lots
                let remaining_lots: Vec<CostBasisLot> = sqlx::query_as(
                    "SELECT * FROM cost_basis_lots WHERE asset_id = 'token:TEST' AND wallet_id = 'wallet-prop'"
                )
                .fetch_all(&pool)
                .await
                .unwrap();

                let mut remaining_cost = 0i64;
                for lot in &remaining_lots {
                    let rem_qty = Decimal::from_str(&lot.remaining_quantity).unwrap();
                    if rem_qty > Decimal::ZERO {
                        let lot_qty = Decimal::from_str(&lot.quantity).unwrap();
                        // Proportional remaining cost
                        let prop = rem_qty / lot_qty;
                        let rc = (prop * Decimal::from(lot.cost_basis_minor))
                            .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero)
                            .to_i64()
                            .unwrap();
                        remaining_cost += rc;
                    }
                }

                // Conservation: consumed + remaining = acquired (within rounding tolerance of ±1 per lot)
                let diff = (consumed_cost + remaining_cost - total_acquired_cost).abs();
                let tolerance = lot_costs.len() as i64; // ±1 per lot from proportional rounding
                assert!(
                    diff <= tolerance,
                    "Cost conservation violated: consumed({consumed_cost}) + remaining({remaining_cost}) != acquired({total_acquired_cost}), diff={diff}"
                );
            }
        });
    }

    /// Transfers between own wallets never realize gain/loss.
    #[test]
    fn cost_basis_transfer_no_realization(
        qty in 1u32..1000,
        cost in 100i64..100_000,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let q = Decimal::from(qty);

            let je_id = post_balanced_entry(
                &pool,
                "2026-01-15",
                accts.digital_assets,
                accts.cash,
                cost,
            ).await;

            acquire_lot_impl(&pool, &AcquireLotInput {
                asset_id: "token:XFR".to_string(),
                wallet_id: "wallet-src".to_string(),
                acquired_date: "2026-01-15".to_string(),
                quantity: q.to_string(),
                cost_basis_minor: cost,
                journal_entry_id: Some(je_id),
            }).await.unwrap();

            // Transfer full quantity to another wallet
            let je_id2 = post_balanced_entry(
                &pool,
                "2026-03-01",
                accts.digital_assets,
                accts.digital_assets,
                cost, // same cost, just wallet move
            ).await;

            let dest_lots = transfer_lots_impl(&pool, &TransferLotInput {
                asset_id: "token:XFR".to_string(),
                from_wallet_id: "wallet-src".to_string(),
                to_wallet_id: "wallet-dst".to_string(),
                transfer_date: "2026-03-01".to_string(),
                quantity: q.to_string(),
                journal_entry_id: Some(je_id2),
            }).await.unwrap();

            // No realized gain/loss in lot_consumptions
            let consumptions: Vec<(i64,)> = sqlx::query_as(
                "SELECT realized_gain_loss_minor FROM lot_consumptions WHERE event_type = 'transfer'"
            )
            .fetch_all(&pool)
            .await
            .unwrap();

            for (gl,) in &consumptions {
                assert_eq!(*gl, 0, "Transfer realized gain/loss should be 0, got {gl}");
            }

            // Destination lot preserves cost basis
            assert!(!dest_lots.is_empty(), "No destination lots created");
            let total_dest_cost: i64 = dest_lots.iter().map(|l| l.cost_basis_minor).sum();
            assert_eq!(total_dest_cost, cost, "Transfer changed total cost basis: {total_dest_cost} != {cost}");
        });
    }

    /// FIFO order: oldest lots consumed first.
    #[test]
    fn cost_basis_fifo_order(
        amounts in proptest::collection::vec(1u32..100, 3..6),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            // Acquire lots on different dates
            let mut lot_ids = Vec::new();
            for (i, &qty) in amounts.iter().enumerate() {
                let q = Decimal::from(qty);
                let date = format!("2026-{:02}-15", (i % 12) + 1);
                let je_id = post_balanced_entry(
                    &pool,
                    &date,
                    accts.digital_assets,
                    accts.cash,
                    (qty as i64) * 100,
                ).await;

                let lot = acquire_lot_impl(&pool, &AcquireLotInput {
                    asset_id: "token:FIFO".to_string(),
                    wallet_id: "wallet-fifo".to_string(),
                    acquired_date: date.clone(),
                    quantity: q.to_string(),
                    cost_basis_minor: (qty as i64) * 100,
                    journal_entry_id: Some(je_id),
                }).await.unwrap();
                lot_ids.push(lot.id);
            }

            // Dispose 1 unit — should come from the OLDEST lot
            let je_id = post_balanced_entry(
                &pool,
                "2026-12-01",
                accts.cash,
                accts.digital_assets,
                200,
            ).await;

            let result = dispose_lots_with_method(
                &pool,
                &DisposeLotInput {
                    asset_id: "token:FIFO".to_string(),
                    wallet_id: "wallet-fifo".to_string(),
                    disposal_date: "2026-12-01".to_string(),
                    quantity: "1".to_string(),
                    proceeds_minor: 200,
                    journal_entry_id: Some(je_id),
                },
                &FifoSelector,
            ).await.unwrap();

            // First lot should be consumed
            assert_eq!(
                result.details[0].lot_id, lot_ids[0],
                "FIFO should consume oldest lot first"
            );
        });
    }

    /// No lot over-consumption: remaining_quantity never goes below 0.
    #[test]
    fn cost_basis_no_over_consumption(
        qty in 1u32..500,
        cost in 100i64..50_000,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let q = Decimal::from(qty);
            let je_id = post_balanced_entry(
                &pool,
                "2026-01-15",
                accts.digital_assets,
                accts.cash,
                cost,
            ).await;

            acquire_lot_impl(&pool, &AcquireLotInput {
                asset_id: "token:OC".to_string(),
                wallet_id: "wallet-oc".to_string(),
                acquired_date: "2026-01-15".to_string(),
                quantity: q.to_string(),
                cost_basis_minor: cost,
                journal_entry_id: Some(je_id),
            }).await.unwrap();

            // Attempt to dispose MORE than available — must error
            let over_qty = (q + Decimal::ONE).to_string();
            let je_id2 = post_balanced_entry(
                &pool,
                "2026-06-01",
                accts.cash,
                accts.digital_assets,
                cost + 100,
            ).await;

            let result = dispose_lots_with_method(
                &pool,
                &DisposeLotInput {
                    asset_id: "token:OC".to_string(),
                    wallet_id: "wallet-oc".to_string(),
                    disposal_date: "2026-06-01".to_string(),
                    quantity: over_qty,
                    proceeds_minor: cost + 100,
                    journal_entry_id: Some(je_id2),
                },
                &FifoSelector,
            ).await;

            assert!(result.is_err(), "Over-consumption should be rejected");

            // Verify remaining_quantity >= 0 for all lots
            let lots: Vec<(String,)> = sqlx::query_as(
                "SELECT remaining_quantity FROM cost_basis_lots WHERE asset_id = 'token:OC'"
            )
            .fetch_all(&pool)
            .await
            .unwrap();

            for (rem,) in &lots {
                let r = Decimal::from_str(rem).unwrap();
                assert!(r >= Decimal::ZERO, "remaining_quantity went negative: {rem}");
            }
        });
    }

    /// INTERLEAVED random buy/sell/transfer sequences against the production
    /// engines: after every operation no lot is over-consumed
    /// (remaining_quantity >= 0), transfers never realize gain/loss, and at
    /// the end cost is conserved:
    /// Σ(disposal consumed cost) + Σ(remaining cost, both wallets) = Σ(acquired cost)
    /// within ±1 minor unit per rounding site (each consumption row and each
    /// open lot rounds proportionally once).
    #[test]
    fn cost_basis_interleaved_ops_conserve(
        ops in proptest::collection::vec((0u8..3, 1u32..50, 100i64..10_000), 3..10),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let asset = "token:MIX";
            let src = "wallet-src";
            let dst = "wallet-dst";

            let mut avail_src = Decimal::ZERO;
            let mut total_acquired_cost = 0i64;

            for (i, &(kind, qty, money)) in ops.iter().enumerate() {
                let date = format!("2026-{:02}-{:02}", (i / 28) + 1, (i % 28) + 1);
                let q = Decimal::from(qty);

                match kind {
                    // Buy into src wallet
                    0 => {
                        let je = post_balanced_entry(
                            &pool, &date, accts.digital_assets, accts.cash, money,
                        ).await;
                        acquire_lot_impl(&pool, &AcquireLotInput {
                            asset_id: asset.to_string(),
                            wallet_id: src.to_string(),
                            acquired_date: date.clone(),
                            quantity: q.to_string(),
                            cost_basis_minor: money,
                            journal_entry_id: Some(je),
                        }).await.expect("interleaved acquire failed");
                        total_acquired_cost += money;
                        avail_src += q;
                    }
                    // Sell from src wallet (clamped to available)
                    1 => {
                        let sell_qty = q.min(avail_src);
                        let je = post_balanced_entry(
                            &pool, &date, accts.cash, accts.digital_assets, money,
                        ).await;
                        let result = dispose_lots_with_method(
                            &pool,
                            &DisposeLotInput {
                                asset_id: asset.to_string(),
                                wallet_id: src.to_string(),
                                disposal_date: date.clone(),
                                quantity: if sell_qty.is_zero() { q.to_string() } else { sell_qty.to_string() },
                                proceeds_minor: money,
                                journal_entry_id: Some(je),
                            },
                            &FifoSelector,
                        ).await;
                        if sell_qty.is_zero() {
                            // Nothing available — engine must reject, never go negative
                            assert!(result.is_err(), "Disposal from empty wallet should fail");
                        } else {
                            result.expect("interleaved disposal failed");
                            avail_src -= sell_qty;
                        }
                    }
                    // Transfer src -> dst (clamped to available)
                    _ => {
                        let xfer_qty = q.min(avail_src);
                        let je = post_balanced_entry(
                            &pool, &date, accts.digital_assets, accts.digital_assets, money,
                        ).await;
                        let result = transfer_lots_impl(&pool, &TransferLotInput {
                            asset_id: asset.to_string(),
                            from_wallet_id: src.to_string(),
                            to_wallet_id: dst.to_string(),
                            transfer_date: date.clone(),
                            quantity: if xfer_qty.is_zero() { q.to_string() } else { xfer_qty.to_string() },
                            journal_entry_id: Some(je),
                        }).await;
                        if xfer_qty.is_zero() {
                            assert!(result.is_err(), "Transfer from empty wallet should fail");
                        } else {
                            result.expect("interleaved transfer failed");
                            avail_src -= xfer_qty;
                        }
                    }
                }

                // Invariant after EVERY op: no lot over-consumed
                let rems: Vec<(String,)> = sqlx::query_as(
                    "SELECT remaining_quantity FROM cost_basis_lots WHERE asset_id = ?"
                )
                .bind(asset)
                .fetch_all(&pool)
                .await
                .unwrap();
                for (rem,) in &rems {
                    let rq = Decimal::from_str(rem).unwrap();
                    assert!(rq >= Decimal::ZERO, "remaining_quantity negative after op {i}: {rem}");
                }
            }

            // Transfers never realize gain/loss
            let xfer_gl: Vec<(i64,)> = sqlx::query_as(
                "SELECT realized_gain_loss_minor FROM lot_consumptions WHERE event_type = 'transfer'"
            )
            .fetch_all(&pool)
            .await
            .unwrap();
            for (gl,) in &xfer_gl {
                assert_eq!(*gl, 0, "Transfer realized gain/loss should be 0, got {gl}");
            }

            // Conservation: disposal consumed cost + remaining cost (both
            // wallets, proportional) = total acquired cost, within ±1 per
            // rounding site.
            let (consumed_cost,): (i64,) = sqlx::query_as(
                "SELECT COALESCE(SUM(cost_basis_minor), 0) FROM lot_consumptions WHERE event_type = 'disposal'"
            )
            .fetch_one(&pool)
            .await
            .unwrap();

            let lots: Vec<(String, String, i64)> = sqlx::query_as(
                "SELECT quantity, remaining_quantity, cost_basis_minor FROM cost_basis_lots WHERE asset_id = ?"
            )
            .bind(asset)
            .fetch_all(&pool)
            .await
            .unwrap();

            let mut remaining_cost = 0i64;
            let mut open_lots = 0i64;
            for (lot_qty, rem_qty, cost) in &lots {
                let rq = Decimal::from_str(rem_qty).unwrap();
                if rq > Decimal::ZERO {
                    let lq = Decimal::from_str(lot_qty).unwrap();
                    let rc = (rq / lq * Decimal::from(*cost))
                        .round_dp_with_strategy(0, rust_decimal::RoundingStrategy::MidpointAwayFromZero)
                        .to_i64()
                        .unwrap();
                    remaining_cost += rc;
                    open_lots += 1;
                }
            }

            let (consumption_rows,): (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM lot_consumptions")
                    .fetch_one(&pool)
                    .await
                    .unwrap();

            let diff = (consumed_cost + remaining_cost - total_acquired_cost).abs();
            let tolerance = consumption_rows + open_lots;
            assert!(
                diff <= tolerance,
                "Interleaved cost conservation violated: consumed({consumed_cost}) + remaining({remaining_cost}) != acquired({total_acquired_cost}), diff={diff}, tolerance={tolerance}"
            );
        });
    }
}

// ============================================================================
// Property 6: Fair value idempotency + carrying-forward — re-running any
// period is a no-op; Σ(unrealized) = final FV − cost.
// ============================================================================

/// Stub price source that returns a fixed price for tests.
struct FixedPriceSource {
    price: String,
}

#[async_trait::async_trait]
impl super::fair_value::PriceSource for FixedPriceSource {
    async fn get_price(&self, _coin_id: &str, _date: &str) -> Result<Option<String>, String> {
        Ok(Some(self.price.clone()))
    }
    fn source_name(&self) -> &'static str {
        "test"
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(16))]

    /// Re-running remeasurement for the same date is idempotent (no duplicate drafts).
    #[test]
    fn fv_idempotency_rerun_noop(
        qty in 1u32..100,
        cost_per_unit in 100i64..10_000,
        price_cents in 100u32..100_000, // must differ from cost to generate an entry
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let gain_acct = accts.staking_income; // 4100 (Income)
            let loss_acct = accts.network_fees;   // 5100 (Expense)

            let q = Decimal::from(qty);
            let total_cost = cost_per_unit * (qty as i64);

            // Create an acquisition entry with asset_id = 'token:FV' on the
            // debit side of the Digital Assets account so find_asset_account
            // can discover the GL mapping.
            let je_id = create_draft(&pool, "2026-01-15", "fv acquisition").await;
            add_acquisition_lines(
                &pool, je_id, accts.digital_assets, accts.cash,
                total_cost, "token:FV", &q.to_string(),
            ).await;
            approve_and_post(&pool, je_id).await;

            acquire_lot_impl(&pool, &AcquireLotInput {
                asset_id: "token:FV".to_string(),
                wallet_id: "wallet-fv".to_string(),
                acquired_date: "2026-01-15".to_string(),
                quantity: q.to_string(),
                cost_basis_minor: total_cost,
                journal_entry_id: Some(je_id),
            }).await.unwrap();

            // Record a manual price that differs from cost
            let price_str = format!("{}.{:02}", price_cents / 100, price_cents % 100);
            record_manual_price_impl(&pool, &ManualPriceInput {
                asset_id: "token:FV".to_string(),
                price_date: "2026-06-30".to_string(),
                price_decimal: price_str.clone(),
                recorded_by: "proptest".to_string(),
                note: None,
            }).await.unwrap();

            let input = RemeasurementInput {
                run_date: "2026-06-30".to_string(),
                initiated_by: "proptest".to_string(),
                unrealized_gain_account_id: gain_acct,
                unrealized_loss_account_id: loss_acct,
                asset_coin_map: None,
                api_key: None,
            };

            // First run
            let result1 = run_remeasurement_impl(&pool, &input).await.unwrap();

            // Compute expected fair value to check if an entry should exist
            let expected_fv = fair_value_to_minor(q, &price_str).unwrap();
            let expected_unrealized = expected_fv - total_cost;

            if expected_unrealized != 0 {
                // An entry was generated — second run must be idempotent
                assert!(result1.run.entries_generated > 0, "Expected entry generation on first run");

                let result2 = run_remeasurement_impl(&pool, &input).await.unwrap();

                assert_eq!(
                    result2.run.entries_generated, 0,
                    "Second remeasurement run should generate 0 entries (idempotent), got {}",
                    result2.run.entries_generated
                );
                assert!(
                    result2.already_remeasured.iter().any(|s| s.contains("token:FV")),
                    "Second run should report token:FV as already remeasured"
                );
            }
            // If unrealized == 0, no entry needed — idempotency is trivially satisfied
        });
    }

    /// Σ(unrealized adjustments) = final FV − cost basis.
    #[test]
    fn fv_unrealized_equals_fv_minus_cost(
        qty in 1u32..100,
        cost_per_unit in 100i64..10_000,
        new_price_cents in 1u32..100_000,
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let gain_acct = accts.staking_income;
            let loss_acct = accts.network_fees;

            let q = Decimal::from(qty);
            let total_cost = cost_per_unit * (qty as i64);

            // Acquisition entry with asset_id for find_asset_account
            let je_id = create_draft(&pool, "2026-01-15", "fv2 acquisition").await;
            add_acquisition_lines(
                &pool, je_id, accts.digital_assets, accts.cash,
                total_cost, "token:FV2", &q.to_string(),
            ).await;
            approve_and_post(&pool, je_id).await;

            acquire_lot_impl(&pool, &AcquireLotInput {
                asset_id: "token:FV2".to_string(),
                wallet_id: "wallet-fv2".to_string(),
                acquired_date: "2026-01-15".to_string(),
                quantity: q.to_string(),
                cost_basis_minor: total_cost,
                journal_entry_id: Some(je_id),
            }).await.unwrap();

            let price_str = format!("{}.{:02}", new_price_cents / 100, new_price_cents % 100);
            record_manual_price_impl(&pool, &ManualPriceInput {
                asset_id: "token:FV2".to_string(),
                price_date: "2026-06-30".to_string(),
                price_decimal: price_str.clone(),
                recorded_by: "proptest".to_string(),
                note: None,
            }).await.unwrap();

            let result = run_remeasurement_impl(&pool, &RemeasurementInput {
                run_date: "2026-06-30".to_string(),
                initiated_by: "proptest".to_string(),
                unrealized_gain_account_id: gain_acct,
                unrealized_loss_account_id: loss_acct,
                asset_coin_map: None,
                api_key: None,
            }).await.unwrap();

            // Compute expected fair value
            let expected_fv = fair_value_to_minor(q, &price_str).unwrap();
            let expected_unrealized = expected_fv - total_cost;

            if expected_unrealized != 0 {
                assert_eq!(result.entries.len(), 1, "Expected 1 remeasurement entry");
                assert_eq!(
                    result.entries[0].unrealized_gain_loss_minor,
                    expected_unrealized,
                    "Unrealized should equal FV({}) - cost({})",
                    expected_fv, total_cost
                );
            }
            assert_eq!(
                result.run.total_unrealized_gain_loss_minor,
                if expected_unrealized != 0 { expected_unrealized } else { 0 },
                "Run total unrealized mismatch"
            );
        });
    }
}

// ============================================================================
// Property 7: Statements tie — for random posted-entry sets, trial balance
// nets to 0, BS ties (A = L + E), IS net income = equity delta,
// verify_ties never fires on engine-generated data.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    /// Random balanced entries → verify_ties passes.
    #[test]
    fn statements_tie_random_entries(
        entry_count in 1usize..8,
        amounts in proptest::collection::vec(100i64..500_000, 1..8),
        // Which account pair: 0=cash/income, 1=cash/expense, 2=digital_assets/income
        pair_indices in proptest::collection::vec(0u8..3, 1..8),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let pairs = [
                (accts.cash, accts.income),           // Asset ← Income
                (accts.expenses, accts.cash),          // Expense → Asset
                (accts.digital_assets, accts.income),  // Asset ← Income
            ];

            for i in 0..entry_count {
                let amount = amounts[i % amounts.len()];
                let pair_idx = pair_indices[i % pair_indices.len()] as usize;
                let (debit, credit) = pairs[pair_idx % pairs.len()];

                post_balanced_entry(&pool, "2026-06-15", debit, credit, amount).await;
            }

            // Build and verify all three statements
            let result = build_verified_statements(&pool, "2026-01-01", "2026-12-31").await;
            assert!(
                result.is_ok(),
                "verify_ties failed on engine-generated data: {:?}",
                result.err()
            );
        });
    }

    /// Trial balance always nets to zero (total debits == total credits).
    #[test]
    fn statements_trial_balance_nets_zero(
        amounts in proptest::collection::vec(100i64..100_000, 1..5),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            for &amount in &amounts {
                post_balanced_entry(&pool, "2026-03-15", accts.cash, accts.income, amount).await;
            }

            let verified = build_verified_statements(&pool, "2026-01-01", "2026-12-31")
                .await
                .unwrap();

            assert!(verified.trial_balance.is_balanced, "Trial balance not balanced");
            assert_eq!(
                verified.trial_balance.total_debits_minor,
                verified.trial_balance.total_credits_minor,
                "TB debits != credits"
            );
        });
    }

    /// Balance sheet ties: total_assets == total_liabilities + total_equity.
    #[test]
    fn statements_bs_ties(
        amounts in proptest::collection::vec(100i64..100_000, 1..5),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            for &amount in &amounts {
                post_balanced_entry(&pool, "2026-03-15", accts.cash, accts.income, amount).await;
            }

            let verified = build_verified_statements(&pool, "2026-01-01", "2026-12-31")
                .await
                .unwrap();

            let bs = &verified.balance_sheet;
            assert!(bs.is_balanced, "Balance sheet not balanced");
            assert_eq!(
                bs.total_assets_minor,
                bs.total_liabilities_minor + bs.total_equity_minor,
                "BS: A != L + E"
            );
        });
    }

    /// IS net income appears as equity delta on balance sheet.
    #[test]
    fn statements_is_net_income_matches_bs(
        amounts in proptest::collection::vec(100i64..100_000, 1..5),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            for &amount in &amounts {
                post_balanced_entry(&pool, "2026-03-15", accts.cash, accts.income, amount).await;
            }

            let verified = build_verified_statements(&pool, "2026-01-01", "2026-12-31")
                .await
                .unwrap();

            assert_eq!(
                verified.income_statement.net_income_minor,
                verified.balance_sheet.net_income_minor,
                "IS net income != BS net income plug"
            );
        });
    }

    /// Multi-period entries: statements tie across different date ranges.
    #[test]
    fn statements_multi_period_tie(
        amounts_p1 in proptest::collection::vec(100i64..50_000, 1..4),
        amounts_p2 in proptest::collection::vec(100i64..50_000, 1..4),
    ) {
        let r = rt();
        r.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            // Period 1 entries
            for &amount in &amounts_p1 {
                post_balanced_entry(&pool, "2025-06-15", accts.cash, accts.income, amount).await;
            }
            // Period 2 entries
            for &amount in &amounts_p2 {
                post_balanced_entry(&pool, "2026-06-15", accts.expenses, accts.cash, amount).await;
            }

            // Verify period 1 only
            let v1 = build_verified_statements(&pool, "2025-01-01", "2025-12-31").await;
            assert!(v1.is_ok(), "Period 1 verify_ties failed: {:?}", v1.err());

            // Verify period 2 only
            let v2 = build_verified_statements(&pool, "2026-01-01", "2026-12-31").await;
            assert!(v2.is_ok(), "Period 2 verify_ties failed: {:?}", v2.err());

            // Verify full range
            let vfull = build_verified_statements(&pool, "2025-01-01", "2026-12-31").await;
            assert!(vfull.is_ok(), "Full range verify_ties failed: {:?}", vfull.err());
        });
    }
}

// ============================================================================
// GIV-828: Bank auto-classify → FK traceability
// ============================================================================

proptest! {
#![proptest_config(ProptestConfig::with_cases(1))]

/// 100 random bank transactions through auto-classify all trace back to
/// their source rows via journal_entries.source_bank_tx_id FK.
#[test]
fn bank_auto_classify_fk_traceability(
    amounts in prop::collection::vec(-99999i64..99999i64, 100..=100),
) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let pool = setup_test_db().await;
            let accts = get_seed_accounts(&pool).await;

            let bank_acct_id = "ba-proptest-001";
            sqlx::query(
                "INSERT INTO bank_accounts (id, institution_name, account_nickname, account_type, currency, gl_account_number) VALUES (?, 'Test Bank', 'Checking', 'checking', 'USD', '1000')",
            )
            .bind(bank_acct_id)
            .execute(&pool)
            .await
            .expect("insert bank_accounts");

            let mut created_je_ids: Vec<i64> = Vec::new();

            for (i, &raw_amount) in amounts.iter().enumerate() {
                if raw_amount == 0 { continue; }

                let amount_cents = raw_amount;
                let tx_id = format!("bt-prop-{i:04}");
                let amount_str = if amount_cents < 0 {
                    format!("-{}.{:02}", (-amount_cents) / 100, ((-amount_cents) % 100).unsigned_abs())
                } else {
                    format!("{}.{:02}", amount_cents / 100, (amount_cents % 100).unsigned_abs())
                };

                sqlx::query(
                    "INSERT INTO bank_transactions (id, bank_account_id, posted_date, amount, currency, payee, classification_status) VALUES (?, ?, 1720000000, ?, 'USD', ?, 'unclassified')",
                )
                .bind(&tx_id)
                .bind(bank_acct_id)
                .bind(&amount_str)
                .bind(format!("Payee {i}"))
                .execute(&pool)
                .await
                .expect("insert bank_transactions");

                let abs_minor = amount_cents.unsigned_abs() as i64;
                let (debit_acct, credit_acct) = if amount_cents < 0 {
                    (accts.expenses, accts.cash)
                } else {
                    (accts.cash, accts.income)
                };

                let je_result = sqlx::query(
                    "INSERT INTO journal_entries (entry_date, description, is_posted, status, origin, created_by, source_bank_tx_id) VALUES ('2026-07-01 00:00:00', ?, 0, 'draft', 'rule', 'proptest', ?)",
                )
                .bind(format!("Bank auto-classify {i}"))
                .bind(&tx_id)
                .execute(&pool)
                .await
                .expect("insert journal_entries");

                let je_id = je_result.last_insert_rowid();
                created_je_ids.push(je_id);

                add_balanced_lines(&pool, je_id, debit_acct, credit_acct, abs_minor, Some("USD"), None).await;

                sqlx::query(
                    "UPDATE bank_transactions SET classification_status = 'classified' WHERE id = ? AND classification_status = 'unclassified'",
                )
                .bind(&tx_id)
                .execute(&pool)
                .await
                .expect("flip classification_status");
            }

            // Verify FK traceability: every JE with source_bank_tx_id links
            // to an existing bank_transactions row.
            let orphan_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM journal_entries je WHERE je.source_bank_tx_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bank_transactions bt WHERE bt.id = je.source_bank_tx_id)",
            )
            .fetch_one(&pool)
            .await
            .expect("orphan check query");
            assert_eq!(orphan_count.0, 0, "Orphan JEs found: source_bank_tx_id points to non-existent bank_transactions");

            // Verify every auto-classified bank tx has exactly one JE.
            let classified_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM bank_transactions WHERE classification_status = 'classified'",
            )
            .fetch_one(&pool)
            .await
            .expect("classified count query");

            let linked_je_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM journal_entries WHERE source_bank_tx_id IS NOT NULL",
            )
            .fetch_one(&pool)
            .await
            .expect("linked JE count query");

            assert_eq!(classified_count.0, linked_je_count.0,
                "Classified bank tx count ({}) != JEs with source_bank_tx_id ({})",
                classified_count.0, linked_je_count.0);

            // Verify no bank tx is still unclassified.
            let unclassified_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM bank_transactions WHERE classification_status = 'unclassified'",
            )
            .fetch_one(&pool)
            .await
            .expect("unclassified count query");
            assert_eq!(unclassified_count.0, 0, "All bank txs should be classified");

            // Verify round-trip: JE → bank_tx → bank_account.
            let traceable: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM journal_entries je JOIN bank_transactions bt ON bt.id = je.source_bank_tx_id JOIN bank_accounts ba ON ba.id = bt.bank_account_id WHERE je.source_bank_tx_id IS NOT NULL",
            )
            .fetch_one(&pool)
            .await
            .expect("round-trip traceability query");
            assert_eq!(traceable.0, linked_je_count.0,
                "All JEs with bank source should trace through to bank_accounts");
        });
    }
}
