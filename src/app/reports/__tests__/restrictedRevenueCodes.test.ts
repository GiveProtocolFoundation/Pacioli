import { describe, it, expect } from 'vitest'
import ngoTemplate from '../../../data/chart-of-accounts/us-gaap-not-for-profit.json'

const RESTRICTED_REVENUE_CODES = ['4010', '4360', '4910']
const RELEASE_FROM_RESTRICTION_CODE = '4980'

interface TemplateAccount {
  code: string
  name: string
  type: string
  subcategory?: string
}

describe('NGO restricted revenue codes vs template', () => {
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
