import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Landmark,
  Plus,
  Upload,
  FileText,
  Pencil,
  Archive,
  AlertCircle,
  CheckCircle,
  X,
  Loader,
} from 'lucide-react'
import {
  persistence,
  type BankAccount,
  type BankAccountInput,
  type BankAccountType,
  type BankTransaction,
  type ImportBatchInput,
  type BankTransactionInput,
  type StatementProfile,
} from '../../services/persistence'
import {
  detectFormat,
  parseStatement,
  dedup,
  buildExternalIdSet,
  columnMapFromProfile,
  inferColumnMap,
  type ParseResult,
  type ParsedTransaction,
  type CsvColumnMap,
} from '../../services/parsers'
import { useEntity } from '../../contexts/EntityContext'

const ACCOUNT_TYPES: { value: BankAccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'money_market', label: 'Money Market' },
  { value: 'line_of_credit', label: 'Line of Credit' },
  { value: 'other', label: 'Other' },
]

const inputClassName =
  'w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:ring-2 focus:ring-[#5FE3C0] focus:outline-none'

const labelClassName =
  'block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-1'

interface AccountFormData {
  institution_name: string
  account_nickname: string
  account_type: BankAccountType
  currency: string
  gl_account_number: string
  masked_account_number: string
  entity_id: string
}

const emptyForm: AccountFormData = {
  institution_name: '',
  account_nickname: '',
  account_type: 'checking',
  currency: 'USD',
  gl_account_number: '1000',
  masked_account_number: '',
  entity_id: '',
}

interface PreviewRow extends ParsedTransaction {
  _selected: boolean
  _editedPayee?: string
  _editedMemo?: string
}

