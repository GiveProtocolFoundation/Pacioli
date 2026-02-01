/**
 * Wallet Connection Types for Pacioli
 * Supports Substrate (Polkadot.js, Talisman, SubWallet) and EVM (MetaMask) wallets
 */

export enum WalletType {
  POLKADOT_JS = 'polkadot-js',
  TALISMAN = 'talisman',
  SUBWALLET = 'subwallet',
  METAMASK = 'metamask',
}

export enum ChainType {
  SUBSTRATE = 'substrate',
  EVM = 'evm',
}

export enum NetworkType {
  POLKADOT = 'polkadot',
  KUSAMA = 'kusama',
  MOONBEAM = 'moonbeam',
  MOONRIVER = 'moonriver',
  ASTAR = 'astar',
  ACALA = 'acala',
}

export interface WalletAccount {
  address: string
  name?: string
  source: WalletType
  type: ChainType
  genesisHash?: string
}

export interface ConnectedWallet {
  type: WalletType
  name: string
  version: string
  accounts: WalletAccount[]
  isConnected: boolean
  chainType: ChainType
}

export interface WalletConnectionStatus {
  isDetected: boolean
  isEnabled: boolean
  isConnected: boolean
  error?: string
}

export interface NetworkConfig {
  name: string
  type: NetworkType
  chainType: ChainType
  rpcEndpoint: string
  wsEndpoint: string
  ss58Format?: number // For Substrate chains
  chainId?: number // For EVM chains
  decimals: number
  symbol: string
}

export interface TransactionBase {
  id: string
  hash: string
  blockNumber: number
  timestamp: Date
  from: string
  to: string
  value: string
  fee: string
  status: 'success' | 'failed' | 'pending'
  network: NetworkType
}

export interface SubstrateTransaction extends TransactionBase {
  type: 'transfer' | 'staking' | 'xcm' | 'governance' | 'other'
  method: string
  section: string
  events: Array<{
    method: string
    section: string
    data: unknown
  }>
  isSigned: boolean
}

export interface EVMTransaction extends TransactionBase {
  type: 'transfer' | 'contract' | 'token_transfer'
  gasUsed: string
  gasPrice: string
  input?: string
  contractAddress?: string
  tokenSymbol?: string
  tokenDecimals?: number
}

export type Transaction = SubstrateTransaction | EVMTransaction

export interface WalletProviderInterface {
  detect(): Promise<boolean>
  enable(): Promise<void>
  getAccounts(): Promise<WalletAccount[]>
  disconnect(): Promise<void>
  subscribeAccounts(callback: (accounts: WalletAccount[]) => void): () => void
}

// Extended blockchain types for multi-chain support
export type BlockchainType =
  // Substrate chains
  | 'polkadot'
  | 'kusama'
  | 'moonbeam'
  | 'moonriver'
  | 'astar'
  | 'asset-hub'
  // Ethereum and EVM L2s
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'polygon'
  // Other chains
  | 'bitcoin'
  | 'solana'

export type ConnectionMethod = 'manual' | 'walletconnect' | 'extension'

export interface StoredWallet {
  id: string
  address: string
  blockchainType: BlockchainType
  label?: string
  connectionMethod: ConnectionMethod
  isVerified: boolean
  verificationSignature?: string
  verificationMessage?: string
  verificationTimestamp?: number
  createdAt: number
  updatedAt: number
}

export interface WalletVerificationRequest {
  address: string
  message: string
  signature: string
  blockchainType: BlockchainType
}

export interface WalletVerificationResult {
  isValid: boolean
  error?: string
  verifiedAt?: number
}
