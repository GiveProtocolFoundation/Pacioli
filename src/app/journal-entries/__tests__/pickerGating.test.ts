import { describe, it, expect } from 'vitest'
import { AccountType } from '../../../types/database'

/**
 * Mirrors the picker visibility logic from JournalEntryDrawer.
 * The picker shows when: the profile is NGO AND the selected account is an Expense.
 */
function isPickerVisible(
  profileAccountType: string,
  glAccountType?: AccountType
): boolean {
  const isNgo = profileAccountType === 'not-for-profit'
  if (!isNgo) return false
  return glAccountType === AccountType.Expense
}

describe('functional-classification picker gating', () => {
  it('shows picker for NGO profile + Expense account', () => {
    expect(isPickerVisible('not-for-profit', AccountType.Expense)).toBe(true)
  })

  it('hides picker for SME profile + Expense account', () => {
    expect(
      isPickerVisible('small-medium-enterprise', AccountType.Expense)
    ).toBe(false)
  })

  it('hides picker for individual profile + Expense account', () => {
    expect(isPickerVisible('individual', AccountType.Expense)).toBe(false)
  })

  it('hides picker for NGO profile + Asset account', () => {
    expect(isPickerVisible('not-for-profit', AccountType.Asset)).toBe(false)
  })

  it('hides picker for NGO profile + Income account', () => {
    expect(isPickerVisible('not-for-profit', AccountType.Income)).toBe(false)
  })

  it('hides picker for NGO profile + Liability account', () => {
    expect(isPickerVisible('not-for-profit', AccountType.Liability)).toBe(false)
  })

  it('hides picker for NGO profile + Equity account', () => {
    expect(isPickerVisible('not-for-profit', AccountType.Equity)).toBe(false)
  })

  it('hides picker when no account is selected', () => {
    expect(isPickerVisible('not-for-profit')).toBe(false)
  })

  it('covers all account types — only Expense shows the picker', () => {
    const allTypes = Object.values(AccountType)
    for (const t of allTypes) {
      const expected = t === AccountType.Expense
      expect(
        isPickerVisible('not-for-profit', t),
        `${t} should ${expected ? 'show' : 'hide'} picker`
      ).toBe(expected)
    }
  })
})

describe('SME report route guard', () => {
  // Mirrors the isNgo guard in StatementOfActivities.tsx — same comparison, testable without DOM.
  function shouldShowSoa(accountType: string | null | undefined): boolean {
    return accountType === 'not-for-profit'
  }

  it('NGO profile is allowed to view Statement of Activities', () => {
    expect(shouldShowSoa('not-for-profit')).toBe(true)
  })

  it('SME profile is redirected away from Statement of Activities', () => {
    expect(shouldShowSoa('small-medium-enterprise')).toBe(false)
  })

  it('individual profile is redirected away from Statement of Activities', () => {
    expect(shouldShowSoa('individual')).toBe(false)
  })

  it('null accountType (unauthenticated) is redirected away', () => {
    expect(shouldShowSoa(null)).toBe(false)
  })
})
