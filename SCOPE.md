# SCOPE.md — The Constitution for Pacioli Development Sessions

This document governs every future development session on this repository, whether
led by a human or an AI. Read it before writing any code. When this document and a
session's instructions conflict, stop and surface the conflict rather than
improvising.

## 1. Product Thesis

**AI proposes; the ledger disposes.** Pacioli is an open-source (AGPL-3.0),
local-first accounting platform for digital assets, fiat, and nonprofit fund
accounting. Its four-layer model — **raw transactions → journal entries → general
ledger → reports** — separates evidence from interpretation: raw transactions are
immutable evidence; journal entries are interpretation; the ledger and reports are
deterministic consequences. AI may draft journal entries with cited evidence, but a
human approves every entry, and the deterministic Rust engine computes all figures
of record. No number that appears on a financial statement is ever produced by a
model.

## 2. Beachhead Persona

Small nonprofits receiving digital-asset gifts, and the accountants who serve them.
Every prioritization question resolves against this persona first. If a feature
does not help a small nonprofit (or its accountant) account for digital-asset
gifts correctly and auditably, it waits.

## 3. The MVP Spine (standing definition of done)

The MVP is done when a user can complete this entire path, end to end, with real
data:

wallet connection → imported raw transactions → drafted journal entries with cited
evidence → approval queue → general ledger → auditable financial statements →
export.

Any session's work should be locatable on this spine. Work that is not on the
spine needs an explicit justification tied to a stage gate.

## 4. Stage Sequence and Gates

**Current stage: Stage 0.**

- **Gate 0** — a stranger can download an installer from GitHub Releases and join
  a waitlist at pacioli.io. (Downloadable installer + live waitlist.)
- **Gate 1** — CPA-reviewed financial statements produced from real imported
  transactions, manually classified through the approval queue.
- **Gate 2** — ≥70% AI-draft acceptance rate; one month closable in under an hour.
- **Gate 3** — ≥3 beta organizations with a real closed month.
- **Gate 4** — public v1.0 launch.

Stages are sequential. Do not build for a later gate while the current gate is
open unless the work is an explicitly approved foundation-only skeleton (compile-
checked, unwired, no behavior change).

## 5. Pre-Launch NOT-DO List

Until Gate 4, the following are out of scope. Do not build them, scaffold them, or
"prepare" for them beyond what is written elsewhere in this document:

- no new chain integrations beyond the four existing families
- no DeFi position depth
- no IFRS/parallel-book delivery
- no bank feeds
- no Pacioli Cloud development
- no multi-entity consolidation
- no proprietary model training or Pacioli-operated inference
- no autonomous posting mode ever, even as an experiment
- no feature work motivated by competitor announcements

## 6. Standing Instruction to AI Coding Sessions

- Work in surgical, sequential phases. Complete and verify each phase before
  starting the next.
- Before changing anything, state what will NOT change — and honor it.
- Never weaken the balance-enforcement invariant (journal entries must balance;
  the ledger rejects what does not) or the read-only-wallet invariant (Pacioli
  observes wallets; it never holds keys, signs, or moves funds).
- The AI-assistance layer may never post to the ledger directly, and no user
  financial data is ever sent anywhere except to the user's own configured
  model provider.
- When scope conflicts arise, cut scope and say so. Correctness before breadth;
  scope cuts over schedule slips; nothing merged that risks existing working
  functionality.
- All changes land via feature branch and pull request — never direct pushes to
  `main`.
