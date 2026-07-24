/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { OrganizationProvider } from './contexts/OrganizationContext'
import { AuthProvider } from './contexts/AuthContext'

/**
 * Wraps the application with authentication, theme, currency, and organization context providers.
 *
 * @param {React.ReactNode} children - The React children elements to be wrapped by the context providers.
 * @returns {JSX.Element} The children wrapped with all specified context providers.
 */
const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <ThemeProvider>
      <CurrencyProvider>
        <OrganizationProvider>{children}</OrganizationProvider>
      </CurrencyProvider>
    </ThemeProvider>
  </AuthProvider>
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)
