export type TransactionType = 'revenue' | 'expense' | 'transfer'
export type TransactionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'failed'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface TransactionFormData {
  date: string
  description: string
  type: TransactionType
  category: string
  wallet: string

  // Token-based fields (new architecture)
  tokenId: string
  chainId: string
  amount: number

  // Fiat valuation
  fiatValue: number
  fiatCurrency: string

  // Blockchain details
  hash?: string
  contractAddress?: string

  // Accounting details
  accountCode?: string
  accountName?: string
  digitalAssetType?: string

  // Comprehensive transaction type system
  transactionCategory?: string
  transactionSubcategory?: string
  transactionTypeCode?: string

  // Additional information
  memo?: string
  attachments?: File[]

  // Legacy field for backward compatibility
  crypto?: string
}

export interface Transaction extends TransactionFormData {
  id: string
  status: TransactionStatus
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
  approvalStatus?: ApprovalStatus
  approvedBy?: string
  approvedByName?: string
  approvedAt?: string
  rejectionReason?: string
  usdValue?: number
}

export interface TransactionApprovalQueueItem {
  transaction: Transaction
  daysPending: number
  preparer: {
    id: string
    name: string
    email: string
  }
}
