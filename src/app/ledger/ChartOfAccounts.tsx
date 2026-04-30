import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Scale,
} from 'lucide-react'
import type { GLAccount } from '../../types/database'

const accountTypeOrder = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']

const accountTypeColors: Record<string, string> = {
  Asset: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  Liability:
    'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  Equity:
    'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  Income:
    'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  Expense:
    'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
}

interface AccountGroupProps {
  typeName: string
  accounts: GLAccount[]
  expanded: boolean
  onToggle: () => void
}

/** A collapsible group of accounts by type */
const AccountGroup: React.FC<AccountGroupProps> = ({
  typeName,
  accounts,
  expanded,
  onToggle,
}) => {
  const colorClass =
    accountTypeColors[typeName] ?? 'text-gray-700 bg-gray-50'

  return (
    <div className="border border-[rgba(201,169,97,0.15)] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 bg-[#f3f1ed] dark:bg-[#2a2620] hover:bg-[#ede8e0] dark:hover:bg-[#332e28] transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[#696557]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#696557]" />
          )}
          <span
            className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}
          >
            {typeName}
          </span>
          <span className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
            {typeName === 'Income' ? 'Revenue' : `${typeName}s`}
          </span>
        </div>
        <span className="text-xs text-[#696557] dark:text-[#b8b3ac]">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <table className="min-w-full">
          <thead>
            <tr className="bg-[#fafaf8] dark:bg-[#1a1815]">
              <th className="px-5 py-2 text-left text-xs font-semibold text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider w-28">
                Number
              </th>
              <th className="px-5 py-2 text-left text-xs font-semibold text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                Name
              </th>
              <th className="px-5 py-2 text-left text-xs font-semibold text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                Normal Balance
              </th>
              <th className="px-5 py-2 text-left text-xs font-semibold text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                Description
              </th>
              <th className="px-5 py-2 text-center text-xs font-semibold text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider w-20">
                System
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(201,169,97,0.08)]">
            {accounts.map(acct => (
              <tr
                key={acct.id}
                className="bg-white dark:bg-[#1a1815] hover:bg-[#f3f1ed]/50 dark:hover:bg-[#2a2620]/50 transition-colors"
              >
                <td className="px-5 py-2.5 text-sm font-mono text-[#8b4e52] dark:text-[#c9a961] font-medium">
                  {acct.accountNumber}
                </td>
                <td className="px-5 py-2.5 text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                  {acct.parentAccountId ? (
                    <span className="ml-4">{acct.accountName}</span>
                  ) : (
                    <span className="font-medium">{acct.accountName}</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-sm text-[#696557] dark:text-[#b8b3ac] capitalize">
                  {acct.normalBalance ?? '—'}
                </td>
                <td className="px-5 py-2.5 text-sm text-[#696557] dark:text-[#b8b3ac] max-w-xs truncate">
                  {acct.description ?? '—'}
                </td>
                <td className="px-5 py-2.5 text-center">
                  {!acct.isEditable && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      System
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

interface AddAccountFormProps {
  accounts: GLAccount[]
  onClose: () => void
  onSaved: () => void
}

/** Inline form for adding a new GL account */
const AddAccountForm: React.FC<AddAccountFormProps> = ({
  accounts,
  onClose,
  onSaved,
}) => {
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('Asset')
  const [description, setDescription] = useState('')
  const [parentAccountId, setParentAccountId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setError(null)
    setSaving(true)
    try {
      await invoke('create_gl_account', {
        input: {
          accountNumber,
          accountName,
          accountType,
          parentAccountId: parentAccountId || null,
          description: description || null,
          digitalAssetType: null,
          subcategory: null,
          normalBalance: null,
        },
      })
      onSaved()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }, [
    accountNumber,
    accountName,
    accountType,
    parentAccountId,
    description,
    onSaved,
  ])

  return (
    <div className="p-4 border border-[rgba(201,169,97,0.15)] rounded-lg bg-white dark:bg-[#1a1815] space-y-3">
      {error && (
        <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#696557] dark:text-[#b8b3ac] mb-1">
            Account Number
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            placeholder="e.g. 1250"
            className="w-full px-3 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-sm text-[#1a1815] dark:text-[#f5f3f0] placeholder-[#a39d94]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#696557] dark:text-[#b8b3ac] mb-1">
            Account Name
          </label>
          <input
            type="text"
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="e.g. BTC Holdings"
            className="w-full px-3 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-sm text-[#1a1815] dark:text-[#f5f3f0] placeholder-[#a39d94]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#696557] dark:text-[#b8b3ac] mb-1">
            Account Type
          </label>
          <select
            value={accountType}
            onChange={e => setAccountType(e.target.value)}
            className="w-full px-3 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-sm text-[#1a1815] dark:text-[#f5f3f0]"
          >
            {accountTypeOrder.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#696557] dark:text-[#b8b3ac] mb-1">
            Parent Account
          </label>
          <select
            value={parentAccountId}
            onChange={e =>
              setParentAccountId(
                e.target.value ? parseInt(e.target.value) : ''
              )
            }
            className="w-full px-3 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-sm text-[#1a1815] dark:text-[#f5f3f0]"
          >
            <option value="">None (top-level)</option>
            {accounts
              .filter(a => a.accountType === accountType)
              .map(a => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber} · {a.accountName}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#696557] dark:text-[#b8b3ac] mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full px-3 py-1.5 rounded border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#141210] text-sm text-[#1a1815] dark:text-[#f5f3f0] placeholder-[#a39d94]"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded border border-[rgba(201,169,97,0.15)] text-[#696557] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !accountNumber || !accountName}
          className="px-3 py-1.5 text-sm rounded bg-[#8b4e52] text-white hover:bg-[#7a4248] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/** Chart of Accounts page */
const ChartOfAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTypes, setExpandedTypes] = useState<string[]>(
    accountTypeOrder
  )
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<GLAccount[]>('get_chart_of_accounts')
      setAccounts(result)
    } catch (err) {
      console.error('Failed to fetch chart of accounts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts
    const q = searchQuery.toLowerCase()
    return accounts.filter(
      a =>
        a.accountNumber.toLowerCase().includes(q) ||
        a.accountName.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q)
    )
  }, [accounts, searchQuery])

  const grouped = useMemo(() => {
    const groups: Record<string, GLAccount[]> = {}
    for (const t of accountTypeOrder) groups[t] = []
    for (const acct of filteredAccounts) {
      const type = acct.accountType as string
      if (groups[type]) groups[type].push(acct)
    }
    return groups
  }, [filteredAccounts])

  const handleToggleType = useCallback((typeName: string) => {
    setExpandedTypes(prev =>
      prev.includes(typeName)
        ? prev.filter(t => t !== typeName)
        : [...prev, typeName]
    )
  }, [])

  const handleAccountSaved = useCallback(() => {
    setShowAddForm(false)
    fetchAccounts()
  }, [fetchAccounts])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0]">
            Chart of Accounts
          </h1>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
            General ledger accounts organized by type
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8b4e52] text-white hover:bg-[#7a4248] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Add account form */}
      {showAddForm && (
        <div className="mb-4">
          <AddAccountForm
            accounts={accounts}
            onClose={() => setShowAddForm(false)}
            onSaved={handleAccountSaved}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a39d94]" />
        <input
          type="text"
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-[rgba(201,169,97,0.15)] bg-white dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] placeholder-[#a39d94] text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a961]"
        />
      </div>

      {/* Account groups */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8b4e52]" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="w-12 h-12 text-[#a39d94] mb-4" />
          <h3 className="text-lg font-medium text-[#1a1815] dark:text-[#f5f3f0]">
            No accounts yet
          </h3>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
            Accounts will be seeded when the database initializes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accountTypeOrder.map(typeName => {
            const typeAccounts = grouped[typeName] ?? []
            if (typeAccounts.length === 0 && searchQuery) return null
            return (
              <AccountGroup
                key={typeName}
                typeName={typeName}
                accounts={typeAccounts}
                expanded={expandedTypes.includes(typeName)}
                onToggle={() => handleToggleType(typeName)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ChartOfAccounts
