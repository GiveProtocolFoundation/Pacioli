# AGENTS.md — Working Agreement for Pacioli

This file is auto-loaded by AI agents at session start (DSH, Claude Code and other
`AGENTS.md`-compatible tools). It governs **how to work in this repository**.

`SCOPE.md` governs **what the product is and what may be built**. When this file and
`SCOPE.md` disagree, `SCOPE.md` wins: stop and surface the conflict rather than
improvising. Do not duplicate `SCOPE.md` content here; link to it.

---

## 1. Read before you act

| File | Why |
|---|---|
| `SCOPE.md` | The constitution. Authoritative current stage; read it first. |
| `docs/v1-readiness-plan.md` | The operating plan and priority order. |
| `docs/gate1-report.md` | Gate 1 measurement record. Long: grep it, do not read it whole. |
| `docs/stage1-progress.md` | Stage 1 progress log. Long: grep it. |
| `.claude/CLAUDE.md` | DeepSource code standards (RS-D1001, JS-0333, JS-E1004). |

`SCOPE.md` is authoritative on stage. Prose in `README.md` and older docs drifts; if a
doc disagrees with `SCOPE.md` about the current stage, trust `SCOPE.md`.

## 2. Project facts

- **What**: open-source (AGPL-3.0) local-first accounting platform for digital assets,
  fiat, and nonprofit fund accounting. Four layers: raw transactions to journal entries
  to general ledger to reports.
- **Stack**: React 19 + TypeScript + Vite frontend (`src/`); Rust + Tauri backend
  (`src-tauri/`); Vitest unit tests; Playwright E2E.
- **Non-negotiable**: no figure that appears on a financial statement is ever produced by
  a model. AI drafts; the deterministic Rust engine computes; a human approves.
- **Stage**: Stage 1. Gate 0 and Gate 1 are both open. Confirm in `SCOPE.md`.

## 3. Environment

- Node 22 and pnpm 10 (matches CI). Use `pnpm`, not `npm`/`yarn`.
- The session workspace root **is** the repository root. Bash calls accept a `workdir`;
  use it instead of prefixing every command with `cd /home/.../Pacioli &&`.
- `.scratch/` and `.worktrees/` are git-ignored. Put transcripts, captured HTML, and
  throwaway checkouts there, never in tracked paths.

## 4. Canonical commands

Frontend (from the repo root):

```bash
pnpm install --frozen-lockfile   # install
pnpm dev                         # Vite dev server
pnpm format:check                # prettier check
pnpm lint                        # eslint
pnpm type-check                  # tsc --noEmit
pnpm test --run                  # Vitest, single pass (no watch)
pnpm test:e2e                    # Playwright
pnpm build                       # production frontend build
```

Rust (from `src-tauri/`):

```bash
cargo test
cargo clippy -- -D warnings
cargo fmt
```

Avoid unless you specifically need a packaged app: `make check`, `make build`,
`pnpm tauri:build`. These run a full Tauri build (slow) and are not the fast feedback
loop.

## 5. Verification protocol

Before reporting work as done:

1. Run the four fast gates **once, after a batch of edits** — not after every edit:
   `pnpm format:check && pnpm lint && pnpm type-check && pnpm test --run`
2. Add `pnpm test:e2e` only when UI flows changed.
3. For Rust changes: `cd src-tauri && cargo test && cargo clippy -- -D warnings`.
4. Do not claim a fix works because a file looks right. Run the check.

CI (`.github/workflows/ci.yml`) mirrors this with jobs: Unit Tests (Vitest), Lint, Type
Check, Build Frontend, Build Rust Backend, E2E Tests (Playwright), Security Scan.
`main` is protected; changes land through a PR with these checks green.

## 6. Git and PR conventions

- **Start**: `git fetch --prune origin` before assuming branch state. Local refs go stale
  between sessions.
- Branch from current `origin/main`. Never commit directly to `main`.
- Conventional commits: `type(scope): description` with types `feat`, `fix`, `docs`,
  `style`, `refactor`, `test`, `chore`. No emojis, no decorative symbols.