function formatDate(epochMs: number): string {
  const d = new Date(epochMs)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatAmount(amount: string): string {
  const n = Number.parseFloat(amount)
  if (Number.isNaN(n)) return amount
  const abs = Math.abs(n).toFixed(2)
  return n < 0 ? `-$${abs}` : `$${abs}`
}

function resolveCsvColumnMap(
  content: string,
  profiles: StatementProfile[],
  selectedProfileId: string
):
  | { colMap: CsvColumnMap; profile: StatementProfile | undefined }
  | { error: string } {
  const profile = profiles.find(p => p.id === selectedProfileId)
  const inferred = profile
    ? columnMapFromProfile(profile)
    : inferColumnMap(content.split('\n')[0]?.split(',') ?? [])

  const valid =
    inferred &&
    'date' in inferred &&
    'amount' in inferred &&
    inferred.date &&
    inferred.amount

  if (!valid) {
    return {
      error:
        'Could not infer CSV columns. Please select a statement profile or ensure your CSV has Date and Amount columns.',
    }
  }

  return { colMap: inferred as CsvColumnMap, profile }
}

function buildParseOptions(
  format: string,
  bankAccountId: string,
  content: string,
  profiles: StatementProfile[],
  selectedProfileId: string,
  currency: string,
  existingIds: Set<string>
): { options: Parameters<typeof parseStatement>[2] } | { error: string } {
  if (format !== 'csv') {
    return {
      options: { bankAccountId, existingExternalIds: existingIds },
    }
  }

  const resolved = resolveCsvColumnMap(content, profiles, selectedProfileId)
  if ('error' in resolved) return resolved

  const { colMap, profile } = resolved
  return {
    options: {
      bankAccountId,
      columnMap: colMap,
      dateFormat: profile?.date_format ?? 'MM/DD/YYYY',
      amountSignConvention:
        (profile?.amount_sign_convention as
          | 'signed'
          | 'debit_positive'
          | 'debit_negative') ?? 'signed',
      currencyDefault: profile?.currency_default ?? currency,
      existingExternalIds: existingIds,
    },
  }
}

function buildPreviewState(
  result: ParseResult,
  existing: BankTransaction[]
): { parseResult: ParseResult; previewRows: PreviewRow[] } {
  const dedupResult = dedup(result.transactions, existing)
  const allTx = [...dedupResult.unique, ...dedupResult.duplicates]
  return {
    parseResult: {
      ...result,
      transactions: allTx,
      duplicateCount: dedupResult.duplicateCount,
    },
    previewRows: allTx.map(tx => ({
      ...tx,
      _selected: !tx._isDuplicate,
    })),
  }
}

interface PreviewRowComponentProps {
  row: PreviewRow
  index: number
  onToggle: (i: number) => void
  onEditPayee: (i: number, v: string) => void
  onEditMemo: (i: number, v: string) => void
}

const PreviewRowComponent = React.memo(function PreviewRowComponent({
  row,
  index,
  onToggle,
  onEditPayee,
  onEditMemo,
}: PreviewRowComponentProps) {
  const handleToggle = useCallback(() => onToggle(index), [onToggle, index])
  const handlePayeeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onEditPayee(index, e.target.value),
    [onEditPayee, index]
  )
  const handleMemoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onEditMemo(index, e.target.value),
    [onEditMemo, index]
  )

  const amount = Number.parseFloat(row.amount)
  const amountColor =
    amount < 0
      ? 'text-red-500 dark:text-red-400'
      : 'text-green-600 dark:text-green-400'

  return (
    <tr
      className={`border-t border-[rgba(95,227,192,0.08)] ${
        row._isDuplicate ? 'opacity-40' : ''
      } ${row._selected ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'}`}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={row._selected}
          onChange={handleToggle}
          disabled={Boolean(row._isDuplicate)}
          className="rounded border-[rgba(95,227,192,0.3)]"
        />
      </td>
      <td className="px-3 py-2 text-[#11202B] dark:text-[#EAF3F2] whitespace-nowrap">
        {formatDate(row.posted_date)}
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={row._editedPayee ?? row.payee ?? ''}
          onChange={handlePayeeChange}
          className="w-full bg-transparent border-b border-transparent hover:border-[rgba(95,227,192,0.3)] focus:border-[#5FE3C0] focus:outline-none text-[#11202B] dark:text-[#EAF3F2] text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={row._editedMemo ?? row.memo ?? ''}
          onChange={handleMemoChange}
          className="w-full bg-transparent border-b border-transparent hover:border-[rgba(95,227,192,0.3)] focus:border-[#5FE3C0] focus:outline-none text-[#647D8B] dark:text-[#9FB4BE] text-sm"
        />
      </td>
      <td
        className={`px-3 py-2 text-right font-mono whitespace-nowrap ${amountColor}`}
      >
        {formatAmount(row.amount)}
      </td>
      <td className="px-3 py-2 text-[#647D8B] dark:text-[#9FB4BE] text-xs">
        {row.tx_type ?? '—'}
      </td>
      <td className="px-3 py-2 text-center">
        {row._isDuplicate ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            Duplicate
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#EAF3F2] dark:bg-[#1E2F3C] text-[#294050] dark:text-[#9CF1DC]">
            New
          </span>
        )}
      </td>
    </tr>
  )
})

interface AccountCardProps {
  account: BankAccount
  onEdit: (a: BankAccount) => void
  onArchive: (a: BankAccount) => void
  onUpload: (a: BankAccount) => void
}

