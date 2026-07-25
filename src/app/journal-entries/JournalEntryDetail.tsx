import React, { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  X,
  Clock,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  ArrowRightLeft,
  ExternalLink,
  Link2,
} from 'lucide-react'
import type { GLAccount, JournalEntryWithLines } from '../../types/database'
import {
  displayStatus as displayStatusUtil,
  formatDate,
  formatDateTime,
  minorToDollars,
} from './journalEntryUtils'
import { isTauriAvailable } from '../../utils/tauri'

interface SourceTransactionSummary {
  id: string
  chainId: string
  transactionHash: string
  fromAddress: string
  toAddress?: string
  transferValue: string
  transactionFee?: string
  timestamp: number
  transactionType: string
  status: string
  walletAddress: string
}

interface JournalEntryDetailProps {
  entry: JournalEntryWithLines
  accounts: GLAccount[]
  entries: JournalEntryWithLines[]
  onClose: () => void
}

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

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

function formatTxTimestamp(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
  entry,
  accounts,
  entries,
  onClose,
}) => {
  const [sourceTx, setSourceTx] = useState<SourceTransactionSummary | null>(
    null
  )
  const [sourceTxFetched, setSourceTxFetched] = useState(false)

  const sourceTxLoading =
    Boolean(entry.sourceTxId) && isTauriAvailable() && !sourceTxFetched

  useEffect(() => {
    if (!entry.sourceTxId || !isTauriAvailable()) return
    invoke<SourceTransactionSummary | null>('get_source_transaction', {
      sourceTxId: entry.sourceTxId,
    })
      .then(result => setSourceTx(result ?? null))
      .catch(() => setSourceTx(null))
      .finally(() => setSourceTxFetched(true))
  }, [entry.sourceTxId])

  const accountMap = useMemo(() => {
    const m = new Map<number, GLAccount>()
    accounts.forEach(a => m.set(a.id, a))
    return m
  }, [accounts])

  const resolveAccountName = (glAccountId: number) => {
    const acct = accountMap.get(glAccountId)
    return acct
      ? `${acct.accountNumber} · ${acct.accountName}`
      : `#${glAccountId}`
  }

  const status = displayStatusUtil(entry.status)
  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon

  const totalDebits = entry.lines.reduce((s, l) => s + l.debitMinor, 0)
  const totalCredits = entry.lines.reduce((s, l) => s + l.creditMinor, 0)

  const reversalEntry = useMemo(() => {
    if (entry.reversedByEntryId) {
      return entries.find(e => e.id === entry.reversedByEntryId)
    }
    if (entry.description?.startsWith('Reversal of entry #')) {
      const originalNumber = entry.description.replace(
        'Reversal of entry #',
        ''
      )
      return entries.find(e => e.entryNumber === originalNumber)
    }
    return undefined
  }, [entry, entries])

  const isReversing =
    entry.description !== undefined &&
    entry.description !== null &&
    entry.description.startsWith('Reversal of entry #')

  return (
    // skipcq: JS-0415 — detail overlay requires nested containers
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      {/* Detail panel */}
      <div className="relative w-full max-w-3xl bg-[#F7FAFA] dark:bg-[#11202B] shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(95,227,192,0.15)]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[#11202B] dark:text-[#EAF3F2]">
              {entry.entryNumber ?? 'Journal Entry'}
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
            >
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#294050] hover:text-[#11202B] dark:hover:text-[#EAF3F2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Reversal linkage banner */}
          {(entry.isReversed || isReversing) && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700">
              <ArrowRightLeft className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {entry.isReversed && reversalEntry && (
                  <span>
                    This entry has been voided. Reversing entry:{' '}
                    <span className="font-mono font-medium">
                      {reversalEntry.entryNumber}
                    </span>{' '}
                    ({formatDate(reversalEntry.entryDate)})
                  </span>
                )}
                {entry.isReversed && !reversalEntry && (
                  <span>
                    This entry has been voided. Reversed by entry ID:{' '}
                    <span className="font-mono">{entry.reversedByEntryId}</span>
                  </span>
                )}
                {isReversing && reversalEntry && (
                  <span>
                    This is a reversing entry for{' '}
                    <span className="font-mono font-medium">
                      {reversalEntry.entryNumber}
                    </span>{' '}
                    ({formatDate(reversalEntry.entryDate)}). Both entries remain
                    in the ledger with a net effect of zero.
                  </span>
                )}
                {isReversing && !reversalEntry && (
                  <span>
                    This is a reversing entry. {entry.description}. Both entries
                    remain in the ledger with a net effect of zero.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Entry metadata grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-1">
                Entry Date
              </label>
              <span className="text-sm text-[#11202B] dark:text-[#EAF3F2]">
                {formatDate(entry.entryDate)}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-1">
                Entry Number
              </label>
              <span className="text-sm font-mono text-[#11202B] dark:text-[#EAF3F2]">
                {entry.entryNumber ?? '—'}
              </span>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-1">
                Description
              </label>
              <span className="text-sm text-[#11202B] dark:text-[#EAF3F2]">
                {entry.description ?? '—'}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-1">
                Reference
              </label>
              <span className="text-sm font-mono text-[#11202B] dark:text-[#EAF3F2] break-all">
                {entry.referenceNumber ?? '—'}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-1">
                Origin
              </label>
              <span className="text-sm text-[#11202B] dark:text-[#EAF3F2]">
                {originLabels[entry.origin] ?? entry.origin}
              </span>
            </div>
          </div>

          {/* Source on-chain transaction */}
          {entry.sourceTxId && (
            <div>
              <h3 className="text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Source Transaction
              </h3>
              {sourceTxLoading && (
                <p className="text-sm text-[#647D8B]">Loading&hellip;</p>
              )}
              {!sourceTxLoading && sourceTx && (
                <div className="p-3 rounded-lg bg-[#EAF3F2]/60 dark:bg-[#16242F]/60 border border-[rgba(95,227,192,0.15)] space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-[#647D8B] uppercase">
                        Chain
                      </span>
                      <p className="font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {sourceTx.chainId}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-[#647D8B] uppercase">
                        Type
                      </span>
                      <p className="text-[#11202B] dark:text-[#EAF3F2] capitalize">
                        {sourceTx.transactionType.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-[#647D8B] uppercase">
                        Tx Hash
                      </span>
                      <p className="font-mono text-[#11202B] dark:text-[#EAF3F2] break-all flex items-center gap-1.5">
                        {sourceTx.transactionHash}
                        <ExternalLink className="w-3 h-3 text-[#647D8B] flex-shrink-0" />
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-[#647D8B] uppercase">
                        From
                      </span>
                      <p
                        className="font-mono text-[#11202B] dark:text-[#EAF3F2]"
                        title={sourceTx.fromAddress}
                      >
                        {truncateAddress(sourceTx.fromAddress)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-[#647D8B] uppercase">
                        To
                      </span>
                      <p
                        className="font-mono text-[#11202B] dark:text-[#EAF3F2]"
                        title={sourceTx.toAddress ?? ''}
                      >
                        {sourceTx.toAddress
                          ? truncateAddress(sourceTx.toAddress)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-[#647D8B] uppercase">
                        Timestamp
                      </span>
                      <p className="text-[#11202B] dark:text-[#EAF3F2]">
                        {formatTxTimestamp(sourceTx.timestamp)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-[#647D8B] uppercase">
                        Value
                      </span>
                      <p className="font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {sourceTx.transferValue}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!sourceTxLoading && !sourceTx && (
                <p className="text-sm text-[#647D8B] italic">
                  Source transaction not found (ID: {entry.sourceTxId})
                </p>
              )}
            </div>
          )}

          {/* Lifecycle timestamps */}
          <div>
            <h3 className="text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-3">
              Lifecycle
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-[#647D8B]" />
                <span className="text-[#294050] dark:text-[#9FB4BE] w-24">
                  Created
                </span>
                <span className="text-[#11202B] dark:text-[#EAF3F2]">
                  {formatDateTime(entry.createdAt)}
                </span>
                {entry.createdBy && (
                  <span className="text-xs text-[#647D8B]">
                    by {entry.createdBy}
                  </span>
                )}
              </div>
              {entry.approvedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-[#294050] dark:text-[#9FB4BE] w-24">
                    Approved
                  </span>
                  <span className="text-[#11202B] dark:text-[#EAF3F2]">
                    {formatDateTime(entry.approvedAt)}
                  </span>
                  {entry.approvedBy && (
                    <span className="text-xs text-[#647D8B]">
                      by {entry.approvedBy}
                    </span>
                  )}
                </div>
              )}
              {entry.postedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-[#294050] dark:text-[#9FB4BE] w-24">
                    Posted
                  </span>
                  <span className="text-[#11202B] dark:text-[#EAF3F2]">
                    {formatDateTime(entry.postedAt)}
                  </span>
                </div>
              )}
              {entry.status === 'voided' && (
                <div className="flex items-center gap-3 text-sm">
                  <XCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-[#294050] dark:text-[#9FB4BE] w-24">
                    Voided
                  </span>
                  <span className="text-[#11202B] dark:text-[#EAF3F2]">
                    {formatDateTime(entry.updatedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Entry lines table */}
          <div>
            <h3 className="text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-3">
              Lines
            </h3>
            <div className="border border-[rgba(95,227,192,0.15)] rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#EAF3F2] dark:bg-[#16242F]">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase">
                      Account
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase">
                      Asset
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase w-28">
                      Debit
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase w-28">
                      Credit
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase">
                      Memo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(95,227,192,0.08)]">
                  {entry.lines.map(line => (
                    <tr key={line.id} className="bg-white dark:bg-[#11202B]">
                      <td className="px-4 py-2 text-[#11202B] dark:text-[#EAF3F2]">
                        {resolveAccountName(line.glAccountId)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[#294050] dark:text-[#9FB4BE]">
                        {line.assetId ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[#294050] dark:text-[#9FB4BE]">
                        {line.quantity ?? ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {line.debitMinor > 0
                          ? minorToDollars(line.debitMinor)
                          : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                        {line.creditMinor > 0
                          ? minorToDollars(line.creditMinor)
                          : ''}
                      </td>
                      <td className="px-4 py-2 text-[#294050] dark:text-[#9FB4BE]">
                        {line.description ?? ''}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-[#EAF3F2]/50 dark:bg-[#16242F]/50 font-medium">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-right text-xs uppercase text-[#294050] dark:text-[#9FB4BE]"
                    >
                      Totals
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                      {minorToDollars(totalDebits)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
                      {minorToDollars(totalCredits)}
                    </td>
                    <td className="px-4 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[rgba(95,227,192,0.15)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-[rgba(95,227,192,0.15)] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default JournalEntryDetail
