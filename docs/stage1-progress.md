# Stage 1 Progress Tracker — Double-Entry Accounting Engine

Session constitution: `SCOPE.md` (repo root). Stage 1 mandate: GIV-668.
Gate 1: CPA-reviewed statements from real imported transactions, manually
classified through the approval queue.

**Current phase: 2 (Posting engine and general ledger) — Phase 1 landed;
Phase 2 implemented by Engineer (GIV-677): approval gate, atomic idempotent
posting, reversing entries, per-asset balances.**

## Phase Checklist

- [x] **Phase 0 — Reconnaissance and tracker** (report below; migration plan
      approved by board 2026-07-15)
- [x] **Phase 1 — Balance enforcement at the data layer**
      (GIV-665 pre-landed triggers; M1–M3 migrations, `PostedEntry` Rust type,
      exact-integer balance enforcement, per-asset quantity balance,
      frontend minor-unit display — all landed by Engineer, GIV-673)
- [x] **Phase 2 — Posting engine and general ledger**
      (GIV-677: approval gate, atomic idempotent posting, reversing entries,
      per-asset balances, trial balance verification — Engineer)
- [ ] **Phase 3 — Approval queue and manual journal entry UI**
- [ ] **Phase 4 — Classification workflow: raw transactions → draft entries**
- [ ] **Phase 5 — Periods, close, and lock**
- [ ] **Phase 6 — Financial statements v1**
- [ ] **Phase 7 — Cost basis engine (FIFO first)**
- [ ] **Phase 8 — Fair-value measurement (ASU 2023-08)**
- [ ] **Phase 9 — Invariant test suite (proptest)**
- [ ] **Phase 10 — Gate 1 rehearsal**

---

## Phase 0 Report (recon at main `172938d`, 2026-07-14)

### 1. What exists

**SQLite schema (26+ migrations, `src-tauri/migrations/`):**

- `gl_accounts` — chart of accounts with `account_type`
  CHECK(Asset/Liability/Equity/Income/Expense), `normal_balance`
  CHECK(debit/credit), parent hierarchy, digital-asset subtypes. A default
  chart is seeded by `20260326…_add_classification_and_seed_accounts.sql`.
- `journal_entries` — header: date, entry_number, description, reference,
  `is_posted`, `is_reversed`, `reversed_by_entry_id`, `created_by`,
  timestamps.
- `journal_entry_lines` — `gl_account_id`, optional `token_id`,
  `debit_amount`/`credit_amount` (one-sided CHECK), line_number.
- `accounting_transactions` — token-level subsidiary ledger
  (quantity/unit_price/total_value, 21 transaction types, links to
  `journal_entry_id`).
- `transaction_lots` + `lot_disposals` — cost-basis lot tracking tables
  (FIFO/LIFO/HIFO enum), plus reporting views (`v_token_balances` etc.).
- `multi_chain_transactions` — raw imported transactions (Layer 1 evidence).
- `entities` — entity table exists but journal entries do NOT reference it.
- **GIV-665 (`20260714…_enforce_journal_balance.sql`, merged `172938d`):**
  no-born-posted trigger; posted-line immutability
  (INSERT/UPDATE/DELETE); rebuilt posting trigger (min 2 lines,
  COALESCE NULL-hole closed, 0.01 tolerance).

**Rust engine (`src-tauri/src/api/accounting.rs`, ~1000 lines + GIV-665
tests):** chart CRUD; journal entry get/list/create (create always inserts
`is_posted=0` drafts); `post_journal_entry` (flips `is_posted` under the
balance trigger); `void_journal_entry`; `auto_classify_transaction`
(heuristic raw-tx → draft entry, already writes `accounting_transactions`
linkage); `update_transaction_classification`; `get_account_balances`;
`get_trial_balance`; `get_unclassified_transaction_count`;
`get_draft_journal_entry_count`.

**Frontend:** `src/app/journal-entries/` (list + drawer, direct Tauri
`invoke`, desktop-only); `src/app/ledger/` chart of accounts;
`src/app/reports/` incl. `CostBasisReport.tsx` (FIFO computed in the
FRONTEND in JS numbers); transactions/wallets pages wired to
PersistenceService (GIV-467 converged the desktop tx path → SQLite).

**Persistence split (standing decision GIV-449):** desktop = SQLite via
Tauri invoke; web = IndexedDB. **Journal entries/GL are SQLite-only — the
IndexedDB path has no journal store at all.**

**Decimals:** `rust_decimal 1.35` already a dependency; used in
`core/currency_service.rs`, `core/substrate_currency.rs`, chain layers —
but NOT in the accounting engine.

### 2. What is stubbed / absent

