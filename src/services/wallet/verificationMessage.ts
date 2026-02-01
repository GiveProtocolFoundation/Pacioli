import {
  BlockchainType,
  getBlockchainDisplayName,
  getBlockchainCategory,
} from './addressValidation'

export interface VerificationMessageData {
  message: string
  timestamp: string
  nonce: string
  expiresAt: Date
}

/**
 * Generate a random nonce for verification
 */
function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a verification message for wallet ownership proof
 */
export function generateVerificationMessage(
  address: string,
  blockchain: BlockchainType
): VerificationMessageData {
  const timestamp = new Date().toISOString()
  const nonce = generateNonce()
  const networkName = getBlockchainDisplayName(blockchain)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  const message = `Pacioli Wallet Verification

I verify ownership of this wallet address for read-only access to transaction history.

Address: ${address}
Network: ${networkName}
Timestamp: ${timestamp}
Nonce: ${nonce}

This signature grants no permissions to move funds or execute transactions.`

  return {
    message,
    timestamp,
    nonce,
    expiresAt,
  }
}

/**
 * Get signing instructions for a specific blockchain
 */
export function getSigningInstructions(blockchain: BlockchainType): {
  title: string
  steps: string[]
  wallets: { name: string; url?: string }[]
  notes?: string[]
} {
  const category = getBlockchainCategory(blockchain)

  switch (category) {
    case 'substrate':
      return {
        title: 'Sign with a Polkadot Wallet',
        steps: [
          'Copy the verification message above',
          'Open your Polkadot wallet extension (Polkadot.js, Talisman, or SubWallet)',
          'Go to Settings or the signing section',
          'Select "Sign Message" or "Sign Raw"',
          'Paste the verification message and sign',
          'Copy the resulting signature and paste it below',
        ],
        wallets: [
          {
            name: 'Polkadot.js Extension',
            url: 'https://polkadot.js.org/extension/',
          },
          { name: 'Talisman', url: 'https://talisman.xyz/' },
          { name: 'SubWallet', url: 'https://subwallet.app/' },
          { name: 'Nova Wallet (Mobile)', url: 'https://novawallet.io/' },
        ],
        notes: [
          'Make sure you select the correct account that matches the address above',
          'The signature will be a hex string starting with 0x',
        ],
      }

    case 'evm':
      return {
        title: 'Sign with an Ethereum Wallet',
        steps: [
          'Copy the verification message above',
          'Open your Ethereum wallet (MetaMask, Rainbow, etc.)',
          'Go to Settings > Sign Message, or use a signing tool',
          'Paste the verification message',
          'Sign the message with your wallet',
          'Copy the resulting signature and paste it below',
        ],
        wallets: [
          { name: 'MetaMask', url: 'https://metamask.io/' },
          { name: 'Rainbow', url: 'https://rainbow.me/' },
          { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet' },
          { name: 'Rabby', url: 'https://rabby.io/' },
        ],
        notes: [
          'MetaMask: You can use etherscan.io/verifiedSignatures to sign messages',
          'The signature will be a hex string starting with 0x',
          'The same address works across all EVM chains (Ethereum, Arbitrum, etc.)',
        ],
      }

    case 'bitcoin':
      return {
        title: 'Sign with a Bitcoin Wallet',
        steps: [
          'Copy the verification message above',
          'Open your Bitcoin wallet that supports message signing',
          'Find the "Sign Message" feature (usually in Tools or Settings)',
          'Select the address you want to verify',
          'Paste the verification message and sign',
          'Copy the resulting signature and paste it below',
        ],
        wallets: [
          { name: 'Sparrow Wallet', url: 'https://sparrowwallet.com/' },
          { name: 'Electrum', url: 'https://electrum.org/' },
          { name: 'Ledger (via Sparrow)', url: 'https://www.ledger.com/' },
        ],
        notes: [
          'Not all Bitcoin wallets support message signing',
          'Hardware wallets may require companion software',
          'The signature format varies by wallet (base64 or hex)',
        ],
      }

    case 'solana':
      return {
        title: 'Sign with a Solana Wallet',
        steps: [
          'Copy the verification message above',
          'Open your Solana wallet extension (Phantom, Solflare)',
          'Go to Settings or find the signing feature',
          'Paste the verification message and sign',
          'Copy the resulting signature and paste it below',
        ],
        wallets: [
          { name: 'Phantom', url: 'https://phantom.app/' },
          { name: 'Solflare', url: 'https://solflare.com/' },
          { name: 'Backpack', url: 'https://backpack.app/' },
        ],
        notes: [
          'Phantom: You may need to use a third-party signing tool',
          'The signature will be a base58-encoded string',
        ],
      }

    default:
      return {
        title: 'Sign Message',
        steps: [
          'Copy the verification message',
          'Sign it with your wallet',
          'Paste the signature below',
        ],
        wallets: [],
      }
  }
}

/**
 * Get a short description of why verification is needed
 */
export function getVerificationExplanation(): {
  title: string
  description: string
  benefits: string[]
  security: string[]
} {
  return {
    title: 'Why Verify Ownership?',
    description:
      'Verifying ownership proves that you control this wallet address. This helps ensure accurate accounting and prevents unauthorized access to your transaction history.',
    benefits: [
      'Proves you own the wallet for accurate record-keeping',
      'Enables automatic transaction import from verified wallets',
      'Provides audit trail for compliance purposes',
      'Distinguishes your wallets from watched addresses',
    ],
    security: [
      'Signing a message does NOT grant access to your funds',
      'This is a read-only verification - no transactions will be sent',
      'Your private keys never leave your wallet',
      'You can remove verified wallets at any time',
    ],
  }
}
