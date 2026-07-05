import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  Plus,
  Download,
  Heart,
  Minus,
  Upload,
  FileText,
  Inbox,
} from 'lucide-react'
import { useCurrency } from '../../contexts/CurrencyContext'
import { DecimalSeparatorStandard } from '../../types/currency'
import { useTheme } from '../../contexts/ThemeContext'
import { formatCurrency } from '../../utils/currencyFormatter'
import { getCryptoLogoPath, getCryptoBrandColor } from '../../utils/cryptoLogos'
import { useWalletBalances } from '../../hooks/useWalletBalances'
import { useProfile } from '../../contexts/ProfileContext'
import { persistence } from '../../services/persistence'
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
            className={`font-bold text-[#11202B] dark:text-[#EAF3F2] mt-2 dashboard-heading ${isHero ? 'text-4xl' : 'text-3xl'}`}
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
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-4">
          <SparklineChart data={sparklineData} />
        </div>
      )}
    </div>
  )
}

/** Empty state placeholder for sections with no data */
const EmptyState: React.FC<{
  icon: React.ReactNode
  title: string
  message: string
}> = ({ icon, title, message }) => (
  <div className="p-12 text-center">
    <div className="mx-auto h-12 w-12 text-[#647D8B]">{icon}</div>
    <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
      {title}
    </h3>
    <p className="mt-1 text-sm dashboard-muted-text">
      {message}
    </p>
  </div>
)

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
  <div className="ledger-card border border-[rgba(95,227,192,0.15)]">
    <div className="px-6 py-4 border-b border-[rgba(95,227,192,0.15)]">
      <p className="eyebrow">Assets</p>
      <h2>Account Balances</h2>
    </div>
    {accountBalances.length === 0 ? (
      <EmptyState
        icon={<Wallet className="w-12 h-12" />}
        title="No wallets connected"
        message="Connect a wallet or add a tracked address to see your balances."
      />
    ) : (
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
                    <p className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
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
                  <p className="font-semibold text-[#11202B] dark:text-[#EAF3F2] dashboard-mono">
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
    )}
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
  <div className="ledger-card border border-[rgba(95,227,192,0.15)] mt-10">
    <div className="px-6 py-4 border-b border-[rgba(95,227,192,0.15)] flex items-center justify-between">
      <div>
        <p className="eyebrow">Activity</p>
        <h2>Recent Transactions</h2>
      </div>
      <button className="text-sm dashboard-link">
        View All
      </button>
    </div>
    {recentTransactions.length === 0 ? (
      <EmptyState
        icon={<Inbox className="w-12 h-12" />}
        title="No transactions yet"
        message="Sync a wallet to see your transaction history here."
      />
    ) : (
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
                <td className="ledger-table-cell-date whitespace-nowrap text-sm text-[#11202B] dark:text-[#EAF3F2]">
                  {tx.date}
                </td>
                <td className="ledger-table-cell-text text-sm text-[#11202B] dark:text-[#EAF3F2]">
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
                        : 'text-[#11202B] dark:text-[#EAF3F2]'
                    }
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {tx.amount.toLocaleString()} {tx.crypto}
                  </span>
                </td>
                <td className="ledger-table-cell-number whitespace-nowrap text-sm text-[#11202B] dark:text-[#EAF3F2] dashboard-mono">
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
    )}
  </div>
)

