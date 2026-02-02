import React, { useState, useEffect, useCallback, memo } from 'react'
import {
  Wallet,
  Check,
  AlertCircle,
  Loader,
  Pencil,
  X,
  Save,
  Info,
} from 'lucide-react'
import { walletService } from '../../services/wallet/walletService'
import { StorageService } from '../../services/database/storageService'
import {
  WalletType,
  type ConnectedWallet,
  type WalletConnectionStatus,
  type WalletAccount,
} from '../../services/wallet/types'
import { useWalletAliases } from '../../contexts/WalletAliasContext'
import { isTauriAvailable } from '../../utils/tauri'

interface WalletConnectorProps {
  onWalletsChange?: (wallets: ConnectedWallet[]) => void
}

// Memoized account row component to prevent unnecessary re-renders
interface AccountRowProps {
  account: WalletAccount
  isEditing: boolean
  currentAlias: string | undefined
  aliasInput: string
  onAliasInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (e: React.KeyboardEvent, address: string) => void
  onSave: (address: string) => void
  onCancel: () => void
  onStartEdit: (address: string) => void
}

const AccountRow = memo(function AccountRow({
  account,
  isEditing,
  currentAlias,
  aliasInput,
  onAliasInputChange,
  onKeyDown,
  onSave,
  onCancel,
  onStartEdit,
}: AccountRowProps) {
  const displayName = currentAlias || account.name || 'Unnamed'

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyDown(e, account.address)
    },
    [onKeyDown, account.address]
  )

  const handleSave = useCallback(() => {
    onSave(account.address)
  }, [onSave, account.address])

  const handleStartEdit = useCallback(() => {
    onStartEdit(account.address)
  }, [onStartEdit, account.address])

  return (
    <div className="flex items-center gap-2 p-2 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg">
      {isEditing ? (
        // Editing mode
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={aliasInput}
            onChange={onAliasInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter alias..."
            className="flex-1 px-2 py-1 text-sm border border-[rgba(201,169,97,0.15)] rounded bg-[#fafaf8] dark:bg-[#2a2620] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
          />
          <button
            onClick={handleSave}
            className="p-1 text-[#7a9b6f] hover:bg-[#7a9b6f]/10 rounded"
            title="Save alias"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] rounded"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Display mode
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                {displayName}
              </span>
              {currentAlias && account.name && (
                <span className="text-xs text-[#a39d94]">({account.name})</span>
              )}
            </div>
            <div className="text-xs text-[#696557] dark:text-[#b8b3ac] font-mono truncate">
              {account.address.slice(0, 10)}...{account.address.slice(-8)}
            </div>
          </div>
          <button
            onClick={handleStartEdit}
            className="p-1.5 text-[#a39d94] hover:text-[#8b4e52] dark:hover:text-[#a86e72] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] rounded transition-colors"
            title="Edit alias"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
})

// Memoized wallet action button component
interface WalletActionsProps {
  walletType: WalletType
  isDetected: boolean
  isConnected: boolean
  isConnecting: boolean
  installUrl: string
  onConnect: (walletType: WalletType) => void
  onDisconnect: (walletType: WalletType) => void
}

const WalletActions = memo(function WalletActions({
  walletType,
  isDetected,
  isConnected,
  isConnecting,
  installUrl,
  onConnect,
  onDisconnect,
}: WalletActionsProps) {
  const handleConnect = useCallback(() => {
    onConnect(walletType)
  }, [onConnect, walletType])

  const handleDisconnect = useCallback(() => {
    onDisconnect(walletType)
  }, [onDisconnect, walletType])

  if (!isDetected) {
    return (
      <a
        href={installUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary text-sm"
      >
        Install
      </a>
    )
  }

  if (isConnected) {
    return (
      <button
        onClick={handleDisconnect}
        className="px-4 py-2 text-sm font-medium text-[#dc2626] dark:text-[#ef4444] border border-[#dc2626] dark:border-[#ef4444] rounded hover:bg-[#dc2626]/10 dark:hover:bg-[#ef4444]/10 transition-colors"
      >
        Disconnect
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="btn-primary text-sm"
    >
      {isConnecting ? (
        <>
          <Loader className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        'Connect'
      )}
    </button>
  )
})

// Memoized account list component
interface AccountListProps {
  accounts: WalletAccount[]
  editingAlias: string | null
  aliases: Record<string, string>
  aliasInput: string
  onAliasInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (e: React.KeyboardEvent, address: string) => void
  onSave: (address: string) => void
  onCancel: () => void
  onStartEdit: (address: string) => void
}

const AccountList = memo(function AccountList({
  accounts,
  editingAlias,
  aliases,
  aliasInput,
  onAliasInputChange,
  onKeyDown,
  onSave,
  onCancel,
  onStartEdit,
}: AccountListProps) {
  if (accounts.length === 0) {
    return null
  }

  return (
    <div className="mt-3 space-y-2">
      {accounts.map(account => (
        <AccountRow
          key={account.address}
          account={account}
          isEditing={editingAlias === account.address}
          currentAlias={aliases[account.address]}
          aliasInput={aliasInput}
          onAliasInputChange={onAliasInputChange}
          onKeyDown={onKeyDown}
          onSave={onSave}
          onCancel={onCancel}
          onStartEdit={onStartEdit}
        />
      ))}
    </div>
  )
})

const WALLET_INFO = {
  [WalletType.POLKADOT_JS]: {
    name: 'Polkadot.js Extension',
    description: 'Official Polkadot browser extension',
    installUrl: 'https://polkadot.js.org/extension/',
  },
  [WalletType.TALISMAN]: {
    name: 'Talisman',
    description: 'Multi-chain wallet for Polkadot & Ethereum',
    installUrl: 'https://talisman.xyz/',
  },
  [WalletType.SUBWALLET]: {
    name: 'SubWallet',
    description: 'Comprehensive Polkadot ecosystem wallet',
    installUrl: 'https://subwallet.app/',
  },
  [WalletType.METAMASK]: {
    name: 'MetaMask',
    description: 'Ethereum wallet for EVM chains',
    installUrl: 'https://metamask.io/',
  },
}

export const WalletConnector: React.FC<WalletConnectorProps> = ({
  onWalletsChange,
}) => {
  const [walletStatus, setWalletStatus] = useState<Record<
    WalletType,
    WalletConnectionStatus
  > | null>(null)
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>(
    []
  )
  const [connectingWallet, setConnectingWallet] = useState<WalletType | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  // Check if running in Tauri (browser extensions not available)
  const [isInTauri] = useState(() => isTauriAvailable())

  // Alias editing state
  const [editingAlias, setEditingAlias] = useState<string | null>(null) // address being edited
  const [aliasInput, setAliasInput] = useState('')
  const { aliases, setAlias } = useWalletAliases()

  const detectWallets = useCallback(async () => {
    // Skip wallet detection in Tauri since browser extensions aren't available
    if (isTauriAvailable()) {
      setWalletStatus({} as Record<WalletType, WalletConnectionStatus>)
      return
    }
    try {
      const status = await walletService.detectWallets()
      setWalletStatus(status)
    } catch (err) {
      setError('Failed to detect wallets')
      console.error(err)
    }
  }, [])

  const loadSavedWallets = useCallback(() => {
    const saved = StorageService.loadWallets()
    if (saved.length > 0) {
      setConnectedWallets(saved)
    }
  }, [])

  // Detect wallets on mount
  useEffect(() => {
    detectWallets()
    loadSavedWallets()
  }, [detectWallets, loadSavedWallets])

  // Notify parent when wallets change
  useEffect(() => {
    if (onWalletsChange) {
      onWalletsChange(connectedWallets)
    }
  }, [connectedWallets, onWalletsChange])

  const connectWallet = useCallback(
    async (walletType: WalletType) => {
      setConnectingWallet(walletType)
      setError(null)

      try {
        let wallet: ConnectedWallet

        if (walletType === WalletType.METAMASK) {
          wallet = await walletService.connectEVMWallet()
        } else {
          wallet = await walletService.connectSubstrateWallet(walletType)
        }

        const updated = [...connectedWallets, wallet]
        setConnectedWallets(updated)
        StorageService.saveWallets(updated)

        // Update wallet status
        if (walletStatus) {
          setWalletStatus({
            ...walletStatus,
            [walletType]: {
              ...walletStatus[walletType],
              isConnected: true,
            },
          })
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Connection failed'
        setError(`Failed to connect to ${walletType}: ${errorMessage}`)
        console.error(err)
      } finally {
        setConnectingWallet(null)
      }
    },
    [connectedWallets, walletStatus]
  )

  const disconnectWallet = useCallback(
    async (walletType: WalletType) => {
      try {
        await walletService.disconnectWallet(walletType)
        const updated = connectedWallets.filter(w => w.type !== walletType)
        setConnectedWallets(updated)
        StorageService.saveWallets(updated)

        // Update wallet status
        if (walletStatus) {
          setWalletStatus({
            ...walletStatus,
            [walletType]: {
              ...walletStatus[walletType],
              isConnected: false,
            },
          })
        }

        setError(null)
      } catch (err) {
        setError('Failed to disconnect wallet')
        console.error(err)
      }
    },
    [connectedWallets, walletStatus]
  )

  const isConnected = useCallback(
    (walletType: WalletType) => {
      return connectedWallets.some(w => w.type === walletType)
    },
    [connectedWallets]
  )

  // Start editing an alias
  const startEditingAlias = useCallback(
    (address: string) => {
      setEditingAlias(address)
      setAliasInput(aliases[address.toLowerCase()] || '')
    },
    [aliases]
  )

  // Cancel editing
  const cancelEditingAlias = useCallback(() => {
    setEditingAlias(null)
    setAliasInput('')
  }, [])

  // Save alias
  const saveAlias = useCallback(
    async (address: string) => {
      const trimmedAlias = aliasInput.trim()
      if (trimmedAlias) {
        await setAlias(address, trimmedAlias)
      }
      setEditingAlias(null)
      setAliasInput('')
    },
    [aliasInput, setAlias]
  )

  // Handle Enter key to save
  const handleAliasKeyDown = useCallback(
    (e: React.KeyboardEvent, address: string) => {
      if (e.key === 'Enter') {
        saveAlias(address)
      } else if (e.key === 'Escape') {
        cancelEditingAlias()
      }
    },
    [saveAlias, cancelEditingAlias]
  )

  // Handle alias input change
  const handleAliasInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAliasInput(e.target.value)
    },
    []
  )

  if (!walletStatus) {
    return (
      <div className="ledger-card ledger-card-financial border border-[rgba(201,169,97,0.15)] p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-[#8b4e52] dark:text-[#a86e72]" />
          <span className="ml-3 text-[#696557] dark:text-[#b8b3ac]">
            Detecting wallets...
          </span>
        </div>
      </div>
    )
  }

  // In Tauri desktop app, browser extensions are not available
  // Show informational message instead
  if (isInTauri) {
    return (
      <div className="ledger-card ledger-card-financial border border-[rgba(201,169,97,0.15)] p-6">
        <div className="flex items-center mb-4">
          <Wallet className="w-6 h-6 text-[#8b4e52] dark:text-[#a86e72] mr-3" />
          <h2 className="text-xl font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
            Connect Wallet
          </h2>
        </div>
        <div className="flex items-start p-4 bg-[#c9a961]/10 rounded-lg border border-[#c9a961]/20 mb-4">
          <Info className="w-5 h-5 text-[#c9a961] mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[#1a1815] dark:text-[#f5f3f0] font-medium mb-1">
              Desktop App Mode
            </p>
            <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
              Browser wallet extensions are not available in the desktop app. Use the &quot;Add&quot; button above to:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[#696557] dark:text-[#b8b3ac]">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-[#8b4e52] rounded-full mr-2"></span>
                <strong>Add Portfolio</strong> - Track any public address (read-only)
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-[#8b4e52] rounded-full mr-2"></span>
                <strong>Connect Wallet</strong> - Use WalletConnect with your mobile wallet
              </li>
            </ul>
          </div>
        </div>
        {connectedWallets.length > 0 && (
          <div className="ledger-card ledger-card-donation border border-[rgba(201,169,97,0.15)] p-4">
            <h3 className="font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-3">
              Connected Accounts Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#696557] dark:text-[#b8b3ac]">
                  Total Wallets:
                </span>
                <span className="font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                  {connectedWallets.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#696557] dark:text-[#b8b3ac]">
                  Total Accounts:
                </span>
                <span className="font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                  {connectedWallets.reduce(
                    (sum, w) => sum + w.accounts.length,
                    0
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="ledger-card ledger-card-financial border border-[rgba(201,169,97,0.15)] p-6">
        <div className="flex items-center mb-4">
          <Wallet className="w-6 h-6 text-[#8b4e52] dark:text-[#a86e72] mr-3" />
          <h2 className="text-xl font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
            Connect Wallet
          </h2>
        </div>
        <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
          Connect your Polkadot or Ethereum wallet to import transaction
          history. Pacioli only requests read-only access.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-[#dc2626]/10 dark:bg-[#ef4444]/10 border-l-4 border-[#dc2626] dark:border-[#ef4444] p-4 rounded">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-[#dc2626] dark:text-[#ef4444] mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#dc2626] dark:text-[#ef4444]">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Wallet List */}
      <div className="space-y-3">
        {(Object.keys(walletStatus) as WalletType[]).map(walletType => {
          const status = walletStatus[walletType]
          const info = WALLET_INFO[walletType]
          const connected = isConnected(walletType)
          const connecting = connectingWallet === walletType

          return (
            <div
              key={walletType}
              className="ledger-card border border-[rgba(201,169,97,0.15)] p-4 hover:border-[#8b4e52] dark:hover:border-[#a86e72] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                      {info.name}
                    </h3>
                    {connected && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#7a9b6f]/10 dark:bg-[#8faf84]/20 text-[#7a9b6f] dark:text-[#8faf84]">
                        <Check className="w-3 h-3 mr-1" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
                    {info.description}
                  </p>

                  {connected && (
                    <AccountList
                      accounts={
                        connectedWallets.find(w => w.type === walletType)
                          ?.accounts || []
                      }
                      editingAlias={editingAlias}
                      aliases={aliases}
                      aliasInput={aliasInput}
                      onAliasInputChange={handleAliasInputChange}
                      onKeyDown={handleAliasKeyDown}
                      onSave={saveAlias}
                      onCancel={cancelEditingAlias}
                      onStartEdit={startEditingAlias}
                    />
                  )}
                </div>

                <div className="ml-4">
                  <WalletActions
                    walletType={walletType}
                    isDetected={status.isDetected}
                    isConnected={connected}
                    isConnecting={connecting}
                    installUrl={info.installUrl}
                    onConnect={connectWallet}
                    onDisconnect={disconnectWallet}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Connected Wallets Summary */}
      {connectedWallets.length > 0 && (
        <div className="ledger-card ledger-card-donation border border-[rgba(201,169,97,0.15)] p-6">
          <h3 className="font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-3">
            Connected Accounts Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#696557] dark:text-[#b8b3ac]">
                Total Wallets:
              </span>
              <span className="font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                {connectedWallets.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#696557] dark:text-[#b8b3ac]">
                Total Accounts:
              </span>
              <span className="font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                {connectedWallets.reduce(
                  (sum, w) => sum + w.accounts.length,
                  0
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
