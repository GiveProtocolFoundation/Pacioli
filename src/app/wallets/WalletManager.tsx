import React, { useState, useCallback, useEffect, useRef, memo } from 'react'
import {
  RefreshCw,
  Wallet,
  Database,
  AlertCircle,
  CheckCircle,
  Loader,
  Plus,
  Eye,
  ChevronDown,
  Radio,
} from 'lucide-react'
import { WalletConnector } from '../../components/wallet/WalletConnector'
import WalletConnectionModal from '../../components/wallet/WalletConnectionModal'
import AddPortfolioModal from '../../components/wallet/AddPortfolioModal'
import { TransactionList } from '../../components/wallet/TransactionList'
import {
  polkadotService,
  correlateXcmTransactions,
  type SyncProgress,
} from '../../services/blockchain/polkadotService'
import { persistence, type TransactionInput } from '../../services/persistence'
import { MigrationService } from '../../services/database/migrationService'
import {
  StorageService,
  type TrackedWallet,
} from '../../services/database/storageService'
import {
  NetworkType,
  type ConnectedWallet,
  type Transaction,
  type SubstrateTransaction,
  ChainType,
} from '../../services/wallet/types'
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto'
import { useWalletAliases } from '../../contexts/WalletAliasContext'
import { useProfile } from '../../contexts/ProfileContext'
import { useBlockSubscription } from '../../hooks/useBlockSubscription'

/** Props for the TrackedWalletRow component */
interface TrackedWalletRowProps {
  wallet: TrackedWallet
  onRemove: (id: string) => void
}

