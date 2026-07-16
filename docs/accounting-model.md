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

1. **Balance Sheet** — Assets, Liabilities, Equity for a selected period.
   Equity includes the current-period net income computed from Income and
   Expense accounts.
2. **Income Statement** — Revenue (Income accounts) and Expenses for a
   selected period.
3. **Trial Balance** — All accounts with non-zero activity in the period,
   showing debit and credit balances.

### Account classification for statements

| Account Type | Statement        | Section     | Sign convention                 |
| ------------ | ---------------- | ----------- | ------------------------------- |
| Asset        | Balance Sheet    | Assets      | Debit − Credit (natural debit)  |
| Liability    | Balance Sheet    | Liabilities | Credit − Debit (natural credit) |
| Equity       | Balance Sheet    | Equity      | Credit − Debit (natural credit) |
| Income       | Income Statement | Revenue     | Credit − Debit (natural credit) |
| Expense      | Income Statement | Expenses    | Debit − Credit (natural debit)  |

### How net income ties to equity

The balance sheet includes a **net income plug**: current-period net income
(Revenue − Expenses) is added to the Equity section. The tie assertion is:

    Total Assets = Total Liabilities + (Equity + Net Income)

If this equation does not hold, the statement generation **fails loudly**
— the `verify_ties` function returns an error and the UI never renders a
statement that does not tie.

### Tie verification (`verify_ties`)

Before returning any statement to the UI, the engine runs four checks:

1. **Balance sheet ties**: Assets = Liabilities + Equity (incl. net income)
2. **Net income consistency**: Income Statement net income = Balance Sheet
   net income plug
3. **Trial balance is in balance**: Total debits = Total credits
4. **Cross-check**: Trial balance net income (Income credits − Expense
   debits) = Income Statement net income

A failure on any check is a hard error — the statement is never rendered
silently with incorrect figures.

### Period filtering

Statements accept a start date and end date. Only posted entries with
`entry_date` within the range are included. Voided entries net out via
their reversing entries (both are posted and included in aggregation).

### Comparative periods

Each statement includes a **comparative prior period** of the same
duration, immediately preceding the current period. For example, if the
current period is 2025-01-01 to 2025-12-31, the prior period is
2024-01-01 to 2024-12-31. The UI shows both periods side by side with
percentage change.

### CSV export

All three statements can be exported to CSV. The export runs the same
`verify_ties` check — a statement that does not tie cannot be exported.

## 10. Transfers between own wallets _(reserved — Phase 7)_

Treatment of lot movement without realization will be documented when the
cost-basis engine lands.

## 10. Cost basis _(reserved — Phase 7)_

FIFO lot relief, per wallet per asset; method documented with the engine.

## 11. Fair-value measurement _(reserved — Phase 8)_

ASU 2023-08 remeasurement conventions, price sources, and override policy
will be documented with the measurement framework.
