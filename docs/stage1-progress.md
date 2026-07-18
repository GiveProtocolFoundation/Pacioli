# Stage 1 Progress Tracker — Double-Entry Accounting Engine

Session constitution: `SCOPE.md` (repo root). Stage 1 mandate: GIV-668.
Gate 1: CPA-reviewed statements from real imported transactions, manually
classified through the approval queue.

**Current phase: 10 (Gate 1 rehearsal) in flight, plus Phase 4a (import
resilience — board amendment 2026-07-18) newly opened. Phases 1-9 landed
and merged. Rehearsal package prepared (`docs/gate1-report.md`: CPA-facing
overview, known limitations, 12-step rehearsal checklist, demo script).
Awaiting the product owner's real-data rehearsal run; findings land in
`docs/gate1-report.md` §5 and blockers-only fixes follow. Phase 4a
delegated to Engineer — it is the durable fix for the provider-failure
class behind rehearsal findings #1/#2/#3.**

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
- [ ] **Phase 4a — Import resilience and canonical store** (added by board
      amendment to the Stage 1 mandate, 2026-07-18; formalizes "Option B"
      from the rehearsal findings #1-#3 options analysis). Split into two
      parts per CTO review: - **Part 1 (PR in review):** descriptive column renames
      (`hash→transaction_hash`, `value→transfer_value`, etc.), all
      Rust/TS readers updated, error surfacing in `insert_transactions`
      (no more silent swallowing), `wallet_address` provenance column,
      docs updated with Part 1/Part 2 split. Delegated: Engineer. - **Part 2 (follow-up):** wire provider fallback into live import
      path, resumable sync cursor logic, Solana/Bitcoin fallback
      endpoints, vitest flakiness simulation tests. Delegated: Engineer.
- [x] **Phase 5 — Periods, close, and lock**
      (GIV-684: accounting_periods table with open/closed lifecycle,
      DB trigger blocks posting into closed periods, list_periods/
      close_period/reopen_period commands, Periods UI with confirm
      modals, reopen audit log, 9 Rust tests — Engineer)
- [x] **Phase 6 — Financial statements v1**
      (GIV-688: balance sheet, income statement, trial balance with period
      filtering + comparative prior period, verify_ties assertion enforced
      before all statement returns, CSV export, statement UI pages with
      period selector and comparative columns — Engineer)
- [x] **Phase 7 — Cost basis engine (FIFO first)**
      (GIV-689: FIFO lot tracking per wallet per asset, realized gain/loss
      on disposal, non-realizing own-wallet transfers preserving cost basis
      and acquired date, LotSelector trait for method abstraction, M7
      migration, 18 Rust tests including acceptance test — Engineer)
- [x] **Phase 8 — Fair-value measurement (ASU 2023-08)**
      (GIV-690: PriceSource trait with CoinGecko provider, manual price
      override with append-only provenance, remeasurement engine generating
      draft adjusting entries (unrealized gain/loss through net income),
      M8 migration with append-only triggers on all three tables,
      15 Rust tests including hand-computed gain/loss fixtures — Engineer)
- [x] **Phase 9 — Invariant test suite (proptest)**
      (GIV-691: 27 property-based tests via `proptest` crate pinning all 7
      SCOPE.md invariants against real engine paths — Inv-1 structural balance,
      Inv-2 no-float exact arithmetic, Inv-3 state machine + void net-zero,
      Inv-7 append-only provenance, cost basis conservation/transfer/FIFO/
      over-consumption, fair-value idempotency + unrealized=FV−cost,
      statements tie/TB/BS/IS/multi-period — Engineer)
- [ ] **Phase 10 — Gate 1 rehearsal** (in progress: rehearsal package
      authored — `docs/gate1-report.md` with CPA-facing overview, plainly
      stated known limitations, 12-step real-data rehearsal checklist, and
      the CPA demo script. Remaining: product owner runs the rehearsal with
      real wallets; findings captured in the report §5; blockers-only fixes;
      statements delivered to the CPA)

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
- 2026-07-18 — **Board amended the Stage 1 mandate (GIV-668): new
  Phase 4a — Import Resilience and Canonical Store.** This resolves the
  strategic options question posted after rehearsal finding #3: the board
  chose the multi-provider fallback abstraction ("Option B") and elevated
  it into Stage 1 proper, together with resumable sync cursors, idempotent
  ingestion, human-legible raw-transaction column names, and
  provider-flakiness simulation tests. Phase ordering is otherwise
  unchanged; the only other mandate edits are cosmetic (Phase 0 heading,
  trailing delegation sentence). Option A (save-time key validation with a
  Test-connection button) already landed via GIV-702 / PR #232
  (main `d99ef72`). Option C (own indexing) remains deferred per the
  standing CEO pacioli-cloud decision.

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
- **Session 11 (2026-07-16, Engineer — GIV-688):** Implemented Phase 6
  (financial statements v1):
  - **New Rust module** (`src-tauri/src/api/statements.rs`): financial
    statement engine with period-aware queries over posted entries using
    i64 minor units (no floats touch money — Inv-2). Reports are derived
    views, never stored (Inv-4). Voided entries net out via their
    reversals — verified by test. Three statement types: balance sheet,
    income statement, trial balance.
  - **Period-aware aggregation:** SQL queries filter posted entries by
    `entry_date` within the requested date range. Supports both
    accounting-period selection and arbitrary date ranges.
  - **Comparative prior period:** each statement automatically computes
    a comparative prior period of equal duration (e.g., current year
    2025 → prior year 2024). Both periods returned to the UI.
  - **`verify_ties` function (non-negotiable):** runs four tie checks
    before any statement data is returned to the UI: (1) balance sheet
    ties (A = L + E incl. NI), (2) net income matches between BS and IS,
    (3) trial balance is in balance, (4) trial balance NI cross-checks
    income statement NI. A statement that does not tie is a hard error —
    it never renders silently.
  - **CSV export:** three Tauri commands
    (`export_balance_sheet_csv`, `export_income_statement_csv`,
    `export_trial_balance_csv`) write statements to CSV via the existing
    `csv` crate. Export runs `verify_ties` before writing. PDF deferred
    (no lightweight tooling available without heavy deps).
  - **UI pages:** `BalanceSheet.tsx`, `IncomeStatement.tsx`,
    `PeriodTrialBalance.tsx` — period selector (start/end date inputs),
    comparative columns with change percentage, CSV export button via
    Tauri file-save dialog. Error messages surfaced verbatim from the
    Rust backend. JSX depth kept ≤ 4 via extracted sub-components
    (PeriodSelector, SectionTable, IncomeSection, TrialBalanceRowComponent).
  - **Routes:** `/reports/balance-sheet`, `/reports/income-statement`,
    `/reports/trial-balance` added to App.tsx. Reports.tsx route map
    updated for all three.
  - **Tests:** 11 Rust tests in statements.rs (balance sheet ties,
    income statement net income, trial balance balances, verify_ties pass,
    verify fails on corrupted BS/IS/TB, voided-entry neutrality,
    comparative period dates, format_minor, empty period balanced,
    zero-balance exclusion). 6 Vitest tests for statementUtils.ts
    (formatMinorAsDollars, formatMinorPlain, formatStatementDate,
    computeChangePercent, formatChangePercent, defaultPeriodDates).
  - **Docs:** `docs/accounting-model.md` §9 (Financial statements)
    documenting account classification, net income tie, verification,
    period filtering, comparative periods, CSV export. This tracker
    updated (Phase 6 checkbox + this session log).
  - **No schema migration.** No SQL views created. All aggregation in
    Rust from posted journal_entry_lines.
- **Session 11 addendum (2026-07-16, CTO review hardening — GIV-688):**
  two correctness gaps found and fixed on the PR before merge:
  1. **SQL filter leak (critical):** the aggregation query put the
     `is_posted = 1` + date predicates on a chained LEFT JOIN's ON
     clause. That only NULLs the `journal_entries` columns — the line
     rows still survive and get summed, so DRAFT entries and
     out-of-period entries leaked into every statement (repro: a draft
     for 999.00 and an out-of-period posted 555.00 both appeared in a
     Feb-only statement). The 12 unit tests were pure-fixture and never
     executed the SQL, so CI stayed green over a broken query. Fixed
     with INNER JOINs + WHERE-clause predicates
     (`query_account_activity`), and two new **DB integration tests**
     (in-memory SQLite + full migrations) that seed posted-in-period,
     posted-before-period, and draft entries and assert exclusion.
     Rule for future phases: any new SQL aggregation needs at least one
     DB-backed test — fixture tests cannot catch join-semantics bugs.
  2. **Balance sheet was period-movement, not as-of:** A/L/E were
     aggregated over `[start, end]` only, so a June balance sheet
     dropped every opening balance (all pre-June cash vanished) and
     there was no retained-earnings concept. Statements now aggregate
     twice: cumulative (inception..=end) for balance sheet + trial
     balance, period (start..=end) for the income statement. New
     `retained_earnings_minor` on the balance sheet = cumulative NI −
     current-period NI; tie is A = L + (equity accounts + RE + NI).
     Trial balance is now conventional "as at end date" (matches M4
     views/Phase 2). `verify_ties` check 4 updated: TB cumulative NI
     must equal BS retained earnings + current-period NI.
  - Also: all three Tauri commands and CSV exports now route through a
    single `build_verified_statements` gate, and the **comparative
    prior period is verified too** before rendering (previously prior
    statements bypassed `verify_ties`). BalanceSheet UI + CSV gained a
    Retained Earnings line; trial balance page header is "As of {end}".
    16 Rust statement tests green (14 fixture + 2 DB integration).
  - **Known limit (tracker-documented):** the comparative prior period
    is equal _day-count_ duration ending the day before the current
    start (2025 full year → 2024-01-02..2024-12-31), not
    calendar-aligned. Acceptable for v1; calendar-aligned comparatives
    (prior month/quarter/year via `accounting_periods`) are future
    polish.
- **Session 12 (2026-07-17, Engineer — GIV-689):** Implemented Phase 7
  (cost basis engine — FIFO lot tracking):
  - **M7** (`20260717000001_cost_basis_lots.sql`): `cost_basis_lots` table
    (per-wallet per-asset lots with TEXT decimal quantities — Inv-2, INTEGER
    minor-unit cost basis, `journal_entry_id` FK, `is_closed` flag) and
    `lot_consumptions` table (append-only consumption records with event
    type `disposal`/`transfer`, proportional cost basis, proceeds,
    realized gain/loss in minor units, holding period days, long-term flag,
    `destination_lot_id` for transfers). Existing legacy `transaction_lots`
    table untouched (different architecture, not wired to Phase 1–6 engine).
  - **New Rust module** (`src-tauri/src/api/cost_basis.rs`): cost basis
    engine with `LotSelector` trait (Send+Sync, parameterized ORDER BY) and
    `FifoSelector` implementation (acquired_date ASC, id ASC). Internal
    `proportional_cost_basis()` function: exact rust_decimal division ×
    cost basis, MidpointAwayFromZero rounding (same convention as
    `decimal_to_minor_units`). Proceeds allocation: proportional per lot
    with last-lot remainder to prevent rounding drift.
  - **Tauri commands (7 new):**
    - `acquire_lot` — opens a lot, validates quantity > 0 and journal entry
      is posted.
    - `dispose_lots` — FIFO consumption with per-lot realized gain/loss;
      one sqlx transaction for atomicity (no partial consumption on
      insufficient lots). Returns `DisposalResult` with per-lot details.
    - `transfer_lots` — consumes source lots in FIFO order, creates
      destination lots preserving `acquired_date` and proportional cost
      basis. Records `event_type='transfer'` with zero proceeds/gain.
    - `get_open_lots` — returns open lots for asset+wallet.
    - `get_lot_summary` — aggregates open lots per asset per wallet.
    - `get_lot_consumptions` — returns consumption history for a lot.
    - `get_realized_gains_losses` — returns disposal consumptions in a
      date range.
  - **Transfer treatment (documented in `docs/accounting-model.md` §10):**
    transfers between own wallets move lots WITHOUT realization. Source lots
    are consumed; destination lots are created with the same acquired_date
    and proportional cost basis. Holding period continues from the original
    acquisition.
  - **Tests:** 18 Rust tests:
    - 5 proportional_cost_basis unit tests (full lot, half, 1/3, 2/3
      rounding, zero-lot error)
    - 3 holding_period_days unit tests (same day, one year, short term)
    - FIFO buy+buy+sell with hand-computed realized gain
    - Insufficient lots error
    - Transfer preserves cost basis and acquired_date
    - Full acceptance test: buy, buy, transfer, sell with hand-computed
      realized gain
    - Long-term holding detection (366 days)
    - Full lot disposal closes lot
    - Multiple partial disposals
    - Consumption records are append-only
    - Transfer does not realize gain
    - Sub-decimal quantity precision (18 decimal places)
      264 lib tests green, clippy clean.
  - **Decisions:**
    - New `cost_basis_lots` / `lot_consumptions` tables rather than reusing
      the pre-existing `transaction_lots` / `lot_disposals` tables. The
      legacy tables use DECIMAL (float affinity) and reference
      `accounting_transactions` (not wired to the Phase 1–6 journal
      engine). The new tables use Phase-1 conventions: TEXT quantities,
      INTEGER minor units, `journal_entry_id` FK.
    - `LotSelector` trait is Send+Sync so Tauri commands can be async.
      Only FIFO implemented; LIFO/HIFO/specific-ID are additive.
    - Journal entry integration is caller-side: the cost basis engine
      does NOT create or post entries. Callers create and post entries
      through the normal lifecycle, then call acquire/dispose/transfer.
  - **Documented debt:**
    - No UI for cost basis reports yet (CostBasisReport.tsx is the legacy
      frontend-JS FIFO calculator; not wired to the new engine). UI
      deferred to a later phase.
    - Automatic transfer detection (checking both from/to addresses against
      `user_wallets`) is not implemented; transfers must be manually
      classified. Automate in a future phase.
    - The journal-entry lines for disposals (realized gain/loss) are not
      auto-generated by the engine; the caller must construct them. This is
      intentional (§5 approval gate: system never posts silently), but a
      helper that drafts the gain/loss entry from the `DisposalResult`
      would reduce manual work.
  - **CTO review hardening (GIV-689, PR #222):** four gaps closed before
    merge:
    1. **Read-check-write race on lot consumption** — dispose/transfer
       SELECTed lots then UPDATEd `remaining_quantity` unconditionally;
       two concurrent consumers could both spend the same lot
       (double-spend). Now a conditional UPDATE keyed on the
       remaining_quantity that was read
       (`WHERE id=? AND remaining_quantity=? AND is_closed=0`) with a
       `rows_affected == 1` check; 0 rows → the whole operation errors
       and the transaction rolls back.
    2. **Production transfer path was untested** — tests re-implemented
       the transfer SQL inline instead of calling the command logic.
       Extracted `transfer_lots_impl` (and `acquire_lot_impl`) at pool
       level (same pattern as `dispose_lots_with_method`); the three
       transfer tests and the acceptance test now exercise the real
       engine path.
    3. **Posted-entry gate only on acquire** — dispose/transfer accepted
       a `journal_entry_id` without verifying status. Shared
       `verify_journal_entry_posted` helper now runs inside the
       transaction for all three lot events (lots derive only from the
       posted ledger).
    4. **Inv-7 was Rust-only** — added DB-layer triggers in M7:
       `lot_consumptions` rejects UPDATE/DELETE (strictly append-only);
       `cost_basis_lots` rejects DELETE and rewrites of core columns
       (asset_id, wallet_id, acquired_date, quantity, cost_basis_minor,
       method, journal_entry_id, created_at) — only
       remaining_quantity/is_closed/updated_at may change. Invariants
       now hold against any writer, not just the engine.
    - +5 tests (posted-gate rejection ×2, append-only triggers,
      lot immutability/no-delete, stale conditional-UPDATE SQL
      semantics). 269 lib tests green; CI clippy invocation clean.
    - Recurring-defect note for future phases: this is the third phase
      where the read-check-write mandate was missed on a new write path —
      keep checking every multi-statement write for conditional UPDATE +
      rows_affected.
- **Session 13 (2026-07-17, Engineer — GIV-690):** Implemented Phase 8
  (fair-value measurement — ASU 2023-08):
  - **M8** (`20260717000002_fair_value_measurement.sql`): three new tables:
    - `price_observations` — append-only record of every price used
      (API or manual), with asset_id, date, price in minor units + decimal
      string, source, CoinGecko coin ID, recorded_by (real user), note.
    - `remeasurement_runs` — audit trail per execution: date, initiator,
      holdings count, entries generated, total unrealized gain/loss, status.
    - `remeasurement_entries` — links each run to its generated draft
      journal entries with carrying amount, fair value, unrealized gain/loss,
      and the price observation used.
      All three tables protected by UPDATE/DELETE triggers (Inv-7 append-only).
  - **New Rust module** (`src-tauri/src/api/fair_value.rs`):
    - `PriceSource` trait (async, Send+Sync): `get_price(coin_id, date)`
      returns `Option<String>` price decimal; `source_name()` for provenance.
    - `CoinGeckoPriceSource` — uses existing `CoinGeckoClient` from
      `api::price_feeds::coingecko`. Reuses the historical-price API with
      DD-MM-YYYY date format.
    - `record_manual_price_impl` — inserts manual overrides with the real
      user identity and optional note. Manual overrides take precedence
      (ORDER BY source='manual' DESC, created_at DESC).
    - `run_remeasurement_impl` — core engine in ONE sqlx transaction:
      1. Fetches holdings (open lots) via `cost_basis_lots` aggregation.
      2. For each holding, resolves price: existing observation first, then
         CoinGecko API if asset-to-coin mapping is provided.
      3. Computes fair_value = quantity × price (exact rust_decimal, rounded
         MidpointAwayFromZero to minor units). No floats in the money path.
      4. If unrealized gain/loss ≠ 0, creates a draft journal entry:
         gain → Dr Digital Assets / Cr Unrealized Gain;
         loss → Dr Unrealized Loss / Cr Digital Assets.
      5. Records the run, entry linkage, and price observations atomically.
    - GL account lookup is dynamic: finds the asset account from posted
      journal entries that debited the asset, not a hard-coded mapping.
  - **Tauri commands (6 new):**
    - `record_manual_price` — manual price override.
    - `get_price_observations` — price history for asset+date.
    - `run_remeasurement` — period-end remeasurement engine.
    - `list_remeasurement_runs` — audit trail.
    - `get_remeasurement_entries` — per-run entry details.
    - `get_latest_asset_price` — latest price for asset on date.
  - **Tests:** 15 Rust tests:
    - 3 `fair_value_to_minor` unit tests (basic, fractional, rounding)
    - 1 `price_to_minor` unit test
    - 2 manual-price tests (records observation, manual takes precedence)
    - 2 append-only trigger tests (cannot update, cannot delete)
    - 1 gain fixture: 10 ETH @ $3,000 → $3,500/ea = $5,000 gain
    - 1 loss fixture: 5 DOT @ $8.00 → $6.50/ea = $7.50 loss
    - 1 no-change test: price = carrying → 0 entries
    - 1 multiple-holdings: two assets, one gain, one loss, net computed
    - 1 no-holdings: empty DB → 0 entries
    - 1 skipped-assets: no price available → partial status
    - 1 immutability: remeasurement_runs cannot be updated
  - **Documentation:** `docs/accounting-model.md` §11 filled in with full
    ASU 2023-08 treatment, price source trait, float boundary handling,
    adjusting entry format, and run audit trail.
  - **Decisions:**
    - Reused existing `CoinGeckoClient` rather than adding a new price
      feed dependency. The PriceSource trait allows future providers
      (e.g. CoinMarketCap, manual CSV import) without changing the engine.
    - Draft entries use `origin='rule'` (system-generated) per Phase 4
      convention, not 'manual'. The `created_by` field carries the real
      user identity.
    - The engine creates one draft entry per asset+wallet holding, not
      one per lot. This matches accounting practice (one adjustment per
      position per period).
    - Asset GL account discovery is dynamic (queries posted entries) rather
      than requiring configuration. This means remeasurement works for any
      asset that has been acquired through the journal engine.
  - **Documented debt:**
    - No UI for remeasurement yet. The Tauri commands are wired; frontend
      surfaces (price entry form, remeasurement trigger, run history) are
      deferred.
    - The remeasure → approve → post → close sequencing is manual in
      Stage 1. Future phases may add a close-period workflow that
      sequences these steps automatically.
    - No automated CoinGecko coin-ID mapping per asset. The caller must
      provide the mapping. A future asset metadata table could store this.
  - **CTO review hardening (GIV-690, 2026-07-17)** — 4 gaps fixed on the
    PR branch before merge:
    1. **Second-period double-count (critical).** The engine measured every
       run against raw cost basis. After period 1's +5,000 gain was posted,
       the GL carried the asset at FV1, but period 2 computed FV2 − cost
       instead of FV2 − FV1 — the GL would end at FV1 + FV2 − cost after two
       closes. Carrying amount is now cost basis of open lots **plus the net
       unrealized gain/loss of prior POSTED remeasurement entries** for the
       asset+wallet (voided entries excluded — their reversals net them out
       of the GL). Test posts period 1 through the funnel, remeasures period
       2, posts it, and asserts the GL asset balance equals FV2 exactly.
    2. **No idempotency guard.** Re-running the same run_date created
       duplicate drafts; if both were approved+posted the GL would be
       double-adjusted. Now a holding is skipped (reported in
       `alreadyRemeasured`) when a non-voided remeasurement entry already
       exists for the same asset+wallet+entry_date. Voiding re-opens the
       slot. (Fourth phase in this mandate where the idempotency /
       read-check-write mandate was missed — 2, 5, 7, 8.)
    3. **Network I/O inside the accounting transaction.** CoinGecko fetches
       (and price-observation inserts) ran with the sqlx write transaction
       open, holding the SQLite writer across HTTP latency and rolling back
       price provenance if the run later failed. Price resolution now runs
       before the transaction; draft entries + run record + linkage rows
       remain one all-or-nothing transaction.
    4. **holdings_count unit mismatch.** `holdings.len() − skipped_assets.len()`
       subtracted a per-asset list from a per-asset+wallet list, miscounting
       multi-wallet assets. The run now counts holdings actually remeasured.
    - The second-period test also proves generated drafts pass the M3
      per-asset / M5 state-machine posting triggers (remeasurement lines
      carry asset_id with NULL quantity, which the per-asset check permits
      by design — measurement lines carry valuation differences).
    - +3 tests (18 fair-value tests total; 287 lib tests green).
    - **Additional documented debt:** disposals (§10) relieve _cost_, not
      remeasured carrying value; after a FULL disposal of a remeasured
      holding, the residual prior fair-value adjustment stays in the asset
      account until a manual adjusting entry (no open lots → holding is not
      scanned). Partial disposals self-correct at the next remeasurement.
      Proportional relief of fair-value adjustments at disposal time is
      future Stage 1+ work; documented in accounting-model.md §11.
- **Session 14 (2026-07-17, Engineer — GIV-691):** Implemented Phase 9
  (invariant test suite — proptest):
  - **New module** (`src-tauri/src/api/proptest_invariants.rs`): 27
    property-based tests using the `proptest` crate, pinning all 7
    SCOPE.md invariants against real engine paths (not re-implemented
    SQL). All tests exercise production functions via in-memory SQLite
    databases with full migrations applied.
  - **Inv-1 — Structural balance (4 tests):** `PostedEntry::new` accepts
    balanced entries and rejects unbalanced; M2 trigger independently
    rejects unbalanced via raw SQL; per-asset quantity imbalance on
    dual-sided assets rejected.
  - **Inv-2 — No floats / exact arithmetic (4 tests):**
    `decimal_to_minor_units` exact conversion, minor unit sum exact
    (no drift over 100 random additions), `fair_value_to_minor` exact,
    `Decimal` string roundtrip identity.
  - **Inv-3 — State machine + void net-zero (2 tests):** random
    transition sequences never produce an illegal status; void generates
    a reversing entry whose GL net effect is exactly zero.
  - **Inv-7 — Append-only provenance (6 tests):** `lot_consumptions`,
    `price_observations`, `remeasurement_runs`, `remeasurement_entries`
    all reject UPDATE/DELETE at the trigger level; posted journal entry
    lines immutable; `cost_basis_lots` core columns immutable.
  - **Cost basis (4 tests):** conservation (total cost invariant after
    partial disposal), transfer produces zero realized gain, FIFO
    ordering (oldest lot consumed first), no over-consumption (disposal >
    available → error).
  - **Fair value (2 tests):** idempotency (re-running same date = noop),
    unrealized gain/loss = fair_value − carrying_amount.
  - **Statements (5 tests):** random balanced entries always tie,
    trial balance nets to zero, BS ties (A = L + E + RE + NI),
    IS net income matches BS NI, multi-period entries tie independently.
  - **Visibility changes for cross-module test access:** 5 functions
    widened to `pub(crate)` (accounting.rs: `decimal_to_minor_units`;
    fair_value.rs: `fair_value_to_minor`; cost_basis.rs:
    `acquire_lot_impl`, `dispose_lots_with_method`, `transfer_lots_impl`;
    statements.rs: `build_verified_statements` + `VerifiedStatements`
    struct fields).
  - **Dev dependency:** `proptest = "1.4"` added to `Cargo.toml`.
  - 314 total tests green (27 proptest + 287 existing); clippy + rustfmt
    clean.
- **Session 14 review-hardening (2026-07-17, CTO — GIV-691):** on review,
  two spec gaps were closed and the hardened void test surfaced (and
  fixed) two REAL production bugs:
  - **Void property now exercises the production engine.** Extracted
    `void_journal_entry_impl(pool, id)` (pool-level, testable without
    Tauri `State`; thin `#[tauri::command]` wrapper preserved) and
    rewrote `inv3_void_net_effect_zero` to call it: asserts original
    `voided` + linked via `reversed_by_entry_id`, reversal `posted` and
    decodable, double-void rejected, overall AND per-account GL net-zero.
    The prior version simulated the reversal via raw SQL.
  - **Production bug #1 (found by the hardened test):** the void engine
    inserted the reversing entry with `DATE('now')` (date-only) while
    `JournalEntry.entry_date` decodes as `NaiveDateTime` — every voided
    entry's reversal broke journal listings. Fixed to `datetime('now')`;
    test now pins decodability of the reversal row.
  - **Production bug #2 (found by the same test):** legacy
    `debit_amount`/`credit_amount` are declared DECIMAL (NUMERIC
    affinity), so SQLite stores whole-dollar f64 values (e.g. 5.0) as
    INTEGER, which sqlx refuses to decode back into `f64` — any line
    with a whole-dollar amount broke entry fetch. Fixed with a shared
    `SELECT_JOURNAL_ENTRY_LINES` query that CASTs both columns to REAL
    at all 4 decode sites.
  - **Added the missing Property-5 interleaving case**
    (`cost_basis_interleaved_ops_conserve`): random interleaved
    buy/sell/transfer sequences against the production engines; after
    EVERY op no lot is over-consumed; transfers never realize gain;
    final conservation Σ(consumed) + Σ(remaining) = Σ(acquired) within
    ±1 minor unit per rounding site.
  - `proptest-regressions/api/proptest_invariants.txt` checked in (seed
    that reproduced the void decode regression).
  - Test-fixture fixes: `create_draft` stores full datetimes; helper
    inserts use `0.0` literals for the legacy REAL amount columns.
  - 28 proptest properties / 321 total lib tests green; clippy (CI
    flags) + rustfmt clean.
- **Session 15 (2026-07-17, CTO — Phase 10 start):** Gate 1 rehearsal
  package authored — no engine code touched (docs only):
  - **New `docs/gate1-report.md`:** (1) CPA-facing overview of what the
    review will see (four-layer model, provenance, structural balance in
    integer minor units, append-only ledger with generated reversals,
    period close/lock, tie-verified statements, FIFO cost basis,
    ASU 2023-08 fair value through the approval queue, proptest invariant
    suite); (2) known limitations stated plainly (desktop-only journal
    path, no fair-value/cost-basis UI, CSV-only export, FIFO-only,
    single entity/US GAAP, manual classification and period-end
    sequencing, REAL-cast SQL quantity backstop fine print);
    (3) 12-step real-data rehearsal checklist; (4) ~30-minute CPA demo
    script; (5) empty findings table for the live run.
  - Next step: product owner runs the rehearsal (checklist §3) with real
    wallets; friction/defects captured in the report §5; fix blockers
    only; then statements + `docs/accounting-model.md` + the report go
    to the reviewing CPA. Gate verdict is the CPA's.
- **Session 16 (2026-07-17, CTO — Phase 10 rehearsal, finding #1):** First
  live-run finding triaged and fixed (blockers-only rule holds):
  - **Finding #1 (blocker, fixed):** Moonbeam wallet sync failed —
    `moonscanService` used the Etherscan V2 unified endpoint, which does
    not serve Moonbeam (chainid 1284); Moonbeam needs the direct Moonscan
    API with its own optional key. Fix merged via PR #227: per-chain
    direct endpoints, `moonscan` key namespace + Settings card, keyless
    access (~1 req/5s), removed the no-key sync block. Logged in
    `gate1-report.md` §5.
  - **Finding #1a (note, monitoring):** "Not connected to moonbeam" from
    the WS-RPC path (balances/recent blocks) is distinct from the HTTP
    fix; re-observe on retest before treating as a defect.
  - Rehearsal continues with the product owner from checklist §3 step 2.
- **Session 17 (2026-07-17, CTO — Phase 10 rehearsal, finding #2):**
  Retest finding triaged and fixed (blockers-only rule holds):
  - **Finding #2 (blocker, fixed):** Moonbeam sync failed again on retest —
    Moonscan has deprecated its per-chain V1 endpoints (the very endpoints
    PR #227 switched to); its error message directs callers to the
    Etherscan V2 unified endpoint, meaning V2 now serves chainid 1284/1285.
    Fix merged via PR #228 (main `63d67fd`): all five Moonscan URL sites
    migrated to `api.etherscan.io/v2/api` with a `chainid` query parameter,
    matching every other EVM chain; `moonscan` keychain namespace retained
    (mapped in `etherscan.rs` for 1284/1285). Logged in `gate1-report.md`
    §5 row #2.
  - The finding #1 → #2 reversal is external-API drift, not churn: V2 did
    not serve Moonbeam at the time of finding #1; the provider moved
    underneath us between rehearsal runs.
  - Rehearsal continues: product owner rebuilds from main ≥ `63d67fd` and
    retests from checklist §3 step 2 (watch finding #1a on the WS-RPC path).
- **Session 18 (2026-07-17, CTO — Phase 10 rehearsal, finding #3):**
  Retest finding diagnosed with a live API probe before fixing (three
  consecutive endpoint/key failures warranted proof, not another guess):
  - **Finding #3 (blocker, fixed in code + user action):** "Invalid API
    Key (#err2)" on retest. Probe: keyless V2 returns "Missing/Invalid
    API Key"; a rejected key returns exactly "Invalid API Key (#err2)" —
    a key IS being sent and rejected. Root cause: the key saved under the
    Moonscan provider during finding #1 is invalid on Etherscan V2, and
    its presence shadowed PR #230's etherscan-key fallback (which only
    fired when no moonscan key existed). Fix: `moonscanService` now tries
    every configured key candidate in order (keychain moonscan →
    etherscan → localStorage → env), skipping rejected ones, and when all
    fail the error carries remediation steps. User action remains: a free
    etherscan.io key saved under the Etherscan provider (legacy
    moonscan.io keys do not work on V2). Logged in `gate1-report.md` §5
    row #3.
  - Strategic follow-up proposed to the board on GIV-668: single-provider
    indexer dependence is a structural fragility class; options analysis
    (key-UX hardening now, multi-provider fallback abstraction next, own
    indexing later) posted for a decision.
- **Session 19 (2026-07-18, CTO — mandate amendment triage):**
  - Diffed the board's updated Stage 1 instructions against the original
    mandate. One substantive change: **new Phase 4a — Import Resilience
    and Canonical Store** (provider registry + fallback, resumable sync
    cursors, idempotent ingestion, descriptive column naming, flakiness
    simulation). Two cosmetic changes (Phase 0 heading, removed trailing
    delegation sentence). No conflict with `SCOPE.md`: Solana/Bitcoin
    fallbacks reference services that already exist in the codebase
    (`solanaService.ts`, `bitcoinService.ts`), so no new chain
    integrations are implied.
  - Tracker updated: Phase 4a inserted into the checklist; decisions log
    records the amendment as the board's "Option B" decision.
  - Phase 4a implementation delegated to Engineer (child issue under
    GIV-668) to run in parallel with the Phase 10 rehearsal; the
    rehearsal's remaining user action (etherscan.io key, checklist §3
    step 2) is unchanged.
  - Bookkeeping: GIV-702 (Option A, save-time key validation) PR #232 is
    merged on main (`d99ef72`); issue closed.
- **Session 20 (2026-07-18, Engineer — Phase 4a Part 1):**
  - **Scope split (CTO-recommended):** Phase 4a split into two parts per
    CTO review of PR #234. Part 1 (this PR): descriptive column renames,
    all Rust/TS reader updates, error surfacing in `insert_transactions`.
    Part 2 (follow-up): provider fallback wiring into live import path,
    sync cursor resume logic, vitest flakiness simulation tests.
  - **Rebased onto current main** (`8c73359`, post Phases 4-10 + Gate 1
    rehearsal + Moonscan fixes) — clean stack, no stale parent.
  - **Migration `20260718000001_phase4a_descriptive_columns.sql`:**
    `hash→transaction_hash`, `tx_type→transaction_type`,
    `value→transfer_value`, `fee→transaction_fee`,
    `raw_data→raw_json_data`, `token_transfers.value→transfer_amount`,
    new `wallet_address` column with index.
  - **All Rust readers updated:** `db/multi_chain.rs` (Transaction,
    TransactionRow, TokenTransfer, TokenTransferRow structs + all SQL),
    `api/persistence.rs` (ChainTransactionInput, ChainTransactionRow +
    save/get SQL), `api/accounting.rs` (MultiChainTx, MultiChainTransaction
    - all SQL queries + test helper `insert_raw_tx`).
  - **Error surfacing:** `insert_transactions` and `insert_token_transfers`
    in `db/multi_chain.rs`, `save_chain_transactions` and
    `save_transactions` in `api/persistence.rs` now propagate per-row
    errors via `?` instead of silently swallowing with `if result.is_ok()`.
    This eliminates the "silently incomplete history" failure class.
  - **TS consumers updated:** `tauriPersistence.ts` serialization mapping,
    `database.ts` `RawTransaction` interface, `ClassificationQueue.tsx`
    all field references.
  - **Idempotency note:** the existing `UNIQUE(chain_id, hash)` constraint
    (now `UNIQUE(chain_id, transaction_hash)` post-rename) predates this
    PR — it was part of the original `20260118000001` migration. The
    one-row-per-tx + first-importer `wallet_address` design is documented
    here rather than claimed as new work.
  - **Part 2 remaining (follow-up PR):** wire `provider_fallback` module
    into the live `ChainManager` import path (not dead code); resume sync
    from `address_sync_status.last_block_synced`; add Solana/Bitcoin
    fallback endpoints; vitest flakiness simulation tests.
