import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navigation from './components/layout/Navigation'
import { TransactionProvider } from './contexts/TransactionContext'
import { TokenProvider } from './contexts/TokenContext'
import { WalletAliasProvider } from './contexts/WalletAliasContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { EntityProvider } from './contexts/EntityContext'
import { AppProvider, useApp } from './contexts/AppContext'
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
const Team = React.lazy(() => import('./app/team/Team'))

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-[#fafaf8] dark:bg-[#0f0e0c] flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b4e52] dark:border-[#a86e72]" />
      <p className="mt-4 text-[#696557] dark:text-[#b8b3ac]">Loading...</p>
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
        <TransactionProvider userAccountType="organization">
          {children}
        </TransactionProvider>
      </NotificationProvider>
    </WalletAliasProvider>
  </TokenProvider>
)

const AppProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ProfileProvider>
    <EntityProvider>
      <DataProviders>{children}</DataProviders>
    </EntityProvider>
  </ProfileProvider>
)

// App wrapper that handles initialization, first launch, and unlock states
const AppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appState, isLoading, error, isFirstLaunch, completeFirstLaunch } = useApp()

  // Show loading state during initialization
  if (isLoading) {
    return <LoadingFallback />
  }

  // Show error if initialization failed
  if (error && appState === 'Uninitialized') {
    return (
      <div className="min-h-screen bg-[#fafaf8] dark:bg-[#0f0e0c] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
            Initialization Failed
          </h1>
          <p className="text-[#696557] dark:text-[#b8b3ac] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#8b4e52] text-white rounded-md hover:bg-[#7a4248]"
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
  return <>{children}</>
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
      <Route path="/reports/financial" element={<Reports />} />
      <Route path="/reports/tax" element={<Reports />} />
      <Route path="/reports/donors" element={<Reports />} />
      <Route path="/reports/compliance" element={<Reports />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/general" element={<Settings />} />
      <Route path="/settings/currencies" element={<Settings />} />
      <Route path="/settings/users" element={<Settings />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/support" element={<Support />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/chart-of-accounts" element={<Settings />} />
    </Routes>
  </Navigation>
)

const App: React.FC = () => (
  <BrowserRouter>
    <LanguageProvider>
      <AppProvider>
        <AppWrapper>
          <AppProviders>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Onboarding for first-time setup */}
                <Route path="/onboarding" element={<Onboarding />} />

                {/* Redirect old auth routes to dashboard for local-only MVP */}
                <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                <Route path="/register" element={<Navigate to="/dashboard" replace />} />

                {/* Main routes - no auth required for local-only version */}
                <Route path="/*" element={<MainRoutes />} />
              </Routes>
            </Suspense>
          </AppProviders>
        </AppWrapper>
      </AppProvider>
    </LanguageProvider>
  </BrowserRouter>
)

export default App
