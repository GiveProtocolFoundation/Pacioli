import React, { useState, useCallback } from 'react'
import {
  Save,
  X,
  DollarSign,
  TrendingUp,
  Settings as SettingsIcon,
  Key,
  Eye,
} from 'lucide-react'
import {
  SUPPORTED_CRYPTO_CURRENCIES,
  SUPPORTED_FIAT_CURRENCIES,
  ConversionMethod,
  CurrencyDisplayFormat,
  DecimalSeparatorStandard,
} from '../../types/currency'
import { useCurrency } from '../../contexts/CurrencyContext'

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
  coingeckoApiKey?: string
  fixerApiKey?: string
}

interface ChangeActionsProps {
  hasChanges: boolean
  onReset: () => void
  onSave: () => void
}

const ChangeActions: React.FC<ChangeActionsProps> = ({
  hasChanges,
  onReset,
  onSave,
}) => {
  if (!hasChanges) return null
  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={onReset}
        className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] flex items-center"
      >
        <X className="w-4 h-4 mr-2" />
        Cancel
      </button>
      <button
        onClick={onSave}
        className="px-4 py-2 text-sm font-medium text-white bg-[#8b4e52] rounded-lg hover:bg-[#7a4248] flex items-center"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Changes
      </button>
    </div>
  )
}

interface PrimaryCurrencySectionProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

