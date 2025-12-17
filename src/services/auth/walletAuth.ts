/**
 * Wallet Authentication Service
 * Provides wallet-based authentication operations via Tauri commands
 *
 * Supports:
 * - Substrate wallets (Polkadot.js, SubWallet, Talisman, Nova)
 * - EVM wallets (MetaMask, WalletConnect)
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  AuthResponse,
  WalletChallenge,
  ChallengeRequest,
  VerifySignatureRequest,
  LinkWalletRequest,
  UserWallet,
  WalletType,
  WalletProvider,
  WalletAccount,
  WalletExtensionInfo,
} from '../../types/auth'

// =============================================================================
// WALLET EXTENSION TYPE DEFINITIONS
// =============================================================================

/**
 * Substrate wallet extension account from injectedWeb3
 */
interface InjectedAccount {
  address: string
  name?: string
  type?: string
}

/**
 * Substrate wallet extension signer
 */
interface InjectedSigner {
  signRaw: (payload: {
    address: string
    data: string
    type: string
  }) => Promise<{ signature: string }>
}

/**
 * Enabled Substrate wallet extension
 */
interface EnabledExtension {
  accounts: {
    get: () => Promise<InjectedAccount[]>
  }
  signer: InjectedSigner
}

/**
 * Substrate wallet extension (before enabling)
 */
interface InjectedExtension {
  enable: (appName: string) => Promise<EnabledExtension>
}

/**
 * Map of injected Substrate wallets
 */
interface InjectedWeb3 {
  'polkadot-js'?: InjectedExtension
  'subwallet-js'?: InjectedExtension
  talisman?: InjectedExtension
  'nova-wallet'?: InjectedExtension
  [key: string]: InjectedExtension | undefined
}

/**
 * EVM wallet provider (MetaMask-compatible)
 */
