import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navigation from './components/layout/Navigation'
import Dashboard from './app/dashboard/Dashboard'
import Transactions from './app/transactions/Transactions'
import Onboarding from './app/onboarding/Onboarding'
import Balances from './app/wallets/Balances'
import Settings from './app/settings/Settings'
import Reports from './app/reports/Reports'
import Analytics from './app/analytics/Analytics'
import Support from './app/support/Support'
import Profile from './app/profile/Profile'

const App: React.FC = () => {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}

export default App
