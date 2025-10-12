import React, { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  BarChart3,
} from 'lucide-react'

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
  const [accountBalances] = useState<AccountBalance[]>([
    { crypto: 'BTC', amount: 2.456, usdValue: 164850, change24h: 2.3 },
    { crypto: 'ETH', amount: 15.8, usdValue: 47400, change24h: -1.2 },
    { crypto: 'USDC', amount: 25000, usdValue: 25000, change24h: 0.0 },
    { crypto: 'SOL', amount: 450, usdValue: 67500, change24h: 5.7 },
  ])

  const [recentTransactions] = useState<Transaction[]>([
    {
      id: '1',
      date: '2025-10-09',
      description: 'Donation from Anonymous',
      type: 'donation',
      crypto: 'BTC',
      amount: 0.5,
      usdValue: 33500,
      status: 'completed',
    },
    {
      id: '2',
      date: '2025-10-09',
      description: 'Program Expense - Education',
      type: 'expense',
      crypto: 'ETH',
      amount: -2.0,
      usdValue: -6000,
      status: 'completed',
    },
    {
      id: '3',
      date: '2025-10-08',
      description: 'Exchange BTC to USDC',
      type: 'exchange',
      crypto: 'BTC',
      amount: -0.3,
      usdValue: 20100,
      status: 'completed',
    },
    {
      id: '4',
      date: '2025-10-08',
      description: 'Transfer to Cold Storage',
      type: 'transfer',
      crypto: 'BTC',
      amount: -1.0,
      usdValue: 67000,
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
        return 'text-green-600 bg-green-50'
      case 'expense':
        return 'text-red-600 bg-red-50'
      case 'exchange':
        return 'text-blue-600 bg-blue-50'
      case 'transfer':
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Welcome back! Here&apos;s your crypto portfolio overview.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Export Report
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                New Transaction
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Portfolio Value */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Portfolio Value
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  ${totalPortfolioValue.toLocaleString()}
                </p>
                <div className="flex items-center mt-2">
                  {portfolioChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                  )}
                  <span
                    className={`text-sm font-medium ${portfolioChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {portfolioChange >= 0 ? '+' : ''}
                    {portfolioChange}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">24h</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Donations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Donations (YTD)
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  $425,600
                </p>
                <div className="flex items-center mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm font-medium text-green-600">
                    +12.5%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    vs last year
                  </span>
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Program Expenses */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Program Expenses (YTD)
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  $312,450
                </p>
                <div className="flex items-center mt-2">
                  <ArrowDownRight className="w-4 h-4 text-red-600 mr-1" />
                  <span className="text-sm font-medium text-gray-600">
                    73.4%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    of donations
                  </span>
                </div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <PieChart className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Active Wallets */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Active Wallets
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">8</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm font-medium text-gray-600">
                    4 blockchains
                  </span>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Account Balances - Takes up 2/3 on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Account Balances
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {accountBalances.map(account => (
                    <div
                      key={account.crypto}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            {account.crypto}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {account.crypto}
                          </p>
                          <p className="text-sm text-gray-500">
                            {account.amount.toLocaleString()} {account.crypto}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ${account.usdValue.toLocaleString()}
                        </p>
                        <div className="flex items-center justify-end mt-1">
                          {account.change24h >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
                          )}
                          <span
                            className={`text-sm ${account.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {account.change24h >= 0 ? '+' : ''}
                            {account.change24h}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent Transactions
                </h2>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        USD Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tx.date}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {tx.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}
                          >
                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={
                              tx.amount >= 0
                                ? 'text-green-600'
                                : 'text-gray-900'
                            }
                          >
                            {tx.amount >= 0 ? '+' : ''}
                            {tx.amount} {tx.crypto}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${Math.abs(tx.usdValue).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Quick Actions
                </h2>
              </div>
              <div className="p-6 space-y-3">
                <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-left">
                  Record Donation
                </button>
                <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-left">
                  Add Expense
                </button>
                <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-left">
                  Import Transactions
                </button>
                <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-left">
                  Generate Tax Report
                </button>
              </div>
            </div>

            {/* Compliance Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Compliance Status
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tax Year 2025</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800 bg-green-100">
                    On Track
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">IRS Form 990</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-yellow-800 bg-yellow-100">
                    Due Soon
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Audit Ready</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800 bg-green-100">
                    Yes
                  </span>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
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
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">
                      Price Alert
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
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
