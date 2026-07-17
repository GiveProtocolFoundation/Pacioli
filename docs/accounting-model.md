# Pacioli Accounting Model

This document records the accounting conventions the Pacioli engine
implements. It is the companion document to the financial statements and is
intended to be read by a reviewing CPA. Every convention here was proposed
in the Stage 1 Phase 0 recon (`docs/stage1-progress.md` §5–§6) and approved
by the board on 2026-07-15 (GIV-668).

Sections marked _(reserved)_ will be completed in the phase that implements
them; nothing in a reserved section is implemented yet.

## 1. Ledger structure

- **Double entry, per-entity.** Every journal entry belongs to an entity
  and consists of a header and two or more lines. Each line debits or
  credits exactly one general-ledger account.
- **Functional currency: USD.** All entries are measured in the entity's
  functional currency (USD in Stage 1). Token quantities are carried
  alongside as sub-ledger measures, never as a substitute for
  functional-currency measurement.
- **Layered records.** Raw imported blockchain transactions are Layer 1
  evidence and are immutable: classification creates journal entries that
  _reference_ raw transactions, never modifies them.

## 2. Amount representation (approved Q1)

- **Functional-currency values are stored as INTEGER minor units**
  (USD cents) in SQLite. Integer storage is exact and summable by
  database triggers, so the balance invariant is enforced with **zero
  tolerance** — not a rounding window.
- **Token quantities are stored as TEXT canonical decimals** and parsed
  with `rust_decimal` in the engine. Chain-native assets carry up to 18
  decimal places, which overflows a 64-bit integer at minor-unit scale;
  text-encoded exact decimals avoid both overflow and float error.
- **Floating-point numbers never represent money or quantities** in the
  accounting path — not in the database, not in Rust structs, not in the
  UI arithmetic that feeds persistence. Prices from external feeds may
  arrive as floats but are converted to exact decimals at the accounting
  boundary, and the conversion is the recorded measurement.

## 3. Balance invariant (approved Q2)

An entry is postable only if **both** of the following hold:

1. **Functional-currency balance, always.** The sum of debit values equals
   the sum of credit values in functional-currency minor units, exactly
   (tolerance zero). This is enforced by SQLite triggers at posting time
   and by the Rust `PostedEntry` type, which is constructible only from
   balanced lines.
2. **Per-asset quantity balance for asset movements.** For every
   currency/asset that appears on an entry's lines with a quantity, the
   entry's debit quantities equal its credit quantities _for that asset_,
   unless the difference is explicitly carried by measurement lines
   (below). Assets are never treated as fungible with each other.

### Measurement lines (cross-asset events)

Events that cross assets — a swap of token A for token B, a gift of tokens
measured in USD, fees paid in a third asset — do not balance per asset by
nature. They balance through **explicit measurement lines**: lines in the
functional currency that record the valuation applied to each asset leg
(e.g., realized gain/loss, income, or expense at fair value on the
transaction date). The measurement is therefore a visible, auditable line
in the entry, not an implicit conversion. Every measurement line records
the price used and its source (see §6 provenance and the Phase 8 price
framework).

Example — swap 10 A (basis $100, fair value $150) for 4 B:

| Line | Account                         | Asset | Qty | Debit   | Credit  |
| ---- | ------------------------------- | ----- | --- | ------- | ------- |
| 1    | Digital assets — B              | B     | +4  | $150.00 |         |
| 2    | Digital assets — A              | A     | −10 |         | $100.00 |
| 3    | Realized gain on digital assets | —     |     |         | $50.00  |

Lines 1–2 balance each asset's quantity movement; line 3 is the
measurement line carrying the valuation difference to net income. The
entry balances in USD exactly ($150.00 = $100.00 + $50.00).

## 4. Entry lifecycle and append-only corrections (approved Q4)

- **Lifecycle:** `draft → approved → posted`, with `voided` as the only
  terminal correction state. Drafts may be edited freely. Posted entries
  are immutable at the data layer (enforced by triggers).
