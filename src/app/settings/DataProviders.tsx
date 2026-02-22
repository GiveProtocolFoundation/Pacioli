import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Zap,
  Key,
  Check,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  Gauge,
} from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

interface ProviderStatus {
  provider: string
  name: string
  has_api_key: boolean
  rate_limit: number
  turbo_rate_limit: number
  is_turbo_mode: boolean
}

interface SaveApiKeyResult {
  success: boolean
  new_rate_limit: number
  error: string | null
}

interface ProviderConfig {
  id: string
  name: string
  description: string
  docsUrl: string
  chains: string[]
}

// Provider metadata with documentation links
const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'etherscan',
    name: 'Etherscan',
    description: 'Ethereum mainnet block explorer API',
    docsUrl:
      'https://docs.etherscan.io/getting-started/viewing-api-usage-statistics',
    chains: ['Ethereum'],
  },
  {
    id: 'polygonscan',
    name: 'Polygonscan',
    description: 'Polygon network block explorer API',
    docsUrl:
      'https://docs.polygonscan.com/getting-started/viewing-api-usage-statistics',
    chains: ['Polygon'],
  },
  {
    id: 'arbiscan',
    name: 'Arbiscan',
    description: 'Arbitrum network block explorer API',
    docsUrl:
      'https://docs.arbiscan.io/getting-started/viewing-api-usage-statistics',
    chains: ['Arbitrum'],
  },
  {
    id: 'basescan',
    name: 'Basescan',
    description: 'Base network block explorer API',
    docsUrl:
      'https://docs.basescan.org/getting-started/viewing-api-usage-statistics',
    chains: ['Base'],
  },
  {
    id: 'optimism',
    name: 'Optimistic Etherscan',
    description: 'Optimism network block explorer API',
    docsUrl: 'https://docs.optimism.etherscan.io/',
    chains: ['Optimism'],
  },
  {
    id: 'subscan',
    name: 'Subscan',
    description: 'Polkadot ecosystem block explorer API',
    docsUrl: 'https://support.subscan.io/#introduction',
    chains: ['Polkadot', 'Kusama', 'Parachains'],
  },
]

// =============================================================================
// Components
// =============================================================================

