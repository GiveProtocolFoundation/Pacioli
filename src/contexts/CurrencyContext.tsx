/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  DecimalSeparatorStandard,
  CurrencyDisplayFormat,
  ConversionMethod,
} from '../types/currency'

interface CurrencySettings {
  primaryCurrency: string
  reportingCurrencies: string[]
  conversionMethod: ConversionMethod
  decimalPlaces: number
  useThousandsSeparator: boolean
  currencyDisplayFormat: CurrencyDisplayFormat
  decimalSeparatorStandard: DecimalSeparatorStandard
  autoConvert: boolean
  cacheExchangeRates: boolean
}

interface CurrencyContextType {
  settings: CurrencySettings
  updateSettings: (newSettings: Partial<CurrencySettings>) => void
  resetSettings: () => void
}

const defaultSettings: CurrencySettings = {
  primaryCurrency: 'USD',
  reportingCurrencies: ['DOT', 'KSM', 'EUR'],
  conversionMethod: 'historical',
  decimalPlaces: 2,
  useThousandsSeparator: true,
  currencyDisplayFormat: 'symbol',
  decimalSeparatorStandard: 'point-comma',
  autoConvert: true,
  cacheExchangeRates: true,
}

// skipcq: JS-W1042
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

/**
 * Provides currency context to child components, managing currency settings.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components with access to currency context.
 * @returns {JSX.Element} The CurrencyProvider component wrapping its children with context.
 */
export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<CurrencySettings>(() => {
    const savedSettings = localStorage.getItem('currencySettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        return { ...defaultSettings, ...parsed }
      } catch (error) {
        console.error('Failed to parse currency settings:', error)
      }
    }
    return defaultSettings
  })

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('currencySettings', JSON.stringify(settings))
  }, [settings])

  /**
   * Updates the currency settings with the provided new settings.
   * @param {Partial<CurrencySettings>} newSettings - Partial settings to merge with current settings.
   */
  const updateSettings = (newSettings: Partial<CurrencySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  /**
   * Resets the currency settings to their default values.
   */
  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  return (
    <CurrencyContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

/**
 * Custom hook to access the currency context.
 * @returns {CurrencyContextType} The currency context containing settings and update/reset functions.
 */
export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
