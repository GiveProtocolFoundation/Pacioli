/**
 * WalletConnect v2 Service
 * Enables mobile wallet connections via QR code scanning
 */

import SignClient from '@walletconnect/sign-client'
import { WalletConnectModal } from '@walletconnect/modal'

// WalletConnect Project ID - register at https://cloud.walletconnect.com
// Set via environment variable or .env file
const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

// Supported chain namespaces
const NAMESPACES = {
  eip155: {
    methods: ['personal_sign', 'eth_signTypedData', 'eth_sendTransaction'],
    chains: [
      'eip155:1',      // Ethereum Mainnet
      'eip155:137',    // Polygon
      'eip155:42161',  // Arbitrum One
      'eip155:10',     // Optimism
      'eip155:8453',   // Base
      'eip155:1284',   // Moonbeam
      'eip155:1285',   // Moonriver
    ],
    events: ['accountsChanged', 'chainChanged'],
  },
  polkadot: {
    methods: ['polkadot_signMessage', 'polkadot_signTransaction'],
    chains: [
      'polkadot:91b171bb158e2d3848fa23a9f1c25182', // Polkadot
      'polkadot:b0a8d493285c2df73290dfb7e61f870f', // Kusama
    ],
    events: ['accountsChanged'],
  },
}

export interface WalletConnectAccount {
  address: string
  chain: string
  chainId: string
  namespace: 'eip155' | 'polkadot'
}

export interface WalletConnectSession {
  topic: string
  accounts: WalletConnectAccount[]
  peerMetadata?: {
    name: string
    description: string
    url: string
    icons: string[]
  }
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

type StateChangeCallback = (state: ConnectionState, error?: string) => void
type SessionCallback = (session: WalletConnectSession | null) => void

class WalletConnectService {
  private signClient: SignClient | null = null
  private modal: WalletConnectModal | null = null
  private currentSession: WalletConnectSession | null = null
  private stateCallbacks: Set<StateChangeCallback> = new Set()
  private sessionCallbacks: Set<SessionCallback> = new Set()
  private connectionState: ConnectionState = 'disconnected'

  /**
   * Check if WalletConnect is properly configured
   */
  isConfigured(): boolean {
    return Boolean(PROJECT_ID)
  }

  /**
   * Get the current connection state
   */
  getState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Get the current session
   */
  getSession(): WalletConnectSession | null {
    return this.currentSession
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback)
    return () => this.stateCallbacks.delete(callback)
  }

  /**
   * Subscribe to session changes
   */
  onSessionChange(callback: SessionCallback): () => void {
    this.sessionCallbacks.add(callback)
    return () => this.sessionCallbacks.delete(callback)
  }

  private notifyStateChange(state: ConnectionState, error?: string) {
    this.connectionState = state
    this.stateCallbacks.forEach(cb => cb(state, error))
  }

  private notifySessionChange(session: WalletConnectSession | null) {
    this.currentSession = session
    this.sessionCallbacks.forEach(cb => cb(session))
  }

  /**
   * Initialize WalletConnect SignClient
   */
  async initialize(): Promise<void> {
    if (!PROJECT_ID) {
      throw new Error('WalletConnect Project ID not configured. Set VITE_WALLETCONNECT_PROJECT_ID in your environment.')
    }

    if (this.signClient) {
      return // Already initialized
    }

    try {
      this.signClient = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: {
          name: 'Pacioli',
          description: 'Blockchain Accounting for the Digital Age',
          url: 'https://pacioli.app',
          icons: ['https://pacioli.app/logo.png'],
        },
      })

      this.modal = new WalletConnectModal({
        projectId: PROJECT_ID,
        chains: [
          ...NAMESPACES.eip155.chains,
          ...NAMESPACES.polkadot.chains,
        ],
      })

      // Set up event listeners
      this.setupEventListeners()

