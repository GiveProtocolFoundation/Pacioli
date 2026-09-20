# Design note — Digital-asset taxonomy → measurement mapping

**Status:** accepted for implementation (board: fix before rehearsal).
**Scope:** single-ledger US GAAP. This note deliberately excludes the
multi-ledger / multi-jurisdiction architecture the review described — that is
`SCOPE.md` §5 NOT-DO territory (no IFRS/parallel-book delivery before Gate 4).
**Source:** the product owner's written review of 2026-09-18, recorded verbatim
in `docs/gate1-report.md` §6.

---

## 1. Purpose

The review established that Pacioli's measurement model is wrong in three ways
that the rehearsal data (the 2023-12 Moonbeam window) will actually trigger, and
that the asset taxonomy already exists in the data model but does not *drive*
measurement. This note specifies the mapping that closes the gap, scoped to
single-ledger correctness, so the fix can be implemented and tested before the
rehearsal.

## 2. What exists today

The taxonomy is present as **data**, not as **behavior**:

- `src/types/digitalAssets.ts` — `DigitalAssetType` union (`stablecoins`,
  `wrapped-bridged-tokens`, …).
- `src/data/digitalAssetAccounts.ts` — dedicated GL accounts per type.
- `src/data/tokenSeedData.ts` — seed rows carrying `digitalAssetType`.
- `src-tauri/src/api/accounting.rs` — `digital_asset_type` is a column on the
  account record (e.g. lines 31, 506, 558).

The measurement paths do not consult it:

- Fair-value remeasurement remeasures **all holdings** (`docs/accounting-model.md`
  §11, "all holdings").
- Disposal proceeds are **"echoed from input"** (`cost_basis.rs:188-189`) — the
  engine measures `gain = proceeds − cost` against whatever number the caller
  supplied, with no relinquished-first logic and no record of which asset priced
  the swap.
- Network fees are already expensed to GL **5100** (`accounting.rs:1598-1613`).

So the gap is: **classification data exists; the measurement rules it implies do
not.**

## 3. The three blockers and two frictions

| # | Finding | Severity |
| - | ------- | -------- |
| 1 | Stablecoins are marked-to-market; US GAAP treats them as receivables at par, excluded from ASC 350-60 | Blocker |
| 2 | Wrapped/bridged tokens are marked-to-market identically to native; strict ASC 350-60 reading pushes them to cost-less-impairment | Blocker (judgment call) |
| 3 | Swap proceeds direction is unenforced (received-first by default, no valuation-source metadata) | Blocker |
| 4 | No peg-variance check for stablecoins (CECL trigger) | Friction |
| 5 | No unpriced-holding quarantine, no UTC-cutoff disclosure | Friction |

## 4. The mapping (requirements)

### 4.1 Stablecoins → receivables at par

- **Scope rule:** `digital_asset_type = 'stablecoins'` (or any asset recorded as
  a redeemable-fiat claim) is **excluded from the fair-value remeasurement scan**.
- **Measurement:** amortized cost = par. Carrying amount = `quantity × 1.0` USD
  in minor units. No unrealized gain/loss is generated for the stablecoin leg.
- **Peg-variance check (CECL trigger):** flag for credit review only when a
  deviation from par **persists**, so momentary market mechanics — a DEX pool
  drain, oracle lag, an arb that closes in minutes — do not raise false alarms.
  A `credit_review` flag is set when the deviation from par exceeds **0.5%**
  (configurable) **sustained over 24 hours**, measured as a 24-hour TWAP
  deviation or a point-in-time deviation that persists across a ≥24 h window —
  not on a single snapshot. Stage 1 is **flag-only**; a full CECL reserve engine
  is out of scope (see §6).
- **Swap interaction:** a stablecoin *received* in a swap is measured at par for
  the swap's proceeds computation.

### 4.2 Wrapped/bridged tokens → election-driven fork

- **Scope rule:** `digital_asset_type = 'wrapped-bridged-tokens'` defaults to
  `technological-format`; switching to `legal-claim` requires an explicit,
  auditable per-asset override.