interface EthereumProvider {
  isMetaMask?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Window properties for wallet extensions
 */
interface WalletWindowProperties {
  injectedWeb3?: InjectedWeb3
  ethereum?: EthereumProvider
}

// =============================================================================
// WALLET EXTENSION DEFINITIONS
// =============================================================================

/**
 * Supported wallet extensions with their metadata
 */
export const WALLET_EXTENSIONS: WalletExtensionInfo[] = [
  // Substrate wallets
  {
    name: 'Polkadot.js',
    provider: 'polkadot-js',
    type: 'substrate',
    installed: false,
    logo: '/wallets/polkadotjs.svg',
    downloadUrl: 'https://polkadot.js.org/extension/',
  },
  {
    name: 'SubWallet',
    provider: 'subwallet',
    type: 'substrate',
    installed: false,
    logo: '/wallets/subwallet.svg',
    downloadUrl: 'https://subwallet.app/',
  },
  {
    name: 'Talisman',
    provider: 'talisman',
    type: 'substrate',
    installed: false,
    logo: '/wallets/talisman.svg',
    downloadUrl: 'https://talisman.xyz/',
  },
  {
    name: 'Nova Wallet',
    provider: 'nova',
    type: 'substrate',
    installed: false,
    logo: '/wallets/nova.svg',
    downloadUrl: 'https://novawallet.io/',
  },
  // EVM wallets
  {
    name: 'MetaMask',
    provider: 'metamask',
    type: 'evm',
    installed: false,
    logo: '/wallets/metamask.svg',
    downloadUrl: 'https://metamask.io/',
  },
  {
    name: 'WalletConnect',
    provider: 'walletconnect',
    type: 'evm',
    installed: false,
    logo: '/wallets/walletconnect.svg',
    downloadUrl: 'https://walletconnect.com/',
  },
]

// =============================================================================
// WALLET DETECTION
// =============================================================================

/**
 * Get the window object with wallet extension types
 */
function getWalletWindow(): WalletWindowProperties | undefined {
  return typeof window !== 'undefined'
    ? (window as unknown as WalletWindowProperties)
    : undefined
}

/**
 * Check if a wallet extension is installed
 */
export function isWalletInstalled(provider: WalletProvider): boolean {
  const walletWindow = getWalletWindow()
  if (!walletWindow) return false

  switch (provider) {
    case 'polkadot-js':
      return Boolean(walletWindow.injectedWeb3?.['polkadot-js'])
    case 'subwallet':
      return Boolean(walletWindow.injectedWeb3?.['subwallet-js'])
    case 'talisman':
      return Boolean(walletWindow.injectedWeb3?.['talisman'])
    case 'nova':
      return Boolean(walletWindow.injectedWeb3?.['nova-wallet'])
    case 'metamask':
      return Boolean(walletWindow.ethereum?.isMetaMask)
    case 'walletconnect':
      return true // WalletConnect is always "available" as a protocol
    default:
      return false
  }
}

/**
 * Get list of wallet extensions with installation status
 */
export function getWalletExtensions(): WalletExtensionInfo[] {
  return WALLET_EXTENSIONS.map(wallet => ({
    ...wallet,
    installed: isWalletInstalled(wallet.provider),
  }))
}

/**
 * Get wallet extensions by type
 */
export function getWalletExtensionsByType(
  type: WalletType
): WalletExtensionInfo[] {
  return getWalletExtensions().filter(w => w.type === type)
}

// =============================================================================
// SUBSTRATE WALLET INTERACTION
// =============================================================================

/**
 * Get accounts from a Substrate wallet extension
 */
export async function getSubstrateAccounts(
  provider: WalletProvider
): Promise<WalletAccount[]> {
  const walletWindow = getWalletWindow()
  const injectedWeb3 = walletWindow?.injectedWeb3

  let extension: InjectedExtension | undefined
  switch (provider) {
    case 'polkadot-js':
      extension = injectedWeb3?.['polkadot-js']
      break
    case 'subwallet':
      extension = injectedWeb3?.['subwallet-js']
      break
    case 'talisman':
      extension = injectedWeb3?.['talisman']
      break
    case 'nova':
      extension = injectedWeb3?.['nova-wallet']
      break
    default:
      throw new Error(`Unsupported Substrate wallet provider: ${provider}`)
  }

  if (!extension) {
    throw new Error(`${provider} extension not found`)
  }

  // Enable the extension for our app
  const enabledExtension = await extension.enable('Pacioli')

  // Get accounts
  const accounts = await enabledExtension.accounts.get()

  return accounts.map((account: InjectedAccount) => ({
    address: account.address,
    name: account.name || 'Unknown Account',
    source: provider,
    type: 'substrate' as WalletType,
  }))
}

/**
 * Sign a message with a Substrate wallet
 */
export async function signSubstrateMessage(
  provider: WalletProvider,
  address: string,
  message: string
): Promise<string> {
  const walletWindow = getWalletWindow()
  const injectedWeb3 = walletWindow?.injectedWeb3

  let extension: InjectedExtension | undefined
  switch (provider) {
    case 'polkadot-js':
      extension = injectedWeb3?.['polkadot-js']
      break
    case 'subwallet':
      extension = injectedWeb3?.['subwallet-js']
      break
    case 'talisman':
      extension = injectedWeb3?.['talisman']
      break
    case 'nova':
      extension = injectedWeb3?.['nova-wallet']
      break
    default:
      throw new Error(`Unsupported Substrate wallet provider: ${provider}`)
  }

  if (!extension) {
    throw new Error(`${provider} extension not found`)
  }

  const enabledExtension = await extension.enable('Pacioli')

  // Sign the message using the signer
  const { signature } = await enabledExtension.signer.signRaw({
    address,
    data: message,
    type: 'bytes',
  })

  return signature
}

// =============================================================================
// EVM WALLET INTERACTION
// =============================================================================

/**
 * Get accounts from MetaMask
 */
export async function getMetaMaskAccounts(): Promise<WalletAccount[]> {
  const walletWindow = getWalletWindow()
  const ethereum = walletWindow?.ethereum

  if (!ethereum?.isMetaMask) {
    throw new Error('MetaMask not found')
  }

  // Request account access
  const accounts = (await ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]

  return accounts.map((address: string) => ({
    address,
    name: `MetaMask Account`,
    source: 'metamask' as WalletProvider,
    type: 'evm' as WalletType,
  }))
}

/**
 * Sign a message with MetaMask (EIP-191 personal_sign)
 */
export async function signMetaMaskMessage(
  address: string,
  message: string
): Promise<string> {
  const walletWindow = getWalletWindow()
  const ethereum = walletWindow?.ethereum

  if (!ethereum?.isMetaMask) {
    throw new Error('MetaMask not found')
  }

  // Use personal_sign for EIP-191 signed message
  const signature = (await ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  })) as string

  return signature
}

// =============================================================================
// UNIFIED WALLET FUNCTIONS
// =============================================================================

/**
 * Get accounts from any supported wallet
 */
export async function getWalletAccounts(
  provider: WalletProvider
): Promise<WalletAccount[]> {
  switch (provider) {
    case 'polkadot-js':
    case 'subwallet':
    case 'talisman':
    case 'nova':
      return getSubstrateAccounts(provider)
    case 'metamask':
      return getMetaMaskAccounts()
    case 'walletconnect':
      // WalletConnect requires separate setup
      throw new Error('WalletConnect requires initialization first')
    default:
      throw new Error(`Unsupported wallet provider: ${provider}`)
  }
}

