# Gate 1 — Reviewer Brief and Review Programme

**To:** the reviewing accountant
**From:** Give Protocol Foundation (Pacioli)
**Status:** draft. The statements referenced in §3 are attached only after the
Gate 1 rehearsal has been run against real data. The rehearsal itself is
prepared but not yet executed; nothing in this brief is a claim that it has
been.

Companion documents: `docs/gate1-report.md` (what the system does, its rehearsal
record, and where the verdict is recorded) and `docs/accounting-model.md` (the
accounting conventions in force).

---

## 1. What we are asking for

**The ask.** Roughly 30–45 minutes of your time, and a short written response
structured by §6.

**Why.** Pacioli is a pre-alpha double-entry accounting system for digital
assets. Its gate for proceeding is not a demo, a benchmark, or a funding
milestone — it is a working accountant's judgement on whether the statements it
produces are what they claim to be. That judgement is the gate, and it is not
ours to make. We would rather hear the structural objection now, privately, than
after launch.

**What we are *not* asking.** You are not being asked to opine on compliance
with any standard, to accept engagement responsibility, to assess security, or
to endorse the product. Negative findings are as useful to us as positive ones.
§5 lists the limitations we already know about, so that your time goes on the
things we have *not* noticed.

**One honest caveat about the word "reviewed".** This is informal practitioner
feedback on a pre-release system, not an engagement under any professional
standard, and we will not describe it as more than that. If the board later
wants to claim publicly that its statements are "CPA-reviewed", that claim would
need a real engagement, and we will not make it on the strength of this
conversation. We are saying this up front because a claim that outruns its
evidence is the specific failure this project is built to avoid.

---

## 2. The system in one page

Pacioli is a local-first, open-source (AGPL-3.0) accounting application. It uses
a four-layer model:

```
raw transactions  →  journal entries  →  general ledger  →  reports
   (evidence)         (interpretation)     (consequence)     (consequence)
```

- **Raw transactions are immutable evidence.** They are imported read-only from
  public chains. Classification never modifies them; journal entries point back
  at them through an explicit linkage table.
- **Journal entries are interpretation.** Each records its origin — `manual` or
  `rule` — together with who approved it and when. There is no automated or
  model-generated posting path in this release. Every entry passes a human
  approval gate, including the system's own period-end remeasurement entries.
- **The ledger and reports are deterministic consequences.** No figure on a
  statement is stored; every statement is computed at query time from posted
  entries, in exact integer minor units for the functional currency (USD cents)
  with no floating-point arithmetic. A `verify_ties` assertion runs before any
  statement is returned: the balance sheet must balance, trial-balance debits
  must equal credits, and net income must cross-check the trial balance. A
  statement that does not tie raises a hard error rather than rendering.
- **Posted entries are never edited or deleted.** Corrections are reversing
  entries; a voided entry and its reversal both remain, net zero, cross-linked.

The rehearsal produces the ledger we are asking you to look at. It is a real
month of real wallet activity, classified by hand through the approval queue —
not a synthetic dataset.

---

## 3. What is in the bundle

| # | Item | Format | Notes |
| - | ---- | ------ | ----- |
| 1 | Trial balance | CSV | For the rehearsal period |
| 2 | Balance sheet | CSV | For the rehearsal period |
| 3 | Income statement | CSV | With comparative prior period where data allows |
| 4 | `docs/accounting-model.md` | Markdown / PDF | The conventions in force: entry lifecycle, balance invariant, provenance, periods and close, cost basis, fair-value measurement |
| 5 | `docs/gate1-report.md` | Markdown / PDF | System description, full limitation list, rehearsal log, findings and their dispositions |
| 6 | This brief | Markdown / PDF | The ask and the programme |
| 7 | Audit walkthrough (optional, on request) | Screen share | Statement figure → account → posted entries → approval trail → source transaction |

Exports are provided as CSV deliberately: they open in Excel, Sheets, or your
firm's software without trusting our renderer.

---

## 4. The review programme

We are not asking you to re-perform the bookkeeping. These are the specific
things we would like tested, with the evidence path for each. Work in whatever
order you like, and stop wherever your doubts are.

**A. Do the statements agree with each other and with the ledger?**

