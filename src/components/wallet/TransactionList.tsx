import React, { useMemo, useState, useCallback } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Loader,
  AlertCircle,
  Download,
  Upload,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import { formatBalance } from '@polkadot/util'
import type {
  Transaction,
  SubstrateTransaction,
} from '../../services/wallet/types'
import { useTransactions } from '../../contexts/TransactionContext'
import type { TransactionFormData } from '../../types/transaction'

interface TransactionListProps {
  transactions: Transaction[]
  isLoading?: boolean
  error?: string | null
  onPurge?: () => void
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  isLoading,
  error,
  onPurge,
}) => {
  const { addTransaction } = useTransactions()
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)

  // Sort transactions by block number (newest first)
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.blockNumber - a.blockNumber)
  }, [transactions])

  // Helper: Get network decimals
  const getNetworkDecimals = useCallback((network: string): number => {
    const networkDecimals: Record<string, number> = {
      polkadot: 10,
      kusama: 12,
      moonbeam: 18,
      moonriver: 18,
      astar: 18,
      acala: 12,
    }
    return networkDecimals[network] || 10
  }, [])

  // Get token symbol based on network
  const getTokenSymbol = useCallback((tx: Transaction): string => {
    const substrateTx = tx as SubstrateTransaction

    // Map network to token symbol
    const networkTokens: Record<string, string> = {
      polkadot: 'DOT',
      kusama: 'KSM',
      moonbeam: 'GLMR',
      moonriver: 'MOVR',
      astar: 'ASTR',
      acala: 'ACA',
    }

    return networkTokens[substrateTx.network] || 'Token'
  }, [])

  // Format amount with proper decimals and token symbol
  const formatAmount = useCallback((tx: Transaction): string => {
    if (tx.value === '0') return '—'

    const substrateTx = tx as SubstrateTransaction

    // Get decimals for each network
    const networkDecimals: Record<string, number> = {
      polkadot: 10, // DOT has 10 decimals
      kusama: 12, // KSM has 12 decimals
      moonbeam: 18, // GLMR has 18 decimals (Ethereum-compatible)
      moonriver: 18, // MOVR has 18 decimals
      astar: 18, // ASTR has 18 decimals
      acala: 12, // ACA has 12 decimals
    }

    const decimals = networkDecimals[substrateTx.network] || 10
    const symbol = getTokenSymbol(tx)

    // Format with correct decimals
    const formatted = formatBalance(tx.value, {
      decimals,
      withUnit: false,
      forceUnit: '-',
    })

    return `${formatted} ${symbol}`
  }, [getTokenSymbol])

  // Import wallet transactions to accounting ledger
  const importToLedger = useCallback(async () => {
    setImporting(true)
    setImportSuccess(false)

    try {
      for (const tx of sortedTransactions) {
        const substrateTx = tx as SubstrateTransaction

        // Convert wallet transaction to accounting format
        // Format date as YYYY-MM-DDTHH:MM for datetime-local input compatibility
        const txDate = new Date(tx.timestamp)
        const formattedDate = txDate.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
        const accountingTx: TransactionFormData = {
          date: formattedDate,
          description: `${substrateTx.section}.${substrateTx.method} - ${substrateTx.network}`,
          type: 'transfer', // Blockchain transactions are transfers
          category: substrateTx.section, // e.g., "balances", "staking"
          wallet: tx.from,

          // Token information
          tokenId: getTokenSymbol(tx), // DOT, KSM, etc.
          chainId: substrateTx.network,
          amount: parseFloat(
            formatBalance(tx.value, {
              decimals: getNetworkDecimals(substrateTx.network),
              withUnit: false,
              forceUnit: '-',
            })
          ),

          // Fiat valuation (placeholder - you'd need price API)
          fiatValue: 0,
          fiatCurrency: 'USD',

          // Blockchain details
          hash: tx.hash,

          // Additional metadata
          memo: `Block #${tx.blockNumber} - Status: ${tx.status}`,
        }

        await addTransaction(accountingTx)
      }

      setImportSuccess(true)
      setTimeout(() => setImportSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to import transactions:', err)
      alert('Failed to import transactions. See console for details.')
    } finally {
      setImporting(false)
    }
  }, [sortedTransactions, addTransaction, getNetworkDecimals, getTokenSymbol])

  // Handle purge confirmation
  const handlePurge = useCallback(() => {
    setShowPurgeConfirm(false)
    if (onPurge) {
      onPurge()
    }
  }, [onPurge])

  const handleShowPurgeConfirm = useCallback(() => {
    setShowPurgeConfirm(true)
  }, [])

  const handleHidePurgeConfirm = useCallback(() => {
    setShowPurgeConfirm(false)
  }, [])

  // Export transactions to CSV
  const exportToCSV = useCallback(() => {
    if (transactions.length === 0) return

    // CSV header
    const headers = [
      'Date',
      'Time',
      'Type',
      'From',
      'To',
      'Amount',
      'Token',
      'Status',
      'Hash',
      'Block',
    ]

    // Convert transactions to CSV rows
    const rows = sortedTransactions.map(tx => {
      const substrateTx = tx as SubstrateTransaction
      const date = new Date(tx.timestamp)
      const dateStr = date.toLocaleDateString('en-US')
      const timeStr = date.toLocaleTimeString('en-US')
      const symbol = getTokenSymbol(tx)
      const amount = formatAmount(tx).replace(` ${symbol}`, '') // Remove symbol for separate column

      return [
        dateStr,
        timeStr,
        substrateTx.section
          ? `${substrateTx.section}.${substrateTx.method}`
          : tx.type,
        tx.from,
        tx.to || '',
        amount,
        symbol,
        tx.status,
        tx.hash,
        tx.blockNumber,
      ]
    })

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `polkadot-transactions-${new Date().toISOString().split('T')[0]}.csv`
    )
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [transactions.length, sortedTransactions, getTokenSymbol, formatAmount])

  // Get explorer URL for a transaction
  const getExplorerUrl = (tx: Transaction): string => {
    const substrateTx = tx as SubstrateTransaction
    const network = substrateTx.network

    // Subscan explorer URLs for different networks
    const explorerBaseUrls: Record<string, string> = {
      polkadot: 'https://polkadot.subscan.io',
      kusama: 'https://kusama.subscan.io',
      moonbeam: 'https://moonbeam.subscan.io',
      moonriver: 'https://moonriver.subscan.io',
      astar: 'https://astar.subscan.io',
      acala: 'https://acala.subscan.io',
    }

    const baseUrl = explorerBaseUrls[network] || 'https://polkadot.subscan.io'

    // Use extrinsic hash if available, otherwise use block number
    if (tx.hash && tx.hash !== '') {
      return `${baseUrl}/extrinsic/${tx.hash}`
    } else {
      return `${baseUrl}/block/${tx.blockNumber}`
    }
  }

  // Get transaction type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'transfer':
        return 'bg-[#1e3a5f]/10 text-[#1e3a5f] dark:bg-[#3d5a80]/20 dark:text-[#3d5a80]'
      case 'staking':
        return 'bg-[#4a5f7a]/10 text-[#4a5f7a] dark:bg-[#6b8099]/10 dark:text-[#6b8099]'
      case 'xcm':
        return 'bg-[#8b7355]/10 text-[#8b7355] dark:bg-[#a38a6f]/10 dark:text-[#a38a6f]'
      case 'governance':
        return 'bg-[#059669]/10 text-[#059669] dark:bg-[#10b981]/20 dark:text-[#10b981]'
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  // Format address for display
  const formatAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 animate-spin text-[#1e3a5f] dark:text-[#3d5a80]" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading transaction history...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ledger-card ledger-card-expense border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-[#dc2626] dark:text-[#ef4444] mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#dc2626] dark:text-[#ef4444]">
              Error Loading Transactions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="ledger-card ledger-card-wallet border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Transactions Found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connect a wallet and sync to view transaction history
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transaction History
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {transactions.length} transaction
              {transactions.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="text-sm text-[#1e3a5f] dark:text-[#3d5a80] hover:opacity-90 font-medium transition-opacity inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={importToLedger}
              disabled={importing || importSuccess}
              className="text-sm px-3 py-1.5 bg-[#1e3a5f] dark:bg-[#3d5a80] text-white hover:opacity-90 font-medium transition-opacity inline-flex items-center gap-1.5 rounded disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : importSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Imported!
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import to Ledger
                </>
              )}
            </button>
            <button
              onClick={handleShowPurgeConfirm}
              className="text-sm px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white hover:opacity-90 font-medium transition-opacity inline-flex items-center gap-1.5 rounded"
            >
              <Trash2 className="w-4 h-4" />
              Purge Data
            </button>
          </div>
        </div>
      </div>

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Purge Transaction Data?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This will permanently delete all {transactions.length} wallet
                  transactions from IndexedDB. This action cannot be undone. You
                  can re-sync from the blockchain anytime.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleHidePurgeConfirm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-700 rounded hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
              >
                Yes, Purge Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead className="ledger-table-header">
            <tr>
              <th className="ledger-table-cell-text text-left">Time</th>
              <th className="ledger-table-cell-text text-left">Type</th>
              <th className="ledger-table-cell-text text-left">From</th>
              <th className="ledger-table-cell-text text-left">To</th>
              <th className="ledger-table-cell-number text-right">Amount</th>
              <th className="ledger-table-cell-text text-left">Status</th>
              <th className="ledger-table-cell-actions text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map(tx => {
              const isSubstrate = 'method' in tx
              const substrateTx = tx as SubstrateTransaction

              return (
                <tr key={tx.id} className="ledger-table-row">
                  {/* Timestamp */}
                  <td className="ledger-table-cell-text whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatTimestamp(tx.timestamp)}
                  </td>

                  {/* Type Badge */}
                  <td className="ledger-table-cell-text whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(tx.type)}`}
                    >
                      {isSubstrate
                        ? `${substrateTx.section}.${substrateTx.method}`
                        : tx.type}
                    </span>
                  </td>

                  {/* From Address */}
                  <td className="ledger-table-cell-text text-sm">
                    <code className="text-[#8b7355] dark:text-[#a38a6f]">
                      {formatAddress(tx.from)}
                    </code>
                  </td>

                  {/* To Address */}
                  <td className="ledger-table-cell-text text-sm">
                    {tx.to ? (
                      <code className="text-[#8b7355] dark:text-[#a38a6f]">
                        {formatAddress(tx.to)}
                      </code>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="ledger-table-cell-number whitespace-nowrap text-sm font-semibold tabular-nums text-right">
                    <span className="text-gray-900 dark:text-white">
                      {formatAmount(tx)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="ledger-table-cell-text whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === 'success'
                          ? 'bg-[#059669]/10 text-[#059669] dark:bg-[#10b981]/20 dark:text-[#10b981]'
                          : tx.status === 'failed'
                            ? 'bg-[#dc2626]/10 text-[#dc2626] dark:bg-[#ef4444]/20 dark:text-[#ef4444]'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500'
                      }`}
                    >
                      {tx.status === 'success' ? (
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                      ) : tx.status === 'failed' ? (
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                      ) : null}
                      {tx.status}
                    </span>
                  </td>

                  {/* Details Link */}
                  <td className="ledger-table-cell-actions text-right">
                    <a
                      href={getExplorerUrl(tx)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1e3a5f] dark:text-[#3d5a80] hover:opacity-80 transition-opacity inline-flex items-center justify-end"
                      title="View on Subscan explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {transactions.length > 10 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {Math.min(10, transactions.length)} of {transactions.length}{' '}
            transactions
          </p>
          <button className="text-sm text-[#1e3a5f] dark:text-[#3d5a80] hover:opacity-90 font-medium">
            Load More
          </button>
        </div>
      )}
    </div>
  )
}
