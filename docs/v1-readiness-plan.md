# Pacioli v1 Readiness Assessment & Operating Plan

**Prepared:** for the board / product owner.
**Repository state assessed:** `main` @ `db5db44` (last commit 2026-08-20; remote pushed 2026-09-10), version `0.1.0-alpha.1`.
**Evidence basis:** repository code and docs (`SCOPE.md`, `docs/stage1-progress.md`, `docs/gate1-report.md`, `docs/accounting-model.md`, migrations, Rust/TS source), plus external checks of `pacioli.io`, `docs.pacioli.io`, `community.pacioli.io`, and the GitHub API.
**Honesty note:** a fresh green build was **not** re-run during this assessment — the assessment environment has no Rust toolchain, and `pnpm install` under pnpm 11 rejects the lockfile because `pnpm.overrides` moved out of `package.json` (CI pins pnpm 10, where the lockfile is valid). Test counts below come from code inspection and the project's own trackers, not from a build I executed. Confirming a green build is Step 0 of the plan.

---

## 1. What was planned

Three documents define the intent:

1. **`SCOPE.md`** — the standing constitution. Four-layer model (**raw transactions → journal entries → general ledger → reports**), the thesis _"AI proposes; the ledger disposes,"_ the beachhead persona (small nonprofits receiving digital-asset gifts and their accountants), and the pre-launch NOT-DO list (no new chains, no DeFi depth, no IFRS, **no bank feeds**, no cloud, no multi-entity, no proprietary models, no autonomous posting). It names the MVP spine: _wallet connection → imported raw transactions → drafted journal entries with cited evidence → approval queue → general ledger → auditable financial statements → export._

2. **The Strategic Operating Plan** — five sequential stages, each ending in a go/no-go gate:
   - **Stage 0 / Gate 0:** a stranger can download an installer from GitHub Releases and join a waitlist at pacioli.io.
   - **Stage 1 / Gate 1:** the accounting spine — double-entry engine end to end, correctness first; CPA finds no structural fault.
   - **Stage 2 / Gate 2:** the intelligence layer — AI-drafted entries with cited evidence and confidence, rules engine, ≥70% draft acceptance, a month closable in under an hour.
   - **Stage 3 / Gate 3:** nonprofit depth (fund accounting, noncash gifts, NFP statement set, functional expenses, tax exports) and private beta with ≥3 organizations closing a real month.
   - **Stage 4 / Gate 4:** hardening, documentation, signing, onboarding polish, security pass, and **public v1.0**.

3. **The Stage 1 campaign prompt** — Phases 0–10, seven non-negotiable invariants (structural balance, no floats, append-only ledger, reports-as-views, immutable raw evidence, read-only wallets, provenance on every entry). **Stage 1's gate is the CPA's verdict, not ours.**

**"Launched as v1" therefore means Gate 4:** signed Windows/macOS/Linux installers on GitHub Releases, a truthful pacioli.io with the five-minute spine demo, a published launch essay, at least one named beta organization, and a distribution week. Everything below is measured against that definition.

---

## 2. What has actually been built

### 2.1 Stage 0 — Gate 0: **NOT MET** (infrastructure ~80%, artifact never published)

