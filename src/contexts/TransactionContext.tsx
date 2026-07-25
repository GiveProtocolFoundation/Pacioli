/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useCallback,
  useRef,
} from 'react'
import {
  Transaction,
  TransactionFormData,
  TransactionStatus,
} from '../types/transaction'
import type { ClassificationStatus } from '../types/database'
import type {
  StoredTransaction,
  TransactionInput,
} from '../services/persistence/types'
import { persistence } from '../services/persistence'
import { useProfile } from './ProfileContext'
import { detectPendingApproval } from '../services/notification/eventDetectors'

const ACCOUNTING_MARKER = '__pacioli_accounting'

/** Reconstitute a persisted StoredTransaction into the in-memory Transaction shape. */
function storedToTransaction(st: StoredTransaction): Transaction {
  if (st.raw_data) {
    try {
      const parsed = JSON.parse(st.raw_data)
      if (parsed[ACCOUNTING_MARKER]) {
        return { ...parsed, id: st.id }
      }
    } catch {
      /* fall through */
    }
  }

  const txType =
    st.tx_type === 'revenue' || st.tx_type === 'expense'
      ? st.tx_type
      : ('transfer' as const)

  return {
    id: st.id,
    date: st.timestamp ?? st.created_at,
    description:
      [st.tx_type, st.chain].filter(Boolean).join(' – ') || 'Transaction',
    type: txType,
    category: st.tx_type ?? 'uncategorized',
    wallet: st.from_address ?? '',
    tokenId: st.token_symbol ?? '',
    chainId: st.chain,
    amount: st.value ? parseFloat(st.value) : 0,
    fiatValue:
      st.price_at_acquisition_usd && st.value
        ? parseFloat(st.value) * parseFloat(st.price_at_acquisition_usd)
        : 0,
    fiatCurrency: 'USD',
    hash: st.hash,
    status: 'completed' as TransactionStatus,
    classificationStatus: 'unclassified' as ClassificationStatus,
    createdBy: 'system',
    createdByName: 'System',
    createdAt: st.created_at,
    updatedAt: st.created_at,
  }
}

/** Convert an in-memory Transaction into a persistence-layer TransactionInput for saving. */
function transactionToInput(tx: Transaction): TransactionInput {
  const serializable = { ...tx, [ACCOUNTING_MARKER]: true }
  return {
    hash: tx.hash || `manual_${tx.createdAt}_${tx.id}`,
    timestamp: new Date(tx.date).toISOString(),
    from_address: tx.wallet,
    to_address: tx.destinationWallet,
    value: tx.amount.toString(),
    status: tx.status,
    tx_type: tx.type,
    token_symbol: tx.tokenId,
    chain: tx.chainId || 'manual',
    raw_data: JSON.stringify(serializable),
  }
}

interface TransactionContextType {
  transactions: Transaction[]
  loading: boolean
  addTransaction: (
    transaction: TransactionFormData,
    provenance?: { createdBy: string; createdByName: string }
  ) => Promise<Transaction>
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
  reloadTransactions: () => Promise<void>
  pendingApprovals: Transaction[]
}

const TransactionContext = createContext<TransactionContextType | undefined>(
  undefined // skipcq: JS-W1042 — React createContext requires explicit default argument
)

/** Find or create a persistence wallet record, returning its id. */
async function resolveWalletId(
  profileId: string,
  address: string,
  chain: string
): Promise<string> {
  const wallets = await persistence.getWallets(profileId)
  const match = wallets.find(w => w.address === address && w.chain === chain)
  if (match) return match.id
  const created = await persistence.saveWallet({
    profile_id: profileId,
    address: address || 'manual',
    chain: chain || 'manual',
    name: 'Imported wallet',
    wallet_type: 'imported',
  })
  return created.id
}

