import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navigation from './components/layout/Navigation'
import { TransactionProvider } from './contexts/TransactionContext'
import { TokenProvider } from './contexts/TokenContext'

// Lazy load route components for code splitting
const Dashboard = React.lazy(() => import('./app/dashboard/Dashboard'))
const Transactions = React.lazy(() => import('./app/transactions/Transactions'))
const TransactionForm = React.lazy(() => import('./app/transactions/TransactionForm'))
const Onboarding = React.lazy(() => import('./app/onboarding/Onboarding'))
const Balances = React.lazy(() => import('./app/wallets/Balances'))
const Settings = React.lazy(() => import('./app/settings/Settings'))
const Reports = React.lazy(() => import('./app/reports/Reports'))
const Analytics = React.lazy(() => import('./app/analytics/Analytics'))
const Support = React.lazy(() => import('./app/support/Support'))
const Profile = React.lazy(() => import('./app/profile/Profile'))

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
)

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <TokenProvider>
        <TransactionProvider userAccountType="organization">
          <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Onboarding route - no navigation wrapper */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Main app routes - with navigation wrapper */}
            <Route
              path="/*"
              element={
                <Navigation userType="organization">
                  <Routes>
                    <Route
                      path="/"
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/transactions/new" element={<TransactionForm />} />
                    <Route path="/transactions/edit/:id" element={<TransactionForm />} />
                    <Route path="/wallets" element={<Balances />} />
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
                    <Route path="/support" element={<Support />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/chart-of-accounts" element={<Settings />} />
                  </Routes>
                </Navigation>
              }
            />
          </Routes>
        </Suspense>
        </TransactionProvider>
      </TokenProvider>
    </BrowserRouter>
  )
}

export default App
