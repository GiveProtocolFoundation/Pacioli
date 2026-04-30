import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  BarChart3,
  Plus,
  Download,
  Heart,
  Minus,
  Upload,
  FileText,
} from 'lucide-react'
import { useCurrency } from '../../contexts/CurrencyContext'
import { DecimalSeparatorStandard } from '../../types/currency'
import { useTheme } from '../../contexts/ThemeContext'
import { formatCurrency } from '../../utils/currencyFormatter'
import { getCryptoLogoPath, getCryptoBrandColor } from '../../utils/cryptoLogos'
import SparklineChart from './SparklineChart'

interface Transaction {
  id: string
  date: string
  description: string
  type: 'donation' | 'expense' | 'transfer' | 'exchange'
  crypto: string
  amount: number
  usdValue: number
  status: 'completed' | 'pending'
}

interface AccountBalance {
  crypto: string
  amount: number
  usdValue: number
  change24h: number
}

/** Reusable statistics card displaying a metric value, trend indicator, and icon */
const StatsCard: React.FC<{
  title: string
  value: React.ReactNode
  changeIcon: React.ReactNode
  changeColor: string
  changeValue: string
  changeLabel?: string
  icon: React.ReactNode
  variant?: 'default' | 'hero'
  sparklineData?: number[]
}> = ({
  title,
  value,
  changeIcon,
  changeColor,
  changeValue,
  changeLabel,
  icon,
  variant = 'default',
  sparklineData,
}) => {
  const isHero = variant === 'hero'

  return (
    <div className={isHero ? 'dashboard-hero-card' : 'ledger-card p-6'}>
      <div className="flex items-center justify-between">
        <div>
          <p className="ledger-card-label">{title}</p>
          <p
            className={`font-bold text-[#1a1815] dark:text-[#f5f3f0] mt-2 dashboard-heading ${isHero ? 'text-4xl' : 'text-3xl'}`}
          >
            {value}
          </p>
          <div className="flex items-center mt-2">
            {changeIcon}
            <span className={`text-sm ${changeColor}`}>{changeValue}</span>
            {changeLabel && (
              <span className="text-sm dashboard-muted-text ml-1">{changeLabel}</span>
            )}
          </div>
        </div>
        <div className="stat-icon-container">{icon}</div>
      </div>
      {sparklineData && (
        <div className="mt-4">
          <SparklineChart data={sparklineData} />
        </div>
      )}
    </div>
  )
}

// Mock sparkline data — 30-point portfolio trend
const portfolioSparkline = [
  45200, 45800, 46100, 45500, 46300, 47100, 46800, 47500, 48200, 47800, 48500,
  49100, 48700, 49300, 49800, 49200, 49600, 50100, 49500, 50200, 50800, 50300,
  50900, 51200, 50600, 51400, 51800, 51200, 51900, 50000,
]

