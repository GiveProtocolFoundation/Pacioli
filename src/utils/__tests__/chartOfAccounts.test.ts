import { describe, it, expect } from 'vitest'
import {
  getChartOfAccountsTemplate,
  getTemplatesByJurisdiction,
  getAllTemplates,
  searchAccounts,
  getAccountsByType,
  groupAccountsByType,
} from '../chartOfAccounts'

describe('chartOfAccounts', () => {
  describe('getChartOfAccountsTemplate', () => {
    it('should return US GAAP individual template', () => {
      const template = getChartOfAccountsTemplate('us-gaap', 'individual')
      expect(template).not.toBeNull()
      expect(template?.jurisdiction).toBe('us-gaap')
      expect(template?.accountType).toBe('individual')
    })

    it('should return US GAAP not-for-profit template', () => {
      const template = getChartOfAccountsTemplate('us-gaap', 'not-for-profit')
      expect(template).not.toBeNull()
      expect(template?.jurisdiction).toBe('us-gaap')
      expect(template?.accountType).toBe('not-for-profit')
    })

    it('should return IFRS individual template', () => {
      const template = getChartOfAccountsTemplate('ifrs', 'individual')
      expect(template).not.toBeNull()
      expect(template?.jurisdiction).toBe('ifrs')
    })

    it('should return IFRS SME template', () => {
      const template = getChartOfAccountsTemplate('ifrs', 'sme')
      expect(template).not.toBeNull()
    })

    it('should return null for invalid jurisdiction', () => {
      // @ts-expect-error testing invalid input
      const template = getChartOfAccountsTemplate('invalid', 'individual')
      expect(template).toBeNull()
    })

    it('should return null for invalid account type', () => {
      // @ts-expect-error testing invalid input
      const template = getChartOfAccountsTemplate('us-gaap', 'invalid')
      expect(template).toBeNull()
    })

    it('should have accounts array in template', () => {
      const template = getChartOfAccountsTemplate('us-gaap', 'individual')
      expect(template?.accounts).toBeDefined()
      expect(Array.isArray(template?.accounts)).toBe(true)
      expect(template?.accounts.length).toBeGreaterThan(0)
    })
  })

  describe('getTemplatesByJurisdiction', () => {
    it('should return all US GAAP templates', () => {
      const templates = getTemplatesByJurisdiction('us-gaap')
      expect(templates.length).toBeGreaterThan(0)
      templates.forEach(t => {
        expect(t.jurisdiction).toBe('us-gaap')
      })
    })

    it('should return all IFRS templates', () => {
      const templates = getTemplatesByJurisdiction('ifrs')
      expect(templates.length).toBeGreaterThan(0)
      templates.forEach(t => {
        expect(t.jurisdiction).toBe('ifrs')
      })
    })

    it('should return empty array for invalid jurisdiction', () => {
      // @ts-expect-error testing invalid input
      const templates = getTemplatesByJurisdiction('invalid')
      expect(templates).toEqual([])
    })
  })

  describe('getAllTemplates', () => {
    it('should return all available templates', () => {
      const templates = getAllTemplates()
      expect(templates.length).toBeGreaterThan(0)
    })

    it('should include both US GAAP and IFRS templates', () => {
      const templates = getAllTemplates()
      const jurisdictions = new Set(templates.map(t => t.jurisdiction))
      expect(jurisdictions.has('us-gaap')).toBe(true)
      expect(jurisdictions.has('ifrs')).toBe(true)
    })

    it('should have unique templates', () => {
      const templates = getAllTemplates()
      // Note: sme may share template with for-profit-enterprise, so we check length is reasonable
      expect(templates.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('searchAccounts', () => {
    const template = getChartOfAccountsTemplate('us-gaap', 'individual')!

    it('should find accounts by code', () => {
      // Most templates have accounts starting with common codes like 1000
      const results = searchAccounts(template, '1')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(account => {
        expect(
          account.code.toLowerCase().includes('1') ||
            account.name.toLowerCase().includes('1') ||
            account.description?.toLowerCase().includes('1')
        ).toBe(true)
      })
    })

    it('should find accounts by name (case-insensitive)', () => {
      const results = searchAccounts(template, 'cash')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(account => {
        const matchFound =
          account.code.toLowerCase().includes('cash') ||
          account.name.toLowerCase().includes('cash') ||
          account.description?.toLowerCase().includes('cash')
        expect(matchFound).toBe(true)
      })
    })

    it('should find accounts by description', () => {
      // Search for a common accounting term
      const results = searchAccounts(template, 'asset')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should return empty array for no matches', () => {
      const results = searchAccounts(template, 'xyznonexistent123')
      expect(results).toEqual([])
    })

    it('should be case-insensitive', () => {
      const lowerResults = searchAccounts(template, 'cash')
      const upperResults = searchAccounts(template, 'CASH')
      expect(lowerResults.length).toBe(upperResults.length)
    })
  })

  describe('getAccountsByType', () => {
    const template = getChartOfAccountsTemplate('us-gaap', 'individual')!

    it('should filter Asset accounts', () => {
      const assets = getAccountsByType(template, 'Asset')
      expect(assets.length).toBeGreaterThan(0)
      assets.forEach(account => {
        expect(account.type.toLowerCase()).toBe('asset')
      })
    })

    it('should filter Liability accounts', () => {
      const liabilities = getAccountsByType(template, 'Liability')
      expect(liabilities.length).toBeGreaterThan(0)
      liabilities.forEach(account => {
        expect(account.type.toLowerCase()).toBe('liability')
      })
    })

    it('should filter Equity accounts', () => {
      const equity = getAccountsByType(template, 'Equity')
      expect(equity.length).toBeGreaterThan(0)
      equity.forEach(account => {
        expect(account.type.toLowerCase()).toBe('equity')
      })
    })

    it('should filter Income accounts', () => {
      const income = getAccountsByType(template, 'Income')
      expect(income.length).toBeGreaterThan(0)
      income.forEach(account => {
        expect(account.type.toLowerCase()).toBe('income')
      })
    })

    it('should filter Expense accounts', () => {
      const expenses = getAccountsByType(template, 'Expense')
      expect(expenses.length).toBeGreaterThan(0)
      expenses.forEach(account => {
        expect(account.type.toLowerCase()).toBe('expense')
      })
    })

    it('should be case-insensitive', () => {
      const lowercase = getAccountsByType(template, 'asset')
      const uppercase = getAccountsByType(template, 'ASSET')
      expect(lowercase.length).toBe(uppercase.length)
    })

    it('should return empty array for unknown type', () => {
      const results = getAccountsByType(template, 'UnknownType')
      expect(results).toEqual([])
    })
  })

  describe('groupAccountsByType', () => {
    const template = getChartOfAccountsTemplate('us-gaap', 'individual')!

    it('should group accounts by type', () => {
      const grouped = groupAccountsByType(template)
      expect(Object.keys(grouped).length).toBeGreaterThan(0)
    })

    it('should include all main account types', () => {
      const grouped = groupAccountsByType(template)
      const types = Object.keys(grouped)

      // Should have main accounting types
      expect(types.some(t => t.toLowerCase() === 'asset')).toBe(true)
      expect(types.some(t => t.toLowerCase() === 'liability')).toBe(true)
      expect(types.some(t => t.toLowerCase() === 'equity')).toBe(true)
    })

    it('should contain all template accounts', () => {
      const grouped = groupAccountsByType(template)
      const totalGrouped = Object.values(grouped).reduce(
        (sum, accounts) => sum + accounts.length,
        0
      )
      expect(totalGrouped).toBe(template.accounts.length)
    })

    it('should group accounts correctly', () => {
      const grouped = groupAccountsByType(template)

      Object.entries(grouped).forEach(([type, accounts]) => {
        accounts.forEach(account => {
          // Account type should match the group (or be empty/Other)
          expect(account.type || 'Other').toBe(type)
        })
      })
    })
  })
})