1. **Trial balance ties.** Total debits equal total credits.
2. **Balance sheet balances.** Assets equal liabilities plus equity for the
   period.
3. **The statements cross-check.** Pick one figure — net income or closing cash,
   whichever you prefer — and confirm it agrees between the trial balance, the
   balance sheet, and the income statement.
4. **Arithmetic.** Recompute a sample of subtotals yourself.

**B. Can a figure be traced back to evidence?**

5. **Audit walk.** Choose a figure from the income statement *at random* — not
   one we suggest — and trace it backwards: statement → account → posted
   journal entries → approval record → the raw on-chain transaction(s) that
   justified the entry. Tell us whether that trail was complete and checkable,
   or whether it relied on our word at any step.
6. **Opening balances.** Confirm the period's opening position is explained
   rather than assumed.

**C. Is the accounting treatment defensible?**

7. **Cross-asset events.** For a swap or an in-kind receipt, the entry balances
   in the functional currency through an explicit measurement line rather than
   by forcing a plug. Check that the gain or loss implied is the one you would
   have recorded.
8. **Cost basis.** For a disposal, the lot consumed and the realized gain/loss
   are computed FIFO. Verify one against your own hand computation. (FIFO only
   in this release — see §5.)
9. **Own-wallet transfers.** A transfer between the same holder's wallets must
   *not* be treated as a taxable disposal; lots should move without
   realization, preserving cost and acquisition date.
10. **Period-end fair value.** In-scope digital assets are remeasured to fair
    value at period end, with the unrealized movement through net income. Check
    that the remeasured carrying value moves to fair value, and — for a
    *disposal of previously remeasured assets* — that the relieved amount is the
    remeasured carrying value rather than original cost. This last point is one
    we are specifically unsure about; see §5.

**D. Are the controls real?**

11. **Approval gate.** Nothing reaches the ledger without human approval. Look
    for a path that bypasses it.
12. **Immutability.** A posted entry cannot be edited or deleted. Ask us to try.
13. **Period lock.** Once a period is closed, nothing posts into it by any
    route. Ask us to try.
14. **Reversibility.** Voiding produces a correcting entry rather than a
    deletion, and both remain visible.

---

## 5. Limitations we are stating up front

We would rather you hear these from us. The full list is in
`docs/gate1-report.md` §2; the ones most likely to matter to your judgement:

- **FIFO only.** LIFO, HIFO and specific identification are not implemented.
- **Single entity, US GAAP, functional currency USD.** No consolidation, no
  IFRS, no parallel books.
- **Nonprofit fund accounting is not implemented.** There is no restricted /
  unrestricted fund dimension. A Statement of Activities with functional
  classification exists, and there is no Statement of Functional Expenses or
  Statement of Cash Flows in this release. This is the next build stage, and we
  know it is the thing a nonprofit accountant will look for first.
- **Fair-value disposal relief is unverified.** The engine remeasures to fair
  value, but we are not confident that a subsequent disposal relieves the
  *remeasured carrying value* rather than original cost. This is flagged in
  `docs/gate1-report.md` and we would value your read on it.
- **Classification is deterministic.** A rules engine and heuristics exist; no
  AI or model provider is wired, and no entry can carry `model` provenance.
- **Manual period-end sequencing.** Remeasure → approve → post → close is driven
  by the user step by step; there is no orchestrated close workflow.
- **Desktop is the system of record.** The journal engine and statements exist
  on the desktop build only.
- **The statements are unaudited and this is pre-alpha software.** Test coverage
  at the time of writing: 482 TypeScript tests and 394 Rust tests, including a
  property-based suite pinning the balance and tie-out invariants.

---

## 6. Your written response

Anything in your own words and at whatever length you choose. If a structure
helps:

1. **Would you put these statements in front of a small nonprofit's board?**
   Why, or why not?
2. **What did you verify, and what did you have to take on trust?**
3. **The single most important thing that is wrong or missing.**
4. **What would you need to see before you would rely on this for real filing?**
5. **Any specific entry or figure you disagree with**, and what you would have
   recorded instead.

A short answer is a complete answer. "Not yet, and here is why" is a useful
result for us — the gate is designed to be able to fail.

The response is recorded verbatim in `docs/gate1-report.md` §6, attributed as you
wish, or unattributed if you prefer.
