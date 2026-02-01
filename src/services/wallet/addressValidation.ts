import { decodeAddress, encodeAddress } from '@polkadot/util-crypto'
import { isAddress as isEthAddress, getAddress as checksumAddress } from 'ethers'
import { PublicKey } from '@solana/web3.js'
import * as bitcoin from 'bitcoinjs-lib'
import bs58 from 'bs58'
import type { BlockchainType } from './types'

// Re-export BlockchainType for convenience
export type { BlockchainType }

export interface ValidationResult {
  isValid: boolean
  normalizedAddress: string
  addressType?: string
  error?: string
}

// SS58 address prefixes for Substrate chains
const SS58_PREFIXES: Record<string, number> = {
  polkadot: 0,
  kusama: 2,
  moonbeam: 1284,
  moonriver: 1285,
  astar: 5,
  'asset-hub': 0, // Uses Polkadot prefix
}

// EVM chains share the same address format
const EVM_CHAINS: BlockchainType[] = [
  'ethereum',
  'arbitrum',
  'optimism',
  'base',
  'polygon',
  'moonbeam',
  'moonriver',
]

// Substrate chains (non-EVM)
const SUBSTRATE_CHAINS: BlockchainType[] = [
  'polkadot',
  'kusama',
  'astar',
  'asset-hub',
]

export function isEVMChain(blockchain: BlockchainType): boolean {
  return EVM_CHAINS.includes(blockchain)
}

export function isSubstrateChain(blockchain: BlockchainType): boolean {
  return SUBSTRATE_CHAINS.includes(blockchain)
}

/**
 * Validate a Substrate SS58 address
 */
function validateSubstrateAddress(
  address: string,
  blockchain: BlockchainType
): ValidationResult {
  try {
    // Decode the address to get the public key
    const publicKey = decodeAddress(address)

    // Get the expected prefix for this chain
    const expectedPrefix = SS58_PREFIXES[blockchain] ?? 42 // 42 is generic Substrate

    // Re-encode with the correct prefix to normalize
    const normalizedAddress = encodeAddress(publicKey, expectedPrefix)

    return {
      isValid: true,
      normalizedAddress,
      addressType: 'ss58',
    }
  } catch (error) {
    return {
      isValid: false,
      normalizedAddress: address,
      error:
        error instanceof Error
          ? error.message
          : 'Invalid Substrate address format',
    }
  }
}

/**
 * Validate an Ethereum/EVM address
 */
function validateEVMAddress(address: string): ValidationResult {
  try {
    // Check if it's a valid address format
    if (!isEthAddress(address)) {
      return {
        isValid: false,
        normalizedAddress: address,
        error: 'Invalid Ethereum address format',
      }
    }

    // Get checksummed address
    const normalizedAddress = checksumAddress(address)

    return {
      isValid: true,
      normalizedAddress,
      addressType: 'evm',
    }
  } catch (error) {
    return {
      isValid: false,
      normalizedAddress: address,
      error:
        error instanceof Error
          ? error.message
          : 'Invalid Ethereum address format',
    }
  }
}

/**
 * Validate a Bitcoin address
 */
function validateBitcoinAddress(address: string): ValidationResult {
  try {
    let addressType: string

    // Try to decode as different address types
    if (address.startsWith('bc1p')) {
      // Taproot (Bech32m)
      bitcoin.address.fromBech32(address)
      addressType = 'bech32m (Taproot)'
    } else if (address.startsWith('bc1')) {
      // Native SegWit (Bech32)
      bitcoin.address.fromBech32(address)
      addressType = 'bech32 (SegWit)'
    } else if (address.startsWith('3')) {
      // P2SH (Script Hash)
      bitcoin.address.fromBase58Check(address)
      addressType = 'p2sh (Script Hash)'
    } else if (address.startsWith('1')) {
      // P2PKH (Legacy)
      bitcoin.address.fromBase58Check(address)
      addressType = 'p2pkh (Legacy)'
    } else {
      return {
        isValid: false,
        normalizedAddress: address,
        error:
          'Invalid Bitcoin address prefix. Expected: 1 (legacy), 3 (script), bc1 (segwit), or bc1p (taproot)',
      }
    }

    return {
      isValid: true,
      normalizedAddress: address,
      addressType,
    }
  } catch (error) {
    return {
      isValid: false,
      normalizedAddress: address,
      error:
        error instanceof Error
          ? error.message
          : 'Invalid Bitcoin address format',
    }
  }
}

