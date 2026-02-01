import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import {
  BlockchainType,
  BLOCKCHAIN_GROUPS,
  getBlockchainDisplayName,
} from '../../services/wallet/addressValidation'

// Chain icons/colors for visual distinction
const CHAIN_COLORS: Record<BlockchainType, string> = {
  polkadot: '#E6007A',
  kusama: '#000000',
  moonbeam: '#53CBC8',
  moonriver: '#F2B705',
  astar: '#0070EB',
  'asset-hub': '#E6007A',
  ethereum: '#627EEA',
  arbitrum: '#28A0F0',
  optimism: '#FF0420',
  base: '#0052FF',
  polygon: '#8247E5',
  bitcoin: '#F7931A',
  solana: '#9945FF',
}

interface BlockchainSelectorProps {
  value: BlockchainType | ''
  onChange: (blockchain: BlockchainType) => void
  error?: string
  disabled?: boolean
}

const BlockchainSelector: React.FC<BlockchainSelectorProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Filter chains based on search query
  const filteredGroups = Object.entries(BLOCKCHAIN_GROUPS).reduce(
    (acc, [group, chains]) => {
      const filtered = chains.filter(chain =>
        getBlockchainDisplayName(chain)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
      if (filtered.length > 0) {
        acc[group] = filtered
      }
      return acc
    },
    {} as Record<string, BlockchainType[]>
  )

  const handleSelect = (blockchain: BlockchainType) => {
    onChange(blockchain)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchQuery('')
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
        Blockchain Network
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-left flex items-center justify-between ${
          error
            ? 'border-[#9d6b6b]'
            : 'border-[rgba(201,169,97,0.15)] focus:ring-2 focus:ring-[#c9a961]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#c9a961]'} focus:outline-none`}
      >
        <span className="flex items-center">
          {value ? (
            <>
              <span
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: CHAIN_COLORS[value] }}
              />
              <span className="text-[#1a1815] dark:text-[#f5f3f0]">
                {getBlockchainDisplayName(value)}
              </span>
            </>
          ) : (
            <span className="text-[#a39d94]">Select a blockchain network</span>
          )}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-[#a39d94] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {error && <p className="mt-1 text-sm text-[#9d6b6b]">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg shadow-lg max-h-80 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[rgba(201,169,97,0.15)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#a39d94]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search networks..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#0f0e0c] text-[#1a1815] dark:text-[#f5f3f0] placeholder-[#a39d94] focus:outline-none focus:ring-1 focus:ring-[#c9a961]"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {Object.entries(filteredGroups).map(([group, chains]) => (
              <div key={group}>
                <div className="px-4 py-2 text-xs font-semibold text-[#696557] dark:text-[#8b8580] bg-[#f3f1ed] dark:bg-[#0f0e0c] uppercase tracking-wider">
                  {group}
                </div>
                {chains.map(chain => (
                  <button
                    key={chain}
                    type="button"
                    onClick={() => handleSelect(chain)}
                    className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] ${
                      value === chain
                        ? 'bg-[#c9a961]/10 dark:bg-[#c9a961]/20'
                        : ''
                    }`}
                  >
                    <span className="flex items-center">
                      <span
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: CHAIN_COLORS[chain] }}
                      />
                      <span className="text-[#1a1815] dark:text-[#f5f3f0]">
                        {getBlockchainDisplayName(chain)}
                      </span>
                    </span>
                    {value === chain && (
                      <Check className="w-4 h-4 text-[#7a9b6f]" />
                    )}
                  </button>
                ))}
              </div>
            ))}

            {Object.keys(filteredGroups).length === 0 && (
              <div className="px-4 py-8 text-center text-[#a39d94]">
                No networks found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BlockchainSelector
