import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  CalendarDays,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import type { AccountingPeriod } from '../../types/database'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, formatDateTime } from './accountingPeriodUtils'

const statusConfig = {
  open: {
    label: 'Open',
    icon: Clock,
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  closed: {
    label: 'Closed',
    icon: Lock,
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  },
} as const

interface ConfirmActionState {
  type: 'close' | 'reopen'
  periodId: number
  label: string
}

/**
 * Renders the open/closed status badge for a period.
 * @param props - Component props
 * @returns Status badge element
 */
const PeriodStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config =
    statusConfig[status as keyof typeof statusConfig] ?? statusConfig.open
  const StatusIcon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      <StatusIcon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

/**
 * Renders a single accounting-period table row with its close/reopen action.
 * @param props - Component props
 * @returns Table row element
 */
const PeriodRow: React.FC<{
  period: AccountingPeriod
  onRequestAction: (action: ConfirmActionState) => void
}> = ({ period, onRequestAction }) => {
  const rangeLabel = `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`
  const isOpen = period.status === 'open'

  const handleActionClick = useCallback(() => {
    onRequestAction({
      type: isOpen ? 'close' : 'reopen',
      periodId: period.id,
      label: rangeLabel,
    })
  }, [isOpen, onRequestAction, period.id, rangeLabel])

  return (
    <tr className="hover:bg-[#F7FAFA]/50 dark:hover:bg-[#0C141B]/30 transition-colors">
      <td className="px-4 py-3 text-[#294050] dark:text-[#EDF4F4] font-medium">
        {rangeLabel}
      </td>
      <td className="px-4 py-3">
        <PeriodStatusBadge status={period.status} />
      </td>
      <td className="px-4 py-3 text-[#294050]/60 dark:text-[#9FB4BE] text-xs">
        {period.closedBy ?? '\u2014'}
      </td>
      <td className="px-4 py-3 text-[#294050]/60 dark:text-[#9FB4BE] text-xs">
        {formatDateTime(period.closedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {isOpen ? (
          <button
            onClick={handleActionClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            Close
          </button>
        ) : (
          <button
            onClick={handleActionClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Unlock className="h-3.5 w-3.5" />
            Reopen
          </button>
        )}
      </td>
    </tr>
  )
}

/**
 * Renders the confirmation banner for a pending close/reopen action.
 * @param props - Component props
 * @returns Confirmation banner element
 */
const ConfirmActionBanner: React.FC<{
  action: ConfirmActionState
  onCancel: () => void
  onConfirm: () => void
}> = ({ action, onCancel, onConfirm }) => (
  <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
    <span>
      {action.type === 'close'
        ? `Close period ${action.label}? No more entries can be posted into this period until it is reopened.`
        : `Reopen period ${action.label}? This is an audit event — entries can be posted into this period again.`}
    </span>
    <div className="flex gap-2 ml-4">
      <button
        onClick={onCancel}
        className="px-3 py-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-medium"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className={`px-3 py-1 rounded font-medium text-white ${
          action.type === 'close'
            ? 'bg-amber-600 hover:bg-amber-700'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {action.type === 'close' ? 'Close Period' : 'Reopen Period'}
      </button>
    </div>
  </div>
)

/**
 * Renders the create-period form (start/end date inputs).
 * @param props - Component props
 * @returns Create form element
 */
const CreatePeriodForm: React.FC<{
  onCreate: (periodStart: string, periodEnd: string) => Promise<void>
  error: string | null
}> = ({ onCreate, error }) => {
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')

  const handleStartChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewStart(event.target.value)
    },
    []
  )

  const handleEndChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewEnd(event.target.value)
    },
    []
  )

  const handleSubmit = useCallback(() => {
    void onCreate(newStart, newEnd)
  }, [onCreate, newStart, newEnd])

  return (
    <div className="mb-6 p-4 rounded-lg border border-[rgba(95,227,192,0.2)] bg-white dark:bg-[#111B24]">
      <h3 className="text-sm font-semibold text-[#294050] dark:text-[#EDF4F4] mb-3">
        Create Accounting Period
      </h3>
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs text-[#294050]/60 dark:text-[#9FB4BE] mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={newStart}
            onChange={handleStartChange}
            className="w-full px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.2)] bg-white dark:bg-[#0C141B] text-[#294050] dark:text-[#EDF4F4] text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-[#294050]/60 dark:text-[#9FB4BE] mb-1">
            End Date
          </label>
          <input
            type="date"
            value={newEnd}
            onChange={handleEndChange}
            className="w-full px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.2)] bg-white dark:bg-[#0C141B] text-[#294050] dark:text-[#EDF4F4] text-sm"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!newStart || !newEnd}
          className="px-4 py-2 rounded-lg bg-[#294050] text-white hover:bg-[#1e3040] dark:bg-[#5FE3C0] dark:text-[#0C141B] dark:hover:bg-[#4dd3b0] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

/**
 * Renders the audit log of period reopen events.
 * @param props - Component props
 * @returns Audit log element, or null when no reopen events exist
 */
const ReopenAuditLog: React.FC<{ periods: AccountingPeriod[] }> = ({
  periods,
}) => {
  const reopened = periods.filter(period => period.reopenedBy)
  if (reopened.length === 0) return null
  return (
    <div className="mt-6 p-4 rounded-lg border border-[rgba(95,227,192,0.1)] bg-white dark:bg-[#111B24]">
      <h3 className="text-sm font-semibold text-[#294050] dark:text-[#EDF4F4] mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        Reopen Audit Log
      </h3>
      <div className="space-y-2">
        {reopened.map(period => (
          <div
            key={`audit-${period.id}`}
            className="text-xs text-[#294050]/60 dark:text-[#9FB4BE]"
          >
            Period {formatDate(period.periodStart)} –{' '}
            {formatDate(period.periodEnd)} reopened by{' '}
            <strong>{period.reopenedBy}</strong> at{' '}
            {formatDateTime(period.reopenedAt)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Accounting Periods page: lists periods with open/closed status, supports
 * creating periods and closing/reopening them with confirmation. Close and
 * reopen record the authenticated user for the audit trail (GIV-684).
 * @returns Accounting periods page element
 */
const AccountingPeriods: React.FC = () => {
  const { user } = useAuth()
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(
    null
  )

  const actor = user?.email ?? user?.display_name ?? 'unknown'

  const fetchPeriods = useCallback(async () => {
    try {
      const result = await invoke<AccountingPeriod[]>('list_periods')
      setPeriods(result)
    } catch (err) {
      setActionError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  const handleCreate = useCallback(
    async (periodStart: string, periodEnd: string) => {
      setCreateError(null)
      try {
        await invoke('create_period', {
          input: { periodStart, periodEnd },
        })
        setShowCreateForm(false)
        await fetchPeriods()
      } catch (err) {
        setCreateError(String(err))
      }
    },
    [fetchPeriods]
  )

  const handleClose = useCallback(
    async (periodId: number) => {
      setActionError(null)
      setConfirmAction(null)
      try {
        await invoke('close_period', {
          periodId,
          closedBy: actor,
        })
        await fetchPeriods()
      } catch (err) {
        setActionError(String(err))
      }
    },
    [actor, fetchPeriods]
  )

  const handleReopen = useCallback(
    async (periodId: number) => {
      setActionError(null)
      setConfirmAction(null)
      try {
        await invoke('reopen_period', {
          periodId,
          reopenedBy: actor,
        })
        await fetchPeriods()
      } catch (err) {
        setActionError(String(err))
      }
    },
    [actor, fetchPeriods]
  )

  const handleConfirm = useCallback(() => {
    if (!confirmAction) return
    if (confirmAction.type === 'close') {
      void handleClose(confirmAction.periodId)
    } else {
      void handleReopen(confirmAction.periodId)
    }
  }, [confirmAction, handleClose, handleReopen])

  const handleDismissError = useCallback(() => {
    setActionError(null)
  }, [])

  const handleDismissConfirm = useCallback(() => {
    setConfirmAction(null)
  }, [])

  const handleToggleCreate = useCallback(() => {
    setShowCreateForm(prev => !prev)
    setCreateError(null)
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#294050] dark:border-[#F09988]" />
          <p className="mt-3 text-sm text-[#294050]/60 dark:text-[#9FB4BE]">
            Loading periods...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-[#294050] dark:text-[#F09988]" />
          <h1 className="text-2xl font-bold text-[#294050] dark:text-[#EDF4F4]">
            Accounting Periods
          </h1>
        </div>
        <button
          onClick={handleToggleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#294050] text-white hover:bg-[#1e3040] dark:bg-[#5FE3C0] dark:text-[#0C141B] dark:hover:bg-[#4dd3b0] text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Period
        </button>
      </div>

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

      {confirmAction && (
        <ConfirmActionBanner
          action={confirmAction}
          onCancel={handleDismissConfirm}
          onConfirm={handleConfirm}
        />
      )}

      {showCreateForm && (
        <CreatePeriodForm onCreate={handleCreate} error={createError} />
      )}

      {periods.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#111B24] rounded-lg border border-[rgba(95,227,192,0.1)]">
          <CalendarDays className="h-12 w-12 mx-auto text-[#294050]/30 dark:text-[#9FB4BE]/30 mb-3" />
          <p className="text-[#294050]/60 dark:text-[#9FB4BE]">
            No accounting periods defined yet.
          </p>
          <p className="text-sm text-[#294050]/40 dark:text-[#9FB4BE]/60 mt-1">
            Create a period to begin tracking monthly accounting cycles.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[rgba(95,227,192,0.1)] bg-white dark:bg-[#111B24]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(95,227,192,0.1)] bg-[#F7FAFA] dark:bg-[#0C141B]/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#294050]/60 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Period
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#294050]/60 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#294050]/60 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Closed By
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#294050]/60 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Closed At
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#294050]/60 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(95,227,192,0.08)]">
              {periods.map(period => (
                <PeriodRow
                  key={period.id}
                  period={period}
                  onRequestAction={setConfirmAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReopenAuditLog periods={periods} />
    </div>
  )
}

export default AccountingPeriods
