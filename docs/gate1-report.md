# Gate 1 Report — CPA Review Package (Stage 1)

Status: **rehearsal pending** — this document is prepared ahead of the Gate 1
rehearsal (Phase 10). The rehearsal findings section at the end is filled in
during the live run with real data. Companion document:
`docs/accounting-model.md` (the conventions we hand the CPA alongside the
statements).

Gate 1 (per `SCOPE.md`): CPA-reviewed financial statements produced from real
imported transactions, manually classified through the approval queue. The gate
verdict belongs to the reviewing CPA, not to us.

---

## 1. What the reviewing CPA will see

Pacioli is a local-first, double-entry accounting engine for digital assets
built on a four-layer model: **raw transactions → journal entries → general
ledger → reports**. Raw transactions are immutable evidence; journal entries
are interpretation; the ledger and reports are deterministic consequences.

Concretely, the review package demonstrates:

1. **Immutable evidence layer.** On-chain transactions imported from read-only
   wallet connections. Classification never modifies a raw transaction;
   journal entries reference them via an explicit linkage table
   (many-to-one and one-to-many supported).
2. **Journal entries with full provenance.** Every entry records its origin
   (`manual` only in Stage 1), who approved it, and approval/posting
   timestamps. Entries follow a strict lifecycle: draft → approved → posted,
   enforced at the database layer by triggers and in Rust by a `PostedEntry`
   type constructible only from balanced lines.
3. **Structural balance.** A posted entry whose debits do not equal credits is
   impossible by construction: amounts are stored as INTEGER minor units in
   the functional currency (USD cents) with **zero tolerance** — not floats —
   and token quantities as exact decimal strings validated by `rust_decimal`.
   Entries balance in the functional currency always, and per asset in
   quantity terms; cross-asset events (swaps, in-kind gifts) balance through
   explicit measurement lines (see `docs/accounting-model.md` §4).
4. **Append-only ledger.** Posted entries are never edited or deleted.
   Corrections are generated reversing entries; a voided entry and its
   reversal both remain in the ledger, net zero, cross-linked.
5. **Periods, close, and lock.** Monthly accounting periods with close: a
   database trigger blocks any posting dated within a closed period, through
   every path. Reopening is possible but logged (who, when, why).
6. **Statements derived from the ledger.** Trial balance, balance sheet, and
   income statement (with comparative prior period) are computed at query
   time from posted entries — no stored report figures. A `verify_ties`
   assertion runs before every statement is returned or exported: the balance
   sheet must balance, trial balance debits must equal credits, and income
   statement net income must cross-check the trial balance. A statement that
   does not tie is a hard error; it never renders silently.
7. **Cost basis (FIFO).** Lot tracking per wallet per asset; disposals consume
   lots FIFO and compute realized gain/loss; transfers between the user's own
   wallets move lots without realization, preserving cost basis and
   acquisition date (treatment documented in `docs/accounting-model.md`).
8. **Fair value under ASU 2023-08.** Period-end remeasurement of in-scope
   digital assets to fair value, with unrealized gain/loss through net
   income. Remeasurement produces **draft adjusting entries into the approval
   queue** — the approval gate applies to the system's own entries too;
   nothing writes to the ledger silently. Prices come from a configurable
   source (CoinGecko provider) with a manual, logged override always
   available.
9. **Verification depth.** 300+ automated tests, including a property-based
   suite (`proptest`, 27 properties) pinning the seven Stage-1 invariants
   against the production engine: generated entry streams always yield
   balanced trial balances, statements always tie, posting is idempotent,
   period locks hold, and FIFO lot consumption never goes negative and
   conserves quantity.

## 2. Known limitations (stated plainly)

Scope limitations the CPA should know before forming a view. None of these
weaken the invariants above; they bound what Stage 1 claims to do.

**Platform and surface**

- **Desktop is the system of record.** The journal engine, GL, and statements
  exist on the desktop (SQLite) build only. The web/PWA build has no journal
  path (deliberate board decision; revisit after Gate 1).
- **No fair-value UI yet.** The remeasurement engine (price recording,
  remeasure run, draft generation) is complete and tested behind Tauri
  commands, but the frontend surfaces are not built. In the rehearsal,
  period-end remeasurement is exercised via the command layer, not the UI.
- **No cost-basis report UI wired to the new engine.** The Rust FIFO engine is
  authoritative and tested; the legacy frontend cost-basis calculator page
  predates it and is not part of the review package.
- **CSV export only.** PDF export is deferred.

**Accounting scope**

- **FIFO only.** The lot-selection method sits behind a trait; LIFO/HIFO/
  specific-ID are future additions.
- **Single entity, US GAAP, functional currency USD.** No multi-entity
  consolidation, no IFRS/parallel books, no nonprofit fund accounting
  (restricted funds, functional expenses) — the nonprofit layer is Stage 3.
- **Manual classification only.** No rules engine and no AI drafting in
  Stage 1; every entry is classified and approved by a human. (A pre-existing
  auto-classification heuristic is parked/disabled; provenance fields already
  distinguish `manual`/`rule`/`model` origins for later stages.)
- **Manual period-end sequencing.** Remeasure → approve → post → close is
  driven step by step by the user; there is no orchestrated close workflow
  yet.
- **Own-wallet transfer detection is manual.** Transfers between the user's
  wallets must be classified as transfers by the user; the engine then moves
  lots without realization. Automatic detection is future work.
- **Disposal gain/loss journal lines are caller-constructed.** The cost-basis
  engine computes realized gain/loss and consumes lots; the corresponding
  journal entry is created through the normal draft→approve→post lifecycle
  (intentional: the system never posts silently).
