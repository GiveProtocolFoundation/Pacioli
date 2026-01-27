import React, { useState, useCallback } from 'react'
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
  Percent,
  Target,
} from 'lucide-react'

interface KPI {
  id: string
  label: string
  value: string
  change: number
  changeLabel: string
  icon: React.ElementType
  trend: 'up' | 'down' | 'neutral'
}

type TimePeriod = '7d' | '30d' | '90d' | '1y' | 'all'

const kpis: KPI[] = [
  {
    id: 'total-value',
    label: 'Total Portfolio Value',
    value: '$2,847,392.45',
    change: 12.5,
    changeLabel: '+$316,428 (30d)',
    icon: DollarSign,
    trend: 'up',
  },
  {
    id: 'crypto-holdings',
    label: 'Crypto Holdings',
    value: '$1,924,180.22',
    change: 18.3,
    changeLabel: '+$298,620 (30d)',
    icon: Coins,
    trend: 'up',
  },
  {
    id: 'staking-apy',
    label: 'Avg Staking APY',
    value: '12.4%',
    change: 2.1,
    changeLabel: '+0.26% (30d)',
    icon: Percent,
    trend: 'up',
  },
  {
    id: 'monthly-revenue',
    label: 'Monthly Revenue',
    value: '$84,295.50',
    change: -5.2,
    changeLabel: '-$4,621 vs last month',
    icon: TrendingUp,
    trend: 'down',
  },
]

// Mock chart data for visualization
const portfolioData = [
  { date: '10/01', value: 2500000 },
  { date: '10/03', value: 2550000 },
  { date: '10/05', value: 2480000 },
  { date: '10/07', value: 2620000 },
  { date: '10/09', value: 2700000 },
  { date: '10/11', value: 2680000 },
  { date: '10/13', value: 2750000 },
  { date: '10/15', value: 2847392 },
]

const assetAllocation = [
  { name: 'DOT', value: 35, amount: 673163, color: '#E6007A' },
  { name: 'BTC', value: 28, amount: 538770, color: '#F7931A' },
  { name: 'GLMR', value: 18, amount: 346352, color: '#53CBC8' },
  { name: 'ASTR', value: 12, amount: 230901, color: '#0081FF' },
  { name: 'Others', value: 7, amount: 134993, color: '#8B5CF6' },
]

const KPICard: React.FC<{ kpi: KPI }> = ({ kpi }) => {
  const Icon = kpi.icon
  const TrendIcon = kpi.trend === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-[#8b4e52] dark:text-[#a86e72]" />
        </div>
        <div
          className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            kpi.trend === 'up'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}
        >
          <TrendIcon className="w-3 h-3 mr-1" />
          {Math.abs(kpi.change)}%
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-[#94a3b8]">{kpi.label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
        {kpi.value}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {kpi.changeLabel}
      </p>
    </div>
  )
}

