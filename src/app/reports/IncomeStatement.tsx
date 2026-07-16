import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { TrendingUp, Download, AlertTriangle } from 'lucide-react'
import {
  formatMinorAsDollars,
  formatStatementDate,
  computeChangePercent,
  formatChangePercent,
  defaultPeriodDates,
} from './statementUtils'

// ============================================================================
// Types matching Rust serde output
// ============================================================================

interface StatementLineItem {
  accountNumber: string
  accountName: string
  accountType: string
  balanceMinor: number
}

interface StatementSection {
  label: string
  items: StatementLineItem[]
  subtotalMinor: number
}

interface IncomeStatementData {
  startDate: string
  endDate: string
  revenue: StatementSection
  expenses: StatementSection
  totalRevenueMinor: number
  totalExpensesMinor: number
  netIncomeMinor: number
}

interface ComparativeIncomeStatement {
  current: IncomeStatementData
  prior: IncomeStatementData
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
        onChange={e => onStartChange(e.target.value)}
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
        onChange={e => onEndChange(e.target.value)}
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

interface IncomeSectionProps {
  section: StatementSection
  priorSection: StatementSection | null
}

/** Renders a section (Revenue or Expenses) with line items. */
const IncomeSection: React.FC<IncomeSectionProps> = ({
  section,
  priorSection,
}) => {
  const priorMap = useMemo(() => {
    if (!priorSection) return new Map<string, number>()
    return new Map(
      priorSection.items.map(i => [i.accountNumber, i.balanceMinor])
    )
  }, [priorSection])

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[#294050] dark:text-[#9FB4BE] mb-2 px-1">
        {section.label}
      </h3>
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[rgba(95,227,192,0.2)]">
            <th className="px-4 py-2 text-left text-xs font-medium text-[#647D8B] uppercase">
              Account
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-[#647D8B] uppercase">
              Current
            </th>
            {priorSection !== null && (
              <th className="px-4 py-2 text-right text-xs font-medium text-[#647D8B] uppercase">
                Prior
              </th>
            )}
            {priorSection !== null && (
              <th className="px-4 py-2 text-right text-xs font-medium text-[#647D8B] uppercase">
                Change
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {section.items.map(item => {
            const prior = priorMap.get(item.accountNumber) ?? 0
            const changePct =
              priorSection !== null
                ? computeChangePercent(item.balanceMinor, prior)
                : null
            return (
              <tr
                key={item.accountNumber}
                className="border-b border-[rgba(95,227,192,0.08)] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
              >
                <td className="px-4 py-2 text-sm text-[#11202B] dark:text-[#EAF3F2]">
                  <span className="font-mono text-[#5FE3C0] mr-2">
                    {item.accountNumber}
                  </span>
                  {item.accountName}
                </td>
                <td className="px-4 py-2 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                  {formatMinorAsDollars(item.balanceMinor)}
                </td>
                {priorSection !== null && (
                  <td className="px-4 py-2 text-sm text-right font-mono text-[#647D8B]">
                    {formatMinorAsDollars(prior)}
                  </td>
                )}
                {priorSection !== null && (
                  <td className="px-4 py-2 text-sm text-right font-mono text-[#647D8B]">
                    {formatChangePercent(changePct)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#5FE3C0] font-bold">
            <td className="px-4 py-2 text-sm text-[#11202B] dark:text-[#EAF3F2]">
              Total {section.label}
            </td>
            <td className="px-4 py-2 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
              {formatMinorAsDollars(section.subtotalMinor)}
            </td>
            {priorSection !== null && (
              <td className="px-4 py-2 text-sm text-right font-mono text-[#647D8B]">
                {formatMinorAsDollars(priorSection.subtotalMinor)}
              </td>
            )}
            {priorSection !== null && (
              <td className="px-4 py-2 text-sm text-right font-mono text-[#647D8B]">
                {formatChangePercent(
                  computeChangePercent(
                    section.subtotalMinor,
                    priorSection.subtotalMinor
                  )
                )}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/** Income Statement page with comparative prior period. */
const IncomeStatement: React.FC = () => {
  const defaults = useMemo(() => defaultPeriodDates(), [])
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ComparativeIncomeStatement | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<ComparativeIncomeStatement>(
        'get_income_statement',
        {
          params: { startDate, endDate },
        }
      )
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
      defaultPath: `income-statement-${startDate}-to-${endDate}.csv`,
    })
    if (!filePath) return
    try {
      await invoke('export_income_statement_csv', {
        params: { startDate, endDate },
        path: filePath,
      })
    } catch (err) {
      setError(String(err))
    }
  }, [startDate, endDate])

  const hasPrior =
    data !== null &&
    (data.prior.revenue.items.length > 0 ||
      data.prior.expenses.items.length > 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
            Income Statement
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
          <TrendingUp className="w-12 h-12 text-[#647D8B] mb-4" />
          <h3 className="text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No data available
          </h3>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Select a period and generate the income statement.
          </p>
        </div>
      )}

      {!loading && data !== null && (
        <div className="bg-white dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg p-6">
          <IncomeSection
            section={data.current.revenue}
            priorSection={hasPrior ? data.prior.revenue : null}
          />

          <IncomeSection
            section={data.current.expenses}
            priorSection={hasPrior ? data.prior.expenses : null}
          />

          <div className="border-t-2 border-[#5FE3C0] mt-2 pt-3">
            <div className="flex justify-between px-4 py-2">
              <span className="text-base font-bold text-[#11202B] dark:text-[#EAF3F2]">
                Net Income
              </span>
              <div className="text-right">
                <span
                  className={`text-base font-mono font-bold ${data.current.netIncomeMinor >= 0 ? 'text-[#5FE3C0]' : 'text-red-600 dark:text-red-400'}`}
                >
                  {formatMinorAsDollars(data.current.netIncomeMinor)}
                </span>
                {hasPrior && (
                  <span className="ml-4 text-sm font-mono text-[#647D8B]">
                    (Prior: {formatMinorAsDollars(data.prior.netIncomeMinor)},{' '}
                    {formatChangePercent(
                      computeChangePercent(
                        data.current.netIncomeMinor,
                        data.prior.netIncomeMinor
                      )
                    )}
                    )
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IncomeStatement
