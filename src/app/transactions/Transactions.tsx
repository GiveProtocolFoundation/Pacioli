import React, { useState, useCallback, useMemo } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Receipt,
  Edit2,
  Plus,
} from 'lucide-react'
import { useTransactions } from '../../contexts/TransactionContext'
import { useCurrency } from '../../contexts/CurrencyContext'
import { useTokens } from '../../contexts/TokenContext'
import { TransactionType, TransactionStatus } from '../../types/transaction'

type FilterType = 'all' | 'revenue' | 'expense' | 'transfers'

const Transactions: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { transactions } = useTransactions()
  const { settings: currencySettings } = useCurrency()
  const { getToken, getChain } = useTokens()
  const [searchQuery, setSearchQuery] = useState('')

  const params = new URLSearchParams(location.search)
  const urlFilter = params.get('filter') as FilterType
  const filter: FilterType =
    urlFilter && ['all', 'revenue', 'expense', 'transfers'].includes(urlFilter)
      ? urlFilter
      : 'all'

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(tx => {
        if (filter === 'all') return true
        if (filter === 'transfers') return tx.type === 'transfer'
        return tx.type === filter
      })
      .filter(tx => {
        if (!searchQuery) return true
        return (
          tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (tx.hash && tx.hash.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      })
  }, [transactions, filter, searchQuery])

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'revenue':
        return <ArrowDownRight className="w-5 h-5 text-green-600" />
      case 'expense':
        return <ArrowUpRight className="w-5 h-5 text-red-600" />
      case 'transfer':
        return <ArrowLeftRight className="w-5 h-5 text-blue-600" />
      default:
        return null
    }
  }

  const getTypeColor = (type: TransactionType) => {
    switch (type) {
      case 'revenue':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20'
      case 'expense':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      case 'transfer':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'pending_approval':
        return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'draft':
        return 'text-gray-700 bg-gray-100 dark:bg-gray-900/30 dark:text-[#94a3b8]'
      case 'rejected':
      case 'failed':
        return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'text-gray-700 bg-gray-100 dark:bg-gray-900/30 dark:text-[#94a3b8]'
    }
  }

  const getStatusLabel = (status: TransactionStatus) => {
    switch (status) {
      case 'pending_approval':
        return 'Pending Approval'
      case 'completed':
        return 'Completed'
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'draft':
        return 'Draft'
      case 'failed':
        return 'Failed'
      default:
        return status
    }
  }

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    []
  )

  const handleNewTransaction = useCallback(() => {
    navigate('/transactions/new')
  }, [navigate])

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      const id = e.currentTarget.getAttribute('data-id')
      if (id) {
        navigate(`/transactions/edit/${id}`)
      }
    },
    [navigate]
  )

  const handleEditButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      const id = e.currentTarget.getAttribute('data-id')
      if (id) {
        navigate(`/transactions/edit/${id}`)
      }
    },
    [navigate]
  )

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.style.display = 'none'
    },
    []
  )

  const FilterTabs = ({
    filter,
    transactions,
  }: {
    filter: string
    transactions: any[]
  }) => (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="flex space-x-8">
        {[
          {
            key: 'all',
            label: 'All Transactions',
            count: transactions.length,
          },
          {
            key: 'revenue',
            label: 'Revenue',
            count: transactions.filter(t => t.type === 'revenue').length,
          },
          {
            key: 'expense',
            label: 'Expense',
            count: transactions.filter(t => t.type === 'expense').length,
          },
          {
            key: 'transfers',
            label: 'Transfers',
            count: transactions.filter(t => t.type === 'transfer').length,
          },
        ].map(tab => (
          <Link
            key={tab.key}
            to={`/transactions?filter=${tab.key}`}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              filter === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-[#94a3b8] hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                filter === tab.key
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-[#94a3b8]'
              }`}
            >
              {tab.count}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )

  return (
    <div className="p-6 min-h-screen ledger-background">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Transactions
          </h1>
          <p className="text-gray-600 dark:text-[#94a3b8] mt-1">
            View and manage all your crypto transactions
          </p>
        </div>
        <button
          onClick={handleNewTransaction}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Transaction
        </button>
      </div>

      {/* Filter Tabs */}
      <FilterTabs filter={filter} transactions={transactions} />

      {/* Search and Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <Calendar className="w-5 h-5" />
            <span className="hidden sm:inline">Date Range</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.map(transaction => (
                <tr
                  key={transaction.id}
                  data-id={transaction.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={handleRowClick}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${getTypeColor(transaction.type)}`}
                    >
                      {getTypeIcon(transaction.type)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {new Date(transaction.date).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </div>
                    {transaction.hash && (
                      <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                        {transaction.hash}
                      </div>
                    )}
                    {transaction.memo && (
                      <div className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
                        {transaction.memo}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                      {transaction.wallet}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const token = getToken(transaction.tokenId)
                      const chain = getChain(transaction.chainId)
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            {token?.iconUrl && (
                              <img
                                src={token.iconUrl}
                                alt={token.symbol}
                                className="w-5 h-5 rounded-full"
                                onError={handleImageError}
                              />
                            )}
                            <div
                              className={`text-sm font-semibold ${
                                transaction.type === 'revenue'
                                  ? 'text-green-600'
                                  : transaction.type === 'expense'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                              }`}
                            >
                              {transaction.type === 'revenue'
                                ? '+'
                                : transaction.type === 'expense'
                                  ? '-'
                                  : ''}
                              {transaction.amount}{' '}
                              {token?.symbol || transaction.crypto}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                            {transaction.fiatCurrency ||
                              currencySettings.primaryCurrency}{' '}
                            {transaction.fiatValue.toLocaleString()}
                          </div>
                          {chain && (
                            <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                              on {chain.chainName}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}
                    >
                      {getStatusLabel(transaction.status)}
                    </span>
                    {transaction.approvalStatus === 'rejected' &&
                      transaction.rejectionReason && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {transaction.rejectionReason}
                        </div>
                      )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      data-id={transaction.id}
                      onClick={handleEditButtonClick}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No transactions found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#94a3b8]">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating a new transaction'}
            </p>
            <div className="mt-6">
              <button
                onClick={handleNewTransaction}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Transaction
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredTransactions.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">1</span> to{' '}
            <span className="font-medium">{filteredTransactions.length}</span>{' '}
            of{' '}
            <span className="font-medium">{filteredTransactions.length}</span>{' '}
            results
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
              Previous
            </button>
            <button className="px-3 py-1 border rounded text-sm bg-blue-50 text-blue-600 border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-400">
              1
            </button>
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
