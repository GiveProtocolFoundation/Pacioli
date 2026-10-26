#!/usr/bin/env node
/**
 * Verify that the `overrides` block in pnpm-lock.yaml still matches
 * `pnpm.overrides` in package.json.
 *
 * Why this exists: Dependabot regenerates pnpm-lock.yaml without carrying the
 * overrides block over, so every security floor declared in package.json
 * silently disappears from the lockfile and the vulnerable versions come back.
 * `pnpm install --frozen-lockfile` does catch it, but it reports
 * ERR_PNPM_LOCKFILE_CONFIG_MISMATCH without naming a single lost override,
 * which reads like routine bot noise. This check names them.
 *
 * Usage:
 *   node scripts/check-lockfile-overrides.mjs [project-dir]
 *
 * Exit codes: 0 = lockfile matches, 1 = drift, 2 = input unreadable.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(process.argv[2] ?? repoRoot)

/** @returns {Record<string, string>} */
function readManifestOverrides() {
  const manifest = JSON.parse(
    readFileSync(resolve(projectDir, 'package.json'), 'utf8')
  )
  return manifest.pnpm?.overrides ?? {}
}

/**
 * Extract the top-level `overrides:` mapping from a pnpm lockfile without
 * pulling in a YAML parser. The block is flat: two-space indented
 * `key: value` lines, optionally single-quoted keys, ending at the next
 * top-level key.
 *
 * @param {string} lockfile
 * @returns {Record<string, string>}
 */
function readLockfileOverrides(lockfile) {
  /** @type {Record<string, string>} */
  const overrides = {}
  let inside = false

  for (const line of lockfile.split('\n')) {
    if (!inside) {
      if (line.trimEnd() === 'overrides:') inside = true
      continue
    }

    // Blank line or the next top-level key ends the block.
    if (line.trim() === '' || !/^\s/.test(line)) break

    const match = /^ {2}'?([^':]+)'?: (.+)$/.exec(line)
    if (match) overrides[match[1]] = match[2].trim()
  }

  return overrides
}

function main() {
  let manifestOverrides
  let lockfile
  try {
    manifestOverrides = readManifestOverrides()
    lockfile = readFileSync(resolve(projectDir, 'pnpm-lock.yaml'), 'utf8')
  } catch (error) {
    console.error(`[lockfile-overrides] cannot read inputs: ${error.message}`)
    process.exit(2)
  }

  const declared = Object.keys(manifestOverrides).sort()
  if (declared.length === 0) {
    console.log('[lockfile-overrides] package.json declares no pnpm.overrides')
    return
  }

  const locked = readLockfileOverrides(lockfile)
  const missing = declared.filter(name => !(name in locked))
  const extra = Object.keys(locked)
    .filter(name => !(name in manifestOverrides))
    .sort()
  const changed = declared.filter(
    name => name in locked && locked[name] !== manifestOverrides[name]
  )

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log(
      `[lockfile-overrides] OK: ${declared.length} overrides match package.json`
    )
    return
  }

  console.error(
    '[lockfile-overrides] pnpm-lock.yaml has drifted from package.json'
  )
  console.error(
    `  package.json: ${declared.length} overrides | pnpm-lock.yaml: ${Object.keys(locked).length}`
  )

  if (missing.length > 0) {
    console.error(`\n  Missing from pnpm-lock.yaml (${missing.length}):`)
    for (const name of missing) {
      console.error(`    ${name}: ${manifestOverrides[name]}`)
    }
  }

  if (changed.length > 0) {
    console.error(`\n  Different range in pnpm-lock.yaml (${changed.length}):`)
    for (const name of changed) {
      console.error(
        `    ${name}: expected ${manifestOverrides[name]}, found ${locked[name]}`
      )
    }
  }

  if (extra.length > 0) {
    console.error(
      `\n  Present in pnpm-lock.yaml but not package.json (${extra.length}):`
    )
    for (const name of extra) {
      console.error(`    ${name}: ${locked[name]}`)
    }
  }

  console.error(
    '\n  Dependabot regenerates pnpm-lock.yaml without the overrides block, which\n' +
      '  drops these security floors and re-resolves the affected packages to the\n' +
      '  vulnerable versions the overrides existed to exclude. To repair a branch:\n' +
      '\n      pnpm install --no-frozen-lockfile\n' +
      '\n' +
      '  then commit pnpm-lock.yaml. Do not hand-edit the block.\n'
  )
  process.exit(1)
}

main()
