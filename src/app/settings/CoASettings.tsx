import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import {
  BookOpen,
  Download,
  ExternalLink,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { persistence } from '../../services/persistence'
import { useProfile } from '../../contexts/ProfileContext'
import { isTauriAvailable } from '../../utils/tauri'
import type { GLAccount } from '../../types/database'

const JURISDICTION_LABELS: Record<string, string> = {
  'us-gaap': 'US GAAP',
  ifrs: 'IFRS',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  'not-for-profit': 'Not-for-Profit',
  'for-profit-enterprise': 'For-Profit Enterprise',
  individual: 'Individual',
}

const ACCOUNT_TYPE_ORDER = [
  'Asset',
  'Liability',
  'Equity',
  'Revenue',
  'Expense',
]

/**
 * Builds a human-readable template name (e.g. "US GAAP — Not-for-Profit")
 * from the stored jurisdiction and account type setting values.
 */
function formatTemplateName(jurisdiction: string, accountType: string): string {
  const jurisdictionLabel =
    JURISDICTION_LABELS[jurisdiction] ?? jurisdiction.toUpperCase()
  const accountTypeLabel = ACCOUNT_TYPE_LABELS[accountType] ?? accountType
  return `${jurisdictionLabel} — ${accountTypeLabel}`
}

/** Number of accounts sharing a single account type (Asset, Liability, …). */
interface TypeCount {
  type: string
  count: number
}

/** Number of accounts targeting a single context (All, Individual, SME, NGO). */
interface ContextCount {
  context: string
  count: number
}

/**
 * Aggregates a flat account list into per-type and per-context counts for
 * the summary display, ordered by the conventional accounting sequence.
 */
function summariseAccounts(accounts: GLAccount[]): {
  typeCounts: TypeCount[]
  contextCounts: ContextCount[]
} {
  const byType: Record<string, number> = {}
  const byContext: Record<string, number> = {}

  for (const account of accounts) {
    const typeKey = account.accountType || 'Other'
    byType[typeKey] = (byType[typeKey] || 0) + 1
    const contextKey = account.context || 'all'
    byContext[contextKey] = (byContext[contextKey] || 0) + 1
  }

  const typeCounts = ACCOUNT_TYPE_ORDER.filter(
    typeName => byType[typeName]
  ).map(typeName => ({
    type: typeName,
    count: byType[typeName],
  }))
  const remaining = Object.entries(byType)
    .filter(([typeName]) => !ACCOUNT_TYPE_ORDER.includes(typeName))
    .map(([type, count]) => ({ type, count }))
  typeCounts.push(...remaining)

  const CONTEXT_LABELS: Record<string, string> = {
    all: 'All',
    individual: 'Individual',
    sme: 'SME',
    ngo: 'NGO',
  }
  const contextCounts = Object.entries(byContext)
    .sort(([contextA], [contextB]) => {
      const order = ['all', 'individual', 'sme', 'ngo']
      return (
        (order.indexOf(contextA) === -1 ? 99 : order.indexOf(contextA)) -
        (order.indexOf(contextB) === -1 ? 99 : order.indexOf(contextB))
      )
    })
    .map(([context, count]) => ({
      context: CONTEXT_LABELS[context] ?? context,
      count,
    }))

  return { typeCounts, contextCounts }
}

/** Props for {@link SetupSummarySection}. */
interface SetupSummaryProps {
  jurisdiction: string | null
  accountType: string | null
  country: string | null
  onChange: () => void
}

/** Card summarising the currently configured framework, country, and entity type. */
const SetupSummarySection: React.FC<SetupSummaryProps> = ({
  jurisdiction,
  accountType,
  country,
  onChange,
}) => (
  <section className="rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#EAF3F2]/30 dark:bg-[#16242F]/40 p-5">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2] flex items-center gap-2">
        <Settings className="w-4 h-4 text-[#294050] dark:text-[#9FB4BE]" />
        Current Setup
      </h3>
      <button
        onClick={onChange}
        className="text-xs font-medium text-[#294050] dark:text-[#F09988] hover:underline"
      >
        Change
      </button>
    </div>
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
      <div>
        <dt className="text-[#647D8B] dark:text-[#647D8B]">Country</dt>
        <dd className="mt-0.5 font-medium text-[#11202B] dark:text-[#EAF3F2]">
          {country ?? '—'}
        </dd>
      </div>
      <div>
        <dt className="text-[#647D8B] dark:text-[#647D8B]">
          Accounting Framework
        </dt>
        <dd className="mt-0.5 font-medium text-[#11202B] dark:text-[#EAF3F2]">
          {JURISDICTION_LABELS[jurisdiction ?? ''] ?? jurisdiction ?? '—'}
        </dd>
      </div>
      <div>
        <dt className="text-[#647D8B] dark:text-[#647D8B]">Entity Type</dt>
        <dd className="mt-0.5 font-medium text-[#11202B] dark:text-[#EAF3F2]">
          {ACCOUNT_TYPE_LABELS[accountType ?? ''] ?? accountType ?? '—'}
        </dd>
      </div>
    </dl>
  </section>
)

