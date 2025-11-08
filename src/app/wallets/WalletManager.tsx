import React, { useState, useCallback, useEffect } from 'react'
import { RefreshCw, Wallet, Database, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { WalletConnector } from '../../components/wallet/WalletConnector'
import { TransactionList } from '../../components/wallet/TransactionList'
import { polkadotService, type SyncProgress } from '../../services/blockchain/polkadotService'
import { indexedDBService } from '../../services/database/indexedDBService'
import { migrationService } from '../../services/database/migrationService'
import { NetworkType, type ConnectedWallet, type Transaction } from '../../services/wallet/types'
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto'

/**
 * Convert address to the correct SS58 format for the given network
 * Polkadot wallets may return addresses in generic format (42) but we need network-specific format
 */
const convertToNetworkFormat = (address: string, network: NetworkType): string => {
  try {
    // Get SS58 prefix for each network
    const ss58Formats: Record<NetworkType, number> = {
      polkadot: 0,   // Polkadot addresses start with '1'
      kusama: 2,     // Kusama addresses start with various letters
      moonbeam: 1284, // Moonbeam
      moonriver: 1285, // Moonriver
      astar: 5,      // Astar
      acala: 10,     // Acala
    }

    const ss58Prefix = ss58Formats[network]

    // Decode the address (removes SS58 encoding, gets raw public key)
    const publicKey = decodeAddress(address)

    // Re-encode with correct network prefix
    const networkAddress = encodeAddress(publicKey, ss58Prefix)

    console.log(`📍 Address conversion: ${address} -> ${networkAddress} (${network}, prefix ${ss58Prefix})`)

    return networkAddress
  } catch (error) {
    console.error('Failed to convert address format:', error)
    return address // Fallback to original if conversion fails
  }
}

const WalletManager: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(NetworkType.POLKADOT)
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([])
  const [dbInitialized, setDbInitialized] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<string>('')
  const [syncStatus, setSyncStatus] = useState<{ lastSyncTime: Date; lastSyncedBlock: number } | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)

  // Initialize IndexedDB and run migration on mount
  useEffect(() => {
    const initializeDB = async () => {
      try {
        setMigrationStatus('Initializing database...')

        // Initialize IndexedDB
        await indexedDBService.init()

        // Check if migration is needed
        const hasMigrated = await migrationService.hasMigrated()

        if (!hasMigrated) {
          setMigrationStatus('Migrating data from localStorage...')
          const result = await migrationService.migrateAll()

          if (result.success) {
            console.log('Migration successful:', result)
            setMigrationStatus(`Migrated ${result.transactionsMigrated} transactions`)
            setTimeout(() => setMigrationStatus(''), 3000)
          } else {
            console.error('Migration had errors:', result.errors)
            setMigrationStatus('Migration completed with warnings')
          }
        }

        setDbInitialized(true)
        setMigrationStatus('')

        // Load saved wallets from IndexedDB
        console.log('💾 Loading saved wallets from IndexedDB...')
        const savedWallets = await indexedDBService.loadWallets()
        if (savedWallets.length > 0) {
          console.log(`💾 Restored ${savedWallets.length} saved wallet(s)`)
          setConnectedWallets(savedWallets)
        }

        // Load last selected address and network from localStorage
        const lastAddress = localStorage.getItem('pacioli_last_address')
        const lastNetwork = localStorage.getItem('pacioli_last_network') as NetworkType | null

        if (lastAddress) {
          console.log(`💾 Restoring last address: ${lastAddress}`)
          setSelectedAddress(lastAddress)
        }
        if (lastNetwork) {
          console.log(`💾 Restoring last network: ${lastNetwork}`)
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
    const loadData = async () => {
      if (!dbInitialized || !selectedAddress) {
        setSyncStatus(null)
        setTransactions([])
        return
      }

      try {
        // Convert address to network-specific format
        const networkAddress = convertToNetworkFormat(selectedAddress, selectedNetwork)

        // Load sync status
        const status = await indexedDBService.loadSyncStatus(selectedNetwork, networkAddress)
        setSyncStatus(status)

        // Load saved transactions from IndexedDB
        console.log(`💾 Loading transactions for ${networkAddress} on ${selectedNetwork}...`)
        const savedTxs = await indexedDBService.getTransactionsFor(selectedNetwork, networkAddress)
        console.log(`💾 Loaded ${savedTxs.length} saved transactions from IndexedDB`)
        setTransactions(savedTxs)

        // Save selection to localStorage for persistence
        localStorage.setItem('pacioli_last_address', selectedAddress)
        localStorage.setItem('pacioli_last_network', selectedNetwork)
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }

    loadData()
  }, [selectedAddress, selectedNetwork, dbInitialized])

  // Handle wallet changes from WalletConnector
  const handleWalletsChange = useCallback(async (wallets: ConnectedWallet[]) => {
    setConnectedWallets(wallets)

    // Save wallets to IndexedDB for persistence
    try {
      await indexedDBService.saveWallets(wallets)
      console.log(`💾 Saved ${wallets.length} wallet(s) to IndexedDB`)
    } catch (err) {
      console.error('Failed to save wallets to IndexedDB:', err)
    }

    // Auto-select first available address (only if none selected)
    if (wallets.length > 0 && wallets[0].accounts.length > 0 && !selectedAddress) {
      setSelectedAddress(wallets[0].accounts[0].address)
    }
  }, [selectedAddress])

  // Handle address selection
  const handleAddressSelect = useCallback((address: string) => {
    setSelectedAddress(address)
    // Note: Transactions will be auto-loaded by the useEffect above
  }, [])

  // Sync transactions from blockchain
  const syncTransactions = useCallback(async () => {
    console.log('=== SYNC BUTTON CLICKED ===')
    console.log('Selected Address (from wallet):', selectedAddress)
    console.log('Selected Network:', selectedNetwork)
    console.log('DB Initialized:', dbInitialized)

    if (!selectedAddress) {
      console.error('ERROR: No address selected')
      setError('Please select an address first')
      return
    }

    if (!dbInitialized) {
      console.error('ERROR: Database not initialized')
      setError('Database not initialized')
      return
    }

    // Convert address to network-specific SS58 format
    // Wallets may return generic format (42) but we need network-specific
    const networkAddress = convertToNetworkFormat(selectedAddress, selectedNetwork)
    console.log('Converted Address (network-specific):', networkAddress)

    setIsLoading(true)
    setError(null)
    setSyncProgress(null)

    console.log(`✅ Starting sync for address: ${networkAddress} on ${selectedNetwork}`)
    console.log('Calling polkadotService.connect()...')

    // Add timeout to prevent infinite hanging
    const syncTimeout = setTimeout(() => {
      console.error('Sync timeout after 5 minutes')
      setError('Sync timeout: The operation took too long. Please try again with a more active address.')
      setIsLoading(false)
      setSyncProgress(null)
    }, 300000) // 5 minute timeout

    try {
      // Fetch transactions using HYBRID approach (Subscan + RPC)
      // This is MUCH faster: ~2-3 seconds instead of minutes/hours
      // Note: RPC connection is now optional - if it fails, we still get Subscan data
      console.log('Calling fetchTransactionHistoryHybrid...')
      console.log('Parameters:', {
        network: selectedNetwork,
        address: networkAddress,
        limit: 100
      })

      const txs = await polkadotService.fetchTransactionHistoryHybrid(selectedNetwork, {
        address: networkAddress,
        limit: 100, // Increased limit since hybrid is much faster
        onProgress: (progress) => {
          console.log('Progress update:', progress)
          setSyncProgress(progress)
        },
      })

      console.log(`✅ Fetch complete! Received ${txs.length} transactions:`, txs)

      // Report saving stage
      console.log('Saving transactions to IndexedDB...')
      setSyncProgress({
        stage: 'saving',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: txs.length,
        message: `Saving ${txs.length} transaction${txs.length !== 1 ? 's' : ''} to database...`,
      })

      // Save to IndexedDB using NETWORK-SPECIFIC ADDRESS
      await indexedDBService.saveTransactions(selectedNetwork, networkAddress, txs)
      console.log('✅ Saved to IndexedDB')

      // Update sync status
      if (txs.length > 0) {
        console.log('Updating sync status...')
        const lastBlock = Math.max(...txs.map((tx) => tx.blockNumber))
        await indexedDBService.saveSyncStatus({
          network: selectedNetwork,
          address: networkAddress,
          lastSyncedBlock: lastBlock,
          lastSyncTime: new Date(),
          isSyncing: false,
        })
        console.log(`✅ Sync status updated (last block: ${lastBlock})`)
      }

      // Reload from IndexedDB to get all transactions using NETWORK-SPECIFIC ADDRESS
      console.log('Reloading all transactions from IndexedDB...')
      const allTxs = await indexedDBService.getTransactionsFor(selectedNetwork, networkAddress)
      console.log(`✅ Loaded ${allTxs.length} total transactions from IndexedDB`)
      setTransactions(allTxs)

      // Update local sync status display
      const newSyncStatus = await indexedDBService.loadSyncStatus(selectedNetwork, networkAddress)
      setSyncStatus(newSyncStatus)

      // Show success
      console.log('✅✅✅ SYNC COMPLETE ✅✅✅')
      setSyncProgress({
        stage: 'complete',
        currentBlock: 0,
        totalBlocks: 0,
        blocksScanned: 0,
        transactionsFound: txs.length,
        message: `Successfully synced ${txs.length} transaction${txs.length !== 1 ? 's' : ''}`,
      })

      // Clear progress after 3 seconds
      setTimeout(() => setSyncProgress(null), 3000)

      // Clear timeout on success
      clearTimeout(syncTimeout)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync transactions'
      console.error('❌❌❌ SYNC FAILED ❌❌❌')
      console.error('Error:', err)
      console.error('Error message:', errorMessage)
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      setError(errorMessage)
      setSyncProgress(null)

      // Clear timeout on error
      clearTimeout(syncTimeout)
    } finally {
      console.log('=== SYNC FINISHED (finally block) ===')
      setIsLoading(false)
    }
  }, [selectedAddress, selectedNetwork, dbInitialized])

  // Purge wallet transaction data
  const handlePurgeData = useCallback(async () => {
    if (!selectedAddress || !dbInitialized) {
      console.error('Cannot purge: no address selected or DB not initialized')
      return
    }

    console.log('🗑️ [Purge] Starting purge of wallet transactions...')

    try {
      // Clear transactions from IndexedDB for this address/network
      // Note: We can't selectively delete by address from IndexedDB easily,
      // so we'll clear all transactions and let user re-sync if needed
      await indexedDBService.clearTransactions()
      console.log('🗑️ [Purge] Cleared all transactions from IndexedDB')

      // Clear local state
      setTransactions([])
      setSyncStatus(null)

      console.log('🗑️ [Purge] ✅ Purge complete!')

    } catch (err) {
      console.error('🗑️ [Purge] ❌ Failed to purge data:', err)
      setError('Failed to purge transaction data')
    }
  }, [selectedAddress, selectedNetwork, dbInitialized])

  // Get all available addresses from connected wallets
  const allAddresses = connectedWallets.flatMap((wallet) =>
    wallet.accounts.map((acc) => ({
      address: acc.address,
      name: acc.name || 'Unnamed',
      walletType: wallet.type,
    }))
  )

  return (
    <div className="min-h-screen ledger-background p-6 md:p-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center mb-3">
          <Wallet className="w-8 h-8 text-[#7c3626] dark:text-[#a04830] mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Wallet Manager
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your Polkadot wallets and import transaction history for accounting
        </p>

        {/* Migration Status Indicator */}
        {migrationStatus && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded flex items-center">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-300">{migrationStatus}</p>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Wallet Connection */}
          <div>
            <WalletConnector onWalletsChange={handleWalletsChange} />
          </div>

          {/* Right Column: Transaction Sync & Display */}
          <div className="space-y-6">
            {/* Sync Controls */}
            {connectedWallets.length > 0 && (
              <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sync Transactions
                </h3>

                {/* Network Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Network
                  </label>
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value as NetworkType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#7c3626] dark:focus:ring-[#a04830] focus:border-transparent"
                  >
                    <option value={NetworkType.POLKADOT}>Polkadot</option>
                    <option value={NetworkType.KUSAMA}>Kusama</option>
                    <option value={NetworkType.MOONBEAM}>Moonbeam</option>
                    <option value={NetworkType.MOONRIVER}>Moonriver</option>
                    <option value={NetworkType.ASTAR}>Astar</option>
                    <option value={NetworkType.ACALA}>Acala</option>
                  </select>
                </div>

                {/* Address Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address
                  </label>
                  <select
                    value={selectedAddress}
                    onChange={(e) => handleAddressSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#7c3626] dark:focus:ring-[#a04830] focus:border-transparent"
                  >
                    <option value="">Select an address...</option>
                    {allAddresses.map((addr) => (
                      <option key={addr.address} value={addr.address}>
                        {addr.name} ({addr.address.slice(0, 8)}...
                        {addr.address.slice(-6)}) - {addr.walletType}
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

                {/* Error Display */}
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                          Sync Failed
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sync Progress Display */}
                {syncProgress && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                    <div className="flex items-start mb-3">
                      {syncProgress.stage === 'complete' ? (
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
                      ) : (
                        <Loader className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0 animate-spin" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                          {syncProgress.stage === 'connecting' && 'Connecting to Network'}
                          {syncProgress.stage === 'fetching' && 'Fetching Transactions'}
                          {syncProgress.stage === 'processing' && 'Processing Blocks'}
                          {syncProgress.stage === 'saving' && 'Saving to Database'}
                          {syncProgress.stage === 'complete' && 'Sync Complete'}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          {syncProgress.message}
                        </p>
                      </div>
                    </div>

                    {/* Progress Details */}
                    {(syncProgress.stage === 'fetching' || syncProgress.stage === 'processing') && (
                      <div className="space-y-2">
                        {/* Progress Bar */}
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                (syncProgress.blocksScanned / Math.max(syncProgress.totalBlocks, 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>

                        {/* Stats */}
                        <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                          <span>
                            Blocks: {syncProgress.blocksScanned.toLocaleString()} / {syncProgress.totalBlocks.toLocaleString()}
                          </span>
                          <span>
                            {Math.round(
                              (syncProgress.blocksScanned / Math.max(syncProgress.totalBlocks, 1)) * 100
                            )}%
                          </span>
                        </div>

                        {/* Transaction Count */}
                        {syncProgress.transactionsFound > 0 && (
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Found {syncProgress.transactionsFound.toLocaleString()} transaction{syncProgress.transactionsFound !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Sync Status (Last Sync Info) */}
                {selectedAddress && syncStatus && !syncProgress && !error && (
                  <div className="mt-4 p-3 bg-[#2d7738]/10 dark:bg-[#3d9147]/10 border-l-4 border-[#2d7738] dark:border-[#3d9147] rounded">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Last synced: {new Date(syncStatus.lastSyncTime).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Block #{syncStatus.lastSyncedBlock.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Instructions (if no wallets connected) */}
            {connectedWallets.length === 0 && (
              <div className="ledger-card border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Getting Started
                </h3>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="font-semibold text-[#7c3626] dark:text-[#a04830] mr-2">
                      1.
                    </span>
                    Install a Polkadot wallet extension (Polkadot.js, Talisman, or SubWallet)
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold text-[#7c3626] dark:text-[#a04830] mr-2">
                      2.
                    </span>
                    Click the "Connect" button for your wallet
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold text-[#7c3626] dark:text-[#a04830] mr-2">
                      3.
                    </span>
                    Select an address and network
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold text-[#7c3626] dark:text-[#a04830] mr-2">
                      4.
                    </span>
                    Click "Sync Transactions" to import your history
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
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default WalletManager