- **Approval gate (Phase 2):** every entry must be approved before it can
  be posted. Direct `draft → posted` transitions are blocked by database
  triggers. Posting is atomic and idempotent: the conditional UPDATE posts
  exactly once even under concurrent calls, and re-posting an
  already-posted entry is a success no-op (returns the entry unchanged,
  `posted_at` untouched).
- **Corrections are reversing entries.** A posted entry is never edited or
  deleted. Voiding a posted entry generates and posts a full reversing
  entry, links the pair (`reversed_by_entry_id`), and records who voided
  it and why.
- Adjustments follow the same rule: new adjusting entries, never edits.

### Corrections and reversals

When a posted entry must be corrected, the engine generates a **reversing
entry** rather than editing or deleting the original. This preserves the
complete audit trail required for CPA review.

**Mechanism (implemented in Phase 2):**

1. The system creates a new journal entry with the same lines but debit
   and credit sides swapped (both functional-currency minor units and
   token quantities are preserved).
2. The reversing entry's description reads `Reversal of entry #<entry_number>`;
   its `origin` is copied from the original; its entry date is the date of
   the void operation.
3. The reversing entry is posted through the standard balanced-posting
   path (it must pass `PostedEntry` validation and database triggers).
4. The original entry is marked `status='voided'`, `is_reversed=1`, and
   `reversed_by_entry_id` is populated with the reversing entry's ID.

**Reporting convention:** Both the original and the reversing entry remain
in the general ledger and all financial reports. Their net effect is zero.
`voided` is a lifecycle marker meaning "this entry has been reversed"; it
is never used as an exclusion filter in views or queries. The M4 views
(`v_trial_balance`, `v_account_balances`, `v_balance_sheet`,
`v_income_statement`) include voided entries because they filter on
`is_posted=1`, which is true for both the original (before voiding sets
`is_posted` state) and the reversing entry.

**Frozen entries:** Once voided, the original entry is immutable — the
database triggers prevent any further status changes from `voided`.

## 5. Approval gate

Every journal entry — human-drafted or system-generated (e.g., Phase 8
remeasurement drafts) — enters the ledger through the approval queue. The
system never posts silently on its own behalf.

## 6. Provenance

Every entry records:

- **origin** — how it was drafted: `manual` (Stage 1), `rule` or `model`
  (reserved for Stage 2; the schema accepts them from day one so the audit
  trail never needs a migration to tell humans from machines apart).
- **approver and timestamps** — who approved it and when, and when it was
  posted, distinct from who created it.
- **evidence links** — references to the raw transaction(s) the entry
  classifies, where applicable.

## 7. Scope boundaries (Stage 1)

- Desktop (SQLite) is the system of record through Gate 1; the web
  (IndexedDB) journal path is deferred (approved Q5).
- The pre-existing `auto_classify_transaction` heuristic is parked:
  Stage 1 classification is manual-only. If re-enabled in Stage 2 its
  entries carry `origin='rule'` (approved Q3).
- Single entity books, US GAAP, USD functional currency. No IFRS, no
  parallel books, no multi-entity consolidation.

## 8. Periods and close (Phase 5)

Accounting periods define the time boundaries for financial reporting and
entry-date constraints. Monthly granularity is used in Stage 1.

### Period lifecycle

- **Open:** entries with dates inside the period can be drafted, approved,
  and posted normally.
- **Closed:** no entry whose `entry_date` falls inside the period can be
  posted. This is enforced at the database layer by a trigger that fires
  on the `approved → posted` transition — the same guard point as the
  balance-validation trigger (M5). Drafting and approving entries inside
  a closed period is permitted (they may be intended for a future reopen),
  but posting is blocked.
- **Reopen:** a closed period can be reopened. This is a deliberate audit
  event: the system records `reopened_by` and `reopened_at`. Once
  reopened, the period behaves as open again.

### Close prerequisites

