# Dependency automation

Status: Renovate config added. Dependabot is still the active bot until the
cutover checklist below is done.

## Why Dependabot is being replaced

Dependabot regenerates `pnpm-lock.yaml` without the `overrides:` block. That
block is pnpm's copy of `pnpm.overrides` in `package.json`; without it the
lockfile stops applying the security floors, and `pnpm install
--frozen-lockfile` aborts with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` before any
test or compiler runs.

This is not a one-off. #327 (sign-client), #332 (vite group) and #333 (qs
group) each failed the same six jobs — Unit Tests, Lint, Type Check, Build
Frontend, E2E, Security Scan — until the lockfile was repaired by hand, and
`pnpm check:lockfile` named the lost overrides every time. No Dependabot
setting prevents it.

Two details that surprise people:

- Deleting `.github/dependabot.yml` does **not** stop security-update PRs.
  Those are controlled by the repo-level "Dependabot security updates"
  setting, which is separate from the config file.
- Dependabot's `groups` in `dependabot.yml` are why its security PRs arrive as
  one batch. Removing the file without disabling the setting makes the flood
  worse, not better.

## What Renovate changes

Renovate edits `package.json` and then runs pnpm itself to regenerate
`pnpm-lock.yaml`, so the `overrides` block is written by pnpm from
`package.json`. A separate tool no longer rewrites the lockfile, so the block
cannot be dropped.

`pnpm.overrides` is also extracted by Renovate as a dependency type, so the
floors themselves get bump PRs instead of drifting until someone raises them
by hand.

The config in `.github/renovate.json5` keeps the old behaviour where it
mattered:

- security alerts are grouped into one PR;
- routine minor/patch updates are grouped;
- majors need approval from the Dependency Dashboard (see #328);
- nothing auto-merges.

## One-time setup (repo admin)

1. Merge this config.
2. Install the Mend Renovate app on the repo: <https://github.com/apps/renovate>.
   It is free for public repositories.
3. Wait for the "Dependency Dashboard" issue. That confirms Renovate parsed the
   config and authenticated. Approve major updates there.
4. Cut over: disable **Dependabot security updates** in Settings → Code
   security, then delete `.github/dependabot.yml` in a follow-up PR. Keep
   **Dependabot alerts** and code scanning enabled — Renovate reads the alerts.
5. Close the Dependabot PRs still open at cutover. Renovate will reopen the
   ones that matter, with a lockfile that still has the overrides block.

## Verify a Renovate PR

```bash
git fetch origin <renovate-branch>
git show <renovate-branch>:pnpm-lock.yaml | grep -c '^overrides:'   # expect 1
git show <renovate-branch>:package.json | grep -c '"pnpm"'          # expect 1
```

On the branch itself, `pnpm check:lockfile` must print `OK: <n> overrides match
package.json`, and `pnpm install --frozen-lockfile` must succeed. CI runs both.

## If a dependency PR is red

- `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, or `check:lockfile` lists missing
  overrides: run `pnpm install --no-frozen-lockfile` and commit
  `pnpm-lock.yaml`. Do not hand-edit the block.
- This should only happen on legacy Dependabot branches after the cutover. If
  it happens on a Renovate branch, the config or the pnpm version is wrong —
  treat it as a bug, not routine maintenance.

## Why not an auto-repair job

A workflow that pushes a repaired lockfile back to a Dependabot branch needs a
write-scoped token. Workflows triggered by Dependabot get a read-only
`GITHUB_TOKEN` and cannot read ordinary Actions secrets, so the token would
have to live in Dependabot secrets. Pushes made with `GITHUB_TOKEN` do not
trigger CI either, so checks would not re-run without a PAT. Renovate removes
the repair loop instead of automating it.

## Scope

npm/pnpm only, for now. Cargo (`src-tauri/`) and SHA-pinned GitHub Actions are
deliberately not enabled; add the manager ids to `enabledManagers` when that
work is wanted.

## Files

- `.github/renovate.json5` — Renovate config.
- `.github/workflows/renovate-validate.yml` — validates the config on change.
- `scripts/check-lockfile-overrides.mjs` — guard against a dropped overrides
  block; keep it even after the cutover.
