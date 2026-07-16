import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Search,
  Zap,
  FileEdit,
  EyeOff,
  Inbox,
  RefreshCw,
} from 'lucide-react'
import { useNavBadges } from '../../contexts/NavBadgeContext'
import type { RawTransaction, GLAccount, JournalEntryWithLines } from '../../types/database'
import JournalEntryDrawer from '../journal-entries/JournalEntryDrawer'
import { formatTimestampFull, truncateHash, displayTxType } from './classificationUtils'

/** Skip/ignore modal state. */
interface IgnoreModal {
  transactionId: string
  hash: string
}

/**
 * Classification queue: lists unclassified raw transactions and provides
 * actions to auto-classify, manually classify, or skip/ignore each row.
 * @returns The ClassificationQueue component
 */
const ClassificationQueue: React.FC = () => {
  const { refreshCounts } = useNavBadges()
  const [transactions, setTransactions] = useState<RawTransaction[]>([])
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Drawer state for manual classification
  const [drawerTx, setDrawerTx] = useState<RawTransaction | null>(null)

  // Ignore modal state
  const [ignoreModal, setIgnoreModal] = useState<IgnoreModal | null>(null)
  const [ignoreReason, setIgnoreReason] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [txs, accts] = await Promise.all([
        invoke<RawTransaction[]>('get_unclassified_transactions'),
        invoke<GLAccount[]>('get_chart_of_accounts'),
      ])
      setTransactions(txs)
      setAccounts(accts)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions
    const q = searchQuery.toLowerCase()
    return transactions.filter(
      tx =>
        tx.hash.toLowerCase().includes(q) ||
        tx.chainId.toLowerCase().includes(q) ||
        tx.txType.toLowerCase().includes(q) ||
        tx.fromAddress.toLowerCase().includes(q) ||
        (tx.toAddress?.toLowerCase().includes(q) ?? false)
    )
  }, [transactions, searchQuery])

  const handleAutoClassify = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      const txId = e.currentTarget.dataset.txid
      if (!txId) return
      setProcessingId(txId)
      setActionError(null)
      try {
        await invoke<JournalEntryWithLines>('auto_classify_transaction', {
          transactionId: txId,
        })
        setTransactions(prev => prev.filter(t => t.id !== txId))
        refreshCounts()
      } catch (err) {
        setActionError(typeof err === 'string' ? err : 'Auto-classify failed')
      } finally {
        setProcessingId(null)
      }
    },
    [refreshCounts]
  )

  const handleManualClassify = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const txId = e.currentTarget.dataset.txid
      if (!txId) return
      const tx = transactions.find(t => t.id === txId)
      if (tx) setDrawerTx(tx)
    },
    [transactions]
  )

  const handleIgnoreClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const txId = e.currentTarget.dataset.txid
      if (!txId) return
      const tx = transactions.find(t => t.id === txId)
      if (tx) {
        setIgnoreModal({ transactionId: tx.id, hash: tx.hash })
        setIgnoreReason('')
      }
    },
    [transactions]
  )

  const handleIgnoreConfirm = useCallback(async () => {
    if (!ignoreModal) return
    setProcessingId(ignoreModal.transactionId)
    setActionError(null)
    try {
      await invoke('ignore_transaction', {
        transactionId: ignoreModal.transactionId,
        reason: ignoreReason || null,
      })
      setTransactions(prev =>
        prev.filter(t => t.id !== ignoreModal.transactionId)
      )
      refreshCounts()
      setIgnoreModal(null)
    } catch (err) {
      setActionError(typeof err === 'string' ? err : 'Ignore failed')
    } finally {
      setProcessingId(null)
    }
  }, [ignoreModal, ignoreReason, refreshCounts])

  const handleIgnoreCancel = useCallback(() => {
    setIgnoreModal(null)
    setIgnoreReason('')
  }, [])

  const handleDrawerSaved = useCallback(() => {
    setDrawerTx(null)
    // Remove the classified transaction from the local list
    setTransactions(prev => prev.filter(t => t.id !== drawerTx?.id))
    refreshCounts()
  }, [drawerTx, refreshCounts])

  const handleDrawerClose = useCallback(() => {
    setDrawerTx(null)
  }, [])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    []
  )

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIgnoreReason(e.target.value)
    },
    []
  )

  if (loading) {
    return (
      <div className="p-6 min-h-screen ledger-background flex items-center justify-center">
        <div className="text-[#294050] dark:text-[#9FB4BE]">Loading classification queue...</div>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-screen ledger-background">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">Accounting</p>
          <h1>Classification Queue</h1>
          <p className="text-[#294050] dark:text-[#9FB4BE] mt-1">
            Classify raw blockchain transactions into draft journal entries
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] text-[#294050] dark:text-[#9FB4BE]"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error banners */}
      {error !== null && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {actionError !== null && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {actionError}
        </div>
      )}

      {/* Search */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#647D8B]" />
        <input
          type="text"
          placeholder="Search by hash, chain, type, address..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-4 pr-10 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] dark:placeholder-[#294050] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0]"
        />
      </div>

      {/* Count summary */}
      <div className="mb-4 text-sm text-[#294050] dark:text-[#9FB4BE]">
        {filtered.length} unclassified transaction{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#EAF3F2] dark:bg-[#11202B] border-b border-[rgba(95,227,192,0.15)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Chain
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Hash
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Fee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
                {filtered.map(tx => {
                  const busy = processingId === tx.id
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[#11202B] dark:text-[#EAF3F2]">
                        {tx.chainId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-[#294050] dark:text-[#9FB4BE]">
                        <span title={tx.hash}>{truncateHash(tx.hash)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#294050]/10 text-[#294050] dark:bg-[#294050]/20 dark:text-[#9FB4BE]">
                          {displayTxType(tx.txType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {tx.value}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-[#647D8B]">
                        {tx.fee ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[#294050] dark:text-[#9FB4BE]">
                        {formatTimestampFull(tx.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            data-txid={tx.id}
                            onClick={handleAutoClassify}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-[#5FE3C0]/10 text-[#294050] dark:text-[#5FE3C0] hover:bg-[#5FE3C0]/20 disabled:opacity-50 transition-colors"
                            title="Auto-classify using heuristic rules"
                          >
                            <Zap className="w-3 h-3" />
                            Auto
                          </button>
                          <button
                            data-txid={tx.id}
                            onClick={handleManualClassify}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
                            title="Manually classify with journal entry form"
                          >
                            <FileEdit className="w-3 h-3" />
                            Manual
                          </button>
                          <button
                            data-txid={tx.id}
                            onClick={handleIgnoreClick}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                            title="Skip / ignore this transaction"
                          >
                            <EyeOff className="w-3 h-3" />
                            Skip
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)]">
          <Inbox className="mx-auto h-12 w-12 text-[#647D8B]" />
          <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No unclassified transactions
          </h3>
          <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
            All raw transactions have been classified or ignored.
          </p>
        </div>
      )}

      {/* Ignore confirmation modal */}
      {ignoreModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={handleIgnoreCancel} />
          <div className="relative bg-[#F7FAFA] dark:bg-[#11202B] rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-[#11202B] dark:text-[#EAF3F2] mb-2">
              Skip Transaction
            </h3>
            <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mb-4">
              Mark <span className="font-mono">{truncateHash(ignoreModal.hash)}</span> as
              ignored? This can be reversed later.
            </p>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={ignoreReason}
              onChange={handleReasonChange}
              className="w-full px-3 py-2 mb-4 border border-[rgba(95,227,192,0.15)] rounded-lg bg-white dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleIgnoreCancel}
                className="px-4 py-2 text-sm border border-[rgba(95,227,192,0.15)] rounded-lg text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
              >
                Cancel
              </button>
              <button
                onClick={handleIgnoreConfirm}
                disabled={processingId === ignoreModal.transactionId}
                className="px-4 py-2 text-sm rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual classification drawer (Phase 3 JournalEntryDrawer) */}
      {drawerTx !== null && (
        <JournalEntryDrawer
          accounts={accounts}
          transactionRef={drawerTx.hash}
          rawTransactionId={drawerTx.id}
          initialDescription={`${displayTxType(drawerTx.txType)} on ${drawerTx.chainId} (${truncateHash(drawerTx.hash)})`}
          onClose={handleDrawerClose}
          onSaved={handleDrawerSaved}
        />
      )}
    </div>
  )
}

export default ClassificationQueue