const TurboModeIndicator: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <div
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-[#c9a961]/20 text-[#c9a961] dark:bg-[#c9a961]/30 dark:text-[#dbc07a]'
        : 'bg-[#696557]/10 text-[#696557] dark:bg-[#696557]/20 dark:text-[#b8b3ac]'
    }`}
  >
    <Zap className={`w-3 h-3 mr-1 ${isActive ? 'fill-current' : ''}`} />
    {isActive ? 'Turbo Mode' : 'Default Mode'}
  </div>
)

/** Displays the current rate limit and potential turbo limit for a provider */
const RateLimitBadge: React.FC<{
  rateLimit: number
  turboLimit: number
  isTurbo: boolean
}> = ({ rateLimit, turboLimit, isTurbo }) => (
  <div className="flex items-center gap-2 text-xs text-[#696557] dark:text-[#b8b3ac]">
    <Gauge className="w-3.5 h-3.5" />
    <span>
      {rateLimit} req/sec
      {!isTurbo && (
        <span className="text-[#a39d94] dark:text-[#8b8580]">
          {' '}
          (up to {turboLimit} with key)
        </span>
      )}
    </span>
  </div>
)

interface ProviderCardProps {
  config: ProviderConfig
  status: ProviderStatus | undefined
  onSave: (provider: string, key: string) => Promise<void>
  onDelete: (provider: string) => Promise<void>
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  config,
  status,
  onSave,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasKey = status?.has_api_key ?? false
  const isTurbo = status?.is_turbo_mode ?? false
  const rateLimit = status?.rate_limit ?? 1
  const turboLimit = status?.turbo_rate_limit ?? 5

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setApiKey(e.target.value)
    },
    []
  )

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key cannot be empty')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(config.id, apiKey.trim())
      setApiKey('')
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await onDelete(config.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove API key')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setApiKey('')
    setIsEditing(false)
    setError(null)
  }

  return (
    <div className="border border-[rgba(201,169,97,0.15)] rounded-lg p-4 hover:border-[rgba(201,169,97,0.3)] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
              {config.name}
            </h4>
            <TurboModeIndicator isActive={isTurbo} />
          </div>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
            {config.description}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <RateLimitBadge
              rateLimit={rateLimit}
              turboLimit={turboLimit}
              isTurbo={isTurbo}
            />
            <div className="flex items-center gap-1 text-xs text-[#a39d94] dark:text-[#8b8580]">
              {config.chains.map((chain, i) => (
                <span key={chain}>
                  {chain}
                  {i < config.chains.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        </div>
        <a
          href={config.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8b4e52] hover:text-[#7a4248] dark:text-[#a86e72] dark:hover:text-[#c08589] p-1"
          title="Get free API key"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-[#8b4e52] dark:text-[#a86e72] mb-3 p-2 bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your API key"
              className="w-full px-3 py-2 pr-10 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961] text-sm font-mono"
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#696557] hover:text-[#1a1815] dark:text-[#b8b3ac] dark:hover:text-[#f5f3f0]"
            >
              {showKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !apiKey.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-[#8b4e52] rounded-lg hover:bg-[#7a4248] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm font-medium text-[#696557] dark:text-[#b8b3ac] hover:text-[#1a1815] dark:hover:text-[#f5f3f0] flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {hasKey ? (
            <>
              <div className="flex items-center gap-1.5 text-sm text-[#4a7c59] dark:text-[#6b9e7a]">
                <Check className="w-4 h-4" />
                <span>API key configured</span>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm font-medium text-[#696557] dark:text-[#b8b3ac] hover:text-[#1a1815] dark:hover:text-[#f5f3f0] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620]"
              >
                Update
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-[#8b4e52] dark:text-[#a86e72] hover:text-[#7a4248] dark:hover:text-[#c08589] flex items-center gap-1"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Remove
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm font-medium text-[#8b4e52] dark:text-[#a86e72] border border-[#8b4e52]/30 dark:border-[#8b4e52]/40 rounded-lg hover:bg-[#8b4e52]/10 dark:hover:bg-[#8b4e52]/20 flex items-center gap-1.5"
            >
              <Key className="w-4 h-4" />
              Add API Key
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

const DataProviders: React.FC = () => {
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch provider statuses on mount
  const fetchStatuses = useCallback(async () => {
    try {
      const statuses = await invoke<ProviderStatus[]>(
        'get_all_provider_statuses'
      )
      setProviderStatuses(statuses)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch provider statuses:', err)
      setError('Failed to load provider information')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatuses()
  }, [fetchStatuses])

  const handleSaveKey = async (provider: string, key: string) => {
    const result = await invoke<SaveApiKeyResult>('save_api_key', {
      provider,
      apiKey: key,
    })
    if (!result.success) {
      throw new Error(result.error || 'Failed to save API key')
    }
    // Refresh statuses
    await fetchStatuses()
  }

  const handleDeleteKey = async (provider: string) => {
    const result = await invoke<SaveApiKeyResult>('delete_api_key', {
      provider,
    })
    if (!result.success) {
      throw new Error(result.error || 'Failed to remove API key')
    }
    // Refresh statuses
    await fetchStatuses()
  }

  const getStatusForProvider = (
    providerId: string
  ): ProviderStatus | undefined => {
    return providerStatuses.find(s => s.provider === providerId)
  }

  const turboCount = providerStatuses.filter(s => s.is_turbo_mode).length
  const totalProviders = PROVIDER_CONFIGS.length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-[#8b4e52]" />
          <h2 className="text-xl font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
            Data Providers & API Keys
          </h2>
        </div>
        <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
          Configure API keys to unlock faster sync speeds. All keys are stored
          securely in your system keychain.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-[#c9a961]/10 dark:bg-[#c9a961]/20 border border-[#c9a961]/30 dark:border-[#c9a961]/40 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-[#c9a961] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-[#1a1815] dark:text-[#f5f3f0] mb-1">
              Batteries Included, Turbo Optional
            </h3>
            <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
              Pacioli works out of the box with conservative rate limits. Add
              your free API keys from block explorers to unlock 5x faster sync
              speeds. API keys are free to obtain from each provider.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#696557]" />
                <span className="text-sm text-[#696557] dark:text-[#b8b3ac]">
                  Default: ~1 req/sec
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#c9a961]" />
                <span className="text-sm text-[#696557] dark:text-[#b8b3ac]">
                  Turbo: ~5-10 req/sec
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && !error && (
        <div className="mb-6 flex items-center gap-4 text-sm">
          <span className="text-[#696557] dark:text-[#b8b3ac]">
            <span className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
              {turboCount}
            </span>{' '}
            of {totalProviders} providers in Turbo Mode
          </span>
          {turboCount === totalProviders && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#4a7c59]/20 text-[#4a7c59] dark:bg-[#6b9e7a]/20 dark:text-[#6b9e7a]">
              <Check className="w-3 h-3 mr-1" />
              All configured
            </span>
          )}
        </div>
      )}

      {/* Provider List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#8b4e52]" />
          <span className="ml-2 text-[#696557] dark:text-[#b8b3ac]">
            Loading providers...
          </span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-[#8b4e52] dark:text-[#a86e72]">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          {PROVIDER_CONFIGS.map(config => (
            <ProviderCard
              key={config.id}
              config={config}
              status={getStatusForProvider(config.id)}
              onSave={handleSaveKey}
              onDelete={handleDeleteKey}
            />
          ))}
        </div>
      )}

      {/* Security Note */}
      <div className="mt-6 p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg border border-[rgba(201,169,97,0.15)]">
        <h4 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0] mb-1">
          Security Note
        </h4>
        <p className="text-xs text-[#696557] dark:text-[#b8b3ac]">
          API keys are stored in your operating system&apos;s secure keychain
          (Keychain on macOS, Credential Manager on Windows, Secret Service on
          Linux). Keys are never transmitted to Pacioli servers.
        </p>
      </div>
    </div>
  )
}

export default DataProviders
