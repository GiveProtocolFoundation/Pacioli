import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { FileText, Download, AlertTriangle } from 'lucide-react'
import {
  formatMinorAsDollars,
  formatStatementDate,
  defaultPeriodDates,
} from './statementUtils'

interface SoaLineItem {
  accountNumber: string
  accountName: string
  balanceMinor: number
}

interface SoaExpenseSection {
  label: string
  items: SoaLineItem[]
  subtotalMinor: number
}

interface StatementOfActivitiesReport {
  startDate: string
  endDate: string
  revenueWithoutRestrictions: SoaLineItem[]
  revenueWithRestrictions: SoaLineItem[]
  releasedFromRestrictions: SoaLineItem[]
  totalRevenueWithoutMinor: number
  totalRevenueWithMinor: number
  totalRevenueMinor: number
  expensesProgram: SoaExpenseSection
  expensesManagement: SoaExpenseSection
  expensesFundraising: SoaExpenseSection
  expensesUnclassified: SoaExpenseSection
  totalExpensesMinor: number
  changeInNetAssets: number
}

interface PeriodSelectorProps {
  startDate: string
  endDate: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onGenerate: () => void
  loading: boolean
}

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

const SectionRow: React.FC<{
  item: SoaLineItem
  even: boolean
}> = ({ item, even }) => (
  <tr
    className={
      even ? 'bg-white dark:bg-[#11202B]' : 'bg-[#EAF3F2] dark:bg-[#16242F]'
    }
  >
    <td className="px-5 py-2 text-sm font-mono text-[#5FE3C0] font-medium">
      {item.accountNumber}
    </td>
    <td className="px-5 py-2 text-sm text-[#11202B] dark:text-[#EAF3F2]">
      {item.accountName}
    </td>
    <td className="px-5 py-2 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
      {formatMinorAsDollars(item.balanceMinor)}
    </td>
  </tr>
)

const SubtotalRow: React.FC<{
  label: string
  amount: number
  bold?: boolean
}> = ({ label, amount, bold }) => (
  <tr
    className={
      bold
        ? 'bg-[#EAF3F2] dark:bg-[#16242F] border-t-2 border-[#5FE3C0]'
        : 'bg-[#EAF3F2] dark:bg-[#16242F] border-t border-[rgba(95,227,192,0.2)]'
    }
  >
    <td
      colSpan={2}
      className={`px-5 py-2 text-sm text-[#11202B] dark:text-[#EAF3F2] ${bold ? 'font-bold' : 'font-medium'}`}
    >
      {label}
    </td>
    <td
      className={`px-5 py-2 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2] ${bold ? 'font-bold' : 'font-medium'}`}
    >
      {formatMinorAsDollars(amount)}
    </td>
  </tr>
)

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <tr className="bg-[#294050]">
    <td
      colSpan={3}
      className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white"
    >
      {label}
    </td>
  </tr>
)

const ExpenseSectionBlock: React.FC<{
  section: SoaExpenseSection
  startIdx: number
}> = ({ section, startIdx }) => {
  if (section.items.length === 0 && section.subtotalMinor === 0) return null
  return (
    <>
      <tr className="bg-[#294050]/80">
        <td
          colSpan={3}
          className="px-5 py-2 text-xs font-medium uppercase tracking-wider text-white/80 pl-8"
        >
          {section.label}
        </td>
      </tr>
      {section.items.map((item, i) => (
        <SectionRow
          key={item.accountNumber}
          item={item}
          even={(startIdx + i) % 2 === 0}
        />
      ))}
      <SubtotalRow
        label={`Total ${section.label}`}
        amount={section.subtotalMinor}
      />
    </>
  )
}

const StatementOfActivities: React.FC = () => {
  const defaults = useMemo(() => defaultPeriodDates(), [])
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatementOfActivitiesReport | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<StatementOfActivitiesReport>(
        'get_statement_of_activities',
        { params: { startDate, endDate } }
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
      defaultPath: `statement-of-activities-${startDate}-to-${endDate}.csv`,
    })
    if (!filePath) return
    try {
      await invoke('export_statement_of_activities_csv', {
        params: { startDate, endDate },
        path: filePath,
      })
    } catch (err) {
      setError(String(err))
    }
  }, [startDate, endDate])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
            Statement of Activities
          </h1>
          {data !== null && (
            <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
              {formatStatementDate(data.startDate)} &ndash;{' '}
              {formatStatementDate(data.endDate)}
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
          <FileText className="w-12 h-12 text-[#647D8B] mb-4" />
          <h3 className="text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No data available
          </h3>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Select a period and generate the Statement of Activities.
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
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
              {/* Revenue — Without Donor Restrictions */}
              <SectionHeader label="Revenue — Without Donor Restrictions" />
              {data.revenueWithoutRestrictions.map((item, i) => (
                <SectionRow
                  key={item.accountNumber}
                  item={item}
                  even={i % 2 === 0}
                />
              ))}
              <SubtotalRow
                label="Subtotal Without Restrictions"
                amount={data.totalRevenueWithoutMinor}
              />

              {/* Revenue — With Donor Restrictions */}
              <SectionHeader label="Revenue — With Donor Restrictions" />
              {data.revenueWithRestrictions.map((item, i) => (
                <SectionRow
                  key={item.accountNumber}
                  item={item}
                  even={i % 2 === 0}
                />
              ))}
              <SubtotalRow
                label="Subtotal With Restrictions"
                amount={data.totalRevenueWithMinor}
              />

              {/* Released from Restrictions */}
              {data.releasedFromRestrictions.length > 0 && (
                <>
                  <SectionHeader label="Net Assets Released from Restrictions" />
                  {data.releasedFromRestrictions.map((item, i) => (
                    <SectionRow
                      key={item.accountNumber}
                      item={item}
                      even={i % 2 === 0}
                    />
                  ))}
                </>
              )}

              <SubtotalRow
                label="Total Revenue"
                amount={data.totalRevenueMinor}
                bold
              />

              {/* Expenses by Functional Classification */}
              <SectionHeader label="Expenses by Functional Classification" />
              <ExpenseSectionBlock
                section={data.expensesProgram}
                startIdx={0}
              />
              <ExpenseSectionBlock
                section={data.expensesManagement}
                startIdx={data.expensesProgram.items.length}
              />
              <ExpenseSectionBlock
                section={data.expensesFundraising}
                startIdx={
                  data.expensesProgram.items.length +
                  data.expensesManagement.items.length
                }
              />
              {data.expensesUnclassified.items.length > 0 && (
                <ExpenseSectionBlock
                  section={data.expensesUnclassified}
                  startIdx={
                    data.expensesProgram.items.length +
                    data.expensesManagement.items.length +
                    data.expensesFundraising.items.length
                  }
                />
              )}
              <SubtotalRow
                label="Total Expenses"
                amount={data.totalExpensesMinor}
                bold
              />
            </tbody>
            <tfoot>
              <tr className="bg-[#EAF3F2] dark:bg-[#16242F] font-bold border-t-2 border-[#5FE3C0]">
                <td
                  colSpan={2}
                  className="px-5 py-3 text-sm text-[#11202B] dark:text-[#EAF3F2]"
                >
                  Change in Net Assets
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                  {formatMinorAsDollars(data.changeInNetAssets)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default StatementOfActivities
