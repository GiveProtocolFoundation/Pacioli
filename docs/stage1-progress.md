# Stage 1 Progress Tracker — Double-Entry Accounting Engine

Session constitution: `SCOPE.md` (repo root). Stage 1 mandate: GIV-668.
Gate 1: CPA-reviewed statements from real imported transactions, manually
classified through the approval queue.

**Current phase: 1 (Balance enforcement at the data layer) — migration plan
M1–M3 + recommendations Q1–Q5 approved by board 2026-07-15; implementation
delegated to Engineer. Conventions doc: `docs/accounting-model.md`.**

## Phase Checklist

- [x] **Phase 0 — Reconnaissance and tracker** (report below; migration plan
      approved by board 2026-07-15)
- [ ] **Phase 1 — Balance enforcement at the data layer**
      (~40% pre-landed by GIV-665, see report §3; M1–M3 + `PostedEntry`
      delegated to Engineer, `docs/accounting-model.md` authored)
- [ ] **Phase 2 — Posting engine and general ledger**
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

| # | Invariant | Finding |
|---|-----------|---------|
| 1 | Balance structural | Partially met (GIV-665 triggers). Gaps: balance is checked as ONE aggregate sum across all assets (not per currency/asset); no Rust type-level enforcement; 0.01 float tolerance. |
| 2 | No floats | **Violated end-to-end.** `accounting.rs` money structs are `f64` (debit/credit/balances, lines 127–224); SQLite `DECIMAL(18,2)` has NUMERIC affinity = stored as float; frontend sums amounts as JS `number` (`JournalEntries.tsx:330–438`); frontend FIFO in JS numbers. Balance trigger compares float sums to 0.01. |
| 3 | Append-only | **Violated:** `void_journal_entry` (accounting.rs:604) just flips `is_reversed=1`; no reversing entry is generated; `reversed_by_entry_id` is never populated. Posted-line immutability (GIV-665) does hold. |
| 4 | Reports are views | Met so far (trial balance is a query; reporting views derive). |
| 5 | Raw tx immutable | Met in classification path (`auto_classify_transaction` only reads `multi_chain_transactions`); no code mutates raw tx during classification. |
| 6 | Read-only wallets | Met; nothing here touches signing. |
| 7 | Provenance | **Absent:** no origin/approver/timestamps beyond created_by/created_at. |

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
