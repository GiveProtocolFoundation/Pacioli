import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Search,
  Zap,
  FileEdit,
  EyeOff,
  Inbox,
  RefreshCw,
  DollarSign,
} from 'lucide-react'
import { useNavBadges } from '../../contexts/NavBadgeContext'
import type {
  RawTransaction,
  GLAccount,
  JournalEntryWithLines,
} from '../../types/database'
import JournalEntryDrawer from '../journal-entries/JournalEntryDrawer'
import {
  formatTimestampFull,
  truncateHash,
  displayTxType,
} from './classificationUtils'

/** Skip/ignore modal state. */
interface IgnoreModal {
  transactionId: string
  hash: string
}

const HEADER_CELL =
  'px-4 py-3 text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider'

/** Static table header row for the classification queue. */
const QueueHeaderRow: React.FC = () => (
  <tr>
    <th className={`${HEADER_CELL} text-left`}>Chain</th>
    <th className={`${HEADER_CELL} text-left`}>Hash</th>
    <th className={`${HEADER_CELL} text-left`}>Type</th>
    <th className={`${HEADER_CELL} text-right`}>Qty</th>
    <th className={`${HEADER_CELL} text-right`}>USD Value</th>
    <th className={`${HEADER_CELL} text-right`}>Fee</th>
    <th className={`${HEADER_CELL} text-left`}>Timestamp</th>
    <th className={`${HEADER_CELL} text-center`}>Actions</th>
  </tr>
)