/** Persistence-backed transaction state provider (SQLite on desktop, IndexedDB on web). */
export const TransactionProvider: React.FC<{
  children: ReactNode
  userAccountType?: string
}> = ({ children, userAccountType = 'individual' }) => {
  const { currentProfile } = useProfile()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)

  const isTeamAccount =
    userAccountType === 'sme' || userAccountType === 'not-for-profit'

  const loadTransactions = useCallback(async () => {
    if (!currentProfile) {
      setTransactions([])
      setLoading(false)
      return
    }
    try {
      const stored = await persistence.getAllTransactions(currentProfile.id, {
        limit: 10000,
      })
      setTransactions(stored.map(storedToTransaction))
    } catch (err) {
      console.error('[TransactionContext] Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }, [currentProfile])

  useEffect(() => {
    if (initRef.current && !currentProfile) return
    initRef.current = true
    loadTransactions()
  }, [loadTransactions, currentProfile])

  const addTransaction = useCallback(
    async (
      formData: TransactionFormData,
      provenance?: { createdBy: string; createdByName: string }
    ): Promise<Transaction> => {
      const newTransaction: Transaction = {
        ...formData,
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: isTeamAccount ? 'pending_approval' : 'completed',
        classificationStatus: 'unclassified',
        ...(isTeamAccount && { approvalStatus: 'pending' as const }),
        createdBy: provenance?.createdBy ?? 'manual-entry',
        createdByName: provenance?.createdByName ?? 'Manual Entry',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (currentProfile) {
        try {
          const walletId = await resolveWalletId(
            currentProfile.id,
            formData.wallet,
            formData.chainId || 'manual'
          )
          await persistence.saveTransactions(walletId, [
            transactionToInput(newTransaction),
          ])
          await loadTransactions()
        } catch (err) {
          console.error(
            '[TransactionContext] Persist failed, keeping in-memory:',
            err
          )
          setTransactions(prev => [newTransaction, ...prev])
        }
      } else {
        setTransactions(prev => [newTransaction, ...prev])
      }

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
    [isTeamAccount, currentProfile, loadTransactions]
  )

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>): Promise<void> => {
      setTransactions(prev =>
        prev.map(txn =>
          txn.id === id
            ? { ...txn, ...updates, updatedAt: new Date().toISOString() }
            : txn
        )
      )

      if (currentProfile) {
        const existing = transactions.find(txn => txn.id === id)
        if (existing) {
          const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
          try {
            const walletId = await resolveWalletId(
              currentProfile.id,
              updated.wallet,
              updated.chainId || 'manual'
            )
            await persistence.saveTransactions(walletId, [
              transactionToInput(updated),
            ])
          } catch (err) {
            console.error('[TransactionContext] Update persist failed:', err)
          }
        }
      }
    },
    [currentProfile, transactions]
  )

  const deleteTransaction = useCallback((id: string): Promise<void> => {
    setTransactions(prev => prev.filter(txn => txn.id !== id))
    return Promise.resolve()
  }, [])

  const getTransaction = useCallback(
    (id: string) => {
      return transactions.find(txn => txn.id === id)
    },
    [transactions]
  )

  const approveTransaction = useCallback(
    (id: string, approverId: string, approverName: string): Promise<void> => {
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
      return Promise.resolve()
    },
    []
  )

  const rejectTransaction = useCallback(
    (
      id: string,
      approverId: string,
      approverName: string,
      reason: string
    ): Promise<void> => {
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
      return Promise.resolve()
    },
    []
  )

  const pendingApprovals = useMemo(
    () =>
      transactions.filter(
        txn =>
          txn.status === 'pending_approval' && txn.approvalStatus === 'pending'
      ),
    [transactions]
  )

  const contextValue = useMemo(
    () => ({
      transactions,
      loading,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      getTransaction,
      approveTransaction,
      rejectTransaction,
      reloadTransactions: loadTransactions,
      pendingApprovals,
    }),
    [
      transactions,
      loading,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      getTransaction,
      approveTransaction,
      rejectTransaction,
      loadTransactions,
      pendingApprovals,
    ]
  )

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  )
}

/** Hook to access transaction context; must be used within a TransactionProvider. */
export const useTransactions = () => {
  const context = useContext(TransactionContext)
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionProvider')
  }
  return context
}
