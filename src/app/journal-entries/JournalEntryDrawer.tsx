import React, { useState, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Plus, Trash2 } from 'lucide-react'
import type { GLAccount, JournalEntryWithLines } from '../../types/database'
import { toMinorUnits, minorToDollars } from './journalEntryUtils'
import { useAuth } from '../../contexts/AuthContext'

export interface LineInput {
  id: string
  glAccountId: number | ''
  debitAmount: string
  creditAmount: string
  quantity: string
  assetId: string
  description: string
  functionalClassification: string
}

interface JournalEntryDrawerProps {
  accounts: GLAccount[]
  entry?: JournalEntryWithLines
  transactionRef?: string
  rawTransactionId?: string
  initialLines?: LineInput[]
  initialDescription?: string
  onClose: () => void
  onSaved: () => void
}

let lineIdCounter = 0
/** Generates a unique key for journal entry line items. */
const nextLineId = () => `line-${++lineIdCounter}`

/** Returns a blank line item with default empty values. */
const emptyLine = (): LineInput => ({
  id: nextLineId(),
  glAccountId: '',
  debitAmount: '',
  creditAmount: '',
  quantity: '',
  assetId: 'USD',
  description: '',
  functionalClassification: '',
})

/**
 * Slide-in drawer for creating/editing draft journal entries.
 * Editing an approved entry requires demote-to-draft first (backend enforces).
 * @param props - Component properties
 * @returns The JournalEntryDrawer component
 */
