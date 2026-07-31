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
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import { isTauriAvailable } from '../../utils/tauri'

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

interface ValidateApiKeyResult {
  status: 'valid' | 'invalid' | 'network_error' | 'not_verifiable'
  message: string
}

interface ProviderConfig {
  id: string
  name: string
  description: string
  docsUrl: string
  chains: string[]
}

// localStorage key prefix for browser-mode API key storage
const LS_KEY_PREFIX = 'pacioli_api_key_'

// localStorage key prefix for last-verified timestamps
const LS_VERIFIED_PREFIX = 'pacioli_key_verified_'

// Map provider IDs to their VITE_ env var names for default key detection
const VITE_KEY_MAP: Record<string, string> = {
  etherscan: 'VITE_ETHERSCAN_API_KEY',
  subscan: 'VITE_SUBSCAN_API_KEY',
}

/** Check if a provider has a build-time default API key via VITE_ env var */
function hasDefaultKey(providerId: string): boolean {
  const envVar = VITE_KEY_MAP[providerId]
  if (!envVar) return false
  const val = import.meta.env?.[envVar]
  return Boolean(val) && !val.startsWith('your_')
}

/** Format a stored ISO timestamp as a relative or short date */
function formatVerifiedTime(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return 'Unknown'
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
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
    id: 'moonscan',
    name: 'Moonscan (Etherscan V2)',
    description:
      'Moonbeam/Moonriver via Etherscan V2. Networks shut down 31 Jul 2026 — sync history before then.',
    docsUrl: 'https://etherscan.io/myapikey',
    chains: ['Moonbeam', 'Moonriver'],
  },
  {
    id: 'subscan',
    name: 'Subscan',
    description: 'Polkadot ecosystem block explorer API',
    docsUrl: 'https://support.subscan.io/#introduction',
    chains: ['Polkadot', 'Kusama', 'Parachains'],
  },
]

// Browser-mode fallback: build ProviderStatus from localStorage + VITE_ defaults
function getLocalStorageStatuses(): ProviderStatus[] {
  return PROVIDER_CONFIGS.map(config => {
    const hasUserKey = Boolean(
      localStorage.getItem(`${LS_KEY_PREFIX}${config.id}`)
    )
    const hasDefault = hasDefaultKey(config.id)
    const hasAnyKey = hasUserKey || hasDefault
    return {
      provider: config.id,
      name: config.name,
      has_api_key: hasAnyKey,
      rate_limit: hasUserKey ? 5 : hasDefault ? 3 : 1,
      turbo_rate_limit: 5,
      is_turbo_mode: hasUserKey,
    }
  })
}

// =============================================================================
// Components
// =============================================================================

type KeyMode = 'none' | 'default' | 'turbo'

