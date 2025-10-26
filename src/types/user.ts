export type AccountType = 'individual' | 'sme' | 'not-for-profit'
export type Jurisdiction = 'us-gaap' | 'ifrs'
export type UserRole = 'user' | 'admin' | 'system-admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
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
