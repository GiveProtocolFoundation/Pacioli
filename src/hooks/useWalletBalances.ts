import { useMemo } from 'react'
import type { WalletAddress, WalletBalances } from '../types/chains'
import type { ConnectedWallet, WalletAccount } from '../services/wallet/types'
import { ChainType } from '../services/wallet/types'
import { StorageService, type TrackedWallet } from '../services/database/storageService'
import { useMultiChainBalances } from './useChains'

/** Well-known Substrate genesis hashes mapped to chain IDs */
const GENESIS_HASH_TO_CHAIN: Record<string, string> = {
  '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3': 'polkadot',
  '0xb0a8d493285c2df73290dfb7e61f870f17b41801197a149ca93654499ea3dafe': 'kusama',
  '0xfe58ea77779b7abda7da4ec526d14db9b1e9cd40a217c34892af80a9b332b76d': 'moonbeam',
  '0x401a1f9dca3da46f5c4091016c8a2f26dcea05865116b286f60f668207d1474b': 'moonriver',
  '0x9eb76c5184c4ab8679d2d5d819fdf90b9c001403e9e17da2e14b6d8aec4029c6': 'astar',
}

/** Map a connected wallet account to a chain ID */
function getChainIdForAccount(account: WalletAccount, wallet: ConnectedWallet): string {
  if (wallet.chainType === ChainType.EVM) {
    return 'moonbeam'
  }
  if (account.genesisHash && GENESIS_HASH_TO_CHAIN[account.genesisHash]) {
    return GENESIS_HASH_TO_CHAIN[account.genesisHash]
  }
  return 'polkadot'
}

/** Load all wallet addresses and metadata from storage (synchronous localStorage reads) */
function loadWalletData(): {
  addresses: WalletAddress[]
  meta: Map<string, { name: string; blockchain: string }>
} {
  const addresses: WalletAddress[] = []
  const meta = new Map<string, { name: string; blockchain: string }>()

  // Load tracked wallets
  const tracked: TrackedWallet[] = StorageService.loadTrackedWallets()
  for (const tw of tracked) {
    const key = `${tw.blockchain}:${tw.address}`
    if (!meta.has(key)) {
      addresses.push({ chainId: tw.blockchain, address: tw.address })
      meta.set(key, {
        name: tw.label || `${tw.blockchain} Wallet`,
        blockchain: tw.blockchain,
      })
    }
  }

  // Load connected wallets
  const connected: ConnectedWallet[] = StorageService.loadWallets()
  for (const cw of connected) {
    for (const account of cw.accounts) {
      const chainId = getChainIdForAccount(account, cw)
      const key = `${chainId}:${account.address}`
      if (!meta.has(key)) {
        addresses.push({ chainId, address: account.address })
        meta.set(key, {
          name: account.name || cw.name || `${chainId} Wallet`,
          blockchain: chainId,
        })
      }
    }
  }

  return { addresses, meta }
}

interface UseWalletBalancesResult {
  wallets: WalletAddress[]
  balances: WalletBalances[] | null
  walletMeta: Map<string, { name: string; blockchain: string }>
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/** Hook that aggregates tracked + connected wallets and fetches all balances */
export function useWalletBalances(): UseWalletBalancesResult {
  // Compute wallet data once on mount via lazy useMemo (localStorage is synchronous)
  const { addresses: walletAddresses, meta: walletMeta } = useMemo(() => loadWalletData(), [])

  const { balances, isLoading, error, refetch } = useMultiChainBalances(walletAddresses)

  return useMemo(() => ({
    wallets: walletAddresses,
    balances,
    walletMeta,
    isLoading,
    error,
    refetch,
  }), [walletAddresses, balances, walletMeta, isLoading, error, refetch])
}
