import React, { useState, useCallback } from 'react'
import {
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
  Play,
  Clock,
  Star,
  Search,
  ChevronRight,
  PieChart,
  BarChart3,
  Coins,
  Receipt,
  Calculator,
  FileSpreadsheet,
  Settings,
  Plus,
} from 'lucide-react'

interface Report {
  id: string
  name: string
  description: string
  category: ReportCategory
  icon: React.ElementType
  lastRun?: string
  favorite?: boolean
}

type ReportCategory = 'financial' | 'crypto' | 'tax' | 'custom'

interface RecentRun {
  id: string
  reportName: string
  ranAt: string
  ranBy: string
  format: 'pdf' | 'excel' | 'csv'
  status: 'completed' | 'processing' | 'failed'
}

const reportCategories: {
  id: ReportCategory
  label: string
  icon: React.ElementType
}[] = [
  { id: 'financial', label: 'Financial Reports', icon: FileText },
  { id: 'crypto', label: 'Crypto Reports', icon: Coins },
  { id: 'tax', label: 'Tax Reports', icon: Receipt },
  { id: 'custom', label: 'Custom Reports', icon: Settings },
]

const reports: Report[] = [
  // Financial Reports
  {
    id: 'balance-sheet',
    name: 'Balance Sheet',
    description:
      'Statement of financial position showing assets, liabilities, and equity',
    category: 'financial',
    icon: PieChart,
    lastRun: '2025-10-15T14:30:00Z',
    favorite: true,
  },
  {
    id: 'income-statement',
    name: 'Income Statement (P&L)',
    description:
      'Profit and loss statement showing revenue, expenses, and net income',
    category: 'financial',
    icon: TrendingUp,
    lastRun: '2025-10-15T14:30:00Z',
    favorite: true,
  },
  {
    id: 'cash-flow',
    name: 'Cash Flow Statement',
    description:
      'Statement of cash flows from operating, investing, and financing activities',
    category: 'financial',
    icon: DollarSign,
    lastRun: '2025-10-10T09:15:00Z',
  },
  {
    id: 'trial-balance',
    name: 'Trial Balance',
    description:
      'List of all general ledger accounts with their debit and credit balances',
    category: 'financial',
    icon: BarChart3,
  },
  {
    id: 'general-ledger',
    name: 'General Ledger',
    description: 'Complete record of all financial transactions',
    category: 'financial',
    icon: FileSpreadsheet,
    lastRun: '2025-10-12T16:45:00Z',
  },
  {
    id: 'accounts-receivable',
    name: 'Accounts Receivable Aging',
    description: 'Summary of outstanding customer invoices by age',
    category: 'financial',
    icon: Calendar,
  },
  {
    id: 'accounts-payable',
    name: 'Accounts Payable Aging',
    description: 'Summary of outstanding vendor bills by age',
    category: 'financial',
    icon: Calendar,
  },

  // Crypto Reports
  {
    id: 'crypto-holdings',
    name: 'Crypto Holdings Report',
    description: 'Current cryptocurrency positions across all wallets',
    category: 'crypto',
    icon: Coins,
    lastRun: '2025-10-17T08:00:00Z',
    favorite: true,
  },
  {
    id: 'staking-rewards',
    name: 'Staking Rewards Report',
    description: 'Summary of staking rewards earned by token and period',
    category: 'crypto',
    icon: TrendingUp,
    lastRun: '2025-10-16T12:00:00Z',
  },
  {
    id: 'transaction-history',
    name: 'Transaction History',
    description: 'Detailed list of all cryptocurrency transactions',
    category: 'crypto',
    icon: FileText,
    lastRun: '2025-10-17T10:30:00Z',
  },
  {
    id: 'unrealized-gains',
    name: 'Unrealized Gains/Losses',
    description: 'Current unrealized gains and losses on crypto holdings',
    category: 'crypto',
    icon: TrendingUp,
  },
  {
    id: 'cost-basis',
    name: 'Cost Basis Report',
    description: 'Cost basis tracking for all cryptocurrency holdings',
    category: 'crypto',
    icon: Calculator,
    lastRun: '2025-10-14T11:20:00Z',
  },
  {
    id: 'wallet-performance',
    name: 'Wallet Performance',
    description: 'Performance metrics for each wallet over time',
    category: 'crypto',
    icon: BarChart3,
  },

  // Tax Reports
  {
    id: 'tax-summary',
    name: 'Tax Summary Report',
    description:
      'Annual tax summary including realized gains, income, and deductions',
    category: 'tax',
    icon: Receipt,
    lastRun: '2025-01-15T14:00:00Z',
    favorite: true,
  },
  {
    id: 'form-8949',
    name: 'Form 8949 (Capital Gains)',
    description:
      'IRS Form 8949 data for cryptocurrency capital gains and losses',
    category: 'tax',
    icon: FileText,
  },
  {
    id: 'income-report',
    name: 'Cryptocurrency Income Report',
    description:
      'All cryptocurrency income including staking, rewards, and airdrops',
    category: 'tax',
    icon: DollarSign,
  },
  {
    id: 'tax-lot',
    name: 'Tax Lot Report',
    description: 'Detailed tax lot tracking with acquisition dates and costs',
    category: 'tax',
    icon: Calculator,
  },
]

