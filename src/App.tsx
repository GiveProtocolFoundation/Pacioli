import React, { Suspense } from 'react'
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import { ConfigProvider, theme as antdTheme } from 'antd'
import Navigation from './components/layout/Navigation'
import { isTauriAvailable } from './utils/tauri'
import { useTheme } from './contexts/ThemeContext'
import { TransactionProvider } from './contexts/TransactionContext'
import { TokenProvider } from './contexts/TokenContext'
import { WalletAliasProvider } from './contexts/WalletAliasContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { EntityProvider } from './contexts/EntityContext'
import { NavBadgeProvider } from './contexts/NavBadgeContext'
import { AppProvider, useApp } from './contexts/AppContext'
import { useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { UnlockScreen } from './components/security'
import { FirstLaunch } from './components/onboarding'

// Lazy load route components for code splitting
const Dashboard = React.lazy(() => import('./app/dashboard/Dashboard'))
const Transactions = React.lazy(() => import('./app/transactions/Transactions'))
const TransactionForm = React.lazy(
  () => import('./app/transactions/TransactionForm')
)
const Onboarding = React.lazy(() => import('./app/onboarding/Onboarding'))
const Balances = React.lazy(() => import('./app/wallets/Balances'))
const Settings = React.lazy(() => import('./app/settings/Settings'))
const Reports = React.lazy(() => import('./app/reports/Reports'))
const Analytics = React.lazy(() => import('./app/analytics/Analytics'))
const Support = React.lazy(() => import('./app/support/Support'))
const Profile = React.lazy(() => import('./app/profile/Profile'))
const Docs = React.lazy(() => import('./app/docs/Docs'))
const WalletManager = React.lazy(() => import('./app/wallets/WalletManager'))
const Entities = React.lazy(() => import('./app/entities/Entities'))
const CostBasisReport = React.lazy(
  () => import('./app/reports/CostBasisReport')
)
const Team = React.lazy(() => import('./app/team/Team'))
const JournalEntries = React.lazy(
  () => import('./app/journal-entries/JournalEntries')
)
const ChartOfAccounts = React.lazy(() => import('./app/ledger/ChartOfAccounts'))
const TrialBalance = React.lazy(() => import('./app/ledger/TrialBalance'))
const Reconciliation = React.lazy(() => import('./app/ledger/Reconciliation'))
const ClassificationQueue = React.lazy(
  () => import('./app/classification/ClassificationQueue')
)
const ClassificationRules = React.lazy(
  () => import('./app/classification/ClassificationRules')
)
const AccountingPeriods = React.lazy(
  () => import('./app/accounting-periods/AccountingPeriods')
)
const BalanceSheetReport = React.lazy(
  () => import('./app/reports/BalanceSheet')
)
const IncomeStatementReport = React.lazy(
  () => import('./app/reports/IncomeStatement')
)
const PeriodTrialBalance = React.lazy(
  () => import('./app/reports/PeriodTrialBalance')
)
const StatementOfActivities = React.lazy(
  () => import('./app/reports/StatementOfActivities')
)

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-[#F7FAFA] dark:bg-[#0C141B] flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#294050] dark:border-[#F09988]" />
      <p className="mt-4 text-[#294050] dark:text-[#9FB4BE]">Loading...</p>
    </div>
  </div>
)

// Composed providers to reduce JSX nesting depth
const DataProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <TokenProvider>
    <WalletAliasProvider>
      <NotificationProvider>
        <NavBadgeProvider>
          <TransactionProvider userAccountType="organization">
            {children}
          </TransactionProvider>
        </NavBadgeProvider>
      </NotificationProvider>
    </WalletAliasProvider>
  </TokenProvider>
)

/**
 * Composed provider component that wraps app with profile, entity, and data contexts.
 */
const AppProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ProfileProvider>
    <EntityProvider>
      <DataProviders>{children}</DataProviders>
    </EntityProvider>
  </ProfileProvider>
)

/**
 * Handles page reload for retry button.
 */
const handleRetry = () => {
  window.location.reload()
}

/**
 * Wrapper component that handles app initialization, first launch, and unlock states.
 */
const AppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appState, isLoading, error, isFirstLaunch, completeFirstLaunch } =
    useApp()

  // Show loading state during initialization
  if (isLoading) {
    return <LoadingFallback />
  }

  // Show error if initialization failed
  if (error && appState === 'Uninitialized') {
    return (
      <div className="min-h-screen bg-[#F7FAFA] dark:bg-[#0C141B] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
            Initialization Failed
          </h1>
          <p className="text-[#294050] dark:text-[#9FB4BE] mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-[#294050] text-white rounded-md hover:bg-[#1E2F3C]"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show first launch wizard for new users
  if (isFirstLaunch) {
    return <FirstLaunch onComplete={completeFirstLaunch} />
  }

  // Show unlock screen if app is locked
  if (appState === 'Locked') {
    return <UnlockScreen />
  }

  // App is ready
  return children as React.ReactElement
}

/**
 * Blocks access to protected routes until onboarding (jurisdiction + account type) is complete.
 * Auth-adjacent screens (FirstLaunch, lock/unlock) are handled by AppWrapper above this gate.
 */
const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { accountType, isLoading } = useAuth()
  const { pathname } = useLocation()

  if (isLoading) {
    return <LoadingFallback />
  }

  if (accountType === null && pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children as React.ReactElement
}

// Main routes wrapped with navigation
const MainRoutes: React.FC = () => (
  <Navigation userType="organization">
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/transactions/new" element={<TransactionForm />} />
      <Route path="/transactions/edit/:id" element={<TransactionForm />} />
      <Route path="/wallets" element={<Balances />} />
      <Route path="/wallet-manager" element={<WalletManager />} />
      <Route path="/entities" element={<Entities />} />
      <Route path="/team" element={<Team />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/reports/cost-basis" element={<CostBasisReport />} />
      <Route path="/reports/financial" element={<Reports />} />
      <Route path="/reports/tax" element={<Reports />} />
      <Route path="/reports/donors" element={<Reports />} />
      <Route path="/reports/compliance" element={<Reports />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/general" element={<Settings />} />
      <Route path="/settings/currencies" element={<Settings />} />
      <Route path="/settings/users" element={<Settings />} />
      <Route path="/settings/data-providers" element={<Settings />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/support" element={<Support />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/classification" element={<ClassificationQueue />} />
      <Route path="/classification-rules" element={<ClassificationRules />} />
      <Route path="/journal-entries" element={<JournalEntries />} />
      <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
      <Route path="/trial-balance" element={<TrialBalance />} />
      <Route path="/ledger/reconciliation" element={<Reconciliation />} />
      <Route path="/accounting-periods" element={<AccountingPeriods />} />
      <Route path="/reports/balance-sheet" element={<BalanceSheetReport />} />
      <Route
        path="/reports/income-statement"
        element={<IncomeStatementReport />}
      />
      <Route path="/reports/trial-balance" element={<PeriodTrialBalance />} />
      <Route
        path="/reports/statement-of-activities"
        element={<StatementOfActivities />}
      />
    </Routes>
  </Navigation>
)

const Router = isTauriAvailable() ? HashRouter : BrowserRouter

/**
 * Wraps Ant Design's ConfigProvider with brand tokens, switching the antd
 * algorithm between light/dark based on the app ThemeContext.
 */
const BrandedAntdProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#5FE3C0',
          colorInfo: '#5FE3C0',
          colorSuccess: isDark ? '#5FE3C0' : '#2E9A82',
          colorWarning: isDark ? '#E8B36F' : '#B07A2F',
          colorError: isDark ? '#E8836F' : '#B0533F',
          colorTextBase: isDark ? '#EAF3F2' : '#0C141B',
          colorBgBase: isDark ? '#0C141B' : '#F7FAFA',
          colorBgContainer: isDark ? '#11202B' : '#FFFFFF',
          colorBgElevated: isDark ? '#16242F' : '#FFFFFF',
          colorBorder: isDark
            ? 'rgba(150,180,196,0.18)'
            : 'rgba(150,180,196,0.28)',
          colorBorderSecondary: 'rgba(150,180,196,0.12)',
          fontFamily:
            "'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}

/** Gated routes — onboarding redirect + lazy-loaded page tree. */
const AppRoutes: React.FC = () => (
  <OnboardingGate>
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/login"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="/register"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route path="/*" element={<MainRoutes />} />
      </Routes>
    </Suspense>
  </OnboardingGate>
)

/**
 * Root application component with routing and provider hierarchy.
 */
const App: React.FC = () => (
  <Router>
    <LanguageProvider>
      <AppProvider>
        <AppWrapper>
          <AppProviders>
            <BrandedAntdProvider>
              <AppRoutes />
            </BrandedAntdProvider>
          </AppProviders>
        </AppWrapper>
      </AppProvider>
    </LanguageProvider>
  </Router>
)

export default App
