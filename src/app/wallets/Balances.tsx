import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Wallet } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subYears,
} from 'date-fns'
import { useTheme } from '../../contexts/ThemeContext'
import { useWalletBalances } from '../../hooks/useWalletBalances'
import type { WalletBalances as ChainWalletBalances } from '../../types/chains'
import {
  getCurrentPrices,
  getCoinGeckoId,
} from '../../services/blockchain/priceService'
import {
  indexedDBService,
  type BalanceSnapshot,
} from '../../services/database/indexedDBService'

interface WalletBalance {
  id: string
  name: string
  address: string
  blockchain: string
  balances: {
    [crypto: string]: {
      amount: number
      usdValue: number
    }
  }
  totalUsdValue: number
}

interface ChartDataPoint {
  date: string
  [key: string]: number | string
}

type TimePeriod =
  | 'this_month'
  | 'last_month'
  | '30_days'
  | '90_days'
  | 'one_year'
  | 'this_year'
  | 'last_year'

const DEFAULT_CURRENCY_COLORS: Record<string, string> = {
  DOT: '#E6007A',
  KSM: '#000000',
  GLMR: '#53CBC8',
  ASTR: '#0081FF',
  BNC: '#5A25F0',
  iBTC: '#F7931A',
  USDC: '#2775CA',
  USDT: '#26A17B',
  MOVR: '#F2B705',
  ACA: '#645AFF',
  ETH: '#627EEA',
  BTC: '#F7931A',
}