A period can be closed only if **no draft or approved entries** exist with
`entry_date` inside the period. The close command counts pending entries
and rejects with an exact count if any remain. This prevents orphaned
in-flight entries from being silently locked away.

### Non-overlapping enforcement

Periods must not overlap (a date belongs to at most one period). SQLite
lacks exclusion constraints, so overlap detection is enforced in Rust
at creation time. The engine checks `period_start <= new_end AND
period_end >= new_start` before inserting a new period.

### Corrections in closed periods

Posted entries inside a closed period are already immutable (Phase 2
immutability triggers). Voiding a posted entry generates a reversing
entry with its own `entry_date` — which must fall in an **open** period.
The reversing entry is posted through the standard `draft → approved →
posted` path, so the closed-period trigger applies to it: if the
reversal's entry_date falls in a closed period, posting is rejected.

The convention is: corrections to entries in closed periods are dated
in the current open period. The reversal lands in the current period;
the net effect appears in the period where the reversing entry is dated.

### Idempotency

Close and reopen follow the Phase 2/3 conditional-UPDATE pattern:
`UPDATE ... WHERE status='open'` (or `='closed'`). Double-close and
double-reopen are 0-row no-ops — no error, no side effects.

## 9. Financial statements (Phase 6)

Financial statements are **derived views** over posted entries (Invariant 4):
no stored report tables, no snapshots. The Rust engine queries posted
journal entries within a date range, aggregates using i64 minor units
(no floats touch money — Invariant 2), and returns structured reports
with mechanically verified ties.

### Statement types

1. **Balance Sheet** — Assets, Liabilities, Equity **as of the period end
   date** (cumulative from inception: a balance sheet reports positions,
   not period movements, so opening balances are always included). Equity
   decomposes into contributed equity accounts, **retained earnings** (net
   income accumulated before the period start), and current-period net
   income.
2. **Income Statement** — Revenue (Income accounts) and Expenses for the
   selected period (start through end).
