import React, { useState, useMemo, useCallback } from 'react'
import { Search, Plus, AlertCircle } from 'lucide-react'
import {
  getChartOfAccountsTemplate,
  groupAccountsByType,
} from '../../utils/chartOfAccounts'
import type { ChartOfAccountsEntry } from '../../types/chartOfAccounts'

interface ChartOfAccountsProps {
  jurisdiction?: 'us-gaap' | 'ifrs'
  accountType?: 'individual' | 'sme' | 'not-for-profit'
  userRole?: 'user' | 'admin' | 'system-admin'
}

interface EditingAccount {
  code: string
  name: string
  type: string
  description: string
}

interface AccountsTableProps {
  filteredAccounts: ChartOfAccountsEntry[]
  editingAccount: EditingAccount | null
  isAddingNew: boolean
  accountTypes: string[]
  handleEditingCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleEditingNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleEditingTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  handleEditingDescriptionChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void
  createEditHandler: (account: ChartOfAccountsEntry) => () => void
  createDeleteHandler: (code: string) => () => void
  handleSave: () => void
  handleCancel: () => void
  canEdit: boolean
}

const AccountsTable: React.FC<AccountsTableProps> = ({
  filteredAccounts,
  editingAccount,
  isAddingNew,
  accountTypes,
  handleEditingCodeChange,
  handleEditingNameChange,
  handleEditingTypeChange,
  handleEditingDescriptionChange,
  createEditHandler,
  createDeleteHandler,
  handleSave,
  handleCancel,
  canEdit,
}) => (
  <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Account Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            {canEdit && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {editingAccount && (
            <tr className="bg-[#c9a961]/10">
              <td className="px-6 py-4">
                <input
                  type="text"
                  value={editingAccount.code}
                  onChange={handleEditingCodeChange}
                  placeholder="Code"
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                  disabled={!isAddingNew}
                />
              </td>
              <td className="px-6 py-4">
                <input
                  type="text"
                  value={editingAccount.name}
                  onChange={handleEditingNameChange}
                  placeholder="Name"
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
              </td>
              <td className="px-6 py-4">
                <select
                  value={editingAccount.type}
                  onChange={handleEditingTypeChange}
                  className="select-input w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                >
                  {accountTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4">
                <input
                  type="text"
                  value={editingAccount.description}
                  onChange={handleEditingDescriptionChange}
                  placeholder="Description"
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={handleSave}
                  className="text-[#8b4e52] hover:text-[#7a4248] mr-2"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </td>
            </tr>
          )}
          {filteredAccounts.map(account =>
            !editingAccount || editingAccount.code !== account.code ? (
              <tr
                key={account.code}
                className="text-gray-900 dark:text-gray-100"
              >
                <td className="px-6 py-4">{account.code}</td>
                <td className="px-6 py-4">{account.name}</td>
                <td className="px-6 py-4">{account.type}</td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                  {account.description}
                </td>
                {canEdit && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={createEditHandler(account)}
                      className="text-[#8b4e52] hover:text-[#7a4248] mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={createDeleteHandler(account.code)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ) : null
          )}
        </tbody>
      </table>
    </div>
  </div>
)

const ChartOfAccounts: React.FC<ChartOfAccountsProps> = ({
  jurisdiction = 'us-gaap',
  accountType = 'not-for-profit',
  userRole = 'admin',
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('All')
  const [editingAccount, setEditingAccount] = useState<EditingAccount | null>(
    null
  )
  const [isAddingNew, setIsAddingNew] = useState(false)

  // Load the template
  const template = getChartOfAccountsTemplate(jurisdiction, accountType)

  // Check if user can edit
  const canEdit = useMemo(() => {
    if (accountType === 'individual') return true
    return userRole === 'admin' || userRole === 'system-admin'
  }, [accountType, userRole])

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    if (!template) return {}
    return groupAccountsByType(template)
  }, [template])

  // Get unique account types
  const accountTypes = useMemo(() => {
    return ['All', ...Object.keys(groupedAccounts).sort()]
  }, [groupedAccounts])

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (!template) return []

    let accounts = template.accounts

    // Filter by type
    if (selectedType !== 'All') {
      accounts = accounts.filter(acc => acc.type === selectedType)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      accounts = accounts.filter(
        acc =>
          acc.code.toLowerCase().includes(query) ||
          acc.name.toLowerCase().includes(query) ||
          acc.description?.toLowerCase().includes(query)
      )
    }

    return accounts
  }, [template, selectedType, searchQuery])

  const handleEdit = useCallback(
    (account: NonNullable<typeof template>['accounts'][0]) => {
      setEditingAccount({
        code: account.code,
        name: account.name,
        type: account.type,
        description: account.description || '',
      })
      setIsAddingNew(false)
    },
    []
  )

  const handleAddNew = useCallback(() => {
    setEditingAccount({
      code: '',
      name: '',
      type: accountTypes[1] || 'Asset',
      description: '',
    })
    setIsAddingNew(true)
  }, [accountTypes])

  const handleSave = useCallback(() => {
    // Backend persistence not yet implemented
    setEditingAccount(null)
    setIsAddingNew(false)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingAccount(null)
    setIsAddingNew(false)
  }, [])

  const handleDelete = useCallback((code: string) => {
    // Delete confirmation and backend call not yet implemented
    console.warn('Delete not implemented for account:', code)
  }, [])

  const createEditHandler = useCallback(
    (account: NonNullable<typeof template>['accounts'][0]) => {
      return () => handleEdit(account)
    },
    [handleEdit]
  )

  const createDeleteHandler = useCallback(
    (code: string) => {
      return () => handleDelete(code)
    },
    [handleDelete]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    []
  )

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedType(e.target.value)
    },
    []
  )

  const handleEditingCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingAccount(prev =>
        prev ? { ...prev, code: e.target.value } : null
      )
    },
    []
  )

  const handleEditingNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingAccount(prev =>
        prev ? { ...prev, name: e.target.value } : null
      )
    },
    []
  )

  const handleEditingTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setEditingAccount(prev =>
        prev ? { ...prev, type: e.target.value } : null
      )
    },
    []
  )

  const handleEditingDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingAccount(prev =>
        prev ? { ...prev, description: e.target.value } : null
      )
    },
    []
  )

  if (!template) {
    return (
      <div className="p-6 min-h-screen bg-gray-50 dark:bg-black">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              Chart of Accounts Not Found
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              No chart of accounts template found for{' '}
              {jurisdiction.toUpperCase()} - {accountType}.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="mb-6">
        <h1>Chart of Accounts</h1>
        <p className="text-gray-600 dark:text-[#94a3b8] mt-1">
          {template.name} ({filteredAccounts.length} accounts)
        </p>
      </div>

      {/* Permission Warning */}
      {!canEdit && (
        <div className="mb-6 bg-[#c9a961]/10 border border-[#c9a961]/30 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-[#8b4e52] mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-[#8b4e52]">View Only</h3>
            <p className="text-sm text-[#8b4e52] mt-1">
              Only administrators can edit the chart of accounts for{' '}
              {accountType} accounts.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
          />
        </div>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={handleTypeChange}
          className="select-input px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
        >
          {accountTypes.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Add Button */}
        {canEdit && (
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#8b4e52] text-white rounded-lg hover:bg-[#7a4248]"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Account</span>
          </button>
        )}
      </div>

      {/* Accounts Table */}
      <AccountsTable
        filteredAccounts={filteredAccounts}
        editingAccount={editingAccount}
        isAddingNew={isAddingNew}
        accountTypes={accountTypes}
        handleEditingCodeChange={handleEditingCodeChange}
        handleEditingNameChange={handleEditingNameChange}
        handleEditingTypeChange={handleEditingTypeChange}
        handleEditingDescriptionChange={handleEditingDescriptionChange}
        createEditHandler={createEditHandler}
        createDeleteHandler={createDeleteHandler}
        handleSave={handleSave}
        handleCancel={handleCancel}
        canEdit={canEdit}
      />
    </div>
  )
}

export default ChartOfAccounts