- **Two modes:**
  - `technological-format` — the entity concludes the wrapper is a format, not a
    legal claim (the review's carve-out). Treated as the native asset: same
    ticker link, fair-value as native.
  - `legal-claim` — cost-less-impairment intangible model. Excluded from
    fair-value remeasurement; carrying = cost basis net of impairment; impairment
    tested, not auto-remasured.
- **Election is persisted** (`measurement_election`: asset, mode, rationale,
  recorded_by, recorded_at) so the audit trail answers *why* a wrapper was or
  was not marked to market — and so overrides are the exception, not the rule.
- **Default (decided 2026-09-18): `technological-format` for all wrappers and
  bridges — economic substance over form.** A wrapper is a token standard
  applied to a native asset so it can interact with smart contracts, and the
  market prices it to track the native. Defaulting to cost-less-impairment would
  create the asymmetry where native ETH marks to market while wETH sits at
  historical cost — a distortion for any DeFi-active treasury.
- **`legal-claim` is a manual, per-asset override**, reserved for when a bridge
  is exploited or a wrapper fundamentally de-pegs/detaches from the native's
  fair value — not a default and not an automatic fork.
- A **bridged stablecoin** (xcUSDT) resolves to §4.1 regardless — it is a
  redeemable-fiat claim first, a bridge second.

### 4.3 Network fees

- **Book (decided 2026-09-18): network fees are expensed to GL 5100 as
  General & Administrative.** G&A is the default because, for the overwhelming
  majority of treasuries, a gas fee is the functional equivalent of a bank wire
  or ACH charge. **Cost of Revenue is a configurable, ledger-level toggle** for
  crypto-native operators whose core revenue mechanism *is* on-chain transacting
  — a market maker, HFT firm, liquid-staking provider, or rollup sequencer
  paying L1 settlement fees — not the out-of-the-box default.
- **Tax:** capitalization into basis is **deferred** — there is no tax ledger
  pre-launch.

### 4.4 Swap proceeds → relinquished-first waterfall

- **Rule:** proceeds = fair value of the **relinquished** asset, unless the
  received asset's value is "more clearly evident" (the relinquished asset has
  no observable principal-market price or liquidity below a configurable
  threshold).
- **Behavior:** a `ProceedsValuation` step, invoked when a swap/disposal is
  classified, that:
  1. prices the relinquished asset;
  2. fails over to the received asset only on the configured condition;
  3. records `valuation_source ∈ {relinquished, received}` and the price
     observation(s) used, on the `lot_consumptions` record (and mirrors them in
     the disposal entry's provenance).
- This replaces "echo from input" for swaps. A manual override remains available
  and is logged like every other manual override.

### 4.5 UTC cutoff + unpriced quarantine

- **Cutoff:** the period-end pricing snapshot is taken at **00:00 UTC** of the
  period-end date. The remeasurement already keys on a date; the UTC semantics
  are made explicit in the model and disclosed in statement footnotes.
- **Unpriced holdings:** remeasurement already returns `status='partial'` when
  some holdings lack a price (`accounting-model.md` §11). Add a **quarantine
  view**: holdings with no price observation, carried at cost (or $0 for
  airdrops), aggregated and compared against a materiality threshold. A
  zero-liquidity token must never halt valuation — the ledger keeps moving.
- **Materiality (decided 2026-09-18): warn when the unpriced bucket exceeds
  either 1% of total assets OR 5% of net income.** The balance-sheet threshold
  alone is not enough: in a bear market a large asset base can make a 0.8%
  unpriced holding look immaterial to the sheet while a sudden liquidation
  swings the P&L materially. Both conditions are checked; the run stays
  `partial`.

## 5. Code changes implied

1. `remeasurement` scan: skip stablecoins (§4.1) and wrapped/bridged assets with
   an explicit `legal-claim` override (§4.2).
2. A measurement-mode resolver keyed off `digital_asset_type` + the
   `measurement_election` table (default `technological-format`).
3. Peg-variance flag for stablecoins (§4.1) — flag-only, triggered by a
   24h-sustained / TWAP deviation, not a point-in-time snapshot.
4. `lot_consumptions`: add `valuation_source` + `price_observation_id` columns
   (§4.4), backfilled by the proceeds waterfall.
5. `ProceedsValuation` for swaps (§4.4).
6. Unpriced quarantine view + materiality config (1% of assets OR 5% of net
   income) (§4.5).

## 6. Explicitly out of scope

- Multi-ledger IFRS / US GAAP / tax and per-legal-entity timezone snapshots —
  `SCOPE.md` §5 NOT-DO until Gate 4.
- A full CECL reserve engine — flag-only in this pass.
- Tax-basis fee capitalization (no tax ledger).
- Statutory sub-ledgers.

## 7. Decisions (2026-09-18)

1. **Wrapper default — `technological-format`** (fair value, economic substance
   over form). `legal-claim` is a manual, per-asset override for exploited or
   de-pegged bridges. (§4.2)
2. **Peg-variance — 0.5%**, but triggered by a **24-hour TWAP / sustained
   deviation**, not a point-in-time snapshot, to suppress market-mechanic false
   positives. (§4.1)
3. **Unpriced materiality — warn if >1% of total assets OR >5% of net income.**
   (§4.5)
4. **Fee default — G&A (GL 5100).** Cost of Revenue is a configurable,
   ledger-level toggle for crypto-native operators. (§4.3)

## 8. Test implications

Rust tests for: a stablecoin holding is not remeasured; a wrapper in each mode
(default `technological-format`; an override to `legal-claim`); the peg-variance
flag firing on a sustained deviation but not a momentary wick; the proceeds
waterfall choosing relinquished then received; `valuation_source` being
recorded; and the quarantine warning on either threshold (1% of assets or 5% of
net income). The existing proptest invariant
suite (trial balance ties, statements tie) must remain green — the carve-outs
must not reintroduce a path that breaks the balance invariant.
