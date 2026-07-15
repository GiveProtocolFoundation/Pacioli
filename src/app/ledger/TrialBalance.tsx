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
    return { debits, credits, isBalanced: debits === credits }
  }, [rows])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
          Trial Balance
        </h1>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
          Accounts with non-zero posted balances
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#294050]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="w-12 h-12 text-[#647D8B] mb-4" />
          <h3 className="text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No posted balances
          </h3>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Post journal entries to see account balances here.
          </p>
        </div>
      ) : (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(95,227,192,0.1)]">
              {rows.map((row, i) => (
                <tr
                  key={row.accountNumber}
                  className={
                    i % 2 === 0
                      ? 'bg-white dark:bg-[#11202B]'
                      : 'bg-[#EAF3F2] dark:bg-[#16242F]'
                  }
                >
                  <td className="px-5 py-2.5 text-sm font-mono text-[#294050] dark:text-[#5FE3C0] font-medium">
                    {row.accountNumber}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-[#11202B] dark:text-[#EAF3F2]">
                    {row.accountName}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-[#294050] dark:text-[#9FB4BE]">
                    {row.accountType}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                    {row.debitBalance > 0
                      ? (row.debitBalance / 100).toFixed(2)
                      : ''}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                    {row.creditBalance > 0
                      ? (row.creditBalance / 100).toFixed(2)
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#EAF3F2] dark:bg-[#16242F] font-bold border-t-2 border-[#5FE3C0]">
                <td
                  colSpan={3}
                  className="px-5 py-3 text-sm text-[#11202B] dark:text-[#EAF3F2]"
                >
                  Totals
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                  {(totals.debits / 100).toFixed(2)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                  {(totals.credits / 100).toFixed(2)}
                </td>
              </tr>
              <tr className="bg-[#F7FAFA] dark:bg-[#11202B]">
                <td
                  colSpan={5}
                  className={`px-5 py-2 text-sm text-center font-medium ${
                    totals.isBalanced
                      ? 'text-[#5FE3C0]'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {totals.isBalanced
                    ? 'Trial balance is in balance'
                    : `Out of balance by ${(Math.abs(totals.debits - totals.credits) / 100).toFixed(2)}`}
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
