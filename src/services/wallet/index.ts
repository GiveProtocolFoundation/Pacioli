// Wallet Services - Types
export type {
  WalletAccount,
  ConnectedWallet,
  WalletConnectionStatus,
  NetworkConfig,
  TransactionBase,
  SubstrateTransaction,
  EVMTransaction,
  Transaction,
  WalletProviderInterface,
  BlockchainType,
  ConnectionMethod,
  StoredWallet,
  WalletVerificationRequest,
  WalletVerificationResult,
} from './types'

// Re-export enums as values
export { WalletType, ChainType, NetworkType } from './types'

// Address validation
export {
  validateAddress,
  isEVMChain,
  isSubstrateChain,
  getBlockchainDisplayName,
  getBlockchainCategory,
  getAddressPlaceholder,
  BLOCKCHAIN_GROUPS,
} from './addressValidation'

// Verification message
export {
  generateVerificationMessage,
  getSigningInstructions,
  getVerificationExplanation,
} from './verificationMessage'

// Wallet service
export { walletService } from './walletService'
