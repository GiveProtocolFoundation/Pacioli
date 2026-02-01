import React, { useState, useCallback, useEffect } from 'react'
import {
  X,
  Plus,
  Wallet,
  QrCode,
  Settings,
  AlertCircle,
  HelpCircle,
  Shield,
  CheckCircle,
  Loader2,
  Smartphone,
  Link2,
  Unlink,
} from 'lucide-react'
import BlockchainSelector from './BlockchainSelector'
import {
  BlockchainType,
  validateAddress,
  getAddressPlaceholder,
} from '../../services/wallet/addressValidation'
import { getVerificationExplanation } from '../../services/wallet/verificationMessage'
import {
  walletConnectService,
  type WalletConnectSession,
  type WalletConnectAccount,
} from '../../services/wallet/walletConnectService'

type TabType = 'add' | 'walletconnect' | 'manage'

interface WalletConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onWalletAdded?: (wallet: {
    address: string
    blockchain: string
    label?: string
    isVerified: boolean
    signature?: string
  }) => void
}

const WalletConnectionModal: React.FC<WalletConnectionModalProps> = ({
  isOpen,
  onClose,
  onWalletAdded,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('add')

  // Form state for manual entry
  const [selectedBlockchain, setSelectedBlockchain] = useState<BlockchainType | ''>('')
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // WalletConnect state
  const [wcState, setWcState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [wcSession, setWcSession] = useState<WalletConnectSession | null>(null)
  const [wcError, setWcError] = useState<string | null>(null)
  const [isWcConfigured, setIsWcConfigured] = useState(false)
  const [addedAccounts, setAddedAccounts] = useState<Set<string>>(new Set())

  // Check WalletConnect configuration on mount
  useEffect(() => {
    setIsWcConfigured(walletConnectService.isConfigured())

    // Subscribe to WalletConnect state changes
    const unsubState = walletConnectService.onStateChange((state, error) => {
      setWcState(state)
      setWcError(error || null)
    })

    const unsubSession = walletConnectService.onSessionChange((session) => {
      setWcSession(session)
    })

    // Check for existing session
    const existingSession = walletConnectService.getSession()
    if (existingSession) {
      setWcSession(existingSession)
      setWcState('connected')
    }

    return () => {
      unsubState()
      unsubSession()
    }
  }, [])

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedBlockchain('')
    setAddress('')
    setLabel('')
    setAddressError(null)
  }, [])

  // Handle address input change with validation
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAddress = e.target.value
      setAddress(newAddress)
      setAddressError(null)

      if (selectedBlockchain && newAddress.trim()) {
        const result = validateAddress(newAddress, selectedBlockchain)
        if (!result.isValid) {
          setAddressError(result.error || 'Invalid address')
        }
      }
    },
    [selectedBlockchain]
  )

  // Handle blockchain change
  const handleBlockchainChange = useCallback(
    (blockchain: BlockchainType) => {
      setSelectedBlockchain(blockchain)
      setAddressError(null)

      if (address.trim()) {
        const result = validateAddress(address, blockchain)
        if (!result.isValid) {
          setAddressError(result.error || 'Invalid address')
        }
      }
    },
    [address]
  )

  // Add wallet without verification
  const handleAddWithoutVerification = useCallback(() => {
    if (!selectedBlockchain || !address.trim()) return

    const result = validateAddress(address, selectedBlockchain)
    if (!result.isValid) {
      setAddressError(result.error || 'Invalid address')
      return
    }

    onWalletAdded?.({
      address: result.normalizedAddress,
      blockchain: selectedBlockchain,
      label: label.trim() || undefined,
      isVerified: false,
    })

    resetForm()
    onClose()
  }, [selectedBlockchain, address, label, onWalletAdded, resetForm, onClose])

  // WalletConnect: Connect
  const handleWalletConnectConnect = useCallback(async () => {
    setWcError(null)
    try {
      await walletConnectService.connect()
    } catch (error) {
      console.error('WalletConnect connection error:', error)
      setWcError(error instanceof Error ? error.message : 'Failed to connect')
    }
  }, [])

  // WalletConnect: Disconnect
  const handleWalletConnectDisconnect = useCallback(async () => {
    try {
      await walletConnectService.disconnect()
      setAddedAccounts(new Set())
    } catch (error) {
      console.error('WalletConnect disconnect error:', error)
    }
  }, [])

  // WalletConnect: Add account as tracked wallet
  const handleAddWcAccount = useCallback((account: WalletConnectAccount) => {
    // Map WalletConnect chain to blockchain type
    const chainToBlockchain: Record<string, BlockchainType> = {
      'eip155:1': 'ethereum',
      'eip155:137': 'polygon',
      'eip155:42161': 'arbitrum',
      'eip155:10': 'optimism',
      'eip155:8453': 'base',
      'eip155:1284': 'moonbeam',
      'eip155:1285': 'moonriver',
      'polkadot:91b171bb158e2d3848fa23a9f1c25182': 'polkadot',
      'polkadot:b0a8d493285c2df73290dfb7e61f870f': 'kusama',
    }

    const blockchain = chainToBlockchain[account.chain] || 'ethereum'
    const chainName = walletConnectService.getChainName(account.chain)

    onWalletAdded?.({
      address: account.address,
      blockchain,
      label: `${chainName} Wallet`,
      isVerified: true, // WalletConnect connection proves ownership
    })

    setAddedAccounts(prev => new Set([...prev, account.address]))
  }, [onWalletAdded])

  if (!isOpen) return null

  const isAddressValid = selectedBlockchain && address.trim() && !addressError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
          <div className="flex items-center">
            <Wallet className="w-5 h-5 mr-2 text-[#8b4e52]" />
            <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
              Add Wallet
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(201,169,97,0.15)]">
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'add'
                ? 'text-[#8b4e52] border-b-2 border-[#8b4e52] bg-[#8b4e52]/5'
                : 'text-[#696557] dark:text-[#b8b3ac] hover:text-[#1a1815] dark:hover:text-[#f5f3f0]'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Wallet
          </button>
          <button
            onClick={() => setActiveTab('walletconnect')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'walletconnect'
                ? 'text-[#8b4e52] border-b-2 border-[#8b4e52] bg-[#8b4e52]/5'
                : 'text-[#696557] dark:text-[#b8b3ac] hover:text-[#1a1815] dark:hover:text-[#f5f3f0]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            WalletConnect
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'manage'
                ? 'text-[#8b4e52] border-b-2 border-[#8b4e52] bg-[#8b4e52]/5'
                : 'text-[#696557] dark:text-[#b8b3ac] hover:text-[#1a1815] dark:hover:text-[#f5f3f0]'
            }`}
          >
            <Settings className="w-4 h-4" />
            Manage
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Add Wallet Tab */}
          {activeTab === 'add' && (
            <div className="space-y-5">
              {/* Blockchain Selector */}
              <BlockchainSelector
                value={selectedBlockchain}
                onChange={handleBlockchainChange}
              />

              {/* Address Input */}
              <div>
                <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={handleAddressChange}
                  placeholder={
                    selectedBlockchain
                      ? getAddressPlaceholder(selectedBlockchain)
                      : 'Select a blockchain first'
                  }
                  disabled={!selectedBlockchain}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] font-mono text-sm ${
                    addressError
                      ? 'border-[#9d6b6b]'
                      : 'border-[rgba(201,169,97,0.15)]'
                  } focus:outline-none focus:ring-2 focus:ring-[#c9a961] disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {addressError && (
                  <p className="mt-1.5 text-sm text-[#9d6b6b] flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {addressError}
                  </p>
                )}
              </div>

              {/* Label Input */}
              <div>
                <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g., Main Trading Wallet"
                  maxLength={50}
                  className="w-full px-4 py-2.5 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
              </div>

              {/* Verification Info for Desktop App */}
              {isAddressValid && (
                <div className="p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg border border-[rgba(201,169,97,0.15)]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0] flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-[#c9a961]" />
                      About Verification
                    </h4>
                    <button
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-xs text-[#8b4e52] hover:underline flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Why verify?
                    </button>
                  </div>

                  {showHelp && (
                    <div className="mb-3 p-3 bg-[#c9a961]/10 rounded-lg text-xs text-[#696557] dark:text-[#b8b3ac]">
                      <p className="mb-2">{getVerificationExplanation().description}</p>
                      <p className="text-[#7a9b6f]">
                        Signing does NOT grant access to your funds.
                      </p>
                    </div>
                  )}

                  <div className="text-center py-3">
                    <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-2">
                      Want to verify ownership?
                    </p>
                    <p className="text-xs text-[#c9a961]">
                      Use the WalletConnect tab to connect your mobile wallet and automatically verify.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddWithoutVerification}
                  disabled={!isAddressValid}
                  className="flex-1 px-4 py-2.5 border border-[rgba(201,169,97,0.15)] text-[#696557] dark:text-[#b8b3ac] rounded-lg font-medium hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Without Verification
                </button>
              </div>

              <p className="text-xs text-center text-[#a39d94]">
                Unverified wallets can still import transactions but won&apos;t have ownership proof.
              </p>
            </div>
          )}

          {/* WalletConnect Tab */}
          {activeTab === 'walletconnect' && (
            <div className="space-y-6">
              {!isWcConfigured ? (
                // Not configured
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 mx-auto text-[#c9a961] mb-4" />
                  <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                    Configuration Required
                  </h3>
                  <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4 max-w-md mx-auto">
                    WalletConnect requires a project ID to function.
                  </p>
                  <div className="p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg text-left max-w-md mx-auto">
                    <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mb-2">
                      1. Register at{' '}
                      <a
                        href="https://cloud.walletconnect.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8b4e52] hover:underline"
                      >
                        cloud.walletconnect.com
                      </a>
                    </p>
                    <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mb-2">
                      2. Create a new project and copy your Project ID
                    </p>
                    <p className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                      3. Set <code className="px-1 py-0.5 bg-[#1a1815]/10 dark:bg-white/10 rounded">VITE_WALLETCONNECT_PROJECT_ID</code> in your environment
                    </p>
                  </div>
                </div>
              ) : wcState === 'connected' && wcSession ? (
                // Connected
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-[#7a9b6f] mr-2" />
                      <span className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                        Connected to {wcSession.peerMetadata?.name || 'Wallet'}
                      </span>
                    </div>
                    <button
                      onClick={handleWalletConnectDisconnect}
                      className="text-xs text-[#9d6b6b] hover:text-[#8b4e52] flex items-center gap-1"
                    >
                      <Unlink className="w-3 h-3" />
                      Disconnect
                    </button>
                  </div>

                  {/* Connected Accounts */}
                  <div className="space-y-3">
                    <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
                      Select accounts to add to Pacioli:
                    </p>
                    {wcSession.accounts.map((account, index) => (
                      <div
                        key={`${account.chain}-${account.address}-${index}`}
                        className="p-3 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg border border-[rgba(201,169,97,0.15)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#8b4e52] mb-1">
                              {walletConnectService.getChainName(account.chain)}
                            </p>
                            <p className="text-sm font-mono text-[#1a1815] dark:text-[#f5f3f0] truncate">
                              {account.address}
                            </p>
                          </div>
                          {addedAccounts.has(account.address) ? (
                            <span className="ml-3 px-3 py-1.5 bg-[#7a9b6f]/10 text-[#7a9b6f] text-xs rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Added
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddWcAccount(account)}
                              className="ml-3 px-3 py-1.5 bg-[#8b4e52] text-white text-xs rounded-lg hover:bg-[#7a4248] flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-center text-[#7a9b6f]">
                    Wallets added via WalletConnect are automatically verified.
                  </p>
                </div>
              ) : (
                // Disconnected or connecting
                <div className="text-center py-8">
                  <Smartphone className="w-16 h-16 mx-auto text-[#8b4e52] mb-4" />
                  <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                    Connect Mobile Wallet
                  </h3>
                  <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-6 max-w-md mx-auto">
                    Scan a QR code with your mobile wallet to connect and verify ownership.
                  </p>

                  {wcError && (
                    <div className="mb-4 p-3 bg-[#9d6b6b]/10 rounded-lg">
                      <p className="text-sm text-[#9d6b6b] flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        {wcError}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleWalletConnectConnect}
                    disabled={wcState === 'connecting'}
                    className="px-6 py-3 bg-[#8b4e52] text-white rounded-lg font-medium hover:bg-[#7a4248] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {wcState === 'connecting' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-5 h-5" />
                        Connect Wallet
                      </>
                    )}
                  </button>

                  <div className="mt-6 p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg text-left">
                    <p className="text-xs font-medium text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                      Supported Wallets:
                    </p>
                    <p className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                      MetaMask, Rainbow, Trust Wallet, Coinbase Wallet, Nova Wallet, and many more WalletConnect-compatible wallets.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manage Wallets Tab */}
          {activeTab === 'manage' && (
            <div className="text-center py-8">
              <Settings className="w-16 h-16 mx-auto text-[#a39d94] mb-4" />
              <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                Manage Your Wallets
              </h3>
              <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
                View and manage your tracked wallets from the Wallet Manager page.
              </p>
              <p className="text-xs text-[#a39d94]">
                Close this modal to see your tracked wallets in the main panel.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WalletConnectionModal
