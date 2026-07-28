import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ngoTemplate from '../../../data/chart-of-accounts/us-gaap-not-for-profit.json'

/**
 * Reads the restricted revenue code constants from the Rust source so the TS
 * test fails if the two sides drift. The Rust file is the source of truth.
 */
function readRustConstants(): {
  restrictedCodes: string[]
  releaseCode: string
} {
  const rustSrc = readFileSync(
    resolve(__dirname, '../../../../src-tauri/src/api/statements.rs'),
    'utf-8'
  )
  const codesMatch = rustSrc.match(
    /RESTRICTED_REVENUE_CODES:\s*&\[&str\]\s*=\s*&\[([^\]]+)\]/
  )
  if (!codesMatch) throw new Error('RESTRICTED_REVENUE_CODES not found in statements.rs')
  const restrictedCodes = codesMatch[1]
    .split(',')
    .map(s => s.trim().replace(/"/g, ''))
    .filter(Boolean)

  const releaseMatch = rustSrc.match(
    /RELEASE_FROM_RESTRICTION_CODE:\s*&str\s*=\s*"([^"]+)"/
  )
  if (!releaseMatch) throw new Error('RELEASE_FROM_RESTRICTION_CODE not found in statements.rs')

  return { restrictedCodes, releaseCode: releaseMatch[1] }
}

interface TemplateAccount {
  code: string
  name: string
  type: string
  subcategory?: string
}

describe('NGO restricted revenue codes vs template', () => {
  const {
    restrictedCodes: RESTRICTED_REVENUE_CODES,
    releaseCode: RELEASE_FROM_RESTRICTION_CODE,
  } = readRustConstants()
  const accounts = (ngoTemplate as { accounts: TemplateAccount[] }).accounts
  const revenueAccounts = accounts.filter(a => a.type === 'Income')

  it('every RESTRICTED_REVENUE_CODES entry exists in the NGO template', () => {
    for (const code of RESTRICTED_REVENUE_CODES) {
      const found = revenueAccounts.find(a => a.code === code)
      expect(found, `code ${code} not found in template`).toBeDefined()
    }
  })

  it('every RESTRICTED_REVENUE_CODES account name ends with "- Restricted"', () => {
    for (const code of RESTRICTED_REVENUE_CODES) {
      const acct = revenueAccounts.find(a => a.code === code)
      expect(acct, `code ${code} not found in template`).toBeDefined()
      if (!acct) continue
      expect(
        acct.name.endsWith('- Restricted'),
        `${code} "${acct.name}" does not end with "- Restricted"`
      ).toBe(true)
    }
  })

  it('no other revenue account name ends with "- Restricted" (missing from constant list)', () => {
    const nameRestricted = revenueAccounts
      .filter(a => a.name.endsWith('- Restricted'))
      .map(a => a.code)
    const missing = nameRestricted.filter(
      c => !RESTRICTED_REVENUE_CODES.includes(c)
    )
    expect(
      missing,
      `template accounts ending in "- Restricted" not in RESTRICTED_REVENUE_CODES: ${missing.join(', ')}`
    ).toEqual([])
  })

  it('RELEASE_FROM_RESTRICTION_CODE exists in the template', () => {
    const found = revenueAccounts.find(
      a => a.code === RELEASE_FROM_RESTRICTION_CODE
    )
    expect(found).toBeDefined()
  })
})
