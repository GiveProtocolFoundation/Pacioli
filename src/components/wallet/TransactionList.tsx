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
  Pencil,
  X,
  Search,
  Filter,
} from 'lucide-react'
import { formatBalance } from '@polkadot/util'
import type {
  Transaction,
  SubstrateTransaction,
} from '../../services/wallet/types'
import { useTransactions } from '../../contexts/TransactionContext'
import { useProfile } from '../../contexts/ProfileContext'
import { persistence } from '../../services/persistence'
import type { TransactionInput } from '../../services/persistence/types'
import type { TransactionFormData } from '../../types/transaction'

/** Props for the wallet transaction list with import, filtering, and inline price editing. */
interface TransactionListProps {
  transactions: Transaction[]
  isLoading?: boolean
  error?: string | null
  onPurge?: () => void
  /** Called when the user manually sets or overrides the acquisition price for a transaction. */
  onPriceUpdate?: (txId: string, pricePerUnitUsd: string) => void
  /** The synced wallet's own address — used for correct wallet attribution on import. */
  walletAddress?: string
  /** The synced wallet's network/chain — used for correct wallet attribution on import. */
  walletNetwork?: string
}

/** Renders synced wallet transactions with selection, filtering, and import-to-ledger. */
export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  isLoading,
  error,
  onPurge,
  onPriceUpdate,
  walletAddress,
  walletNetwork,
}) => {
  const { reloadTransactions } = useTransactions()
  const { currentProfile } = useProfile()
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  // Inline acquisition-price editing state: maps txId → draft price string
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [draftPrice, setDraftPrice] = useState<string>('')

  // Selection state: track which transaction IDs are selected for import
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Sort transactions by block number (newest first)
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.blockNumber - a.blockNumber)
  }, [transactions])

  // Apply filters to sorted transactions
  const filteredTransactions = useMemo(() => {
    return sortedTransactions.filter(tx => {
      const substrateTx = tx as SubstrateTransaction

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false

      // Status filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false

      // Search filter: match against hash, from, to, or method
      if (searchQuery) {
        const needle = searchQuery.toLowerCase()
        const matchesHash = tx.hash?.toLowerCase().includes(needle)
        const matchesFrom = tx.from?.toLowerCase().includes(needle)
        const matchesTo = tx.to?.toLowerCase().includes(needle)
        const matchesMethod = substrateTx.method?.toLowerCase().includes(needle)
        const matchesSection = substrateTx.section
          ?.toLowerCase()
          .includes(needle)
        if (
          !matchesHash &&
          !matchesFrom &&
          !matchesTo &&
          !matchesMethod &&
          !matchesSection
        )
          return false
      }

      return true
    })
  }, [sortedTransactions, typeFilter, statusFilter, searchQuery])

  // Distinct transaction types for the filter dropdown
  const availableTypes = useMemo(() => {
    const types = new Set(sortedTransactions.map(tx => tx.type))
    return Array.from(types).sort()
  }, [sortedTransactions])

  // Selection helpers
  const allFilteredSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every(tx => selectedIds.has(tx.id))

  const someFilteredSelected =
    filteredTransactions.some(tx => selectedIds.has(tx.id)) &&
    !allFilteredSelected

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        // Deselect all filtered
        for (const tx of filteredTransactions) next.delete(tx.id)
      } else {
        // Select all filtered
        for (const tx of filteredTransactions) next.add(tx.id)
      }
      return next
    })
  }, [allFilteredSelected, filteredTransactions])

  const handleToggleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const txId = e.currentTarget.dataset.txid
      if (!txId) return
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(txId)) {
          next.delete(txId)
        } else {
          next.add(txId)
        }
        return next
      })
    },
    [],
  )

  const selectedCount = filteredTransactions.filter(tx =>
    selectedIds.has(tx.id)
  ).length

  const hasActiveFilters =
    typeFilter !== 'all' || statusFilter !== 'all' || searchQuery !== ''

  const clearFilters = useCallback(() => {
    setTypeFilter('all')
    setStatusFilter('all')
    setSearchQuery('')
  }, [])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    [],
  )

  const handleTypeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTypeFilter(e.target.value)
    },
    [],
  )

  const handleStatusFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatusFilter(e.target.value)
    },
    [],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const indeterminateRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = someFilteredSelected
    },
    [someFilteredSelected],
  )

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
  const formatAmount = useCallback(
    (tx: Transaction): string => {
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
    },
    [getTokenSymbol]
  )

  // Import selected (or all visible) wallet transactions to accounting ledger
  const importToLedger = useCallback(async () => {
    const toImport =
      selectedCount > 0
        ? filteredTransactions.filter(tx => selectedIds.has(tx.id))
        : filteredTransactions

    if (toImport.length === 0) return

    setImporting(true)
    setImportSuccess(false)
    setImportError(null)

    try {
      if (!currentProfile) {
        throw new Error('No profile available — cannot persist transactions')
      }

      const network =
        walletNetwork ||
        (toImport[0] as SubstrateTransaction).network ||
        'unknown'
      const address = walletAddress || toImport[0].to || 'unknown'

      const wallets = await persistence.getWallets(currentProfile.id)
      let wallet = wallets.find(
        w => w.address === address && w.chain === network
      )
      if (!wallet) {
        wallet = await persistence.saveWallet({
          profile_id: currentProfile.id,
          address,
          chain: network,
          name: `${network} synced wallet`,
          wallet_type: 'imported',
        })
      }

      const MARKER = '__pacioli_accounting'
      const inputs: TransactionInput[] = toImport.map(tx => {
        const substrateTx = tx as SubstrateTransaction
        const decimals = getNetworkDecimals(substrateTx.network)
        const tokenSym = getTokenSymbol(tx)
        const humanValue = formatBalance(tx.value, {
          decimals,
          withUnit: false,
          forceUnit: '-',
        })
        const txDate = new Date(tx.timestamp)

        const accountingPayload: TransactionFormData & Record<string, unknown> =
          {
            date: txDate.toISOString().slice(0, 16),
            description: `${substrateTx.section}.${substrateTx.method} - ${substrateTx.network}`,
            type: 'transfer',
            category: substrateTx.section,
            wallet: walletAddress || tx.to || tx.from,
            tokenId: tokenSym,
            chainId: substrateTx.network,
            amount: parseFloat(humanValue),
            fiatValue: 0,
            fiatCurrency: 'USD',
            hash: tx.hash,
            memo: `Block #${tx.blockNumber} - Status: ${tx.status}`,
            [MARKER]: true,
            id: `txn_${txDate.getTime()}_${tx.hash.slice(-9)}`,
            status: 'completed',
            classificationStatus: 'unclassified',
            createdBy: 'wallet-import',
            createdByName: 'Wallet Import',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

        return {
          hash: tx.hash,
          block_number: tx.blockNumber,
          timestamp: txDate.toISOString(),
          from_address: tx.from,
          to_address: tx.to,
          value: humanValue,
          fee: tx.fee,
          status: tx.status,
          tx_type: 'transfer',
          token_symbol: tokenSym,
          chain: substrateTx.network,
          raw_data: JSON.stringify(accountingPayload),
          ...(tx.pricePerUnitUsd != null && {
            price_at_acquisition_usd: tx.pricePerUnitUsd.toString(),
          }),
        }
      })

      await persistence.saveTransactions(wallet.id, inputs)
      await reloadTransactions()

      setImportSuccess(true)
      setSelectedIds(new Set())
      setTimeout(() => setImportSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to import transactions:', err)
      setImportError('Failed to import transactions. See console for details.')
    } finally {
      setImporting(false)
    }
  }, [
    filteredTransactions,
    selectedIds,
    selectedCount,
    currentProfile,
    reloadTransactions,
    getNetworkDecimals,
    getTokenSymbol,
    walletAddress,
    walletNetwork,
  ])

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

  // Open the inline price editor for a transaction
  const handleStartPriceEdit = useCallback((tx: Transaction) => {
    const current = (tx as Transaction & { pricePerUnitUsd?: number })
      .pricePerUnitUsd
    setDraftPrice(current != null ? current.toString() : '')
    setEditingPriceId(tx.id)
  }, [])

  // Cancel without saving
  const handleCancelPriceEdit = useCallback(() => {
    setEditingPriceId(null)
    setDraftPrice('')
  }, [])

  // Commit the price override
  const handleCommitPriceEdit = useCallback(
    (txId: string) => {
      const trimmed = draftPrice.trim()
      if (trimmed !== '' && !isNaN(parseFloat(trimmed)) && onPriceUpdate) {
        onPriceUpdate(txId, trimmed)
      }
      setEditingPriceId(null)
      setDraftPrice('')
    },
    [draftPrice, onPriceUpdate]
  )

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
        return 'bg-[#294050]/10 text-[#294050] dark:bg-[#F09988]/20 dark:text-[#F09988]'
      case 'staking':
        return 'bg-[#5FE3C0]/10 text-[#5FE3C0] dark:bg-[#9CF1DC]/10 dark:text-[#9CF1DC]'
      case 'xcm':
        return 'bg-[#8b7355]/10 text-[#8b7355] dark:bg-[#a38a6f]/10 dark:text-[#a38a6f]'
      case 'governance':
        return 'bg-[#7a9b6f]/10 text-[#7a9b6f] dark:bg-[#8faf84]/20 dark:text-[#8faf84]'
      default:
        return 'bg-[#EAF3F2] text-[#294050] dark:bg-[#16242F] dark:text-[#9FB4BE]'
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

  // Purge Confirmation Modal Component
  const PurgeConfirmationModal: React.FC<{
    show: boolean
    transactionsCount: number
    onCancel: () => void
    onPurge: () => void
  }> = ({ show, transactionsCount, onCancel, onPurge }) => {
    if (!show) return null
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg shadow-xl p-6 max-w-md mx-4">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-[#E8836F] dark:text-[#F09988]" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
                Purge Transaction Data?
              </h3>
              <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
                This will permanently delete all {transactionsCount} wallet
                transactions from IndexedDB. This action cannot be undone. You
                can re-sync from the blockchain anytime.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] bg-[#EAF3F2] dark:bg-[#11202B] rounded hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onPurge}
              className="px-4 py-2 text-sm font-medium text-white bg-[#E8836F] dark:bg-[#C56A57] rounded hover:bg-[#C56A57] dark:hover:bg-[#7a4f4f] transition-colors"
            >
              Yes, Purge Data
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="ledger-card ledger-card-financial border border-[rgba(95,227,192,0.15)] p-6">
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 animate-spin text-[#294050] dark:text-[#F09988]" />
          <span className="ml-3 text-[#294050] dark:text-[#9FB4BE]">
            Loading transaction history...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ledger-card ledger-card-expense border border-[rgba(95,227,192,0.15)] p-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-[#dc2626] dark:text-[#ef4444] mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#dc2626] dark:text-[#ef4444]">
              Error Loading Transactions
            </h3>
            <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="ledger-card ledger-card-wallet border border-[rgba(95,227,192,0.15)] p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-[#647D8B] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
            No Transactions Found
          </h3>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
            Connect a wallet and sync to view transaction history
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ledger-card ledger-card-financial border border-[rgba(95,227,192,0.15)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[rgba(95,227,192,0.15)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2]">
              Transaction History
            </h3>
            <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
              {filteredTransactions.length === transactions.length
                ? `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} found`
                : `${filteredTransactions.length} of ${transactions.length} transactions shown`}
              {selectedCount > 0 && ` \u00B7 ${selectedCount} selected`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="text-sm text-[#294050] dark:text-[#F09988] hover:opacity-90 font-medium transition-opacity inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={importToLedger}
              disabled={
                importing || importSuccess || filteredTransactions.length === 0
              }
              className="text-sm px-3 py-1.5 bg-[#294050] dark:bg-[#F09988] text-white hover:opacity-90 font-medium transition-opacity inline-flex items-center gap-1.5 rounded disabled:opacity-50"
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
                  {selectedCount > 0
                    ? `Import ${selectedCount} Selected`
                    : 'Import to Transactions'}
                </>
              )}
            </button>
            <button
              onClick={handleShowPurgeConfirm}
              className="text-sm px-3 py-1.5 bg-[#E8836F] dark:bg-[#C56A57] text-white hover:opacity-90 font-medium transition-opacity inline-flex items-center gap-1.5 rounded"
            >
              <Trash2 className="w-4 h-4" />
              Purge Data
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-[rgba(95,227,192,0.15)] flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#647D8B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by address, hash, or method..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-[rgba(95,227,192,0.3)] rounded bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] focus:outline-none focus:border-[#5FE3C0] focus:ring-1 focus:ring-[#5FE3C0]"
          />
        </div>

        {/* Type filter */}
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#647D8B]" />
          <select
            value={typeFilter}
            onChange={handleTypeFilterChange}
            className="text-sm border border-[rgba(95,227,192,0.3)] rounded bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] px-2 py-1.5 focus:outline-none focus:border-[#5FE3C0] focus:ring-1 focus:ring-[#5FE3C0]"
          >
            <option value="all">All Types</option>
            {availableTypes.map(t => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          className="text-sm border border-[rgba(95,227,192,0.3)] rounded bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] px-2 py-1.5 focus:outline-none focus:border-[#5FE3C0] focus:ring-1 focus:ring-[#5FE3C0]"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[#E8836F] dark:text-[#F09988] hover:opacity-80 font-medium inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Import error banner */}
      {importError && (
        <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          <span>{importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="ml-4 text-red-500 hover:text-red-700 dark:hover:text-red-200 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      <PurgeConfirmationModal
        show={showPurgeConfirm}
        transactionsCount={transactions.length}
        onCancel={handleHidePurgeConfirm}
        onPurge={handlePurge}
      />

      {/* Transaction Table */}
      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead className="ledger-table-header">
            <tr>
              <th className="ledger-table-cell-text text-center w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={indeterminateRef}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 text-[#294050] border-[rgba(95,227,192,0.3)] rounded focus:ring-[#5FE3C0] cursor-pointer"
                  title={
                    allFilteredSelected ? 'Deselect all' : 'Select all visible'
                  }
                />
              </th>
              <th className="ledger-table-cell-text text-left">Time</th>
              <th className="ledger-table-cell-text text-left">Type</th>
              <th className="ledger-table-cell-text text-left">From</th>
              <th className="ledger-table-cell-text text-left">To</th>
              <th className="ledger-table-cell-number text-right">Amount</th>
              <th
                className="ledger-table-cell-number text-right"
                title="USD price per token unit at acquisition — used for cost-basis reporting"
              >
                Acq. Price
              </th>
              <th className="ledger-table-cell-text text-left">Status</th>
              <th className="ledger-table-cell-actions text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(tx => {
              const isSubstrate = 'method' in tx
              const substrateTx = tx as SubstrateTransaction
              const txWithPrice = tx as Transaction & {
                pricePerUnitUsd?: number
              }
              const isEditing = editingPriceId === tx.id

              return (
                <tr
                  key={tx.id}
                  className={`ledger-table-row${selectedIds.has(tx.id) ? ' bg-[#5FE3C0]/5 dark:bg-[#5FE3C0]/10' : ''}`}
                >
                  {/* Selection Checkbox */}
                  <td className="ledger-table-cell-text text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      data-txid={tx.id}
                      onChange={handleToggleSelect}
                      className="w-4 h-4 text-[#294050] border-[rgba(95,227,192,0.3)] rounded focus:ring-[#5FE3C0] cursor-pointer"
                    />
                  </td>

                  {/* Timestamp */}
                  <td className="ledger-table-cell-text whitespace-nowrap text-sm text-[#294050] dark:text-[#9FB4BE]">
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
                      <span className="text-[#647D8B]">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="ledger-table-cell-number whitespace-nowrap text-sm font-semibold tabular-nums text-right">
                    <span className="text-[#11202B] dark:text-[#EAF3F2]">
                      {formatAmount(tx)}
                    </span>
                  </td>

                  {/* Acquisition Price (USD per token unit) */}
                  <td className="ledger-table-cell-number text-right whitespace-nowrap">
                    {isEditing ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={draftPrice}
                          onChange={e => setDraftPrice(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCommitPriceEdit(tx.id)
                            if (e.key === 'Escape') handleCancelPriceEdit()
                          }}
                          className="w-24 text-xs border border-[#5FE3C0] rounded px-1 py-0.5 bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2]"
                          placeholder="e.g. 6.50"
                        />
                        <button
                          onClick={() => handleCommitPriceEdit(tx.id)}
                          className="text-[#7a9b6f] dark:text-[#8faf84] hover:opacity-80"
                          title="Save price"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelPriceEdit}
                          className="text-[#E8836F] dark:text-[#F09988] hover:opacity-80"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 group">
                        <span className="text-xs tabular-nums text-[#294050] dark:text-[#9FB4BE]">
                          {txWithPrice.pricePerUnitUsd != null
                            ? `$${txWithPrice.pricePerUnitUsd.toFixed(4)}`
                            : '—'}
                        </span>
                        {onPriceUpdate && (
                          <button
                            onClick={() => handleStartPriceEdit(tx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#294050] dark:text-[#F09988] hover:opacity-80"
                            title="Set acquisition price for cost-basis"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="ledger-table-cell-text whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === 'success'
                          ? 'bg-[#7a9b6f]/10 text-[#7a9b6f] dark:bg-[#8faf84]/20 dark:text-[#8faf84]'
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
                      className="text-[#294050] dark:text-[#F09988] hover:opacity-80 transition-opacity inline-flex items-center justify-end"
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
      {filteredTransactions.length > 10 && (
        <div className="px-6 py-4 border-t border-[rgba(95,227,192,0.15)] flex items-center justify-between">
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
            Showing {filteredTransactions.length} transaction
            {filteredTransactions.length !== 1 ? 's' : ''}
            {hasActiveFilters &&
              ` (filtered from ${transactions.length} total)`}
          </p>
          {selectedCount > 0 && (
            <button
              onClick={handleClearSelection}
              className="text-sm text-[#294050] dark:text-[#F09988] hover:opacity-90 font-medium"
            >
              Clear Selection
            </button>
          )}
        </div>
      )}
    </div>
  )
}
