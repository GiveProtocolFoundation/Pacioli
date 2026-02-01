import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  X,
  Eye,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Zap,
  Bitcoin,
  Wallet,
  Loader,
} from 'lucide-react'
import {
  BlockchainType,
  validateAddress,
} from '../../services/wallet/addressValidation'
import {
  isXpub as checkIsXpub,
  parseXpub,
  getXpubPrefixDescription,
  type XpubInfo,
} from '../../services/blockchain/bitcoinService'

/**
 * Portfolio ecosystem groups for simplified chain selection.
 * Follows "Batteries Included, Turbo Optional" pattern.
 */
type PortfolioEcosystem = 'polkadot' | 'ethereum' | 'bitcoin'

interface EcosystemOption {
  id: PortfolioEcosystem
  label: string
  description: string
  icon: React.ReactNode
  color: string
  defaultChain: BlockchainType
  inputLabel: string
  inputPlaceholder: string
}

const ECOSYSTEM_OPTIONS: EcosystemOption[] = [
  {
    id: 'polkadot',
    label: 'Polkadot Ecosystem',
    description: 'Polkadot, Kusama, Astar, Asset Hub',
    icon: <div className="w-5 h-5 rounded-full bg-[#E6007A]" />,
    color: '#E6007A',
    defaultChain: 'polkadot',
    inputLabel: 'Public Address',
    inputPlaceholder: '1... or 5... (SS58 format)',
  },
  {
    id: 'ethereum',
    label: 'Ethereum & L2s',
    description: 'Ethereum, Arbitrum, Base, Optimism, Polygon',
    icon: <div className="w-5 h-5 rounded-full bg-[#627EEA]" />,
    color: '#627EEA',
    defaultChain: 'ethereum',
    inputLabel: 'Public Address',
    inputPlaceholder: '0x...',
  },
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    description: 'Native Bitcoin addresses & xPub',
    icon: <Bitcoin className="w-5 h-5 text-[#F7931A]" />,
    color: '#F7931A',
    defaultChain: 'bitcoin',
    inputLabel: 'Public Address or xPub',
    inputPlaceholder: '1..., 3..., bc1..., or xpub...',
  },
]

/**
 * Available L2 chains for multi-chain tracking
 */
const L2_CHAINS: { id: BlockchainType; label: string; color: string }[] = [
  { id: 'arbitrum', label: 'Arbitrum', color: '#28A0F0' },
  { id: 'base', label: 'Base', color: '#0052FF' },
  { id: 'optimism', label: 'Optimism', color: '#FF0420' },
  { id: 'polygon', label: 'Polygon', color: '#8247E5' },
]

/**
 * Polkadot ecosystem chains
 */
const POLKADOT_CHAINS: { id: BlockchainType; label: string; color: string }[] =
  [
    { id: 'polkadot', label: 'Polkadot', color: '#E6007A' },
    { id: 'kusama', label: 'Kusama', color: '#000000' },
    { id: 'astar', label: 'Astar', color: '#0070EB' },
    { id: 'asset-hub', label: 'Asset Hub', color: '#E6007A' },
  ]

interface AddPortfolioModalProps {
  isOpen: boolean
  onClose: () => void
  onPortfolioAdded?: (portfolio: {
    address: string
    chains: BlockchainType[]
    label?: string
    isXpub?: boolean
  }) => void
}

/**
 * Modal for adding a new portfolio to track.
 *
 * Implements the "Batteries Included, Turbo Optional" pattern:
 * - No wallet connection required (read-only observer mode)
 * - Simple ecosystem-based chain selection
 * - Multi-chain tracking for EVM addresses
 * - xPub support for Bitcoin (future BDK integration)
 */
