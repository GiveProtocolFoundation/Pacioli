import React, { useState, useCallback, useMemo } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Receipt,
  Edit2,
  Plus,
} from 'lucide-react'
import ExportDropdown from './ExportDropdown'
import { useTransactions } from '../../contexts/TransactionContext'
import { useCurrency } from '../../contexts/CurrencyContext'
import { useTokens } from '../../contexts/TokenContext'
import { Transaction, TransactionType, TransactionStatus } from '../../types/transaction'
import type { ClassificationStatus } from '../../types/database'
import type { Token, Chain } from '../../types/digitalAssets'

type FilterType = 'all' | 'unclassified' | 'classified' | 'ignored'

/** Tab navigation for filtering transactions by classification status */
const FilterTabs = ({
  filter,
  transactions,
}: {
  filter: string
  transactions: { classificationStatus: ClassificationStatus }[]
}) => (
  <div className="mb-6 border-b border-[rgba(95,227,192,0.15)]">
    <nav className="flex space-x-8">
      {[
        {
          key: 'all',
          label: 'All',
          count: transactions.length,
        },
        {
          key: 'unclassified',
          label: 'Unclassified',
          count: transactions.filter(t => t.classificationStatus === 'unclassified').length,
        },
        {
          key: 'classified',
          label: 'Classified',
          count: transactions.filter(t => t.classificationStatus === 'classified').length,
        },
        {
          key: 'ignored',
          label: 'Ignored',
          count: transactions.filter(t => t.classificationStatus === 'ignored').length,
        },
      ].map(tab => (
        <Link
          key={tab.key}
          to={`/transactions?filter=${tab.key}`}
          className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            filter === tab.key
              ? 'border-[#294050] text-[#294050] dark:text-[#F09988]'
              : 'border-transparent text-[#294050] dark:text-[#9FB4BE] hover:text-[#11202B] dark:hover:text-[#EAF3F2] hover:border-[rgba(95,227,192,0.3)]'
          }`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                filter === tab.key
                  ? 'bg-[#294050]/10 text-[#294050] dark:bg-[#294050]/20 dark:text-[#F09988]'
                  : 'bg-[#EAF3F2] text-[#294050] dark:bg-[#16242F] dark:text-[#9FB4BE]'
              }`}
            >
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  </div>
)

const classificationStyles: Record<ClassificationStatus, string> = {
  unclassified: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  classified: 'bg-[#5FE3C0]/10 text-[#5FE3C0] dark:bg-[#5FE3C0]/20 dark:text-[#9CF1DC]',
  ignored: 'bg-[#294050]/10 text-[#294050] dark:bg-[#294050]/20 dark:text-[#9FB4BE]',
  split: 'bg-[#5FE3C0]/10 text-[#5FE3C0] dark:bg-[#5FE3C0]/20 dark:text-[#5FE3C0]',
}

const classificationLabels: Record<ClassificationStatus, string> = {
  unclassified: 'Unclassified',
  classified: 'Classified',
  ignored: 'Ignored',
  split: 'Split',
}

const ClassificationBadge: React.FC<{ status: ClassificationStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classificationStyles[status]}`}
  >
    {classificationLabels[status]}
  </span>
)

interface TransactionAmountCellProps {
  transaction: Transaction
  getToken: (id: string) => Token | undefined
  getChain: (id: string) => Chain | undefined
  currencySettings: { primaryCurrency: string }
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
}

/** Renders the amount cell in a transaction table row, showing token icon, crypto amount, fiat value, and chain info */
const TransactionAmountCell: React.FC<TransactionAmountCellProps> = ({
  transaction,
  getToken,
  getChain,
  currencySettings,
  handleImageError,
}) => {
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
              ? 'text-[#5FE3C0]'
              : transaction.type === 'expense'
                ? 'text-[#E8836F]'
                : 'text-[#5FE3C0]'
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
      <div className="text-xs text-[#647D8B] dark:text-[#647D8B]">
        {transaction.fiatCurrency ||
          currencySettings.primaryCurrency}{' '}
        {transaction.fiatValue.toLocaleString()}
      </div>
      {chain && (
        <div className="text-xs text-[#647D8B] dark:text-[#647D8B]">
          on {chain.chainName}
        </div>
      )}
    </>
  )
}

/** Transactions list page with search, filtering, and tabular display of all crypto transactions */
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
    urlFilter && ['all', 'unclassified', 'classified', 'ignored'].includes(urlFilter)
      ? urlFilter
      : 'all'

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(tx => {
        if (filter === 'all') return true
        return tx.classificationStatus === filter
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

  /** Returns the appropriate directional arrow icon for a given transaction type */
  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'revenue':
        return <ArrowDownRight className="w-5 h-5 text-[#5FE3C0]" />
      case 'expense':
        return <ArrowUpRight className="w-5 h-5 text-[#E8836F]" />
      case 'transfer':
        return <ArrowLeftRight className="w-5 h-5 text-[#5FE3C0]" />
      default:
        return null
    }
  }

  /** Returns Tailwind CSS color classes for styling a transaction type badge */
  const getTypeColor = (type: TransactionType) => {
    switch (type) {
      case 'revenue':
        return 'text-[#5FE3C0] bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20'
      case 'expense':
        return 'text-[#E8836F] bg-[#E8836F]/10 dark:bg-[#E8836F]/20'
      case 'transfer':
        return 'text-[#5FE3C0] bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20'
      default:
        return 'text-[#294050] bg-[#EAF3F2] dark:bg-[#16242F]'
    }
  }

  /** Returns Tailwind CSS color classes for styling a transaction status badge */
  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-[#5FE3C0] bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 dark:text-[#9CF1DC]'
      case 'pending_approval':
        return 'text-[#E8B36F] bg-[#E8B36F]/10 dark:bg-[#E8B36F]/20 dark:text-[#5FE3C0]'
      case 'draft':
        return 'text-[#294050] bg-[#EAF3F2] dark:bg-[#16242F] dark:text-[#9FB4BE]'
      case 'rejected':
      case 'failed':
        return 'text-[#E8836F] bg-[#E8836F]/10 dark:bg-[#E8836F]/20 dark:text-[#F09988]'
      default:
        return 'text-[#294050] bg-[#EAF3F2] dark:bg-[#16242F] dark:text-[#9FB4BE]'
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
      const id = e.currentTarget.dataset.id
      if (id) {
        navigate(`/transactions/edit/${id}`)
      }
    },
    [navigate]
  )

  const handleEditButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      const id = e.currentTarget.dataset.id
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
          <p className="text-[#294050] dark:text-[#9FB4BE] mt-1">
            View and manage all your crypto transactions
          </p>
        </div>
        <button
          onClick={handleNewTransaction}
          className="flex items-center gap-2 px-4 py-2 bg-[#294050] text-white rounded-lg hover:bg-[#1E2F3C]"
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
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#647D8B]" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-4 pr-10 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] dark:placeholder-[#294050] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0]"
          />
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] text-[#294050] dark:text-[#9FB4BE]">
            <Calendar className="w-5 h-5" />
            <span className="hidden sm:inline">Date Range</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] text-[#294050] dark:text-[#9FB4BE]">
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <ExportDropdown transactions={filteredTransactions} />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#EAF3F2] dark:bg-[#11202B] border-b border-[rgba(95,227,192,0.15)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Classification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#F7FAFA] dark:bg-[#0C141B] divide-y divide-[rgba(95,227,192,0.1)]">
              {filteredTransactions.map(transaction => (
                <tr
                  key={transaction.id}
                  data-id={transaction.id}
                  className="hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] cursor-pointer"
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
                    <div className="text-sm text-[#11202B] dark:text-[#EAF3F2]">
                      {new Date(transaction.date).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
                      {transaction.description}
                    </div>
                    {transaction.hash && (
                      <div className="text-xs text-[#647D8B] dark:text-[#647D8B]">
                        {transaction.hash}
                      </div>
                    )}
                    {transaction.memo && (
                      <div className="text-xs text-[#647D8B] dark:text-[#647D8B] mt-1">
                        {transaction.memo}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-[#11202B] dark:text-[#EAF3F2]">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-[#294050] dark:text-[#9FB4BE]">
                      {transaction.wallet}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TransactionAmountCell
                      transaction={transaction}
                      getToken={getToken}
                      getChain={getChain}
                      currencySettings={currencySettings}
                      handleImageError={handleImageError}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}
                    >
                      {getStatusLabel(transaction.status)}
                    </span>
                    {transaction.approvalStatus === 'rejected' &&
                      transaction.rejectionReason && (
                        <div className="text-xs text-[#E8836F] dark:text-[#F09988] mt-1">
                          {transaction.rejectionReason}
                        </div>
                      )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <ClassificationBadge status={transaction.classificationStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        data-id={transaction.id}
                        onClick={handleEditButtonClick}
                        className="text-[#294050] hover:text-[#1E2F3C] dark:text-[#F09988] dark:hover:text-[#F09988]"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          navigate('/journal-entries?new=true')
                        }}
                        className="px-2 py-1 text-xs font-medium rounded bg-[#294050]/10 text-[#294050] hover:bg-[#294050]/20 transition-colors"
                      >
                        Classify &rarr;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="mx-auto h-12 w-12 text-[#647D8B]" />
            <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
              No transactions found
            </h3>
            <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating a new transaction'}
            </p>
            <div className="mt-6">
              <button
                onClick={handleNewTransaction}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#294050] hover:bg-[#1E2F3C]"
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
          <div className="text-sm text-[#294050] dark:text-[#9FB4BE]">
            Showing <span className="font-medium">1</span> to{' '}
            <span className="font-medium">{filteredTransactions.length}</span>{' '}
            of{' '}
            <span className="font-medium">{filteredTransactions.length}</span>{' '}
            results
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-[rgba(95,227,192,0.15)] rounded bg-[#F7FAFA] dark:bg-[#11202B] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] text-sm text-[#294050] dark:text-[#9FB4BE]">
              Previous
            </button>
            <button className="px-3 py-1 border rounded text-sm bg-[#294050]/10 text-[#294050] border-[#294050] dark:bg-[#294050]/20 dark:text-[#F09988] dark:border-[#F09988]">
              1
            </button>
            <button className="px-3 py-1 border border-[rgba(95,227,192,0.15)] rounded bg-[#F7FAFA] dark:bg-[#11202B] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] text-sm text-[#294050] dark:text-[#9FB4BE]">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