/**
 * Sign a message with any supported wallet
 */
export async function signMessage(
  provider: WalletProvider,
  address: string,
  message: string
): Promise<string> {
  switch (provider) {
    case 'polkadot-js':
    case 'subwallet':
    case 'talisman':
    case 'nova':
      return signSubstrateMessage(provider, address, message)
    case 'metamask':
      return signMetaMaskMessage(address, message)
    case 'walletconnect':
      throw new Error('WalletConnect signing requires separate implementation')
    default:
      throw new Error(`Unsupported wallet provider: ${provider}`)
  }
}

// =============================================================================
// TAURI BACKEND SERVICE
// =============================================================================

/**
 * Wallet authentication service for Tauri backend interaction
 */
export const walletAuthService = {
  /**
   * Generate a challenge for wallet sign-in
   */
  async generateChallenge(request: ChallengeRequest): Promise<WalletChallenge> {
    return invoke<WalletChallenge>('generate_wallet_challenge', { request })
  },

  /**
   * Verify wallet signature and authenticate
   * Returns auth tokens if successful
   */
  async verifySignature(
    request: VerifySignatureRequest
  ): Promise<AuthResponse> {
    const response = await invoke<AuthResponse>('verify_wallet_signature', {
      request,
    })

    // Store tokens
    localStorage.setItem('pacioli_access_token', response.access_token)
    localStorage.setItem('pacioli_refresh_token', response.refresh_token)

    return response
  },

  /**
   * Link a wallet to an existing authenticated account
   */
  async linkWallet(request: LinkWalletRequest): Promise<UserWallet> {
    return invoke<UserWallet>('link_wallet_to_account', { request })
  },

  /**
   * Get all wallets linked to the current user
   */
  async getUserWallets(token: string): Promise<UserWallet[]> {
    return invoke<UserWallet[]>('get_user_wallets', { token })
  },

  /**
   * Unlink a wallet from the current user
   */
  async unlinkWallet(token: string, walletId: string): Promise<void> {
    return invoke('unlink_wallet', { token, walletId })
  },

  /**
   * Clean up expired challenges (maintenance)
   */
  async cleanupExpiredChallenges(): Promise<number> {
    return invoke<number>('cleanup_expired_challenges')
  },
}

// =============================================================================
// HIGH-LEVEL WALLET AUTH FLOW
// =============================================================================

/**
 * Complete wallet sign-in flow
 *
 * 1. Generate challenge from backend
 * 2. Sign challenge with wallet extension
 * 3. Verify signature with backend
 * 4. Return auth tokens
 */
export async function walletSignIn(
  provider: WalletProvider,
  account: WalletAccount
): Promise<AuthResponse> {
  const walletType: WalletType = account.type

  // Step 1: Generate challenge
  const challenge = await walletAuthService.generateChallenge({
    wallet_address: account.address,
    wallet_type: walletType,
  })

  // Step 2: Sign the challenge message
  const signature = await signMessage(
    provider,
    account.address,
    challenge.message
  )

  // Step 3: Verify signature and get tokens
  const response = await walletAuthService.verifySignature({
    challenge_id: challenge.id,
    signature,
    wallet_address: account.address,
    wallet_name: account.name,
    wallet_source: provider,
  })

  return response
}

/**
 * Link a wallet to the current authenticated user
 *
 * 1. Generate challenge from backend
 * 2. Sign challenge with wallet extension
 * 3. Link wallet to account
 */
export async function linkWalletToAccount(
  provider: WalletProvider,
  account: WalletAccount,
  accessToken: string,
  chain?: string
): Promise<UserWallet> {
  const walletType: WalletType = account.type

  // Step 1: Generate challenge
  const challenge = await walletAuthService.generateChallenge({
    wallet_address: account.address,
    wallet_type: walletType,
  })

  // Step 2: Sign the challenge message
  const signature = await signMessage(
    provider,
    account.address,
    challenge.message
  )

  // Step 3: Link wallet to account
  const wallet = await walletAuthService.linkWallet({
    access_token: accessToken,
    challenge_id: challenge.id,
    signature,
    wallet_address: account.address,
    wallet_type: walletType,
    chain,
    wallet_name: account.name,
    wallet_source: provider,
  })

  return wallet
}

// Re-export types
export type {
  WalletChallenge,
  ChallengeRequest,
  VerifySignatureRequest,
  LinkWalletRequest,
  UserWallet,
  WalletType,
  WalletProvider,
  WalletAccount,
  WalletExtensionInfo,
}
