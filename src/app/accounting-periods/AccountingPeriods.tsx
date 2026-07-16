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

const AccountingPeriods: React.FC = () => {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Confirmation state for close/reopen actions
  const [confirmAction, setConfirmAction] = useState<{
    type: 'close' | 'reopen'
    periodId: number
    label: string
  } | null>(null)

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

  const handleCreate = useCallback(async () => {
    setCreateError(null)
    try {
      await invoke('create_period', {
        input: { periodStart: newStart, periodEnd: newEnd },
      })
      setShowCreateForm(false)
      setNewStart('')
      setNewEnd('')
      await fetchPeriods()
    } catch (err) {
      setCreateError(String(err))
    }
  }, [newStart, newEnd, fetchPeriods])

  const handleClose = useCallback(
    async (periodId: number) => {
      setActionError(null)
      setConfirmAction(null)
      try {
        await invoke('close_period', {
          periodId,
          closedBy: 'user',
        })
        await fetchPeriods()
      } catch (err) {
        setActionError(String(err))
      }
    },
    [fetchPeriods]
  )

  const handleReopen = useCallback(
    async (periodId: number) => {
      setActionError(null)
      setConfirmAction(null)
      try {
        await invoke('reopen_period', {
          periodId,
          reopenedBy: 'user',
        })
        await fetchPeriods()
      } catch (err) {
        setActionError(String(err))
      }
    },
    [fetchPeriods]
  )

  const handleDismissError = useCallback(() => {
    setActionError(null)
  }, [])

  const handleDismissConfirm = useCallback(() => {
    setConfirmAction(null)
  }, [])

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewStart(e.target.value)
    },
    []
  )

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewEnd(e.target.value)
    },
    []
  )

  const handleToggleCreate = useCallback(() => {
    setShowCreateForm((prev) => !prev)
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
        <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
          <span>
            {confirmAction.type === 'close'
              ? `Close period ${confirmAction.label}? No more entries can be posted into this period until it is reopened.`
              : `Reopen period ${confirmAction.label}? This is an audit event — entries can be posted into this period again.`}
          </span>
          <div className="flex gap-2 ml-4">
            <button
              onClick={handleDismissConfirm}
              className="px-3 py-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={
                confirmAction.type === 'close'
                  ? () => handleClose(confirmAction.periodId)
                  : () => handleReopen(confirmAction.periodId)
              }
              className={`px-3 py-1 rounded font-medium text-white ${
                confirmAction.type === 'close'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmAction.type === 'close' ? 'Close Period' : 'Reopen Period'}
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
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
              onClick={handleCreate}
              disabled={!newStart || !newEnd}
              className="px-4 py-2 rounded-lg bg-[#294050] text-white hover:bg-[#1e3040] dark:bg-[#5FE3C0] dark:text-[#0C141B] dark:hover:bg-[#4dd3b0] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
          {createError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {createError}
            </p>
          )}
        </div>
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
              {periods.map((period) => {
                const cfg =
                  statusConfig[period.status as keyof typeof statusConfig] ??
                  statusConfig.open
                const StatusIcon = cfg.icon
                return (
                  <tr
                    key={period.id}
                    className="hover:bg-[#F7FAFA]/50 dark:hover:bg-[#0C141B]/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-[#294050] dark:text-[#EDF4F4] font-medium">
                      {formatDate(period.periodStart)} –{' '}
                      {formatDate(period.periodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#294050]/60 dark:text-[#9FB4BE] text-xs">
                      {period.closedBy ?? '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-[#294050]/60 dark:text-[#9FB4BE] text-xs">
                      {formatDateTime(period.closedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {period.status === 'open' ? (
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: 'close',
                              periodId: period.id,
                              label: `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Close
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: 'reopen',
                              periodId: period.id,
                              label: `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {periods.some((p) => p.reopenedBy) && (
        <div className="mt-6 p-4 rounded-lg border border-[rgba(95,227,192,0.1)] bg-white dark:bg-[#111B24]">
          <h3 className="text-sm font-semibold text-[#294050] dark:text-[#EDF4F4] mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Reopen Audit Log
          </h3>
          <div className="space-y-2">
            {periods
              .filter((p) => p.reopenedBy)
              .map((p) => (
                <div
                  key={`audit-${p.id}`}
                  className="text-xs text-[#294050]/60 dark:text-[#9FB4BE]"
                >
                  Period {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}{' '}
                  reopened by <strong>{p.reopenedBy}</strong> at{' '}
                  {formatDateTime(p.reopenedAt)}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountingPeriods
