import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navigation from './components/layout/Navigation'
import { TransactionProvider } from './contexts/TransactionContext'
import { TokenProvider } from './contexts/TokenContext'
import { WalletAliasProvider } from './contexts/WalletAliasContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { EntityProvider } from './contexts/EntityContext'
import { ProtectedRoute } from './components/auth'

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

// Auth pages
const Login = React.lazy(() => import('./app/auth/Login'))
const Register = React.lazy(() => import('./app/auth/Register'))

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF] dark:border-[#66B3FF]" />
      <p className="mt-4 text-gray-600 dark:text-[#94a3b8]">Loading...</p>
    </div>
  </div>
)

// Composed providers to reduce JSX nesting depth
const DataProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <TokenProvider>
    <WalletAliasProvider>
      <TransactionProvider userAccountType="organization">
        {children}
      </TransactionProvider>
    </WalletAliasProvider>
  </TokenProvider>
)

const AppProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ProfileProvider>
    <EntityProvider>
      <DataProviders>
        {children}
      </DataProviders>
    </EntityProvider>
  </ProfileProvider>
)

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
    <AppProviders>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected routes - require authentication */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainRoutes />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </AppProviders>
  </BrowserRouter>
)

export default App