- **Price-source coin mapping is manual.** CoinGecko asset-ID mapping is
  provided by the user per asset; no automated metadata lookup.

**Technical fine print**

- SQLite has no exact-decimal type. Functional-currency amounts are exact
  INTEGER minor units end to end. Token *quantities* are exact decimal TEXT
  validated in Rust; the SQL backstop trigger for per-asset quantity balance
  compares REAL casts (~15 significant digits). The Rust layer is the
  authoritative, exact gate; the SQL trigger is defense in depth against a
  hypothetical non-Rust writer.
- Period non-overlap is enforced in Rust (SQLite lacks exclusion
  constraints); a database-only writer could create overlapping periods.

## 3. Gate 1 rehearsal checklist

The rehearsal is run by the product owner with **real wallet data**, driven
against this checklist. Every friction point, surprise, or defect is captured
in `docs/stage1-progress.md` (Phase 10 findings) — we fix blockers only;
polish is logged, not chased.

1. **Setup.** Fresh desktop build from current `main`
   (`pnpm install --frozen-lockfile && pnpm tauri build` or `tauri dev`).
   Confirm the default chart of accounts is seeded.
2. **Connect wallets (read-only).** Add real wallet addresses. Confirm no
   signing capability is requested anywhere.
3. **Import history.** Sync raw transactions. Spot-check a handful against a
   block explorer (hash, direction, amount, timestamp).
4. **Create the period.** Create the monthly accounting period(s) covering
   the data under review.
5. **Classify.** Work the unclassified-transaction worklist for the chosen
   period: classify each raw transaction into a draft journal entry (citing
   the source transaction), including at least one acquisition, one disposal,
   and — if present — one own-wallet transfer. Confirm many-to-one linkage on
   at least one entry if applicable.
6. **Approve and post.** Work the approval queue: review evidence links,
   approve, post. Verify one edit-then-approve and one reject path. Confirm
   posted entries are immutable (edit attempts fail) and void generates a
   reversing entry.
7. **Cost basis.** For the disposal(s), record lot consumption via the FIFO
   engine and create the realized gain/loss entry through the queue. Verify
   the realized amount against a hand computation.
8. **Fair value.** Record period-end prices (command layer; manual override
   acceptable and logged). Run remeasurement; confirm draft adjusting entries
   appear in the approval queue with correct amounts vs. a hand computation;
   approve and post them.
9. **Close.** Close the period. Confirm posting into it now fails from every
   surface (manual entry, classification, void-reversal). Reopen once to
   verify the audit log, then re-close.
10. **Statements.** Generate trial balance, balance sheet, and income
    statement for the period (with comparative prior period if data allows).
    Confirm `verify_ties` passes, figures are plausible against the wallet
    reality, and CSV export opens cleanly in a spreadsheet.
11. **Audit walk.** Pick one statement figure and walk it back: statement →
    account → posted entries → approval trail → source raw transaction(s).
    This is the demo the CPA will care about most.
12. **Package.** Export the three statements to CSV; bundle with
    `docs/accounting-model.md` and this report; deliver to the reviewing CPA.

## 4. Demo script for the CPA review session (~30 minutes)

1. **The thesis (2 min).** Four layers; evidence vs. interpretation; every
   figure of record computed deterministically; nothing posts without human
   approval — including the system's own remeasurement entries.
2. **Evidence (3 min).** Show imported raw transactions; show one against the
   block explorer; state that classification never mutates them.
3. **Interpretation (7 min).** Open a posted journal entry from the period:
   provenance (origin, approver, timestamps), the cited source transaction,
   balanced lines in minor units, per-asset quantities, a measurement-line
   example for a cross-asset event. Attempt to edit it — show the refusal.
   Show a void and its generated reversing entry.
4. **Controls (5 min).** Approval queue walkthrough; period close — attempt a
   posting into the closed period and show the hard failure; show the reopen
   audit log.
5. **Statements (8 min).** Trial balance ties; balance sheet balances; income
   statement with realized gains (FIFO, show the lot math for one disposal)
   and unrealized fair-value movement through net income (ASU 2023-08).
   Walk one figure end to end back to the on-chain evidence.
6. **Boundaries (5 min).** Read §2 known limitations aloud — verbatim, not
   softened. Invite structural fault-finding; capture every observation.

## 5. Rehearsal findings (filled during the live run)

| # | Step | Observation | Severity (blocker / friction / note) | Disposition |
|---|------|-------------|--------------------------------------|-------------|
| 1 | §3 step 2 (import history) | Moonbeam wallet sync failed with "Etherscan API error: Invalid API Key" — `moonscanService` was calling the Etherscan V2 unified endpoint (`api.etherscan.io/v2/api?chainid=1284`), which does not serve Moonbeam; Moonbeam requires the direct Moonscan API with its own (optional) key. | blocker | **Fixed** — PR #227: direct per-chain Moonscan endpoints (`api-moonbeam.moonscan.io` / `api-moonriver.moonscan.io`), separate `moonscan` key namespace (Settings → Data Providers card added), keyless access permitted at ~1 req/5s, removed the sync-blocking no-key early return. |
| 1a | §3 step 2 (import history) | Accompanying "Not connected to moonbeam" error — separate WS-RPC connection path (balances / recent-block scan), distinct from the Moonscan HTTP fix above. Watch on retest: if it persists, report as its own finding. | note | Monitoring — retest after finding #1 fix. |

## 6. Outcome

_Pending — the statements are in the CPA's hands when steps 1–12 complete.
The gate verdict is theirs._