| Item                                | State                           | Evidence                                                                                                                |
| ----------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tauri release workflow, 3-OS matrix | **DONE**                        | `.github/workflows/release.yml` — macOS universal, Ubuntu 22.04, Windows NSIS; uploads to a **draft** release           |
| Code signing                        | **ABSENT (deferred)**           | All signing env vars commented out; `docs/release-signing-checklist.md` procurement boxes all unchecked                 |
| Version consistency                 | **DONE**                        | `0.1.0-alpha.1` in `package.json`, `Cargo.toml`, `tauri.conf.json`, matching tag `v0.1.0-alpha.1`                       |
| Published installer                 | **ABSENT**                      | GitHub API `/releases` returns `[]`; a draft may exist from the tag but was never published                             |
| pacioli.io + waitlist               | **LIVE, but outside this repo** | Site returns HTTP 200 with a "Notify me" form; no marketing source, no Cloudflare/wrangler config in-repo               |
| docs.pacioli.io                     | **ABSENT**                      | DNS does not resolve                                                                                                    |
| community.pacioli.io                | **ABSENT**                      | DNS does not resolve                                                                                                    |
| CI quality gates                    | **PARTIAL**                     | `ci.yml` runs unit/lint/type/frontend/rust/e2e/security; gitleaks and `npm audit`/`cargo audit` are `continue-on-error` |
| Governance files                    | **DONE**                        | AGPL-3.0, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`                                                        |
| Distribution traction               | **ZERO**                        | GitHub: 0 stars, 0 forks, 0 watchers, no Discussions; 1 open issue                                                      |

**Gate 0 literal test — "can a stranger download an installer and join a waitlist?" — the waitlist half is true; the download half is false.**

### 2.2 Stage 1 — the accounting engine: **SUBSTANTIVELY COMPLETE, gate pending**

This is the strongest part of the project and it is real, not slideware.

- **Balance enforcement, posting/GL, approval lifecycle, periods/close, statements, FIFO cost basis, fair-value (ASU 2023-08), import resilience, and the proptest invariant suite are all implemented and registered** — 221 Tauri commands, ~253 Rust test attributes (project tracker claims 336 for the lib; 24 Vitest files), no `todo!`/`unimplemented!`/`FIXME` anywhere in `src-tauri/src`.
- Money is exact: `i64` minor units + `rust_decimal` decimal strings; `f64` survives only in legacy display-mirror columns.
- Tests are genuine: they open an in-memory SQLite database with all migrations and call production paths; the proptest suite pins all seven invariants.
- **Phase 10 (Gate 1 rehearsal) is the only open item.** It is blocked on a free Etherscan V2 API key and then the product owner's real-data run plus a CPA's review. Findings #1–#3 (all Moonbeam/Moonscan provider drift) were fixed; the gate verdict belongs to the CPA.

**Known engine debts carried forward:** Substrate adapter is a **placeholder returning empty history** (a silent-incomplete-data risk if ever claimed as supported); `bank.rs` and `entities.rs` have **zero tests**; tax export and backup/restore endpoints are **stubs**; the fair-value and cost-basis **UI does not exist** (commands only; cost-basis page is the legacy frontend calculator); journal entry numbers derive from `COUNT(*)+1` (collision-prone); `created_by` is hard-coded `'system'` on create.

### 2.3 Undocumented drift after Stage 1 (the tracker stops at 2026-07-24)

Eleven weeks of merged work are **not reflected in any stage tracker**, and some of it is outside the current gate:

- **Bank/card transaction capture** — schema, CSV/OFX/QFX/QBO parsers, account manager UI, bank classification queue, payee→GL rules (`GIV-825…829`, board PRD `GIV-821`, 2026-08-04). This is on the SCOPE NOT-DO list ("no bank feeds"); it was board-approved, but the guardrail was never amended.
- **Chart-of-accounts template importer, entity types, functional classification, Statement of Activities** (`GIV-757/758/759`) — a genuine nonprofit slice landed while `docs/gate1-report.md:96` still says "no nonprofit fund accounting — Stage 3."
- **New EVM networks: Ethereum and L2s** (Arbitrum, Optimism, Base) added; **Moonbeam/Moonriver removed as "sunset"** (`GIV-888`). The Gate 1 rehearsal checklist and findings are Moonbeam-centric and now describe paths that were retired.
- **Auth tables, wallet auth, entities, offline storage, country-first onboarding** (`GIV-862`).
- Security dependency remediation (`alloy`/`substrate`/ethers replacement).

**`SCOPE.md` still says "Current stage: Stage 0." The progress tracker still says the nonprofit layer is Stage 3 and that only manual classification exists. The gate report still lists limitations that are now false (Statement of Activities shipped). The documentation no longer describes the software.**

### 2.4 Stage 2 — intelligence layer: **NOT STARTED**

- The model-provider abstraction is a **compile-checked skeleton**: a `ChatCompletionProvider` trait, a `ProviderKind` enum, and a stub returning `"stub-response"`. `select_provider` returns `NotImplemented` for Anthropic/OpenAI/local. The module is not registered and nothing calls it.
- **No AI call exists anywhere in the repo.** No confidence scoring, no evidence/citation fields, no acceptance-rate instrumentation.
- What _does_ exist is a real **deterministic rules engine** (CRUD, starter packs, payee→GL maps, priority ordering) driving heuristic auto-classification — all written with `origin='rule'`. The `origin='model'` enum value is reserved and never produced.
- `README.md` advertises "AI-assisted categorization"; it does not exist.

### 2.5 Stage 3 — nonprofit depth: **PARTIAL, one slice landed**

| Feature                                                                                    | State                                                                                                 |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Statement of Activities (with/without donor restrictions grouping)                         | **DONE** (engine + UI + CSV)                                                                          |
| Functional classification (program/mgmt/fundraising tagging)                               | **PARTIAL** — column + picker + SoA sections; no allocation engine                                    |
| NFP chart-of-accounts templates                                                            | **DONE**                                                                                              |
| Fund/restriction as a **ledger dimension**                                                 | **ABSENT** — restrictions are CoA tags, not a fund dimension; release-from-restriction is manual only |
| Statement of Functional Expenses (separate)                                                | **ABSENT**                                                                                            |
| Statement of Cash Flows                                                                    | **PLANNED-ONLY** (dead card, no route, no backend)                                                    |
| Noncash digital-asset gift workflow, gift-date valuation, donor substantiation (8283/8282) | **ABSENT / PARTIAL** — only generic crypto-donation categories and `price_at_acquisition_usd`         |
| Form 8949 / Schedule D / 990 support                                                       | **ABSENT** — tax export returns empty JSON                                                            |
| CSV export / JSON round-trip                                                               | CSV **DONE**; JSON and user-facing round-trip **ABSENT**                                              |
| Web (indexedDB) ledger path                                                                | **ABSENT by decision** — GL/JE/statements are desktop-only; web shows a "desktop required" banner     |

### 2.6 Stage 4 — hardening and launch: **NOT STARTED**

Signing/notarization not procured; no auto-updater; `docs.pacioli.io` not deployed; onboarding exists but its time-to-first-entry is unmeasured; no threat model; no CHANGELOG/release notes; many user-facing surfaces are stubs (Reconciliation, Docs, Support, Settings integrations/notifications/audit logs, report-catalog export/schedule buttons).

### 2.7 Claim-vs-reality audit

| Claim                                     | Where                  | Reality                                                                                                                      |
| ----------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "AI-assisted categorization"              | `README.md`            | No AI code exists                                                                                                            |
| XRP, Stellar, Cosmos support              | pacioli.io             | No implementation; only 4 families (EVM incl. new L2s, Substrate, Bitcoin, Solana), and Substrate's adapter is a placeholder |
| "Restricted-fund tracking for nonprofits" | pacioli.io             | No fund dimension; only CoA tags + SoA grouping                                                                              |
| "Structured around US GAAP and IFRS"      | pacioli.io             | IFRS is explicitly out of scope pre-launch (SCOPE NOT-DO list)                                                               |
| "Download Pacioli"                        | pacioli.io             | Site itself admits installers aren't out; GitHub Releases is empty                                                           |
| 5 Stage-1 limitations                     | `docs/gate1-report.md` | Several are stale (SoA shipped; Moonbeam retired; bank feeds added)                                                          |

These are not fatal, but they are the same failure mode as the product risk: **the story has run ahead of the artifact.** For a product whose brand is trust and auditability, that is the most dangerous drift of all.

---

## 3. The gap register — what must be true before v1

Grouped by the gate that requires it. **Must** = blocks launch; **Should** = blocks a credible beta; **Later** = explicitly deferred.

### 3.1 Blocks Gate 1 (close immediately)

| #   | Gap                                        | Notes                                                                      |
| --- | ------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | Gate 1 rehearsal not run end-to-end        | One Etherscan V2 key + the product owner's real wallets                    |
| 2   | No CPA has reviewed the statements         | The gate's verdict is external                                             |
| 3   | Rehearsal checklist still assumes Moonbeam | Update for the current network set, or the rehearsal re-hits retired paths |
| 4   | Tracker/doc drift (§2.3)                   | Must be reconciled before anyone can trust the record                      |

### 3.2 Blocks Gate 0 (small, high-leverage)

| #   | Gap                                                                  | Notes                                                            |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 5   | Publish the draft `v0.1.0-alpha.1` release                           | Unsigned is acceptable for alpha; the pipeline must be exercised |
| 6   | Verify 3-OS download + install                                       | Windows NSIS, macOS universal, Linux AppImage/deb                |
| 7   | Bring pacioli.io/waitlist source into a repo, or document its deploy | Currently unverifiable from the repo                             |
| 8   | Stand up a minimal `docs.pacioli.io`                                 | DNS dead today                                                   |
| 9   | Correct README/website overclaims                                    | Trust is the product                                             |

### 3.3 Blocks Gate 2 (Stage 2, the intelligence layer)

| #   | Gap                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| 10  | Wire the provider abstraction to at least two real providers (BYO key), verify provider-swap is configuration only |
| 11  | AI-drafted entries into the existing approval queue, with **cited evidence** and a **confidence signal**           |
| 12  | Draft acceptance-rate instrumentation (the headline metric from day one)                                           |
| 13  | Rules precedence: user corrections → local rules override model drafts; rules inspectable/exportable               |
| 14  | On-chain semantics coverage in priority order (transfers → fees → staking rewards → XCM/bridge → swaps)            |
| 15  | Batch review UX for high-confidence recurring patterns; nothing auto-posts                                         |

### 3.4 Blocks Gate 3 (nonprofit depth + private beta)

| #   | Gap                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 16  | **Fund/restriction as a first-class ledger dimension** + release-from-restriction workflow (the beachhead's defining feature) |
| 17  | Noncash digital-asset gift workflow: gift-date fair value, donor substantiation records (8283/8282)                           |
| 18  | Statement of Functional Expenses (separate) and Statement of Cash Flows                                                       |
| 19  | Functional expense allocation (even assisted/manual)                                                                          |
| 20  | CSV/JSON round-trip export hardened (the sovereignty escape hatch)                                                            |
| 21  | Form 8949 / Schedule D for the business persona (or explicitly deferred)                                                      |
| 22  | 5–10 beta organizations recruited (≥3 real nonprofits, ≥1 multi-client accountant)                                            |
| 23  | Weekly release cadence + beta channel + office hour                                                                           |
| 24  | ≥3 organizations close a real month and show statements to their accountant/board                                             |

### 3.5 Blocks Gate 4 (public launch)

| #   | Gap                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------- |
| 25  | macOS notarization + Windows Authenticode procured and enabled; signed installers                               |
| 26  | Auto-updater (or an explicit post-launch decision)                                                              |
| 27  | Documentation site for the four audiences                                                                       |
| 28  | Onboarding: empty state → first approved entry in <15 minutes, measured                                         |
| 29  | Security pass: dependency audit, encryption-at-rest verification, written threat model, SECURITY.md commitments |
| 30  | Launch assets: 5-minute spine demo video, launch essay, real screenshots                                        |
| 31  | Distribution week: Polkadot/Kusama, crypto-philanthropy, Show HN, r/nonprofit, waitlist                         |
| 32  | Give Protocol launch alignment                                                                                  |
| 33  | Truthful, reconciled website + README                                                                           |

### 3.6 Engine hygiene (should, mostly before beta)

Substrate adapter: either implement or **remove the support claim** (empty history is worse than absence). Tests for `bank.rs`/`entities.rs`. Real tax/backup endpoints or their removal from the UI. Fair-value and cost-basis **UI** (commands exist but are unreachable). Entry-number sequence table. `created_by`/approver identity consistency. Fair-value disposal: relieve remeasured carrying value, not just cost.

---

## 4. Assessment — where this project actually stands

**The good.** The hardest and least glamorous thing is done: a correct, exact-arithmetic, append-only double-entry engine with period locks, tie-verified statements, FIFO lots, ASU 2023-08 remeasurement through an approval queue, and a property-based invariant suite. That is the moat the operating plan describes, and it is real. The development discipline visible in the tracker — race-safe conditional writes, DB-backed tests, adversarial review hardening, invariants pinned in proptest — is far above typical solo/AI-assisted work. The nonprofit slice (Statement of Activities, functional classification) already reaches toward the beachhead.

**The risk is not technical. It is sequencing, and it is happening right now.** The operating plan names this exact failure mode first: _"continuing to widen infrastructure (more chains, more services) instead of closing the loop from raw transaction to financial statement for one real user."_ Since the tracker's last entry, the project added bank feeds (a NOT-DO item), removed and added chains, and built entities/auth/onboarding — while **Gate 0 is unmet and Gate 1 has never been run end-to-end.** The engine may be CPA-ready; no CPA has looked at it. The product has "unusually deep plumbing and no faucet."

**Second risk: the record no longer matches the software.** `SCOPE.md` says Stage 0. The tracker says Stage 1 with a nonprofit layer that is Stage 3 — while a nonprofit slice shipped. The gate report's limitations are stale. A foundation whose credibility rests on auditability must not have a stale ledger of its own work.

**Third risk: distribution is at zero.** No published release, zero stars, an unreachable docs site, no beta users, no waitlist number we can see. Stage 0 and Stage 3's distribution work are the cheapest items on this list and the most neglected.

**The strategic reading:** stop opening fronts. Close Gate 0 (a week of work), close Gate 1 (blocked on a free API key and a CPA), reconcile the record, and then make one deliberate choice about what "v1" is for.

---

## 5. Recommended operating plan

Six steps, in order. Each ends with an observable acceptance test. Steps 0–2 are near-term and largely unblocked; Steps 3–4 contain the one real strategic fork.

### Step 0 — Freeze, truth, green (this week)

- **Freeze** merges that are not on the Gate 1 path. Bank/entity/auth work already merged stays; no new fronts open.
- **Run the full build on `main` and record the result**: `cargo test`, `cargo clippy`, `cargo fmt --check`; `pnpm install --frozen-lockfile` (pnpm 10), `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm test:e2e`. If anything is red, that is now the only priority.
- **Reconcile the record**: update `SCOPE.md`'s current-stage line and NOT-DO list; bring `docs/stage1-progress.md` current through today; correct `docs/gate1-report.md`'s stale limitations; fix README/website claims.
- **Record an ADR** for the bank-feed exception (board-approved PRD) so the guardrail and the code agree.
- **Deliverable:** a green build, a truthful tracker, an explicit scope ledger.

### Step 1 — Close Gate 1 (1–2 weeks)

- Obtain the free Etherscan V2 key; update the rehearsal checklist for the current network set (remove retired Moonbeam assumptions; use the wallets that actually carry history).
- Run the 12-step rehearsal against real data; capture findings; fix blockers only.
- Package the three statements + `docs/accounting-model.md` + the report and deliver to a recruited friendly CPA.
- **Acceptance:** the CPA's verdict, written into `docs/gate1-report.md`. Nothing else counts.

### Step 2 — Close Gate 0 and ship the first public artifact (1 week)

- Publish the draft `v0.1.0-alpha.1` release; verify download and launch on Windows, macOS, and Linux. Unsigned is fine here; the pipeline must be exercised weekly from now on.
- Bring the pacioli.io landing page + waitlist into version control (or document its hosting precisely), and stand up a minimal docs site.
- **Acceptance:** a stranger can download an installer from GitHub Releases and join a waitlist; the source for both is in the repos.

### Step 3 — The nonprofit core (Stage 3 pulled forward) — _decision required_

- **Fund/restriction as a ledger dimension** (design decision: fund tag on journal lines vs. fund-scoped chart vs. separate dimension — present options, pick one, document in `accounting-model.md`).
- Release-from-restriction workflow; noncash digital-asset gift workflow with gift-date fair value and donor substantiation (8283/8282) records; Statement of Functional Expenses; Statement of Cash Flows; hardened CSV/JSON round-trip.
- **Acceptance:** a nonprofit can book a restricted crypto gift, release the restriction, and produce a full NFP statement set that ties.

### Step 4 — Intelligence layer v1 (Stage 2) — _decision required on order_

- Wire two real providers behind the existing trait; BYO key; provider swap is configuration.
- Model drafts entries into the existing queue with cited evidence + confidence; rules override model; acceptance-rate instrumentation; batch review; nothing auto-posts.
- **Acceptance:** on real multi-chain history, ≥70% of drafts approved without edit and a month classified/closable in under an hour (Gate 2's own bar).

### Step 5 — Beta and hardening (Stage 3 beta + Stage 4)

- Signing/notarization + updater; security pass + threat model; docs site; measured <15-minute onboarding; the engine-hygiene list (§3.6).
- Recruit 5–10 organizations; weekly releases; weekly public build notes; monthly gate review.
- **Acceptance:** ≥3 organizations close a real month and show statements to their accountant or board (Gate 3).

### Step 6 — Launch (Gate 4)

- Signed installers, truthful site with the 5-minute demo, launch essay, named beta testimony, distribution week, Give Protocol alignment.

---

## 6. The one real strategic fork

The operating plan orders the work **Stage 2 (AI) → Stage 3 (nonprofit)**. The current state argues for the reverse. This is a board decision, not a coding one.

**Option A — plan-faithful: AI first.**

- _For:_ makes the product legible as "of the current AI-native generation"; the headline metric (acceptance rate) starts earlier; the Stage 0 provider abstraction was designed for this; the operating plan already committed to it.
- _Against:_ the persona is nonprofits, and a nonprofit cannot adopt a product that lacks fund accounting; AI classification on top of a ledger nobody has validated externally is premature; AI is also the _least_ defensible differentiator — every competitor has it, and the plan itself says the moat is local-first, open, model-agnostic correctness.

**Option B — recommended: nonprofit core first, then AI.**

- _For:_ the beachhead's blocking feature (restricted funds, in-kind gifts, NFP statements) is ledger work the team is demonstrably excellent at; it converts the finished engine into a product a nonprofit can actually use; Gate 1's CPA review plus real fund accounting is a far stronger grant exhibit than an AI demo; the AI layer is additive and sits on the queue that already exists.
- _Against:_ delays the "AI-native" story and the Gate 2 metric; requires the board to consciously reorder its own plan.

**Recommendation: Option B**, with one carve-out — wire the provider abstraction to two real providers early (small, unblocks grant/demo narratives and de-risks the abstraction) while the nonprofit core is built. Sequence: **Gate 1 → Step 2 → nonprofit core → AI depth → beta → launch.**

If the board prefers Option A, the plan still works; it simply means the first external users wait longer for a product that fits them.

---

## 7. Governance changes to prevent recurrence

1. **Update `SCOPE.md`'s "Current stage"** and add the current gate's definition of done.
2. **Tracker rule:** a PR that changes shipped capability updates the stage tracker in the same PR. The 2026-07-24 → 2026-08-20 gap must never recur.
3. **Drift tripwire (from the operating plan, operationalized):** any merged change not on the current gate's list gets an ADR that the next monthly review must re-authorize or kill.
4. **Claim-truth rule:** README, website, and release notes may only describe features with a passing test or a shipped UI path.
5. **Monthly gate review** with exactly three answers: on track, cut scope, or slip.

## 8. Metrics

Keep the existing five (draft acceptance rate, time to close a month, beta orgs with a closed month, waitlist size, weekly release streak) and add two that this assessment shows are the real leading indicators:

6. **Published artifact freshness** — days since the last downloadable build (currently: never).
7. **Open-gate work-in-progress** — count of merged capabilities that belong to a future gate (currently ≥4: bank feeds, new chains, entities/auth, functional classification).

## 9. Open decisions for the board

1. **Order:** Option A (AI before nonprofit) or **Option B (nonprofit core before AI, recommended)**?
2. **v1 definition:** full Gate 4 public launch, or a narrower "trustworthy nonprofit manual-accounting v1" (Gates 0–1 + nonprofit core) as the near-term milestone with AI as the fast-follow?
3. **Bank feeds:** ratify the exception with an ADR, or park the feature until after launch? (It is on the NOT-DO list and partly merged.)
4. **Chains:** ratify Ethereum/L2 addition and Moonbeam/Moonriver removal; decide Substrate — implement or retract the support claim.
5. **Signing budget:** approve Apple Developer Program + Windows signing now (a real, modest line item, needed by Gate 4).
6. **Gate 1 CPA:** who is the reviewing accountant, and by when?
7. **Tracker ownership:** who owns keeping `docs/stage1-progress.md` current from now on?

---

_This plan is subordinate to `SCOPE.md` and to the gates. When it and reality conflict, reality wins — and this document is revised at the next monthly review, in writing, in the repository._
