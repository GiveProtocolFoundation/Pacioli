import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { OrganizationProvider } from './contexts/OrganizationContext'
import { AuthProvider } from './contexts/AuthContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <OrganizationProvider>
            <App />
          </OrganizationProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
)
