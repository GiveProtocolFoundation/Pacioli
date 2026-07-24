import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  Settings,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Target,
} from 'lucide-react'
import { useWalletBalances } from '../../hooks/useWalletBalances'
import { useProfile } from '../../contexts/ProfileContext'
import { persistence } from '../../services/persistence'
import type { StoredTransaction } from '../../services/persistence'
import { useCurrency } from '../../contexts/CurrencyContext'
import { formatCurrency } from '../../utils/currencyFormatter'

interface KPI {
  id: string
  label: string
  value: string
  change: number | null
  changeLabel: string
  icon: React.ElementType
  trend: 'up' | 'down' | 'neutral'
}

type TimePeriod = '7d' | '30d' | '90d' | '1y' | 'all'

/** Empty state placeholder */
const EmptyState: React.FC<{
  icon: React.ReactNode
  title: string
  message: string
}> = ({ icon, title, message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="mx-auto h-12 w-12 text-gray-400">{icon}</div>
    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
      {title}
    </h3>
    <p className="mt-1 text-sm text-gray-500 dark:text-[#9FB4BE]">{message}</p>
  </div>
)

/** Key performance indicator card displaying a metric with trend direction and change details */
const KPICard: React.FC<{ kpi: KPI }> = ({ kpi }) => {
  const Icon = kpi.icon
  const TrendIcon = kpi.trend === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-[#294050]/10 dark:bg-[#294050]/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-[#294050] dark:text-[#F09988]" />
        </div>
        {kpi.change !== null && (
          <div
            className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              kpi.trend === 'up'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : kpi.trend === 'down'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {kpi.trend !== 'neutral' && <TrendIcon className="w-3 h-3 mr-1" />}
            {Math.abs(kpi.change)}%
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-[#9FB4BE]">{kpi.label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
        {kpi.value}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {kpi.changeLabel}
      </p>
    </div>
  )
}

/** Dropdown menu for selecting an analytics time period with active state highlighting */
const TimePeriodDropdown: React.FC<{
  timePeriods: { value: TimePeriod; label: string }[]
  current: TimePeriod
  show: boolean
  onToggle: () => void
  onSelect: (value: TimePeriod) => void
}> = ({ timePeriods, current, show, onToggle, onSelect }) => {
  const handleSelect = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const value = e.currentTarget.dataset.value as TimePeriod
      onSelect(value)
    },
    [onSelect]
  )

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center"
      >
        <Calendar className="w-4 h-4 mr-2" />
        {timePeriods.find(p => p.value === current)?.label}
        <ChevronDown className="w-4 h-4 ml-2" />
      </button>
      {show && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
          {timePeriods.map(period => (
            <button
              key={period.value}
              data-value={period.value}
              onClick={handleSelect}
              className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg ${
                current === period.value
                  ? 'text-[#294050] dark:text-[#F09988] bg-[#294050]/10 dark:bg-[#294050]/20'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Portfolio performance chart — shows real data or empty state */
const PortfolioPerformanceChart: React.FC<{
  hasData: boolean
}> = ({ hasData }) => {
  if (!hasData) {
    return (
      <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <Activity className="w-5 h-5 text-[#294050] mr-2" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Portfolio Performance
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
              Total value over time
            </p>
          </div>
        </div>
        <EmptyState
          icon={<Activity className="w-12 h-12" />}
          title="No performance data yet"
          message="Connect a wallet and sync transactions to see portfolio performance over time."
        />
      </div>
    )
  }

  return (
    <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Activity className="w-5 h-5 text-[#294050] mr-2" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Portfolio Performance
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
              Total value over time
            </p>
          </div>
        </div>
      </div>
      <div className="h-64 flex items-center justify-center text-sm text-gray-500 dark:text-[#9FB4BE]">
        <p>
          Historical portfolio data will appear here as transactions are synced.
        </p>
      </div>
    </div>
  )
}

/** Donut chart with color-coded legend showing asset allocation by cryptocurrency */
const AssetAllocationChart: React.FC<{
  assetAllocation: {
    name: string
    value: number
    amount: number
    color: string
  }[]
}> = ({ assetAllocation }) => {
  if (assetAllocation.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <PieChart className="w-5 h-5 text-[#294050] mr-2" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Asset Allocation
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
              Holdings by cryptocurrency
            </p>
          </div>
        </div>
        <EmptyState
          icon={<PieChart className="w-12 h-12" />}
          title="No holdings data"
          message="Connect a wallet to see your asset allocation breakdown."
        />
      </div>
    )
  }

  // Build donut chart from real allocation data
  const circumference = 2 * Math.PI * 80 // ~503

  // Precompute cumulative offsets (pure, no mutation in render scope)
  const donutSegments = assetAllocation.map((asset, i) => {
    const dashLength = (asset.value / 100) * circumference
    const dashOffset = assetAllocation
      .slice(0, i)
      .reduce((sum, a) => sum + (a.value / 100) * circumference, 0)
    return { ...asset, dashLength, dashOffset }
  })

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-6">
        <PieChart className="w-5 h-5 text-[#294050] mr-2" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Asset Allocation
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
            Holdings by cryptocurrency
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center mb-6">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {donutSegments.map(segment => (
            <circle
              key={segment.name}
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={segment.color}
              strokeWidth="40"
              strokeDasharray={`${segment.dashLength} ${circumference}`}
              strokeDashoffset={-segment.dashOffset}
              transform="rotate(-90 100 100)"
            />
          ))}
        </svg>
      </div>

      <div className="space-y-3">
        {assetAllocation.map(asset => (
          <div key={asset.name} className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: asset.color }}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {asset.name}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {asset.value}%
              </div>
              <div className="text-xs text-gray-500 dark:text-[#9FB4BE]">
                ${asset.amount.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Transaction volume bar chart from real transaction counts */
const TransactionVolumeChart: React.FC<{
  transactions: StoredTransaction[]
}> = ({ transactions }) => {
  // Group transactions by day of the week for the past 7 days
  const dailyCounts = useMemo(() => {
    const now = new Date()
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const counts = new Array<number>(7).fill(0)

    for (const tx of transactions) {
      if (!tx.timestamp) continue
      const txDate = new Date(tx.timestamp)
      const diffDays = Math.floor(
        (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diffDays >= 0 && diffDays < 7) {
        const dayIndex = txDate.getDay()
        // JS getDay: 0=Sun, map to Mon=0 ... Sun=6
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
        counts[adjustedIndex]++
      }
    }

    const maxCount = Math.max(...counts, 1)
    return days.map((day, i) => ({
      day,
      count: counts[i],
      height: Math.max((counts[i] / maxCount) * 100, counts[i] > 0 ? 5 : 0),
    }))
  }, [transactions])

  const totalThisWeek = dailyCounts.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-6">
        <BarChart3 className="w-5 h-5 text-[#294050] mr-2" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transaction Volume
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
            Daily transaction activity
          </p>
        </div>
      </div>

      {totalThisWeek === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-12 h-12" />}
          title="No recent transactions"
          message="Transaction volume will appear here after syncing wallet data."
        />
      ) : (
        <>
          <div className="h-48 flex items-end justify-between gap-2">
            {dailyCounts.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-[#294050] dark:bg-[#294050] rounded-t hover:bg-[#294050] dark:hover:bg-[#294050] transition-colors cursor-pointer"
                  style={{ height: `${d.height}%` }}
                />
                <span className="text-xs text-gray-500 dark:text-[#9FB4BE] mt-2">
                  {d.day}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-[#9FB4BE]">
                Total this week
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {totalThisWeek} transaction{totalThisWeek === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Revenue vs Expenses chart from real classified transactions */
const RevenueExpensesChart: React.FC<{
  transactions: StoredTransaction[]
  formatCurrencyValue: (amount: number) => string
}> = ({ transactions, formatCurrencyValue }) => {
  // Group by month (last 5 months)
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { name: string; revenue: number; expense: number }[] = []

    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = d.toLocaleDateString('en-US', { month: 'short' })
      const monthStart = d.getTime()
      const monthEnd = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0,
        23,
        59,
        59
      ).getTime()

      let revenue = 0
      let expense = 0

      for (const tx of transactions) {
        if (!tx.timestamp) continue
        const txTime = new Date(tx.timestamp).getTime()
        if (txTime < monthStart || txTime > monthEnd) continue

        const amount = tx.value
          ? Math.abs(Number(tx.value) / Math.pow(10, tx.token_decimals ?? 18))
          : 0
        const usdPrice = tx.price_at_acquisition_usd
          ? Number(tx.price_at_acquisition_usd)
          : 0
        const usdAmount = amount * usdPrice

        if (tx.tx_type === 'expense') {
          expense += usdAmount
        } else {
          revenue += usdAmount
        }
      }

      months.push({ name: monthName, revenue, expense })
    }
    return months
  }, [transactions])

  const maxVal = Math.max(
    ...monthlyData.map(m => Math.max(m.revenue, m.expense)),
    1
  )
  const hasAnyData = monthlyData.some(m => m.revenue > 0 || m.expense > 0)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-6">
        <DollarSign className="w-5 h-5 text-[#294050] mr-2" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Revenue vs Expenses
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
            Monthly comparison
          </p>
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon={<DollarSign className="w-12 h-12" />}
          title="No classified transactions"
          message="Revenue and expense data will appear after transactions are synced and classified."
        />
      ) : (
        <>
          <div className="h-48 flex items-end justify-between gap-3">
            {monthlyData.map(data => (
              <div
                key={data.name}
                className="flex-1 flex flex-col items-center"
              >
                <div className="w-full flex gap-1 items-end h-full">
                  <div
                    className="flex-1 bg-green-500 dark:bg-green-600 rounded-t"
                    style={{ height: `${(data.revenue / maxVal) * 100}%` }}
                    title={`Revenue: ${formatCurrencyValue(data.revenue)}`}
                  />
                  <div
                    className="flex-1 bg-red-500 dark:bg-red-600 rounded-t"
                    style={{ height: `${(data.expense / maxVal) * 100}%` }}
                    title={`Expenses: ${formatCurrencyValue(data.expense)}`}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-[#9FB4BE] mt-2">
                  {data.name}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2" />
              <span className="text-xs text-gray-500 dark:text-[#9FB4BE]">
                Revenue
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded mr-2" />
              <span className="text-xs text-gray-500 dark:text-[#9FB4BE]">
                Expenses
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Brand colors for common crypto tokens */
const TOKEN_COLORS: Record<string, string> = {
  DOT: '#E6007A',
  KSM: '#000000',
  GLMR: '#53CBC8',
  MOVR: '#53CBC8',
  ASTR: '#0081FF',
  ETH: '#627EEA',
  BTC: '#F7931A',
  USDC: '#2775CA',
  USDT: '#26A17B',
}

/** Get a color for a token, falling back to a hash-based color */
function getTokenColor(symbol: string): string {
  return TOKEN_COLORS[symbol.toUpperCase()] ?? '#8B5CF6'
}

/** Analytics dashboard page with KPI cards, portfolio performance chart, and asset allocation */
const Analytics: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const { settings: currencySettings } = useCurrency()
  const { currentProfile } = useProfile()
  const { balances, wallets, isLoading: walletsLoading } = useWalletBalances()
  const [allTransactions, setAllTransactions] = useState<StoredTransaction[]>(
    []
  )
  const [txLoading, setTxLoading] = useState(true)

  const timePeriods: { value: TimePeriod; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
    { value: 'all', label: 'All time' },
  ]

  // Load all transactions for analytics
  useEffect(() => {
    let cancelled = false
    /**
     * Loads transactions for the current profile and updates component state.
     *
     * @returns {Promise<void>} Promise that resolves after loading transactions and updating state.
     */
    const load = async () => {
      if (!currentProfile) {
        setAllTransactions([])
        setTxLoading(false)
        return
      }
      try {
        const stored = await persistence.getAllTransactions(currentProfile.id)
        if (!cancelled) setAllTransactions(stored)
      } catch {
        if (!cancelled) setAllTransactions([])
      } finally {
        if (!cancelled) setTxLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [currentProfile])

  // Compute total portfolio value from real balances
  const totalPortfolioValue = useMemo(() => {
    if (!balances) return 0
    return balances.reduce((sum, wb) => sum + (wb.total_value_usd ?? 0), 0)
  }, [balances])

  // Compute crypto holdings value (total minus stablecoins would be ideal, but for now use total)
  const cryptoHoldingsValue = useMemo(() => {
    if (!balances) return 0
    return balances.reduce((sum, wb) => {
      let walletTotal = wb.native_balance.value_usd ?? 0
      for (const tb of wb.token_balances) {
        walletTotal += tb.value_usd ?? 0
      }
      return sum + walletTotal
    }, 0)
  }, [balances])

  // Compute asset allocation from real balances
  const assetAllocation = useMemo(() => {
    if (!balances || balances.length === 0) return []

    const aggregated = new Map<string, number>()
    for (const wb of balances) {
      const nativeSymbol = wb.native_balance.symbol.toUpperCase()
      const nativeUsd = wb.native_balance.value_usd ?? 0
      aggregated.set(
        nativeSymbol,
        (aggregated.get(nativeSymbol) ?? 0) + nativeUsd
      )
      for (const tb of wb.token_balances) {
        const symbol = tb.symbol.toUpperCase()
        const usd = tb.value_usd ?? 0
        aggregated.set(symbol, (aggregated.get(symbol) ?? 0) + usd)
      }
    }

    const entries = Array.from(aggregated.entries())
      .filter(([, usd]) => usd > 0)
      .sort((a, b) => b[1] - a[1])

    const total = entries.reduce((s, [, v]) => s + v, 0)
    if (total === 0) return []

    // Show top 4, group rest as Others
    const top = entries.slice(0, 4)
    const othersValue = entries.slice(4).reduce((s, [, v]) => s + v, 0)

    const result = top.map(([name, amount]) => ({
      name,
      value: Math.round((amount / total) * 100),
      amount: Math.round(amount),
      color: getTokenColor(name),
    }))

    if (othersValue > 0) {
      result.push({
        name: 'Others',
        value: Math.round((othersValue / total) * 100),
        amount: Math.round(othersValue),
        color: '#8B5CF6',
      })
    }

    return result
  }, [balances])

  // Filter transactions by time period
  const filteredTransactions = useMemo(() => {
    if (timePeriod === 'all') return allTransactions
    const periodMs: Record<string, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    }
    const cutoff = new Date().getTime() - (periodMs[timePeriod] ?? 0)
    return allTransactions.filter(tx => {
      if (!tx.timestamp) return false
      return new Date(tx.timestamp).getTime() >= cutoff
    })
  }, [allTransactions, timePeriod])

  // Build KPIs from real data
  const kpis = useMemo((): KPI[] => {
    const hasWallets = wallets.length > 0

    /**
     * Formats a number as currency using the application's currency settings.
     * @param v The numeric value to format.
     * @returns The formatted currency string.
     */
    const fmtCurrency = (v: number) =>
      formatCurrency(v, currencySettings.primaryCurrency, {
        decimalPlaces: currencySettings.decimalPlaces,
        useThousandsSeparator: currencySettings.useThousandsSeparator,
        decimalSeparatorStandard: currencySettings.decimalSeparatorStandard,
      })

    return [
      {
        id: 'total-value',
        label: 'Total Portfolio Value',
        value: hasWallets ? fmtCurrency(totalPortfolioValue) : '—',
        change: null,
        changeLabel: hasWallets
          ? `${wallets.length} wallet${wallets.length === 1 ? '' : 's'} connected`
          : 'No wallets connected',
        icon: DollarSign,
        trend: 'neutral',
      },
      {
        id: 'crypto-holdings',
        label: 'Crypto Holdings',
        value: hasWallets ? fmtCurrency(cryptoHoldingsValue) : '—',
        change: null,
        changeLabel: hasWallets
          ? `${assetAllocation.length} asset${assetAllocation.length === 1 ? '' : 's'}`
          : 'No holdings',
        icon: Coins,
        trend: 'neutral',
      },
      {
        id: 'transactions',
        label: 'Transactions',
        value: String(filteredTransactions.length),
        change: null,
        changeLabel:
          filteredTransactions.length > 0
            ? 'In selected period'
            : 'No transactions in period',
        icon: TrendingUp,
        trend: 'neutral',
      },
      {
        id: 'wallets',
        label: 'Active Wallets',
        value: String(wallets.length),
        change: null,
        changeLabel:
          wallets.length > 0
            ? 'Tracked & connected'
            : 'Add a wallet to get started',
        icon: BarChart3,
        trend: 'neutral',
      },
    ]
  }, [
    wallets,
    totalPortfolioValue,
    cryptoHoldingsValue,
    assetAllocation,
    filteredTransactions,
    currencySettings,
  ])

  const handleTogglePeriodDropdown = useCallback(() => {
    setShowPeriodDropdown(!showPeriodDropdown)
  }, [showPeriodDropdown])

  const handleSelectPeriod = useCallback((value: TimePeriod) => {
    setTimePeriod(value)
    setShowPeriodDropdown(false)
  }, [])

  const formatCurrencyValue = useCallback(
    (amount: number) =>
      formatCurrency(amount, currencySettings.primaryCurrency, {
        decimalPlaces: currencySettings.decimalPlaces,
        useThousandsSeparator: currencySettings.useThousandsSeparator,
        decimalSeparatorStandard: currencySettings.decimalSeparatorStandard,
      }),
    [currencySettings]
  )

  const isLoading = walletsLoading || txLoading
  const hasData = wallets.length > 0

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1>Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-[#9FB4BE] mt-1">
                Performance insights and data visualization
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <TimePeriodDropdown
                timePeriods={timePeriods}
                current={timePeriod}
                show={showPeriodDropdown}
                onToggle={handleTogglePeriodDropdown}
                onSelect={handleSelectPeriod}
              />
              <button className="p-2 text-gray-600 dark:text-[#9FB4BE] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 dark:text-[#9FB4BE] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 dark:text-[#9FB4BE] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map(kpi => (
            <KPICard key={kpi.id} kpi={kpi} />
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Performance - Large Chart */}
          <PortfolioPerformanceChart hasData={hasData && !isLoading} />

          {/* Asset Allocation - Pie Chart */}
          <AssetAllocationChart assetAllocation={assetAllocation} />

          {/* Transaction Volume - Bar Chart */}
          <TransactionVolumeChart transactions={filteredTransactions} />

          {/* Staking Rewards — Coming Soon (no backend exists) */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Target className="w-5 h-5 text-[#294050] mr-2" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Staking Rewards
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
                    Rewards earned over time
                  </p>
                </div>
              </div>
            </div>
            <EmptyState
              icon={<Target className="w-12 h-12" />}
              title="Coming soon"
              message="Staking reward tracking is not yet available. This feature will be added in a future update."
            />
          </div>

          {/* Revenue vs Expenses */}
          <RevenueExpensesChart
            transactions={filteredTransactions}
            formatCurrencyValue={formatCurrencyValue}
          />
        </div>
      </div>
    </div>
  )
}

export default Analytics
