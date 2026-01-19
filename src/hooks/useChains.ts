/**
 * Chain Hooks
 *
 * React hooks for interacting with Pacioli's chain adapters.
 * Provides loading states, error handling, and data caching.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  ChainInfo,
  ChainTransaction,
  WalletBalances,
  WalletAddress,
} from '../types/chains'
import {
  getSupportedChains,
  fetchTransactions as apiFetchTransactions,
  fetchBalances as apiFetchBalances,
  fetchAllBalances as apiFetchAllBalances,
  validateAddress as apiValidateAddress,
} from '../api/chains'

/**
 * Hook state for async operations.
 */
interface AsyncState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook result with refetch capability.
 */
interface AsyncResult<T> extends AsyncState<T> {
  refetch: () => Promise<void>
}

/**
 * Parse error message from unknown error type.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

/**
 * Helper to trigger async data fetching within useEffect.
 * Explicitly ignores the Promise to satisfy linter rules.
 */
function triggerFetch(fetchFn: () => Promise<unknown>): undefined {
  fetchFn().catch(() => {
    // Error handling is done within fetchFn
  })
  return undefined
}

/**
 * Hook for fetching supported chains.
 *
 * Fetches the list of supported chains on mount and caches the result.
 *
 * @returns Chains list with loading and error states
 *
 * @example
 * ```tsx
 * const { chains, isLoading, error } = useChains()
 *
 * if (isLoading) return <Spinner />
 * if (error) return <Error message={error.message} />
 *
 * return (
 *   <Select>
 *     {chains?.map(chain => (
 *       <Option key={chain.chain_id} value={chain.chain_id}>
 *         {chain.name}
 *       </Option>
 *     ))}
 *   </Select>
 * )
 * ```
 */
export function useChains(): AsyncState<ChainInfo[]> & { chains: ChainInfo[] | null } {
  const [state, setState] = useState<AsyncState<ChainInfo[]>>({
    data: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    /** Fetches supported chains from the backend. */
    const fetchChains = async () => {
      try {
        const chains = await getSupportedChains()
        if (!cancelled) {
          setState({ data: chains, isLoading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            data: null,
            isLoading: false,
            error: new Error(getErrorMessage(err)),
          })
        }
      }
    }

    triggerFetch(fetchChains)

    return () => {
      cancelled = true
    }
  }, [])

  return {
    ...state,
    chains: state.data,
  }
}

/**
 * Hook for fetching transactions for an address on a chain.
 *
 * Automatically fetches when chainId or address changes.
 * Skips fetching if either parameter is empty.
 *
 * @param chainId - Chain identifier
 * @param address - Wallet address
 * @param fromBlock - Optional starting block number
 * @returns Transactions with loading, error states and refetch function
 *
 * @example
 * ```tsx
 * const { transactions, isLoading, error, refetch } = useTransactions('ethereum', address)
 *
 * if (isLoading) return <Spinner />
 * if (error) return <Error message={error.message} />
 *
 * return (
 *   <>
 *     <Button onClick={refetch}>Refresh</Button>
 *     <TransactionList transactions={transactions ?? []} />
 *   </>
 * )
 * ```
 */
export function useTransactions(
  chainId: string,
  address: string,
  fromBlock?: number
): AsyncResult<ChainTransaction[]> & { transactions: ChainTransaction[] | null } {
  const [state, setState] = useState<AsyncState<ChainTransaction[]>>({
    data: null,
    isLoading: false,
    error: null,
  })

  const fetchData = useCallback(async () => {
    if (!chainId || !address) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const transactions = await apiFetchTransactions(chainId, address, fromBlock)
      setState({ data: transactions, isLoading: false, error: null })
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: new Error(getErrorMessage(err)),
      })
    }
  }, [chainId, address, fromBlock])

  useEffect(() => {
    triggerFetch(fetchData)
  }, [fetchData])

  return {
    ...state,
    transactions: state.data,
    refetch: fetchData,
  }
}

/**
 * Hook for fetching balances for an address on a chain.
 *
 * Automatically fetches when chainId or address changes.
 * Skips fetching if either parameter is empty.
 *
 * @param chainId - Chain identifier
 * @param address - Wallet address
 * @returns Balances with loading, error states and refetch function
 *
 * @example
 * ```tsx
 * const { balances, isLoading, error, refetch } = useBalances('ethereum', address)
 *
 * if (isLoading) return <Spinner />
 * if (error) return <Error message={error.message} />
 *
 * return (
 *   <div>
 *     <p>Native: {balances?.native_balance.balance}</p>
 *     <p>Tokens: {balances?.token_balances.length}</p>
 *     <Button onClick={refetch}>Refresh</Button>
 *   </div>
 * )
 * ```
 */
export function useBalances(
  chainId: string,
  address: string
): AsyncResult<WalletBalances> & { balances: WalletBalances | null } {
  const [state, setState] = useState<AsyncState<WalletBalances>>({
    data: null,
    isLoading: false,
    error: null,
  })

  const fetchData = useCallback(async () => {
    if (!chainId || !address) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const balances = await apiFetchBalances(chainId, address)
      setState({ data: balances, isLoading: false, error: null })
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: new Error(getErrorMessage(err)),
      })
    }
  }, [chainId, address])

  useEffect(() => {
    triggerFetch(fetchData)
  }, [fetchData])

  return {
    ...state,
    balances: state.data,
    refetch: fetchData,
  }
}

