import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/layout/Navigation';
import Dashboard from './app/dashboard/Dashboard';
import Transactions from './app/transactions/Transactions';
import Onboarding from './app/onboarding/Onboarding';
import ChartOfAccounts from './app/settings/ChartOfAccounts';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding route - no navigation wrapper */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main app routes - with navigation wrapper */}
        <Route path="/*" element={
          <Navigation userType="organization">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
              {/* Add more routes as needed */}
            </Routes>
          </Navigation>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
