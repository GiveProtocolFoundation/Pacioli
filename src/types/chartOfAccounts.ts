export type AccountCategory =
  | 'Assets'
  | 'Liabilities'
  | 'Equity'
  | 'Revenue'
  | 'Expenses'

// JSON data currently uses these singular forms in the 'type' field
export type AccountTypeValue =
  | 'Asset'
  | 'Liability'
  | 'Equity'
  | 'Revenue'
  | 'Expense'

export type DebitCreditType = 'debit' | 'credit'

export interface ChartOfAccountsEntry {
  code: string
  name: string
  category?: AccountCategory
  subcategory?: string
  type: AccountTypeValue // Currently stores category in JSON data
  debitCredit?: DebitCreditType // Future field for debit/credit classification
  description?: string
  parentCode?: string
  isActive: boolean
  editable: boolean
}

export interface ChartOfAccounts {
  id: string
  name: string
  jurisdiction: 'us-gaap' | 'ifrs'
  accountType: 'individual' | 'for-profit-enterprise' | 'sme' | 'not-for-profit' // 'sme' is deprecated
  accounts: ChartOfAccountsEntry[]
  isTemplate: boolean
  organizationId?: string
  createdAt: Date
  updatedAt: Date
}

export interface ChartOfAccountsTemplate {
  name: string
  jurisdiction: 'us-gaap' | 'ifrs'
  accountType: 'individual' | 'for-profit-enterprise' | 'sme' | 'not-for-profit' // 'sme' is deprecated
  accounts: ChartOfAccountsEntry[]
}
