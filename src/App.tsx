import React from 'react';
import Navigation from './components/layout/Navigation';
import Dashboard from './app/dashboard/Dashboard';

// This is an example of how to use the Navigation component
// You would typically set this up in your main app layout or page

const App: React.FC = () => {
  return (
    <Navigation userType="organization">
      <Dashboard />
    </Navigation>
  );
};

// For individual users, you would use:
// <Navigation userType="individual">
//   <Dashboard />
// </Navigation>

export default App;