const recentRuns: RecentRun[] = [
  {
    id: '1',
    reportName: 'Crypto Holdings Report',
    ranAt: '2025-10-17T08:00:00Z',
    ranBy: 'John Smith',
    format: 'pdf',
    status: 'completed',
  },
  {
    id: '2',
    reportName: 'Income Statement (P&L)',
    ranAt: '2025-10-15T14:30:00Z',
    ranBy: 'Sarah Johnson',
    format: 'excel',
    status: 'completed',
  },
  {
    id: '3',
    reportName: 'Transaction History',
    ranAt: '2025-10-17T10:30:00Z',
    ranBy: 'John Smith',
    format: 'csv',
    status: 'completed',
  },
  {
    id: '4',
    reportName: 'Balance Sheet',
    ranAt: '2025-10-15T14:30:00Z',
    ranBy: 'Michael Chen',
    format: 'pdf',
    status: 'completed',
  },
]

const Reports: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<
    ReportCategory | 'all'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const filteredReports = reports.filter(report => {
    const matchesCategory =
      selectedCategory === 'all' || report.category === selectedCategory
    const matchesSearch =
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFavorite = !showFavoritesOnly || report.favorite

    return matchesCategory && matchesSearch && matchesFavorite
  })

  const favoriteReports = reports.filter(r => r.favorite)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: RecentRun['status']) => {
    const styles = {
      completed:
        'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      processing:
        'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    []
  )

  const handleToggleFavorites = useCallback(() => {
    setShowFavoritesOnly(!showFavoritesOnly)
  }, [showFavoritesOnly])

  const handleCategoryAll = useCallback(() => {
    setSelectedCategory('all')
  }, [])

  const createCategoryHandler = useCallback((categoryId: ReportCategory) => {
    return () => setSelectedCategory(categoryId)
  }, [])

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Reports
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Financial and cryptocurrency reporting
              </p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" />
              Custom Report
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Reports
                    </p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1 stat-value">
                      {reports.length}
                    </p>
                  </div>
                  <div className="stat-icon-container">
                    <FileText />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Favorites
                    </p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1 stat-value">
                      {favoriteReports.length}
                    </p>
                  </div>
                  <div className="stat-icon-container">
                    <Star />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Run Today
                    </p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1 stat-value">
                      {
                        recentRuns.filter(r => r.ranAt.startsWith('2025-10-17'))
                          .length
                      }
                    </p>
                  </div>
                  <div className="stat-icon-container">
                    <Clock />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search reports..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleToggleFavorites}
                  className={`px-4 py-2 rounded-lg border flex items-center justify-center transition-colors ${
                    showFavoritesOnly
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Star
                    className={`w-4 h-4 mr-2 ${showFavoritesOnly ? 'fill-current' : ''}`}
                  />
                  Favorites
                </button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCategoryAll}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                All Reports
              </button>
              {reportCategories.map(category => {
                const Icon = category.icon
                const handleClick = createCategoryHandler(category.id)
                return (
                  <button
                    key={category.id}
                    onClick={handleClick}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                      selectedCategory === category.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {category.label}
                  </button>
                )
              })}
            </div>

            {/* Reports List */}
            <div className="space-y-3">
              {filteredReports.map(report => {
                const Icon = report.icon
                return (
                  <div
                    key={report.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1">
                        <div className="report-icon-container flex-shrink-0">
                          <Icon />
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {report.name}
                            </h3>
                            {report.favorite && (
                              <Star className="w-4 h-4 ml-2 favorite-star active" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {report.description}
                          </p>
                          {report.lastRun && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                              Last run: {formatDate(report.lastRun)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          className="p-2 action-icon hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Run Report"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 action-icon hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 action-icon hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Schedule"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredReports.length === 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No reports found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Try adjusting your search or filters.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Runs */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Recent Runs
              </h3>
              <div className="space-y-3">
                {recentRuns.map(run => (
                  <div
                    key={run.id}
                    className="pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {run.reportName}
                      </p>
                      {getStatusBadge(run.status)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      By {run.ranBy}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(run.ranAt)}
                    </p>
                    {run.status === 'completed' && (
                      <button className="download-link mt-2 flex items-center">
                        <Download className="w-3 h-3 mr-1" />
                        Download {run.format.toUpperCase()}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Reports
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between">
                  <span className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Report Templates
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between">
                  <span className="flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Export Settings
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Report Builder CTA */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <h3 className="text-sm font-semibold mb-2">
                Custom Report Builder
              </h3>
              <p className="text-xs opacity-90 mb-4">
                Create custom reports with advanced filters and calculations
              </p>
              <button className="w-full px-4 py-2 text-sm font-medium bg-white text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Build Custom Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Reports