/** @param props - contains `mode` indicating key status (none/default/turbo). @returns Badge showing API key mode. */
const TurboModeIndicator: React.FC<{ mode: KeyMode }> = ({ mode }) => {
  const styles: Record<KeyMode, string> = {
    none: 'bg-[#294050]/10 text-[#294050] dark:bg-[#294050]/20 dark:text-[#9FB4BE]',
    default:
      'bg-[#2E9A82]/15 text-[#2E9A82] dark:bg-[#5FE3C0]/20 dark:text-[#5FE3C0]',
    turbo:
      'bg-[#5FE3C0]/20 text-[#5FE3C0] dark:bg-[#5FE3C0]/30 dark:text-[#9CF1DC]',
  }
  const labels: Record<KeyMode, string> = {
    none: 'No Key',
    default: 'App Default',
    turbo: 'Turbo Mode',
  }

  return (
    <div
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[mode]}`}
    >
      <Zap
        className={`w-3 h-3 mr-1 ${mode === 'turbo' ? 'fill-current' : ''}`}
      />
      {labels[mode]}
    </div>
  )
}

/** Displays the current rate limit and potential turbo limit for a provider */
const RateLimitBadge: React.FC<{
  rateLimit: number
  turboLimit: number
  isTurbo: boolean
}> = ({ rateLimit, turboLimit, isTurbo }) => (
  <div className="flex items-center gap-2 text-xs text-[#294050] dark:text-[#9FB4BE]">
    <Gauge className="w-3.5 h-3.5" />
    <span>
      {rateLimit} req/sec
      {!isTurbo && (
        <span className="text-[#647D8B] dark:text-[#647D8B]">
          {' '}
          (up to {turboLimit} with key)
        </span>
      )}
    </span>
  </div>
)

/** Informational box explaining turbo mode and its benefits */
const TurboInfoBox: React.FC = () => (
  <div className="bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 border border-[#5FE3C0]/30 dark:border-[#5FE3C0]/40 rounded-lg p-4 mb-6">
    <div className="flex items-start gap-3">
      <Zap className="w-5 h-5 text-[#5FE3C0] flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-medium text-[#11202B] dark:text-[#EAF3F2] mb-1">
          Batteries Included, Turbo Optional
        </h3>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
          Pacioli works out of the box with conservative rate limits. Add your
          free API keys from block explorers to unlock 5x faster sync speeds.
          API keys are free to obtain from each provider.
        </p>
      </div>
    </div>
    <div className="mt-3 ml-8 flex items-center gap-4">
      <span className="flex items-center gap-2 text-sm text-[#294050] dark:text-[#9FB4BE]">
        <span className="inline-block w-2 h-2 rounded-full bg-[#294050]" />
        Default: ~1 req/sec
      </span>
      <span className="flex items-center gap-2 text-sm text-[#294050] dark:text-[#9FB4BE]">
        <span className="inline-block w-2 h-2 rounded-full bg-[#5FE3C0]" />
        Turbo: ~5-10 req/sec
      </span>
    </div>
  </div>
)

/** Shows validation result as an inline banner */
const ValidationBanner: React.FC<{
  result: ValidateApiKeyResult
  isValidating: boolean
  onSaveAnyway?: () => void
  onCancel?: () => void
}> = ({ result, isValidating, onSaveAnyway, onCancel }) => {
  if (isValidating) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#294050] dark:text-[#9FB4BE] mb-3 p-2 bg-[#294050]/5 dark:bg-[#294050]/10 rounded">
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        Validating API key...
      </div>
    )
  }

  if (result.status === 'valid') {
    return (
      <div className="flex items-center gap-2 text-sm text-[#2E9A82] dark:text-[#5FE3C0] mb-3 p-2 bg-[#2E9A82]/10 dark:bg-[#5FE3C0]/10 rounded">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        {result.message}
      </div>
    )
  }

  const isWarning =
    result.status === 'invalid' || result.status === 'network_error'
  if (!isWarning) return null

  return (
    <div className="mb-3 p-2 bg-[#294050]/10 dark:bg-[#294050]/20 rounded space-y-2">
      <div className="flex items-center gap-2 text-sm text-[#294050] dark:text-[#F09988]">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        {result.message}
      </div>
      {onSaveAnyway && (
        <div className="flex items-center gap-2">
          <button
            onClick={onSaveAnyway}
            className="px-3 py-1 text-xs font-medium text-[#294050] dark:text-[#F09988] border border-[#294050]/30 dark:border-[#294050]/40 rounded hover:bg-[#294050]/10 dark:hover:bg-[#294050]/20"
          >
            Save Anyway
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-xs font-medium text-[#294050] dark:text-[#9FB4BE] hover:text-[#11202B] dark:hover:text-[#EAF3F2]"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface ProviderApiKeyFormProps {
  apiKey: string
  showKey: boolean
  isSaving: boolean
  onApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onToggleShowKey: () => void
  onSave: () => void
  onCancel: () => void
}

/** API key editing form with input field, show/hide toggle, and save/cancel buttons */
const ProviderApiKeyForm: React.FC<ProviderApiKeyFormProps> = ({
  apiKey,
  showKey,
  isSaving,
  onApiKeyChange,
  onToggleShowKey,
  onSave,
  onCancel,
}) => (
  <div className="space-y-3">
    <div className="relative">
      <input
        type={showKey ? 'text' : 'password'}
        value={apiKey}
        onChange={onApiKeyChange}
        placeholder="Enter your API key"
        className="w-full px-3 py-2 pr-10 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] text-sm font-mono"
        disabled={isSaving}
      />
      <button
        type="button"
        onClick={onToggleShowKey}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#294050] hover:text-[#11202B] dark:text-[#9FB4BE] dark:hover:text-[#EAF3F2]"
      >
        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onSave}
        disabled={isSaving || !apiKey.trim()}
        className="px-3 py-1.5 text-sm font-medium text-white bg-[#294050] rounded-lg hover:bg-[#1E2F3C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        Save
      </button>
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="px-3 py-1.5 text-sm font-medium text-[#294050] dark:text-[#9FB4BE] hover:text-[#11202B] dark:hover:text-[#EAF3F2] flex items-center gap-1.5"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
    </div>
  </div>
)

/** Displays the last-verified timestamp for a provider */
const VerifiedTimestamp: React.FC<{ providerId: string }> = ({
  providerId,
}) => {
  const stored = localStorage.getItem(`${LS_VERIFIED_PREFIX}${providerId}`)
  if (!stored) return null
  return (
    <span className="text-xs text-[#647D8B] dark:text-[#647D8B]">
      Verified {formatVerifiedTime(stored)}
    </span>
  )
}

interface ProviderCardProps {
  config: ProviderConfig
  status: ProviderStatus | undefined
  onSave: (provider: string, key: string) => Promise<void>
  onDelete: (provider: string) => Promise<void>
}

/** Card component for a single data provider, showing status, rate limits, and API key management */
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
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] =
    useState<ValidateApiKeyResult | null>(null)
  const [awaitingOverride, setAwaitingOverride] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<ValidateApiKeyResult | null>(
    null
  )

  const hasKey = status?.has_api_key ?? false
  const isTurbo = status?.is_turbo_mode ?? false
  const rateLimit = status?.rate_limit ?? 1
  const turboLimit = status?.turbo_rate_limit ?? 5
  const defaultAvailable = hasDefaultKey(config.id)
  const keyMode: KeyMode = isTurbo
    ? 'turbo'
    : hasKey || defaultAvailable
      ? 'default'
      : 'none'

  const toggleShowKey = useCallback(() => {
    setShowKey(prev => !prev)
  }, [])

  const startEditing = useCallback(() => {
    setIsEditing(true)
    setValidationResult(null)
    setAwaitingOverride(false)
    setTestResult(null)
  }, [])

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setApiKey(e.target.value)
      setValidationResult(null)
      setAwaitingOverride(false)
    },
    []
  )

  /** Persist the key (bypassing validation) */
  const doSave = useCallback(
    async (key: string) => {
      setIsSaving(true)
      setError(null)
      try {
        await onSave(config.id, key)
        localStorage.setItem(
          `${LS_VERIFIED_PREFIX}${config.id}`,
          new Date().toISOString()
        )
        setApiKey('')
        setIsEditing(false)
        setAwaitingOverride(false)
        setValidationResult(null)
        setShowSaveSuccess(true)
        setTimeout(() => setShowSaveSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save API key')
      } finally {
        setIsSaving(false)
      }
    },
    [config.id, onSave]
  )

  /** Validate-then-save flow */
  const handleSave = useCallback(async () => {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      setError('API key cannot be empty')
      return
    }

    setIsValidating(true)
    setError(null)
    setValidationResult(null)

    try {
      let result: ValidateApiKeyResult
      if (isTauriAvailable()) {
        result = await invoke<ValidateApiKeyResult>('validate_api_key', {
          provider: config.id,
          apiKey: trimmed,
        })
      } else {
        // Browser mode: skip validation
        result = {
          status: 'not_verifiable',
          message: 'Validation unavailable in browser mode',
        }
      }

      setValidationResult(result)

      if (result.status === 'valid' || result.status === 'not_verifiable') {
        await doSave(trimmed)
      } else {
        // invalid or network_error — show warning, let user override
        setAwaitingOverride(true)
      }
    } catch (err) {
      // Invoke itself failed — treat as network error, allow override
      const msg = err instanceof Error ? err.message : 'Validation call failed'
      setValidationResult({ status: 'network_error', message: msg })
      setAwaitingOverride(true)
    } finally {
      setIsValidating(false)
    }
  }, [apiKey, config.id, doSave])

  const handleSaveAnyway = useCallback(() => {
    doSave(apiKey.trim())
  }, [apiKey, doSave])

  const handleDelete = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      await onDelete(config.id)
      localStorage.removeItem(`${LS_VERIFIED_PREFIX}${config.id}`)
      setTestResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove API key')
    } finally {
      setIsSaving(false)
    }
  }, [config.id, onDelete])

  const handleCancel = useCallback(() => {
    setApiKey('')
    setIsEditing(false)
    setError(null)
    setValidationResult(null)
    setAwaitingOverride(false)
  }, [])

  /** Test the stored key without exposing it */
  const handleTest = useCallback(async () => {
    if (!isTauriAvailable()) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await invoke<ValidateApiKeyResult>('test_stored_api_key', {
        provider: config.id,
      })
      setTestResult(result)
      if (result.status === 'valid') {
        localStorage.setItem(
          `${LS_VERIFIED_PREFIX}${config.id}`,
          new Date().toISOString()
        )
      }
    } catch (err) {
      setTestResult({
        status: 'network_error',
        message: err instanceof Error ? err.message : 'Test connection failed',
      })
    } finally {
      setIsTesting(false)
    }
  }, [config.id])

  return (
    <div className="border border-[rgba(95,227,192,0.15)] rounded-lg p-4 hover:border-[rgba(95,227,192,0.3)] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="flex items-center gap-2 mb-1 font-medium text-[#11202B] dark:text-[#EAF3F2]">
            {config.name}
            <TurboModeIndicator mode={keyMode} />
          </h4>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
            {config.description}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <RateLimitBadge
              rateLimit={rateLimit}
              turboLimit={turboLimit}
              isTurbo={isTurbo}
            />
            <span className="flex items-center gap-1 text-xs text-[#647D8B] dark:text-[#647D8B]">
              {config.chains.map((chain, i) => (
                <span key={chain}>
                  {chain}
                  {i < config.chains.length - 1 && ', '}
                </span>
              ))}
            </span>
          </div>
        </div>
        <a
          href={config.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#294050] hover:text-[#1E2F3C] dark:text-[#F09988] dark:hover:text-[#9CF1DC] p-1"
          title="Get free API key"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-[#294050] dark:text-[#F09988] mb-3 p-2 bg-[#294050]/10 dark:bg-[#294050]/20 rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Validation banner during save flow */}
      {(isValidating || (validationResult && awaitingOverride)) && (
        <ValidationBanner
          result={
            validationResult ?? { status: 'valid', message: 'Validating...' }
          }
          isValidating={isValidating}
          onSaveAnyway={awaitingOverride ? handleSaveAnyway : undefined}
          onCancel={awaitingOverride ? handleCancel : undefined}
        />
      )}

      {/* Test result banner (for existing keys) */}
      {testResult && !isEditing && (
        <ValidationBanner result={testResult} isValidating={isTesting} />
      )}

      {isEditing ? (
        <ProviderApiKeyForm
          apiKey={apiKey}
          showKey={showKey}
          isSaving={isSaving || isValidating}
          onApiKeyChange={handleApiKeyChange}
          onToggleShowKey={toggleShowKey}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <div className="flex items-center gap-2">
          {hasKey ? (
            <>
              <div className="flex items-center gap-1.5 text-sm text-[#2E9A82] dark:text-[#5FE3C0]">
                <Check className="w-4 h-4" />
                <span>
                  {showSaveSuccess
                    ? 'API key saved successfully!'
                    : 'API key configured'}
                </span>
              </div>
              <VerifiedTimestamp providerId={config.id} />
              {isTauriAvailable() && (
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="px-3 py-1.5 text-sm font-medium text-[#294050] dark:text-[#9FB4BE] hover:text-[#11202B] dark:hover:text-[#EAF3F2] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] flex items-center gap-1"
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Test
                </button>
              )}
              <button
                onClick={startEditing}
                className="px-3 py-1.5 text-sm font-medium text-[#294050] dark:text-[#9FB4BE] hover:text-[#11202B] dark:hover:text-[#EAF3F2] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
              >
                Update
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-[#294050] dark:text-[#F09988] hover:text-[#1E2F3C] dark:hover:text-[#9CF1DC] flex items-center gap-1"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Remove
              </button>
            </>
          ) : defaultAvailable ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#2E9A82] dark:text-[#5FE3C0]">
                Using app default key
              </span>
              <button
                onClick={startEditing}
                className="px-3 py-1.5 text-sm font-medium text-[#5FE3C0] dark:text-[#9CF1DC] border border-[#5FE3C0]/30 dark:border-[#5FE3C0]/40 rounded-lg hover:bg-[#5FE3C0]/10 dark:hover:bg-[#5FE3C0]/20 flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                Upgrade to Turbo
              </button>
            </div>
          ) : (
            <button
              onClick={startEditing}
              className="px-3 py-1.5 text-sm font-medium text-[#294050] dark:text-[#F09988] border border-[#294050]/30 dark:border-[#294050]/40 rounded-lg hover:bg-[#294050]/10 dark:hover:bg-[#294050]/20 flex items-center gap-1.5"
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
      if (isTauriAvailable()) {
        const statuses = await invoke<ProviderStatus[]>(
          'get_all_provider_statuses'
        )
        setProviderStatuses(statuses)
      } else {
        setProviderStatuses(getLocalStorageStatuses())
      }
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

  const handleSaveKey = useCallback(
    async (provider: string, key: string) => {
      if (isTauriAvailable()) {
        const result = await invoke<SaveApiKeyResult>('save_api_key', {
          provider,
          apiKey: key,
        })
        if (!result.success) {
          throw new Error(result.error || 'Failed to save API key')
        }
      } else {
        localStorage.setItem(`${LS_KEY_PREFIX}${provider}`, key)
      }
      // Refresh statuses
      await fetchStatuses()
    },
    [fetchStatuses]
  )

  const handleDeleteKey = useCallback(
    async (provider: string) => {
      if (isTauriAvailable()) {
        const result = await invoke<SaveApiKeyResult>('delete_api_key', {
          provider,
        })
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove API key')
        }
      } else {
        localStorage.removeItem(`${LS_KEY_PREFIX}${provider}`)
      }
      // Refresh statuses
      await fetchStatuses()
    },
    [fetchStatuses]
  )

  /** Finds the status object for a given provider by its ID */
  const getStatusForProvider = (
    providerId: string
  ): ProviderStatus | undefined => {
    return providerStatuses.find(s => s.provider === providerId)
  }

  const turboCount = providerStatuses.filter(s => s.is_turbo_mode).length
  const configuredCount = providerStatuses.filter(s => s.has_api_key).length
  const totalProviders = PROVIDER_CONFIGS.length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-[#294050]" />
          <h2 className="text-xl font-semibold text-[#11202B] dark:text-[#EAF3F2]">
            Data Providers & API Keys
          </h2>
        </div>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
          Configure API keys to unlock faster sync speeds. All keys are stored
          securely in your system keychain.
        </p>
      </div>

      {/* Info Box */}
      <TurboInfoBox />

      {/* Stats */}
      {!isLoading && !error && (
        <div className="mb-6 flex items-center gap-4 text-sm">
          <span className="text-[#294050] dark:text-[#9FB4BE]">
            <span className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
              {configuredCount}
            </span>{' '}
            of {totalProviders} providers active
            {turboCount > 0 && (
              <span className="text-[#5FE3C0] dark:text-[#9CF1DC]">
                {' '}
                ({turboCount} Turbo)
              </span>
            )}
          </span>
          {configuredCount === totalProviders && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#2E9A82]/20 text-[#2E9A82] dark:bg-[#5FE3C0]/20 dark:text-[#5FE3C0]">
              <Check className="w-3 h-3 mr-1" />
              All configured
            </span>
          )}
        </div>
      )}

      {/* Provider List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#294050]" />
          <span className="ml-2 text-[#294050] dark:text-[#9FB4BE]">
            Loading providers...
          </span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-[#294050] dark:text-[#F09988]">
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
      <div className="mt-6 p-4 bg-[#EAF3F2] dark:bg-[#11202B] rounded-lg border border-[rgba(95,227,192,0.15)]">
        <h4 className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2] mb-1">
          Security Note
        </h4>
        <p className="text-xs text-[#294050] dark:text-[#9FB4BE]">
          {isTauriAvailable()
            ? "API keys are stored in your operating system's secure keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux). Keys are never transmitted to Pacioli servers."
            : 'Running in browser mode. API keys are stored in localStorage for development. Use the desktop app (pnpm tauri:dev) for secure OS keychain storage.'}
        </p>
      </div>
    </div>
  )
}

export default DataProviders
