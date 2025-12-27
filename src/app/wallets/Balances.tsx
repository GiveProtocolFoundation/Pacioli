import React, { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
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

interface WalletBalance {
  id: string
  name: string
  address: string
  blockchain: string
  balances: {
    [crypto: string]: {
      amount: number
      usdValue: number
      change24h: number
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

const Balances: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30_days')
  useTheme() // Hook called for potential side effects
  const navigate = useNavigate()

  const handleConnectWallet = useCallback(() => {
    navigate('/wallet-manager')
  }, [navigate])

  // Mock wallet data
  const [wallets] = useState<WalletBalance[]>([
    {
      id: '1',
      name: 'Polkadot Main Wallet',
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      blockchain: 'Polkadot',
      balances: {
        DOT: { amount: 850, usdValue: 6375, change24h: 2.3 },
        USDC: { amount: 5000, usdValue: 5000, change24h: 0.0 },
      },
      totalUsdValue: 11375,
    },
    {
      id: '2',
      name: 'Kusama Treasury',
      address: 'FcjmeNzPk3vgdENm1rHeiMCxFK96beUoi2kb59FmCoZtkGF',
      blockchain: 'Kusama',
      balances: {
        KSM: { amount: 185.3, usdValue: 8338.5, change24h: -1.2 },
      },
      totalUsdValue: 8338.5,
    },
    {
      id: '3',
      name: 'Moonbeam Operations',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      blockchain: 'Moonbeam',
      balances: {
        GLMR: { amount: 45000, usdValue: 13500, change24h: 3.4 },
        DOT: { amount: 200.5, usdValue: 1503.75, change24h: 2.3 },
      },
      totalUsdValue: 15003.75,
    },
    {
      id: '4',
      name: 'Astar Parachain',
      address: 'YQnbw3oWxBB2X6CJbE4XKvxN3FxZ4aXPn9xk3a5BvqjKJxY',
      blockchain: 'Astar',
      balances: {
        ASTR: { amount: 125000, usdValue: 8750, change24h: 1.8 },
      },
      totalUsdValue: 8750,
    },
    {
      id: '5',
      name: 'Bifrost Liquidity',
      address: 'eCSrvbA5gGNQr7VZ48fkCX5vkt1H16F8Np9g2hYssRXHVJF',
      blockchain: 'Bifrost',
      balances: {
        BNC: { amount: 8500, usdValue: 2550, change24h: 0.9 },
        DOT: { amount: 200, usdValue: 1500, change24h: 2.3 },
      },
      totalUsdValue: 4050,
    },
    {
      id: '6',
      name: 'Interlay Bitcoin Bridge',
      address: 'a3dWi7hBvZxZGVWkcJXbPVTJhxCUxVbAkMARAjzLECrq9Y6',
      blockchain: 'Interlay',
      balances: {
        iBTC: { amount: 0.15, usdValue: 10050, change24h: 2.1 },
      },
      totalUsdValue: 10050,
    },
  ])

  // Generate mock historical data based on selected period
  const generateChartData = useCallback(
    (period: TimePeriod): ChartDataPoint[] => {
      const now = new Date()
      let startDate: Date
      let dataPoints: number

      switch (period) {
        case 'this_month':
          startDate = startOfMonth(now)
          dataPoints = now.getDate()
          break
        case 'last_month': {
          const lastMonth = subMonths(now, 1)
          startDate = startOfMonth(lastMonth)
          dataPoints = endOfMonth(lastMonth).getDate()
          break
        }
        case '30_days':
          startDate = subDays(now, 30)
          dataPoints = 30
          break
        case '90_days':
          startDate = subDays(now, 90)
          dataPoints = 30 // Sample every 3 days
          break
        case 'one_year':
          startDate = subDays(now, 365)
          dataPoints = 52 // Weekly data
          break
        case 'this_year':
          startDate = startOfYear(now)
          dataPoints = Math.floor(
            (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
          ) // Weekly
          break
        case 'last_year': {
          const lastYear = subYears(now, 1)
          startDate = startOfYear(lastYear)
          dataPoints = 52 // Weekly data
          break
        }
        default:
          startDate = subDays(now, 30)
          dataPoints = 30
      }

      const data: ChartDataPoint[] = []
      const interval =
        period.includes('year') || period === '90_days'
          ? Math.floor(
              (now.getTime() - startDate.getTime()) /
                (dataPoints * 24 * 60 * 60 * 1000)
            )
          : 1

      // Use a deterministic seed based on the period to make the random data stable
      const seed = period.charCodeAt(0) + period.length

      for (let i = 0; i < dataPoints; i++) {
        const date = new Date(
          startDate.getTime() + i * interval * 24 * 60 * 60 * 1000
        )

        // Generate realistic-looking data with some volatility
        const baseValue = 300000
        const trend = i * (20000 / dataPoints) // Slight upward trend
        // Use deterministic pseudo-random based on seed and index
        const pseudoRandom = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280
        const volatility = Math.sin(i / 3) * 15000 + pseudoRandom * 10000

        const totalValue = baseValue + trend + volatility

        // Distribute total across currencies with different patterns
        const dotRatio = 0.3 + Math.sin(i / 5) * 0.08
        const ksmRatio = 0.2 + Math.cos(i / 4) * 0.05
        const glmrRatio = 0.25 + Math.sin(i / 6) * 0.06
        const astrRatio = 0.15 + Math.cos(i / 5) * 0.04
        const iBtcRatio = 1 - dotRatio - ksmRatio - glmrRatio - astrRatio
        data.push({
          date: format(
            date,
            period.includes('year') || period === '90_days' ? 'MMM d' : 'MMM d'
          ),
          DOT: Math.round(totalValue * dotRatio),
          KSM: Math.round(totalValue * ksmRatio),
          GLMR: Math.round(totalValue * glmrRatio),
          ASTR: Math.round(totalValue * astrRatio),
          iBTC: Math.round(totalValue * iBtcRatio),
        })
      }

      return data
    },
    []
  )

  const chartData = useMemo(
    () => generateChartData(selectedPeriod),
    [selectedPeriod, generateChartData]
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

  const totalPortfolioValue = wallets.reduce(
    (sum, wallet) => sum + wallet.totalUsdValue,
    0
  )

  const currencyColors: { [key: string]: string } = {
    DOT: '#E6007A', // Polkadot pink
    KSM: '#000000', // Kusama black
    GLMR: '#53CBC8', // Moonbeam teal
    ASTR: '#0081FF', // Astar blue
    BNC: '#5A25F0', // Bifrost purple
    iBTC: '#F7931A', // Bitcoin orange
    USDC: '#2775CA', // USD Coin blue
    USDT: '#26A17B', // Tether green
  }

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
          {Object.keys(currencyColors).map(renderArea)}
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

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Wallet Balances
              </h1>
              <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
                Track your cryptocurrency holdings across all wallets
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Export Data
              </button>
              <button
                onClick={handleConnectWallet}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Wallet
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Summary */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total Portfolio Value
              </p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-2">
                {formatCurrency(totalPortfolioValue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-500">
                Active Wallets
              </p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {wallets.length}
              </p>
            </div>
          </div>
        </div>

        {/* Stacked Area Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6">
            <WalletBalanceChart
              chartData={chartData}
              currencyColors={currencyColors}
              formatYAxisTick={formatYAxisTick}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default Balances
