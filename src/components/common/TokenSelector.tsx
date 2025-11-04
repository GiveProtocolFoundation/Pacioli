import React, { useState, useMemo, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useTokens } from '../../contexts/TokenContext'
import { Token, Chain } from '../../types/digitalAssets'

interface TokenSelectorProps {
  selectedTokenId?: string
  selectedChainId?: string
  onTokenSelect: (token: Token, chain: Chain) => void
  label?: string
  required?: boolean
  error?: string
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedTokenId,
  selectedChainId,
  onTokenSelect,
  label = 'Token',
  required = false,
  error,
}) => {
  const { tokens, getToken, getChain, searchTokens } = useTokens()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedToken = selectedTokenId ? getToken(selectedTokenId) : undefined
  const selectedChain = selectedChainId ? getChain(selectedChainId) : undefined

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens.filter(t => t.isActive)
    return searchTokens(searchQuery)
  }, [searchQuery, tokens, searchTokens])

  const groupedTokens = useMemo(() => {
    const grouped: Record<string, Token[]> = {}
    filteredTokens.forEach(token => {
      if (!grouped[token.chainId]) {
        grouped[token.chainId] = []
      }
      grouped[token.chainId].push(token)
    })
    return grouped
  }, [filteredTokens])

  const handleTokenSelect = useCallback(
    (token: Token) => {
      const chain = getChain(token.chainId)
      if (chain) {
        onTokenSelect(token, chain)
        setIsOpen(false)
        setSearchQuery('')
      }
    },
    [getChain, onTokenSelect]
  )

  const handleClear = useCallback(() => {
    setSearchQuery('')
  }, [])

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 text-left border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
          error
            ? 'border-red-500'
            : 'border-gray-300 dark:border-gray-600'
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        {selectedToken && selectedChain ? (
          <div className="flex items-center">
            {selectedToken.iconUrl && (
              <img
                src={selectedToken.iconUrl}
                alt={selectedToken.symbol}
                className="w-5 h-5 mr-2 rounded-full"
                onError={e => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <span className="font-medium">{selectedToken.symbol}</span>
            <span className="mx-2 text-gray-400">-</span>
            <span className="text-gray-600 dark:text-gray-400">
              {selectedToken.name}
            </span>
            <span className="mx-2 text-gray-400">on</span>
            <span className="text-gray-600 dark:text-gray-400">
              {selectedChain.chainName}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">Select token...</span>
        )}
      </button>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tokens..."
                className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {Object.entries(groupedTokens).map(([chainId, chainTokens]) => {
              const chain = getChain(chainId)
              if (!chain) return null

              return (
                <div key={chainId}>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0">
                    {chain.chainName}
                  </div>
                  {chainTokens.map(token => (
                    <button
                      key={token.id}
                      onClick={() => handleTokenSelect(token)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        selectedTokenId === token.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <div className="flex items-center">
                        {token.iconUrl && (
                          <img
                            src={token.iconUrl}
                            alt={token.symbol}
                            className="w-6 h-6 mr-3 rounded-full"
                            onError={e => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {token.symbol}
                            </span>
                            {token.contractAddress && (
                              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                {token.tokenStandard}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })}

            {filteredTokens.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No tokens found
              </div>
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default TokenSelector