/**
 * Validate a Solana address
 */
function validateSolanaAddress(address: string): ValidationResult {
  try {
    // Try to create a PublicKey from the address
    const publicKey = new PublicKey(address)

    // Verify it's on the ed25519 curve
    if (!PublicKey.isOnCurve(publicKey.toBytes())) {
      return {
        isValid: false,
        normalizedAddress: address,
        error: 'Address is not on the ed25519 curve',
      }
    }

    return {
      isValid: true,
      normalizedAddress: publicKey.toBase58(),
      addressType: 'ed25519',
    }
  } catch (error) {
    // Also try basic base58 validation
    try {
      const decoded = bs58.decode(address)
      if (decoded.length !== 32) {
        return {
          isValid: false,
          normalizedAddress: address,
          error: 'Invalid Solana address length (expected 32 bytes)',
        }
      }
    } catch {
      return {
        isValid: false,
        normalizedAddress: address,
        error: 'Invalid base58 encoding for Solana address',
      }
    }

    return {
      isValid: false,
      normalizedAddress: address,
      error:
        error instanceof Error
          ? error.message
          : 'Invalid Solana address format',
    }
  }
}

/**
 * Validate a wallet address for a specific blockchain
 */
export function validateAddress(
  address: string,
  blockchain: BlockchainType
): ValidationResult {
  // Trim whitespace
  const trimmedAddress = address.trim()

  if (!trimmedAddress) {
    return {
      isValid: false,
      normalizedAddress: '',
      error: 'Address cannot be empty',
    }
  }

  // Route to appropriate validator
  if (blockchain === 'bitcoin') {
    return validateBitcoinAddress(trimmedAddress)
  }

  if (blockchain === 'solana') {
    return validateSolanaAddress(trimmedAddress)
  }

  if (isEVMChain(blockchain)) {
    return validateEVMAddress(trimmedAddress)
  }

  if (isSubstrateChain(blockchain)) {
    return validateSubstrateAddress(trimmedAddress, blockchain)
  }

  return {
    isValid: false,
    normalizedAddress: trimmedAddress,
    error: `Unsupported blockchain: ${blockchain}`,
  }
}

/**
 * Get blockchain display name
 */
export function getBlockchainDisplayName(blockchain: BlockchainType): string {
  const names: Record<BlockchainType, string> = {
    polkadot: 'Polkadot',
    kusama: 'Kusama',
    moonbeam: 'Moonbeam',
    moonriver: 'Moonriver',
    astar: 'Astar',
    'asset-hub': 'Asset Hub',
    ethereum: 'Ethereum',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    base: 'Base',
    polygon: 'Polygon',
    bitcoin: 'Bitcoin',
    solana: 'Solana',
  }
  return names[blockchain] || blockchain
}

/**
 * Get blockchain category
 */
export function getBlockchainCategory(
  blockchain: BlockchainType
): 'substrate' | 'evm' | 'bitcoin' | 'solana' {
  if (isSubstrateChain(blockchain)) return 'substrate'
  if (isEVMChain(blockchain)) return 'evm'
  if (blockchain === 'bitcoin') return 'bitcoin'
  if (blockchain === 'solana') return 'solana'
  return 'evm' // Default fallback
}

/**
 * Group blockchains by category for UI display
 */
export const BLOCKCHAIN_GROUPS: Record<string, BlockchainType[]> = {
  'Substrate Chains': ['polkadot', 'kusama', 'astar', 'asset-hub'],
  'Ethereum & L2s': [
    'ethereum',
    'arbitrum',
    'optimism',
    'base',
    'polygon',
    'moonbeam',
    'moonriver',
  ],
  'Other Chains': ['bitcoin', 'solana'],
}

/**
 * Get address placeholder text for a blockchain
 */
export function getAddressPlaceholder(blockchain: BlockchainType): string {
  const placeholders: Record<BlockchainType, string> = {
    polkadot: '1...',
    kusama: 'C..., D..., or similar',
    moonbeam: '0x...',
    moonriver: '0x...',
    astar: '5..., a..., or similar',
    'asset-hub': '1...',
    ethereum: '0x...',
    arbitrum: '0x...',
    optimism: '0x...',
    base: '0x...',
    polygon: '0x...',
    bitcoin: '1..., 3..., bc1..., or bc1p...',
    solana: 'Base58 encoded address',
  }
  return placeholders[blockchain] || 'Enter address'
}
