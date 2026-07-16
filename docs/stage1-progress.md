# Stage 1 Progress Tracker — Double-Entry Accounting Engine

Session constitution: `SCOPE.md` (repo root). Stage 1 mandate: GIV-668.
Gate 1: CPA-reviewed statements from real imported transactions, manually
classified through the approval queue.

**Current phase: 5 (Accounting periods) — Phases 1-4 landed;
Phase 5 implemented by Engineer (GIV-684): accounting_periods table,
closed-period posting trigger, period lifecycle commands, Periods UI.**

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
- [x] **Phase 3 — Approval queue and manual journal entry UI**
      (GIV-678: approval queue with all lifecycle tabs, approve/post/void/demote
      actions, manual journal entry form with integer-math balance indicator,
      entry detail view with reversal linkage, per-asset quantity hints — Engineer)
- [x] **Phase 4 — Classification workflow: raw transactions → draft entries**
      (GIV-683: classification queue view with auto/manual/skip actions,
      rust_decimal precision at boundary, provenance: origin=rule for
      auto-classified entries, classification_status flip — Engineer)
- [x] **Phase 5 — Periods, close, and lock**
      (GIV-684: accounting_periods table with open/closed lifecycle,
      DB trigger blocks posting into closed periods, list_periods/
      close_period/reopen_period commands, Periods UI with confirm
      modals, reopen audit log, 9 Rust tests — Engineer)
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
- **Session 6 (2026-07-15, CTO — GIV-677 review):** Reviewed and hardened
  Phase 2 before merge. Three gaps closed:
  1. `void_journal_entry` ran ~7 auto-commit statements against the pool
     instead of the mandated single transaction — a crash mid-void (or a
     concurrent double-void) could leave a posted reversing entry with the
     original still posted, i.e. a duplicate reversal in the GL. Now the whole
     void runs in one sqlx transaction, and the original is voided with a
     conditional `UPDATE ... WHERE status='posted'`; 0 rows affected rolls the
     duplicate reversal back. `PostedEntry` validation moved before any write.
  2. Reversing entry did not copy `entity_id` from the original — provenance
     now preserved (origin, entity_id, reference_number).
  3. `approve_journal_entry` used read-check-write; now a conditional
     `UPDATE ... WHERE status='draft'` with `rows_affected` check (mirrors the
     posting pattern, clean error instead of a trigger abort under races).
     New regression test: `double_void_conditional_update_is_noop`. 34 accounting
     tests green, clippy clean. Known pre-existing debt (not a Phase 2
     regression): entry numbers derive from `COUNT(*)+1`, collidable if rows are
     ever deleted — same scheme as `create_journal_entry`; fold into a future
     sequence-table fix.
- **Session 7 (2026-07-15, Engineer — GIV-678):** Implemented Phase 3
  (approval queue + manual journal entry UI):
  - **Approval queue view** (`JournalEntries.tsx`): five-tab filter
    (All/Draft/Approved/Posted/Voided), per-row actions wired to Tauri
    commands — Approve (draft→approved), Post (approved→posted), Void
    (posted→voided with confirmation dialog explaining reversing entry),
    Demote (approved→draft by voiding + re-creating as draft for editing).
    Origin column shows manual/rule/model provenance. Expanded rows show
    approver, timestamps, reference. Backend errors surfaced verbatim.
  - **Manual journal entry form** (`JournalEntryDrawer.tsx`): create/edit
    drafts only. Line items with account picker, debit/credit in decimal
    strings converted to integer minor units via `toMinorUnits()` (string
    parsing, no floats touch money). Optional quantity + asset_id per line.
    Live balance indicator uses integer math (exact zero comparison, not
    float tolerance). Per-asset quantity balance hints for multi-asset
    entries.
  - **Entry detail view** (`JournalEntryDetail.tsx`): full lines with
    account, asset, quantity, debit/credit, memo. Lifecycle timeline
    (created→approved→posted→voided with timestamps and actors). Reversal
    linkage: voided entries link to reversing entry, reversing entries link
    back to original. Both visibly marked per `docs/accounting-model.md`
    corrections convention.
  - **Shared utilities** (`journalEntryUtils.ts`): `toMinorUnits()`,
    `minorToDollars()`, `computeBalance()`, `displayStatus()`,
    `formatDate()`, `formatDateTime()` — extracted for testability.
  - **Tests:** 31 Vitest tests covering: `toMinorUnits` (whole dollars,
    cents, single-digit cents, truncation, empty/non-numeric, float-trap
    avoidance for 0.1+0.2 and 19.99+0.01), `minorToDollars` (formatting,
    negatives, padding), roundtrip identity, `computeBalance` (balanced,
    unbalanced, all-zeros, multi-line swap from accounting-model.md,
    float-error immunity), `displayStatus` (all statuses + unknown
    fallback), `formatDate` (null, string, Date).
