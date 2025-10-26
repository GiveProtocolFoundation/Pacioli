export type AccountCategory =
  | 'Assets'
  | 'Liabilities'
  | 'Equity'
  | 'Revenue'
  | 'Expenses'

export type AccountType = 'debit' | 'credit'

export interface ChartOfAccountsEntry {
  code: string
  name: string
  category: AccountCategory
  subcategory?: string
  type: AccountType
  description?: string
  parentCode?: string
  isActive: boolean
  editable: boolean
}

export interface ChartOfAccounts {
  id: string
  name: string
  jurisdiction: 'us-gaap' | 'ifrs'
  accountType: 'individual' | 'sme' | 'not-for-profit'
  accounts: ChartOfAccountsEntry[]
  isTemplate: boolean
  organizationId?: string
  createdAt: Date
  updatedAt: Date
}

export interface ChartOfAccountsTemplate {
  name: string
  jurisdiction: 'us-gaap' | 'ifrs'
  accountType: 'individual' | 'sme' | 'not-for-profit'
  accounts: Omit<ChartOfAccountsEntry, 'isActive' | 'editable'>[]
}
