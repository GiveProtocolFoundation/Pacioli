import { useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { getErrorCode } from '../types/errors'

export interface NetworkConfig {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls?: string[]
}

// Network configurations based on Polkadot guide
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  paseo: {
    chainId: '0x1911f0a6', // 420420422 in hex
    chainName: 'Polkadot Hub TestNet',
    nativeCurrency: {
      name: 'PAS',
      symbol: 'PAS',
      decimals: 18,
    },
    rpcUrls: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    blockExplorerUrls: [
      'https://blockscout-passet-hub.parity-testnet.parity.io',
    ],
  },
  moonbeam: {
    chainId: '0x504', // 1284 in hex
    chainName: 'Moonbeam',
    nativeCurrency: {
      name: 'Glimmer',
      symbol: 'GLMR',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.api.moonbeam.network'],
    blockExplorerUrls: ['https://moonbeam.moonscan.io'],
  },
  moonriver: {
    chainId: '0x505', // 1285 in hex
    chainName: 'Moonriver',
    nativeCurrency: {
      name: 'Moonriver',
      symbol: 'MOVR',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.api.moonriver.moonbeam.network'],
    blockExplorerUrls: ['https://moonriver.moonscan.io'],
  },
  astar: {
    chainId: '0x250', // 592 in hex
    chainName: 'Astar',
    nativeCurrency: {
      name: 'Astar',
      symbol: 'ASTR',
      decimals: 18,
    },
    rpcUrls: ['https://evm.astar.network'],
    blockExplorerUrls: ['https://blockscout.com/astar'],
  },
}

export const useNetworkConfig = () => {
  const [currentNetwork, setCurrentNetwork] = useState<string>('paseo')
  const [isConnected, setIsConnected] = useState(false)

  const switchNetwork = useCallback(async (networkName: string) => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed')
    }

    const config = NETWORK_CONFIGS[networkName]
    if (!config) {
      throw new Error(`Unknown network: ${networkName}`)
    }

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainId }],
      })
      setCurrentNetwork(networkName)
    } catch (switchError: unknown) {
      // This error code indicates that the chain has not been added to MetaMask
      if (getErrorCode(switchError) === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [config],
          })
          setCurrentNetwork(networkName)
        } catch (addError) {
          console.error('Failed to add network:', addError)
          throw addError
        }
      } else {
        console.error('Failed to switch network:', switchError)
        throw switchError
      }
    }
  }, [])

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed')
    }

    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (accounts.length > 0) {
        setIsConnected(true)
        return accounts[0]
      }

      return null
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      throw error
    }
  }, [])

  const getProvider = useCallback(
    (networkName?: string) => {
      const network = networkName || currentNetwork
      const config = NETWORK_CONFIGS[network]
      if (!config) {
        throw new Error(`Unknown network: ${network}`)
      }

      return new ethers.JsonRpcProvider(config.rpcUrls[0])
    },
    [currentNetwork]
  )

  return {
    networks: NETWORK_CONFIGS,
    currentNetwork,
    isConnected,
    switchNetwork,
    connectWallet,
    getProvider,
  }
}