- No accounting periods table, no close/lock anywhere (Phase 5 greenfield).
- No approval workflow: status is a single `is_posted` bool. "Draft" =
  `is_posted=0`. No approved-but-unposted state, no approver, no origin.
- No provenance columns (origin, approved_by, approved_at, posted_at).
- No balance-sheet / income-statement queries (only trial balance +
  account balances).
- No Rust-side cost-basis engine (lots tables exist; engine lives in
  frontend JS).
- No `PostedEntry` Rust type — balance is enforced only by SQL trigger.
- Web (IndexedDB) journal path: absent entirely.

### 3. Conflicts with the seven invariants

| #   | Invariant          | Finding                                                                                                                                                                                                                                                                                                                |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Balance structural | Partially met (GIV-665 triggers). Gaps: balance is checked as ONE aggregate sum across all assets (not per currency/asset); no Rust type-level enforcement; 0.01 float tolerance.                                                                                                                                      |
| 2   | No floats          | **Violated end-to-end.** `accounting.rs` money structs are `f64` (debit/credit/balances, lines 127–224); SQLite `DECIMAL(18,2)` has NUMERIC affinity = stored as float; frontend sums amounts as JS `number` (`JournalEntries.tsx:330–438`); frontend FIFO in JS numbers. Balance trigger compares float sums to 0.01. |
| 3   | Append-only        | **Violated:** `void_journal_entry` (accounting.rs:604) just flips `is_reversed=1`; no reversing entry is generated; `reversed_by_entry_id` is never populated. Posted-line immutability (GIV-665) does hold.                                                                                                           |
| 4   | Reports are views  | Met so far (trial balance is a query; reporting views derive).                                                                                                                                                                                                                                                         |
| 5   | Raw tx immutable   | Met in classification path (`auto_classify_transaction` only reads `multi_chain_transactions`); no code mutates raw tx during classification.                                                                                                                                                                          |
| 6   | Read-only wallets  | Met; nothing here touches signing.                                                                                                                                                                                                                                                                                     |
| 7   | Provenance         | **Absent:** no origin/approver/timestamps beyond created_by/created_at.                                                                                                                                                                                                                                                |

### 4. Float inventory (Invariant 2 remediation targets)

- Rust: `src-tauri/src/api/accounting.rs` — 14 `f64` sites (JournalEntryLine
  debit/credit, TrialBalanceRow, AccountBalance, balance query at :577,
  amount parsing at :656–657, :947).
- SQLite: `DECIMAL(p,s)` columns in `journal_entry_lines`,
  `accounting_transactions`, `transaction_lots`/`lot_disposals`,
  currencies/exchange-rate tables (NUMERIC affinity = float storage).
- TypeScript: journal-entries UI sums (`JournalEntries.tsx`), CostBasisReport
  FIFO math, price/amount fields throughout tx views (JS `number`).
- Out of Stage-1 scope but noted: price feeds (`coingecko.rs`, `fixer.rs`)
  and chain balance parsing use `f64` — display/ingest only; convert at the
  accounting boundary.

### 5. Proposed Phase 1 migrations (NOT implemented — awaiting board approval)

All migrations append-only, SQLite path first (web path lags per mandate).

**M1 — journal-entry header lifecycle + provenance**

- Add to `journal_entries`: `entity_id` (FK `entities`, nullable initially),
  `status` TEXT CHECK('draft','approved','posted','voided') backfilled from
  `is_posted`; `origin` TEXT CHECK('manual','rule','model') DEFAULT
  'manual' (only 'manual' produced in Stage 1); `approved_by` TEXT,
  `approved_at`, `posted_at` DATETIME.
- Rebuild GIV-665 triggers against `status` transitions (draft→approved→
  posted; posted/voided frozen); keep `is_posted` as a generated/synced
  column during transition so existing code keeps working, then retire it.

**M2 — exact-decimal amounts (the decision point, §6 Q1)**

- Recommended: new columns storing amounts as INTEGER minor units in the
  functional currency (exactly trigger-summable) + `quantity` as TEXT
  canonical decimal validated by `rust_decimal` in Rust; balance trigger
  compares integer sums for exact equality (tolerance 0, not 0.01).

**M3 — per-asset balance**

- Add `asset_id`/currency dimension to `journal_entry_lines` (generalize
  `token_id`; fiat 'USD' included); posting trigger validates balance PER
  asset group; measurement lines (functional-currency valuation) carry the
  cross-asset events. Convention documented in `docs/accounting-model.md`
  (Phase 1 deliverable).

**Rust type work (no migration):** `PostedEntry` constructible only via a
balanced-lines constructor (`rust_decimal` sums, per-asset), used by every
persistence path; `f64` removed from accounting money structs.

### 6. Open questions / decisions needed (board)

