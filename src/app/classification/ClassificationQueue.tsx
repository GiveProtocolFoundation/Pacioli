import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Zap,
  FileEdit,
  EyeOff,
  Inbox,
  RefreshCw,
  DollarSign,
  CheckSquare,
  Square,
  MinusSquare,
  Filter,
  ShieldCheck,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { useNavBadges } from '../../contexts/NavBadgeContext'
import { useAuth } from '../../contexts/AuthContext'
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
  rulePreview,
} from './classificationUtils'

interface IgnoreModal {
  transactionId: string
  hash: string
}

interface BatchResult {
  classified: number
  skipped: number
  failed: number
  journalEntryIds: number[]
}

const HEADER_CELL =
  'px-4 py-3 text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider'

/** @returns Header row with select-all checkbox for the classification queue table. */
const QueueHeaderRow: React.FC<{
  allSelected: boolean
  someSelected: boolean
  onToggleAll: () => void
}> = ({ allSelected, someSelected, onToggleAll }) => (
  <tr>
    <th className={`${HEADER_CELL} w-10 text-center`}>
      <button
        onClick={onToggleAll}
        className="p-0.5 hover:bg-[#294050]/10 dark:hover:bg-[#294050]/20 rounded transition-colors"
        title={allSelected ? 'Deselect all' : 'Select all'}
      >
        {allSelected ? (
          <CheckSquare className="w-4 h-4 text-[#5FE3C0]" />
        ) : someSelected ? (
          <MinusSquare className="w-4 h-4 text-[#5FE3C0]" />
        ) : (
          <Square className="w-4 h-4" />
        )}
      </button>
    </th>
    <th className={`${HEADER_CELL} text-left`}>Chain</th>
    <th className={`${HEADER_CELL} text-left`}>Hash</th>
    <th className={`${HEADER_CELL} text-left`}>Type</th>
    <th className={`${HEADER_CELL} text-left`}>Rule</th>
    <th className={`${HEADER_CELL} text-right`}>Qty</th>
    <th className={`${HEADER_CELL} text-right`}>USD Value</th>
    <th className={`${HEADER_CELL} text-right`}>Fee</th>
    <th className={`${HEADER_CELL} text-left`}>Timestamp</th>
    <th className={`${HEADER_CELL} text-center`}>Actions</th>
  </tr>
)

