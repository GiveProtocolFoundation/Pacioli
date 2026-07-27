import React, { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Inbox,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Formats an ISO date string into a human-readable format.
 * @param dateString - ISO 8601 date string to format
 * @returns Formatted date string (e.g., "Oct 15, 2025, 02:30 PM")
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
    favorite: true,
  },
  {
    id: 'income-statement',
    name: 'Income Statement (P&L)',
    description:
      'Profit and loss statement showing revenue, expenses, and net income',
    category: 'financial',
    icon: TrendingUp,
    favorite: true,
  },
  {
    id: 'cash-flow',
    name: 'Cash Flow Statement',
    description:
      'Statement of cash flows from operating, investing, and financing activities',
    category: 'financial',
    icon: DollarSign,
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
    favorite: true,
  },
  {
    id: 'staking-rewards',
    name: 'Staking Rewards Report',
    description: 'Summary of staking rewards earned by token and period',
    category: 'crypto',
    icon: TrendingUp,
  },
  {
    id: 'transaction-history',
    name: 'Transaction History',
    description: 'Detailed list of all cryptocurrency transactions',
    category: 'crypto',
    icon: FileText,
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

/**
 * SearchInput component that renders a search input field.
 * @param {string} searchQuery - Current search query string.
 * @param {(e: React.ChangeEvent<HTMLInputElement>) => void} onSearchChange - Callback for search input change.
 * @returns {JSX.Element} The rendered SearchInput component.
 */
const SearchInput: React.FC<{
  searchQuery: string
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}> = ({ searchQuery, onSearchChange }) => (
  <div className="relative flex-1">
    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#647D8B]" />
    <input
      type="text"
      placeholder="Search reports..."
      value={searchQuery}
      onChange={onSearchChange}
      className="w-full pl-4 pr-10 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
    />
  </div>
)

/**
 * FavoritesToggle component that renders a toggle button for favorite reports.
 * @param {boolean} showFavoritesOnly - Whether to show only favorite reports.
 * @param {() => void} onToggle - Callback to toggle favorites filter.
 * @returns {JSX.Element} The rendered FavoritesToggle component.
 */
const FavoritesToggle: React.FC<{
  showFavoritesOnly: boolean
  onToggle: () => void
}> = ({ showFavoritesOnly, onToggle }) => (
  <button
    onClick={onToggle}
    className={`px-4 py-2 rounded-lg border flex items-center justify-center transition-colors ${
      showFavoritesOnly
        ? 'border-[#5FE3C0] bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 text-[#E8B36F] dark:text-[#5FE3C0]'
        : 'border-[rgba(95,227,192,0.15)] text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]'
    }`}
  >
    <Star className="w-4 h-4 mr-2" />
    Favorites
  </button>
)

/** Displays a stat card with label, value, and icon */
const StatCard: React.FC<{
  label: string
  value: number
  Icon: React.ElementType
}> = ({ label, value, Icon }) => (
  <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">{label}</p>
        <p className="text-2xl font-semibold text-[#11202B] dark:text-[#EAF3F2] mt-1 stat-value">
          {value}
        </p>
      </div>
      <div className="stat-icon-container">
        <Icon />
      </div>
    </div>
  </div>
)

/** Displays report icon, name, description, and last-run timestamp */
const ReportInfo = ({
  report,
  Icon,
}: {
  report: {
    name: string
    favorite?: boolean
    description: string
    lastRun?: string | null
  }
  Icon: React.ElementType
}) => (
  <div className="flex items-start flex-1">
    <div className="report-icon-container flex-shrink-0">
      <Icon />
    </div>
    <div className="ml-4 flex-1">
      <div className="flex items-center">
        <h3 className="text-sm font-semibold text-[#11202B] dark:text-[#EAF3F2]">
          {report.name}
        </h3>
        {report.favorite && (
          <Star className="w-4 h-4 ml-2 favorite-star active" />
        )}
      </div>
      <p className="text-xs text-[#294050] dark:text-[#9FB4BE] mt-1">
        {report.description}
      </p>
      {report.lastRun && (
        <p className="text-xs text-[#647D8B] dark:text-[#294050] mt-2">
          Last run: {formatDate(report.lastRun)}
        </p>
      )}
    </div>
  </div>
)

/** Page header with title and custom report button */
const ReportsHeader: React.FC = () => (
  <header className="bg-[#F7FAFA] dark:bg-[#0C141B] border-b border-[rgba(95,227,192,0.15)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="eyebrow">Insights</p>
          <h1>Reports</h1>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
            Financial and cryptocurrency reporting
          </p>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-white bg-[#294050] rounded-lg hover:bg-[#1E2F3C] flex items-center justify-center">
          <Plus className="w-4 h-4 mr-2" />
          Custom Report
        </button>
      </div>
    </div>
  </header>
)

/** Route map for reports with functional sub-pages */
const reportRoutes: Record<string, string> = {
  'cost-basis': '/reports/cost-basis',
  'balance-sheet': '/reports/balance-sheet',
  'income-statement': '/reports/income-statement',
  'trial-balance': '/reports/trial-balance',
  'statement-of-activities': '/reports/statement-of-activities',
}

const soaReport: Report = {
  id: 'statement-of-activities',
  name: 'Statement of Activities',
  description:
    'NGO revenue by donor restriction and expenses by functional classification',
  category: 'financial',
  icon: ClipboardList,
  favorite: true,
}

/** Main reports page with search, category filtering, and recent run history */
const Reports: React.FC = () => {
  const navigate = useNavigate()
  const { accountType } = useAuth()
  const isNgo = accountType === 'not-for-profit'
  const [selectedCategory, setSelectedCategory] = useState<
    ReportCategory | 'all'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const allReports = useMemo(
    () => (isNgo ? [...reports, soaReport] : reports),
    [isNgo]
  )

  const filteredReports = allReports.filter(report => {
    const matchesCategory =
      selectedCategory === 'all' || report.category === selectedCategory
    const matchesSearch =
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFavorite = !showFavoritesOnly || report.favorite

    return matchesCategory && matchesSearch && matchesFavorite
  })

  const favoriteReports = allReports.filter(r => r.favorite)

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
      <ReportsHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats — derived from report definitions, not mock data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Total Reports"
                value={allReports.length}
                Icon={FileText}
              />
              <StatCard
                label="Favorites"
                value={favoriteReports.length}
                Icon={Star}
              />
              <StatCard label="Run Today" value={0} Icon={Clock} />
            </div>

            {/* Search and Filters */}
            <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <SearchInput
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                />
                <FavoritesToggle
                  showFavoritesOnly={showFavoritesOnly}
                  onToggle={handleToggleFavorites}
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCategoryAll}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988] border border-[#294050]/30 dark:border-[#294050]/40'
                    : 'bg-[#F7FAFA] dark:bg-[#0C141B] text-[#294050] dark:text-[#9FB4BE] border border-[rgba(95,227,192,0.15)] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]'
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
                        ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988] border border-[#294050]/30 dark:border-[#294050]/40'
                        : 'bg-[#F7FAFA] dark:bg-[#0C141B] text-[#294050] dark:text-[#9FB4BE] border border-[rgba(95,227,192,0.15)] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]'
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
                    className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-4 hover:border-[rgba(95,227,192,0.3)] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <ReportInfo report={report} Icon={Icon} />
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          className="p-2 action-icon hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] rounded-lg transition-colors"
                          title="Run Report"
                          onClick={() => {
                            const route = reportRoutes[report.id]
                            if (route) navigate(route)
                          }}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 action-icon hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 action-icon hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] rounded-lg transition-colors"
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
                <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-[#647D8B]" />
                  <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
                    No reports found
                  </h3>
                  <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
                    Try adjusting your search or filters.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Runs — honest empty state (no report-run history backend exists) */}
            <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-6">
              <h3 className="text-sm font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-4">
                Recent Runs
              </h3>
              <div className="py-8 text-center">
                <Inbox className="mx-auto h-10 w-10 text-[#647D8B]" />
                <p className="mt-2 text-sm text-[#294050] dark:text-[#9FB4BE]">
                  No reports run yet
                </p>
                <p className="mt-1 text-xs text-[#647D8B] dark:text-[#294050]">
                  Run a report to see its history here.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-6">
              <h3 className="text-sm font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-sm font-medium text-[#294050] dark:text-[#9FB4BE] bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] flex items-center justify-between">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Reports
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-[#294050] dark:text-[#9FB4BE] bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] flex items-center justify-between">
                  <span className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Report Templates
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-[#294050] dark:text-[#9FB4BE] bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] flex items-center justify-between">
                  <span className="flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Export Settings
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Report Builder CTA */}
            <div className="bg-gradient-to-br from-[#294050] to-[#1E2F3C] rounded-lg p-6 text-white">
              <h3 className="text-sm font-semibold mb-2">
                Custom Report Builder
              </h3>
              <p className="text-xs opacity-90 mb-4">
                Create custom reports with advanced filters and calculations
              </p>
              <button className="w-full px-4 py-2 text-sm font-medium bg-white text-[#294050] rounded-lg hover:bg-[#EAF3F2] flex items-center justify-center">
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