/** Props for {@link EmptyStateSection}. */
interface EmptyStateProps {
  isTauri: boolean
  importing: boolean
  importError: string | null
  onImport: () => void
}

/**
 * Call-to-action shown when no chart of accounts exists yet. Offers the
 * template import in the desktop app; explains the limitation on web.
 */
const EmptyStateSection: React.FC<EmptyStateProps> = ({
  isTauri,
  importing,
  importError,
  onImport,
}) => (
  <section className="rounded-lg border-2 border-dashed border-[rgba(95,227,192,0.3)] p-8 text-center">
    <BookOpen className="mx-auto h-10 w-10 text-[#647D8B] dark:text-[#9FB4BE] mb-3" />
    <h3 className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
      No Chart of Accounts Imported
    </h3>
    <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1 max-w-md mx-auto">
      Import a chart of accounts template based on your current jurisdiction and
      entity type to get started.
    </p>

    {isTauri ? (
      <>
        <button
          onClick={onImport}
          disabled={importing}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#294050] text-white text-sm font-medium rounded-lg hover:bg-[#1E2F3C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {importing ? 'Importing…' : 'Import Chart of Accounts Template'}
        </button>
        {importError && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            {importError}
          </div>
        )}
      </>
    ) : (
      <p className="mt-4 text-xs text-[#647D8B] dark:text-[#647D8B]">
        Template import is available in the Pacioli desktop app.
      </p>
    )}
  </section>
)

/** Tile showing the number of accounts for one account type. */
const TypeCountTile: React.FC<TypeCount> = ({ type, count }) => (
  <div className="rounded-md bg-white/60 dark:bg-[#0C141B]/60 border border-[rgba(95,227,192,0.1)] px-3 py-2 text-center">
    <div className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2]">
      {count}
    </div>
    <div className="text-xs text-[#647D8B] dark:text-[#9FB4BE]">{type}</div>
  </div>
)