const AddPortfolioModal: React.FC<AddPortfolioModalProps> = ({
  isOpen,
  onClose,
  onPortfolioAdded,
}) => {
  // Form state
  const [selectedEcosystem, setSelectedEcosystem] =
    useState<PortfolioEcosystem | null>(null)
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Multi-chain selection for EVM
  const [selectedL2s, setSelectedL2s] = useState<Set<BlockchainType>>(
    new Set(['arbitrum', 'base', 'optimism'])
  )
  const [trackOnL2s, setTrackOnL2s] = useState(true)

  // Polkadot chain selection
  const [selectedPolkadotChains, setSelectedPolkadotChains] = useState<
    Set<BlockchainType>
  >(new Set(['polkadot']))

  // xPub validation state
  const [isXpub, setIsXpub] = useState(false)
  const [xpubInfo, setXpubInfo] = useState<XpubInfo | null>(null)
  const [isValidatingXpub, setIsValidatingXpub] = useState(false)

  // Get current ecosystem config
  const ecosystemConfig = useMemo(
    () => ECOSYSTEM_OPTIONS.find(e => e.id === selectedEcosystem),
    [selectedEcosystem]
  )

  // Quick check if address looks like xPub (for UI feedback)
  const looksLikeXpub = useMemo(() => {
    const prefixes = ['xpub', 'ypub', 'zpub', 'tpub', 'upub', 'vpub']
    return prefixes.some(prefix => address.startsWith(prefix))
  }, [address])

  // Validate xPub when input looks like one
  useEffect(() => {
    if (!looksLikeXpub || selectedEcosystem !== 'bitcoin') {
      setIsXpub(false)
      setXpubInfo(null)
      return
    }

    let cancelled = false
    setIsValidatingXpub(true)

    const validateXpub = async () => {
      try {
        // First quick check with the fast function
        const isValid = await checkIsXpub(address)
        if (cancelled) return

        if (isValid) {
          // Parse to get full info
          const info = await parseXpub(address)
          if (cancelled) return

          setIsXpub(true)
          setXpubInfo(info)
          setAddressError(null)
        } else {
          setIsXpub(false)
          setXpubInfo(null)
          if (address.length >= 4) {
            setAddressError('Invalid xPub format')
          }
        }
      } catch (error) {
        if (cancelled) return
        setIsXpub(false)
        setXpubInfo(null)
        setAddressError(
          error instanceof Error ? error.message : 'Invalid xPub format'
        )
      } finally {
        if (!cancelled) {
          setIsValidatingXpub(false)
        }
      }
    }

    // Debounce validation
    const timer = setTimeout(validateXpub, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [address, looksLikeXpub, selectedEcosystem])

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedEcosystem(null)
    setAddress('')
    setLabel('')
    setAddressError(null)
    setShowHelp(false)
    setSelectedL2s(new Set(['arbitrum', 'base', 'optimism']))
    setTrackOnL2s(true)
    setSelectedPolkadotChains(new Set(['polkadot']))
    setIsXpub(false)
    setXpubInfo(null)
    setIsValidatingXpub(false)
  }, [])

  // Handle close
  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  // Handle ecosystem selection
  const handleEcosystemSelect = useCallback(
    (ecosystem: PortfolioEcosystem) => {
      setSelectedEcosystem(ecosystem)
      setAddress('')
      setAddressError(null)
    },
    []
  )

  // Handle address input change with validation
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAddress = e.target.value
      setAddress(newAddress)
      setAddressError(null)

      if (!ecosystemConfig || !newAddress.trim()) return

      // Skip validation for xPub (handled by useEffect with backend validation)
      const xpubPrefixes = ['xpub', 'ypub', 'zpub', 'tpub', 'upub', 'vpub']
      if (
        selectedEcosystem === 'bitcoin' &&
        xpubPrefixes.some(prefix => newAddress.startsWith(prefix))
      ) {
        // xPub validation is handled by the useEffect hook
        return
      }

      // Validate regular address
      const result = validateAddress(newAddress, ecosystemConfig.defaultChain)
      if (!result.isValid) {
        setAddressError(result.error || 'Invalid address')
      }
    },
    [ecosystemConfig, selectedEcosystem]
  )

  // Toggle L2 chain selection
  const toggleL2Chain = useCallback((chain: BlockchainType) => {
    setSelectedL2s(prev => {
      const next = new Set(prev)
      if (next.has(chain)) {
        next.delete(chain)
      } else {
        next.add(chain)
      }
      return next
    })
  }, [])

  // Toggle Polkadot chain selection
  const togglePolkadotChain = useCallback((chain: BlockchainType) => {
    setSelectedPolkadotChains(prev => {
      const next = new Set(prev)
      if (next.has(chain)) {
        // Don't allow deselecting all chains
        if (next.size > 1) {
          next.delete(chain)
        }
      } else {
        next.add(chain)
      }
      return next
    })
  }, [])

  // Check if form is valid
  const isFormValid = useMemo(() => {
    if (!selectedEcosystem || !address.trim()) return false
    if (addressError) return false
    if (isValidatingXpub) return false

    // For xPub, require valid xPub info
    if (looksLikeXpub && selectedEcosystem === 'bitcoin') {
      return isXpub && xpubInfo !== null
    }

    return true
  }, [
    selectedEcosystem,
    address,
    addressError,
    isValidatingXpub,
    looksLikeXpub,
    isXpub,
    xpubInfo,
  ])

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!isFormValid || !ecosystemConfig) return

    // Build list of chains to track
    let chains: BlockchainType[] = []

    if (selectedEcosystem === 'ethereum') {
      chains = ['ethereum']
      if (trackOnL2s) {
        chains = [...chains, ...Array.from(selectedL2s)]
      }
    } else if (selectedEcosystem === 'polkadot') {
      chains = Array.from(selectedPolkadotChains)
    } else if (selectedEcosystem === 'bitcoin') {
      chains = ['bitcoin']
    }

    onPortfolioAdded?.({
      address: address.trim(),
      chains,
      label: label.trim() || undefined,
      isXpub,
    })

    handleClose()
  }, [
    isFormValid,
    ecosystemConfig,
    selectedEcosystem,
    trackOnL2s,
    selectedL2s,
    selectedPolkadotChains,
    address,
    label,
    isXpub,
    onPortfolioAdded,
    handleClose,
  ])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
          <div className="flex items-center">
            <Eye className="w-5 h-5 mr-2 text-[#8b4e52]" />
            <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
              Add Portfolio
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          <div className="space-y-6">
            {/* Observer Mode Banner */}
            <div className="p-3 bg-[#c9a961]/10 dark:bg-[#c9a961]/5 rounded-lg border border-[#c9a961]/20">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-[#c9a961] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                    Read-Only Mode
                  </p>
                  <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-0.5">
                    Pacioli observes blockchain data. No private keys or
                    wallet connections required.
                  </p>
                </div>
              </div>
            </div>

            {/* Ecosystem Selection */}
            <div>
              <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-3">
                Select Ecosystem
              </label>
              <div className="grid gap-3">
                {ECOSYSTEM_OPTIONS.map(ecosystem => (
                  <button
                    key={ecosystem.id}
                    type="button"
                    onClick={() => handleEcosystemSelect(ecosystem.id)}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      selectedEcosystem === ecosystem.id
                        ? 'border-[#8b4e52] bg-[#8b4e52]/5 dark:bg-[#8b4e52]/10'
                        : 'border-[rgba(201,169,97,0.15)] hover:border-[#c9a961] hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {ecosystem.icon}
                        <div>
                          <p className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                            {ecosystem.label}
                          </p>
                          <p className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                            {ecosystem.description}
                          </p>
                        </div>
                      </div>
                      {selectedEcosystem === ecosystem.id && (
                        <CheckCircle className="w-5 h-5 text-[#8b4e52]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Address Input - Only show when ecosystem is selected */}
            {ecosystemConfig && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]">
                      {ecosystemConfig.inputLabel}
                    </label>
                    {selectedEcosystem === 'bitcoin' && (
                      <button
                        onClick={() => setShowHelp(!showHelp)}
                        className="text-xs text-[#8b4e52] hover:underline flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3" />
                        What's xPub?
                      </button>
                    )}
                  </div>

                  {showHelp && selectedEcosystem === 'bitcoin' && (
                    <div className="mb-3 p-3 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg text-xs text-[#696557] dark:text-[#b8b3ac]">
                      <p className="mb-2">
                        <strong>xPub (Extended Public Key)</strong> allows
                        Pacioli to derive all addresses from your HD wallet
                        without needing private keys.
                      </p>
                      <p>
                        You can find it in your wallet's settings under
                        "Extended Public Key" or "Account xPub".
                      </p>
                    </div>
                  )}

                  <input
                    type="text"
                    value={address}
                    onChange={handleAddressChange}
                    placeholder={ecosystemConfig.inputPlaceholder}
                    className={`w-full px-4 py-2.5 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] font-mono text-sm ${
                      addressError
                        ? 'border-[#9d6b6b]'
                        : 'border-[rgba(201,169,97,0.15)]'
                    } focus:outline-none focus:ring-2 focus:ring-[#c9a961]`}
                  />
                  {addressError && (
                    <p className="mt-1.5 text-sm text-[#9d6b6b] flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {addressError}
                    </p>
                  )}
                  {isValidatingXpub && looksLikeXpub && (
                    <p className="mt-1.5 text-sm text-[#696557] flex items-center">
                      <Loader className="w-4 h-4 mr-1 animate-spin" />
                      Validating xPub...
                    </p>
                  )}
                  {isXpub && xpubInfo && !addressError && !isValidatingXpub && (
                    <div className="mt-1.5 text-sm text-[#7a9b6f]">
                      <p className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Valid {xpubInfo.is_testnet ? 'testnet ' : ''}xPub
                        detected
                      </p>
                      <p className="ml-5 text-xs text-[#696557] dark:text-[#b8b3ac]">
                        {getXpubPrefixDescription(address.slice(0, 4))}
                      </p>
                    </div>
                  )}
                </div>

                {/* EVM Multi-Chain Option */}
                {selectedEcosystem === 'ethereum' && address && !addressError && (
                  <div className="p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg border border-[rgba(201,169,97,0.15)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#c9a961]" />
                        <span className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                          Track on L2 Networks
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={trackOnL2s}
                          onChange={e => setTrackOnL2s(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[#a39d94] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#c9a961] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b4e52]" />
                      </label>
                    </div>

                    {trackOnL2s && (
                      <div className="grid grid-cols-2 gap-2">
                        {L2_CHAINS.map(chain => (
                          <label
                            key={chain.id}
                            className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-[#fafaf8] dark:hover:bg-[#0f0e0c]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedL2s.has(chain.id)}
                              onChange={() => toggleL2Chain(chain.id)}
                              className="w-4 h-4 text-[#8b4e52] border-[rgba(201,169,97,0.3)] rounded focus:ring-[#c9a961]"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: chain.color }}
                            />
                            <span className="text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                              {chain.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-[#696557] dark:text-[#b8b3ac]">
                      Same address works across all EVM chains. We'll fetch
                      transactions from each selected network.
                    </p>
                  </div>
                )}

                {/* Polkadot Chain Selection */}
                {selectedEcosystem === 'polkadot' &&
                  address &&
                  !addressError && (
                    <div className="p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg border border-[rgba(201,169,97,0.15)]">
                      <div className="flex items-center gap-2 mb-3">
                        <Wallet className="w-4 h-4 text-[#E6007A]" />
                        <span className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                          Track on Networks
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {POLKADOT_CHAINS.map(chain => (
                          <label
                            key={chain.id}
                            className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-[#fafaf8] dark:hover:bg-[#0f0e0c]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPolkadotChains.has(chain.id)}
                              onChange={() => togglePolkadotChain(chain.id)}
                              className="w-4 h-4 text-[#8b4e52] border-[rgba(201,169,97,0.3)] rounded focus:ring-[#c9a961]"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: chain.color }}
                            />
                            <span className="text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                              {chain.label}
                            </span>
                          </label>
                        ))}
                      </div>

                      <p className="mt-3 text-xs text-[#696557] dark:text-[#b8b3ac]">
                        SS58 addresses are automatically converted for each
                        network.
                      </p>
                    </div>
                  )}

                {/* Label Input */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
                    Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g., Main Portfolio, Cold Storage"
                    maxLength={50}
                    className="w-full px-4 py-2.5 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!isFormValid}
              className="w-full px-4 py-3 bg-[#8b4e52] text-white rounded-lg font-medium hover:bg-[#7a4248] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Add Portfolio
            </button>

            <p className="text-xs text-center text-[#a39d94]">
              Transaction history will be fetched automatically using public
              blockchain data.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddPortfolioModal
