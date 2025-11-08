import React, { useState, useEffect, useCallback } from 'react'
import { Wallet, Check, AlertCircle, Loader } from 'lucide-react'
import { walletService } from '../../services/wallet/walletService'
import { storageService } from '../../services/database/storageService'
import {
  WalletType,
  type ConnectedWallet,
  type WalletConnectionStatus,
} from '../../services/wallet/types'

interface WalletConnectorProps {
  onWalletsChange?: (wallets: ConnectedWallet[]) => void
}

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
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([])
  const [connectingWallet, setConnectingWallet] = useState<WalletType | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Detect wallets on mount
  useEffect(() => {
    detectWallets()
    loadSavedWallets()
  }, [])

  // Notify parent when wallets change
  useEffect(() => {
    if (onWalletsChange) {
      onWalletsChange(connectedWallets)
    }
  }, [connectedWallets, onWalletsChange])

  const detectWallets = useCallback(async () => {
    try {
      const status = await walletService.detectWallets()
      setWalletStatus(status)
    } catch (err) {
      setError('Failed to detect wallets')
      console.error(err)
    }
  }, [])

  const loadSavedWallets = useCallback(() => {
    const saved = storageService.loadWallets()
    if (saved.length > 0) {
      setConnectedWallets(saved)
    }
  }, [])

  const connectWallet = useCallback(async (walletType: WalletType) => {
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
      storageService.saveWallets(updated)

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
      const errorMessage = err instanceof Error ? err.message : 'Connection failed'
      setError(`Failed to connect to ${walletType}: ${errorMessage}`)
      console.error(err)
    } finally {
      setConnectingWallet(null)
    }
  }, [connectedWallets, walletStatus])

  const disconnectWallet = useCallback(async (walletType: WalletType) => {
    try {
      await walletService.disconnectWallet(walletType)
      const updated = connectedWallets.filter((w) => w.type !== walletType)
      setConnectedWallets(updated)
      storageService.saveWallets(updated)

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
  }, [connectedWallets, walletStatus])

  const isConnected = useCallback(
    (walletType: WalletType) => {
      return connectedWallets.some((w) => w.type === walletType)
    },
    [connectedWallets]
  )

  if (!walletStatus) {
    return (
      <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-[#7c3626] dark:text-[#a04830]" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Detecting wallets...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <Wallet className="w-6 h-6 text-[#7c3626] dark:text-[#a04830] mr-3" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Connect Wallet
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect your Polkadot or Ethereum wallet to import transaction history.
          Pacioli only requests read-only access.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-[#c14040]/10 dark:bg-[#d45050]/10 border-l-4 border-[#c14040] dark:border-[#d45050] p-4 rounded">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-[#c14040] dark:text-[#d45050] mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#c14040] dark:text-[#d45050]">{error}</p>
          </div>
        </div>
      )}

      {/* Wallet List */}
      <div className="space-y-3">
        {(Object.keys(walletStatus) as WalletType[]).map((walletType) => {
          const status = walletStatus[walletType]
          const info = WALLET_INFO[walletType]
          const connected = isConnected(walletType)
          const connecting = connectingWallet === walletType

          return (
            <div
              key={walletType}
              className="ledger-card border border-gray-200 dark:border-gray-700 p-4 hover:border-[#7c3626] dark:hover:border-[#a04830] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {info.name}
                    </h3>
                    {connected && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#2d7738]/10 dark:bg-[#3d9147]/10 text-[#2d7738] dark:text-[#3d9147]">
                        <Check className="w-3 h-3 mr-1" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {info.description}
                  </p>

                  {connected && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      {connectedWallets
                        .find((w) => w.type === walletType)
                        ?.accounts.map((acc) => (
                          <div key={acc.address} className="truncate">
                            {acc.name || 'Unnamed'}: {acc.address}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  {!status.isDetected ? (
                    <a
                      href={info.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-sm"
                    >
                      Install
                    </a>
                  ) : connected ? (
                    <button
                      onClick={() => disconnectWallet(walletType)}
                      className="px-4 py-2 text-sm font-medium text-[#c14040] dark:text-[#d45050] border border-[#c14040] dark:border-[#d45050] rounded hover:bg-[#c14040]/10 dark:hover:bg-[#d45050]/10 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connectWallet(walletType)}
                      disabled={connecting}
                      className="btn-primary text-sm"
                    >
                      {connecting ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Connected Wallets Summary */}
      {connectedWallets.length > 0 && (
        <div className="ledger-card ledger-card-donation border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Connected Accounts Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Wallets:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {connectedWallets.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Accounts:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {connectedWallets.reduce((sum, w) => sum + w.accounts.length, 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
