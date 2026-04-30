import React, { useState, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Plus, Trash2 } from 'lucide-react'
import type {
  GLAccount,
  JournalEntryWithLines,
} from '../../types/database'

interface LineInput {
  id: string
  glAccountId: number | ''
  debitAmount: string
  creditAmount: string
  description: string
}

interface JournalEntryDrawerProps {
  accounts: GLAccount[]
  entry?: JournalEntryWithLines
  transactionRef?: string
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
  description: '',
})

/** Slide-in drawer for creating/viewing a journal entry */
const JournalEntryDrawer: React.FC<JournalEntryDrawerProps> = ({
  accounts,
  entry,
  transactionRef,
  onClose,
  onSaved,
}) => {
  const isView = Boolean(entry)
  const [entryDate, setEntryDate] = useState(
    entry?.entryDate
      ? new Date(entry.entryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [description, setDescription] = useState(entry?.description ?? '')
  const [referenceNumber, setReferenceNumber] = useState(
    entry?.referenceNumber ?? transactionRef ?? ''
  )
  const [lines, setLines] = useState<LineInput[]>(
    entry
      ? entry.lines.map(l => ({
          id: nextLineId(),
          glAccountId: l.glAccountId,
          debitAmount:
            (l.debitAmount as unknown as number) > 0
              ? String(l.debitAmount)
              : '',
          creditAmount:
            (l.creditAmount as unknown as number) > 0
              ? String(l.creditAmount)
              : '',
          description: l.description ?? '',
        }))
      : [emptyLine(), emptyLine()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalDebits = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.debitAmount) || 0), 0),
    [lines]
  )
  const totalCredits = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.creditAmount) || 0), 0),
    [lines]
  )
  const difference = Math.abs(totalDebits - totalCredits)
  const isBalanced = difference < 0.01 && totalDebits > 0

  const handleLineChange = useCallback(
    (
      index: number,
      field: keyof LineInput,
      value: string | number
    ) => {
      setLines(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], [field]: value }
        // If entering a debit, clear credit (and vice versa)
        if (field === 'debitAmount' && parseFloat(value as string) > 0) {
          updated[index].creditAmount = ''
        } else if (
          field === 'creditAmount' &&
          parseFloat(value as string) > 0
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
      const input = {
        entry_date: entryDate,
        description,
        reference_number: referenceNumber || null,
        raw_transaction_id: null,
        lines: lines
          .filter(l => l.glAccountId !== '')
          .map(l => ({
            gl_account_id: l.glAccountId as number,
            token_id: null,
            debit_amount: parseFloat(l.debitAmount) || 0,
            credit_amount: parseFloat(l.creditAmount) || 0,
            description: l.description || null,
          })),
      }
      await invoke('create_journal_entry', { input })
      onSaved()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }, [entryDate, description, referenceNumber, lines, onSaved])

  const handlePostEntry = useCallback(async () => {
    setError(null)
    setSaving(true)
    try {
      const input = {
        entry_date: entryDate,
        description,
        reference_number: referenceNumber || null,
        raw_transaction_id: null,
        lines: lines
          .filter(l => l.glAccountId !== '')
          .map(l => ({
            gl_account_id: l.glAccountId as number,
            token_id: null,
            debit_amount: parseFloat(l.debitAmount) || 0,
            credit_amount: parseFloat(l.creditAmount) || 0,
            description: l.description || null,
          })),
      }
      const created = await invoke<JournalEntryWithLines>(
        'create_journal_entry',
        { input }
      )
      await invoke('post_journal_entry', { id: created.id })
      onSaved()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to post entry')
    } finally {
      setSaving(false)
    }
  }, [entryDate, description, referenceNumber, lines, onSaved])

  return ( // skipcq: JS-0415 — drawer layout requires nested containers
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="relative w-full max-w-2xl bg-[#fafaf8] dark:bg-[#1a1815] shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
          <h2 className="text-lg font-bold text-[#1a1815] dark:text-[#f5f3f0]">
            {isView ? 'Journal Entry' : 'New Journal Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#696557] hover:text-[#1a1815] dark:hover:text-[#f5f3f0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[#696557] dark:text-[#b8b3ac] mb-1">
              Entry Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              disabled={isView}
              className="w-full px-3 py-2 rounded-lg border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-[#1a1815] dark:text-[#f5f3f0] text-sm disabled:opacity-60"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#696557] dark:text-[#b8b3ac] mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isView}
              placeholder="e.g. Staking reward on Polkadot"
              className="w-full px-3 py-2 rounded-lg border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-[#1a1815] dark:text-[#f5f3f0] text-sm placeholder-[#a39d94] disabled:opacity-60"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-[#696557] dark:text-[#b8b3ac] mb-1">
              Reference
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              disabled={isView}
              placeholder="Transaction hash or reference"
              className="w-full px-3 py-2 rounded-lg border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-[#1a1815] dark:text-[#f5f3f0] text-sm font-mono placeholder-[#a39d94] disabled:opacity-60"
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#696557] dark:text-[#b8b3ac]">
                Line Items
              </label>
              {!isView && (
                <button
                  onClick={handleAddLine}
                  className="flex items-center gap-1 text-xs text-[#8b4e52] hover:text-[#7a4248] transition-colors"
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
                  className="flex gap-2 items-start p-3 rounded-lg border border-[rgba(201,169,97,0.1)] bg-white dark:bg-[#141210]"
                >
                  {/* Account selector */}
                  <div className="flex-1 min-w-0">
                    <select
                      value={line.glAccountId}
                      onChange={e =>
                        handleLineChange(
                          idx,
                          'glAccountId',
                          e.target.value ? parseInt(e.target.value) : ''
                        )
                      }
                      disabled={isView}
                      className="w-full px-2 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] text-sm disabled:opacity-60"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.accountNumber} · {a.accountName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={line.description}
                      onChange={e =>
                        handleLineChange(idx, 'description', e.target.value)
                      }
                      disabled={isView}
                      placeholder="Memo"
                      className="w-full mt-1 px-2 py-1 rounded border border-[rgba(201,169,97,0.1)] bg-transparent text-[#696557] dark:text-[#b8b3ac] text-xs placeholder-[#a39d94] disabled:opacity-60"
                    />
                  </div>

                  {/* Debit */}
                  <div className="w-24">
                    <label className="block text-[10px] text-[#696557] dark:text-[#b8b3ac] mb-0.5 uppercase">
                      Debit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debitAmount}
                      onChange={e =>
                        handleLineChange(idx, 'debitAmount', e.target.value)
                      }
                      disabled={isView}
                      className="w-full px-2 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] text-sm text-right font-mono disabled:opacity-60"
                    />
                  </div>

                  {/* Credit */}
                  <div className="w-24">
                    <label className="block text-[10px] text-[#696557] dark:text-[#b8b3ac] mb-0.5 uppercase">
                      Credit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.creditAmount}
                      onChange={e =>
                        handleLineChange(idx, 'creditAmount', e.target.value)
                      }
                      disabled={isView}
                      className="w-full px-2 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] text-sm text-right font-mono disabled:opacity-60"
                    />
                  </div>

                  {/* Remove */}
                  {!isView && lines.length > 2 && (
                    <button
                      onClick={() => handleRemoveLine(idx)}
                      className="mt-4 p-1 text-[#a39d94] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Balance indicator */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              isBalanced
                ? 'border-[#c9a961] bg-[#c9a961]/5'
                : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10'
            }`}
          >
            <div className="flex gap-8 text-sm">
              <span className="text-[#696557] dark:text-[#b8b3ac]">
                Debits:{' '}
                <span className="font-mono font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                  {totalDebits.toFixed(2)}
                </span>
              </span>
              <span className="text-[#696557] dark:text-[#b8b3ac]">
                Credits:{' '}
                <span className="font-mono font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                  {totalCredits.toFixed(2)}
                </span>
              </span>
            </div>
            <span
              className={`text-sm font-medium ${
                isBalanced
                  ? 'text-[#c9a961]'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isBalanced
                ? 'Balanced'
                : `Off by ${difference.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Footer buttons */}
        {!isView && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(201,169,97,0.15)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[rgba(201,169,97,0.15)] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={saving || lines.filter(l => l.glAccountId !== '').length < 2}
              className="px-4 py-2 text-sm rounded-lg border border-[#8b4e52] text-[#8b4e52] hover:bg-[#8b4e52]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            <button
              onClick={handlePostEntry}
              disabled={saving || !isBalanced}
              className="px-4 py-2 text-sm rounded-lg bg-[#8b4e52] text-white hover:bg-[#7a4248] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Post Entry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default JournalEntryDrawer
