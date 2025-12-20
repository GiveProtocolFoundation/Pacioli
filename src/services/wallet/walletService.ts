/**
 * Wallet Connection Service
 * Handles detection and connection to Substrate and EVM wallet extensions
 */

import { web3Accounts, web3Enable } from '@polkadot/extension-dapp'
import type {
  InjectedAccountWithMeta,
  InjectedExtension,
} from '@polkadot/extension-inject/types'
import detectEthereumProvider from '@metamask/detect-provider'

import {
  WalletType,
  ChainType,
  type WalletAccount,
  type ConnectedWallet,
  type WalletConnectionStatus,
} from './types'

const APP_NAME = 'Pacioli'

class WalletService {
  private enabledExtensions: InjectedExtension[] = []
  private connectedWallets: Map<WalletType, ConnectedWallet> = new Map()

  /**
   * Detect available wallet extensions
   */
  async detectWallets(): Promise<Record<WalletType, WalletConnectionStatus>> {
    const status: Record<WalletType, WalletConnectionStatus> = {
      [WalletType.POLKADOT_JS]: {
        isDetected: false,
        isEnabled: false,
        isConnected: false,
      },
      [WalletType.TALISMAN]: {
        isDetected: false,
        isEnabled: false,
        isConnected: false,
      },
      [WalletType.SUBWALLET]: {
        isDetected: false,
        isEnabled: false,
        isConnected: false,
      },
      [WalletType.METAMASK]: {
        isDetected: false,
        isEnabled: false,
        isConnected: false,
      },
    }

    // Detect Substrate wallets
    try {
      const extensions = await web3Enable(APP_NAME)

      for (const ext of extensions) {
        if (ext.name === 'polkadot-js') {
          status[WalletType.POLKADOT_JS] = {
            isDetected: true,
            isEnabled: true,
            isConnected: false,
          }
        } else if (ext.name === 'talisman') {
          status[WalletType.TALISMAN] = {
            isDetected: true,
            isEnabled: true,
            isConnected: false,
          }
        } else if (ext.name === 'subwallet-js') {
          status[WalletType.SUBWALLET] = {
            isDetected: true,
            isEnabled: true,
            isConnected: false,
          }
        }
      }

      this.enabledExtensions = extensions
    } catch (error) {
      console.error('Error detecting Substrate wallets:', error)
    }

    // Detect MetaMask - check after a small delay to ensure extension is injected
    try {
      // Check if window.ethereum exists and is MetaMask
      if (window.ethereum?.isMetaMask) {
        status[WalletType.METAMASK] = {
          isDetected: true,
          isEnabled: true,
          isConnected: false,
        }
      } else if (window.ethereum?.providers) {
        // Check for MetaMask in providers array (multiple wallet extensions)
        const metamaskProvider = window.ethereum.providers.find(
          p => p.isMetaMask && !p.isTalisman && !p.isSubWallet
        )
        if (metamaskProvider) {
          status[WalletType.METAMASK] = {
            isDetected: true,
            isEnabled: true,
            isConnected: false,
          }
        }
      } else {
        // Fallback to provider detection
        const provider = await detectEthereumProvider({ timeout: 3000 })
        if (provider) {
          status[WalletType.METAMASK] = {
            isDetected: true,
            isEnabled: true,
            isConnected: false,
          }
        }
      }
    } catch (error) {
      console.error('Error detecting MetaMask:', error)
    }

    return status
  }

  /**
   * Connect to a Substrate wallet (Polkadot.js, Talisman, SubWallet)
   */
  async connectSubstrateWallet(
    walletType: WalletType
  ): Promise<ConnectedWallet> {
    if (walletType === WalletType.METAMASK) {
      throw new Error('Use connectEVMWallet for MetaMask')
    }

    try {
      // Enable the extension if not already enabled
      if (this.enabledExtensions.length === 0) {
        this.enabledExtensions = await web3Enable(APP_NAME)
      }

      const extension = this.enabledExtensions.find(ext => {
        if (walletType === WalletType.POLKADOT_JS)
          return ext.name === 'polkadot-js'
        if (walletType === WalletType.TALISMAN) return ext.name === 'talisman'
        if (walletType === WalletType.SUBWALLET)
          return ext.name === 'subwallet-js'
        return false
      })

      if (!extension) {
        throw new Error(`${walletType} extension not found`)
      }

      // Get accounts
      const injectedAccounts = await web3Accounts()
      const accounts: WalletAccount[] = injectedAccounts
        .filter(account => account.meta.source === extension.name)
        .map((account: InjectedAccountWithMeta) => ({
          address: account.address,
          name: account.meta.name,
          source: walletType,
          type: ChainType.SUBSTRATE,
          genesisHash: account.meta.genesisHash?.toString(),
        }))

      const connectedWallet: ConnectedWallet = {
        type: walletType,
        name: extension.name,
        version: extension.version || '1.0.0',
        accounts,
        isConnected: true,
        chainType: ChainType.SUBSTRATE,
      }

      this.connectedWallets.set(walletType, connectedWallet)
      return connectedWallet
    } catch (error) {
      console.error(`Error connecting to ${walletType}:`, error)
      throw error
    }
  }

