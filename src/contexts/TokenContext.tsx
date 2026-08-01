/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
} from 'react'
import { Chain, Token, TokenBalance, TokenPrice } from '../types/digitalAssets'
import {
  SEED_CHAINS,
  SEED_TOKENS,
  getTokenById,
  getTokensByChain,
  getChainById,
  searchTokens as searchTokensUtil,
} from '../data/tokenSeedData'

interface TokenContextType {
  chains: Chain[]
  tokens: Token[]
  tokenBalances: TokenBalance[]
  tokenPrices: Map<string, TokenPrice>
  getToken: (id: string) => Token | undefined
  getChain: (id: string) => Chain | undefined
  getTokensByChain: (chainId: string) => Token[]
  searchTokens: (query: string) => Token[]
  addCustomToken: (token: Token) => void
  updateTokenBalance: (balance: TokenBalance) => void
  updateTokenPrice: (price: TokenPrice) => void
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

/**
 * TokenProvider component that supplies token-related data and actions to its children via context.
 *
 * @param children - The ReactNode children that will receive the token context.
 * @returns A Context Provider wrapping the children.
 */
export const TokenProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [chains] = useState<Chain[]>(SEED_CHAINS)
  const [tokens, setTokens] = useState<Token[]>(SEED_TOKENS)
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [tokenPrices, setTokenPrices] = useState<Map<string, TokenPrice>>(
    new Map()
  )

  const getToken = useMemo(() => getTokenById, [])
  const getChain = useMemo(() => getChainById, [])
  const getTokensByChainFn = useMemo(() => getTokensByChain, [])
  const searchTokensFn = useMemo(() => searchTokensUtil, [])

  /**
   * Adds a custom token to the token list.
   *
   * @param token - The token to add.
   */
  const addCustomToken = (token: Token) => {
    setTokens(prev => [...prev, token])
  }

  /**
   * Updates the balance for a specific token and account.
   *
   * @param balance - The token balance object containing accountId, tokenId, and balance.
   */
  const updateTokenBalance = (balance: TokenBalance) => {
    setTokenBalances(prev => {
      const index = prev.findIndex(
        b => b.accountId === balance.accountId && b.tokenId === balance.tokenId
      )
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = balance
        return updated
      }
      return [...prev, balance]
    })
  }

  /**
   * Updates the price for a specific token.
   *
   * @param price - The token price object containing tokenId and price.
   */
  const updateTokenPrice = (price: TokenPrice) => {
    setTokenPrices(prev => {
      const updated = new Map(prev)
      updated.set(price.tokenId, price)
      return updated
    })
  }

  return (
    <TokenContext.Provider
      value={{
        chains,
        tokens,
        tokenBalances,
        tokenPrices,
        getToken,
        getChain,
        getTokensByChain: getTokensByChainFn,
        searchTokens: searchTokensFn,
        addCustomToken,
        updateTokenBalance,
        updateTokenPrice,
      }}
    >
      {children}
    </TokenContext.Provider>
  )
}

/**
 * Custom hook to access token context.
 *
 * @throws Will throw an error if used outside of TokenProvider.
 * @returns The TokenContextType containing chains, tokens, balances, prices and action functions.
 */
export const useTokens = () => {
  const context = useContext(TokenContext)
  if (context === undefined) {
    throw new Error('useTokens must be used within a TokenProvider')
  }
  return context
}