- **No `Co-Authored-By` lines** unless explicitly requested.
- Before handing back, state the current branch, HEAD, and anything unpushed. Sessions
  have ended with the checkout parked on an already-merged topic branch; do not leave
  that ambiguous.
- Prefer `gh` over scraping: `gh pr view`, `gh pr checks`, `gh api`. GitHub HTML is not a
  data source.

## 7. Secrets and privacy — read this after the 2026-09-22 incident

A live Resend API key was committed in a tracked `.env` and reached `origin/main`.

Rules:

- `.env` is **untracked** and git-ignored. `.env.example` is the tracked template; it
  documents variable **names** only.
- **Never paste secret values into chat.** Session transcripts are persisted to
  `~/.dsh/sessions/` and contain whatever was typed. To give an agent a credential,
  name the environment variable and let it read the untracked `.env` locally.
- A pre-commit guard is installed via `git config core.hooksPath .githooks` (wired into
  `pnpm install` through the `prepare` script). It blocks staged `.env*` files and scans
  staged diffs for common key formats.
- CI's Gitleaks step has `continue-on-error: true`, so **CI does not block on secrets**.
  The local hook and your own review are the real guard.
- Known residual: six server-managed `refs/pull/*` refs still hold pre-rewrite commits
  containing redacted wallet addresses. GitHub Support can purge them; see section 9.

## 8. DeepSource workflow

**The core fact that wasted a full session**: a DeepSource run URL is pinned to one
commit and is **immutable**. A run that flagged an issue will keep showing that issue
forever, even after the fix is pushed; a new run is created for the new commit. Check
the commit SHA in the run header before treating a report as current.

- Run and issue pages are client-rendered (virtual scroller). **Do not scrape them.**
  Fetching the HTML gives partially-rendered cards and off-by-one issue counts.
- Preferred: use the DeepSource API with a token, or ask for the rule ID and file list.
  If you must read a page, save it once under `.scratch/` and parse it once — do not
  rebuild the same parser in a new directory each session (that happened three times:
  `.scratch/ds/`, `.scratch/ds2/`, `.ds_tmp/`).
- A fix is complete only when a **new** run on the pushed commit reports 0 issues and the
  PR checks are green.
- Recurring rules and their fixes:

| Rule | Meaning | Fix |
|---|---|---|
| JS-0116 | `async` function with no `await` | Drop `async`, or await the real work |
| JS-0333 | `void` used as a generic type argument | `await invoke(...)` instead of `invoke<void>(...)` |
| JS-W1042 | Redundant `undefined` argument | Remove the argument |
| JS-E1004 | Duplicate export name | Re-export with an alias (`export { X as Y }`) |
| JS-0045 | Function with inconsistent returns | Make all paths return |
| JS-R1005 | Function too complex | Split into single-purpose helpers |
| RS-D1001 | Missing Rust doc comments | `///` on public items, variants and fields |

## 9. Open items (update as they close)

- **Privacy purge**: six `refs/pull/*` refs (`302`, `304`, `305`, `306`, `307`, `308`)
  still expose pre-rewrite commits containing wallet addresses. Not removable via the
  API (HTTP 422). Pending a GitHub Support ticket. Re-verify with
  `git ls-remote origin 'refs/pull/*'`.
- **Secret rotation**: the committed Resend key must be rotated in the Resend dashboard;
  keys pasted into chat during the 2026-09-21 session should be rotated too.
- **`.env` removal**: the untracking commit still has to land on `main`.
- **`gate1-measurement-findings`**: diverged from `main` and holds a duplicate JS-0116
  fix. Decide to retire it or rebase it.
- **Branch clutter**: ~155 remote branches, ~48 `deepsource-autofix-*`. Prune periodically.

## 10. Session hygiene

- Use the bash `workdir` parameter instead of `cd` prefixes.
- Batch related edits, then verify once.
- Long sessions trigger context compaction. Keep durable state in files (docs, this file,
  the open-items list) rather than relying on conversation memory.
- Prefer subagents for broad read-only surveys (codebase inventories, readiness
  assessments). They keep the main context clean.
- When you resolve an item in section 9, update it in the same change.