const PrimaryCurrencySection: React.FC<PrimaryCurrencySectionProps> = ({
  value,
  onChange,
}) => (
  <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6">
    <div className="flex items-center mb-4">
      <DollarSign className="w-5 h-5 text-[#8b4e52] mr-2" />
      <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
        Primary Reporting Currency
      </h2>
    </div>
    <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
      Your primary currency is used for all financial reports and statements.
      Transactions in other currencies will be automatically converted.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          htmlFor="primary-currency"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Select Primary Currency
        </label>
        <select
          id="primary-currency"
          value={value}
          onChange={onChange}
          className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
        >
          <optgroup label="Fiat Currencies">
            {SUPPORTED_FIAT_CURRENCIES.map(currency => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </optgroup>
          <optgroup label="Cryptocurrencies">
            {SUPPORTED_CRYPTO_CURRENCIES.map(currency => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  </div>
)

const Currencies: React.FC = () => {
  const { settings: contextSettings, updateSettings: updateContextSettings } =
    useCurrency()
  const [localSettings, setLocalSettings] = useState<CurrencySettings>(() => ({
    ...contextSettings,
    coingeckoApiKey: '',
    fixerApiKey: '',
  }))

  const [showApiKeys, setShowApiKeys] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleChange = useCallback(
    <K extends keyof CurrencySettings>(key: K, value: CurrencySettings[K]) => {
      setLocalSettings(prev => ({ ...prev, [key]: value }))
      setHasChanges(true)
    },
    []
  )

  const handleToggleReportingCurrency = useCallback((currency: string) => {
    setLocalSettings(prev => {
      const newReportingCurrencies = prev.reportingCurrencies.includes(currency)
        ? prev.reportingCurrencies.filter(c => c !== currency)
        : [...prev.reportingCurrencies, currency]

      setHasChanges(true)
      return { ...prev, reportingCurrencies: newReportingCurrencies }
    })
  }, [])

  const handleSave = useCallback(() => {
    // Update context with new settings (excluding API keys for now)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { coingeckoApiKey, fixerApiKey, ...settingsToSave } = localSettings
    updateContextSettings(settingsToSave)

    // API keys backend persistence via Tauri command not yet implemented
    setHasChanges(false)
  }, [localSettings, updateContextSettings])

  const handleReset = useCallback(() => {
    // Reset to context settings
    setLocalSettings({
      ...contextSettings,
      coingeckoApiKey: '',
      fixerApiKey: '',
    })
    setHasChanges(false)
  }, [contextSettings])

  // Format number based on decimal separator standard
  const formatNumber = (
    integerPart: string,
    decimalPart: string,
    standard: DecimalSeparatorStandard
  ): string => {
    switch (standard) {
      case 'point-comma':
        // 1,234.56 - comma for thousands, point for decimal
        return `${integerPart}.${decimalPart}`
      case 'comma-point':
        // 1.234,56 - point for thousands, comma for decimal
        return `${integerPart.replace(/,/g, '.')},${decimalPart}`
      case 'point-space':
        // 1 234.56 - space for thousands, point for decimal
        return `${integerPart.replace(/,/g, ' ')}.${decimalPart}`
      case 'comma-space':
        // 1 234,56 - space for thousands, comma for decimal
        return `${integerPart.replace(/,/g, ' ')},${decimalPart}`
      default:
        return `${integerPart}.${decimalPart}`
    }
  }

  // Memoized event handlers
  const handlePrimaryCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleChange('primaryCurrency', e.target.value)
    },
    [handleChange]
  )

  const handleCurrencyToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const currency = e.currentTarget.dataset.currency
      if (currency) {
        handleToggleReportingCurrency(currency)
      }
    },
    [handleToggleReportingCurrency]
  )

  const handleConversionMethodChange = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const method = e.currentTarget.dataset.method as ConversionMethod
      if (method) {
        handleChange('conversionMethod', method)
      }
    },
    [handleChange]
  )

  const handleAutoConvertChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange('autoConvert', e.target.checked)
    },
    [handleChange]
  )

  const handleCacheRatesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange('cacheExchangeRates', e.target.checked)
    },
    [handleChange]
  )

  const handleDisplayFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleChange(
        'currencyDisplayFormat',
        e.target.value as CurrencyDisplayFormat
      )
    },
    [handleChange]
  )

  const handleDecimalPlacesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange('decimalPlaces', parseInt(e.target.value) || 2)
    },
    [handleChange]
  )

  const handleSeparatorStandardChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleChange(
        'decimalSeparatorStandard',
        e.target.value as DecimalSeparatorStandard
      )
    },
    [handleChange]
  )

  const handleThousandsSeparatorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange('useThousandsSeparator', e.target.checked)
    },
    [handleChange]
  )

  const handleToggleApiKeys = useCallback(() => {
    setShowApiKeys(prev => !prev)
  }, [])

  const handleCoingeckoKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange('coingeckoApiKey', e.target.value)
    },
    [handleChange]
  )

  const handleFixerKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange('fixerApiKey', e.target.value)
    },
    [handleChange]
  )

  return (
    <div className="min-h-screen bg-[#fafaf8] dark:bg-[#0f0e0c]">
      {/* Header */}
      <header className="bg-[#fafaf8] dark:bg-[#0f0e0c] border-b border-[rgba(201,169,97,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1>Currency Settings</h1>
              <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
                Configure your currency preferences and conversion settings
              </p>
            </div>
            <ChangeActions
              hasChanges={hasChanges}
              onReset={handleReset}
              onSave={handleSave}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Primary Currency Section */}
          <PrimaryCurrencySection
            value={localSettings.primaryCurrency}
            onChange={handlePrimaryCurrencyChange}
          />

          {/* Additional Reporting Currencies */}
          <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6">
            <div className="flex items-center mb-4">
              <TrendingUp className="w-5 h-5 text-[#8b4e52] mr-2" />
              <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                Additional Reporting Currencies
              </h2>
            </div>
            <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
              Select additional currencies to include in your reports. Values
              will be converted automatically based on current exchange rates.
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-3">
                  Fiat Currencies
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {SUPPORTED_FIAT_CURRENCIES.filter(
                    c => c !== localSettings.primaryCurrency
                  ).map(currency => (
                    <button
                      key={currency}
                      data-currency={currency}
                      onClick={handleCurrencyToggle}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        localSettings.reportingCurrencies.includes(currency)
                          ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 border-[#8b4e52] dark:border-[#a86e72] text-[#8b4e52] dark:text-[#a86e72]'
                          : 'bg-[#fafaf8] dark:bg-[#1a1815] border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620]'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-3">
                  Cryptocurrencies
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {SUPPORTED_CRYPTO_CURRENCIES.filter(
                    c => c !== localSettings.primaryCurrency
                  ).map(currency => (
                    <button
                      key={currency}
                      data-currency={currency}
                      onClick={handleCurrencyToggle}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        localSettings.reportingCurrencies.includes(currency)
                          ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 border-[#8b4e52] dark:border-[#a86e72] text-[#8b4e52] dark:text-[#a86e72]'
                          : 'bg-[#fafaf8] dark:bg-[#1a1815] border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620]'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              {localSettings.reportingCurrencies.length > 0 && (
                <div className="mt-4 p-3 bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 rounded-lg">
                  <p className="text-sm text-[#8b4e52] dark:text-[#a86e72]">
                    <strong>Selected:</strong>{' '}
                    {localSettings.reportingCurrencies.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Conversion Settings */}
          <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6">
            <div className="flex items-center mb-4">
              <SettingsIcon className="w-5 h-5 text-[#8b4e52] mr-2" />
              <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                Conversion Settings
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
                  Conversion Method
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    data-method="spot"
                    onClick={handleConversionMethodChange}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      localSettings.conversionMethod === 'spot'
                        ? 'border-[#8b4e52] dark:border-[#a86e72] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20'
                        : 'border-[rgba(201,169,97,0.15)] hover:border-[rgba(201,169,97,0.15)] dark:hover:border-gray-600 bg-[#fafaf8] dark:bg-[#1a1815]'
                    }`}
                  >
                    <div className="font-medium text-[#1a1815] dark:text-[#f5f3f0] mb-1">
                      Spot Rate
                    </div>
                    <div className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                      Use current exchange rate for all conversions
                    </div>
                  </button>
                  <button
                    data-method="historical"
                    onClick={handleConversionMethodChange}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      localSettings.conversionMethod === 'historical'
                        ? 'border-[#8b4e52] dark:border-[#a86e72] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20'
                        : 'border-[rgba(201,169,97,0.15)] hover:border-[rgba(201,169,97,0.15)] dark:hover:border-gray-600 bg-[#fafaf8] dark:bg-[#1a1815]'
                    }`}
                  >
                    <div className="font-medium text-[#1a1815] dark:text-[#f5f3f0] mb-1">
                      Historical Rate
                    </div>
                    <div className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                      Use rate at transaction time (recommended)
                    </div>
                  </button>
                  <button
                    data-method="fixed"
                    onClick={handleConversionMethodChange}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      localSettings.conversionMethod === 'fixed'
                        ? 'border-[#8b4e52] dark:border-[#a86e72] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20'
                        : 'border-[rgba(201,169,97,0.15)] hover:border-[rgba(201,169,97,0.15)] dark:hover:border-gray-600 bg-[#fafaf8] dark:bg-[#1a1815]'
                    }`}
                  >
                    <div className="font-medium text-[#1a1815] dark:text-[#f5f3f0] mb-1">
                      Fixed Rate
                    </div>
                    <div className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                      Use manually set exchange rates
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.autoConvert}
                    onChange={handleAutoConvertChange}
                    className="w-4 h-4 text-[#8b4e52] border-[rgba(201,169,97,0.15)] rounded focus:ring-[#c9a961]"
                  />
                  <span className="ml-2 text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                    Automatically convert transactions to primary currency
                  </span>
                </label>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.cacheExchangeRates}
                    onChange={handleCacheRatesChange}
                    className="w-4 h-4 text-[#8b4e52] border-[rgba(201,169,97,0.15)] rounded focus:ring-[#c9a961]"
                  />
                  <span className="ml-2 text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                    Cache exchange rates for better performance
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Display Preferences */}
          <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6">
            <div className="flex items-center mb-4">
              <Eye className="w-5 h-5 text-[#8b4e52] mr-2" />
              <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                Display Preferences
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="currency-display-format"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                >
                  Currency Display Format
                </label>
                <select
                  id="currency-display-format"
                  value={localSettings.currencyDisplayFormat}
                  onChange={handleDisplayFormatChange}
                  className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                >
                  <option value="symbol">Symbol ($1,234.56)</option>
                  <option value="code">Code (1,234.56 USD)</option>
                  <option value="name">Full Name (1,234.56 US Dollar)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="decimal-places"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                >
                  Decimal Places
                </label>
                <input
                  id="decimal-places"
                  type="number"
                  min="0"
                  max="8"
                  value={localSettings.decimalPlaces}
                  onChange={handleDecimalPlacesChange}
                  className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
                <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
                  Number of decimal places to display (0-8)
                </p>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="decimal-separator"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                >
                  Decimal Separator Standard
                </label>
                <select
                  id="decimal-separator"
                  value={localSettings.decimalSeparatorStandard}
                  onChange={handleSeparatorStandardChange}
                  className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                >
                  <option value="point-comma">
                    Decimal point format - 1,234.56
                  </option>
                  <option value="comma-point">
                    Decimal comma format - 1.234,56
                  </option>
                  <option value="point-space">
                    Decimal point (space) format - 1 234.56
                  </option>
                  <option value="comma-space">
                    Decimal comma (space) format - 1 234,56
                  </option>
                </select>
                <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
                  Choose how numbers are formatted with separators
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.useThousandsSeparator}
                    onChange={handleThousandsSeparatorChange}
                    className="w-4 h-4 text-[#8b4e52] border-[rgba(201,169,97,0.15)] rounded focus:ring-[#c9a961]"
                  />
                  <span className="ml-2 text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                    Use thousands separator (1,234,567 vs 1234567)
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-4 p-4 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg">
              <div className="text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
                Preview:
              </div>
              <div className="text-2xl font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                {localSettings.currencyDisplayFormat === 'symbol' && '$'}
                {localSettings.decimalPlaces > 0
                  ? formatNumber(
                      localSettings.useThousandsSeparator ? '1,234' : '1234',
                      Array(localSettings.decimalPlaces).fill('5').join(''),
                      localSettings.decimalSeparatorStandard
                    )
                  : localSettings.useThousandsSeparator
                    ? '1,234'
                    : '1234'}
                {localSettings.currencyDisplayFormat === 'code' && ' USD'}
                {localSettings.currencyDisplayFormat === 'name' && ' US Dollar'}
              </div>
            </div>
          </div>

          {/* API Configuration */}
          <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Key className="w-5 h-5 text-[#8b4e52] mr-2" />
                <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
                  Exchange Rate API Configuration
                </h2>
              </div>
              <button
                onClick={handleToggleApiKeys}
                className="text-sm text-[#8b4e52] hover:text-[#7a4248] font-medium"
              >
                {showApiKeys ? 'Hide' : 'Show'} API Keys
              </button>
            </div>

            <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
              Configure API keys for external exchange rate providers. These are
              optional but recommended for production use.
            </p>

            {showApiKeys && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="coingecko-api-key"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                  >
                    CoinGecko API Key
                  </label>
                  <input
                    id="coingecko-api-key"
                    type="password"
                    value={localSettings.coingeckoApiKey || ''}
                    onChange={handleCoingeckoKeyChange}
                    placeholder="Enter your CoinGecko API key"
                    className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                  />
                  <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
                    Used for cryptocurrency price feeds.{' '}
                    <a
                      href="https://www.coingecko.com/en/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8b4e52] hover:underline"
                    >
                      Get API key
                    </a>
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="fixer-api-key"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                  >
                    Fixer.io API Key
                  </label>
                  <input
                    id="fixer-api-key"
                    type="password"
                    value={localSettings.fixerApiKey || ''}
                    onChange={handleFixerKeyChange}
                    placeholder="Enter your Fixer.io API key"
                    className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                  />
                  <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
                    Used for fiat currency exchange rates.{' '}
                    <a
                      href="https://fixer.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8b4e52] hover:underline"
                    >
                      Get API key
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Information Box */}
          <div className="bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 border border-[#8b4e52]/30 dark:border-[#8b4e52]/40 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <SettingsIcon className="w-5 h-5 text-[#8b4e52] dark:text-[#a86e72]" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-[#8b4e52] dark:text-[#a86e72]">
                  About Currency Conversions
                </h3>
                <div className="mt-2 text-sm text-[#8b4e52] dark:text-[#a86e72] space-y-1">
                  <p>
                    • Historical rates provide accurate reporting for tax and
                    accounting purposes
                  </p>
                  <p>
                    • Exchange rates are cached for 5 minutes (crypto) or 24
                    hours (fiat)
                  </p>
                  <p>
                    • All conversions preserve decimal precision to avoid
                    rounding errors
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Currencies