/** Memoized row component for tracked wallets to avoid arrow functions in JSX */
const TrackedWalletRow = memo(function TrackedWalletRow({
  wallet,
  onRemove,
}: TrackedWalletRowProps) {
  const handleRemove = useCallback(() => {
    onRemove(wallet.id)
  }, [onRemove, wallet.id])

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {wallet.label || 'Unnamed Wallet'}
          </span>
          {wallet.isVerified ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <span title="Not verified">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {wallet.address}
        </p>
        <p className="text-xs text-[#294050] dark:text-[#F09988]">
          {wallet.blockchain}
        </p>
      </div>
      <button
        onClick={handleRemove}
        className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove wallet"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
})

/**
 * Convert address to the correct SS58 format for the given network
 * Polkadot wallets may return addresses in generic format (42) but we need network-specific format
 * EVM addresses (0x...) are returned as-is since they don't use SS58 encoding
 */
const convertToNetworkFormat = (
  address: string,
  network: NetworkType
): string => {
  // EVM addresses start with 0x - don't try to convert them
  if (address.startsWith('0x')) {
    return address
  }

  try {
    // Get SS58 prefix for each network
    const ss58Formats: Partial<Record<NetworkType, number>> = {
      polkadot: 0, // Polkadot addresses start with '1'
      kusama: 2, // Kusama addresses start with various letters
      astar: 5, // Astar
      acala: 10, // Acala
      // Moonbeam (1284) and Moonriver (1285) are sunset — no longer included
    }

    const ss58Prefix = ss58Formats[network]

    // Decode the address (removes SS58 encoding, gets raw public key)
    const publicKey = decodeAddress(address)

    // Re-encode with correct network prefix
    const networkAddress = encodeAddress(publicKey, ss58Prefix)

    return networkAddress
  } catch (error) {
    console.error('Failed to convert address format:', error)
    return address // Fallback to original if conversion fails
  }
}

/** Props for the AddMenuDropdown component */
interface AddMenuDropdownProps {
  showAddMenu: boolean
  onClose: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onOpenPortfolioModal: () => void
  onOpenConnectionModal: () => void
}

/**
 * Dropdown menu that appears when clicking the "Add" button in the header.
 * Includes a backdrop overlay and menu options for "Add Portfolio" and "Connect Wallet".
 */
const AddMenuDropdown: React.FC<AddMenuDropdownProps> = ({
  showAddMenu,
  onClose,
  onKeyDown,
  onOpenPortfolioModal,
  onOpenConnectionModal,
}) => {
  if (!showAddMenu) {
    return null
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-10"
        role="presentation"
        onClick={onClose}
        onKeyDown={onKeyDown}
      />
      {/* Dropdown Menu */}
      <div className="absolute right-0 mt-2 w-64 bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg shadow-lg border border-[rgba(95,227,192,0.15)] z-20 overflow-hidden">
        <button
          onClick={onOpenPortfolioModal}
          className="w-full px-4 py-3 text-left hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-[#294050]" />
            <div>
              <p className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
                Add Portfolio
              </p>
              <p className="text-xs text-[#294050] dark:text-[#9FB4BE]">
                Track any public address (read-only)
              </p>
            </div>
          </div>
        </button>
        <div className="border-t border-[rgba(95,227,192,0.15)]" />
        <button
          onClick={onOpenConnectionModal}
          className="w-full px-4 py-3 text-left hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-[#294050]" />
            <div>
              <p className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
                Connect Wallet
              </p>
              <p className="text-xs text-[#294050] dark:text-[#9FB4BE]">
                Browser extension or WalletConnect
              </p>
            </div>
          </div>
        </button>
      </div>
    </>
  )
}

/** Props for the SyncProgressDisplay component */
interface SyncProgressDisplayProps {
  syncProgress: SyncProgress
}

/**
 * Sync progress card shown during transaction syncing.
 * Displays the current stage indicator, progress bar, block count stats,
 * and transaction count.
 */
const SyncProgressDisplay: React.FC<SyncProgressDisplayProps> = ({
  syncProgress,
}) => {
  return (
    <div className="mt-4 p-4 bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 border-l-4 border-[#5FE3C0] rounded">
      <div className="flex items-start mb-3">
        {syncProgress.stage === 'complete' ? (
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
        ) : (
          <Loader className="w-5 h-5 text-[#294050] dark:text-[#F09988] mr-3 flex-shrink-0 animate-spin" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#294050] dark:text-[#9CF1DC] mb-1">
            {syncProgress.stage === 'connecting' && 'Connecting to Network'}
            {syncProgress.stage === 'fetching' && 'Fetching Transactions'}
            {syncProgress.stage === 'processing' && 'Processing Blocks'}
            {syncProgress.stage === 'saving' && 'Saving to Database'}
            {syncProgress.stage === 'complete' && 'Sync Complete'}
          </p>
          <p className="text-sm text-[#294050] dark:text-[#9CF1DC]">
            {syncProgress.message}
          </p>
        </div>
      </div>

      {/* Progress Details */}
      {(syncProgress.stage === 'fetching' ||
        syncProgress.stage === 'processing') && (
        <div className="space-y-2">
          {/* Progress Bar */}
          <div className="w-full bg-[#5FE3C0]/30 dark:bg-[#5FE3C0]/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#294050] dark:bg-[#F09988] h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  (syncProgress.blocksScanned /
                    Math.max(syncProgress.totalBlocks, 1)) *
                    100
                )}%`,
              }}
            />
          </div>

          {/* Stats */}
          <div className="flex justify-between text-xs text-[#294050] dark:text-[#9CF1DC]">
            <span>
              Blocks: {syncProgress.blocksScanned.toLocaleString()} /{' '}
              {syncProgress.totalBlocks.toLocaleString()}
            </span>
            <span>
              {Math.round(
                (syncProgress.blocksScanned /
                  Math.max(syncProgress.totalBlocks, 1)) *
                  100
              )}
              %
            </span>
          </div>

          {/* Transaction Count */}
          {syncProgress.transactionsFound > 0 && (
            <p className="text-xs text-[#294050] dark:text-[#9CF1DC]">
              Found {syncProgress.transactionsFound.toLocaleString()}{' '}
              transaction
              {syncProgress.transactionsFound !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Network decimals for planck→human-readable conversion (same as enrichTransactionsWithUsdValues). */
const NETWORK_DECIMALS: Record<string, number> = {
  polkadot: 10,
  acala: 10,
  kusama: 12,
  astar: 18,
  // Moonbeam and Moonriver are sunset (2026-07-31) — no longer supported
}

/**
 * Convert synced chain transactions to accounting TransactionInput objects.
 *
 * Key semantics:
 * - `value` is converted from raw planck/wei to human-readable token units
 *   so that `price_at_acquisition_usd * value` gives the correct USD acquisition cost.
 * - `price_at_acquisition_usd` is set from `tx.pricePerUnitUsd` (price per human-readable unit)
 *   populated by enrichTransactionsWithUsdValues during the sync phase.
 */
function buildAccountingInputs(
  txs: Transaction[],
  network: string
): TransactionInput[] {
  const decimals = NETWORK_DECIMALS[network] ?? 10
  const divisor = BigInt(10 ** decimals)

  return txs.map(tx => {
    const substrateTx = tx as SubstrateTransaction

    // Convert raw planck value to human-readable token amount
    let humanValue: string | undefined
    if (tx.value) {
      try {
        const planckBig = BigInt(tx.value)
        const whole = planckBig / divisor
        const frac = planckBig % divisor
        const humanNum = Number(whole) + Number(frac) / Number(divisor)
        humanValue = humanNum.toString()
      } catch {
        humanValue = tx.value // fallback: store as-is
      }
    }

    return {
      hash: tx.hash,
      block_number: tx.blockNumber,
      timestamp:
        tx.timestamp instanceof Date
          ? tx.timestamp.toISOString()
          : new Date(tx.timestamp).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
      value: humanValue,
      fee: tx.fee,
      status: tx.status,
      tx_type: tx.type,
      token_symbol: tx.tokenSymbol,
      chain: network,
      raw_data: JSON.stringify(tx),
      xcm_correlation_id: substrateTx.xcmCorrelationId,
      xcm_linked_tx_id: substrateTx.xcmLinkedTxId,
      xcm_role: substrateTx.xcmRole,
      xcm_status: substrateTx.xcmStatus,
      price_at_acquisition_usd:
        tx.pricePerUnitUsd != null ? tx.pricePerUnitUsd.toString() : undefined,
    }
  })
}

/**
 * Load transactions for all supported networks for the given raw address,
 * run cross-chain XCM correlation across the merged set, and save the
 * correlated transactions back to the persistence layer (upsert by id).
 *
 * This is intentionally called once per sync so correlation is persisted
 * and survives page reloads without re-running.
 */
async function performCrossChainXcmCorrelation(
  rawAddress: string
): Promise<void> {
  const allNetworks = Object.values(NetworkType)

  // Load transactions per network (ignore networks with no data)
  const perNetwork: Array<{
    net: NetworkType
    addr: string
    txs: Transaction[]
  }> = []
  await Promise.all(
    allNetworks.map(async net => {
      const addr = convertToNetworkFormat(rawAddress, net)
      try {
        const txs = await persistence.getChainTransactions(net, addr)
        if (txs.length > 0) perNetwork.push({ net, addr, txs })
      } catch {
        // Network has no synced data — skip silently
      }
    })
  )

  if (perNetwork.length < 2) return // Need at least two chains to correlate

  // Merge and correlate (mutates in place)
  const merged = perNetwork.flatMap(({ txs }) => txs)
  const substrateTxs = merged.filter(
    (tx): tx is SubstrateTransaction => 'events' in tx
  )
  correlateXcmTransactions(substrateTxs)

  // Persist the updated xcmStatus / xcmLinkedTxId fields back
  await Promise.all(
    perNetwork.map(({ net, addr, txs }) =>
      persistence.saveChainTransactions(net, addr, txs)
    )
  )
}

/** Wallet manager page for connecting wallets, syncing transactions, and managing tracked portfolios */
const WalletManager: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(
    NetworkType.POLKADOT
  )
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>(
    []
  )
  const [dbInitialized, setDbInitialized] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<string>('')
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime: Date
    lastSyncedBlock: number
  } | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false)
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([])
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(() =>
    StorageService.getRealtimeSyncEnabled()
  )

  // Load tracked wallets on mount
  useEffect(() => {
    setTrackedWallets(StorageService.loadTrackedWallets())
  }, [])

  // Toggle handler for real-time sync
  const handleToggleRealtimeSync = useCallback(() => {
    setRealtimeSyncEnabled(prev => {
      const next = !prev
      StorageService.setRealtimeSyncEnabled(next)
      return next
    })
  }, [])

  // Callback when block subscription detects new transactions
  const handleLiveTransactionsUpdated = useCallback(
    async (net: NetworkType, addr: string) => {
      if (!dbInitialized) return
      try {
        const networkAddr = convertToNetworkFormat(addr, net)
        const allTxs = await persistence.getChainTransactions(net, networkAddr)
        setTransactions(allTxs)
        const newSyncStatus = await persistence.loadChainSyncStatus(
          net,
          networkAddr
        )
        setSyncStatus(newSyncStatus)
      } catch (err) {
        console.error('Failed to reload after live update:', err)
      }
    },
    [dbInitialized]
  )

  // Real-time block subscription
  const blockSub = useBlockSubscription({
    network: selectedNetwork,
    address: selectedAddress,
    enabled: realtimeSyncEnabled,
    dbReady: dbInitialized,
    onTransactionsUpdated: handleLiveTransactionsUpdated,
  })

  // Handle adding a tracked wallet
  const handleAddTrackedWallet = useCallback(
    (wallet: {
      address: string
      blockchain: string
      label?: string
      isVerified: boolean
      signature?: string
    }) => {
      try {
        const newWallet = StorageService.addTrackedWallet({
          address: wallet.address,
          blockchain: wallet.blockchain,
          label: wallet.label,
          isVerified: wallet.isVerified,
          signature: wallet.signature,
        })
        setTrackedWallets(prev => [...prev, newWallet])
        // Wallet tracked successfully
      } catch (err) {
        console.error('Failed to track wallet:', err)
        setError(err instanceof Error ? err.message : 'Failed to track wallet')
      }
    },
    []
  )

  // Handle removing a tracked wallet
  const handleRemoveTrackedWallet = useCallback((id: string) => {
    if (StorageService.removeTrackedWallet(id)) {
      setTrackedWallets(prev => prev.filter(w => w.id !== id))
    }
  }, [])

  // Memoized modal close handlers to avoid arrow functions in JSX
  const handleCloseConnectionModal = useCallback(() => {
    setIsConnectionModalOpen(false)
  }, [])

  const handleClosePortfolioModal = useCallback(() => {
    setIsPortfolioModalOpen(false)
  }, [])

  const handleOpenPortfolioModal = useCallback(() => {
    setShowAddMenu(false)
    setIsPortfolioModalOpen(true)
  }, [])

  const handleOpenConnectionModal = useCallback(() => {
    setShowAddMenu(false)
    setIsConnectionModalOpen(true)
  }, [])

  const handleToggleAddMenu = useCallback(() => {
    setShowAddMenu(prev => !prev)
  }, [])

  const handleCloseAddMenu = useCallback(() => {
    setShowAddMenu(false)
  }, [])

  const handleAddMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') handleCloseAddMenu()
    },
    [handleCloseAddMenu]
  )

  // Handle adding a portfolio from the AddPortfolioModal
  const handleAddPortfolio = useCallback(
    (portfolio: {
      address: string
      chains: string[]
      label?: string
      isXpub?: boolean
    }) => {
      try {
        // Add wallet for each selected chain
        for (const chain of portfolio.chains) {
          const newWallet = StorageService.addTrackedWallet({
            address: portfolio.address,
            blockchain: chain,
            label:
              portfolio.label ||
              (portfolio.isXpub ? 'xPub Portfolio' : undefined),
            isVerified: false, // Read-only mode, no verification
          })
          setTrackedWallets(prev => [...prev, newWallet])
        }
        // Portfolio added successfully
      } catch (err) {
        console.error('Failed to add portfolio:', err)
        setError(err instanceof Error ? err.message : 'Failed to add portfolio')
      }
    },
    []
  )

  // Wallet aliases
  const { formatWalletDisplay } = useWalletAliases()

  // Profile context for persistence
  const { currentProfile, wallets: profileWallets, addWallet } = useProfile()

  // Track if we've already initialized
  const initializationStartedRef = useRef(false)

  // Initialize transaction store and run migration on mount
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initializationStartedRef.current) {
      return
    }
    initializationStartedRef.current = true

    /** Initialize persistence, run data migration if needed, and load saved wallets */
    const initializeDB = async () => {
      try {
        setMigrationStatus('Initializing database...')

        // Initialize transaction store
        await persistence.initTransactionStore()

        // Check if migration is needed
        const hasMigrated = await MigrationService.hasMigrated()

        if (!hasMigrated) {
          setMigrationStatus('Migrating data from localStorage...')
          const result = await MigrationService.migrateAll()

          if (result.success) {
            setMigrationStatus(
              `Migrated ${result.transactionsMigrated} transactions`
            )
            setTimeout(() => setMigrationStatus(''), 3000)
          } else {
            console.error('Migration had errors:', result.errors)
            setMigrationStatus('Migration completed with warnings')
          }
        }

        setDbInitialized(true)
        setMigrationStatus('')

        // Load saved wallets from persistence
        const savedWallets = await persistence.loadConnectedWallets()
        if (savedWallets.length > 0) {
          setConnectedWallets(savedWallets)
        }

        // Load last selected address and network from localStorage
        const lastAddress = localStorage.getItem('pacioli_last_address')
        const lastNetwork = localStorage.getItem(
          'pacioli_last_network'
        ) as NetworkType | null

        if (lastAddress) {
          setSelectedAddress(lastAddress)
        }
        if (lastNetwork) {
          setSelectedNetwork(lastNetwork)
        }
      } catch (err) {
        console.error('Database initialization failed:', err)
        setError('Failed to initialize database')
      }
    }

    initializeDB()
  }, [])

  // Load transactions and sync status when address or network changes
  useEffect(() => {
    // Track if this effect is still current (for cleanup on race conditions)
    let isCurrent = true

    /** Load transactions and sync status for the selected address and network */
    const loadData = async () => {
      if (!dbInitialized || !selectedAddress) {
        setSyncStatus(null)
        setTransactions([])
        return
      }

      try {
        // For EVM addresses (0x...), use as-is. For Substrate, convert.
        const networkAddress = convertToNetworkFormat(
          selectedAddress,
          selectedNetwork
        )

        // Load sync status
        const status = await persistence.loadChainSyncStatus(
          selectedNetwork,
          networkAddress
        )
        if (!isCurrent) return // Abort if effect was cleaned up
        setSyncStatus(status)

        // Load saved transactions from persistence
        const savedTxs = await persistence.getChainTransactions(
          selectedNetwork,
          networkAddress
        )

        if (!isCurrent) return // Abort if effect was cleaned up

        // Update transactions state
        setTransactions(savedTxs)

        // Save selection to localStorage for persistence
        localStorage.setItem('pacioli_last_address', selectedAddress)
        localStorage.setItem('pacioli_last_network', selectedNetwork)
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }

    loadData()

    // Cleanup function to mark this effect as stale
    return () => {
      isCurrent = false
    }
  }, [selectedAddress, selectedNetwork, dbInitialized])

  // Handle wallet changes from WalletConnector
  const handleWalletsChange = useCallback(
    async (wallets: ConnectedWallet[]) => {
      setConnectedWallets(wallets)

      // Save wallets to persistence layer
      try {
        await persistence.saveConnectedWallets(wallets)
      } catch (err) {
        console.error('Failed to save wallets:', err)
      }

      // Also save wallets to profile persistence layer (if profile exists)
      if (currentProfile) {
        for (const wallet of wallets) {
          for (const account of wallet.accounts) {
            try {
              await addWallet({
                address: account.address,
                chain: account.type === ChainType.EVM ? 'evm' : 'substrate',
                name: account.name || undefined,
                wallet_type: wallet.type,
              })
            } catch (err) {
              // Ignore errors for already existing wallets
              console.warn('Wallet save to profile:', err)
            }
          }
        }
      }

      // Auto-select first available address (only if none selected)
      // Check localStorage directly to avoid race condition with state updates
      const lastSavedAddress = localStorage.getItem('pacioli_last_address')
      if (
        wallets.length > 0 &&
        wallets[0].accounts.length > 0 &&
        !selectedAddress &&
        !lastSavedAddress
      ) {
        setSelectedAddress(wallets[0].accounts[0].address)
      }
    },
    [selectedAddress, currentProfile, addWallet]
  )

  // Handle address selection
  const handleAddressSelect = useCallback((address: string) => {
    setSelectedAddress(address)
    // Note: Transactions will be auto-loaded by the useEffect above
  }, [])

  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleAddressSelect(e.target.value)
    },
    [handleAddressSelect]
  )

  const handleNetworkChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedNetwork(e.target.value as NetworkType)
    },
    []
  )

  // Sync transactions from blockchain
  const syncTransactions = useCallback(async () => {
    if (!selectedAddress) {
      setError('Please select an address first')
      return
    }

    if (!dbInitialized) {
      setError('Database not initialized')
      return
    }

    // Convert address to network-specific SS58 format
    // Wallets may return generic format (42) but we need network-specific
    const networkAddress = convertToNetworkFormat(
      selectedAddress,
      selectedNetwork
    )

    setIsLoading(true)
    setError(null)
    setSyncProgress(null)

    // Add timeout to prevent infinite hanging
    const syncTimeout = setTimeout(() => {
      console.error('Sync timeout after 5 minutes')
      setError(
        'Sync timeout: The operation took too long. Please try again with a more active address.'
      )
      setIsLoading(false)
      setSyncProgress(null)
    }, 300000) // 5 minute timeout

    try {
      // Fetch transactions using HYBRID approach (Subscan + RPC)
      // This is MUCH faster: ~2-3 seconds instead of minutes/hours
      // Note: RPC connection is now optional - if it fails, we still get Subscan data
      let lastProgressMessage = ''
      const txs = await polkadotService.fetchTransactionHistoryHybrid(
        selectedNetwork,
        {
          address: networkAddress,
          limit: 100, // Increased limit since hybrid is much faster
          onProgress: progress => {
            setSyncProgress(progress)
            if (progress.stage === 'complete') {
              lastProgressMessage = progress.message
            }
          },
        }
      )

      // Report saving stage
      setSyncProgress({
        stage: 'saving',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: txs.length,
        message: `Saving ${txs.length} transaction${txs.length !== 1 ? 's' : ''} to database...`,
      })

      // Save to persistence using NETWORK-SPECIFIC ADDRESS
      await persistence.saveChainTransactions(
        selectedNetwork,
        networkAddress,
        txs
      )

      // Also write to the accounting persistence path so that cost-basis reporting
      // can access price_at_acquisition_usd immediately after sync, without waiting
      // for the full GIV-467 path-convergence work to land.
      if (currentProfile && txs.length > 0) {
        try {
          // Find or create the accounting wallet for this address+chain
          const existingWallet = profileWallets.find(
            w => w.address === networkAddress && w.chain === selectedNetwork
          )
          const accountingWalletId = existingWallet
            ? existingWallet.id
            : (
                await addWallet({
                  address: networkAddress,
                  chain: selectedNetwork,
                  name: `${selectedNetwork} synced wallet`,
                  wallet_type: 'synced',
                })
              ).id
          const accountingInputs = buildAccountingInputs(txs, selectedNetwork)
          await persistence.saveTransactions(
            accountingWalletId,
            accountingInputs
          )
        } catch (accountingErr) {
          // Non-fatal: chain store is always saved; accounting write is best-effort
          console.warn(
            '[WalletManager] Failed to write priced transactions to accounting store:',
            accountingErr
          )
        }
      }

      // Update sync status
      if (txs.length > 0) {
        const lastBlock = Math.max(...txs.map(tx => tx.blockNumber))
        await persistence.saveChainSyncStatus({
          network: selectedNetwork,
          address: networkAddress,
          lastSyncedBlock: lastBlock,
          lastSyncTime: new Date(),
          isSyncing: false,
        })
      }

      // Cross-chain XCM correlation: merge all networks' transactions for this
      // address, link send↔receive pairs, and save back the correlated state.
      await performCrossChainXcmCorrelation(selectedAddress)

      // Reload from persistence to get all transactions using NETWORK-SPECIFIC ADDRESS
      const allTxs = await persistence.getChainTransactions(
        selectedNetwork,
        networkAddress
      )
      setTransactions(allTxs)

      // Update local sync status display
      const newSyncStatus = await persistence.loadChainSyncStatus(
        selectedNetwork,
        networkAddress
      )
      setSyncStatus(newSyncStatus)

      // Show success — preserve service message (e.g. API key warning) when no transactions
      const successMessage =
        txs.length === 0 && lastProgressMessage
          ? lastProgressMessage
          : `Successfully synced ${txs.length} transaction${txs.length !== 1 ? 's' : ''}`
      setSyncProgress({
        stage: 'complete',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: txs.length,
        message: successMessage,
      })

      // Keep API key warnings visible longer
      const clearDelay = txs.length === 0 && lastProgressMessage ? 8000 : 3000
      setTimeout(() => setSyncProgress(null), clearDelay)

      // Clear timeout on success
      clearTimeout(syncTimeout)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sync transactions'
      console.error('❌❌❌ SYNC FAILED ❌❌❌')
      console.error('Error:', err)
      console.error('Error message:', errorMessage)
      console.error(
        'Error stack:',
        err instanceof Error ? err.stack : 'No stack trace'
      )
      setError(errorMessage)
      setSyncProgress(null)

      // Clear timeout on error
      clearTimeout(syncTimeout)
    } finally {
      setIsLoading(false)
    }
    // currentProfile/profileWallets/addWallet are stable context refs; omitting them
    // avoids re-creating the sync callback on every profile update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddress, selectedNetwork, dbInitialized])

  // Purge wallet transaction data
  const handlePurgeData = useCallback(async () => {
    if (!selectedAddress || !dbInitialized) {
      return
    }

    try {
      // Clear transactions for this address/network
      // Note: We can't selectively delete by address easily,
      // so we'll clear all transactions and let user re-sync if needed
      await persistence.clearChainTransactions()

      // Clear local state
      setTransactions([])
      setSyncStatus(null)
    } catch (err) {
      console.error('Failed to purge data:', err)
      setError('Failed to purge transaction data')
    }
  }, [selectedAddress, dbInitialized])

  // Handle manual acquisition-price override from TransactionList
  const handlePriceUpdate = useCallback(
    async (txId: string, pricePerUnitUsd: string) => {
      if (!currentProfile) return
      try {
        // Update the in-memory transaction object so the UI reflects the change immediately
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === txId
              ? Object.assign(Object.create(Object.getPrototypeOf(tx)), tx, {
                  pricePerUnitUsd: parseFloat(pricePerUnitUsd),
                })
              : tx
          )
        )
        // Persist the override: find the accounting wallet and re-save just this transaction
        const networkAddress = convertToNetworkFormat(
          selectedAddress,
          selectedNetwork
        )
        const existingWallet = profileWallets.find(
          w => w.address === networkAddress && w.chain === selectedNetwork
        )
        if (!existingWallet) return // accounting wallet not yet created; sync first
        const targetTx = transactions.find(t => t.id === txId)
        if (!targetTx) return
        const updatedTx = Object.assign(
          Object.create(Object.getPrototypeOf(targetTx)),
          targetTx,
          {
            pricePerUnitUsd: parseFloat(pricePerUnitUsd),
          }
        ) as typeof targetTx
        const inputs = buildAccountingInputs([updatedTx], selectedNetwork)
        await persistence.saveTransactions(existingWallet.id, inputs)
      } catch (err) {
        console.warn('[WalletManager] Failed to save price override:', err)
      }
    },
    [
      currentProfile,
      profileWallets,
      selectedAddress,
      selectedNetwork,
      transactions,
    ]
  )

  // Get all available addresses from connected wallets AND tracked wallets
  const allAddresses = [
    // Addresses from browser extension wallets
    ...connectedWallets.flatMap(wallet =>
      wallet.accounts.map(acc => ({
        address: acc.address,
        name: acc.name || 'Unnamed',
        walletType: wallet.type,
        source: 'extension' as const,
      }))
    ),
    // Addresses from tracked wallets (added via modal)
    ...trackedWallets.map(wallet => ({
      address: wallet.address,
      name: wallet.label || 'Tracked Wallet',
      walletType: wallet.blockchain,
      source: 'tracked' as const,
    })),
  ]

  return (
    <div className="min-h-screen ledger-background p-6 md:p-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Wallet className="w-8 h-8 text-[#294050] dark:text-[#F09988] mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Wallet Manager
            </h1>
          </div>
          {/* Add Button with Dropdown Menu */}
          <div className="relative">
            <button
              onClick={handleToggleAddMenu}
              className="flex items-center gap-2 px-4 py-2 bg-[#294050] text-white rounded-lg font-medium hover:bg-[#1E2F3C] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`}
              />
            </button>

            <AddMenuDropdown
              showAddMenu={showAddMenu}
              onClose={handleCloseAddMenu}
              onKeyDown={handleAddMenuKeyDown}
              onOpenPortfolioModal={handleOpenPortfolioModal}
              onOpenConnectionModal={handleOpenConnectionModal}
            />
          </div>
        </div>
        <p className="text-gray-600 dark:text-[#9FB4BE]">
          Connect your wallets and import transaction history for accounting
        </p>

        {/* Migration Status Indicator */}
        {migrationStatus && (
          <div className="mt-4 p-3 bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 border-l-4 border-[#5FE3C0] rounded flex items-center">
            <Database className="w-5 h-5 text-[#294050] dark:text-[#F09988] mr-3 flex-shrink-0" />
            <p className="text-sm text-[#294050] dark:text-[#9CF1DC]">
              {migrationStatus}
            </p>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Wallet Connection */}
          <div className="space-y-6">
            <WalletConnector onWalletsChange={handleWalletsChange} />

            {/* Tracked Wallets Section */}
            {trackedWallets.length > 0 && (
              <div className="ledger-card border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Tracked Wallets
                </h3>
                <div className="space-y-3">
                  {trackedWallets.map(wallet => (
                    <TrackedWalletRow
                      key={wallet.id}
                      wallet={wallet}
                      onRemove={handleRemoveTrackedWallet}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Transaction Sync & Display */}
          <div className="space-y-6">
            {/* Sync Controls */}
            {allAddresses.length > 0 && (
              <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sync Transactions
                </h3>

                {/* Network Selection */}
                <div className="mb-4">
                  <label
                    htmlFor="network-select"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Network
                  </label>
                  <select
                    id="network-select"
                    value={selectedNetwork}
                    onChange={handleNetworkChange}
                    className="w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] dark:border-[rgba(95,227,192,0.25)] rounded bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:ring-2 focus:ring-[#5FE3C0] dark:focus:ring-[#5FE3C0] focus:border-transparent"
                  >
                    <option value={NetworkType.POLKADOT}>Polkadot</option>
                    <option value={NetworkType.KUSAMA}>Kusama</option>
                    <option value={NetworkType.ASTAR}>Astar</option>
                    <option value={NetworkType.ACALA}>Acala</option>
                  </select>
                </div>

                {/* Address Selection */}
                <div className="mb-4">
                  <label
                    htmlFor="address-select"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Address
                  </label>
                  <select
                    id="address-select"
                    value={selectedAddress}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] dark:border-[rgba(95,227,192,0.25)] rounded bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:ring-2 focus:ring-[#5FE3C0] dark:focus:ring-[#5FE3C0] focus:border-transparent"
                  >
                    <option value="">Select an address...</option>
                    {allAddresses.map(addr => (
                      <option
                        key={`${addr.source}-${addr.address}`}
                        value={addr.address}
                      >
                        {formatWalletDisplay(addr.address, addr.name)} -{' '}
                        {addr.walletType}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sync Button */}
                <button
                  onClick={syncTransactions}
                  disabled={!selectedAddress || isLoading}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Transactions
                    </>
                  )}
                </button>

                {/* Real-time Sync Toggle & Live Indicator */}
                <div className="mt-4 flex items-center justify-between">
                  <label
                    htmlFor="realtime-sync-toggle"
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                  >
                    <Radio
                      className={`w-4 h-4 ${blockSub.isLive ? 'text-green-500' : 'text-gray-400'}`}
                    />
                    Real-time sync
                  </label>
                  <div className="flex items-center gap-3">
                    {blockSub.isLive && (
                      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        Live
                        {blockSub.latestBlock
                          ? ` #${blockSub.latestBlock.toLocaleString()}`
                          : ''}
                      </span>
                    )}
                    {blockSub.isRefreshing && (
                      <span className="text-xs text-[#294050] dark:text-[#9CF1DC]">
                        <Loader className="w-3 h-3 inline animate-spin mr-1" />
                        Refreshing…
                      </span>
                    )}
                    <button
                      id="realtime-sync-toggle"
                      type="button"
                      role="switch"
                      aria-checked={realtimeSyncEnabled}
                      onClick={handleToggleRealtimeSync}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] focus:ring-offset-2 ${
                        realtimeSyncEnabled
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          realtimeSyncEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                {blockSub.refreshError && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    Live sync error: {blockSub.refreshError}
                  </p>
                )}

                {/* Error Display */}
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                          Sync Failed
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-400">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sync Progress Display */}
                {syncProgress && (
                  <SyncProgressDisplay syncProgress={syncProgress} />
                )}

                {/* Sync Status (Last Sync Info) */}
                {selectedAddress && syncStatus && !syncProgress && !error && (
                  <div className="mt-4 p-3 bg-[#2E9A82]/10 dark:bg-[#5FE3C0]/10 border-l-4 border-[#2E9A82] dark:border-[#5FE3C0] rounded">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Last synced:{' '}
                      {new Date(syncStatus.lastSyncTime).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-[#9FB4BE] mt-1">
                      Block #{syncStatus.lastSyncedBlock.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Instructions (if no wallets available) */}
            {allAddresses.length === 0 && (
              <div className="ledger-card border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Getting Started
                </h3>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-[#9FB4BE]">
                  <li className="flex items-start">
                    <span className="font-semibold text-[#294050] dark:text-[#F09988] mr-2">
                      1.
                    </span>
                    Click the &quot;Add&quot; button above to add a wallet
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold text-[#294050] dark:text-[#F09988] mr-2">
                      2.
                    </span>
                    Choose &quot;Add Portfolio&quot; to track any public
                    address, or &quot;Connect Wallet&quot; for WalletConnect
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold text-[#294050] dark:text-[#F09988] mr-2">
                      3.
                    </span>
                    Select an address and network
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold text-[#294050] dark:text-[#F09988] mr-2">
                      4.
                    </span>
                    Click &quot;Sync Transactions&quot; to import your history
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Transaction List (Full Width) */}
        {(transactions.length > 0 || isLoading || error) && (
          <div className="mt-8">
            <TransactionList
              transactions={transactions}
              isLoading={isLoading}
              error={error}
              onPurge={handlePurgeData}
              onPriceUpdate={currentProfile ? handlePriceUpdate : undefined}
              walletAddress={selectedAddress}
              walletNetwork={selectedNetwork}
            />
          </div>
        )}
      </div>

      {/* Wallet Connection Modal */}
      <WalletConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={handleCloseConnectionModal}
        onWalletAdded={handleAddTrackedWallet}
      />

      {/* Add Portfolio Modal (Read-Only Observer Mode) */}
      <AddPortfolioModal
        isOpen={isPortfolioModalOpen}
        onClose={handleClosePortfolioModal}
        onPortfolioAdded={handleAddPortfolio}
      />
    </div>
  )
}

export default WalletManager