1. **Q1 — amount representation.** (a) INTEGER minor units for functional-
   currency value + TEXT decimal for token quantity (recommended: exact,
   trigger-summable, i64-safe since value is USD cents; 18-decimal token
   quantities overflow i64 so they go TEXT and are Rust-validated);
   (b) TEXT decimals everywhere (exact but SQL triggers cannot sum them —
   balance enforcement would live only in Rust); (c) keep floats (violates
   Invariant 2 — rejected).
2. **Q2 — multi-asset balance convention.** Recommend: every line carries
   functional-currency value; entries must balance in functional currency
   ALWAYS, and per-asset in quantity terms for asset-to-asset moves; swaps
   /gifts balance through explicit measurement lines. To be written up in
   `docs/accounting-model.md` for sign-off during Phase 1.
3. **Q3 — existing `auto_classify_transaction` heuristic.** It predates
   Stage 1 and is effectively a small rules engine (prompt says "no rules
   engine"). Recommend: leave code in place, but Stage-1 UI drives manual
   classification only; entries it creates would be origin='rule' when it
   is re-enabled in Stage 2. Confirm.
4. **Q4 — `void_journal_entry`** flag-flip replaced by generated reversing
   entries in Phase 2 (Invariant 3). Confirm.
5. **Q5 — web (IndexedDB) journal path.** None exists today. Building a
   second full engine in IndexedDB duplicates the invariant surface.
   Recommend: Stage 1 targets desktop (SQLite) as the system of record;
   web journal path deferred, revisit after Gate 1. Confirm.

### 7. Decisions log

- 2026-07-14 — Phase 0 recon complete; GIV-665 (data-layer balance
  triggers) recognized as pre-landed Phase-1 work. Migration plan M1–M3
  submitted to board for approval (GIV-668 confirmation).
- 2026-07-15 — **Board APPROVED the Phase 1 plan and all five
  recommendations** (GIV-668 confirmation `a32590f3`, no overrides):
  Q1 = INTEGER minor units + TEXT `rust_decimal` quantities, zero
  tolerance; Q2 = functional-currency balance always + per-asset quantity
  balance with explicit measurement lines; Q3 = `auto_classify_transaction`
  parked, manual-only Stage 1, `origin='rule'` on Stage-2 re-enable;
  Q4 = void → generated reversing entries (Phase 2); Q5 = web/IndexedDB
  journal path deferred past Gate 1, SQLite is the system of record.
  Conventions written up in `docs/accounting-model.md`.

### 8. Session log

- **Session 1 (2026-07-14, CTO):** Phase 0 recon + this tracker. No
  functional changes. Next step: on board approval of §5/§6 → delegate
  Phase 1 implementation (M1–M3 + `PostedEntry` type + tests).
- **Session 2 (2026-07-15, CTO):** Phase 0 acceptance gate cleared (board
  approval). Authored `docs/accounting-model.md` (approved conventions,
  measurement-line worked example, reserved sections for Phases 7/8).
  Delegated Phase 1 implementation to Engineer as a GIV-668 child issue:
  M1 (lifecycle + provenance columns), M2 (exact-decimal amounts), M3
  (per-asset balance), Rust `PostedEntry` constructible only from balanced
  lines, and the acceptance test that no public API path can persist an
  unbalanced posted entry. Docs-only session; no engine code touched.
- **Session 3 (2026-07-14, Engineer — GIV-673):** Implemented Phase 1
  migrations and Rust/frontend changes:
  - **M1** (`20260715000001_journal_entry_lifecycle.sql`): lifecycle
    columns (`entity_id`, `status`, `origin`, `approved_by`, `approved_at`,
    `posted_at`); backfilled status from `is_posted`; rebuilt GIV-665
    triggers against `status` column; state machine: draft→approved→posted,
    voided terminal. Same-write pattern keeps `is_posted` synced (no
    bidirectional triggers — they cause circular firing).
  - **M2** (`20260715000002_exact_decimal_amounts.sql`): `debit_minor`/
    `credit_minor` (INTEGER, USD cents) + `quantity` (TEXT canonical decimal);
    backfilled from `ROUND(amount*100)`; one-sided enforcement triggers;
    replaced float-tolerance balance triggers with exact-integer comparison
    (zero tolerance).
  - **M3** (`20260715000003_per_asset_balance.sql`): `asset_id` TEXT
    column (`'USD'`/`'token:<id>'`); per-asset quantity balance trigger
    checks assets appearing on BOTH debit and credit sides (one-sided
    assets are valid for swaps/measurement lines).
  - **M4** (`20260715000004_update_views_minor_units.sql`): rebuilt
    `v_account_balances`, `v_trial_balance`, `v_balance_sheet`,
    `v_income_statement` to use minor-unit columns.
  - **Rust**: `PostedEntry` type (private fields, constructor validates:
    ≥2 lines, one-sided, non-zero, exact functional-currency balance,
    per-asset quantity balance for dual-sided assets). Removed `f64` from
    `JournalEntryLineInput`, `AccountBalance`, `TrialBalanceRow`. Updated
    `create_journal_entry`, `post_journal_entry`, `auto_classify_transaction`
    for minor units.
  - **Frontend**: `JournalEntries.tsx`, `JournalEntryDrawer.tsx`,
    `TrialBalance.tsx` updated for minor-unit display (`/100` at boundary).
    Type definitions updated in `database.ts` and `accounting.ts`.
  - **Tests**: 23 accounting tests pass (10 GIV-665 trigger tests updated,
    7 PostedEntry constructor tests, 1 swap worked example from
    `accounting-model.md`, 5 direct-SQL trigger tests). Full suite: 200+
    tests green, clippy clean.
- **Session 4 (2026-07-15, CTO — GIV-673 review):** Reviewed and hardened
  PR #213 before merge. Three gaps closed:
  - **Negative minor units** were accepted end-to-end: a `-100` debit is a
    credit smuggled onto the wrong side, so `(+100 debit, -100 debit)`
    passed the SUM balance checks while breaking the trial balance —
    violating the Phase 1 acceptance gate. Now rejected in
    `PostedEntry::new`, `create_journal_entry`, and the M2 one-sided
    triggers (INSERT + UPDATE).
  - **Legacy born-posted bypass**: the rebuilt born-posted trigger checked
    `status` only, so `INSERT ... is_posted=1, status='draft'` skipped the
    balance trigger while M4 views (which filter on `is_posted=1`) counted
    the entry as posted. Born-posted trigger now also blocks
    `NEW.is_posted=1`, and a new coherence trigger forces same-write:
    `is_posted=1` requires `status IN ('posted','voided')` in the same
    UPDATE (safe — every Rust write path already does same-write).
  - **Void path missed same-write**: `void_journal_entry` set
    `is_reversed=1` only, leaving `status='posted'`, so the status-based UI
    showed voided entries as posted. Now sets `status='voided'` in the same
    write and enforces the state machine (only posted entries can be
    voided).
  - 4 regression tests added (27 accounting tests total; full suite 198
    green; CI-equivalent clippy + fmt clean).
  - **Documented limitation** (non-blocking): the per-asset quantity
    trigger compares `CAST(quantity AS REAL)` — SQLite has no decimal type,
    so quantities beyond ~15 significant digits could false-pass at the SQL
    backstop layer. The Rust `PostedEntry` layer compares exactly via
    `rust_decimal` and is the authoritative gate; revisit if a non-Rust
    writer ever appears.
- **Session 5 (2026-07-15, Engineer — GIV-677):** Implemented Phase 2
  (posting engine + GL):
  - **M5** (`20260715000005_tighten_state_machine.sql`): tightened status
    transition trigger to remove `draft→posted` (requires approval);
    balance-validation trigger now fires only on `approved→posted`.
    Verified M4 views include voided entries (is_posted=1 filter already
    covers them — no view changes needed).
  - **`approve_journal_entry` Tauri command:** transitions `draft→approved`,
    sets `approved_by`/`approved_at`. Only drafts can be approved.
  - **Posting hardening:** `post_journal_entry` now requires status=approved;
    uses atomic conditional `UPDATE ... WHERE status='approved'` with
    `rows_affected` check for race-free posting. Idempotent: re-posting a
    posted entry returns it unchanged (no-op, `posted_at` untouched).
  - **Reversing entries:** `void_journal_entry` replaced from flag-flip to
    generating a full reversing entry: same lines with debit/credit swapped,
    posted through the balanced path, original marked `status='voided',
    is_reversed=1, reversed_by_entry_id=<new_id>`. Both entries remain in
    GL, net effect zero. Convention documented in `docs/accounting-model.md`
    ("Corrections and reversals" section).
  - **Per-asset balances:** new `get_account_balances_by_asset` Tauri command
    and `AssetBalance` type. Quantity sums computed in Rust via `rust_decimal`
    (never `CAST AS REAL` in SQL for reporting).
  - **Tests:** 6 new Phase 2 acceptance tests added: draft-cannot-post-
    without-approval (trigger), re-post is no-op, void generates reversing
    entry with GL net zero, voided entry frozen, trial balance debits==credits,
    per-asset balances correct for swap example. All existing tests updated
    for approval gate (draft→approved→posted path). Chart of accounts seed
    verified: covers small-business chart with correct account_type/
    normal_balance.
  - **Decisions:** no chart-of-accounts changes needed (seed is adequate);
    no view changes needed (voided entries correctly included via is_posted=1
    filter).
