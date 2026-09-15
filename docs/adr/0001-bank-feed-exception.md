# ADR 0001 — Bank feeds ahead of Gate 4 (exception to the NOT-DO list)

- **Status:** Proposed — **pending board ratification**
- **Date:** 2026-09-14
- **Deciders:** board (Pacioli founders)
- **Supersedes:** nothing. **Would amend:** `SCOPE.md` §5 NOT-DO list.

## Context

`SCOPE.md` §5 puts bank feeds on the pre-launch NOT-DO list: *"Until Gate 4, the
following are out of scope. Do not build them, scaffold them, or 'prepare' for
them."* §4 adds that stages are sequential and that work beyond the current gate
needs an explicit justification tied to a gate.

That instruction was not followed. Bank feeds were designed, built, merged and
tested across at least four tickets, all while Gate 0 and Gate 1 were open:

| Ticket | What landed | Where |
|---|---|---|
| GIV-825 (#280) | Bank tables + persistence methods | `src-tauri/migrations/20260804000001_bank_transactions.sql`, `20260804000002_bank_classification_queue.sql`, `src-tauri/src/api/bank.rs` (519 lines), `indexedDBPersistence.ts`, `tauriPersistence.ts`, `types.ts` |
| GIV-828 (#292) | Bank classification queue | `src/app/classification/ClassificationQueue.tsx`, `classificationUtils.ts` |
| GIV-829 | Payee-based classification rules + payee→GL map | `src/app/classification/ClassificationRules.tsx` |
| GIV-856 | Seed GL accounts for starter rules | `src-tauri/migrations/20260805000002_seed_bank_expense_accounts.sql` |

This is not dead code or a stray scaffold. It is a reachable, tested feature:
there is a `BankAccountManager` screen, a navigation entry, and 320 lines of
persistence tests (`src/services/persistence/__tests__/bankPersistence.test.ts`)
plus `classificationUtils.test.ts`. The code compiles, the suites are green, and
`cargo test` now runs in CI.

So the question is no longer "should we build this?" — that happened. It is:
**ratify the work as a deliberate exception, park it, or revert it.** Leaving the
contradiction unresolved is the one option that is not available, because
`SCOPE.md` is the document every session (human or AI) is instructed to treat as
binding, and a binding document that is knowingly false about the codebase is
worse than no document.

## Options

### Option A — Ratify the exception (recommended)

Amend `SCOPE.md` §5 to remove bank feeds from the NOT-DO list, and record in the
operating plan that bank feeds are in scope for the Gate 1–3 window.

**For.** The beachhead persona is *small nonprofits receiving digital-asset
gifts*. A nonprofit's books are overwhelmingly fiat: payroll, rent, grant
disbursements, card spend. A ledger that can only ingest crypto cannot close a
month for the persona it exists to serve — which is precisely what Gate 3
requires ("≥3 organizations close a real month"). On that reading, bank feeds are
not scope creep; they are on the MVP spine (`SCOPE.md` §3), and the NOT-DO list
was simply wrong when it was written.

**Against.** This is exactly the drift `docs/v1-readiness-plan.md` §4 names as
the project's principal risk — *"continuing to widen infrastructure instead of
closing the loop from raw transaction to financial statement for one real user."*
Ratifying after the fact rewards the process failure and establishes the
precedent that the NOT-DO list yields to whatever has already been merged.

### Option B — Park it (scope-disciplined alternative)

Keep the tables, `bank.rs`, and the persistence layer (they are inert and
tested), but remove the UI surface — the `BankAccountManager` screen and its
navigation entry — until Gate 1 closes. Amend the NOT-DO entry to *"no bank feed
UI until Gate 1 closes"*.

**For.** Honours the plan's sequencing without destroying 1,500+ lines of
tested work; the data model is genuinely foundational and expensive to redo;
nothing is claimed to users that the gates have not earned.

**Against.** Keeps a maintained-but-unreachable layer, which is its own form of
drift; and "parked" features have a habit of silently rotting.

### Option C — Revert it

Remove the feature and the migrations entirely.

**For.** Restores the NOT-DO list as literally true and makes the strongest
possible statement about scope discipline.

**Against.** Destroys working, tested code that the persona will need; the
migrations may already have shipped to any device that ran a build; and the
deletion itself is a large, risky change made for symbolic reasons.

## Decision

**Not yet made.** This ADR is filed as `Proposed` so that the exception is on the
record and cannot be mistaken for an oversight. Until the board answers, the
status quo is: the feature exists and is reachable, and `SCOPE.md` §5 carries a
cross-reference to this document marking the item unratified.

The recommendation is **Option A with Option B's discipline**: ratify the
capability, but require that no further breadth be added to it until Gate 1
closes and a CPA has reviewed statements.

## Consequences

- **If A:** `SCOPE.md` §5 loses the bank-feed line; the operating plan's §9.3
  decision closes; bank feeds need an owner and a place in the Gate 1–3
  sequence; the drift tripwire (§7.3) records one retroactively-ratified
  exception, which should itself be reported at the next monthly gate review.
- **If B:** a small PR removes the navigation entry and screen; the data layer
  stays; the NOT-DO entry is reworded to name the UI specifically.
- **If C:** a larger revert PR, plus a check that no released build depends on
  the dropped migrations.
- **In every case:** the precedent matters more than the feature. If this is
  ratified without a stated cost, the next out-of-scope feature will also be
  merged first and justified afterwards.