  /**
   * Connect to MetaMask (EVM wallet)
   */
  async connectEVMWallet(): Promise<ConnectedWallet> {
    try {
      // Get the correct MetaMask provider (handle conflicts with other wallets)
      let provider = window.ethereum

      // If multiple providers exist (e.g., MetaMask + SubWallet), find MetaMask specifically
      if (window.ethereum?.providers) {
        const metamaskProvider = window.ethereum.providers.find(
          p => p.isMetaMask && !p.isTalisman && !p.isSubWallet
        )
        if (metamaskProvider) {
          provider = metamaskProvider
        }
      }

      if (!provider) {
        throw new Error(
          'MetaMask not installed. Please install MetaMask extension.'
        )
      }

      // Verify it's actually MetaMask
      if (!provider.isMetaMask) {
        throw new Error(
          'MetaMask not detected. Please install MetaMask extension.'
        )
      }

      // Request account access with timeout
      const accountsRaw = await Promise.race([
        provider.request({
          method: 'eth_requestAccounts',
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection timeout - please try again')),
            60000
          )
        ),
      ])

      if (!accountsRaw || (accountsRaw as string[]).length === 0) {
        throw new Error(
          'No accounts found. Please unlock MetaMask and try again.'
        )
      }

      const accounts: WalletAccount[] = (accountsRaw as string[]).map(
        (address: string) => ({
          address,
          name: 'MetaMask Account',
          source: WalletType.METAMASK,
          type: ChainType.EVM,
        })
      )

      const connectedWallet: ConnectedWallet = {
        type: WalletType.METAMASK,
        name: 'MetaMask',
        version: provider.version || '1.0.0',
        accounts,
        isConnected: true,
        chainType: ChainType.EVM,
      }

      this.connectedWallets.set(WalletType.METAMASK, connectedWallet)
      return connectedWallet
    } catch (error) {
      console.error('Error connecting to MetaMask:', error)

      // Handle user rejection
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as { code: number; message: string }
        if (err.code === 4001) {
          throw new Error('Connection rejected by user')
        }
      }

      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to connect to MetaMask')
    }
  }

  /**
   * Get all connected wallets
   */
  getConnectedWallets(): ConnectedWallet[] {
    return Array.from(this.connectedWallets.values())
  }

  /**
   * Get connected wallet by type
   */
  getWallet(walletType: WalletType): ConnectedWallet | undefined {
    return this.connectedWallets.get(walletType)
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(walletType: WalletType): Promise<void> {
    this.connectedWallets.delete(walletType)
  }

  /**
   * Disconnect all wallets
   */
  async disconnectAll(): Promise<void> {
    this.connectedWallets.clear()
    this.enabledExtensions = []
  }

  /**
   * Subscribe to account changes (Substrate wallets)
   */
  static subscribeToAccounts(
    walletType: WalletType,
    callback: (accounts: WalletAccount[]) => void
  ): (() => void) | undefined {
    if (walletType === WalletType.METAMASK) {
      // MetaMask account change subscription
      const handleAccountsChanged = (accounts: unknown) => {
        const accountAddresses = accounts as string[]
        callback(
          accountAddresses.map(address => ({
            address,
            name: 'MetaMask Account',
            source: WalletType.METAMASK,
            type: ChainType.EVM,
          }))
        )
      }

      window.ethereum?.on('accountsChanged', handleAccountsChanged)
      return () => {
        window.ethereum?.removeListener(
          'accountsChanged',
          handleAccountsChanged
        )
      }
    }

    // Substrate wallets - would need to implement polling or extension-specific subscriptions
    return undefined
  }
}

// Extend Window interface for MetaMask and other EVM wallets
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      isTalisman?: boolean
      isSubWallet?: boolean
      request: (args: {
        method: string
        params?: unknown[]
      }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void
      ) => void
      version?: string
      providers?: Array<{
        isMetaMask?: boolean
        isTalisman?: boolean
        isSubWallet?: boolean
        request: (args: {
          method: string
          params?: unknown[]
        }) => Promise<unknown>
        on: (event: string, handler: (...args: unknown[]) => void) => void
        removeListener: (
          event: string,
          handler: (...args: unknown[]) => void
        ) => void
        version?: string
      }>
    }
  }
}

export const walletService = new WalletService()