/** Props for a single classification queue row. */
interface QueueRowProps {
  tx: RawTransaction
  busy: boolean
  onAutoClassify: (event: React.MouseEvent<HTMLButtonElement>) => void
  onManualClassify: (event: React.MouseEvent<HTMLButtonElement>) => void
  onIgnore: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/** One raw transaction row with Auto / Manual / Skip actions. */
const QueueRow: React.FC<QueueRowProps> = ({
  tx,
  busy,
  onAutoClassify,
  onManualClassify,
  onIgnore,
}) => (
  <tr className="hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]">
    <td className="px-4 py-3 whitespace-nowrap text-sm text-[#11202B] dark:text-[#EAF3F2]">
      {tx.chainId}
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-[#294050] dark:text-[#9FB4BE]">
      <span title={tx.transactionHash}>{truncateHash(tx.transactionHash)}</span>
    </td>
    <td className="px-4 py-3 whitespace-nowrap">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#294050]/10 text-[#294050] dark:bg-[#294050]/20 dark:text-[#9FB4BE]">
        {displayTxType(tx.transactionType)}
      </span>
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
      {tx.transferValue}
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono">
      {tx.valuationStatus === 'priced' && tx.priceAtAcquisitionUsd ? (
        <span className="text-[#11202B] dark:text-[#EAF3F2]">
          $
          {(
            parseFloat(tx.transferValue) * parseFloat(tx.priceAtAcquisitionUsd)
          ).toFixed(2)}
        </span>
      ) : tx.valuationStatus === 'unavailable' ? (
        <span
          className="text-amber-600 dark:text-amber-400"
          title="Price unavailable for this token/date"
        >
          N/A
        </span>
      ) : (
        <span className="text-[#647D8B]" title="Price not yet fetched">
          —
        </span>
      )}
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-[#647D8B]">
      {tx.transactionFee ?? '—'}
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-sm text-[#294050] dark:text-[#9FB4BE]">
      {formatTimestampFull(tx.timestamp)}
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-center">
      <div className="flex items-center justify-center gap-1">
        <button
          data-txid={tx.id}
          onClick={onAutoClassify}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-[#5FE3C0]/10 text-[#294050] dark:text-[#5FE3C0] hover:bg-[#5FE3C0]/20 disabled:opacity-50 transition-colors"
          title="Auto-classify using heuristic rules"
        >
          <Zap className="w-3 h-3" />
          Auto
        </button>
        <button
          data-txid={tx.id}
          onClick={onManualClassify}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
          title="Manually classify with journal entry form"
        >
          <FileEdit className="w-3 h-3" />
          Manual
        </button>
        <button
          data-txid={tx.id}
          onClick={onIgnore}
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

/** Props for the skip/ignore confirmation dialog. */
interface IgnoreDialogProps {
  hash: string
  reason: string
  busy: boolean
  onReasonChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation dialog for skipping/ignoring a raw transaction. */
const IgnoreDialog: React.FC<IgnoreDialogProps> = ({
  hash,
  reason,
  busy,
  onReasonChange,
  onConfirm,
  onCancel,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
    <div className="relative bg-[#F7FAFA] dark:bg-[#11202B] rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
      <h3 className="text-lg font-bold text-[#11202B] dark:text-[#EAF3F2] mb-2">
        Skip Transaction
      </h3>
      <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mb-4">
        Mark <span className="font-mono">{truncateHash(hash)}</span> as ignored?
        This can be reversed later.
      </p>
      <input
        type="text"
        placeholder="Reason (optional)"
        value={reason}
        onChange={onReasonChange}
        className="w-full px-3 py-2 mb-4 border border-[rgba(95,227,192,0.15)] rounded-lg bg-white dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-[rgba(95,227,192,0.15)] rounded-lg text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="px-4 py-2 text-sm rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)

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

  const [enriching, setEnriching] = useState(false)

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

  const handleEnrichPrices = useCallback(async () => {
    setEnriching(true)
    setActionError(null)
    try {
      await invoke('enrich_transaction_prices')
      await fetchData()
    } catch (err) {
      setActionError(typeof err === 'string' ? err : 'Price enrichment failed')
    } finally {
      setEnriching(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = useMemo(() => {
    if (!searchQuery) return transactions
    const needle = searchQuery.toLowerCase()
    return transactions.filter(
      tx =>
        tx.transactionHash.toLowerCase().includes(needle) ||
        tx.chainId.toLowerCase().includes(needle) ||
        tx.transactionType.toLowerCase().includes(needle) ||
        tx.fromAddress.toLowerCase().includes(needle) ||
        (tx.toAddress?.toLowerCase().includes(needle) ?? false)
    )
  }, [transactions, searchQuery])

  const handleAutoClassify = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const txId = event.currentTarget.dataset.txid
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
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const txId = event.currentTarget.dataset.txid
      if (!txId) return
      const tx = transactions.find(t => t.id === txId)
      if (tx) setDrawerTx(tx)
    },
    [transactions]
  )

  const handleIgnoreClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const txId = event.currentTarget.dataset.txid
      if (!txId) return
      const tx = transactions.find(t => t.id === txId)
      if (tx) {
        setIgnoreModal({ transactionId: tx.id, hash: tx.transactionHash })
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
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value)
    },
    []
  )

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleReasonChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setIgnoreReason(event.target.value)
    },
    []
  )

  if (loading) {
    return (
      <div className="p-6 min-h-screen ledger-background flex items-center justify-center">
        <div className="text-[#294050] dark:text-[#9FB4BE]">
          Loading classification queue...
        </div>
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
        <div className="flex items-center gap-2">
          {transactions.some(tx => tx.valuationStatus === 'unpriced') && (
            <button
              onClick={handleEnrichPrices}
              disabled={enriching}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5FE3C0]/10 text-[#294050] dark:text-[#5FE3C0] hover:bg-[#5FE3C0]/20 disabled:opacity-50 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              {enriching ? 'Fetching prices...' : 'Enrich Prices'}
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] text-[#294050] dark:text-[#9FB4BE]"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
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
        {filtered.length} unclassified transaction
        {filtered.length !== 1 ? 's' : ''}
        {filtered.length > 0 &&
          (() => {
            const priced = filtered.filter(
              t => t.valuationStatus === 'priced'
            ).length
            const unpriced = filtered.filter(
              t => t.valuationStatus === 'unpriced'
            ).length
            const unavail = filtered.filter(
              t => t.valuationStatus === 'unavailable'
            ).length
            return (
              <span className="ml-2">
                ({priced} priced
                {unpriced > 0 && (
                  <>
                    ,{' '}
                    <span className="text-[#647D8B]">
                      {unpriced} awaiting prices
                    </span>
                  </>
                )}
                {unavail > 0 && (
                  <>
                    ,{' '}
                    <span className="text-amber-600 dark:text-amber-400">
                      {unavail} price unavailable
                    </span>
                  </>
                )}
                )
              </span>
            )
          })()}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#EAF3F2] dark:bg-[#11202B] border-b border-[rgba(95,227,192,0.15)]">
                <QueueHeaderRow />
              </thead>
              <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
                {filtered.map(tx => (
                  <QueueRow
                    key={tx.id}
                    tx={tx}
                    busy={processingId === tx.id}
                    onAutoClassify={handleAutoClassify}
                    onManualClassify={handleManualClassify}
                    onIgnore={handleIgnoreClick}
                  />
                ))}
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
        <IgnoreDialog
          hash={ignoreModal.hash}
          reason={ignoreReason}
          busy={processingId === ignoreModal.transactionId}
          onReasonChange={handleReasonChange}
          onConfirm={handleIgnoreConfirm}
          onCancel={handleIgnoreCancel}
        />
      )}

      {/* Manual classification drawer (Phase 3 JournalEntryDrawer) */}
      {drawerTx !== null && (
        <JournalEntryDrawer
          accounts={accounts}
          transactionRef={drawerTx.transactionHash}
          rawTransactionId={drawerTx.id}
          initialDescription={`${displayTxType(drawerTx.transactionType)} on ${drawerTx.chainId} (${truncateHash(drawerTx.transactionHash)})`}
          onClose={handleDrawerClose}
          onSaved={handleDrawerSaved}
        />
      )}
    </div>
  )
}

export default ClassificationQueue
