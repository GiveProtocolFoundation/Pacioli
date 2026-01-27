/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import {
  Transaction,
  TransactionFormData,
  TransactionStatus,
} from '../types/transaction'
import { detectPendingApproval } from '../services/notification/eventDetectors'

interface TransactionContextType {
  transactions: Transaction[]
  addTransaction: (transaction: TransactionFormData) => Promise<Transaction>
  updateTransaction: (
    id: string,
    updates: Partial<Transaction>
  ) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  getTransaction: (id: string) => Transaction | undefined
  approveTransaction: (
    id: string,
    approverId: string,
    approverName: string
  ) => Promise<void>
  rejectTransaction: (
    id: string,
    approverId: string,
    approverName: string,
    reason: string
  ) => Promise<void>
  pendingApprovals: Transaction[]
}

const TransactionContext = createContext<TransactionContextType | undefined>(
  undefined
)

export const TransactionProvider: React.FC<{
  children: ReactNode
  userAccountType?: string
}> = ({ children, userAccountType = 'individual' }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const isTeamAccount =
    userAccountType === 'sme' || userAccountType === 'not-for-profit'

  const addTransaction = useCallback(
    async (formData: TransactionFormData): Promise<Transaction> => {
      const newTransaction: Transaction = {
        ...formData,
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: isTeamAccount ? 'pending_approval' : 'completed',
        approvalStatus: isTeamAccount ? 'pending' : undefined,
        createdBy: 'current-user-id',
        createdByName: 'Current User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setTransactions(prev => [newTransaction, ...prev])

      // Trigger notification for pending approval if applicable
      if (isTeamAccount && newTransaction.status === 'pending_approval') {
        detectPendingApproval(
          {
            id: newTransaction.id,
            hash: newTransaction.hash,
            network: newTransaction.chainId || 'unknown',
          },
          newTransaction.createdByName
        ).catch(console.error)
      }

      return newTransaction
    },
    [isTeamAccount]
  )

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>) => {
      setTransactions(prev =>
        prev.map(txn =>
          txn.id === id
            ? { ...txn, ...updates, updatedAt: new Date().toISOString() }
            : txn
        )
      )
    },
    []
  )

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions(prev => prev.filter(txn => txn.id !== id))
  }, [])

  const getTransaction = useCallback(
    (id: string) => {
      return transactions.find(txn => txn.id === id)
    },
    [transactions]
  )

  const approveTransaction = useCallback(
    async (id: string, approverId: string, approverName: string) => {
      setTransactions(prev =>
        prev.map(txn =>
          txn.id === id
            ? {
                ...txn,
                status: 'approved' as TransactionStatus,
                approvalStatus: 'approved',
                approvedBy: approverId,
                approvedByName: approverName,
                approvedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : txn
        )
      )
    },
    []
  )

  const rejectTransaction = useCallback(
    async (
      id: string,
      approverId: string,
      approverName: string,
      reason: string
    ) => {
      setTransactions(prev =>
        prev.map(txn =>
          txn.id === id
            ? {
                ...txn,
                status: 'rejected' as TransactionStatus,
                approvalStatus: 'rejected',
                approvedBy: approverId,
                approvedByName: approverName,
                approvedAt: new Date().toISOString(),
                rejectionReason: reason,
                updatedAt: new Date().toISOString(),
              }
            : txn
        )
      )
    },
    []
  )

  const pendingApprovals = transactions.filter(
    txn => txn.status === 'pending_approval' && txn.approvalStatus === 'pending'
  )

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        getTransaction,
        approveTransaction,
        rejectTransaction,
        pendingApprovals,
      }}
    >
      {children}
    </TransactionContext.Provider>
  )
}

export const useTransactions = () => {
  const context = useContext(TransactionContext)
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionProvider')
  }
  return context
}