/** Generate a deterministic color from a string */
function hashColor(str: string): string {
  let hash = 0
  for (let index = 0; index < str.length; index++) {
    hash = str.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 50%)`
}

/** Get color for a currency symbol, using defaults or hash-based fallback */
function getCurrencyColor(symbol: string): string {
  return DEFAULT_CURRENCY_COLORS[symbol] || hashColor(symbol)
}

/** Convert raw balance string to a human-readable number */
function parseBalance(balance: string, decimals: number): number {
  const raw = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const whole = raw / divisor
  const remainder = raw % divisor
  const decimal = Number(remainder) / Number(divisor)
  return Number(whole) + decimal
}

/** Transform chain WalletBalances[] into view-model WalletBalance[] */
function transformBalances(
  chainBalances: ChainWalletBalances[],
  walletMeta: Map<string, { name: string; blockchain: string }>,
  prices: Record<string, number>
): WalletBalance[] {
  return chainBalances.map((wb, index) => {
    const key = `${wb.chain_id}:${wb.address}`
    const meta = walletMeta.get(key)
    const balances: WalletBalance['balances'] = {}

    // Native balance
    const nativeAmount = parseBalance(wb.native_balance.balance, wb.native_balance.decimals)
    const nativeSymbol = wb.native_balance.symbol
    let nativeUsd = wb.native_balance.value_usd ?? 0
    if (!nativeUsd && nativeAmount > 0) {
      const coinId = getCoinGeckoId(nativeSymbol)
      if (coinId && prices[coinId]) {
        nativeUsd = nativeAmount * prices[coinId]
      }
    }
    if (nativeAmount > 0) {
      balances[nativeSymbol] = { amount: nativeAmount, usdValue: nativeUsd }
    }

    // Token balances
    for (const token of wb.token_balances) {
      const amount = parseBalance(token.balance, token.decimals)
      let usd = token.value_usd ?? 0
      if (!usd && amount > 0) {
        const coinId = getCoinGeckoId(token.symbol)
        if (coinId && prices[coinId]) {
          usd = amount * prices[coinId]
        }
      }
      if (amount > 0) {
        balances[token.symbol] = { amount, usdValue: usd }
      }
    }

    const totalUsdValue = Object.values(balances).reduce((sum, b) => sum + b.usdValue, 0)

    return {
      id: `${wb.chain_id}-${index}`,
      name: meta?.name || `${wb.chain_id} Wallet`,
      address: wb.address,
      blockchain: meta?.blockchain || wb.chain_id,
      balances,
      totalUsdValue,
    }
  })
}

/** Truncate an address for display */
function truncateAddress(address: string): string {
  if (address.length <= 16) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

const SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000 // 1 hour

/** Save a balance snapshot if enough time has passed since the last one */
async function maybeSaveSnapshot(walletBalances: WalletBalance[]): Promise<void> {
  try {
    const latest = await indexedDBService.getLatestBalanceSnapshot()
    if (latest && Date.now() - latest.timestamp < SNAPSHOT_THROTTLE_MS) {
      return
    }

    const balances: BalanceSnapshot['balances'] = {}
    for (const wallet of walletBalances) {
      for (const [symbol, data] of Object.entries(wallet.balances)) {
        if (balances[symbol]) {
          balances[symbol].amount += data.amount
          balances[symbol].usdValue += data.usdValue
        } else {
          balances[symbol] = { amount: data.amount, usdValue: data.usdValue }
        }
      }
    }

    const totalUsdValue = Object.values(balances).reduce((sum, b) => sum + b.usdValue, 0)

    await indexedDBService.saveBalanceSnapshot({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      balances,
      totalUsdValue,
    })
  } catch (err) {
    console.error('[Balances] Failed to save snapshot:', err)
  }
}

/** SVG linear gradient definitions for the stacked area chart, one per currency */
const ChartGradients = ({
  currencyColors,
}: {
  currencyColors: { [key: string]: string }
}) => (
  <>
    {Object.keys(currencyColors).map(currency => (
      <linearGradient
        key={currency}
        id={`color${currency}`}
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="5%"
          stopColor={currencyColors[currency]}
          stopOpacity={0.8}
        />
        <stop
          offset="95%"
          stopColor={currencyColors[currency]}
          stopOpacity={0.1}
        />
      </linearGradient>
    ))}
  </>
)

/** Stacked area chart showing wallet balance history over time by currency */
const WalletBalanceChart = ({
  chartData,
  currencyColors,
  formatYAxisTick,
  formatCurrency,
}: {
  chartData: { date: string; [key: string]: string | number }[]
  currencyColors: { [key: string]: string }
  formatYAxisTick: (value: number) => string
  formatCurrency: (value: number) => string
}) => {
  const tooltipFormatter = useCallback(
    (value: number) => formatCurrency(value),
    [formatCurrency]
  )

  const renderArea = useCallback(
    (currency: string) => (
      <Area
        key={currency}
        type="monotone"
        dataKey={currency}
        stackId="1"
        stroke={currencyColors[currency]}
        fillOpacity={1}
        fill={`url(#color${currency})`}
      />
    ),
    [currencyColors]
  )

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={chartData}>
        <defs>
          <ChartGradients currencyColors={currencyColors} />
        </defs>
        <XAxis dataKey="date" stroke="#888888" />
        <YAxis tickFormatter={formatYAxisTick} />
        {Object.keys(currencyColors).map(currency => renderArea(currency))}
        <Tooltip
          formatter={tooltipFormatter}
          contentStyle={{ backgroundColor: '#1F2937' }}
          itemStyle={{ color: '#f9fafb' }}
          labelStyle={{ color: '#e5e7eb' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface PortfolioSummaryProps {
  totalPortfolioValue: number
  walletCount: number
  formatCurrency: (value: number) => string
  isLoading: boolean
}

/** Portfolio summary card showing total value and wallet count */
const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  totalPortfolioValue,
  walletCount,
  formatCurrency,
  isLoading,
}) => (
  <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6 mb-8">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[#696557] dark:text-[#b8b3ac]">
          Total Portfolio Value
        </p>
        {isLoading ? (
          <div className="h-9 w-48 bg-[#f3f1ed] dark:bg-[#1a1815] rounded animate-pulse mt-2" />
        ) : (
          <p className="text-3xl font-semibold text-[#1a1815] dark:text-[#f5f3f0] mt-2">
            {formatCurrency(totalPortfolioValue)}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-[#696557] dark:text-[#b8b3ac]">
          Active Wallets
        </p>
        <p className="text-2xl font-semibold text-[#1a1815] dark:text-[#f5f3f0] mt-2">
          {walletCount}
        </p>
      </div>
    </div>
  </div>
)

interface BalanceHistorySectionProps {
  selectedPeriod: TimePeriod
  timePeriodOptions: { value: TimePeriod; label: string }[]
  handlePeriodChange: (event: React.MouseEvent<HTMLButtonElement>) => void
  chartData: ChartDataPoint[]
  currencyColors: { [key: string]: string }
  formatYAxisTick: (value: number) => string
  formatCurrency: (value: number) => string
  hasEnoughData: boolean
}

/** Balance history chart section with time period selector buttons and stacked area chart */
const BalanceHistorySection: React.FC<BalanceHistorySectionProps> = ({
  selectedPeriod,
  timePeriodOptions,
  handlePeriodChange,
  chartData,
  currencyColors,
  formatYAxisTick,
  formatCurrency,
  hasEnoughData,
}) => (
  <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] mb-8">
    <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
          Balance History
        </h2>
        <div className="flex flex-wrap gap-2">
          {timePeriodOptions.map(option => (
            <button
              key={option.value}
              data-period={option.value}
              onClick={handlePeriodChange}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedPeriod === option.value
                  ? 'bg-[#8b4e52] text-white'
                  : 'bg-[#f3f1ed] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] hover:bg-[#ede8e0] dark:hover:bg-[#2a2620]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
    <div className="p-6">
      {hasEnoughData ? (
        <WalletBalanceChart
          chartData={chartData}
          currencyColors={currencyColors}
          formatYAxisTick={formatYAxisTick}
          formatCurrency={formatCurrency}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-[#696557] dark:text-[#b8b3ac] text-lg font-medium">
            Insufficient History
          </p>
          <p className="text-[#696557] dark:text-[#b8b3ac] text-sm mt-2 max-w-md">
            Balance snapshots are recorded each time you visit this page (at most once per hour).
            The chart will populate as data accumulates over time.
          </p>
        </div>
      )}
    </div>
  </div>
)

/** Loading skeleton for a wallet card */
const WalletCardSkeleton: React.FC = () => (
  <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-5 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-5 w-40 bg-[#f3f1ed] dark:bg-[#1a1815] rounded" />
      <div className="h-4 w-20 bg-[#f3f1ed] dark:bg-[#1a1815] rounded" />
    </div>
    <div className="h-4 w-32 bg-[#f3f1ed] dark:bg-[#1a1815] rounded mb-3" />
    <div className="space-y-2">
      <div className="h-4 w-full bg-[#f3f1ed] dark:bg-[#1a1815] rounded" />
      <div className="h-4 w-3/4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded" />
    </div>
  </div>
)

/** Per-wallet breakdown card */
const WalletCard: React.FC<{
  wallet: WalletBalance
  formatCurrency: (value: number) => string
}> = ({ wallet, formatCurrency }) => (
  <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-5">
    <div className="flex items-center justify-between mb-1">
      <h3 className="text-base font-semibold text-[#1a1815] dark:text-[#f5f3f0] truncate mr-2">
        {wallet.name}
      </h3>
      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#f3f1ed] dark:bg-[#1a1815] text-[#696557] dark:text-[#b8b3ac] whitespace-nowrap">
        {wallet.blockchain}
      </span>
    </div>
    <p className="text-xs text-[#696557] dark:text-[#b8b3ac] font-mono mb-3">
      {truncateAddress(wallet.address)}
    </p>
    <div className="space-y-2">
      {Object.entries(wallet.balances).map(([symbol, data]) => (
        <div key={symbol} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: getCurrencyColor(symbol) }}
            />
            <span className="text-sm text-[#1a1815] dark:text-[#f5f3f0]">
              {data.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {symbol}
            </span>
          </div>
          <span className="text-sm font-medium text-[#696557] dark:text-[#b8b3ac]">
            {formatCurrency(data.usdValue)}
          </span>
        </div>
      ))}
    </div>
    <div className="mt-3 pt-3 border-t border-[rgba(201,169,97,0.1)] flex justify-between">
      <span className="text-sm font-medium text-[#696557] dark:text-[#b8b3ac]">Total</span>
      <span className="text-sm font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
        {formatCurrency(wallet.totalUsdValue)}
      </span>
    </div>
  </div>
)

/** Get the date range for a time period */
function getPeriodRange(period: TimePeriod): { from: number; to: number } {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'this_month':
      startDate = startOfMonth(now)
      break
    case 'last_month': {
      const lastMonth = subMonths(now, 1)
      startDate = startOfMonth(lastMonth)
      return { from: startDate.getTime(), to: endOfMonth(lastMonth).getTime() }
    }
    case '30_days':
      startDate = subDays(now, 30)
      break
    case '90_days':
      startDate = subDays(now, 90)
      break
    case 'one_year':
      startDate = subDays(now, 365)
      break
    case 'this_year':
      startDate = startOfYear(now)
      break
    case 'last_year': {
      const lastYear = subYears(now, 1)
      startDate = startOfYear(lastYear)
      return { from: startDate.getTime(), to: startOfYear(now).getTime() }
    }
    default:
      startDate = subDays(now, 30)
  }

  return { from: startDate.getTime(), to: now.getTime() }
}

/** Convert snapshots to chart data points */
function snapshotsToChartData(
  snapshots: BalanceSnapshot[],
  period: TimePeriod
): ChartDataPoint[] {
  const useLongFormat =
    period.includes('year') || period === '90_days'
  const dateFormat = useLongFormat ? 'MMM yyyy' : 'MMM d'

  return snapshots.map(s => {
    const point: ChartDataPoint = { date: format(new Date(s.timestamp), dateFormat) }
    for (const [symbol, data] of Object.entries(s.balances)) {
      point[symbol] = Math.round(data.usdValue)
    }
    return point
  })
}

/** Page header with refresh and connect wallet buttons */
const BalancesHeader: React.FC<{
  hasWallets: boolean
  isLoading: boolean
  onRefresh: () => void
  onConnectWallet: () => void
}> = ({ hasWallets, isLoading, onRefresh, onConnectWallet }) => (
  <header className="bg-[#fafaf8] dark:bg-[#0f0e0c] border-b border-[rgba(201,169,97,0.15)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1>Wallet Balances</h1>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
            Track your cryptocurrency holdings across all wallets
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {hasWallets && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-[#696557] dark:text-[#b8b3ac] bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] disabled:opacity-50 flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={onConnectWallet}
            className="px-4 py-2 text-sm font-medium text-white bg-[#8b4e52] rounded-lg hover:bg-[#7a4248] flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  </header>
)

/** Wallet balances page displaying portfolio value, balance history chart, and per-wallet breakdowns */
const Balances: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30_days')
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  useTheme()
  const navigate = useNavigate()

  const { wallets: walletAddresses, balances, walletMeta, isLoading, error, refetch } =
    useWalletBalances()

  // Fetch current prices for symbols that need them
  useEffect(() => {
    if (!balances || balances.length === 0) return

    const coinIds = new Set<string>()
    for (const wb of balances) {
      const nativeId = getCoinGeckoId(wb.native_balance.symbol)
      if (nativeId && !wb.native_balance.value_usd) coinIds.add(nativeId)
      for (const token of wb.token_balances) {
        const tokenId = getCoinGeckoId(token.symbol)
        if (tokenId && !token.value_usd) coinIds.add(tokenId)
      }
    }

    if (coinIds.size === 0) return

    getCurrentPrices(Array.from(coinIds))
      .then(setPrices)
      .catch(err => console.error('[Balances] Failed to fetch prices:', err))
  }, [balances])

  // Transform chain balances to view model
  const walletBalances = useMemo(() => {
    if (!balances) return []
    return transformBalances(balances, walletMeta, prices)
  }, [balances, walletMeta, prices])

  // Save snapshot on successful fetch (throttled)
  useEffect(() => {
    if (walletBalances.length > 0) {
      maybeSaveSnapshot(walletBalances).catch(() => undefined)
    }
  }, [walletBalances])

  // Load chart snapshots for the selected period
  useEffect(() => {
    const { from, to } = getPeriodRange(selectedPeriod)
    indexedDBService
      .getBalanceSnapshots(from, to)
      .then(setSnapshots)
      .catch(err => console.error('[Balances] Failed to load snapshots:', err))
  }, [selectedPeriod, walletBalances])

  const chartData = useMemo(
    () => snapshotsToChartData(snapshots, selectedPeriod),
    [snapshots, selectedPeriod]
  )

  const hasEnoughData = snapshots.length >= 2

  // Build currency colors map from actual data
  const currencyColors = useMemo(() => {
    const colors: Record<string, string> = {}
    // From current wallet balances
    for (const wallet of walletBalances) {
      for (const symbol of Object.keys(wallet.balances)) {
        if (!colors[symbol]) colors[symbol] = getCurrencyColor(symbol)
      }
    }
    // From chart snapshots (may include symbols no longer held)
    for (const snap of snapshots) {
      for (const symbol of Object.keys(snap.balances)) {
        if (!colors[symbol]) colors[symbol] = getCurrencyColor(symbol)
      }
    }
    return colors
  }, [walletBalances, snapshots])

  const totalPortfolioValue = useMemo(
    () => walletBalances.reduce((sum, w) => sum + w.totalUsdValue, 0),
    [walletBalances]
  )

  const timePeriodOptions: { value: TimePeriod; label: string }[] = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: '30_days', label: '30 Days' },
    { value: '90_days', label: '90 Days' },
    { value: 'one_year', label: 'One Year' },
    { value: 'this_year', label: 'This Year' },
    { value: 'last_year', label: 'Last Year' },
  ]

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }, [])

  const formatYAxisTick = useCallback(
    (value: number) => `$${(value / 1000).toFixed(0)}k`,
    []
  )

  const handlePeriodChange = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const period = event.currentTarget.dataset.period as TimePeriod
      setSelectedPeriod(period)
    },
    []
  )

  const handleConnectWallet = useCallback(() => {
    navigate('/wallet-manager')
  }, [navigate])

  const handleRefresh = useCallback(() => {
    refetch().catch(() => undefined)
  }, [refetch])

  const hasWallets = walletAddresses.length > 0

  return (
    <div className="min-h-screen ledger-background">
      <BalancesHeader
        hasWallets={hasWallets}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onConnectWallet={handleConnectWallet}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-sm text-red-700 dark:text-red-400">
              Failed to fetch balances: {error.message}
            </p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state — no wallets at all */}
        {!hasWallets && !isLoading && (
          <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-12 text-center mb-8">
            <Wallet className="w-12 h-12 text-[#b8b3ac] dark:text-[#696557] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
              No Wallets Connected
            </h2>
            <p className="text-[#696557] dark:text-[#b8b3ac] mb-6 max-w-md mx-auto">
              Connect a wallet or add a tracked address to start monitoring your portfolio balances.
            </p>
            <button
              onClick={handleConnectWallet}
              className="px-6 py-3 text-sm font-medium text-white bg-[#8b4e52] rounded-lg hover:bg-[#7a4248] inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Connect Wallet
            </button>
          </div>
        )}

        {/* Portfolio content */}
        {(hasWallets || isLoading) && (
          <>
            {/* Portfolio Summary */}
            <PortfolioSummary
              totalPortfolioValue={totalPortfolioValue}
              walletCount={walletAddresses.length}
              formatCurrency={formatCurrency}
              isLoading={isLoading}
            />

            {/* Stacked Area Chart */}
            <BalanceHistorySection
              selectedPeriod={selectedPeriod}
              timePeriodOptions={timePeriodOptions}
              handlePeriodChange={handlePeriodChange}
              chartData={chartData}
              currencyColors={currencyColors}
              formatYAxisTick={formatYAxisTick}
              formatCurrency={formatCurrency}
              hasEnoughData={hasEnoughData}
            />

            {/* Per-Wallet Breakdown */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
                Wallet Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && walletBalances.length === 0 ? (
                  <>
                    <WalletCardSkeleton />
                    <WalletCardSkeleton />
                    <WalletCardSkeleton />
                  </>
                ) : (
                  walletBalances.map(wallet => (
                    <WalletCard
                      key={wallet.id}
                      wallet={wallet}
                      formatCurrency={formatCurrency}
                    />
                  ))
                )}
              </div>
              {!isLoading && walletBalances.length === 0 && hasWallets && (
                <p className="text-center text-[#696557] dark:text-[#b8b3ac] py-8">
                  Connect wallets to see balances
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default Balances
