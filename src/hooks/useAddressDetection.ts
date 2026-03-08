/**
 * Hook for automatic entity detection from blockchain addresses
 * Used to identify known entities when viewing transactions
 */

import { useState, useCallback, useEffect } from 'react'
import { useEntity } from '../contexts/EntityContext'
import type { AddressMatch, Entity } from '../services/persistence'

interface UseAddressDetectionOptions {
  /**
   * Whether to automatically detect when addresses change
   */
  autoDetect?: boolean
}

interface AddressDetectionResult {
  /**
   * Map of address to detected match
   */
  matches: Map<string, AddressMatch>

  /**
   * Whether detection is in progress
   */
  isDetecting: boolean

  /**
   * Detect entities for a list of addresses
   */
  detectAddresses: (
    addresses: Array<{ address: string; chain: string }>
  ) => Promise<void>
  /**
   * Detect entity for a single address
   */
  detectAddress: (
    address: string,
    chain: string
  ) => Promise<AddressMatch | null>

  /**
   * Get match for a specific address
   */
  getMatch: (address: string, chain: string) => AddressMatch | undefined

  /**
   * Create an entity from a known address match
   */
  createFromKnown: (address: string, chain: string) => Promise<Entity>

  /**
   * Clear all detected matches
   */
  clearMatches: () => void
}

/**
 * Custom hook for detecting and matching blockchain addresses.
 * @param options - Configuration options for address detection.
 * @param options.autoDetect - Whether to automatically trigger detection.
 * @returns The address detection result including state and actions.
 */
export function useAddressDetection(
  options: UseAddressDetectionOptions = {}
): AddressDetectionResult {
  const { autoDetect = true } = options
  const { lookupAddress, batchLookupAddresses, createEntityFromKnown } =
    useEntity()

  const [matches, setMatches] = useState<Map<string, AddressMatch>>(new Map())
  const [isDetecting, setIsDetecting] = useState(false)
  const [pendingAddresses, setPendingAddresses] = useState<
    Array<{ address: string; chain: string }>
  >([])

  /**
   * Generate a unique key for address detection combining chain and address.
   * @param address - The address string.
   * @param chain - The blockchain chain identifier.
   * @returns A string key in the format 'chain:address'.
   */
  const makeKey = (address: string, chain: string) =>
    `${chain}:${address.toLowerCase()}`

  /**
   * Detect entity data for a single address.
   * @param address - The address to detect.
   * @param chain - The chain identifier for the address.
   * @returns A promise resolving to the address match or null if none.
   */
  const detectAddress = useCallback(
    async (address: string, chain: string): Promise<AddressMatch | null> => {
      const key = makeKey(address, chain)

      // Check if already detected
      if (matches.has(key)) {
        return matches.get(key) || null
      }

      try {
        const match = await lookupAddress(address, chain)
        if (match) {
          setMatches(prev => new Map(prev).set(key, match))
        }
        return match
      } catch {
        return null
      }
    },
    [lookupAddress, matches]
  )

  // Detect multiple addresses in batch
  const detectAddresses = useCallback(
    async (addresses: Array<{ address: string; chain: string }>) => {
      // Filter out already detected addresses
      const newAddresses = addresses.filter(
        ({ address, chain }) => !matches.has(makeKey(address, chain))
      )

      if (newAddresses.length === 0) return

      setIsDetecting(true)
      try {
        const addressPairs: Array<[string, string]> = newAddresses.map(
          ({ address, chain }) => [address, chain]
        )
        const results = await batchLookupAddresses(addressPairs)

        setMatches(prev => {
          const newMap = new Map(prev)
          for (const match of results) {
            const key = makeKey(match.address, match.chain)
            newMap.set(key, match)
          }
          return newMap
        })
      } finally {
        setIsDetecting(false)
      }
    },
    [batchLookupAddresses, matches]
  )

  // Get match for a specific address
  const getMatch = useCallback(
    (address: string, chain: string): AddressMatch | undefined => {
      return matches.get(makeKey(address, chain))
    },
    [matches]
  )

  // Create entity from known address
  const createFromKnown = useCallback(
    async (address: string, chain: string): Promise<Entity> => {
      const entity = await createEntityFromKnown(address, chain)

      // Update the match to reflect the new entity
      const key = makeKey(address, chain)
      setMatches(prev => {
        const newMap = new Map(prev)
        const existingMatch = newMap.get(key)
        if (existingMatch) {
          newMap.set(key, {
            ...existingMatch,
            match_type: 'entity',
            entity_id: entity.id,
          })
        }
        return newMap
      })

      return entity
    },
    [createEntityFromKnown]
  )

  // Clear all matches
  const clearMatches = useCallback(() => {
    setMatches(new Map())
  }, [])

  // Auto-detect when pending addresses change
  useEffect(() => {
    if (autoDetect && pendingAddresses.length > 0) {
      detectAddresses(pendingAddresses)
      setPendingAddresses([])
    }
  }, [autoDetect, pendingAddresses, detectAddresses])

  return {
    matches,
    isDetecting,
    detectAddresses,
    detectAddress,
    getMatch,
    createFromKnown,
    clearMatches,
  }
}

/**
 * Hook for detecting addresses in a list of transactions
 */
export function useTransactionAddressDetection(
  transactions: Array<{
    from_address?: string | null
    to_address?: string | null
    chain: string
  }>
) {
  const detection = useAddressDetection()
  const { detectAddresses } = detection

  // Extract unique addresses from transactions
  useEffect(() => {
    const addresses = new Set<string>()
    const addressList: Array<{ address: string; chain: string }> = []

    for (const tx of transactions) {
      if (tx.from_address) {
        const key = `${tx.chain}:${tx.from_address.toLowerCase()}`
        if (!addresses.has(key)) {
          addresses.add(key)
          addressList.push({ address: tx.from_address, chain: tx.chain })
        }
      }
      if (tx.to_address) {
        const key = `${tx.chain}:${tx.to_address.toLowerCase()}`
        if (!addresses.has(key)) {
          addresses.add(key)
          addressList.push({ address: tx.to_address, chain: tx.chain })
        }
      }
    }

    if (addressList.length > 0) {
      detectAddresses(addressList)
    }
  }, [transactions, detectAddresses])

  return detection
}

export default useAddressDetection