const JournalEntryDrawer: React.FC<JournalEntryDrawerProps> = ({
  accounts,
  entry,
  transactionRef,
  rawTransactionId,
  initialLines,
  initialDescription,
  onClose,
  onSaved,
}) => {
  const { accountType } = useAuth()
  const isNgo = accountType === 'not-for-profit'
  const isView = Boolean(entry) && entry?.status !== 'draft'
  const isEditDraft = Boolean(entry) && entry?.status === 'draft'
  const [entryDate, setEntryDate] = useState(
    entry?.entryDate
      ? new Date(entry.entryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [description, setDescription] = useState(
    entry?.description ?? initialDescription ?? ''
  )
  const [referenceNumber, setReferenceNumber] = useState(
    entry?.referenceNumber ?? transactionRef ?? ''
  )
  const [lines, setLines] = useState<LineInput[]>(
    entry
      ? entry.lines.map(l => ({
          id: nextLineId(),
          glAccountId: l.glAccountId,
          debitAmount: l.debitMinor > 0 ? minorToDollars(l.debitMinor) : '',
          creditAmount: l.creditMinor > 0 ? minorToDollars(l.creditMinor) : '',
          quantity: l.quantity ?? '',
          assetId: l.assetId ?? 'USD',
          description: l.description ?? '',
          functionalClassification: l.functionalClassification ?? '',
        }))
      : (initialLines ?? [emptyLine(), emptyLine()])
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Compute balance in integer minor units (no floats touching money). */
  const totalDebitMinor = useMemo(
    () => lines.reduce((s, l) => s + toMinorUnits(l.debitAmount), 0),
    [lines]
  )
  const totalCreditMinor = useMemo(
    () => lines.reduce((s, l) => s + toMinorUnits(l.creditAmount), 0),
    [lines]
  )
  const differenceMinor = totalDebitMinor - totalCreditMinor
  const isBalanced = differenceMinor === 0 && totalDebitMinor > 0

  /** Per-asset quantity balance hints. */
  const assetQuantityHints = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>()
    for (const l of lines) {
      if (!l.quantity || !l.assetId || l.assetId === 'USD') continue
      const qty = Number.parseFloat(l.quantity)
      if (Number.isNaN(qty) || qty === 0) continue
      const existing = map.get(l.assetId) ?? { debit: 0, credit: 0 }
      if (toMinorUnits(l.debitAmount) > 0) {
        existing.debit += qty
      } else {
        existing.credit += qty
      }
      map.set(l.assetId, existing)
    }
    return map
  }, [lines])

  const handleLineChange = useCallback(
    (index: number, field: keyof LineInput, value: string | number) => {
      setLines(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], [field]: value }
        if (field === 'debitAmount' && toMinorUnits(value as string) > 0) {
          updated[index].creditAmount = ''
        } else if (
          field === 'creditAmount' &&
          toMinorUnits(value as string) > 0
        ) {
          updated[index].debitAmount = ''
        }
        return updated
      })
    },
    []
  )

  const handleAddLine = useCallback(() => {
    setLines(prev => [...prev, emptyLine()])
  }, [])

  const handleRemoveLine = useCallback(
    (index: number) => {
      if (lines.length <= 2) return
      setLines(prev => prev.filter((_, i) => i !== index))
    },
    [lines.length]
  )

  const handleSaveDraft = useCallback(async () => {
    setError(null)
    setSaving(true)
    try {
      // Keys are camelCase: NewJournalEntryInput / JournalEntryLineInput are
      // #[serde(rename_all = "camelCase")] on the Rust side.
      const input = {
        entryDate,
        description,
        referenceNumber: referenceNumber || null,
        rawTransactionId: rawTransactionId ?? null,
        origin: rawTransactionId ? 'manual' : null,
        lines: lines
          .filter(l => l.glAccountId !== '')
          .map(l => ({
            glAccountId: l.glAccountId as number,
            tokenId: null,
            debitMinor: toMinorUnits(l.debitAmount),
            creditMinor: toMinorUnits(l.creditAmount),
            quantity: l.quantity || null,
            assetId: l.assetId || 'USD',
            description: l.description || null,
            functionalClassification: l.functionalClassification || null,
          })),
      }
      if (isEditDraft && entry) {
        // Edit-in-place: creating a new entry here would leave a duplicate
        // draft in the queue.
        await invoke('update_journal_entry', { id: entry.id, input })
      } else {
        await invoke('create_journal_entry', { input })
      }
      onSaved()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }, [
    entryDate,
    description,
    referenceNumber,
    rawTransactionId,
    lines,
    isEditDraft,
    entry,
    onSaved,
  ])

  const isEditable = !isView || isEditDraft

  return (
    // skipcq: JS-0415 — drawer layout requires nested containers
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      {/* Drawer panel */}
      <div className="relative w-full max-w-2xl bg-[#F7FAFA] dark:bg-[#11202B] shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(95,227,192,0.15)]">
          <h2 className="text-lg font-bold text-[#11202B] dark:text-[#EAF3F2]">
            {isView
              ? 'Journal Entry'
              : isEditDraft
                ? 'Edit Draft'
                : 'New Journal Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#294050] hover:text-[#11202B] dark:hover:text-[#EAF3F2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[#294050] dark:text-[#9FB4BE] mb-1">
              Entry Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              disabled={!isEditable}
              className="w-full px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2] text-sm disabled:opacity-60"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#294050] dark:text-[#9FB4BE] mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!isEditable}
              placeholder="e.g. Staking reward on Polkadot"
              className="w-full px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2] text-sm placeholder-[#647D8B] disabled:opacity-60"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-[#294050] dark:text-[#9FB4BE] mb-1">
              Reference
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              disabled={!isEditable}
              placeholder="Transaction hash or reference"
              className="w-full px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2] text-sm font-mono placeholder-[#647D8B] disabled:opacity-60"
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#294050] dark:text-[#9FB4BE]">
                Line Items
              </label>
              {isEditable && (
                <button
                  onClick={handleAddLine}
                  className="flex items-center gap-1 text-xs text-[#294050] hover:text-[#1E2F3C] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line
                </button>
              )}
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className="flex gap-2 items-start p-3 rounded-lg border border-[rgba(95,227,192,0.1)] bg-white dark:bg-[#0C141B]"
                >
                  {/* Account + asset + memo */}
                  <div className="flex-1 min-w-0">
                    <select
                      value={line.glAccountId}
                      onChange={e =>
                        handleLineChange(
                          idx,
                          'glAccountId',
                          e.target.value
                            ? Number.parseInt(e.target.value, 10)
                            : ''
                        )
                      }
                      disabled={!isEditable}
                      className="w-full px-2 py-1.5 rounded border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm disabled:opacity-60"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.accountNumber} &middot; {a.accountName}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={line.quantity}
                        onChange={e =>
                          handleLineChange(idx, 'quantity', e.target.value)
                        }
                        disabled={!isEditable}
                        placeholder="Qty"
                        className="w-20 px-2 py-1 rounded border border-[rgba(95,227,192,0.1)] bg-transparent text-[#294050] dark:text-[#9FB4BE] text-xs placeholder-[#647D8B] disabled:opacity-60"
                      />
                      <input
                        type="text"
                        value={line.assetId}
                        onChange={e =>
                          handleLineChange(idx, 'assetId', e.target.value)
                        }
                        disabled={!isEditable}
                        placeholder="Asset"
                        className="w-24 px-2 py-1 rounded border border-[rgba(95,227,192,0.1)] bg-transparent text-[#294050] dark:text-[#9FB4BE] text-xs placeholder-[#647D8B] disabled:opacity-60"
                      />
                      <input
                        type="text"
                        value={line.description}
                        onChange={e =>
                          handleLineChange(idx, 'description', e.target.value)
                        }
                        disabled={!isEditable}
                        placeholder="Memo"
                        className="flex-1 px-2 py-1 rounded border border-[rgba(95,227,192,0.1)] bg-transparent text-[#294050] dark:text-[#9FB4BE] text-xs placeholder-[#647D8B] disabled:opacity-60"
                      />
                    </div>
                    {isNgo &&
                      (() => {
                        const acct =
                          line.glAccountId !== ''
                            ? accounts.find(a => a.id === line.glAccountId)
                            : undefined
                        const isExpense = acct?.accountType === 'Expense'
                        if (!isExpense) return null
                        return (
                          <select
                            value={line.functionalClassification}
                            onChange={e =>
                              handleLineChange(
                                idx,
                                'functionalClassification',
                                e.target.value
                              )
                            }
                            disabled={!isEditable}
                            className="mt-1 w-full px-2 py-1 rounded border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#11202B] text-[#294050] dark:text-[#9FB4BE] text-xs disabled:opacity-60"
                          >
                            <option value="">Classification (optional)</option>
                            <option value="program_services">
                              Program Services
                            </option>
                            <option value="management_general">
                              Management &amp; General
                            </option>
                            <option value="fundraising">Fundraising</option>
                          </select>
                        )
                      })()}
                  </div>

                  {/* Debit */}
                  <div className="w-24">
                    <label className="block text-[10px] text-[#294050] dark:text-[#9FB4BE] mb-0.5 uppercase">
                      Debit
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.debitAmount}
                      onChange={e =>
                        handleLineChange(idx, 'debitAmount', e.target.value)
                      }
                      disabled={!isEditable}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 rounded border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm text-right font-mono disabled:opacity-60"
                    />
                  </div>

                  {/* Credit */}
                  <div className="w-24">
                    <label className="block text-[10px] text-[#294050] dark:text-[#9FB4BE] mb-0.5 uppercase">
                      Credit
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.creditAmount}
                      onChange={e =>
                        handleLineChange(idx, 'creditAmount', e.target.value)
                      }
                      disabled={!isEditable}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 rounded border border-[rgba(95,227,192,0.15)] bg-white dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm text-right font-mono disabled:opacity-60"
                    />
                  </div>

                  {/* Remove */}
                  {isEditable && lines.length > 2 && (
                    <button
                      onClick={() => handleRemoveLine(idx)}
                      className="mt-4 p-1 text-[#647D8B] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Balance indicator — integer math, no floats */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              isBalanced
                ? 'border-[#5FE3C0] bg-[#5FE3C0]/5'
                : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10'
            }`}
          >
            <div className="flex gap-8 text-sm">
              <span className="text-[#294050] dark:text-[#9FB4BE]">
                Debits:{' '}
                <span className="font-mono font-medium text-[#11202B] dark:text-[#EAF3F2]">
                  {minorToDollars(totalDebitMinor)}
                </span>
              </span>
              <span className="text-[#294050] dark:text-[#9FB4BE]">
                Credits:{' '}
                <span className="font-mono font-medium text-[#11202B] dark:text-[#EAF3F2]">
                  {minorToDollars(totalCreditMinor)}
                </span>
              </span>
            </div>
            <span
              className={`text-sm font-medium ${
                isBalanced
                  ? 'text-[#5FE3C0]'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isBalanced
                ? 'Balanced'
                : `Off by ${minorToDollars(Math.abs(differenceMinor))}`}
            </span>
          </div>

          {/* Per-asset quantity balance hints */}
          {assetQuantityHints.size > 0 && (
            <div className="space-y-1">
              {Array.from(assetQuantityHints.entries()).map(([asset, bal]) => {
                const net = bal.debit - bal.credit
                const balanced = Math.abs(net) < 1e-12
                return (
                  <div
                    key={asset}
                    className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${
                      balanced
                        ? 'bg-[#5FE3C0]/5 text-[#294050] dark:text-[#9FB4BE]'
                        : 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    <span className="font-mono">{asset}</span>
                    <span>
                      DR {bal.debit} / CR {bal.credit}
                      {!balanced && (
                        <span className="ml-2 font-medium">
                          (net {net > 0 ? '+' : ''}
                          {net})
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {isEditable && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(95,227,192,0.15)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[rgba(95,227,192,0.15)] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={
                saving || lines.filter(l => l.glAccountId !== '').length < 2
              }
              className="px-4 py-2 text-sm rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditDraft ? 'Update Draft' : 'Save Draft'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default JournalEntryDrawer
