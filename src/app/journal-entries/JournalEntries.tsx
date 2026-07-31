import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Link2,
  CheckSquare,
  Square,
  MinusSquare,
  Undo2,
} from 'lucide-react'
import { useNavBadges } from '../../contexts/NavBadgeContext'
import { useAuth } from '../../contexts/AuthContext'
import type { JournalEntryWithLines, GLAccount } from '../../types/database'
import JournalEntryDrawer from './JournalEntryDrawer'
import JournalEntryDetail from './JournalEntryDetail'
import {
  displayStatus as displayStatusUtil,
  formatDate,
  formatDateTime,
  minorToDollars,
} from './journalEntryUtils'

type StatusFilter = 'all' | 'draft' | 'approved' | 'posted' | 'voided'

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: Clock,
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  approved: {
    label: 'Approved',
    icon: ShieldCheck,
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  posted: {
    label: 'Posted',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  voided: {
    label: 'Voided',
    icon: XCircle,
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  },
} as const

const originLabels: Record<string, string> = {
  manual: 'Manual',
  rule: 'Rule',
  model: 'Model',
}

/**
 * Status badge pill for journal entry lifecycle states.
 * @param props - Component properties
 * @param props.status - The lifecycle status to render
 * @returns A styled status badge element
 */
const StatusBadge: React.FC<{ status: keyof typeof statusConfig }> = ({
  status,
}) => {
  const cfg = statusConfig[status]
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

/**
 * Maps the database status field to a display status key.
 * @param entry - Journal entry to inspect
 * @returns The display status key
 */
function displayStatus(
  entry: JournalEntryWithLines
): keyof typeof statusConfig {
  return displayStatusUtil(entry.status)
}

/**
 * Journal Entries approval queue page.
 * Lists entries by lifecycle status with filters and per-row actions
 * wired to the Tauri backend commands.
 * @returns The JournalEntries page component
 */
const JournalEntries: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = (searchParams.get('filter') ?? 'all') as StatusFilter
  const [entries, setEntries] = useState<JournalEntryWithLines[]>([])
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<
    JournalEntryWithLines | undefined
  >()
  const [detailEntry, setDetailEntry] = useState<
    JournalEntryWithLines | undefined
  >()
  const [voidConfirmId, setVoidConfirmId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)
  const { refreshCounts } = useNavBadges()
  const { user } = useAuth()

  const accountMap = useMemo(() => {
    const accountMapById = new Map<number, GLAccount>()
    accounts.forEach(account => accountMapById.set(account.id, account))
    return accountMapById
  }, [accounts])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      // Backend buckets: 'draft' = unposted (drafts AND approved), 'posted',
      // 'void'. 'approved' has no backend bucket, so fetch the unposted
      // bucket and let the exact client-side status filter narrow it.
      const statusFilter =
        filterParam === 'all'
          ? null
          : filterParam === 'voided'
            ? 'void'
            : filterParam === 'approved'
              ? 'draft'
              : filterParam
      // Tauri command args are camelCase on the JS side by default.
      const result = await invoke<JournalEntryWithLines[]>(
        'get_journal_entries',
        { statusFilter, limit: 200, offset: 0 }
      )
      setEntries(result)
    } catch (err) {
      console.error('Failed to fetch journal entries:', err)
    } finally {
      setLoading(false)
    }
  }, [filterParam])

  const fetchAccounts = useCallback(async () => {
    try {
      const result = await invoke<GLAccount[]>('get_chart_of_accounts')
      setAccounts(result)
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
    fetchAccounts()
  }, [fetchEntries, fetchAccounts])

  /** Filter entries by search query */
  const filteredEntries = useMemo(() => {
    let list = entries
    if (filterParam !== 'all') {
      list = list.filter(entry => displayStatus(entry) === filterParam)
    }
    if (!searchQuery) return list
    const lowerCaseQuery = searchQuery.toLowerCase()
    return list.filter(
      entry =>
        entry.description?.toLowerCase().includes(lowerCaseQuery) ||
        entry.entryNumber?.toLowerCase().includes(lowerCaseQuery) ||
        entry.referenceNumber?.toLowerCase().includes(lowerCaseQuery)
    )
  }, [entries, searchQuery, filterParam])

  const handleTabChange = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const tab = event.currentTarget.dataset.tab as StatusFilter | undefined
      if (!tab) return
      setSearchParams({ filter: tab })
      setSelectedIds(new Set())
    },
    [setSearchParams]
  )

  const handleToggleExpand = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (Number.isNaN(id)) return
      setExpandedId(prev => (prev === id ? null : id))
    },
    []
  )

  // skipcq: JS-W1042 — undefined is the required value (React setState), not a trailing optional
  const clearEditingEntry = useCallback(() => setEditingEntry(undefined), [])

  const handleNewEntry = useCallback(() => {
    clearEditingEntry()
    setDrawerOpen(true)
  }, [clearEditingEntry])

  const handleEditEntry = useCallback((entry: JournalEntryWithLines) => {
    setEditingEntry(entry)
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
    clearEditingEntry()
  }, [clearEditingEntry])

  const handleSaved = useCallback(() => {
    setDrawerOpen(false)
    clearEditingEntry()
    fetchEntries()
    refreshCounts()
  }, [clearEditingEntry, fetchEntries, refreshCounts])

  const handleViewDetail = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (Number.isNaN(id)) return
      const entry = entries.find(e => e.id === id)
      if (entry) setDetailEntry(entry)
    },
    [entries]
  )

  const handleCloseDetail = useCallback(() => {
    // skipcq: JS-W1042 — undefined is the required value (React setState), not a trailing optional
    setDetailEntry(undefined)
  }, [])

  const handleApprove = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (Number.isNaN(id)) return
      setActionError(null)
      try {
        await invoke('approve_journal_entry', {
          id,
          approver: user?.email ?? user?.display_name ?? 'unknown',
        })
        fetchEntries()
        refreshCounts()
      } catch (err) {
        const msg = typeof err === 'string' ? err : 'Failed to approve entry'
        setActionError(msg)
      }
    },
    [fetchEntries, refreshCounts, user]
  )

  const handlePost = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (Number.isNaN(id)) return
      setActionError(null)
      try {
        await invoke('post_journal_entry', { id })
        fetchEntries()
        refreshCounts()
      } catch (err) {
        const msg = typeof err === 'string' ? err : 'Failed to post entry'
        setActionError(msg)
      }
    },
    [fetchEntries, refreshCounts]
  )

  const handleVoid = useCallback(
    async (id: number) => {
      setActionError(null)
      try {
        await invoke('void_journal_entry', { id })
        setVoidConfirmId(null)
        fetchEntries()
        refreshCounts()
      } catch (err) {
        const msg = typeof err === 'string' ? err : 'Failed to void entry'
        setActionError(msg)
      }
    },
    [fetchEntries, refreshCounts]
  )

  /**
   * Demote an approved entry back to draft for editing.
   * Uses the dedicated backend command: the DB state machine allows
   * approved -> draft directly. (void_journal_entry only accepts POSTED
   * entries and creates a posted reversal — wrong tool for an unposted
   * approved entry.)
   */
  const handleDemote = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (Number.isNaN(id)) return
      setActionError(null)
      try {
        const demoted = await invoke<JournalEntryWithLines>(
          'demote_journal_entry',
          { id }
        )
        fetchEntries()
        refreshCounts()
        handleEditEntry(demoted)
      } catch (err) {
        const msg = typeof err === 'string' ? err : 'Failed to demote entry'
        setActionError(msg)
      }
    },
    [fetchEntries, refreshCounts, handleEditEntry]
  )

  const handleDismissError = useCallback(() => setActionError(null), [])

  const handleDismissVoidConfirm = useCallback(() => setVoidConfirmId(null), [])

  const handleStopPropagation = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement | HTMLDivElement>) => {
      event.stopPropagation()
    },
    []
  )

  const handleVoidClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (!Number.isNaN(id)) setVoidConfirmId(id)
    },
    []
  )

  const handleConfirmVoid = useCallback(() => {
    if (voidConfirmId !== null) handleVoid(voidConfirmId)
  }, [voidConfirmId, handleVoid])

  const selectableEntries = useMemo(
    () =>
      filteredEntries.filter(
        e => displayStatus(e) === 'draft' || displayStatus(e) === 'approved'
      ),
    [filteredEntries]
  )

  const draftEntries = useMemo(
    () => filteredEntries.filter(e => displayStatus(e) === 'draft'),
    [filteredEntries]
  )

  const approvedEntries = useMemo(
    () => filteredEntries.filter(e => displayStatus(e) === 'approved'),
    [filteredEntries]
  )

  const selectedDraftCount = draftEntries.filter(e =>
    selectedIds.has(e.id)
  ).length
  const selectedApprovedCount = approvedEntries.filter(e =>
    selectedIds.has(e.id)
  ).length
  const selectedCount = filteredEntries.filter(e =>
    selectedIds.has(e.id)
  ).length

  const allSelectableSelected =
    selectableEntries.length > 0 &&
    selectableEntries.every(e => selectedIds.has(e.id))
  const someSelected =
    selectableEntries.some(e => selectedIds.has(e.id)) && !allSelectableSelected

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (selectableEntries.every(e => prev.has(e.id))) {
        const next = new Set(prev)
        selectableEntries.forEach(e => next.delete(e.id))
        return next
      }
      const next = new Set(prev)
      selectableEntries.forEach(e => next.add(e.id))
      return next
    })
  }, [selectableEntries])

  const handleToggleSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(event.currentTarget.dataset.entryid)
      if (Number.isNaN(id)) return
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    []
  )

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleBatchApprove = useCallback(async () => {
    const ids = draftEntries.filter(e => selectedIds.has(e.id)).map(e => e.id)
    if (ids.length === 0) return

    setBatchProcessing(true)
    setActionError(null)
    const approver = user?.email ?? user?.display_name ?? 'unknown'

    let failed = 0
    for (const id of ids) {
      try {
        await invoke('approve_journal_entry', { id, approver })
      } catch {
        failed++
      }
    }

    setSelectedIds(new Set())
    setBatchProcessing(false)
    fetchEntries()
    refreshCounts()

    if (failed > 0) {
      setActionError(
        `${failed} entr${failed !== 1 ? 'ies' : 'y'} failed to approve`
      )
    }
  }, [draftEntries, selectedIds, user, fetchEntries, refreshCounts])

  const handleBatchDemote = useCallback(async () => {
    const ids = approvedEntries
      .filter(e => selectedIds.has(e.id))
      .map(e => e.id)
    if (ids.length === 0) return

    setBatchProcessing(true)
    setActionError(null)

    let failed = 0
    for (const id of ids) {
      try {
        await invoke('demote_journal_entry', { id })
      } catch {
        failed++
      }
    }

    setSelectedIds(new Set())
    setBatchProcessing(false)
    fetchEntries()
    refreshCounts()

    if (failed > 0) {
      setActionError(
        `${failed} entr${failed !== 1 ? 'ies' : 'y'} failed to revert`
      )
    }
  }, [approvedEntries, selectedIds, fetchEntries, refreshCounts])

  const resolveAccountName = useCallback(
    (glAccountId: number) => {
      const acct = accountMap.get(glAccountId)
      return acct
        ? `${acct.accountNumber} \u00b7 ${acct.accountName}`
        : `#${glAccountId}`
    },
    [accountMap]
  )

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'approved', label: 'Approved' },
    { key: 'posted', label: 'Posted' },
    { key: 'voided', label: 'Voided' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
            Journal Entries
          </h1>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Approval queue &middot; draft &rarr; approve &rarr; post
          </p>
        </div>
        <button
          onClick={handleNewEntry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Journal Entry</span>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-[rgba(95,227,192,0.15)]">
        {tabs.map(tab => (
          <button
            key={tab.key}
            data-tab={tab.key}
            onClick={handleTabChange}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filterParam === tab.key
                ? 'border-[#294050] text-[#294050] dark:text-[#5FE3C0]'
                : 'border-transparent text-[#294050] dark:text-[#9FB4BE] hover:text-[#11202B] dark:hover:text-[#EAF3F2]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          <span>{actionError}</span>
          <button
            onClick={handleDismissError}
            className="ml-4 text-red-500 hover:text-red-700 dark:hover:text-red-200 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Void confirmation dialog */}
      {voidConfirmId !== null && (
        <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
          <span>
            Voiding this entry will generate a reversing entry that nets it to
            zero in the ledger. The original and reversing entries both remain
            visible. Continue?
          </span>
          <div className="flex gap-2 ml-4">
            <button
              onClick={handleDismissVoidConfirm}
              className="px-3 py-1 text-xs font-medium rounded border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmVoid}
              className="px-3 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Void Entry
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#647D8B]" />
        <input
          type="text"
          placeholder="Search entries..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-4 pr-10 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] text-sm focus:outline-none focus:ring-1 focus:ring-[#5FE3C0]"
        />
      </div>

      {/* Batch action toolbar */}
      {selectedCount > 0 && (
        <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-[#294050]/5 dark:bg-[#294050]/20 border border-[rgba(95,227,192,0.15)]">
          <span className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">
            {selectedDraftCount > 0 && (
              <button
                onClick={handleBatchApprove}
                disabled={batchProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Approve {selectedDraftCount} Draft
                {selectedDraftCount !== 1 ? 's' : ''}
              </button>
            )}
            {selectedApprovedCount > 0 && (
              <button
                onClick={handleBatchDemote}
                disabled={batchProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                Revert {selectedApprovedCount} to Draft
              </button>
            )}
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 text-sm text-[#647D8B] hover:text-[#11202B] dark:hover:text-[#EAF3F2] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#294050]" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="w-12 h-12 text-[#647D8B] mb-4" />
          <h3 className="text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No journal entries
          </h3>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Create your first entry or classify a transaction.
          </p>
        </div>
      ) : (
        <div className="border border-[rgba(95,227,192,0.15)] rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[#EAF3F2] dark:bg-[#16242F]">
                <th className="w-10 px-4 py-3 text-center">
                  {selectableEntries.length > 0 && (
                    <button
                      onClick={handleToggleSelectAll}
                      className="p-0.5 hover:bg-[#294050]/10 dark:hover:bg-[#294050]/20 rounded transition-colors"
                      title={
                        allSelectableSelected
                          ? 'Deselect all'
                          : 'Select all drafts & approved'
                      }
                    >
                      {allSelectableSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#5FE3C0]" />
                      ) : someSelected ? (
                        <MinusSquare className="w-4 h-4 text-[#5FE3C0]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#294050] dark:text-[#9FB4BE]" />
                      )}
                    </button>
                  )}
                </th>
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Entry #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Origin
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Debits
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
              {filteredEntries.map(entry => {
                const status = displayStatus(entry)
                const totalDebits = entry.lines.reduce(
                  (sum, l) => sum + l.debitMinor,
                  0
                )
                const totalCredits = entry.lines.reduce(
                  (sum, l) => sum + l.creditMinor,
                  0
                )
                const isExpanded = expandedId === entry.id

                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      data-entryid={entry.id}
                      className={`bg-white dark:bg-[#11202B] hover:bg-[#EAF3F2]/50 dark:hover:bg-[#16242F]/50 cursor-pointer transition-colors ${selectedIds.has(entry.id) ? 'bg-[#5FE3C0]/5 dark:bg-[#5FE3C0]/5' : ''}`}
                      onClick={handleToggleExpand}
                    >
                      <td
                        className="px-4 py-3 text-center"
                        onClick={handleStopPropagation}
                      >
                        {(status === 'draft' || status === 'approved') && (
                          <button
                            data-entryid={entry.id}
                            onClick={handleToggleSelect}
                            className="p-0.5 hover:bg-[#294050]/10 rounded transition-colors"
                          >
                            {selectedIds.has(entry.id) ? (
                              <CheckSquare className="w-4 h-4 text-[#5FE3C0]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#647D8B]" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#294050]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#294050]" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#11202B] dark:text-[#EAF3F2] whitespace-nowrap">
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[#294050] dark:text-[#9FB4BE]">
                        {entry.entryNumber ?? '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#11202B] dark:text-[#EAF3F2] max-w-xs truncate">
                        {entry.description ?? '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#294050] dark:text-[#9FB4BE]">
                        {originLabels[entry.origin] ?? entry.origin}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {minorToDollars(totalDebits)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {minorToDollars(totalCredits)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={handleStopPropagation}
                        >
                          {status === 'draft' && (
                            <button
                              data-entryid={entry.id}
                              onClick={handleApprove}
                              className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {status === 'approved' && (
                            <>
                              <button
                                data-entryid={entry.id}
                                onClick={handlePost}
                                className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                              >
                                Post
                              </button>
                              <button
                                data-entryid={entry.id}
                                onClick={handleDemote}
                                className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                              >
                                Demote
                              </button>
                            </>
                          )}
                          {status === 'posted' && (
                            <button
                              data-entryid={entry.id}
                              onClick={handleVoidClick}
                              className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              Void
                            </button>
                          )}
                          <button
                            data-entryid={entry.id}
                            onClick={handleViewDetail}
                            className="px-2 py-1 text-xs font-medium rounded border border-[rgba(95,227,192,0.2)] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded line items */}
                    {isExpanded && entry.lines.length > 0 && (
                      <tr className="bg-[#F7FAFA] dark:bg-[#0C141B]">
                        <td colSpan={10} className="px-8 py-3">
                          {/* Provenance info */}
                          <div className="flex flex-wrap gap-4 mb-3 text-xs text-[#294050] dark:text-[#9FB4BE]">
                            <span>
                              Created by: {entry.createdBy ?? 'system'}
                            </span>
                            {entry.approvedBy && (
                              <span>
                                Approved by: {entry.approvedBy} (
                                {formatDateTime(entry.approvedAt)})
                              </span>
                            )}
                            {entry.postedAt && (
                              <span>
                                Posted: {formatDateTime(entry.postedAt)}
                              </span>
                            )}
                            {entry.referenceNumber && (
                              <span
                                className="font-mono inline-flex items-center gap-1"
                                title={entry.referenceNumber}
                              >
                                {entry.sourceTxId && (
                                  <Link2 className="w-3 h-3 text-emerald-500" />
                                )}
                                Ref:{' '}
                                {entry.referenceNumber.length > 20
                                  ? `${entry.referenceNumber.slice(0, 20)}\u2026`
                                  : entry.referenceNumber}
                              </span>
                            )}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs uppercase text-[#294050] dark:text-[#9FB4BE]">
                                <th className="text-left py-1 pr-4">Account</th>
                                <th className="text-right py-1 px-4 w-32">
                                  Debit
                                </th>
                                <th className="text-right py-1 px-4 w-32">
                                  Credit
                                </th>
                                <th className="text-left py-1 pl-4">Memo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map(line => (
                                <tr
                                  key={line.id}
                                  className="border-t border-[rgba(95,227,192,0.08)]"
                                >
                                  <td className="py-1.5 pr-4 text-[#11202B] dark:text-[#EAF3F2]">
                                    {resolveAccountName(line.glAccountId)}
                                  </td>
                                  <td className="py-1.5 px-4 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                                    {line.debitMinor > 0
                                      ? minorToDollars(line.debitMinor)
                                      : ''}
                                  </td>
                                  <td className="py-1.5 px-4 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                                    {line.creditMinor > 0
                                      ? minorToDollars(line.creditMinor)
                                      : ''}
                                  </td>
                                  <td className="py-1.5 pl-4 text-[#294050] dark:text-[#9FB4BE]">
                                    {line.description ?? ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Journal Entry Creation/Edit Drawer */}
      {drawerOpen && (
        <JournalEntryDrawer
          accounts={accounts}
          entry={editingEntry}
          onClose={handleCloseDrawer}
          onSaved={handleSaved}
        />
      )}

      {/* Entry Detail View */}
      {detailEntry !== undefined && (
        <JournalEntryDetail
          entry={detailEntry}
          accounts={accounts}
          entries={entries}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}

export default JournalEntries
