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

const FilterTabs = ({
  filter,
  transactions,
}: {
  filter: string
  transactions: { type: TransactionType }[]
}) => (
  <div className="mb-6 border-b border-[rgba(201,169,97,0.15)]">
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
              ? 'border-[#8b4e52] text-[#8b4e52] dark:text-[#a86e72]'
              : 'border-transparent text-[#696557] dark:text-[#b8b3ac] hover:text-[#1a1815] dark:hover:text-[#f5f3f0] hover:border-[rgba(201,169,97,0.3)]'
          }`}
        >
          {tab.label}
          <span
            className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              filter === tab.key
                ? 'bg-[#8b4e52]/10 text-[#8b4e52] dark:bg-[#8b4e52]/20 dark:text-[#a86e72]'
                : 'bg-[#f3f1ed] text-[#696557] dark:bg-[#2a2620] dark:text-[#b8b3ac]'
            }`}
          >
            {tab.count}
          </span>
        </Link>
      ))}
    </nav>
  </div>
)

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
        return <ArrowDownRight className="w-5 h-5 text-[#7a9b6f]" />
      case 'expense':
        return <ArrowUpRight className="w-5 h-5 text-[#9d6b6b]" />
      case 'transfer':
        return <ArrowLeftRight className="w-5 h-5 text-[#c9a961]" />
      default:
        return null
    }
  }

  const getTypeColor = (type: TransactionType) => {
    switch (type) {
      case 'revenue':
        return 'text-[#7a9b6f] bg-[#7a9b6f]/10 dark:bg-[#7a9b6f]/20'
      case 'expense':
        return 'text-[#9d6b6b] bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20'
      case 'transfer':
        return 'text-[#c9a961] bg-[#c9a961]/10 dark:bg-[#c9a961]/20'
      default:
        return 'text-[#696557] bg-[#f3f1ed] dark:bg-[#2a2620]'
    }
  }

  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-[#7a9b6f] bg-[#7a9b6f]/10 dark:bg-[#7a9b6f]/20 dark:text-[#8faf84]'
      case 'pending_approval':
        return 'text-[#b89968] bg-[#b89968]/10 dark:bg-[#b89968]/20 dark:text-[#c9a961]'
      case 'draft':
        return 'text-[#696557] bg-[#f3f1ed] dark:bg-[#2a2620] dark:text-[#b8b3ac]'
      case 'rejected':
      case 'failed':
        return 'text-[#9d6b6b] bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20 dark:text-[#b88585]'
      default:
        return 'text-[#696557] bg-[#f3f1ed] dark:bg-[#2a2620] dark:text-[#b8b3ac]'
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

  return (
    <div className="p-6 min-h-screen ledger-background">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Transactions</h1>
          <p className="text-[#696557] dark:text-[#b8b3ac] mt-1">
            View and manage all your crypto transactions
          </p>
        </div>
        <button
          onClick={handleNewTransaction}
          className="flex items-center gap-2 px-4 py-2 bg-[#8b4e52] text-white rounded-lg hover:bg-[#7a4248]"
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] placeholder-[#a39d94] dark:placeholder-[#696557] focus:outline-none focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961]"
          />
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] text-[#696557] dark:text-[#b8b3ac]">
            <Calendar className="w-5 h-5" />
            <span className="hidden sm:inline">Date Range</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] text-[#696557] dark:text-[#b8b3ac]">
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#8b4e52] text-white rounded-lg hover:bg-[#7a4248]">
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg border border-[rgba(201,169,97,0.15)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f3f1ed] dark:bg-[#1a1815] border-b border-[rgba(201,169,97,0.15)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#696557] dark:text-[#b8b3ac] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#fafaf8] dark:bg-[#0f0e0c] divide-y divide-[rgba(201,169,97,0.1)]">
              {filteredTransactions.map(transaction => (
                <tr
                  key={transaction.id}
                  data-id={transaction.id}
                  className="hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815] cursor-pointer"
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
                    <div className="text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                      {new Date(transaction.date).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                      {transaction.description}
                    </div>
                    {transaction.hash && (
                      <div className="text-xs text-[#a39d94] dark:text-[#8b8580]">
                        {transaction.hash}
                      </div>
                    )}
                    {transaction.memo && (
                      <div className="text-xs text-[#a39d94] dark:text-[#8b8580] mt-1">
                        {transaction.memo}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-[#696557] dark:text-[#b8b3ac]">
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
                                  ? 'text-[#7a9b6f]'
                                  : transaction.type === 'expense'
                                    ? 'text-[#9d6b6b]'
                                    : 'text-[#c9a961]'
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
                          <div className="text-xs text-[#a39d94] dark:text-[#8b8580]">
                            {transaction.fiatCurrency ||
                              currencySettings.primaryCurrency}{' '}
                            {transaction.fiatValue.toLocaleString()}
                          </div>
                          {chain && (
                            <div className="text-xs text-[#a39d94] dark:text-[#8b8580]">
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
                        <div className="text-xs text-[#9d6b6b] dark:text-[#b88585] mt-1">
                          {transaction.rejectionReason}
                        </div>
                      )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      data-id={transaction.id}
                      onClick={handleEditButtonClick}
                      className="text-[#8b4e52] hover:text-[#7a4248] dark:text-[#a86e72] dark:hover:text-[#b88585]"
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
            <Receipt className="mx-auto h-12 w-12 text-[#a39d94]" />
            <h3 className="mt-2 text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
              No transactions found
            </h3>
            <p className="mt-1 text-sm text-[#696557] dark:text-[#b8b3ac]">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating a new transaction'}
            </p>
            <div className="mt-6">
              <button
                onClick={handleNewTransaction}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#8b4e52] hover:bg-[#7a4248]"
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
          <div className="text-sm text-[#696557] dark:text-[#b8b3ac]">
            Showing <span className="font-medium">1</span> to{' '}
            <span className="font-medium">{filteredTransactions.length}</span>{' '}
            of{' '}
            <span className="font-medium">{filteredTransactions.length}</span>{' '}
            results
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-[rgba(201,169,97,0.15)] rounded bg-[#fafaf8] dark:bg-[#1a1815] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] text-sm text-[#696557] dark:text-[#b8b3ac]">
              Previous
            </button>
            <button className="px-3 py-1 border rounded text-sm bg-[#8b4e52]/10 text-[#8b4e52] border-[#8b4e52] dark:bg-[#8b4e52]/20 dark:text-[#a86e72] dark:border-[#a86e72]">
              1
            </button>
            <button className="px-3 py-1 border border-[rgba(201,169,97,0.15)] rounded bg-[#fafaf8] dark:bg-[#1a1815] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] text-sm text-[#696557] dark:text-[#b8b3ac]">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
