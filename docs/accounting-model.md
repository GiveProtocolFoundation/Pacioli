# Pacioli Accounting Model

This document records the accounting conventions the Pacioli engine
implements. It is the companion document to the financial statements and is
intended to be read by a reviewing CPA. Every convention here was proposed
in the Stage 1 Phase 0 recon (`docs/stage1-progress.md` §5–§6) and approved
by the board on 2026-07-15 (GIV-668).

Sections marked *(reserved)* will be completed in the phase that implements
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
  *reference* raw transactions, never modifies them.

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
   entry's debit quantities equal its credit quantities *for that asset*,
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

| Line | Account | Asset | Qty | Debit | Credit |
|------|---------|-------|-----|-------|--------|
| 1 | Digital assets — B | B | +4 | $150.00 | |
| 2 | Digital assets — A | A | −10 | | $100.00 |
| 3 | Realized gain on digital assets | — | | | $50.00 |

Lines 1–2 balance each asset's quantity movement; line 3 is the
measurement line carrying the valuation difference to net income. The
entry balances in USD exactly ($150.00 = $100.00 + $50.00).

## 4. Entry lifecycle and append-only corrections (approved Q4)

- **Lifecycle:** `draft → approved → posted`, with `voided` as the only
  terminal correction state. Drafts may be edited freely. Posted entries
  are immutable at the data layer (enforced by triggers).
- **Corrections are reversing entries.** A posted entry is never edited or
  deleted. Voiding a posted entry generates and posts a full reversing
  entry, links the pair (`reversed_by_entry_id`), and records who voided
  it and why. (The legacy flag-flip void is replaced in Phase 2.)
- Adjustments follow the same rule: new adjusting entries, never edits.

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

## 8. Transfers between own wallets *(reserved — Phase 7)*

Treatment of lot movement without realization will be documented when the
cost-basis engine lands.

## 9. Cost basis *(reserved — Phase 7)*

FIFO lot relief, per wallet per asset; method documented with the engine.

## 10. Fair-value measurement *(reserved — Phase 8)*

ASU 2023-08 remeasurement conventions, price sources, and override policy
will be documented with the measurement framework.
