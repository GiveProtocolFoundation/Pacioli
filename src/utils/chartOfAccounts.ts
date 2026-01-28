import { ChartOfAccountsTemplate } from '../types/chartOfAccounts'
import type { Jurisdiction, AccountType } from '../types/user'

// Import all chart of accounts templates
import usGaapIndividual from '../data/chart-of-accounts/us-gaap-individual.json'
import usGaapForProfitEnterprise from '../data/chart-of-accounts/us-gaap-for-profit-enterprise.json'
import usGaapNotForProfit from '../data/chart-of-accounts/us-gaap-not-for-profit.json'
import ifrsIndividual from '../data/chart-of-accounts/ifrs-individual.json'
import ifrsSme from '../data/chart-of-accounts/ifrs-sme.json'
import ifrsNotForProfit from '../data/chart-of-accounts/ifrs-not-for-profit.json'

const templates: Record<string, ChartOfAccountsTemplate> = {
  'us-gaap-individual': usGaapIndividual as ChartOfAccountsTemplate,
  'us-gaap-for-profit-enterprise':
    usGaapForProfitEnterprise as ChartOfAccountsTemplate,
  'us-gaap-sme': usGaapForProfitEnterprise as ChartOfAccountsTemplate, // Deprecated: use for-profit-enterprise
  'us-gaap-not-for-profit': usGaapNotForProfit as ChartOfAccountsTemplate,
  'ifrs-individual': ifrsIndividual as ChartOfAccountsTemplate,
  'ifrs-sme': ifrsSme as ChartOfAccountsTemplate,
  'ifrs-not-for-profit': ifrsNotForProfit as ChartOfAccountsTemplate,
}

/**
 * Get a chart of accounts template by jurisdiction and account type
 */
export function getChartOfAccountsTemplate(
  jurisdiction: Jurisdiction,
  accountType: AccountType
): ChartOfAccountsTemplate | null {
  const key = `${jurisdiction}-${accountType}`
  return templates[key] || null
}

/**
 * Get all available templates for a specific jurisdiction
 */
export function getTemplatesByJurisdiction(
  jurisdiction: Jurisdiction
): ChartOfAccountsTemplate[] {
  return Object.entries(templates)
    .filter(([key]) => key.startsWith(jurisdiction))
    .map(([_, template]) => template)
}

/**
 * Get all available templates
 */
export function getAllTemplates(): ChartOfAccountsTemplate[] {
  return Object.values(templates)
}

/**
 * Search accounts within a template
 */
export function searchAccounts(
  template: ChartOfAccountsTemplate,
  searchTerm: string
): typeof template.accounts {
  const term = searchTerm.toLowerCase()
  return template.accounts.filter(
    account =>
      account.code.toLowerCase().includes(term) ||
      account.name.toLowerCase().includes(term) ||
      account.description?.toLowerCase().includes(term)
  )
}

/**
 * Get accounts by type (Asset, Liability, Equity, Revenue, Expense)
 */
export function getAccountsByType(
  template: ChartOfAccountsTemplate,
  type: string
): typeof template.accounts {
  return template.accounts.filter(
    account => account.type.toLowerCase() === type.toLowerCase()
  )
}

/**
 * Group accounts by their type
 */
export function groupAccountsByType(
  template: ChartOfAccountsTemplate
): Record<string, typeof template.accounts> {
  const grouped: Record<string, typeof template.accounts> = {}

  template.accounts.forEach(account => {
    const type = account.type || 'Other'
    if (!grouped[type]) {
      grouped[type] = []
    }
    grouped[type].push(account)
  })

  return grouped
}