interface QueueRowProps {
  tx: RawTransaction
  selected: boolean
  busy: boolean
  onToggleSelect: (event: React.MouseEvent<HTMLButtonElement>) => void
  onAutoClassify: (event: React.MouseEvent<HTMLButtonElement>) => void
  onManualClassify: (event: React.MouseEvent<HTMLButtonElement>) => void
  onIgnore: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/** @returns Single transaction row with action buttons (auto, manual, skip). */
const QueueRow: React.FC<QueueRowProps> = ({
  tx,
  selected,
  busy,
  onToggleSelect,
  onAutoClassify,
  onManualClassify,
  onIgnore,
}) => (
  <tr
    className={`hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] ${selected ? 'bg-[#5FE3C0]/5 dark:bg-[#5FE3C0]/5' : ''}`}
  >
    <td className="px-4 py-3 text-center">
      <button
        data-txid={tx.id}
        onClick={onToggleSelect}
        className="p-0.5 hover:bg-[#294050]/10 rounded transition-colors"
      >
        {selected ? (
          <CheckSquare className="w-4 h-4 text-[#5FE3C0]" />
        ) : (
          <Square className="w-4 h-4 text-[#647D8B]" />
        )}
      </button>
    </td>
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
    <td className="px-4 py-3 whitespace-nowrap text-xs text-[#647D8B] dark:text-[#647D8B] max-w-[200px] truncate">
      <span title={rulePreview(tx.transactionType)}>
        {rulePreview(tx.transactionType)}
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

interface IgnoreDialogProps {
  hash: string
  reason: string
  busy: boolean
  onReasonChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onConfirm: () => void
  onCancel: () => void
}

/** @returns Confirmation modal for skipping/ignoring a transaction. */
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

interface BatchResultBannerProps {
  result: BatchResult
  processing: boolean
  onApprove: () => void
  onNavigateDrafts: () => void
  onDismiss: () => void
}

/** @returns Success banner after batch classify/skip with approve + navigate actions. */
const BatchResultBanner: React.FC<BatchResultBannerProps> = ({
  result,
  processing,
  onApprove,
  onNavigateDrafts,
  onDismiss,
}) => {
  if (result.classified === 0 && result.skipped === 0) return null
  return (
    <div className="mb-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
      <div className="flex items-center justify-between">
        <div className="text-sm text-emerald-800 dark:text-emerald-300">
          {result.classified > 0 && (
            <span>
              {result.classified} transaction
              {result.classified !== 1 ? 's' : ''} classified into draft journal{' '}
              {result.classified !== 1 ? 'entries' : 'entry'}.
            </span>
          )}
          {result.skipped > 0 && (
            <span>
              {result.skipped} transaction
              {result.skipped !== 1 ? 's' : ''} skipped.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result.journalEntryIds.length > 0 && (
            <button
              onClick={onApprove}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Approve {result.journalEntryIds.length} Draft
              {result.journalEntryIds.length !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={onNavigateDrafts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            View Drafts
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDismiss}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

/** @returns Inline summary of priced/unpriced/unavailable counts. */
const ValuationSummary: React.FC<{ transactions: RawTransaction[] }> = ({
  transactions,
}) => {
  const priced = transactions.filter(
    t => t.valuationStatus === 'priced'
  ).length
  const unpriced = transactions.filter(
    t => t.valuationStatus === 'unpriced'
  ).length
  const unavail = transactions.filter(
    t => t.valuationStatus === 'unavailable'
  ).length
  return (
    <span className="ml-2">
      ({priced} priced
      {unpriced > 0 && (
        <>
          ,{' '}
          <span className="text-[#647D8B]">{unpriced} awaiting prices</span>
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
}

/** @returns Main classification queue page with batch operations and filtering. */
const ClassificationQueue: React.FC = () => {
  const navigate = useNavigate()
  const { refreshCounts } = useNavBadges()
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<RawTransaction[]>([])
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [drawerTx, setDrawerTx] = useState<RawTransaction | null>(null)

  const [ignoreModal, setIgnoreModal] = useState<IgnoreModal | null>(null)
  const [ignoreReason, setIgnoreReason] = useState('')

  const [enriching, setEnriching] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)

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
      setSelectedIds(new Set())
      setBatchResult(null)
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

  const uniqueChains = useMemo(
    () => [...new Set(filtered.map(tx => tx.chainId))].sort(),
    [filtered]
  )
  const uniqueTypes = useMemo(
    () => [...new Set(filtered.map(tx => tx.transactionType))].sort(),
    [filtered]
  )

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(tx => selectedIds.has(tx.id))
  const someFilteredSelected =
    filtered.some(tx => selectedIds.has(tx.id)) && !allFilteredSelected

  const selectedCount = filtered.filter(tx => selectedIds.has(tx.id)).length

  const handleToggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (filtered.every(tx => prev.has(tx.id))) {
        const next = new Set(prev)
        filtered.forEach(tx => next.delete(tx.id))
        return next
      }
      const next = new Set(prev)
      filtered.forEach(tx => next.add(tx.id))
      return next
    })
  }, [filtered])

  const handleToggleSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.txid
      if (!id) return
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    []
  )

  const handleSelectByChain = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const chain = event.currentTarget.dataset.chain
      if (!chain) return
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered
          .filter(tx => tx.chainId === chain)
          .forEach(tx => next.add(tx.id))
        return next
      })
      setFilterMenuOpen(false)
    },
    [filtered]
  )

  const handleSelectByType = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const txType = event.currentTarget.dataset.txtype
      if (!txType) return
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered
          .filter(tx => tx.transactionType === txType)
          .forEach(tx => next.add(tx.id))
        return next
      })
      setFilterMenuOpen(false)
    },
    [filtered]
  )

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBatchAutoClassify = useCallback(async () => {
    const ids = filtered.filter(tx => selectedIds.has(tx.id)).map(tx => tx.id)
    if (ids.length === 0) return

    setBatchProcessing(true)
    setBatchProgress({ done: 0, total: ids.length })
    setActionError(null)

    let classified = 0
    let failed = 0
    const journalEntryIds: number[] = []
    const classifiedTxIds: string[] = []

    for (const txId of ids) {
      try {
        const je = await invoke<JournalEntryWithLines>(
          'auto_classify_transaction',
          { transactionId: txId }
        )
        classified++
        classifiedTxIds.push(txId)
        journalEntryIds.push(je.id)
      } catch {
        failed++
      }
      setBatchProgress({ done: classified + failed, total: ids.length })
    }

    setTransactions(prev => prev.filter(t => !classifiedTxIds.includes(t.id)))
    setSelectedIds(new Set())
    refreshCounts()
    setBatchProcessing(false)
    setBatchProgress(null)
    setBatchResult({ classified, skipped: 0, failed, journalEntryIds })

    if (failed > 0) {
      setActionError(
        `${failed} transaction${failed !== 1 ? 's' : ''} failed to auto-classify (may need price enrichment or manual classification)`
      )
    }
  }, [filtered, selectedIds, refreshCounts])

  const handleBatchSkip = useCallback(async () => {
    const ids = filtered.filter(tx => selectedIds.has(tx.id)).map(tx => tx.id)
    if (ids.length === 0) return

    setBatchProcessing(true)
    setBatchProgress({ done: 0, total: ids.length })
    setActionError(null)

    let skipped = 0
    let failed = 0
    const skippedTxIds: string[] = []

    for (const txId of ids) {
      try {
        await invoke('ignore_transaction', {
          transactionId: txId,
          reason: null,
        })
        skipped++
        skippedTxIds.push(txId)
      } catch {
        failed++
      }
      setBatchProgress({ done: skipped + failed, total: ids.length })
    }

    setTransactions(prev => prev.filter(t => !skippedTxIds.includes(t.id)))
    setSelectedIds(new Set())
    refreshCounts()
    setBatchProcessing(false)
    setBatchProgress(null)
    setBatchResult({
      classified: 0,
      skipped,
      failed,
      journalEntryIds: [],
    })

    if (failed > 0) {
      setActionError(
        `${failed} transaction${failed !== 1 ? 's' : ''} failed to skip`
      )
    }
  }, [filtered, selectedIds, refreshCounts])

  const handleBatchApprove = useCallback(async () => {
    if (!batchResult || batchResult.journalEntryIds.length === 0) return

    setBatchProcessing(true)
    setActionError(null)
    const approver = user?.email ?? user?.display_name ?? 'unknown'

    let approvedCount = 0
    let failed = 0

    for (const id of batchResult.journalEntryIds) {
      try {
        await invoke('approve_journal_entry', { id, approver })
        approvedCount++
      } catch {
        failed++
      }
    }

    refreshCounts()
    setBatchProcessing(false)
    setBatchResult(prev =>
      prev
        ? {
            ...prev,
            journalEntryIds: [],
          }
        : null
    )

    if (failed > 0) {
      setActionError(`${approvedCount} approved, ${failed} failed`)
    } else {
      setActionError(null)
    }

    setBatchResult(prev =>
      prev
        ? {
            ...prev,
            classified: 0,
            journalEntryIds: [],
          }
        : null
    )
  }, [batchResult, user, refreshCounts])

  const handleDismissBatchResult = useCallback(() => {
    setBatchResult(null)
  }, [])

  const handleNavigateToDrafts = useCallback(() => {
    navigate('/journal-entries?filter=draft')
  }, [navigate])

  const handleNavigateToReports = useCallback(() => {
    navigate('/reports')
  }, [navigate])

  const handleToggleFilterMenu = useCallback(() => {
    setFilterMenuOpen(prev => !prev)
  }, [])

  const handleCloseFilterMenu = useCallback(() => {
    setFilterMenuOpen(false)
  }, [])

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

      {/* Batch result banner */}
      {batchResult !== null && (
        <BatchResultBanner
          result={batchResult}
          processing={batchProcessing}
          onApprove={handleBatchApprove}
          onNavigateDrafts={handleNavigateToDrafts}
          onDismiss={handleDismissBatchResult}
        />
      )}

      {/* Search + filter row */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#647D8B]" />
          <input
            type="text"
            placeholder="Search by hash, chain, type, address..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-4 pr-10 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] dark:placeholder-[#294050] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0]"
          />
        </div>
        {filtered.length > 0 && (
          <div className="relative">
            <button
              onClick={handleToggleFilterMenu}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
            >
              <Filter className="w-4 h-4" />
              Select by...
            </button>
            {filterMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={handleCloseFilterMenu}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg shadow-lg py-1">
                  {uniqueChains.length > 1 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-medium text-[#647D8B] uppercase tracking-wider">
                        By Chain
                      </div>
                      {uniqueChains.map(chain => (
                        <button
                          key={chain}
                          data-chain={chain}
                          onClick={handleSelectByChain}
                          className="w-full text-left px-3 py-1.5 text-sm text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
                        >
                          {chain} (
                          {filtered.filter(tx => tx.chainId === chain).length})
                        </button>
                      ))}
                    </>
                  )}
                  {uniqueTypes.length > 1 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-medium text-[#647D8B] uppercase tracking-wider border-t border-[rgba(95,227,192,0.1)] mt-1">
                        By Type
                      </div>
                      {uniqueTypes.map(txType => (
                        <button
                          key={txType}
                          data-txtype={txType}
                          onClick={handleSelectByType}
                          className="w-full text-left px-3 py-1.5 text-sm text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
                        >
                          {displayTxType(txType)} (
                          {
                            filtered.filter(tx => tx.transactionType === txType)
                              .length
                          }
                          )
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Batch action toolbar */}
      {selectedCount > 0 && (
        <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-[#294050]/5 dark:bg-[#294050]/20 border border-[rgba(95,227,192,0.15)]">
          <span className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchAutoClassify}
              disabled={batchProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#5FE3C0]/15 text-[#294050] dark:text-[#5FE3C0] hover:bg-[#5FE3C0]/25 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Auto-classify {selectedCount}
            </button>
            <button
              onClick={handleBatchSkip}
              disabled={batchProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
            >
              <EyeOff className="w-4 h-4" />
              Skip {selectedCount}
            </button>
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 text-sm text-[#647D8B] hover:text-[#11202B] dark:hover:text-[#EAF3F2] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Batch progress bar */}
      {batchProgress !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#294050] dark:text-[#9FB4BE]">
              Processing {batchProgress.done} of {batchProgress.total}...
            </span>
            <span className="text-xs font-mono text-[#647D8B]">
              {Math.round((batchProgress.done / batchProgress.total) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-[#294050]/10 dark:bg-[#294050]/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5FE3C0] rounded-full transition-all duration-300"
              style={{
                width: `${(batchProgress.done / batchProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Count summary */}
      <div className="mb-4 text-sm text-[#294050] dark:text-[#9FB4BE]">
        {filtered.length} unclassified transaction
        {filtered.length !== 1 ? 's' : ''}
        {filtered.length > 0 && (
          <ValuationSummary transactions={filtered} />
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#EAF3F2] dark:bg-[#11202B] border-b border-[rgba(95,227,192,0.15)]">
                <QueueHeaderRow
                  allSelected={allFilteredSelected}
                  someSelected={someFilteredSelected}
                  onToggleAll={handleToggleAll}
                />
              </thead>
              <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
                {filtered.map(tx => (
                  <QueueRow
                    key={tx.id}
                    tx={tx}
                    selected={selectedIds.has(tx.id)}
                    busy={processingId === tx.id || batchProcessing}
                    onToggleSelect={handleToggleSelect}
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
          <Inbox className="mx-auto h-12 w-12 text-[#5FE3C0]" />
          <h3 className="mt-3 text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            All caught up
          </h3>
          <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE] max-w-sm mx-auto">
            Every raw transaction has been classified or skipped. Your next step
            is to review and approve draft journal entries, then view your trial
            balance.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={handleNavigateToDrafts}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] transition-colors text-sm font-medium"
            >
              <ShieldCheck className="w-4 h-4" />
              Review Drafts
            </button>
            <button
              onClick={handleNavigateToReports}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors text-sm font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              View Trial Balance
            </button>
          </div>
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

      {/* Manual classification drawer */}
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