const AccountCard = React.memo(function AccountCard({
  account,
  onEdit,
  onArchive,
  onUpload,
}: AccountCardProps) {
  const handleEdit = useCallback(() => onEdit(account), [onEdit, account])
  const handleArchive = useCallback(
    () => onArchive(account),
    [onArchive, account]
  )
  const handleUpload = useCallback(() => onUpload(account), [onUpload, account])

  const typeLabel =
    ACCOUNT_TYPES.find(t => t.value === account.account_type)?.label ??
    account.account_type

  return (
    <div className="ledger-card border border-[rgba(95,227,192,0.15)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#294050] flex items-center justify-center">
            <Landmark className="w-5 h-5 text-[#5FE3C0]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#11202B] dark:text-[#EAF3F2]">
              {account.account_nickname}
            </h3>
            <p className="text-sm text-[#647D8B] dark:text-[#9FB4BE]">
              {account.institution_name}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleEdit}
            className="p-1.5 rounded-md hover:bg-[#EAF3F2] dark:hover:bg-[#1E2F3C] transition-colors"
            title="Edit account"
          >
            <Pencil className="w-4 h-4 text-[#647D8B]" />
          </button>
          <button
            onClick={handleArchive}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Archive account"
          >
            <Archive className="w-4 h-4 text-[#647D8B] hover:text-red-500" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-[#EAF3F2] dark:bg-[#1E2F3C] text-[#294050] dark:text-[#9CF1DC]">
          {typeLabel}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-[#EAF3F2] dark:bg-[#1E2F3C] text-[#294050] dark:text-[#9CF1DC]">
          {account.currency}
        </span>
        {account.masked_account_number && (
          <span className="px-2 py-0.5 rounded-full bg-[#EAF3F2] dark:bg-[#1E2F3C] text-[#647D8B] dark:text-[#9FB4BE]">
            ****{account.masked_account_number}
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-[#EAF3F2] dark:bg-[#1E2F3C] text-[#647D8B] dark:text-[#9FB4BE]">
          GL {account.gl_account_number}
        </span>
      </div>
      <button
        onClick={handleUpload}
        className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
      >
        <Upload className="w-4 h-4" />
        Import Statement
      </button>
    </div>
  )
})

interface StatementUploadProps {
  account: BankAccount
  dragOver: boolean
  parseResult: ParseResult | null
  previewRows: PreviewRow[]
  importing: boolean
  selectedCount: number
  profiles: StatementProfile[]
  selectedProfileId: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onToggleRow: (i: number) => void
  onEditPayee: (i: number, v: string) => void
  onEditMemo: (i: number, v: string) => void
  onSelectAllToggle: () => void
  onConfirm: () => void
  onCancel: () => void
  onProfileChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function StatementUpload({
  account,
  dragOver,
  parseResult,
  previewRows,
  importing,
  selectedCount,
  profiles,
  selectedProfileId,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onToggleRow,
  onEditPayee,
  onEditMemo,
  onSelectAllToggle,
  onConfirm,
  onCancel,
  onProfileChange,
}: StatementUploadProps) {
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [fileInputRef])

  return (
    <div className="ledger-card border border-[rgba(95,227,192,0.15)] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#5FE3C0]" />
          <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2]">
            Import Statement — {account.account_nickname}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="text-[#647D8B] hover:text-[#11202B] dark:hover:text-[#EAF3F2]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* CSV profile selector */}
      {profiles.length > 0 && (
        <div className="mb-4">
          <label htmlFor="profile_select" className={labelClassName}>
            Statement Profile (for CSV)
          </label>
          <select
            id="profile_select"
            className={inputClassName}
            value={selectedProfileId}
            onChange={onProfileChange}
          >
            <option value="">Auto-detect columns</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.institution_name ? ` (${p.institution_name})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Drop zone */}
      {!parseResult && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-[#5FE3C0] bg-[#5FE3C0]/10'
              : 'border-[rgba(95,227,192,0.3)] hover:border-[#5FE3C0]/50'
          }`}
          onClick={handleBrowseClick}
          role="button"
          tabIndex={0}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-[#5FE3C0] opacity-60" />
          <p className="text-[#11202B] dark:text-[#EAF3F2] font-medium mb-1">
            Drag & drop a statement file here
          </p>
          <p className="text-sm text-[#647D8B] dark:text-[#9FB4BE]">
            OFX, QFX, QBO, or CSV files supported
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.qfx,.qbo,.csv"
            onChange={onFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview grid */}
      {parseResult && previewRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#647D8B] dark:text-[#9FB4BE]">
              {parseResult.totalCount} transaction
              {parseResult.totalCount !== 1 ? 's' : ''} parsed
              {parseResult.duplicateCount > 0 && (
                <span className="text-amber-500">
                  {' '}
                  ({parseResult.duplicateCount} duplicate
                  {parseResult.duplicateCount !== 1 ? 's' : ''})
                </span>
              )}
              {' — '}
              <span className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
                {selectedCount} selected
              </span>
            </p>
            <label className="flex items-center gap-2 text-sm text-[#647D8B] cursor-pointer">
              <input
                type="checkbox"
                checked={previewRows.every(r => r._selected || r._isDuplicate)}
                onChange={onSelectAllToggle}
                className="rounded border-[rgba(95,227,192,0.3)]"
              />
              Select all
            </label>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[rgba(95,227,192,0.15)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#EAF3F2] dark:bg-[#1E2F3C]">
                  <th scope="col" className="px-3 py-2 text-left w-10" />
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[#294050] dark:text-[#9CF1DC] font-medium"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[#294050] dark:text-[#9CF1DC] font-medium"
                  >
                    Payee
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[#294050] dark:text-[#9CF1DC] font-medium"
                  >
                    Memo
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-[#294050] dark:text-[#9CF1DC] font-medium"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[#294050] dark:text-[#9CF1DC] font-medium"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-center text-[#294050] dark:text-[#9CF1DC] font-medium"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <PreviewRowComponent
                    key={row.external_id ?? `row-${idx}`}
                    row={row}
                    index={idx}
                    onToggle={onToggleRow}
                    onEditPayee={onEditPayee}
                    onEditMemo={onEditMemo}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={onConfirm}
              disabled={importing || selectedCount === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {importing && <Loader className="w-4 h-4 animate-spin" />}
              Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
            </button>
            <button onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {parseResult && previewRows.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
          <p className="text-[#11202B] dark:text-[#EAF3F2] font-medium">
            No transactions found in this file
          </p>
          <p className="text-sm text-[#647D8B] dark:text-[#9FB4BE] mt-1">
            The file could not be parsed or contains no transactions.
          </p>
        </div>
      )}
    </div>
  )
}

/** @returns BankAccountManager page component */
export default function BankAccountManager() {
  const { entities } = useEntity()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [formData, setFormData] = useState<AccountFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [uploadAccount, setUploadAccount] = useState<BankAccount | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profiles, setProfiles] = useState<StatementProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await persistence.getBankAccounts()
      setAccounts(data.filter(a => a.active))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load bank accounts'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProfiles = useCallback(async () => {
    try {
      const data = await persistence.getStatementProfiles()
      setProfiles(data)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    loadAccounts()
    loadProfiles()
  }, [loadAccounts, loadProfiles])

  const handleFormChange = useCallback(
    (field: keyof AccountFormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }))
      },
    []
  )

  const handleAddClick = useCallback(() => {
    setFormData(emptyForm)
    setEditingAccount(null)
    setShowAddForm(true)
  }, [])

  const handleEditClick = useCallback((account: BankAccount) => {
    setFormData({
      institution_name: account.institution_name,
      account_nickname: account.account_nickname,
      account_type: account.account_type,
      currency: account.currency,
      gl_account_number: account.gl_account_number,
      masked_account_number: account.masked_account_number ?? '',
      entity_id: account.entity_id ?? '',
    })
    setEditingAccount(account)
    setShowAddForm(true)
  }, [])

  const handleArchive = useCallback(async (account: BankAccount) => {
    try {
      await persistence.archiveBankAccount(account.id)
      setAccounts(prev => prev.filter(a => a.id !== account.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive account')
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!formData.institution_name.trim() || !formData.account_nickname.trim())
      return
    setSaving(true)
    try {
      const input: BankAccountInput = {
        institution_name: formData.institution_name.trim(),
        account_nickname: formData.account_nickname.trim(),
        account_type: formData.account_type,
        currency: formData.currency.trim() || 'USD',
        gl_account_number: formData.gl_account_number.trim() || '1000',
        masked_account_number:
          formData.masked_account_number.trim() || undefined,
        entity_id: formData.entity_id || undefined,
      }
      await persistence.saveBankAccount(input)
      setShowAddForm(false)
      setEditingAccount(null)
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }, [formData, loadAccounts])

  const handleCancelForm = useCallback(() => {
    setShowAddForm(false)
    setEditingAccount(null)
  }, [])

  const handleUploadClick = useCallback((account: BankAccount) => {
    setUploadAccount(account)
    setParseResult(null)
    setPreviewRows([])
    setImportSuccess(null)
    setSelectedProfileId('')
  }, [])

  const processFile = useCallback(
    async (file: File) => {
      if (!uploadAccount) return
      setError(null)
      setImportSuccess(null)
      try {
        const content = await file.text()
        const format = detectFormat(content, file.name)
        if (!format) {
          setError(
            'Unsupported file format. Please upload OFX, QFX, QBO, or CSV files.'
          )
          return
        }

        const existing = await persistence.getBankTransactions(uploadAccount.id)
        const existingIds = buildExternalIdSet(existing)

        const opts = buildParseOptions(
          format,
          uploadAccount.id,
          content,
          profiles,
          selectedProfileId,
          uploadAccount.currency,
          existingIds
        )
        if ('error' in opts) {
          setError(opts.error)
          return
        }

        const result = parseStatement(content, format, opts.options)
        const preview = buildPreviewState(result, existing)
        setParseResult(preview.parseResult)
        setPreviewRows(preview.previewRows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file')
      }
    },
    [uploadAccount, profiles, selectedProfileId]
  )

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleToggleRow = useCallback((index: number) => {
    setPreviewRows(prev =>
      prev.map((row, i) =>
        i === index ? { ...row, _selected: !row._selected } : row
      )
    )
  }, [])

  const handleEditPayee = useCallback((index: number, value: string) => {
    setPreviewRows(prev =>
      prev.map((row, i) =>
        i === index ? { ...row, _editedPayee: value } : row
      )
    )
  }, [])

  const handleEditMemo = useCallback((index: number, value: string) => {
    setPreviewRows(prev =>
      prev.map((row, i) => (i === index ? { ...row, _editedMemo: value } : row))
    )
  }, [])

  const selectedCount = useMemo(
    () => previewRows.filter(r => r._selected).length,
    [previewRows]
  )

  const handleConfirmImport = useCallback(async () => {
    if (!uploadAccount || selectedCount === 0) return
    setImporting(true)
    setError(null)
    try {
      const batch: ImportBatchInput = {
        bank_account_id: uploadAccount.id,
        filename: fileInputRef.current?.files?.[0]?.name,
        format: parseResult?.format,
        row_count: selectedCount,
        duplicate_count: parseResult?.duplicateCount ?? 0,
        status: 'committed',
      }
      const savedBatch = await persistence.saveImportBatch(batch)

      const txInputs: BankTransactionInput[] = previewRows
        .filter(r => r._selected)
        .map(row => ({
          bank_account_id: uploadAccount.id,
          external_id: row.external_id,
          posted_date: row.posted_date,
          transaction_date: row.transaction_date,
          amount: row.amount,
          currency: row.currency,
          payee: row._editedPayee ?? row.payee,
          memo: row._editedMemo ?? row.memo,
          reference_number: row.reference_number,
          tx_type: row.tx_type,
          running_balance: row.running_balance,
          classification_status: 'unclassified',
          raw_data: row.raw_data,
          import_batch_id: savedBatch.id,
        }))

      const count = await persistence.saveBankTransactions(txInputs)
      setImportSuccess(
        `Imported ${count} transaction${count !== 1 ? 's' : ''} successfully.`
      )
      setPreviewRows([])
      setParseResult(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to import transactions'
      )
    } finally {
      setImporting(false)
    }
  }, [uploadAccount, selectedCount, previewRows, parseResult])

  const handleCancelUpload = useCallback(() => {
    setUploadAccount(null)
    setParseResult(null)
    setPreviewRows([])
    setImportSuccess(null)
  }, [])

  const handleProfileChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedProfileId(e.target.value)
    },
    []
  )

  const handleSelectAllToggle = useCallback(() => {
    const allSelected = previewRows.every(r => r._selected || r._isDuplicate)
    setPreviewRows(prev =>
      prev.map(row =>
        row._isDuplicate ? row : { ...row, _selected: !allSelected }
      )
    )
  }, [previewRows])

  if (loading) {
    return (
      <div className="min-h-screen ledger-background p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 animate-spin text-[#5FE3C0]" />
            <span className="ml-3 text-[#9FB4BE]">
              Loading bank accounts...
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen ledger-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Landmark className="w-7 h-7 text-[#5FE3C0]" />
            <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
              Bank Accounts
            </h1>
          </div>
          <button
            onClick={handleAddClick}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
        <p className="text-[#647D8B] dark:text-[#9FB4BE] mb-8">
          Manage bank and card accounts, import statements, and review
          transactions before posting.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {importSuccess && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {importSuccess}
            </p>
            <button
              onClick={() => setImportSuccess(null)}
              className="text-green-400 hover:text-green-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-8 ledger-card border border-[rgba(95,227,192,0.15)] p-6 rounded-xl">
            <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-4">
              {editingAccount ? 'Edit Account' : 'Add Bank Account'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="institution" className={labelClassName}>
                  Institution Name *
                </label>
                <input
                  id="institution"
                  type="text"
                  className={inputClassName}
                  value={formData.institution_name}
                  onChange={handleFormChange('institution_name')}
                  placeholder="e.g. Chase, Wells Fargo"
                />
              </div>
              <div>
                <label htmlFor="nickname" className={labelClassName}>
                  Account Nickname *
                </label>
                <input
                  id="nickname"
                  type="text"
                  className={inputClassName}
                  value={formData.account_nickname}
                  onChange={handleFormChange('account_nickname')}
                  placeholder="e.g. Operating Account"
                />
              </div>
              <div>
                <label htmlFor="account_type" className={labelClassName}>
                  Account Type
                </label>
                <select
                  id="account_type"
                  className={inputClassName}
                  value={formData.account_type}
                  onChange={handleFormChange('account_type')}
                >
                  {ACCOUNT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="currency" className={labelClassName}>
                  Currency
                </label>
                <input
                  id="currency"
                  type="text"
                  className={inputClassName}
                  value={formData.currency}
                  onChange={handleFormChange('currency')}
                  placeholder="USD"
                />
              </div>
              <div>
                <label htmlFor="gl_account" className={labelClassName}>
                  GL Account Number
                </label>
                <input
                  id="gl_account"
                  type="text"
                  className={inputClassName}
                  value={formData.gl_account_number}
                  onChange={handleFormChange('gl_account_number')}
                  placeholder="1000"
                />
              </div>
              <div>
                <label htmlFor="masked_account" className={labelClassName}>
                  Account Last 4
                </label>
                <input
                  id="masked_account"
                  type="text"
                  className={inputClassName}
                  value={formData.masked_account_number}
                  onChange={handleFormChange('masked_account_number')}
                  placeholder="e.g. 4567"
                  maxLength={4}
                />
              </div>
              <div>
                <label htmlFor="entity_select" className={labelClassName}>
                  Entity (optional)
                </label>
                <select
                  id="entity_select"
                  className={inputClassName}
                  value={formData.entity_id}
                  onChange={handleFormChange('entity_id')}
                >
                  <option value="">No entity</option>
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.institution_name.trim() ||
                  !formData.account_nickname.trim()
                }
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {editingAccount ? 'Update' : 'Add Account'}
              </button>
              <button onClick={handleCancelForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Account Cards */}
        {accounts.length === 0 && !showAddForm ? (
          <div className="ledger-card border border-[rgba(95,227,192,0.15)] rounded-xl p-12 text-center">
            <Landmark className="w-12 h-12 mx-auto mb-4 text-[#5FE3C0] opacity-50" />
            <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
              No bank accounts yet
            </h2>
            <p className="text-[#647D8B] dark:text-[#9FB4BE] mb-6">
              Add a bank or card account to start importing statements.
            </p>
            <button
              onClick={handleAddClick}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEditClick}
                onArchive={handleArchive}
                onUpload={handleUploadClick}
              />
            ))}
          </div>
        )}

        {/* Statement Upload + Preview */}
        {uploadAccount && (
          <StatementUpload
            account={uploadAccount}
            dragOver={dragOver}
            parseResult={parseResult}
            previewRows={previewRows}
            importing={importing}
            selectedCount={selectedCount}
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            fileInputRef={fileInputRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleFileDrop}
            onFileSelect={handleFileSelect}
            onToggleRow={handleToggleRow}
            onEditPayee={handleEditPayee}
            onEditMemo={handleEditMemo}
            onSelectAllToggle={handleSelectAllToggle}
            onConfirm={handleConfirmImport}
            onCancel={handleCancelUpload}
            onProfileChange={handleProfileChange}
          />
        )}
      </div>
    </div>
  )
}