- **Session 8 (2026-07-15, CTO — GIV-678 review hardening):** Four gaps
  fixed before merge:
  1. **Demote was guaranteed to fail and conceptually wrong.** The UI
     demoted approved→draft by calling `void_journal_entry` + re-create,
     but void only accepts POSTED entries (`WHERE status='posted'`) and
     creates a posted reversal — wrong tool for an unposted entry. Added a
     dedicated `demote_journal_entry` Tauri command: race-safe conditional
     `UPDATE … SET status='draft', approved_by=NULL, approved_at=NULL
WHERE status='approved'` (the M5 state machine explicitly allows
     approved→draft). UI now calls it directly.
  2. **"Update Draft" created duplicates.** Editing a draft re-invoked
     `create_journal_entry`, leaving the old draft behind. Added
     `update_journal_entry` (draft-only, ONE transaction: conditional
     header update `WHERE status='draft'` + full line replacement; a
     concurrent approve/post rolls the whole edit back). Posted-line
     immutability triggers are untouched — only draft lines are mutable.
  3. **Invoke payloads could not deserialize.** `NewJournalEntryInput` /
     `JournalEntryLineInput` are `#[serde(rename_all = "camelCase")]` and
     Tauri v2 expects camelCase arg keys, but the UI sent snake_case
     (`entry_date`, `gl_account_id`, `status_filter`, …) — create/save
     failed against the real backend, and the always-null `status_filter`
     was silently masked by the client-side tab filter. All payloads now
     camelCase.
  4. **`toMinorUnits('-0.50')` returned +50.** `parseInt('-0')` is `-0`,
     which is not `< 0`, so sub-dollar negatives silently flipped sign.
     Sign is now parsed from the string. Also: `approve_journal_entry` now
     records the real authenticated user (email) as approver instead of the
     `'current-user'` placeholder (Inv-7 provenance; backend `created_by`
     is still hardcoded `'system'` in the create path — pre-existing debt,
     same bucket as the entry-number sequence fix).
     New tests: 4 Rust SQL-semantics tests (demote approved→draft clears
     approval provenance; conditional demote is a 0-row no-op on posted;
     draft lines replaceable; posted lines still immutable) + 6 Vitest cases
     (negative-sign regression, leading decimal point). 38 accounting tests +
     33 utils tests green; tsc + eslint clean.