/** Sidebar card with quick action buttons for common tasks like recording donations and generating reports */
const QuickActionsCard: React.FC<{ onNewTransaction: () => void }> = ({ onNewTransaction }) => (
  <div className="ledger-card border border-[rgba(95,227,192,0.15)]">
    <div className="px-6 py-4 border-b border-[rgba(95,227,192,0.15)]">
      <p className="eyebrow">Workspace</p>
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

/** Map a StoredTransaction tx_type to the dashboard Transaction type */
function mapTxType(txType: string | null | undefined): 'donation' | 'expense' | 'transfer' | 'exchange' {
  switch (txType) {
    case 'donation':
      return 'donation'
    case 'expense':
      return 'expense'
    case 'exchange':
    case 'swap':
      return 'exchange'
    default:
      return 'transfer'
  }
}

/** Derive account balances from WalletBalances data */
function deriveAccountBalances(
  balances: Array<{
    native_balance: { symbol: string; balance: string; decimals: number; value_usd: number | null }
    token_balances: Array<{ symbol: string; balance: string; decimals: number; value_usd: number | null }>
    total_value_usd: number | null
  }> | null
): AccountBalance[] {
  if (!balances || balances.length === 0) return []

  const aggregated = new Map<string, { amount: number; usdValue: number }>()

  for (const wb of balances) {
    const nativeSymbol = wb.native_balance.symbol.toUpperCase()
    const nativeAmount = Number(wb.native_balance.balance) / Math.pow(10, wb.native_balance.decimals)
    const nativeUsd = wb.native_balance.value_usd ?? 0
    const existing = aggregated.get(nativeSymbol)
    if (existing) {
      existing.amount += nativeAmount
      existing.usdValue += nativeUsd
    } else {
      aggregated.set(nativeSymbol, { amount: nativeAmount, usdValue: nativeUsd })
    }

    for (const tb of wb.token_balances) {
      const symbol = tb.symbol.toUpperCase()
      const amount = Number(tb.balance) / Math.pow(10, tb.decimals)
      const usd = tb.value_usd ?? 0
      const ex = aggregated.get(symbol)
      if (ex) {
        ex.amount += amount
        ex.usdValue += usd
      } else {
        aggregated.set(symbol, { amount, usdValue: usd })
      }
    }
  }

  return Array.from(aggregated.entries())
    .map(([crypto, data]) => ({
      crypto,
      amount: data.amount,
      usdValue: data.usdValue,
      change24h: 0, // 24h change requires historical price data; honest zero
    }))
    .filter(b => b.usdValue > 0 || b.amount > 0)
    .sort((a, b) => b.usdValue - a.usdValue)
}

/** Main dashboard page showing portfolio overview, account balances, recent transactions, and quick actions */
const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { settings: currencySettings } = useCurrency()
  const { theme } = useTheme()
  const { currentProfile } = useProfile()
  const { balances, wallets, isLoading: walletsLoading } = useWalletBalances()

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(true)

  const handleNewTransaction = useCallback(() => {
    navigate('/transactions/new')
  }, [navigate])

  // Derive account balances from real wallet data
  const accountBalances = useMemo(() => deriveAccountBalances(balances), [balances])

  const totalPortfolioValue = useMemo(
    () => accountBalances.reduce((sum, acc) => sum + acc.usdValue, 0),
    [accountBalances]
  )

  // Load recent transactions from persistence
  useEffect(() => {
    let cancelled = false
    const loadTransactions = async () => {
      if (!currentProfile) {
        setRecentTransactions([])
        setTxLoading(false)
        return
      }
      try {
        const stored = await persistence.getAllTransactions(currentProfile.id, {
          limit: 10,
          offset: 0,
        })
        if (cancelled) return

        const mapped: Transaction[] = stored
          .sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
            return tb - ta
          })
          .slice(0, 5)
          .map(tx => {
            const amount = tx.value ? Number(tx.value) / Math.pow(10, tx.token_decimals ?? 18) : 0
            const usdValue = tx.price_at_acquisition_usd ? amount * Number(tx.price_at_acquisition_usd) : 0
            return {
              id: tx.id,
              date: tx.timestamp ? new Date(tx.timestamp).toISOString().slice(0, 10) : 'Unknown',
              description: tx.hash ? `Tx ${tx.hash.slice(0, 8)}…${tx.hash.slice(-6)}` : 'Transaction',
              type: mapTxType(tx.tx_type),
              crypto: tx.token_symbol ?? tx.chain.toUpperCase(),
              amount: tx.tx_type === 'expense' ? -Math.abs(amount) : amount,
              usdValue: tx.tx_type === 'expense' ? -Math.abs(usdValue) : usdValue,
              status: tx.status === 'pending' ? 'pending' : 'completed',
            }
          })
        setRecentTransactions(mapped)
      } catch {
        // Persistence may not be available yet; show empty state
        setRecentTransactions([])
      } finally {
        if (!cancelled) setTxLoading(false)
      }
    }
    loadTransactions()
    return () => {
      cancelled = true
    }
  }, [currentProfile])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'donation':
        return 'badge-donation'
      case 'expense':
        return 'badge-expense'
      case 'exchange':
        return 'badge-exchange'
      case 'transfer':
        return 'badge-transfer'
      default:
        return 'badge-info'
    }
  }

  const isLoading = walletsLoading || txLoading

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-[#F7FAFA] dark:bg-[#0C141B] border-b border-[rgba(95,227,192,0.15)]">
        <div className="max-w-7xl mx-auto px-10 py-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Overview</p>
              <h1>Dashboard</h1>
              <p className="text-sm dashboard-body-text mt-1">
                {wallets.length > 0
                  ? `Tracking ${wallets.length} wallet${wallets.length === 1 ? '' : 's'}.`
                  : 'Connect a wallet to see your portfolio overview.'}
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
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Hero card spans 2 columns */}
          <div className="md:col-span-2 lg:col-span-2">
            <StatsCard
              title="Total Portfolio Value"
              variant="hero"
              value={
                isLoading
                  ? '—'
                  : wallets.length === 0
                    ? '—'
                    : formatCurrency(
                        totalPortfolioValue,
                        currencySettings.primaryCurrency,
                        {
                          decimalPlaces: currencySettings.decimalPlaces,
                          useThousandsSeparator: currencySettings.useThousandsSeparator,
                          decimalSeparatorStandard:
                            currencySettings.decimalSeparatorStandard,
                        }
                      )
              }
              changeIcon={null}
              changeColor="dashboard-body-text"
              changeValue={wallets.length === 0 ? 'No wallets connected' : ''}
              icon={<Wallet />}
            />
          </div>
          <StatsCard
            title="Active Wallets"
            value={isLoading ? '—' : String(wallets.length)}
            changeIcon={null}
            changeColor="dashboard-body-text"
            changeValue={
              accountBalances.length > 0
                ? `${accountBalances.length} asset${accountBalances.length === 1 ? '' : 's'}`
                : ''
            }
            icon={<BarChart3 />}
          />
          <StatsCard
            title="Recent Transactions"
            value={isLoading ? '—' : String(recentTransactions.length)}
            changeIcon={null}
            changeColor="dashboard-body-text"
            changeValue={recentTransactions.length > 0 ? 'Latest activity' : 'No activity yet'}
            icon={<PieChart />}
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
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
