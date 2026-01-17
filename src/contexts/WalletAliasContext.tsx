/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { indexedDBService } from '../services/database/indexedDBService'

interface WalletAliasContextType {
  aliases: Record<string, string> // address -> alias
  isLoading: boolean
  setAlias: (address: string, alias: string) => Promise<void>
  removeAlias: (address: string) => Promise<void>
  getAlias: (address: string) => string | null
  formatWalletDisplay: (address: string, fallbackName?: string) => string
}

const WalletAliasContext = createContext<WalletAliasContextType | undefined>(
  undefined
)

export const WalletAliasProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [aliases, setAliases] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load aliases from IndexedDB on mount
  useEffect(() => {
    const loadAliases = async () => {
      try {
        await indexedDBService.init()
        const savedAliases = await indexedDBService.getAllWalletAliases()
        setAliases(savedAliases)
      } catch (err) {
        console.error('Failed to load wallet aliases:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadAliases()
  }, [])

  // Set or update an alias
  const setAlias = useCallback(async (address: string, alias: string) => {
    const normalizedAddress = address.toLowerCase()

    // Update IndexedDB
    await indexedDBService.saveWalletAlias(address, alias)

    // Update local state
    setAliases(prev => ({
      ...prev,
      [normalizedAddress]: alias,
    }))
  }, [])

  // Remove an alias
  const removeAlias = useCallback(async (address: string) => {
    const normalizedAddress = address.toLowerCase()

    // Remove from IndexedDB
    await indexedDBService.deleteWalletAlias(address)

    // Update local state
    setAliases(prev => {
      const next = { ...prev }
      delete next[normalizedAddress]
      return next
    })
  }, [])

  // Get alias for an address (returns null if no alias set)
  const getAlias = useCallback(
    (address: string): string | null => {
      return aliases[address.toLowerCase()] || null
    },
    [aliases]
  )

  // Format wallet display: "Alias (0x1234...5678)" or "Name (0x1234...5678)"
  const formatWalletDisplay = useCallback(
    (address: string, fallbackName?: string): string => {
      const alias = aliases[address.toLowerCase()]
      const displayName = alias || fallbackName || 'Unnamed'

      // Format address: first 6 chars + ... + last 4 chars
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

      return `${displayName} (${shortAddress})`
    },
    [aliases]
  )

  return (
    <WalletAliasContext.Provider
      value={{
        aliases,
        isLoading,
        setAlias,
        removeAlias,
        getAlias,
        formatWalletDisplay,
      }}
    >
      {children}
    </WalletAliasContext.Provider>
  )
}

export const useWalletAliases = () => {
  const context = useContext(WalletAliasContext)
  if (context === undefined) {
    throw new Error(
      'useWalletAliases must be used within a WalletAliasProvider'
    )
  }
  return context
}
