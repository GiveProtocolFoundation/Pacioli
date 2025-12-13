import React, { useState, useMemo, useCallback } from 'react'
import { Search, Plus, Edit2, Trash2, Save, X, AlertCircle } from 'lucide-react'
import {
  getChartOfAccountsTemplate,
  groupAccountsByType,
} from '../../utils/chartOfAccounts'

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
    // TODO: Implement save to backend
    // Saving account: editingAccount
    setEditingAccount(null)
    setIsAddingNew(false)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingAccount(null)
    setIsAddingNew(false)
  }, [])

  const handleDelete = useCallback((code: string) => {
    // TODO: Implement delete confirmation and backend call
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Chart of Accounts
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {template.name} ({filteredAccounts.length} accounts)
        </p>
      </div>

      {/* Permission Warning */}
      {!canEdit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">View Only</h3>
            <p className="text-sm text-blue-700 mt-1">
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={handleTypeChange}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Account</span>
          </button>
        )}
      </div>

      {/* Accounts Table */}
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
              {/* Editing/Adding Row */}
              {editingAccount && (
                <tr className="bg-blue-50">
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={editingAccount.code}
                      onChange={handleEditingCodeChange}
                      placeholder="Code"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!isAddingNew}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={editingAccount.name}
                      onChange={handleEditingNameChange}
                      placeholder="Account Name"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={editingAccount.type}
                      onChange={handleEditingTypeChange}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {accountTypes
                        .filter(t => t !== 'All')
                        .map(type => (
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
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleSave}
                        className="p-1 text-green-600 hover:text-green-900"
                        title="Save"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="p-1 text-gray-600 hover:text-gray-900"
                        title="Cancel"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data Rows */}
              {filteredAccounts.map(account => (
                <tr
                  key={account.code}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                      {account.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {account.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account.type === 'Asset'
                          ? 'bg-green-100 text-green-800'
                          : account.type === 'Liability'
                            ? 'bg-red-100 text-red-800'
                            : account.type === 'Equity'
                              ? 'bg-blue-100 text-blue-800'
                              : account.type === 'Revenue'
                                ? 'bg-purple-100 text-purple-800'
                                : account.type === 'Expense'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {account.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {account.description}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={createEditHandler(account)}
                          className="p-1 text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={createDeleteHandler(account.code)}
                          className="p-1 text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredAccounts.length === 0 && !editingAccount && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No accounts found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'Try adjusting your search'
                : 'No accounts match the selected filter'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChartOfAccounts
