import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Scale } from 'lucide-react'

interface TrialBalanceRow {
  accountNumber: string
  accountName: string
  accountType: string
  debitBalance: number
  creditBalance: number
}

/** Trial Balance page */
const TrialBalance: React.FC = () => {
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<TrialBalanceRow[]>('get_trial_balance')
      setRows(result)
    } catch (err) {
      console.error('Failed to fetch trial balance:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrialBalance()
  }, [fetchTrialBalance])

  const totals = useMemo(() => {
    let debits = 0
    let credits = 0
    for (const r of rows) {
      debits += r.debitBalance
      credits += r.creditBalance
    }
    return { debits, credits, isBalanced: Math.abs(debits - credits) < 0.01 }
  }, [rows])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0]">
          Trial Balance
        </h1>
        <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
          Accounts with non-zero posted balances
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8b4e52]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="w-12 h-12 text-[#a39d94] mb-4" />
          <h3 className="text-lg font-medium text-[#1a1815] dark:text-[#f5f3f0]">
            No posted balances
          </h3>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
            Post journal entries to see account balances here.
          </p>
        </div>
      ) : (
        <div className="border border-[rgba(201,169,97,0.15)] rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[#8b4e52] text-white">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(201,169,97,0.1)]">
              {rows.map((row, i) => (
                <tr
                  key={row.accountNumber}
                  className={
                    i % 2 === 0
                      ? 'bg-white dark:bg-[#1a1815]'
                      : 'bg-[#f3f1ed] dark:bg-[#2a2620]'
                  }
                >
                  <td className="px-5 py-2.5 text-sm font-mono text-[#8b4e52] dark:text-[#c9a961] font-medium">
                    {row.accountNumber}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                    {row.accountName}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-[#696557] dark:text-[#b8b3ac]">
                    {row.accountType}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono text-[#1a1815] dark:text-[#f5f3f0]">
                    {row.debitBalance > 0 ? row.debitBalance.toFixed(2) : ''}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono text-[#1a1815] dark:text-[#f5f3f0]">
                    {row.creditBalance > 0
                      ? row.creditBalance.toFixed(2)
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#f3f1ed] dark:bg-[#2a2620] font-bold border-t-2 border-[#c9a961]">
                <td
                  colSpan={3}
                  className="px-5 py-3 text-sm text-[#1a1815] dark:text-[#f5f3f0]"
                >
                  Totals
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#1a1815] dark:text-[#f5f3f0]">
                  {totals.debits.toFixed(2)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#1a1815] dark:text-[#f5f3f0]">
                  {totals.credits.toFixed(2)}
                </td>
              </tr>
              <tr className="bg-[#fafaf8] dark:bg-[#1a1815]">
                <td
                  colSpan={5}
                  className={`px-5 py-2 text-sm text-center font-medium ${
                    totals.isBalanced
                      ? 'text-[#c9a961]'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {totals.isBalanced
                    ? 'Trial balance is in balance'
                    : `Out of balance by ${Math.abs(totals.debits - totals.credits).toFixed(2)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default TrialBalance
