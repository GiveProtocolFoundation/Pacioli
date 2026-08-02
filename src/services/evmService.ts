import { ethers } from 'ethers'
import { invoke } from '@tauri-apps/api/core'
import { getErrorCode } from '../types/errors'

export interface EVMChain {
  name: string
  chainId: number
  rpcUrl: string
  nativeToken: {
    symbol: string
    decimals: number
  }
  explorer: string
}

export const EVM_CHAINS: Record<string, EVMChain> = {
  moonbeam: {
    name: 'Moonbeam',
    chainId: 1284,
    rpcUrl: 'https://rpc.api.moonbeam.network',
    nativeToken: { symbol: 'GLMR', decimals: 18 },
    explorer: 'https://moonscan.io',
  },
  moonriver: {
    name: 'Moonriver',
    chainId: 1285,
    rpcUrl: 'https://rpc.api.moonriver.moonbeam.network',
    nativeToken: { symbol: 'MOVR', decimals: 18 },
    explorer: 'https://moonriver.moonscan.io',
  },
  astar: {
    name: 'Astar',
    chainId: 592,
    rpcUrl: 'https://evm.astar.network',
    nativeToken: { symbol: 'ASTR', decimals: 18 },
    explorer: 'https://blockscout.com/astar',
  },
  shiden: {
    name: 'Shiden',
    chainId: 336,
    rpcUrl: 'https://evm.shiden.astar.network',
    nativeToken: { symbol: 'SDN', decimals: 18 },
    explorer: 'https://blockscout.com/shiden',
  },
  acala: {
    name: 'Acala',
    chainId: 787,
    rpcUrl: 'https://eth-rpc-acala.aca-api.network',
    nativeToken: { symbol: 'ACA', decimals: 12 },
    explorer: 'https://blockscout.acala.network',
  },
  paseo: {
    name: 'Polkadot Hub TestNet',
    chainId: 420420422,
    rpcUrl: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
    nativeToken: { symbol: 'PAS', decimals: 18 },
    explorer: 'https://blockscout-passet-hub.parity-testnet.parity.io',
  },
}
/**
 * Service for interacting with EVM-compatible blockchain providers.
 * Manages JSON RPC providers for configured chains.
 */
