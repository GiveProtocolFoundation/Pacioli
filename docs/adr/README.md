# Architecture Decision Records

ADRs record decisions that must outlive the session that made them — especially
decisions that **depart from `SCOPE.md`**. `SCOPE.md` §4 requires that work
beyond the current gate carry an explicit justification tied to a gate, and
`SCOPE.md` §5 forbids certain work outright until Gate 4. An ADR is where that
justification lives, so that the constitution and the codebase can be compared
without guesswork.

## Convention

- One file per decision: `NNNN-short-slug.md`, numbered sequentially.
- **Status** is one of `Proposed`, `Accepted`, `Rejected`, `Superseded by NNNN`.
  A `Proposed` ADR is *not* a decision — it is a recorded open question.
- Never edit an accepted ADR's decision. Supersede it with a new one.
- If an ADR changes what `SCOPE.md` permits, `SCOPE.md` must be amended in the
  same PR. A codebase that contradicts the constitution, or a constitution that
  contradicts the codebase, is the failure this directory exists to prevent.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-bank-feed-exception.md) | Bank feeds ahead of Gate 4 (exception to the NOT-DO list) | **Accepted** (Option A, 2026-09-14) |