/** Card displaying a list of cryptocurrency account balances with logos, amounts, and 24h price changes */
const AccountBalancesList: React.FC<{
  accountBalances: AccountBalance[]
  currencySettings: {
    primaryCurrency: string
    decimalPlaces: number
    useThousandsSeparator: boolean
    decimalSeparatorStandard: DecimalSeparatorStandard
  }
  theme: 'light' | 'dark'
}> = ({ accountBalances, currencySettings, theme }) => (
  <div className="ledger-card border border-[rgba(201,169,97,0.15)]">
    <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
      <h2>Account Balances</h2>
    </div>
    <div className="px-6">
      <div>
        {accountBalances.map(account => {
          const logoPath = getCryptoLogoPath(account.crypto, theme)
          const brandColor = getCryptoBrandColor(account.crypto)

          return (
            <div key={account.crypto} className="balance-list-item">
              <div className="token-info">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: logoPath
                      ? 'transparent'
                      : `${brandColor}20`,
                  }}
                >
                  {logoPath ? (
                    <img
                      src={logoPath}
                      alt={`${account.crypto} logo`}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span
                      className="text-sm font-semibold"
                      style={{ color: brandColor }}
                    >
                      {account.crypto}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                    {account.crypto}
                  </p>
                  <p className="text-sm dashboard-muted-text dashboard-mono">
                    {account.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    {account.crypto}
                  </p>
                </div>
              </div>
              <div className="token-values">
                <p className="font-semibold text-[#1a1815] dark:text-[#f5f3f0] dashboard-mono">
                  {formatCurrency(
                    account.usdValue,
                    currencySettings.primaryCurrency,
                    {
                      decimalPlaces: currencySettings.decimalPlaces,
                      useThousandsSeparator:
                        currencySettings.useThousandsSeparator,
                      decimalSeparatorStandard:
                        currencySettings.decimalSeparatorStandard,
                    }
                  )}
                </p>
                <div
                  className={`percentage-change ${account.change24h >= 0 ? 'change-positive' : 'change-negative'}`}
                >
                  {account.change24h >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {account.change24h >= 0 ? '+' : ''}
                    {account.change24h}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)

/** Table displaying recent transactions with date, description, type badge, amount, value, and status */
const RecentTransactionsTable: React.FC<{
  recentTransactions: Transaction[]
  currencySettings: {
    primaryCurrency: string
    decimalPlaces: number
    useThousandsSeparator: boolean
    decimalSeparatorStandard: DecimalSeparatorStandard
  }
  getTypeColor: (type: string) => string
}> = ({ recentTransactions, currencySettings, getTypeColor }) => (
  <div className="ledger-card border border-[rgba(201,169,97,0.15)] mt-10">
    <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)] flex items-center justify-between">
      <h2>Recent Transactions</h2>
      <button className="text-sm dashboard-link">
        View All
      </button>
    </div>
    <div className="ledger-table-wrapper">
      <table className="ledger-table">
        <thead className="ledger-table-header">
          <tr>
            <th className="ledger-table-cell-date">Date</th>
            <th className="ledger-table-cell-text">Description</th>
            <th className="ledger-table-cell-text">Type</th>
            <th className="ledger-table-cell-number">Amount</th>
            <th className="ledger-table-cell-number">Value</th>
            <th className="ledger-table-cell-text">Status</th>
          </tr>
        </thead>
        <tbody>
          {recentTransactions.map(tx => (
            <tr key={tx.id} className="ledger-table-row">
              <td className="ledger-table-cell-date whitespace-nowrap text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                {tx.date}
              </td>
              <td className="ledger-table-cell-text text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                {tx.description}
              </td>
              <td className="ledger-table-cell-text whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}
                >
                  {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                </span>
              </td>
              <td className="ledger-table-cell-number whitespace-nowrap text-sm dashboard-mono">
                <span
                  className={
                    tx.amount >= 0
                      ? 'change-positive'
                      : 'text-[#1a1815] dark:text-[#f5f3f0]'
                  }
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {tx.amount.toLocaleString()} {tx.crypto}
                </span>
              </td>
              <td className="ledger-table-cell-number whitespace-nowrap text-sm text-[#1a1815] dark:text-[#f5f3f0] dashboard-mono">
                {formatCurrency(
                  Math.abs(tx.usdValue),
                  currencySettings.primaryCurrency,
                  {
                    decimalPlaces: currencySettings.decimalPlaces,
                    useThousandsSeparator:
                      currencySettings.useThousandsSeparator,
                    decimalSeparatorStandard:
                      currencySettings.decimalSeparatorStandard,
                  }
                )}
              </td>
              <td className="ledger-table-cell-text whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tx.status === 'completed'
                      ? 'badge-completed'
                      : 'badge-pending'
                  }`}
                >
                  {tx.status.charAt(0).toUpperCase() +
                    tx.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

/** Sidebar card with quick action buttons for common tasks like recording donations and generating reports */
const QuickActionsCard: React.FC<{ onNewTransaction: () => void }> = ({ onNewTransaction }) => (
  <div className="ledger-card border border-[rgba(201,169,97,0.15)]">
    <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
      <h2>Quick Actions</h2>
    </div>
    <div className="p-6 space-y-3">
      <button
        onClick={onNewTransaction}
        className="btn-primary w-full justify-center"
      >
        <Plus className="btn-icon" />
        New Transaction
      </button>
      <button className="btn-quick-action">
        <Heart className="btn-icon" />
        Record Donation
      </button>
      <button className="btn-quick-action">
        <Minus className="btn-icon" />
        Add Expense
      </button>
      <button className="btn-quick-action">
        <Upload className="btn-icon" />
        Import Transactions
      </button>
      <button className="btn-quick-action">
        <FileText className="btn-icon" />
        Generate Tax Report
      </button>
    </div>
  </div>
)

/** Main dashboard page showing portfolio overview, account balances, recent transactions, and quick actions */
const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { settings: currencySettings } = useCurrency()
  const { theme } = useTheme()

  const handleNewTransaction = useCallback(() => {
    navigate('/transactions/new')
  }, [navigate])

  const [accountBalances] = useState<AccountBalance[]>([
    { crypto: 'DOT', amount: 2000, usdValue: 15000, change24h: 2.3 },
    { crypto: 'GLMR', amount: 40000, usdValue: 12000, change24h: 3.4 },
    { crypto: 'KSM', amount: 160, usdValue: 7200, change24h: -1.2 },
    { crypto: 'ASTR', amount: 100000, usdValue: 7000, change24h: 1.8 },
    { crypto: 'iBTC', amount: 0.1, usdValue: 6700, change24h: 2.1 },
    { crypto: 'BNC', amount: 7000, usdValue: 2100, change24h: 0.9 },
  ])

  const [recentTransactions] = useState<Transaction[]>([
    {
      id: '1',
      date: '2025-10-09',
      description: 'Donation from Anonymous',
      type: 'donation',
      crypto: 'DOT',
      amount: 150,
      usdValue: 1125,
      status: 'completed',
    },
    {
      id: '2',
      date: '2025-10-09',
      description: 'Program Expense - Education',
      type: 'expense',
      crypto: 'GLMR',
      amount: -2000,
      usdValue: -600,
      status: 'completed',
    },
    {
      id: '3',
      date: '2025-10-08',
      description: 'XCM Transfer DOT to Moonbeam',
      type: 'exchange',
      crypto: 'DOT',
      amount: -50,
      usdValue: 375,
      status: 'completed',
    },
    {
      id: '4',
      date: '2025-10-08',
      description: 'Staking Rewards - Polkadot',
      type: 'transfer',
      crypto: 'DOT',
      amount: 12,
      usdValue: 90,
      status: 'completed',
    },
    {
      id: '5',
      date: '2025-10-07',
      description: 'Parachain Crowdloan Reward',
      type: 'donation',
      crypto: 'ASTR',
      amount: 5000,
      usdValue: 350,
      status: 'pending',
    },
  ])

  const totalPortfolioValue = accountBalances.reduce(
    (sum, acc) => sum + acc.usdValue,
    0
  )
  const portfolioChange = 2.8 // This would be calculated from actual data

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'donation':
        return 'change-positive bg-[#166534]/8'
      case 'expense':
        return 'change-negative bg-[#991B1B]/8'
      case 'exchange':
        return 'text-[#5D2A2C] dark:text-[#c08589] bg-[#5D2A2C]/8'
      case 'transfer':
        return 'text-[#6B5D2E] dark:text-[#d4b87a] bg-[#c9a961]/10'
      default:
        return 'dashboard-body-text bg-[#fafaf8] dark:bg-[#1a1815]'
    }
  }

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-[#fafaf8] dark:bg-[#0f0e0c] border-b border-[rgba(201,169,97,0.15)]">
        <div className="max-w-7xl mx-auto px-10 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1>Dashboard</h1>
              <p className="text-sm dashboard-body-text mt-1">
                Welcome back! Here&apos;s your crypto portfolio overview.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="btn-secondary">
                <Download className="btn-icon" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-10 py-10">
        {/* Key Metrics — Hero (2 cols) + 2 standard cards on row 1, 2 cards on row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Hero card spans 2 columns */}
          <div className="md:col-span-2 lg:col-span-2">
            <StatsCard
              title="Total Portfolio Value"
              variant="hero"
              sparklineData={portfolioSparkline}
              value={formatCurrency(
                totalPortfolioValue,
                currencySettings.primaryCurrency,
                {
                  decimalPlaces: currencySettings.decimalPlaces,
                  useThousandsSeparator: currencySettings.useThousandsSeparator,
                  decimalSeparatorStandard:
                    currencySettings.decimalSeparatorStandard,
                }
              )}
              changeIcon={
                portfolioChange >= 0 ? (
                  <TrendingUp className="w-4 h-4 change-positive mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 change-negative mr-1" />
                )
              }
              changeColor={
                portfolioChange >= 0 ? 'change-positive' : 'change-negative'
              }
              changeValue={`${portfolioChange >= 0 ? '+' : ''}${portfolioChange}%`}
              changeLabel="24h"
              icon={<Wallet />}
            />
          </div>
          <StatsCard
            title="Total Donations (YTD)"
            value={formatCurrency(38500, currencySettings.primaryCurrency, {
              decimalPlaces: currencySettings.decimalPlaces,
              useThousandsSeparator: currencySettings.useThousandsSeparator,
              decimalSeparatorStandard:
                currencySettings.decimalSeparatorStandard,
            })}
            changeIcon={
              <ArrowUpRight className="w-4 h-4 change-positive mr-1" />
            }
            changeColor="change-positive"
            changeValue="+12.5%"
            changeLabel="vs last year"
            icon={<DollarSign />}
          />
          <StatsCard
            title="Program Expenses"
            value={formatCurrency(8200, currencySettings.primaryCurrency, {
              decimalPlaces: currencySettings.decimalPlaces,
              useThousandsSeparator:
                currencySettings.useThousandsSeparator,
              decimalSeparatorStandard:
                currencySettings.decimalSeparatorStandard,
            })}
            changeIcon={
              <ArrowDownRight className="w-4 h-4 change-negative mr-1" />
            }
            changeColor="change-negative"
            changeValue="-5.2%"
            changeLabel="vs last year"
            icon={<TrendingDown />}
          />
          <StatsCard
            title="Program Expenses (YTD)"
            value={formatCurrency(28250, currencySettings.primaryCurrency, {
              decimalPlaces: currencySettings.decimalPlaces,
              useThousandsSeparator:
                currencySettings.useThousandsSeparator,
              decimalSeparatorStandard:
                currencySettings.decimalSeparatorStandard,
            })}
            changeIcon={null}
            changeColor="dashboard-body-text"
            changeValue="73.4%"
            changeLabel="of donations"
            icon={<PieChart />}
          />
          <StatsCard
            title="Active Wallets"
            value="6"
            changeIcon={null}
            changeColor="dashboard-body-text"
            changeValue="4 blockchains"
            icon={<BarChart3 />}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Account Balances - Takes up 2/3 on large screens */}
          <div className="lg:col-span-2">
            <AccountBalancesList
              accountBalances={accountBalances}
              currencySettings={currencySettings}
              theme={theme}
            />
            <RecentTransactionsTable
              recentTransactions={recentTransactions}
              currencySettings={currencySettings}
              getTypeColor={getTypeColor}
            />
          </div>

          {/* Quick Actions Sidebar - Takes up 1/3 on large screens */}
          <div className="space-y-6">
            <QuickActionsCard onNewTransaction={handleNewTransaction} />

            {/* Compliance Status */}
            <div className="ledger-card border border-[rgba(201,169,97,0.15)]">
              <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
                <h2>Compliance Status</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm dashboard-body-text">
                    Tax Year 2025
                  </span>
                  <span className="status-pill status-pill-success">
                    On Track
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm dashboard-body-text">
                    IRS Form 990
                  </span>
                  <span className="status-pill status-pill-warning">
                    Due Soon
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm dashboard-body-text">
                    Audit Ready
                  </span>
                  <span className="status-pill status-pill-success">Yes</span>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="ledger-card border border-[rgba(201,169,97,0.15)]">
              <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
                <h2>Alerts</h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="alert-toast alert-toast-warning">
                    <p className="text-sm font-medium text-soft-warning dark:text-[#fbbf24]">
                      Pending Approval
                    </p>
                    <p className="text-xs dashboard-body-text mt-1">
                      2 transactions need review
                    </p>
                  </div>
                  <div className="alert-toast alert-toast-danger">
                    <p className="text-sm font-medium text-soft-danger dark:text-[#f87171]">
                      Price Alert
                    </p>
                    <p className="text-xs dashboard-body-text mt-1">
                      BTC reached target price
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