      // Check for existing sessions
      await this.restoreSession()
    } catch (error) {
      console.error('Failed to initialize WalletConnect:', error)
      throw error
    }
  }

  private setupEventListeners() {
    if (!this.signClient) return

    // Handle session events
    this.signClient.on('session_event', (event) => {
      console.log('WalletConnect session_event:', event)
    })

    this.signClient.on('session_update', ({ topic, params }) => {
      console.log('WalletConnect session_update:', topic, params)
      if (this.currentSession?.topic === topic) {
        // Update accounts if changed
        const accounts = this.parseAccounts(params.namespaces)
        this.notifySessionChange({
          ...this.currentSession,
          accounts,
        })
      }
    })

    this.signClient.on('session_delete', ({ topic }) => {
      console.log('WalletConnect session_delete:', topic)
      if (this.currentSession?.topic === topic) {
        this.notifySessionChange(null)
        this.notifyStateChange('disconnected')
      }
    })
  }

  private async restoreSession(): Promise<void> {
    if (!this.signClient) return

    const sessions = this.signClient.session.getAll()
    if (sessions.length > 0) {
      // Restore the most recent session
      const lastSession = sessions[sessions.length - 1]
      const accounts = this.parseAccounts(lastSession.namespaces)

      this.notifySessionChange({
        topic: lastSession.topic,
        accounts,
        peerMetadata: lastSession.peer.metadata,
      })
      this.notifyStateChange('connected')
    }
  }

  private parseAccounts(namespaces: Record<string, { accounts: string[] }>): WalletConnectAccount[] {
    const accounts: WalletConnectAccount[] = []

    for (const [namespace, data] of Object.entries(namespaces)) {
      for (const account of data.accounts || []) {
        // Format: namespace:chainId:address
        const parts = account.split(':')
        if (parts.length >= 3) {
          const chainId = parts[1]
          const address = parts.slice(2).join(':') // Handle addresses with colons

          accounts.push({
            address,
            chain: `${namespace}:${chainId}`,
            chainId,
            namespace: namespace as 'eip155' | 'polkadot',
          })
        }
      }
    }

    return accounts
  }

  /**
   * Connect to a mobile wallet via WalletConnect
   */
  async connect(): Promise<WalletConnectSession> {
    if (!this.signClient || !this.modal) {
      await this.initialize()
    }

    if (!this.signClient || !this.modal) {
      throw new Error('WalletConnect not initialized')
    }

    this.notifyStateChange('connecting')

    try {
      // Create connection request
      const { uri, approval } = await this.signClient.connect({
        requiredNamespaces: {
          eip155: {
            methods: NAMESPACES.eip155.methods,
            chains: NAMESPACES.eip155.chains,
            events: NAMESPACES.eip155.events,
          },
        },
        optionalNamespaces: {
          polkadot: {
            methods: NAMESPACES.polkadot.methods,
            chains: NAMESPACES.polkadot.chains,
            events: NAMESPACES.polkadot.events,
          },
        },
      })

      // Open modal with QR code
      if (uri) {
        await this.modal.openModal({ uri })
      }

      // Wait for user approval
      const session = await approval()

      // Close modal
      this.modal.closeModal()

      // Parse accounts from session
      const accounts = this.parseAccounts(session.namespaces)

      const wcSession: WalletConnectSession = {
        topic: session.topic,
        accounts,
        peerMetadata: session.peer.metadata,
      }

      this.notifySessionChange(wcSession)
      this.notifyStateChange('connected')

      return wcSession
    } catch (error) {
      this.modal?.closeModal()
      this.notifyStateChange('error', error instanceof Error ? error.message : 'Connection failed')
      throw error
    }
  }

  /**
   * Request a signature from the connected wallet
   */
  async signMessage(address: string, message: string): Promise<string> {
    if (!this.signClient || !this.currentSession) {
      throw new Error('No active WalletConnect session')
    }

    // Find the account to determine namespace
    const account = this.currentSession.accounts.find(
      a => a.address.toLowerCase() === address.toLowerCase()
    )

    if (!account) {
      throw new Error('Address not found in connected accounts')
    }

    try {
      if (account.namespace === 'eip155') {
        // EVM personal_sign
        const result = await this.signClient.request({
          topic: this.currentSession.topic,
          chainId: account.chain,
          request: {
            method: 'personal_sign',
            params: [message, address],
          },
        })
        return result as string
      } else if (account.namespace === 'polkadot') {
        // Polkadot sign message
        const result = await this.signClient.request({
          topic: this.currentSession.topic,
          chainId: account.chain,
          request: {
            method: 'polkadot_signMessage',
            params: {
              address,
              message,
            },
          },
        })
        return (result as { signature: string }).signature
      }

      throw new Error(`Unsupported namespace: ${account.namespace}`)
    } catch (error) {
      console.error('Sign message error:', error)
      throw error
    }
  }

  /**
   * Disconnect the current session
   */
  async disconnect(): Promise<void> {
    if (!this.signClient || !this.currentSession) {
      return
    }

    try {
      await this.signClient.disconnect({
        topic: this.currentSession.topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      })
    } catch (error) {
      console.error('Disconnect error:', error)
    }

    this.notifySessionChange(null)
    this.notifyStateChange('disconnected')
  }

  /**
   * Get chain display name from chain ID
   */
  getChainName(chain: string): string {
    const chainNames: Record<string, string> = {
      'eip155:1': 'Ethereum',
      'eip155:137': 'Polygon',
      'eip155:42161': 'Arbitrum',
      'eip155:10': 'Optimism',
      'eip155:8453': 'Base',
      'eip155:1284': 'Moonbeam',
      'eip155:1285': 'Moonriver',
      'polkadot:91b171bb158e2d3848fa23a9f1c25182': 'Polkadot',
      'polkadot:b0a8d493285c2df73290dfb7e61f870f': 'Kusama',
    }
    return chainNames[chain] || chain
  }
}

// Export singleton instance
export const walletConnectService = new WalletConnectService()
