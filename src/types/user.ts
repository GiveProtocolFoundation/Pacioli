export type AccountType = 'individual' | 'for-profit-enterprise' | 'sme' | 'not-for-profit' // 'sme' is deprecated, use 'for-profit-enterprise'
export type Jurisdiction = 'us-gaap' | 'ifrs'
export type UserRole = 'user' | 'preparer' | 'approver' | 'admin' | 'system-admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  roles?: UserRole[]
  accountType: AccountType
  jurisdiction: Jurisdiction
  organizationId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Organization {
  id: string
  name: string
  accountType: AccountType
  jurisdiction: Jurisdiction
  chartOfAccountsId: string
  createdAt: Date
  updatedAt: Date
}