3. **Trial Balance** — All accounts with non-zero cumulative balances
   **as of the period end date** (conventional "trial balance as at
   date", consistent with the M4 views and the Phase 2 balances).

### Account classification for statements

| Account Type | Statement        | Section     | Sign convention                 |
| ------------ | ---------------- | ----------- | ------------------------------- |
| Asset        | Balance Sheet    | Assets      | Debit − Credit (natural debit)  |
| Liability    | Balance Sheet    | Liabilities | Credit − Debit (natural credit) |
| Equity       | Balance Sheet    | Equity      | Credit − Debit (natural credit) |
| Income       | Income Statement | Revenue     | Credit − Debit (natural credit) |
| Expense      | Income Statement | Expenses    | Debit − Credit (natural debit)  |

### How net income ties to equity

There is no journal-entry closing process in Stage 1: Income and Expense
accounts are never closed into an equity account. Instead the balance
sheet derives the equity roll-forward from the ledger on every run:

    Retained Earnings = Net Income accumulated from inception
                        through the day before the period start
    Total Equity      = Equity accounts + Retained Earnings
                        + Current-Period Net Income
    Total Assets      = Total Liabilities + Total Equity

If the last equation does not hold, statement generation **fails loudly**
— the `verify_ties` function returns an error and the UI never renders a
statement that does not tie.

### Tie verification (`verify_ties`)

Before any statement is returned to the UI or exported, the engine builds
all three statements for the period and runs four checks (current AND
comparative prior period both pass through the same gate):

1. **Balance sheet ties**: Assets = Liabilities + Equity (incl. retained
   earnings and current-period net income)
2. **Net income consistency**: Income Statement net income = Balance Sheet
   current-period net income
3. **Trial balance is in balance**: Total debits = Total credits
4. **Cross-check**: Trial balance cumulative net income (Income −
   Expense as of the end date) = Balance Sheet retained earnings +
   current-period net income

A failure on any check is a hard error — the statement is never rendered
silently with incorrect figures.

### Period filtering

Only **posted** entries feed statements, filtered by `entry_date`:
cumulative aggregation (inception..=end) for balance sheet and trial
balance, period aggregation (start..=end) for the income statement and
the net-income split. The posted/date predicates are applied in the SQL
WHERE clause over INNER JOINs — never on a chained LEFT JOIN's ON clause,
which would silently leak draft and out-of-period lines into the sums
(regression covered by DB integration tests). Voided entries net out via
their reversing entries (both are posted and included in aggregation).

### Comparative periods

Each statement includes a **comparative prior period** of the same
day-count duration, ending the day before the current period starts (for
example, the prior period of 2025-01-01..2025-12-31 is
2024-01-02..2024-12-31 — equal duration, not calendar-aligned). The
comparative balance sheet and trial balance are "as of" the prior period
end date. The UI shows both periods side by side with percentage change.

### CSV export

All three statements can be exported to CSV. The export runs the same
`verify_ties` check — a statement that does not tie cannot be exported.

## 10. Cost basis (Phase 7)

### Lot tracking

Every acquisition of a digital asset opens a **lot** scoped to a specific
wallet address and asset identifier. A lot records:

- the quantity acquired (canonical decimal string, `rust_decimal`);
- the total cost basis in functional-currency minor units (USD cents);
- the date acquired (accounting date);
- the remaining un-consumed quantity.

Lots are **append-only**: consumption is recorded in a separate
`lot_consumptions` table, never by destructive updates that lose history
(Invariant 7, provenance). The `remaining_quantity` field on the lot is
updated atomically in the same transaction as the consumption insert.

### Cost basis method — FIFO (trait-based)

Disposals consume lots in **First-In, First-Out** order: the oldest
lots (by `acquired_date`, then `id`) are consumed first. The selection
method is abstracted behind a `LotSelector` trait so that LIFO, HIFO,
and specific-ID methods can be added later without changing the
consumption engine.

### Realized gain/loss

When an asset is disposed (sale, swap, or other realization event):

1. The engine selects open lots for the disposed asset and wallet in
   FIFO order.
2. Each lot is consumed proportionally:
   `portion_cost = (quantity_consumed / lot_quantity) × lot_cost_basis`.
3. Proceeds are allocated proportionally across consumed lots
   (last lot receives the remainder to avoid rounding drift).
4. Realized gain/loss per lot portion = proceeds − cost basis.
5. A `lot_consumptions` record is created with `event_type = 'disposal'`.
6. Holding period is computed (event date − acquired date) and
   long-term status (≥ 365 days) is recorded.

The journal entry for the disposal (debit Cash/Receivable, credit
Digital Assets, debit/credit Realized Gain/Loss) goes through the
normal `draft → approved → posted` lifecycle. The cost basis engine
is called **after** posting to record the lot consumption.

### Transfers between own wallets

A transfer between wallets owned by the same entity is **not a
realization event**. The treatment:

1. Source lots are consumed in FIFO order, same as a disposal.
2. New lots are created in the destination wallet preserving the
   **original acquired date** and **proportional cost basis**.
3. `lot_consumptions` records are created with `event_type = 'transfer'`,
   `proceeds_minor = 0`, `realized_gain_loss_minor = 0`, and
   `destination_lot_id` linking to the new lot.
4. The journal entry for the transfer (debit Crypto Assets wallet-B /
   credit Crypto Assets wallet-A) moves the carrying amount between
   sub-accounts without touching income/expense accounts.

This interacts with Phase 4's transfer classification: when a raw
blockchain transfer is classified and the from/to addresses both belong
to the user's tracked wallets (`user_wallets` table), the transfer is
a non-realizing lot move. Future phases may automate this detection.

### Amount representation

Consistent with §2:

- Quantities: TEXT canonical decimals (`rust_decimal`), up to 18
  decimal places for chain-native assets.
- Cost basis, proceeds, gain/loss: INTEGER minor units (USD cents),
  exact arithmetic, no floats.
- Proportional cost basis uses `rust_decimal` division and rounds
  with `MidpointAwayFromZero` (the existing `decimal_to_minor_units`
  convention).

## 11. Fair-value measurement (Phase 8, ASU 2023-08)

ASU 2023-08 requires that in-scope digital assets (crypto assets that are
not themselves financial instruments) be measured at fair value in each
reporting period, with changes recognized in net income.

### Remeasurement trigger

Fair-value remeasurement is a **period-end step**: at each period close the
engine remeasures all holdings to their fair value on the period-end date.
The flow is: **remeasure → approve → post → close**.

### Price source — trait-based, configurable

Prices are obtained through the `PriceSource` trait. One concrete provider
is shipped in Stage 1:

- **CoinGeckoPriceSource** — uses the existing CoinGecko historical-price
  API already in the codebase (`api::price_feeds::coingecko`). Accepts an
  asset-to-coin-ID mapping at remeasurement time.

A **manual price override** is always available and takes precedence over
API-sourced prices. Manual overrides are recorded with the real authed
user identity (never 'system') and an optional note explaining the source.

### Price observations (append-only)

Every price used in a remeasurement — API-fetched or manually entered —
is recorded in the `price_observations` table with:

- asset identifier, date, price in minor units and as a decimal string;
- source (`'coingecko'`, `'manual'`);
- the CoinGecko coin ID (for API sources);
- who recorded it (real user identity);
- optional note (for manual overrides).

Observations are **append-only**: database triggers prevent UPDATE and
DELETE (Invariant 7). A later observation for the same asset/date is a
new row, not an overwrite.

### Float boundary handling

External price feeds (CoinGecko) return floating-point values. These are
converted to exact `rust_decimal::Decimal` at the accounting boundary:

1. The raw price string (e.g. `"3500.123456789012345678"`) is recorded
   in `price_decimal` (TEXT, full precision).
2. Fair value in minor units is computed as:
   `quantity × price_per_unit × 100`, rounded with
   `MidpointAwayFromZero` (the same convention as cost basis).
3. The resulting `i64` minor-unit value is the number of record.
   No float touches the ledger.

### Adjusting entries — draft only

Remeasurement generates **draft adjusting journal entries** into the
approval queue (§5). The system never posts silently on its own behalf:

- **Unrealized gain** (fair value > carrying amount):
  Dr Digital Assets (asset account), Cr Unrealized Gain on Digital
  Assets (income account).
- **Unrealized loss** (fair value < carrying amount):
  Dr Unrealized Loss on Digital Assets (expense account), Cr Digital
  Assets (asset account).

Each draft entry:

- has `origin = 'rule'` (system-generated);
- has `created_by` set to the real user who initiated the remeasurement;
- references the specific price observation used;
- is linked to a `remeasurement_runs` audit record.

### Remeasurement run audit trail

Each remeasurement execution creates:

1. A `remeasurement_runs` record: date, who initiated it, holdings
   count, entries generated, total unrealized gain/loss, status
   (`'completed'` or `'partial'` if some assets had no price).
2. A `remeasurement_entries` row per holding remeasured: links the run,
   the draft journal entry, the asset, wallet, price observation,
   carrying amount, fair value, and unrealized gain/loss.

All three tables (`price_observations`, `remeasurement_runs`,
`remeasurement_entries`) are protected by append-only triggers.

### Integration with cost basis lots

The carrying amount for an asset in a wallet is the sum of
`cost_basis_minor` across open (non-closed) lots for that
asset+wallet pair — the same aggregation as `get_lot_summary` (§10).
Fair value is computed as `total_remaining_quantity × price_per_unit`.

### Amount representation

Consistent with §2:

- Quantities: TEXT canonical decimals (`rust_decimal`).
- Prices, fair values, carrying amounts, gain/loss: INTEGER minor
  units (USD cents), exact arithmetic, no floats.
- Proportional values use `rust_decimal` division and round with
  `MidpointAwayFromZero`.