export class EVMService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map()

  /**
   * Retrieves or initializes a JSON RPC provider for the specified chain.
   * @param chain - The key of the chain to get the provider for.
   * @returns The JsonRpcProvider instance for the specified chain.
   * @throws Error if the chain is unknown or provider cannot be found.
   */
  getProvider(chain: string): ethers.JsonRpcProvider {
    if (!this.providers.has(chain)) {
      const config = EVM_CHAINS[chain]
      if (!config) throw new Error(`Unknown chain: ${chain}`)

      const provider = new ethers.JsonRpcProvider(config.rpcUrl)
      this.providers.set(chain, provider)
    }
    const provider = this.providers.get(chain)
    if (!provider) {
      throw new Error(`Provider not found for chain: ${chain}`)
    }
    return provider
  }

  /**
   * Prompts MetaMask to connect and retrieves the user's address and network info.
   * @returns An object containing the user's address, the chain key, and chainId.
   * @throws Error if MetaMask is not installed or network is unsupported.
   */
  static async importFromMetaMask() {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    const network = await provider.getNetwork()

    // Convert chainId from bigint to number (ethers v6 returns bigint)
    const chainId = Number(network.chainId)

    // Find matching chain
    const chain = Object.entries(EVM_CHAINS).find(
      ([_, config]) => config.chainId === chainId
    )

    if (!chain) {
      throw new Error(`Unsupported network: ${chainId}`)
    }

    return {
      address,
      chain: chain[0],
      chainId,
    }
  }

  /**
   * Synchronize EVM transactions for the specified chain and wallet address.
   *
   * @param {string} chain - The EVM chain identifier.
   * @param {string} address - The wallet address to sync transactions for.
   * @returns {Promise<string>} A promise that resolves to a string identifier or status message.
   */
  static syncEVMTransactions(
    chain: string,
    address: string
  ): Promise<string> {
    return invoke<string>('sync_evm_transactions', { chain, address })
  }

  /**
   * Retrieves token balances for a given address on a specified EVM chain.
   *
   * @param chain - The identifier of the blockchain chain.
   * @param address - The wallet address to fetch token balances for.
   * @returns A promise that resolves to an array of [token, balance] tuples.
   */
  static async getTokenBalances(
    chain: string,
    address: string
  ): Promise<[string, string][]> {
    return invoke<[string, string][]>('get_evm_token_balances', {
      chain,
      address,
    })
  }

  /**
   * Scans DeFi positions on the specified chain for the given address.
   * @param chain The blockchain network identifier.
   * @param address The account address to scan for DeFi positions.
   * @returns A list of DeFi position identifiers found for the address.
   */
  static async scanDeFiPositions(
    chain: string,
    address: string
  ): Promise<string[]> {
    return invoke<string[]>('scan_defi_positions', { chain, address })
  }

  /**
   * Retrieves the EVM balance for a given blockchain network and address.
   * @param chain - The blockchain network identifier.
   * @param address - The wallet address to query.
   * @returns The balance as a string.
   */
  static async getBalance(chain: string, address: string): Promise<string> {
    return invoke<string>('get_evm_balance', { chain, address })
  }

  /**
   * Gets the list of transaction hashes for a given address on a specified chain within a block range.
   * @param chain The blockchain network identifier (e.g., "ethereum", "polygon").
   * @param address The address to retrieve transactions for.
   * @param fromBlock The starting block number (optional, defaults to 0).
   * @param toBlock The ending block number or 'latest' (optional, defaults to 'latest').
   * @returns An array of transaction hash strings.
   */
  static async getTransactions(
    chain: string,
    address: string,
    fromBlock?: number,
    toBlock?: number
  ): Promise<string[]> {
    return invoke<string[]>('get_evm_transactions', {
      chain,
      address,
      fromBlock: fromBlock || 0,
      toBlock: toBlock || 'latest',
    })
  }

  /**
   * Connects to the specified EVM chain via the backend service.
   * @param chain The identifier of the EVM chain to connect to.
   * @returns A Promise that resolves when the connection is established.
   */
  static async connectToChain(chain: string): Promise<void> {
    return invoke<void>('connect_evm_chain', { chain })
  }

  /**
   * Retrieves the configuration for a specified EVM chain.
   *
   * @param chain - The identifier of the EVM chain.
   * @returns The configuration object for the specified chain.
   */
  static async getChainInfo(chain: string) {
    const config = EVM_CHAINS[chain]
    if (!config) throw new Error(`Unknown chain: ${chain}`)
    return config
  }

  /**
   * Switches the Ethereum network in MetaMask to the specified chain ID.
   * @param chainId - The numeric ID of the chain to switch to.
   * @returns A promise that resolves when the network switch or network addition is complete.
   * @throws Error if MetaMask is not installed or the specified chain is unknown.
   */
  static async switchNetwork(chainId: number) {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    const hexChainId = `0x${chainId.toString(16)}`

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
    } catch (error: unknown) {
      // Network doesn't exist, try to add it
      if (getErrorCode(error) === 4902) {
        const chain = Object.values(EVM_CHAINS).find(c => c.chainId === chainId)
        if (chain) {
          await EVMService.addNetwork(chain)
        } else {
          throw new Error(`Unknown chain ID: ${chainId}`)
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Adds a new Ethereum network to MetaMask.
   *
   * @param chain - The EVMChain object containing the network's details.
   * @throws Error if MetaMask is not installed.
   * @returns A promise that resolves when the network has been added.
   */
  private static async addNetwork(chain: EVMChain) {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: `0x${chain.chainId.toString(16)}`,
          chainName: chain.name,
          nativeCurrency: {
            name: chain.nativeToken.symbol,
            symbol: chain.nativeToken.symbol,
            decimals: chain.nativeToken.decimals,
          },
          rpcUrls: [chain.rpcUrl],
          blockExplorerUrls: [chain.explorer],
        },
      ],
    })
  }
}