- **Session 9 (2026-07-15, Engineer — GIV-683):** Implemented Phase 4
  (classification workflow: raw transactions → draft journal entries):
  - **Precision at the boundary (Inv-2):** replaced `f64` parsing in
    `auto_classify_transaction` with `rust_decimal::Decimal` at the
    boundary — `Decimal::from_str` → `* ONE_HUNDRED` → `.round()` → `i64`.
    No float touches money. Raw string values in `multi_chain_transactions`
    are never mutated (Inv-5).
  - **Provenance (Inv-7):** added optional `origin` field to
    `NewJournalEntryInput`; `create_journal_entry` now respects it
    (defaults to 'manual'). `auto_classify_transaction` sets
    `origin='rule'`. Every generated draft carries `rawTransactionId`;
    classifying flips `classification_status` to 'classified' via the
    existing `create_journal_entry` path.
  - **Backend commands:** `get_unclassified_transactions` — returns all
    rows with `classification_status='unclassified'` ordered by timestamp
    DESC. `ignore_transaction` — sets status to 'ignored' (conditional
    UPDATE, only unclassified→ignored). Both registered as Tauri commands.
    `MultiChainTransaction` public struct added with `serde(rename_all =
"camelCase")` for frontend consumption.
  - **Classification queue view** (`ClassificationQueue.tsx`): lists
    unclassified raw transactions (chain, hash, type, value, fee,
    timestamp). Three actions per row: Auto (calls
    `auto_classify_transaction`), Manual (opens Phase 3
    `JournalEntryDrawer` pre-filled with `rawTransactionId` +
    description), Skip (calls `ignore_transaction` with optional reason
    via confirmation modal). Route registered at `/classification`;
    nav link replaces 'Unclassified' sub-item under Transactions.
  - **JournalEntryDrawer enhancements:** new props `rawTransactionId`,
    `initialLines`, `initialDescription` for pre-filling from the
    classification queue. `rawTransactionId` passed through to
    `create_journal_entry` (triggers classification_status flip).
    `LineInput` interface exported for reuse.
  - **TypeScript types:** `RawTransaction` interface added to
    `database.ts`. `classificationUtils.ts` with `formatTimestamp`,
    `truncateHash`, `displayTxType`.
  - **Tests:** 7 Rust tests (rust_decimal boundary exact, zero/rounding,
    auto-classify provenance + classification_status flip, ignore status
    flip, raw tx immutability beyond classification_status, unclassified
    count tracking, NewJournalEntryInput origin acceptance). 5 Vitest
    tests (formatTimestamp, truncateHash, displayTxType, txTypeLabels).
    No schema/migration changes.
