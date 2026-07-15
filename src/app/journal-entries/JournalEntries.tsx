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
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useNavBadges } from '../../contexts/NavBadgeContext'
import type { JournalEntryWithLines, GLAccount } from '../../types/database'
import JournalEntryDrawer from './JournalEntryDrawer'

type StatusFilter = 'all' | 'draft' | 'posted' | 'void'

/** Derives a display status from the lifecycle status column */
function getEntryStatus(
  entry: JournalEntryWithLines
): 'draft' | 'posted' | 'void' {
  if (entry.status === 'voided') return 'void'
  if (entry.status === 'posted') return 'posted'
  return 'draft'
}

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: Clock,
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  posted: {
    label: 'Posted',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  void: {
    label: 'Void',
    icon: XCircle,
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  },
}

/** Status badge pill */
const StatusBadge: React.FC<{ status: 'draft' | 'posted' | 'void' }> = ({
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

/** Formats a date string for display */
function formatDate(d: string | Date | undefined | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Journal Entries list page */
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
  const { refreshCounts } = useNavBadges()

  const accountMap = useMemo(() => {
    const m = new Map<number, GLAccount>()
    accounts.forEach(a => m.set(a.id, a))
    return m
  }, [accounts])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const statusFilter = filterParam === 'all' ? null : filterParam
      const result = await invoke<JournalEntryWithLines[]>(
        'get_journal_entries',
        { status_filter: statusFilter, limit: 200, offset: 0 }
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

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter(
      e =>
        e.description?.toLowerCase().includes(q) ||
        e.entryNumber?.toLowerCase().includes(q) ||
        e.referenceNumber?.toLowerCase().includes(q)
    )
  }, [entries, searchQuery])

  const handleTabChange = useCallback(
    (tab: StatusFilter) => {
      setSearchParams({ filter: tab })
    },
    [setSearchParams]
  )

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId(prev => (prev === id ? null : id))
  }, [])

  const clearEditingEntry = useCallback(() => setEditingEntry(undefined), []) // skipcq: JS-W1042 — React setState requires explicit argument

  const handleNewEntry = useCallback(() => {
    clearEditingEntry()
    setDrawerOpen(true)
  }, [clearEditingEntry])

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

  const handlePost = useCallback(
    async (id: number) => {
      setActionError(null)
      try {
        await invoke('post_journal_entry', { id })
        fetchEntries()
        refreshCounts()
      } catch (err) {
        const msg = typeof err === 'string' ? err : 'Failed to post entry'
        console.error('Failed to post entry:', err)
        setActionError(msg)
      }
    },
    [fetchEntries, refreshCounts]
  )

  const handleVoid = useCallback(
    async (id: number) => {
      try {
        await invoke('void_journal_entry', { id })
        fetchEntries()
        refreshCounts()
      } catch (err) {
        console.error('Failed to void entry:', err)
      }
    },
    [fetchEntries, refreshCounts]
  )

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'posted', label: 'Posted' },
  ]

  const resolveAccountName = (glAccountId: number) => {
    const acct = accountMap.get(glAccountId)
    return acct
      ? `${acct.accountNumber} · ${acct.accountName}`
      : `#${glAccountId}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
            Journal Entries
          </h1>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Double-entry bookkeeping records
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
            onClick={() => handleTabChange(tab.key)}
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
            onClick={() => setActionError(null)}
            className="ml-4 text-red-500 hover:text-red-700 dark:hover:text-red-200 font-medium"
          >
            Dismiss
          </button>
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
                  Reference
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
                const status = getEntryStatus(entry)
                const totalDebits = entry.lines.reduce(
                  (sum, l) => sum + l.debitMinor,
                  0
                )
                const totalCredits = entry.lines.reduce(
                  (sum, l) => sum + l.creditMinor,
                  0
                )
                const isExpanded = expandedId === entry.id
                const refDisplay = entry.referenceNumber
                  ? entry.referenceNumber.length > 12
                    ? `${entry.referenceNumber.slice(0, 12)}…`
                    : entry.referenceNumber
                  : '—'

                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="bg-white dark:bg-[#11202B] hover:bg-[#EAF3F2]/50 dark:hover:bg-[#16242F]/50 cursor-pointer transition-colors"
                      onClick={() => handleToggleExpand(entry.id)}
                    >
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
                        {entry.entryNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#11202B] dark:text-[#EAF3F2] max-w-xs truncate">
                        {entry.description ?? '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-mono text-[#294050] dark:text-[#9FB4BE]"
                        title={entry.referenceNumber ?? undefined}
                      >
                        {refDisplay}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {(totalDebits / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {(totalCredits / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {status === 'draft' && (
                            <button
                              onClick={() => handlePost(entry.id)}
                              className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            >
                              Post
                            </button>
                          )}
                          {status === 'posted' && (
                            <button
                              onClick={() => handleVoid(entry.id)}
                              className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded line items */}
                    {isExpanded && entry.lines.length > 0 && (
                      <tr className="bg-[#F7FAFA] dark:bg-[#0C141B]">
                        <td colSpan={9} className="px-8 py-3">
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
                                      ? (line.debitMinor / 100).toFixed(2)
                                      : ''}
                                  </td>
                                  <td className="py-1.5 px-4 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                                    {line.creditMinor > 0
                                      ? (line.creditMinor / 100).toFixed(2)
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

      {/* Journal Entry Creation Drawer */}
      {drawerOpen && (
        <JournalEntryDrawer
          accounts={accounts}
          entry={editingEntry}
          onClose={handleCloseDrawer}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

export default JournalEntries
