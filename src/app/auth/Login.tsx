/**
 * Login Page
 * Split-screen design with email/wallet authentication tabs
 */

import React, { useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Mail,
  Wallet,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getWalletExtensions,
  getWalletAccounts,
  walletSignIn,
} from '../../services/auth/walletAuth'
import type {
  WalletExtensionInfo,
  WalletAccount,
  WalletProvider,
} from '../../types/auth'
import PacioliLogo from '../../assets/Pacioli_logo_blue.png'

type AuthTab = 'email' | 'wallet'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, setAuthFromWallet, isLoading, error, clearError } = useAuth()

  // Auth tab state
  const [activeTab, setActiveTab] = useState<AuthTab>('email')

  // Email auth state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Wallet auth state
  const [walletExtensions] = useState<WalletExtensionInfo[]>(() =>
    getWalletExtensions()
  )
  const [selectedWallet, setSelectedWallet] =
    useState<WalletExtensionInfo | null>(null)
  const [walletAccounts, setWalletAccounts] = useState<WalletAccount[]>([])
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  const [localError, setLocalError] = useState<string | null>(null)

  // Get the redirect path from location state
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  // ==========================================================================
  // Email Auth Handlers
  // ==========================================================================

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value)
    },
    []
  )

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value)
    },
    []
  )

  const toggleShowPassword = useCallback(() => {
    setShowPassword(prev => !prev)
  }, [])

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLocalError(null)
      clearError()

      if (!email.trim()) {
        setLocalError('Email is required')
        return
      }
      if (!password) {
        setLocalError('Password is required')
        return
      }

      try {
        await login({ email: email.trim(), password })
        navigate(from, { replace: true })
      } catch {
        // Error is handled by AuthContext
      }
    },
    [email, password, login, navigate, from, clearError]
  )

  // ==========================================================================
  // Wallet Auth Handlers
  // ==========================================================================

  const handleWalletSelect = useCallback(
    async (wallet: WalletExtensionInfo) => {
      setWalletError(null)
      setSelectedWallet(wallet)
      setWalletAccounts([])

      if (!wallet.installed) {
        // Open download URL in new tab
        window.open(wallet.downloadUrl, '_blank')
        return
      }

      setLoadingWallet(true)
      try {
        const accounts = await getWalletAccounts(wallet.provider)
        setWalletAccounts(accounts)
      } catch (err) {
        setWalletError(
          err instanceof Error ? err.message : 'Failed to connect wallet'
        )
        setSelectedWallet(null)
      } finally {
        setLoadingWallet(false)
      }
    },
    []
  )

  const handleAccountSelect = useCallback(
    async (account: WalletAccount) => {
      if (!selectedWallet) return

      setWalletError(null)
      setLoadingWallet(true)

      try {
        const response = await walletSignIn(selectedWallet.provider, account)
        setAuthFromWallet(response)
        navigate(from, { replace: true })
      } catch (err) {
        if (err instanceof Error && err.message.includes('rejected')) {
          setWalletError('Signature request was rejected')
        } else {
          setWalletError(
            err instanceof Error ? err.message : 'Authentication failed'
          )
        }
      } finally {
        setLoadingWallet(false)
      }
    },
    [selectedWallet, setAuthFromWallet, navigate, from]
  )

  const handleBackToWallets = useCallback(() => {
    setSelectedWallet(null)
    setWalletAccounts([])
    setWalletError(null)
  }, [])

  const handleEmailTabClick = useCallback(() => {
    setActiveTab('email')
  }, [])

  const handleWalletTabClick = useCallback(() => {
    setActiveTab('wallet')
  }, [])

  // Pre-create wallet select handlers to avoid inline arrow functions
  const walletSelectHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    walletExtensions.forEach(wallet => {
      handlers[wallet.provider] = () => handleWalletSelect(wallet)
    })
    return handlers
  }, [walletExtensions, handleWalletSelect])

  // Pre-create account click handlers to avoid inline arrow functions
  const accountClickHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    walletAccounts.forEach(account => {
      handlers[account.address] = () => handleAccountSelect(account)
    })
    return handlers
  }, [walletAccounts, handleAccountSelect])

  const displayError = localError || error

  // Extracted Branding Panel to reduce JSX nesting depth
  const BrandingPanel = () => (
    <div
      className="hidden w-1/2 lg:flex lg:flex-col lg:justify-between lg:p-12"
      style={{ backgroundColor: '#283747' }}
    >
      <div className="flex items-center gap-3">
        <img src={PacioliLogo} alt="Pacioli" className="h-12 w-12" />
        <div>
          <h1 className="text-3xl font-bold text-white">Pacioli</h1>
          <p className="text-slate-400">Crypto Accounting Platform</p>
        </div>
      </div>

      <div className="space-y-6">
        <blockquote className="border-l-4 border-primary pl-4">
          <p className="text-lg text-slate-300">
            &quot;Track, manage, and report your crypto assets with
            professional-grade accounting tools.&quot;
          </p>
        </blockquote>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex -space-x-2">
            <div className="h-10 w-10 rounded-full bg-primary/20 ring-2 ring-slate-800" />
            <div className="h-10 w-10 rounded-full bg-blue-500/20 ring-2 ring-slate-800" />
            <div className="h-10 w-10 rounded-full bg-green-500/20 ring-2 ring-slate-800" />
          </div>
          <span className="text-sm">
            Join thousands of crypto professionals
          </span>
        </div>
      </div>

      <div className="text-sm text-slate-500">
        <p>Polkadot Ecosystem Ready</p>
        <p className="mt-1">Supporting Substrate & EVM chains</p>
      </div>
    </div>
  )

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <BrandingPanel />

      {/* Right Panel - Auth Form */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold" style={{ color: '#1a202c' }}>
              Welcome back
            </h2>
            <p className="mt-2" style={{ color: '#4a5568' }}>
              Sign in to your account
            </p>
          </div>

          {/* Auth Tabs */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={handleEmailTabClick}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={handleWalletTabClick}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'wallet'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wallet className="h-4 w-4" />
              Wallet
            </button>
          </div>

          {/* Error Alert */}
          {(displayError || walletError) && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{displayError || walletError}</p>
            </div>
          )}

          {/* Email Auth Form */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Sign in
                  </>
                )}
              </button>
            </form>
          )}

          {/* Wallet Auth */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {/* Wallet Selection */}
              {!selectedWallet && (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Connect your wallet to sign in
                  </p>
                  <div className="space-y-3">
                    {/* Substrate Wallets */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Substrate Wallets
                      </p>
                      <div className="space-y-2">
                        {walletExtensions
                          .filter(w => w.type === 'substrate')
                          .map(wallet => (
                            <WalletButton
                              key={wallet.provider}
                              wallet={wallet}
                              onClick={walletSelectHandlers[wallet.provider]}
                              loading={false}
                            />
                          ))}
                      </div>
                    </div>

                    {/* EVM Wallets */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        EVM Wallets
                      </p>
                      <div className="space-y-2">
                        {walletExtensions
                          .filter(w => w.type === 'evm')
                          .map(wallet => (
                            <WalletButton
                              key={wallet.provider}
                              wallet={wallet}
                              onClick={walletSelectHandlers[wallet.provider]}
                              loading={false}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Account Selection */}
              {selectedWallet && walletAccounts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleBackToWallets}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      &larr; Back to wallets
                    </button>
                    <span className="text-sm font-medium text-foreground">
                      {selectedWallet.name}
                    </span>
                  </div>

                  <p className="text-center text-sm text-muted-foreground">
                    Select an account to continue
                  </p>

                  <div className="space-y-2">
                    {walletAccounts.map(account => (
                      <button
                        key={account.address}
                        onClick={accountClickHandlers[account.address]}
                        disabled={loadingWallet}
                        className="flex w-full items-center justify-between rounded-lg border border-input bg-background p-4 text-left transition-colors hover:border-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {account.name}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {formatAddress(account.address)}
                          </p>
                        </div>
                        {loadingWallet ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loadingWallet && !walletAccounts.length && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Connecting to wallet...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Register Link */}
          <p className="text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

interface WalletButtonProps {
  wallet: WalletExtensionInfo
  onClick: () => void
  loading?: boolean
}

const WalletButton: React.FC<WalletButtonProps> = ({
  wallet,
  onClick,
  loading,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-between rounded-lg border border-input bg-background p-4 transition-colors hover:border-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <WalletLogo provider={wallet.provider} />
        </div>
        <div className="text-left">
          <p className="font-medium text-foreground">{wallet.name}</p>
          {!wallet.installed && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Not installed <ExternalLink className="h-3 w-3" />
            </p>
          )}
        </div>
      </div>
      {loading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  )
}

interface WalletLogoProps {
  provider: WalletProvider
}

const WalletLogo: React.FC<WalletLogoProps> = ({ provider }) => {
  // Use text placeholders for now - logos can be added later
  const initials: Record<WalletProvider, string> = {
    'polkadot-js': 'PJ',
    subwallet: 'SW',
    talisman: 'TA',
    nova: 'NV',
    metamask: 'MM',
    walletconnect: 'WC',
  }

  const colors: Record<WalletProvider, string> = {
    'polkadot-js': 'bg-pink-500',
    subwallet: 'bg-green-500',
    talisman: 'bg-red-500',
    nova: 'bg-blue-500',
    metamask: 'bg-orange-500',
    walletconnect: 'bg-blue-600',
  }

  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white ${colors[provider]}`}
    >
      {initials[provider]}
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatAddress(address: string): string {
  if (address.length <= 16) return address
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

export default Login