- **Session 9 review hardening (2026-07-16, CTO — GIV-683):** Four gaps
  closed during review of PR #219:
  1. **Rounding was banker's, and its test was red.** `Decimal::round()`
     rounds half-to-even (10000.5 → 10000), so the shipped test asserting
     10000.5 → 10001 failed. Extracted `decimal_to_minor_units()` using
     explicit `RoundingStrategy::MidpointAwayFromZero` (the money
     convention), `checked_mul` + `to_i64()` so out-of-range values return
     an error instead of panicking (`Decimal::MAX * 100` panics on
     multiply).
  2. **No unclassified guard on auto-classify.** `auto_classify_transaction`
     fetched the raw tx by id only — invoking it on an already-classified
     tx created a duplicate draft, and on an ignored tx silently
     resurrected it to 'classified'. The SELECT now requires
     `classification_status='unclassified'`.
  3. **`create_journal_entry` was non-atomic with an unconditional flip.**
     Header, lines, and classification flip were separate auto-commit
     statements; a failure mid-way left a half-written draft, and a
     double-submit from the manual drawer double-classified the raw tx.
     Now one sqlx transaction; the flip is conditional
     (`WHERE classification_status='unclassified'`), 0 rows → rollback +
     error. This also covers the auto path (belt-and-braces with #2).
  4. **Skip reason was silently dropped.** `ignore_transaction` accepted
     `_reason` and discarded it while the UI collected it. Added migration
     `20260716000001_add_classification_note.sql` (workflow-metadata
     column, same category as `classification_status`; raw financial
     fields stay immutable per Inv-5) and the reason now persists to
     `classification_note`.
     New tests: conditional-flip blocks double-classify + ignored-tx
     resurrection; ignore persists reason; midpoint/negative/overflow
     rounding pinned. 218 Rust lib tests + 269 Vitest green; clippy/tsc/
     eslint clean.
  - **Inv-5 enforcement note:** a DB-level immutability trigger on
    `multi_chain_transactions` is NOT possible today — ingestion re-sync
    legitimately upserts rows (`ON CONFLICT(chain_id, hash) DO UPDATE` in
    persistence.rs / db/multi_chain.rs). Inv-5 remains enforced at the
    accounting layer + tests. Revisit if ingestion gains a
    finalized-transaction concept.
- **Session 10 (2026-07-16, Engineer — GIV-684):** Implemented Phase 5
  (accounting periods, close, and lock):
  - **M6** (`20260716000002_accounting_periods.sql`): `accounting_periods`
    table with `id`, `period_start`/`period_end` (DATE), `status`
    CHECK('open','closed'), audit columns (`closed_by`, `closed_at`,
    `reopened_by`, `reopened_at`), `period_start_before_end` constraint.
    Trigger `prevent_posting_into_closed_period` fires on
    `approved→posted` transition: rejects if any closed period contains
    the entry's `entry_date`. This also blocks reversals from landing in
    closed periods (void generates a new entry with its own entry_date
    through the same posting path).
  - **Non-overlapping enforcement:** overlap detection in Rust (SQLite
    lacks exclusion constraints). `create_period` checks
    `period_start <= ? AND period_end >= ?` before INSERT. Documented
    SQLite limitation.
  - **Backend commands:** `list_periods` (all periods, descending by
    start date), `create_period` (validates dates, rejects overlaps),
    `close_period` (single transaction: rejects if pending draft/approved
    entries exist in the period with exact count; conditional UPDATE
    WHERE status='open' — double-close is 0-row idempotent no-op),
    `reopen_period` (conditional UPDATE WHERE status='closed', records
    `reopened_by`/`reopened_at` — deliberately loud audit event;
    double-reopen is 0-row no-op). All follow Phase 2/3 conditional-UPDATE
    idempotency pattern.
  - **UI:** `AccountingPeriods.tsx` — Periods page listing all periods
    with status badges (Open/Closed), date ranges, closed-by/at metadata.
    Close and Reopen actions with amber/blue confirmation banners (same
    pattern as void confirmation in JournalEntries). Create form for new
    periods with start/end date pickers. Reopen audit log section shows
    all periods that have been reopened. Backend errors surfaced verbatim.
    Route at `/accounting-periods`; navigation item added with CalendarDays
    icon.
  - **Error surfacing:** the existing `handlePost` in JournalEntries.tsx
    already surfaces Tauri errors verbatim via `setActionError(msg)` —
    the closed-period trigger message "Cannot post entry: the accounting
    period containing this entry date is closed" propagates to the UI
    automatically.
  - **Tests:** 9 Rust tests: trigger blocks posting into closed period;
    posting into open period succeeds; close rejects with pending drafts;
    double-close is a 0-row no-op; reversal into open period succeeds;
    reversal into closed period blocked; reopen allows posting; posting
    outside any period succeeds; overlap detection. Vitest tests for
    period utility functions (formatDate, formatDateTime, firstDayOfMonth,
    lastDayOfMonth).
- **Session 10 review hardening (2026-07-16, CTO — GIV-684, PR #220):**
  - **Posted entry_date immutability (M6 trigger added):** the closed-period
    lock keys entirely off `entry_date`, but existing immutability triggers
    only covered status/is_posted transitions and line mutations — a direct
    `UPDATE journal_entries SET entry_date = ...` on a POSTED entry could
    backdate it into (or out of) a closed period, silently rewriting a
    closed month. Added `journal_entries_posted_entry_date_immutable`
    (blocks entry_date updates when status is posted/voided) to the same
    pre-authorized M6 migration. No app path updates entry_date after
    posting (update_journal_entry is draft-only) — pure defense-in-depth.
    Draft entry_date stays editable (tested).
  - **create_period overlap race:** the overlap check was read-check-write
    outside any transaction — two concurrent creates could both pass and
    insert overlapping periods. Replaced with a single atomic conditional
    `INSERT ... SELECT ... WHERE NOT EXISTS(overlap)` + rows_affected
    check, matching the lifecycle conditional-UPDATE pattern.
  - **Audit identity:** close/reopen sent hardcoded `closedBy: 'user'` —
    now the authenticated user (`useAuth` email/display_name), same as the
    Phase 3 approver fix. A period-close audit trail attributed to 'user'
    is worthless.
  - **Dead code with a latent TZ bug removed:** `firstDayOfMonth`/
    `lastDayOfMonth` were unused by the UI, and `lastDayOfMonth` mixed a
    local-time `Date` with `toISOString()` (UTC) — off-by-one day in UTC+
    timezones, which would have left the month's last day outside the
    period had it ever been wired up. Deleted rather than fixed.
  - **DeepSource JS blockers cleared** (run was red): JSX depth (extracted
    PeriodRow/PeriodStatusBadge/ConfirmActionBanner/CreatePeriodForm/
    ReopenAuditLog), short names, string concat, missing doc comments,
    literal trailing `undefined` args in tests.
  - Tests: +3 Rust (posted entry_date immutable; draft entry_date
    editable; conditional-insert overlap atomicity) → 230 lib green.
