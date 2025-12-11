import React, { useState } from 'react'
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
import { useTheme } from '../../contexts/ThemeContext'
import { formatCurrency } from '../../utils/currencyFormatter'
import { getCryptoLogoPath, getCryptoBrandColor } from '../../utils/cryptoLogos'

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

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { settings: currencySettings } = useCurrency()
  const { theme } = useTheme()

  const [accountBalances] = useState<AccountBalance[]>([
    { crypto: 'DOT', amount: 1250.5, usdValue: 9378.75, change24h: 2.3 },
    { crypto: 'KSM', amount: 185.3, usdValue: 8338.5, change24h: -1.2 },
    { crypto: 'GLMR', amount: 45000, usdValue: 13500, change24h: 3.4 },
    { crypto: 'ASTR', amount: 125000, usdValue: 8750, change24h: 1.8 },
    { crypto: 'BNC', amount: 8500, usdValue: 2550, change24h: 0.9 },
    { crypto: 'iBTC', amount: 0.15, usdValue: 10050, change24h: 2.1 },
  ])

  const [recentTransactions] = useState<Transaction[]>([
    {
      id: '1',
      date: '2025-10-09',
      description: 'Donation from Anonymous',
      type: 'donation',
      crypto: 'DOT',
      amount: 500,
      usdValue: 3750,
      status: 'completed',
    },
    {
      id: '2',
      date: '2025-10-09',
      description: 'Program Expense - Education',
      type: 'expense',
      crypto: 'GLMR',
      amount: -5000,
      usdValue: -1500,
      status: 'completed',
    },
    {
      id: '3',
      date: '2025-10-08',
      description: 'XCM Transfer DOT to Moonbeam',
      type: 'exchange',
      crypto: 'DOT',
      amount: -100,
      usdValue: 750,
      status: 'completed',
    },
    {
      id: '4',
      date: '2025-10-08',
      description: 'Staking Rewards - Polkadot',
      type: 'transfer',
      crypto: 'DOT',
      amount: 25.5,
      usdValue: 191.25,
      status: 'completed',
    },
    {
      id: '5',
      date: '2025-10-07',
      description: 'Parachain Crowdloan Reward',
      type: 'donation',
      crypto: 'ASTR',
      amount: 10000,
      usdValue: 700,
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
        return 'text-[#059669] dark:text-[#10b981] bg-[#059669]/10'
      case 'expense':
        return 'text-[#dc2626] dark:text-[#ef4444] bg-[#dc2626]/10'
      case 'exchange':
        return 'text-[#1e3a5f] dark:text-[#3d5a80] bg-[#1e3a5f]/10'
      case 'transfer':
        return 'text-[#4a5f7a] dark:text-[#6b8099] bg-[#4a5f7a]/10'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-10 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1>
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Welcome back! Here&apos;s your crypto portfolio overview.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="btn-secondary">
                <Download className="btn-icon" />
                Export Report
              </button>
              <button
                onClick={() => navigate('/transactions/new')}
                className="btn-primary"
              >
                <Plus className="btn-icon" />
                New Transaction
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-10 py-10">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Portfolio Value */}
          <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="ledger-card-label font-medium text-gray-500 dark:text-gray-400">
                  Total Portfolio Value
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight tabular-nums">
                  {formatCurrency(
                    totalPortfolioValue,
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
                <div className="flex items-center mt-2">
                  {portfolioChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#059669] dark:text-[#10b981] mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#dc2626] dark:text-[#ef4444] mr-1" />
                  )}
                  <span
                    className={`text-sm font-medium ${portfolioChange >= 0 ? 'text-[#059669] dark:text-[#10b981]' : 'text-[#dc2626] dark:text-[#ef4444]'}`}
                  >
                    {portfolioChange >= 0 ? '+' : ''}
                    {portfolioChange}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">24h</span>
                </div>
              </div>
              <div className="p-3 bg-[#1e3a5f]/10 dark:bg-[#3d5a80]/20 rounded-lg">
                <Wallet className="w-6 h-6 text-[#1e3a5f] dark:text-[#3d5a80]" />
              </div>
            </div>
          </div>

          {/* Total Donations */}
          <div className="ledger-card ledger-card-donation border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="ledger-card-label font-medium text-gray-500 dark:text-gray-400">
                  Total Donations (YTD)
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight tabular-nums">
                  {formatCurrency(425600, currencySettings.primaryCurrency, {
                    decimalPlaces: currencySettings.decimalPlaces,
                    useThousandsSeparator:
                      currencySettings.useThousandsSeparator,
                    decimalSeparatorStandard:
                      currencySettings.decimalSeparatorStandard,
                  })}
                </p>
                <div className="flex items-center mt-2">
                  <ArrowUpRight className="w-4 h-4 text-[#059669] dark:text-[#10b981] mr-1" />
                  <span className="text-sm font-medium text-[#059669] dark:text-[#10b981]">
                    +12.5%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    vs last year
                  </span>
                </div>
              </div>
              <div className="p-3 bg-[#059669]/10 dark:bg-[#10b981]/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-[#059669] dark:text-[#10b981]" />
              </div>
            </div>
          </div>

          {/* Program Expenses */}
          <div className="ledger-card ledger-card-expense border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="ledger-card-label font-medium text-gray-500 dark:text-gray-400">
                  Program Expenses (YTD)
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight tabular-nums">
                  {formatCurrency(312450, currencySettings.primaryCurrency, {
                    decimalPlaces: currencySettings.decimalPlaces,
                    useThousandsSeparator:
                      currencySettings.useThousandsSeparator,
                    decimalSeparatorStandard:
                      currencySettings.decimalSeparatorStandard,
                  })}
                </p>
                <div className="flex items-center mt-2">
                  <ArrowDownRight className="w-4 h-4 text-[#dc2626] dark:text-[#ef4444] mr-1" />
                  <span className="text-sm font-medium text-gray-600">
                    73.4%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    of donations
                  </span>
                </div>
              </div>
              <div className="p-3 bg-[#dc2626]/10 dark:bg-[#ef4444]/20 rounded-lg">
                <PieChart className="w-6 h-6 text-[#dc2626] dark:text-[#ef4444]" />
              </div>
            </div>
          </div>

          {/* Active Wallets */}
          <div className="ledger-card ledger-card-wallet border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="ledger-card-label font-medium text-gray-500 dark:text-gray-400">
                  Active Wallets
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">
                  8
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm font-medium text-gray-600">
                    4 blockchains
                  </span>
                </div>
              </div>
              <div className="p-3 bg-[#4a5f7a]/10 dark:bg-[#6b8099]/10 rounded-lg">
                <BarChart3 className="w-6 h-6 text-[#4a5f7a] dark:text-[#6b8099]" />
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Account Balances - Takes up 2/3 on large screens */}
          <div className="lg:col-span-2">
            <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2>
                  Account Balances
                </h2>
              </div>
              <div className="px-6">
                <div>
                  {accountBalances.map(account => {
                    const logoPath = getCryptoLogoPath(account.crypto, theme)
                    const brandColor = getCryptoBrandColor(account.crypto)

                    return (
                      <div
                        key={account.crypto}
                        className="balance-list-item"
                      >
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
                            <p className="font-medium text-gray-900 dark:text-white">
                              {account.crypto}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                              {account.amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {account.crypto}
                            </p>
                          </div>
                        </div>
                        <div className="token-values">
                          <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
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
                          <div className={`percentage-change ${account.change24h >= 0 ? 'text-[#059669] dark:text-[#10b981]' : 'text-[#dc2626] dark:text-[#ef4444]'}`}>
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

            {/* Recent Transactions */}
            <div className="ledger-card ledger-card-wallet border border-gray-200 dark:border-gray-700 mt-8">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2>
                  Recent Transactions
                </h2>
                <button className="text-sm text-[#1e3a5f] dark:text-[#3d5a80] hover:opacity-90 font-medium">
                  View All
                </button>
              </div>
              <div className="ledger-table-wrapper">
                <table className="ledger-table">
                  <thead className="ledger-table-header">
                    <tr>
                      <th className="ledger-table-cell-date">
                        Date
                      </th>
                      <th className="ledger-table-cell-text">
                        Description
                      </th>
                      <th className="ledger-table-cell-text">
                        Type
                      </th>
                      <th className="ledger-table-cell-number">
                        Amount
                      </th>
                      <th className="ledger-table-cell-number">
                        Value
                      </th>
                      <th className="ledger-table-cell-text">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map(tx => (
                      <tr
                        key={tx.id}
                        className="ledger-table-row"
                      >
                        <td className="ledger-table-cell-date whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {tx.date}
                        </td>
                        <td className="ledger-table-cell-text text-sm text-gray-900 dark:text-white">
                          {tx.description}
                        </td>
                        <td className="ledger-table-cell-text whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}
                          >
                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </span>
                        </td>
                        <td className="ledger-table-cell-number whitespace-nowrap text-sm tabular-nums">
                          <span
                            className={
                              tx.amount >= 0
                                ? 'text-[#059669] dark:text-[#10b981]'
                                : 'text-gray-900 dark:text-white'
                            }
                          >
                            {tx.amount >= 0 ? '+' : ''}
                            {tx.amount.toLocaleString()} {tx.crypto}
                          </span>
                        </td>
                        <td className="ledger-table-cell-number whitespace-nowrap text-sm text-gray-900 dark:text-white tabular-nums">
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
                                ? 'text-green-800 bg-green-100'
                                : 'text-yellow-800 bg-yellow-100'
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
          </div>

          {/* Quick Actions Sidebar - Takes up 1/3 on large screens */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="ledger-card ledger-card-wallet border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2>
                  Quick Actions
                </h2>
              </div>
              <div className="p-6 space-y-3">
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

            {/* Compliance Status */}
            <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2>
                  Compliance Status
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Tax Year 2025
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800 bg-green-100">
                    On Track
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    IRS Form 990
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-yellow-800 bg-yellow-100">
                    Due Soon
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Audit Ready
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800 bg-green-100">
                    Yes
                  </span>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="ledger-card ledger-card-expense border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2>
                  Alerts
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">
                      Pending Approval
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      2 transactions need review
                    </p>
                  </div>
                  <div className="p-3 bg-[#1e3a5f]/10 dark:bg-[#3d5a80]/20 border border-[#1e3a5f]/20 dark:border-[#3d5a80]/30 rounded-lg">
                    <p className="text-sm font-medium text-[#1e3a5f] dark:text-[#3d5a80]">
                      Price Alert
                    </p>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
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