/** Pill showing how many accounts target a given context. */
const ContextChip: React.FC<ContextCount> = ({ context, count }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/60 dark:bg-[#0C141B]/60 border border-[rgba(95,227,192,0.1)] px-3 py-1 text-xs text-[#294050] dark:text-[#9FB4BE]">
    <span className="font-medium">{context}</span>
    <span className="text-[#647D8B]">{count}</span>
  </span>
)

/** Props for {@link ImportedTemplateSection}. */
interface ImportedTemplateProps {
  templateName: string
  typeCounts: TypeCount[]
  contextCounts: ContextCount[]
}

/** Summary of the imported template: name plus type and context breakdowns. */
const ImportedTemplateSection: React.FC<ImportedTemplateProps> = ({
  templateName,
  typeCounts,
  contextCounts,
}) => (
  <section className="rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#EAF3F2]/30 dark:bg-[#16242F]/40 p-5">
    <h3 className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2] flex items-center gap-2 mb-4">
      <BookOpen className="w-4 h-4 text-[#294050] dark:text-[#9FB4BE]" />
      Imported Template
    </h3>

    <div className="mb-4">
      <span className="text-sm text-[#647D8B] dark:text-[#647D8B]">
        Template
      </span>
      <p className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2] mt-0.5">
        {templateName}
      </p>
    </div>

    {/* Account counts by type */}
    <div className="mb-4">
      <span className="text-xs uppercase tracking-wider text-[#647D8B] dark:text-[#647D8B]">
        Accounts by Type
      </span>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {typeCounts.map(({ type, count }) => (
          <TypeCountTile key={type} type={type} count={count} />
        ))}
      </div>
    </div>

    {/* Context distribution */}
    <div>
      <span className="text-xs uppercase tracking-wider text-[#647D8B] dark:text-[#647D8B]">
        Context Distribution
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {contextCounts.map(({ context, count }) => (
          <ContextChip key={context} context={context} count={count} />
        ))}
      </div>
    </div>
  </section>
)

/**
 * Settings panel for the chart of accounts (GIV-789): shows the configured
 * jurisdiction/entity type, lets desktop users import the matching CoA
 * template, and summarises the imported account structure.
 */
const CoASettings: React.FC = () => {
  const navigate = useNavigate()
  const { currentProfile } = useProfile()
  const isTauri = useMemo(() => isTauriAvailable(), [])

  const [jurisdiction, setJurisdiction] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<string | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [savedJurisdiction, savedAccountType, savedCountry] =
        await Promise.all([
          persistence.getSetting('jurisdiction'),
          persistence.getSetting('accountType'),
          persistence.getSetting('country'),
        ])
      setJurisdiction(savedJurisdiction ?? 'us-gaap')
      setAccountType(savedAccountType ?? 'not-for-profit')
      setCountry(savedCountry ?? null)

      if (isTauri) {
        const result = await invoke<GLAccount[]>('get_chart_of_accounts')
        setAccounts(result)
      }
    } catch (err) {
      console.error('[CoASettings] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [isTauri])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleImport = useCallback(async () => {
    if (!jurisdiction || !accountType) return
    setImporting(true)
    setImportError(null)
    try {
      const profileId = currentProfile?.id ?? 'default'
      await invoke('import_chart_of_accounts_template', {
        input: { jurisdiction, accountType, profileId },
      })
      const result = await invoke<GLAccount[]>('get_chart_of_accounts')
      setAccounts(result)
    } catch (err) {
      const message =
        typeof err === 'string' ? err : 'Failed to import template'
      setImportError(message)
      console.error('[CoASettings] Import failed:', err)
    } finally {
      setImporting(false)
    }
  }, [jurisdiction, accountType, currentProfile])

  const summary = useMemo(() => summariseAccounts(accounts), [accounts])
  const isEmpty = accounts.length === 0

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#294050] dark:text-[#9FB4BE]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2]">
          Chart of Accounts
        </h2>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
          Manage your chart of accounts template and view imported account
          structure.
        </p>
      </div>

      <SetupSummarySection
        jurisdiction={jurisdiction}
        accountType={accountType}
        country={country}
        onChange={() => navigate('/settings/general')}
      />

      {isEmpty ? (
        <EmptyStateSection
          isTauri={isTauri}
          importing={importing}
          importError={importError}
          onImport={handleImport}
        />
      ) : (
        <ImportedTemplateSection
          templateName={formatTemplateName(
            jurisdiction ?? '',
            accountType ?? ''
          )}
          typeCounts={summary.typeCounts}
          contextCounts={summary.contextCounts}
        />
      )}

      {/* Deep link to Ledger CoA browser */}
      <div className="pt-2">
        <button
          onClick={() => navigate('/chart-of-accounts')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#294050] dark:text-[#F09988] hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          Open full Chart of Accounts browser
        </button>
      </div>
    </div>
  )
}

export default CoASettings
