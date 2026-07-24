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

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
)

/**
 * CurrencyProvider component that provides currency settings context to its children.
 * @param children The child React nodes that will have access to the currency context.
 * @returns JSX element wrapping children with CurrencyContext provider.
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
   * Updates the current currency settings by merging new settings with previous settings.
   * @param newSettings Partial currency settings to update.
   */
  const updateSettings = (newSettings: Partial<CurrencySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  /**
   * Resets currency settings to default values.
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
 * Hook for accessing the currency context, including settings and update/reset functions.
 * @returns CurrencyContextType object containing current settings and updateSettings, resetSettings functions.
 */
export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
