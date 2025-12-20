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

  /**
   * AccountsTable component renders a table displaying the filtered accounts,
   * allows editing, saving, canceling, editing creation, and deletion of accounts.
   *
   * @param filteredAccounts - Array of accounts filtered based on search or criteria.
   * @param editingAccount - The account currently being edited or null if none.
   * @param isAddingNew - Flag indicating if a new account row is being added.
   * @param handleEditingCodeChange - Callback for handling changes to the account code input.
   * @param handleEditingNameChange - Callback for handling changes to the account name input.
   * @param handleEditingTypeChange - Callback for handling changes to the account type select.
   * @param handleEditingDescriptionChange - Callback for handling changes to the account description input.
   * @param createEditHandler - Function that returns an edit handler for a given account.
   * @param createDeleteHandler - Function that returns a delete handler for a given account code.
   * @param handleSave - Callback invoked when saving changes.
   * @param handleCancel - Callback invoked when canceling edits.
   * @param canEdit - Boolean indicating whether editing is permitted.
   * @returns JSX.Element - The rendered table element.
   */
  const AccountsTable: React.FC<{
    filteredAccounts: typeof filteredAccounts
    editingAccount: typeof editingAccount
    isAddingNew: boolean
    handleEditingCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleEditingNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleEditingTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
    handleEditingDescriptionChange: (
      e: React.ChangeEvent<HTMLInputElement>
    ) => void
    createEditHandler: (
      account: NonNullable<typeof template>['accounts'][0]
    ) => () => void
    createDeleteHandler: (code: string) => () => void
    handleSave: () => void
    handleCancel: () => void
    canEdit: boolean
  }> = ({
    filteredAccounts,
    editingAccount,
    isAddingNew,
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
                    placeholder="Name"
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4">
                  <select
                    value={editingAccount.type}
                    onChange={handleEditingTypeChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={handleSave}
                    className="text-blue-600 hover:text-blue-900 mr-2"
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
                <tr key={account.code}>
                  <td className="px-6 py-4">{account.code}</td>
                  <td className="px-6 py-4">{account.name}</td>
                  <td className="px-6 py-4">{account.type}</td>
                  <td className="px-6 py-4">{account.description}</td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={createEditHandler(account)}
                        className="text-blue-600 hover:text-blue-900 mr-2"
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
        <p className="text-gray-600 dark:text-[#94a3b8] mt-1">
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
      <AccountsTable
        filteredAccounts={filteredAccounts}
        editingAccount={editingAccount}
        isAddingNew={isAddingNew}
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