/**
 * Hook for fetching balances across multiple chains/addresses.
 *
 * Fetches balances for all provided wallet addresses in a single batch request.
 * Automatically refetches when the wallets array changes (deep comparison).
 *
 * @param wallets - List of chain/address pairs
 * @returns List of balances with loading, error states and refetch function
 *
 * @example
 * ```tsx
 * const wallets = [
 *   { chainId: 'ethereum', address: '0x...' },
 *   { chainId: 'polygon', address: '0x...' },
 * ]
 *
 * const { balances, isLoading, error, refetch } = useMultiChainBalances(wallets)
 *
 * if (isLoading) return <Spinner />
 *
 * const totalUsd = balances?.reduce(
 *   (sum, b) => sum + (b.total_value_usd ?? 0),
 *   0
 * )
 * ```
 */
export function useMultiChainBalances(
  wallets: WalletAddress[]
): AsyncResult<WalletBalances[]> & { balances: WalletBalances[] | null } {
  const [state, setState] = useState<AsyncState<WalletBalances[]>>({
    data: null,
    isLoading: false,
    error: null,
  })

  // Use ref to track previous wallets for deep comparison
  const walletsRef = useRef<string>('')
  const walletsKey = JSON.stringify(wallets)

  const fetchData = useCallback(async () => {
    if (wallets.length === 0) {
      setState({ data: [], isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const balances = await apiFetchAllBalances(wallets)
      setState({ data: balances, isLoading: false, error: null })
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: new Error(getErrorMessage(err)),
      })
    }
  }, [wallets])

  useEffect(() => {
    // Only refetch if wallets actually changed
    if (walletsRef.current !== walletsKey) {
      walletsRef.current = walletsKey
      triggerFetch(fetchData)
    }
  }, [walletsKey, fetchData])

  return {
    ...state,
    balances: state.data,
    refetch: fetchData,
  }
}

/**
 * Hook for validating an address on a chain.
 *
 * Validates the address whenever chainId or address changes.
 * Returns null for validity while loading or if parameters are empty.
 *
 * @param chainId - Chain identifier
 * @param address - Address to validate
 * @returns Validation result with loading and error states
 *
 * @example
 * ```tsx
 * const { isValid, isLoading } = useAddressValidation('ethereum', inputAddress)
 *
 * return (
 *   <Input
 *     value={inputAddress}
 *     onChange={e => setInputAddress(e.target.value)}
 *     status={isLoading ? undefined : isValid ? 'success' : 'error'}
 *   />
 * )
 * ```
 */
export function useAddressValidation(
  chainId: string,
  address: string
): AsyncState<boolean> & { isValid: boolean | null } {
  const [state, setState] = useState<AsyncState<boolean>>({
    data: null,
    isLoading: false,
    error: null,
  })

  const fetchData = useCallback(async () => {
    if (!chainId || !address) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const isValid = await apiValidateAddress(chainId, address)
      setState({ data: isValid, isLoading: false, error: null })
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: new Error(getErrorMessage(err)),
      })
    }
  }, [chainId, address])

  useEffect(() => {
    triggerFetch(fetchData)
  }, [fetchData])

  return {
    ...state,
    isValid: state.data,
  }
}

/**
 * Hook for fetching transactions across multiple chains for a single address.
 *
 * @param address - Wallet address
 * @param chainIds - List of chain identifiers
 * @param fromBlock - Optional starting block number
 * @returns Combined transactions with loading, error states and refetch function
 *
 * @example
 * ```tsx
 * const chains = ['ethereum', 'polygon', 'arbitrum']
 * const { transactions, isLoading, refetch } = useMultiChainTransactions(address, chains)
 * ```
 */
export function useMultiChainTransactions(
  address: string,
  chainIds: string[],
  fromBlock?: number
): AsyncResult<ChainTransaction[]> & { transactions: ChainTransaction[] | null } {
  const [state, setState] = useState<AsyncState<ChainTransaction[]>>({
    data: null,
    isLoading: false,
    error: null,
  })

  const chainIdsKey = JSON.stringify(chainIds)
  const chainIdsRef = useRef<string>('')

  const fetchData = useCallback(async () => {
    if (!address || chainIds.length === 0) {
      setState({ data: [], isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const { fetchAllTransactions } = await import('../api/chains')
      const transactions = await fetchAllTransactions(address, chainIds, fromBlock)
      setState({ data: transactions, isLoading: false, error: null })
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: new Error(getErrorMessage(err)),
      })
    }
  }, [address, chainIds, fromBlock])

  useEffect(() => {
    if (chainIdsRef.current !== chainIdsKey || !chainIdsRef.current) {
      chainIdsRef.current = chainIdsKey
      triggerFetch(fetchData)
    }
  }, [address, chainIdsKey, fetchData])

  return {
    ...state,
    transactions: state.data,
    refetch: fetchData,
  }
}