const TimePeriodDropdown: React.FC<{
  timePeriods: { value: TimePeriod; label: string }[]
  current: TimePeriod
  show: boolean
  onToggle: () => void
  onSelect: (value: TimePeriod) => void
}> = ({ timePeriods, current, show, onToggle, onSelect }) => {
  const handleSelect = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const value = e.currentTarget.getAttribute('data-value') as TimePeriod
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
                  ? 'text-[#8b4e52] dark:text-[#a86e72] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20'
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

const Analytics: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)

  const timePeriods: { value: TimePeriod; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
    { value: 'all', label: 'All time' },
  ]

  const handleTogglePeriodDropdown = useCallback(() => {
    setShowPeriodDropdown(!showPeriodDropdown)
  }, [showPeriodDropdown])

  const handleSelectPeriod = useCallback((value: TimePeriod) => {
    setTimePeriod(value)
    setShowPeriodDropdown(false)
  }, [])

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1>Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
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
              <button className="p-2 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 dark:text-[#94a3b8] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
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
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-[#8b4e52] mr-2" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Portfolio Performance
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    Total value over time
                  </p>
                </div>
              </div>
            </div>

            {/* Mock Line Chart */}
            <div className="h-64 relative">
              <svg className="w-full h-full" viewBox="0 0 800 250">
                {/* Grid lines */}
                <g className="text-gray-200 dark:text-gray-700">
                  {[0, 1, 2, 3, 4].map(i => (
                    <line
                      key={`grid-${i}`}
                      x1="0"
                      y1={i * 50}
                      x2="800"
                      y2={i * 50}
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="4"
                    />
                  ))}
                </g>

                {/* Area fill */}
                <defs>
                  <linearGradient
                    id="portfolioGradient"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#8b4e52" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8b4e52" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Chart line and area */}
                <path
                  d="M 50,120 L 150,100 L 250,135 L 350,80 L 450,55 L 550,65 L 650,40 L 750,20"
                  fill="none"
                  stroke="#8b4e52"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M 50,120 L 150,100 L 250,135 L 350,80 L 450,55 L 550,65 L 650,40 L 750,20 L 750,250 L 50,250 Z"
                  fill="url(#portfolioGradient)"
                />

                {/* Data points */}
                {portfolioData.map((point, i) => {
                  const x = 50 + i * 100
                  const y = 120 - i * 12 + (i % 2 === 0 ? 15 : 0)
                  return (
                    <circle
                      key={`point-${point.date}`}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#8b4e52"
                      className="hover:r-6 cursor-pointer"
                    />
                  )
                })}

                {/* X-axis labels */}
                {portfolioData.map((point, i) => (
                  <text
                    key={`label-${point.date}`}
                    x={50 + i * 100}
                    y="245"
                    className="text-xs fill-current text-gray-500 dark:text-[#94a3b8]"
                    textAnchor="middle"
                  >
                    {point.date}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          {/* Asset Allocation - Pie Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <PieChart className="w-5 h-5 text-[#8b4e52] mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Asset Allocation
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Holdings by cryptocurrency
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center mb-6">
              {/* Mock Donut Chart */}
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#E6007A"
                  strokeWidth="40"
                  strokeDasharray="176 352"
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#F7931A"
                  strokeWidth="40"
                  strokeDasharray="140 352"
                  strokeDashoffset="-176"
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#53CBC8"
                  strokeWidth="40"
                  strokeDasharray="90 352"
                  strokeDashoffset="-316"
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#0081FF"
                  strokeWidth="40"
                  strokeDasharray="60 352"
                  strokeDashoffset="-406"
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="40"
                  strokeDasharray="35 352"
                  strokeDashoffset="-466"
                  transform="rotate(-90 100 100)"
                />
              </svg>
            </div>

            <div className="space-y-3">
              {assetAllocation.map(asset => (
                <div
                  key={asset.name}
                  className="flex items-center justify-between"
                >
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
                    <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                      ${asset.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Volume - Bar Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <BarChart3 className="w-5 h-5 text-[#8b4e52] mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Transaction Volume
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Daily transaction activity
                </p>
              </div>
            </div>

            {/* Mock Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-2">
              {[65, 85, 45, 90, 70, 95, 80].map((height, i) => {
                const dayName = [
                  'Mon',
                  'Tue',
                  'Wed',
                  'Thu',
                  'Fri',
                  'Sat',
                  'Sun',
                ][i]
                return (
                  <div
                    key={dayName}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className="w-full bg-[#8b4e52] dark:bg-[#8b4e52] rounded-t hover:bg-[#8b4e52] dark:hover:bg-[#8b4e52] transition-colors cursor-pointer"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-gray-500 dark:text-[#94a3b8] mt-2">
                      {dayName}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-[#94a3b8]">
                  Total this week
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  $142,850
                </span>
              </div>
            </div>
          </div>

          {/* Staking Rewards */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Target className="w-5 h-5 text-[#8b4e52] mr-2" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Staking Rewards
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    Rewards earned over time
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    DOT Staking
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    12.5% APY
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    +$2,450.32
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    This month
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#c9a961]/10 dark:bg-[#c9a961]/20 rounded-lg border border-[#c9a961]/30 dark:border-[#c9a961]/40">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    GLMR Staking
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    15.2% APY
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#8b4e52] dark:text-[#a86e72]">
                    +$1,820.18
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    This month
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ASTR Staking
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    8.7% APY
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    +$986.45
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                    This month
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-[#94a3b8]">
                  Total Rewards
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  $5,256.95
                </span>
              </div>
            </div>
          </div>

          {/* Revenue vs Expenses */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <DollarSign className="w-5 h-5 text-[#8b4e52] mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Revenue vs Expenses
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Monthly comparison
                </p>
              </div>
            </div>

            {/* Mock Grouped Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-3">
              {[
                { revenue: 70, expense: 45 },
                { revenue: 85, expense: 50 },
                { revenue: 75, expense: 55 },
                { revenue: 90, expense: 48 },
                { revenue: 80, expense: 52 },
              ].map((data, i) => {
                const monthName = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]
                return (
                  <div
                    key={monthName}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div className="w-full flex gap-1 items-end h-full">
                      <div
                        className="flex-1 bg-green-500 dark:bg-green-600 rounded-t"
                        style={{ height: `${data.revenue}%` }}
                      />
                      <div
                        className="flex-1 bg-red-500 dark:bg-red-600 rounded-t"
                        style={{ height: `${data.expense}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-[#94a3b8] mt-2">
                      {monthName}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2" />
                <span className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Revenue
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2" />
                <span className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Expenses
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
