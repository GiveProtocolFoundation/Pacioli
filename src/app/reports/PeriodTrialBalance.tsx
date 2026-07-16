import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { Scale, Download, AlertTriangle } from 'lucide-react'
import {
  formatMinorAsDollars,
  formatStatementDate,
  defaultPeriodDates,
} from './statementUtils'

// ============================================================================
// Types matching Rust serde output
// ============================================================================

interface PeriodTrialBalanceRow {
  accountNumber: string
  accountName: string
  accountType: string
  debitBalance: number
  creditBalance: number
}

interface TrialBalanceReport {
  startDate: string
  endDate: string
  rows: PeriodTrialBalanceRow[]
  totalDebitsMinor: number
  totalCreditsMinor: number
  isBalanced: boolean
}

interface ComparativeTrialBalance {
  current: TrialBalanceReport
  prior: TrialBalanceReport
}

// ============================================================================
// Sub-components
// ============================================================================

interface PeriodSelectorProps {
  startDate: string
  endDate: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onGenerate: () => void
  loading: boolean
}

/** Period date selector for financial statements. */
const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onGenerate,
  loading,
}) => (
  <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-white dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg">
    <div>
      <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] mb-1">
        Start Date
      </label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-[rgba(95,227,192,0.25)] rounded bg-[#F7FAFA] dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2]"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] mb-1">
        End Date
      </label>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-[rgba(95,227,192,0.25)] rounded bg-[#F7FAFA] dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2]"
      />
    </div>
    <button
      onClick={onGenerate}
      disabled={loading}
      className="px-4 py-1.5 text-sm font-medium bg-[#294050] text-white rounded hover:bg-[#1E2F3C] disabled:opacity-50"
    >
      {loading ? 'Generating...' : 'Generate'}
    </button>
  </div>
)

interface TrialBalanceRowProps {
  row: PeriodTrialBalanceRow
  priorDebit: number
  priorCredit: number
  hasPrior: boolean
  even: boolean
}

/** A single trial balance row with optional prior-period comparison. */
const TrialBalanceRowComponent: React.FC<TrialBalanceRowProps> = ({
  row,
  priorDebit,
  priorCredit,
  hasPrior,
  even,
}) => (
  <tr className={even ? 'bg-white dark:bg-[#11202B]' : 'bg-[#EAF3F2] dark:bg-[#16242F]'}>
    <td className="px-5 py-2.5 text-sm font-mono text-[#5FE3C0] font-medium">
      {row.accountNumber}
    </td>
    <td className="px-5 py-2.5 text-sm text-[#11202B] dark:text-[#EAF3F2]">
      {row.accountName}
    </td>
    <td className="px-5 py-2.5 text-sm text-[#294050] dark:text-[#9FB4BE]">
      {row.accountType}
    </td>
    <td className="px-5 py-2.5 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
      {row.debitBalance > 0 ? formatMinorAsDollars(row.debitBalance) : ''}
    </td>
    <td className="px-5 py-2.5 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
      {row.creditBalance > 0 ? formatMinorAsDollars(row.creditBalance) : ''}
    </td>
    {hasPrior && (
      <td className="px-5 py-2.5 text-sm text-right font-mono text-[#647D8B]">
        {priorDebit > 0 ? formatMinorAsDollars(priorDebit) : ''}
      </td>
    )}
    {hasPrior && (
      <td className="px-5 py-2.5 text-sm text-right font-mono text-[#647D8B]">
        {priorCredit > 0 ? formatMinorAsDollars(priorCredit) : ''}
      </td>
    )}
  </tr>
)

// ============================================================================
// Main Component
// ============================================================================

/** Period-aware Trial Balance page with comparative prior period. */
const PeriodTrialBalance: React.FC = () => {
  const defaults = useMemo(() => defaultPeriodDates(), [])
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ComparativeTrialBalance | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<ComparativeTrialBalance>('get_period_trial_balance', {
        params: { startDate, endDate },
      })
      setData(result)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCsv = useCallback(async () => {
    const filePath = await save({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      defaultPath: `trial-balance-${startDate}-to-${endDate}.csv`,
    })
    if (!filePath) return
    try {
      await invoke('export_trial_balance_csv', {
        params: { startDate, endDate },
        path: filePath,
      })
    } catch (err) {
      setError(String(err))
    }
  }, [startDate, endDate])

  const hasPrior = data !== null && data.prior.rows.length > 0

  const priorMap = useMemo(() => {
    if (!data) return new Map<string, { debit: number; credit: number }>()
    return new Map(
      data.prior.rows.map((r) => [
        r.accountNumber,
        { debit: r.debitBalance, credit: r.creditBalance },
      ]),
    )
  }, [data])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
            Trial Balance
          </h1>
          {data !== null && (
            <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
              {formatStatementDate(data.current.startDate)} &mdash;{' '}
              {formatStatementDate(data.current.endDate)}
            </p>
          )}
        </div>
        <button
          onClick={handleExportCsv}
          disabled={data === null}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[rgba(95,227,192,0.3)] rounded text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <PeriodSelector
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onGenerate={fetchData}
        loading={loading}
      />

      {error !== null && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#294050]" />
        </div>
      )}

      {!loading && data === null && error === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="w-12 h-12 text-[#647D8B] mb-4" />
          <h3 className="text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No data available
          </h3>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Select a period and generate the trial balance.
          </p>
        </div>
      )}

      {!loading && data !== null && (
        <div className="border border-[rgba(95,227,192,0.15)] rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[#294050] text-white">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Account #
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Type
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Credit
                </th>
                {hasPrior && (
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9FB4BE]">
                    Prior Debit
                  </th>
                )}
                {hasPrior && (
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9FB4BE]">
                    Prior Credit
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
              {data.current.rows.map((row, idx) => {
                const prior = priorMap.get(row.accountNumber) ?? {
                  debit: 0,
                  credit: 0,
                }
                return (
                  <TrialBalanceRowComponent
                    key={row.accountNumber}
                    row={row}
                    priorDebit={prior.debit}
                    priorCredit={prior.credit}
                    hasPrior={hasPrior}
                    even={idx % 2 === 0}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#EAF3F2] dark:bg-[#16242F] font-bold border-t-2 border-[#5FE3C0]">
                <td colSpan={3} className="px-5 py-3 text-sm text-[#11202B] dark:text-[#EAF3F2]">
                  Totals
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                  {formatMinorAsDollars(data.current.totalDebitsMinor)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                  {formatMinorAsDollars(data.current.totalCreditsMinor)}
                </td>
                {hasPrior && (
                  <td className="px-5 py-3 text-sm text-right font-mono text-[#647D8B]">
                    {formatMinorAsDollars(data.prior.totalDebitsMinor)}
                  </td>
                )}
                {hasPrior && (
                  <td className="px-5 py-3 text-sm text-right font-mono text-[#647D8B]">
                    {formatMinorAsDollars(data.prior.totalCreditsMinor)}
                  </td>
                )}
              </tr>
              <tr className="bg-[#F7FAFA] dark:bg-[#11202B]">
                <td
                  colSpan={hasPrior ? 7 : 5}
                  className={`px-5 py-2 text-sm text-center font-medium ${
                    data.current.isBalanced
                      ? 'text-[#5FE3C0]'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {data.current.isBalanced
                    ? 'Trial balance is in balance'
                    : `Out of balance by ${formatMinorAsDollars(Math.abs(data.current.totalDebitsMinor - data.current.totalCreditsMinor))}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default PeriodTrialBalance
