# Gate 1 Report — CPA Review Package (Stage 1)

Status: **rehearsal pending** — this document is prepared ahead of the Gate 1
rehearsal (Phase 10). The rehearsal findings section at the end is filled in
during the live run with real data. Companion document:
`docs/accounting-model.md` (the conventions we hand the CPA alongside the
statements).

> **Revision 2026-09-11 (pre-rehearsal reconciliation).** This package was
> authored 2026-07-17, when the EVM rehearsal path ran through Moonbeam. Moonbeam
> and Moonriver were **sunset on 2026-07-31** and removed from the sync network
> dropdown (`GIV-888`); the live EVM set is now **Ethereum and the L2s
> (Arbitrum One, Base, Optimism, Polygon, BNB Smart Chain)**, plus Substrate,
> Bitcoin, and Solana. The checklist in §3 below has been updated accordingly.
> Findings #1–#3 in §5 remain accurate as history (they document the Moonbeam
> path) and their lesson — single-provider fragility — was the direct
> justification for Phase 4a (provider fallback + resumable cursors). Two
> limitations in §2 have also been corrected: a deterministic rules engine and
> heuristic auto-classification now exist (still no AI/model drafting), and a
> nonprofit slice (Statement of Activities, functional classification) plus
> manual bank-statement import have landed since Stage 1 closed. See
> `docs/v1-readiness-plan.md` for the current stage picture.

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
   (`manual` for hand-entered entries; `rule` for deterministic rules-engine or
   heuristic auto-classification; no `model` origin exists yet), who approved
   it, and approval/posting
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
- **Deterministic classification only; no AI/model drafting.** A deterministic
  rules engine (CRUD, starter packs, payee→GL maps) and heuristic
  auto-classification are implemented and available in the classification
  queue; **no model/AI provider is wired** and no entry is ever produced with
  `origin='model'`. Every auto-classified entry is written as `origin='rule'`
  and still passes through the same approval gate. Provenance fields already
  distinguish `manual`/`rule`/`model` origins for Stage 2.
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
  INTEGER minor units end to end. Token _quantities_ are exact decimal TEXT
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

### Pre-run requirements (all external to the code)

| #   | Requirement                                                                                                                                                         | Owner         | Status                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Etherscan V2 API key** (<https://etherscan.io/myapikey>), saved in Settings → Data Providers → **Etherscan**. Legacy moonscan.io keys do **not** work on V2.      | Product owner | ✅ **Supplied and validated 2026-09-11** (see finding #4)                                                                                                                                                                                                                                 |
| P1b | **Subscan API key** (<https://support.subscan.io>), saved under **Subscan**. Subscan disabled unauthenticated access; without this, Polkadot sync returns HTTP 403. | Product owner | ❌ **Supplied 2026-09-13 but rejected** — Subscan returns `code 20009 "API key invalid"` on the `X-API-Key` header (finding #8). Polkadot is blocked until a valid key is saved.                                                                                                          |
| P2  | **Real wallet addresses with legitimate history** — at least one chain carrying an acquisition, a disposal, and ideally an own-wallet transfer.                     | Product owner | ✅ **Polkadot `[redacted]` verified active** — [redacted], 2022-12 → 2025-10, nominationPools / xcmPallet / convictionVoting. ✅ **Ethereum `[redacted]` verified** — clean 6-tx fixture (2026-09-12). ⚠️ **The real EVM history is on Moonbeam, which the app removed** — see finding #10. |
| P3  | A reviewing CPA willing to spend ~30 minutes and return written observations                                                                                        | Board         | ❌ Outstanding                                                                                                                                                                                                                                                                            |

**Rehearsal data inventory (verified by live probe 2026-09-13).**

EVM `[redacted]` — 6 real transactions, all on **Ethereum**, all 2026-09-12:

| Time (UTC) | Direction | Detail                                      | Rehearsal role                    |
| ---------- | --------- | ------------------------------------------- | --------------------------------- |
| 16:20      | IN        | [redacted] ETH                            | acquisition                       |
| 20:34      | OUT       | 0.005 ETH → `[redacted]` (MetaSwap router) | disposal / swap                   |
| 20:46      | IN        | 0.001 ETH from self                         | own-wallet transfer               |
| 20:56      | OUT       | 0.001 ETH → `[redacted]`                 | disposal                          |
| —          | IN        | [redacted] mUSD (MetaMask USD, 6dp)          | token receipt                     |
| —          | IN        | 5.0 ECX (eCash.com, 9dp)                    | token receipt (verify legitimacy) |

Current ETH balance [redacted]. This satisfies checklist §3 step 5's acquisition / disposal / transfer requirement on Ethereum. Note the original address `[redacted]` (finding #6) remains useful as an unsolicited-airdrop/dust adversarial fixture.

**Interim Substrate (Polkadot) options while the Subscan key is unresolved** — the product owner asked for a workaround (2026-09-13):

1. **Run Gate 1 on Ethereum only.** The verified EVM data covers acquisition, disposal and an own-wallet transfer; Polkadot becomes a documented limitation of this gate. Lowest effort, and the honest position: the gate needs _real imported transactions_, not every chain.
2. **RPC-only Substrate sync — already implemented, no Subscan needed.** The app scans a recent window (last 1,000 blocks; up to 10,000 on an incremental refresh) and falls back automatically. Good enough to keep building and testing the Substrate path; **not** good enough for a real historical import. Finding #9's fix now makes the app say so explicitly instead of presenting partial history as complete.
3. **A valid Subscan key — the real fix.** Subscan's free tier is sufficient for this volume. Verify or regenerate at <https://support.subscan.io>; unauthenticated access is permanently disabled.

Longer term, the Phase 4a Substrate registry (Dwellir RPC fallback) is scaffolded but its history adapter is still a placeholder. The key-free alternatives were evaluated on 2026-09-13:

- **Dotlake API** (Parity, <https://api.data.parity.io>) — the supplied key was **validated and works**; it is **not a Subscan replacement for general transaction history**. Per-account coverage is: `explorer/account/{address}/summary` (total*txs, first/last seen, top pallets — no amounts), `explorer/recent-extrinsics?address=` (\_recent* only, no pagination into history), `daily-staking-rewards` (full date range), `xcm-transfers` (paginated, date-ranged), and `explorer/extrinsic/{hash}` lookup. It exposes **no** per-account list of ordinary `balances.transfer` history. It is therefore a useful **complement** behind a provider trait — staking rewards and XCM transfers, both of which Pacioli needs — but not a substitute for the transfer history the ledger imports.
- **Self-hosted indexer** (SubQuery / Subsquid) — the only key-free route to full transfer history; real work, and the "own indexing" option the board already deferred.

**Conclusion: Dotlake does not resolve the Subscan gap.** Gate 1 should run on Ethereum (verified data), with Polkadot treated as a documented limitation until an active address and a valid Subscan key exist.

**Decision taken 2026-09-13 — restore Moonbeam read-only for historical import.**

The product owner chose option (a) from finding #10. Implemented as:

- **Routing:** Moonbeam (`chainid` 1284) now goes through the Etherscan V2 explorer path (`evmTransactionService`) rather than `moonscanService`, which hard-throws after the sunset date. Etherscan V2 still serves 1284 correctly.
- **Availability:** added to `PURE_EVM_NETWORKS` and `NETWORK_DECIMALS`, and restored to the network dropdown under a clearly labelled **"Historical — sunset chains (import only)"** group.
- **No live sync:** `useBlockSubscription` skips sunset chains — there are no new blocks; this is a read-only historical import.
- **Moonriver is not restored** (no rehearsal data for it).
- **Prerequisite:** finding #11's key plumbing, without which the EVM path cannot authenticate at all.

**Recommended rehearsal window:** the account's Moonbeam history is [redacted] transactions (2023-02 → 2026-05) — far too many for manual Stage 1 classification. Two workable, real windows:

| Window      | Volume                        | Notes                                                         |
| ----------- | ----------------------------- | ------------------------------------------------------------- |
| **2026-01** | 6 native + 13 ERC-20 = **19** | Recent, light, includes swaps and transfers. **Recommended.** |
| 2023-12     | 18 native + 9 ERC-20 = **27** | First month with ERC-20 activity.                             |

Use the GIV-716 import-selection filter to import only the chosen window.

**Free-tier chain coverage (important).** The supplied Etherscan V2 key is on the
free plan. A live probe on 2026-09-11 showed the free plan serves **Ethereum,
Arbitrum, and Polygon** but returns `NOTOK — "Free API access is not supported
for this chain"` for **Base, Optimism, and BNB Smart Chain** — all of which the
wallet network dropdown currently offers. Those chains need a paid Etherscan
plan, or the dropdown should mark them as unavailable for the configured key.

### Checklist

1. **Setup.** Fresh desktop build from current `main`
   (`pnpm install --frozen-lockfile` with pnpm 10, then `pnpm tauri build` or
   `pnpm tauri:dev`). Confirm the default chart of accounts is seeded.
2. **Connect wallets (read-only).** Add real wallet addresses. Confirm no
   signing capability is requested anywhere. **Use the current network set:
   EVM (Ethereum / Arbitrum / Base / Optimism / Polygon / BNB) via Etherscan V2,
   plus Substrate, Bitcoin, Solana. Moonbeam/Moonriver are sunset and are no
   longer selectable — do not spend rehearsal time on them.**
3. **Import history.** Sync raw transactions. Spot-check a handful against a
   block explorer (hash, direction, amount, timestamp). If a provider is
   unavailable, confirm the UI shows a graceful "provider temporarily
   unavailable" state rather than a raw API error (Phase 4a behavior), and
   confirm a re-sync resumes without duplicating rows.
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

| #   | Step                            | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Severity (blocker / friction / note)  | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | §3 step 2 (import history)      | Moonbeam wallet sync failed with "Etherscan API error: Invalid API Key" — `moonscanService` was calling the Etherscan V2 unified endpoint (`api.etherscan.io/v2/api?chainid=1284`), which does not serve Moonbeam; Moonbeam requires the direct Moonscan API with its own (optional) key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | blocker                               | **Fixed** — PR #227: direct per-chain Moonscan endpoints (`api-moonbeam.moonscan.io` / `api-moonriver.moonscan.io`), separate `moonscan` key namespace (Settings → Data Providers card added), keyless access permitted at ~1 req/5s, removed the sync-blocking no-key early return.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1a  | §3 step 2 (import history)      | Accompanying "Not connected to moonbeam" error — separate WS-RPC connection path (balances / recent-block scan), distinct from the Moonscan HTTP fix above. Watch on retest: if it persists, report as its own finding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | note                                  | Monitoring — retest after finding #1 fix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2   | §3 step 2 (import history)      | Retest after finding #1: Moonbeam sync failed with "Moonscan API error: You are using a deprecated V1 endpoint, switch to Etherscan API V2" — Moonscan has since deprecated its per-chain V1 endpoints entirely; the platform's own error directs callers to the V2 unified endpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | blocker                               | **Fixed** — PR #228: migrated back to the Etherscan V2 unified endpoint (`api.etherscan.io/v2/api`) with `chainid=1284`/`1285`, matching every other EVM chain; `moonscan` key namespace retained for keychain lookup. Rebuild and retest Moonbeam sync from checklist §3 step 2.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | §3 step 2 (import history)      | Retest after finding #2 (and after PR #230's etherscan-key fallback): sync failed with "Moonscan API error: Invalid API Key (#err2)". Live API probe: keyless requests return "Missing/Invalid API Key", while a rejected key returns exactly "Invalid API Key (#err2)" — so a key IS being sent and rejected. Root cause: the key saved under the Moonscan provider during finding #1 (valid, at most, on retired Moonscan V1) is invalid on Etherscan V2, and its presence shadowed PR #230's fallback, which only fired when no moonscan key existed.                                                                                                                                                                                                                                                                              | blocker                               | **Fixed (code) + user action required** — key-candidate retry in `moonscanService`: every configured key (keychain moonscan → etherscan → localStorage → env) is tried in order, skipping any the server rejects; when all candidates fail the error now carries remediation steps. User action: create a free key at <https://etherscan.io/myapikey> and save it in Settings → Data Providers under "Etherscan" (legacy moonscan.io keys do not work on V2). Retest §3 step 2.                                                                                                                                                                                                                      |
| 4   | §3 step 2 (import history)      | **Pre-run probe 2026-09-11.** Supplied Etherscan V2 key validated: `chainid=1` returns `status:1, OK`. But the free plan serves only **Ethereum, Arbitrum, Polygon**; **Base, Optimism, BNB Smart Chain** return `status:0, NOTOK, "Free API access is not supported for this chain. Please upgrade your api plan"` — yet all three remain selectable in the wallet network dropdown (`WalletManager.tsx:313-322`).                                                                                                                                                                                                                                                                                                                                                                                                                   | blocker                               | **Open — needs decision/remediation.** Options: (a) gate the dropdown to chains the configured key actually serves, (b) label paid-only chains clearly, (c) upgrade the Etherscan plan. Until then a user picking Base/Optimism/BNB gets a failed or empty sync.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | §3 step 2 (import history)      | **Subscan now requires an API key.** A live probe of `polkadot.api.subscan.io` on 2026-09-11 returns HTTP 403: _"Subscan API strictly requires an API key. Unauthenticated access is disabled."_ The app supports a Subscan key (`subscanService.ts:148,496-503`) and lists it in Data Providers, but none is configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | blocker                               | **Open — user action.** Add a Subscan API key under Settings → Data Providers → **Subscan** (P1b), or Polkadot sync cannot run. This is the same single-provider-fragility class as findings #1-#3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | §3 step 3 (import history)      | **Supplied EVM address carries no legitimate history.** `[redacted]` has zero native transactions on Ethereum and Arbitrum; its only activity is **[redacted] ERC-20 transfers on Polygon and 1 on Arbitrum, all unsolicited scam airdrops** (token names like "ACCESS [DOTFI.ORG] TO CLAIM", "stETH Visit www.weth.top to claim reward") sent from a single dusting address `[redacted]`, 2024-04-14 → 2025-06-15. No acquisition, disposal, or own-wallet transfer exists to rehearse.                                                                                                                                                                                                                                                                                                                                            | blocker (for the planned walkthrough) | **Superseded 2026-09-13** — a replacement EVM address with real activity was supplied and verified (see the pre-run data inventory). This original address is retained as an unsolicited-airdrop/dust adversarial fixture, which is itself worth rehearsing.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | §3 step 2 (import history)      | **The EVM TypeScript sync path silently swallows provider errors into "0 transactions found."** `evmTransactionService.fetchNormalTransactions` and `fetchTokenTransfers` return `[]` both when the request throws and when `data.status !== '1'` (`evmTransactionService.ts:283-303`, `:338-350`). A free-tier `NOTOK`, a 403, or a rate-limit therefore renders as an empty wallet rather than a visible failure — the exact "silently incomplete history" class the Phase 4a mandate forbids. The Subscan path was fixed to throw on non-zero codes (`8fd0ded`); the EVM TS path was not.                                                                                                                                                                                                                                          | blocker                               | **Fixed 2026-09-11.** Added `EVMExplorerError` + `parseExplorerResult` to `evmTransactionService.ts`: an array `result` (including an empty one) is data; `"No transactions found"` is empty; anything else (`NOTOK`, string error, missing result, non-2xx HTTP) throws. `fetchTransactionHistory` re-raises capability errors instead of masking them with the RPC fallback, while transient/network errors still fall back to RPC as before. Five regression tests added (unsupported-chain surfaced, reason/chain in message, empty array benign, "No transactions found" benign, transient error still falls back). Suite: 479/479 Vitest green, `tsc --noEmit` clean, eslint + prettier clean. |
| 8   | §3 step 2 (import history)      | **Supplied Subscan API key is rejected.** A live probe on 2026-09-13 against `polkadot.api.subscan.io` with the key on the `X-API-Key` header (exactly what `subscanService.makeRequest` sends) returns HTTP 403 `{"code":20009,"message":"API key invalid"}`. Alternative auth forms were also rejected (`x-api-key` → 20009; key in the JSON body → 403 "strictly requires an API key"; `Authorization: Bearer` → 403). So the key reaches Subscan's auth layer and is refused — it is not a missing-header problem.                                                                                                                                                                                                                                                                                                                | blocker                               | **Open — user action.** Verify or regenerate the key at <https://support.subscan.io> (confirm it is a Subscan _API_ key for the correct environment and that the account's API access is active). The app surfaces this as a thrown error (the `8fd0ded` fix), so it will not be silent — but Polkadot sync cannot run until a working key is saved.                                                                                                                                                                                                                                                                                                                                                 |
| 9   | §3 steps 2-3 (Substrate import) | When Subscan is unavailable the hybrid sync silently degrades to an RPC scan of only the **last ~1,000 blocks**, and returned a short list that looked complete — the completion message said only "0 from Subscan, N from blockchain". A Polkadot wallet with months of history could be recorded as a handful of recent transactions. Worse, if Subscan _and_ RPC both failed the method returned `[]`, indistinguishable from a genuinely empty wallet.                                                                                                                                                                                                                                                                                                                                                                            | blocker (accounting correctness)      | **Fixed 2026-09-13.** `polkadotService.fetchTransactionHistoryHybrid` now (a) throws a user-facing "Could not import transaction history" error when both Subscan and RPC produce nothing, instead of returning `[]`; and (b) appends an explicit _"Subscan is unavailable… older history is NOT included"_ warning to the completion message whenever Subscan contributed zero transactions. 2 regression tests added. 481/481 Vitest green, tsc/eslint/prettier clean.                                                                                                                                                                                                                             |
| 10  | §3 steps 2-3 (import)           | **The product owner's real EVM history is on Moonbeam — the chain the app removed.** Dotlake's XCM records link the corrected Polkadot address `[redacted]` ([redacted], 2022-12-17 → 2025-10-24; top pallets nominationPools / xcmPallet / convictionVoting) to the originally supplied EVM address `[redacted]`, which is active on **Moonbeam (chainid 1284)**: 1000+ native txs (2023-02 → 2024-11) and 1000+ ERC-20 transfers (STELLA, WGLMR, xcDOT, xcUSDC, xcPEN, xcMANTA), plus [redacted] to Moonbeam / Bifrost / HydraDX / Astar across 2024-01 → 2026-07. `GIV-888` removed Moonbeam/Moonriver (sunset 2026-07-31), but **Etherscan V2 still serves chainid 1284 historical data** (`status:1 OK`). Gate 1 requires importing _your own_ real wallets; as shipped, the app cannot import this user's real EVM history. | blocker (gate scope)                  | **Open — product decision.** (a) restore Moonbeam **read-only for historical import** — the sunset affects live tracking, not historical accounting; (b) rehearse the Polkadot side via a valid Subscan key; (c) use the fresh Ethereum wallet `[redacted]` as a _disclosed_ fixture rather than "real history". Scale note: 1000+ Moonbeam txs is impractical for manual Stage 1 classification — scope the rehearsal to a bounded period using the GIV-716 import-selection filter.                                                                                                                                                                                                                   |
| 11  | §3 steps 2-3 (EVM import)       | **The EVM explorer path never sent an API key.** `evmTransactionService` declared an `apiKey` field on `BlockExplorerConfig` but never read or sent it, so `fetchNormalTransactions` / `fetchTokenTransfers` called Etherscan V2 **keyless** — and V2 rejects keyless requests with "Missing/Invalid API Key". Every EVM chain, Ethereum included, therefore either fell through to a recent-blocks RPC scan or (after finding #7's fix) surfaced a key error. Moonscan/subscan read the keychain correctly; the EVM path never did.                                                                                                                                                                                                                                                                                                  | blocker                               | **Fixed 2026-09-13.** Added `getApiKeyCandidates()` (Tauri keychain → localStorage → build-time env, mirroring `moonscanService`) and a shared `fetchExplorer()` that sets `apikey` and retries each configured key until one is accepted, so a stale key cannot shadow a valid one. 1 regression test added; **482/482 Vitest green**, tsc/eslint/prettier clean.                                                                                                                                                                                                                                                                                                                                   |

## 6. Outcome

_Pending — the statements are in the CPA's hands when steps 1–12 complete.
The gate verdict is theirs._
