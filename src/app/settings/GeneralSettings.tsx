import React, { useState, useCallback } from 'react'
import {
  Building2,
  Calendar,
  Globe2,
  Palette,
  Save,
  X,
  Upload,
  AlertCircle,
  Key,
  ExternalLink,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrganization } from '../../contexts/OrganizationContext'
import { moonscanService } from '../../services/blockchain/moonscanService'

interface OrganizationSettings {
  name: string
  legalName: string
  taxId: string
  organizationType: 'not-for-profit' | 'for-profit-enterprise' | 'individual'
  website: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  logo: string | null
}

interface SystemSettings {
  fiscalYearStart: string
  fiscalYearEnd: string
  timezone: string
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h'
  language: 'en' | 'es' | 'fr' | 'de'
  theme: 'light' | 'dark' | 'system'
}

interface GeneralSettingsProps {
  userType?: 'individual' | 'organization'
}

interface OrganizationInformationSectionProps {
  organizationSettings: OrganizationSettings
  onOrganizationChange: <K extends keyof OrganizationSettings>(
    key: K,
    value: OrganizationSettings[K]
  ) => void
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const LogoUpload: React.FC<{
  logo: string | null
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}> = ({ logo, onLogoUpload }) => (
  <div>
    <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Organization Logo
    </div>
    <div className="flex items-center space-x-4">
      {logo ? (
        <img
          src={logo}
          alt="Organization logo"
          className="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-700 object-cover"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <label className="cursor-pointer">
        <span className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center">
          <Upload className="w-4 h-4 mr-2" />
          Upload Logo
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={onLogoUpload}
          className="hidden"
        />
      </label>
    </div>
    <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
      Recommended: Square image, at least 200x200px
    </p>
  </div>
)

const OrganizationInformationSection: React.FC<
  OrganizationInformationSectionProps
> = ({ organizationSettings, onOrganizationChange, onLogoUpload }) => {
  const createTextHandler = useCallback(
    <K extends keyof OrganizationSettings>(key: K) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        onOrganizationChange(key, e.target.value as OrganizationSettings[K])
      }
    },
    [onOrganizationChange]
  )

  const handleOrgTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onOrganizationChange(
        'organizationType',
        e.target.value as OrganizationSettings['organizationType']
      )
    },
    [onOrganizationChange]
  )

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Building2 className="w-5 h-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Organization Information
        </h3>
      </div>

      <div className="space-y-4">
        {/* Logo Upload */}
        <LogoUpload logo={organizationSettings.logo} onLogoUpload={onLogoUpload} />

        {/* Organization Type */}
        <div>
          <label
            htmlFor="organizationType"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Organization Type
          </label>
          <select
            id="organizationType"
            value={organizationSettings.organizationType}
            onChange={handleOrgTypeChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="not-for-profit">Not-for-Profit Organization</option>
            <option value="for-profit-enterprise">For-Profit Enterprise</option>
            <option value="individual">Individual/Sole Proprietor</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="orgName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={organizationSettings.name}
              onChange={createTextHandler('name')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="legalName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Legal Name
            </label>
            <input
              id="legalName"
              type="text"
              value={organizationSettings.legalName}
              onChange={createTextHandler('legalName')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="taxId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Tax Id
            </label>
            <input
              id="taxId"
              type="text"
              value={organizationSettings.taxId}
              onChange={createTextHandler('taxId')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            >
              Tax ID / EIN
            </label>
            <input
              id="taxId"
              type="text"
              value={organizationSettings.taxId}
              onChange={createTextHandler('taxId')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="website"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Website
            </label>
            <input
              id="website"
              type="url"
              value={organizationSettings.website}
              onChange={createTextHandler('website')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={organizationSettings.email}
              onChange={createTextHandler('email')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={organizationSettings.phone}
              onChange={createTextHandler('phone')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Address
          </label>
          <input
            id="address"
            type="text"
            value={organizationSettings.address}
            onChange={createTextHandler('address')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              City
            </label>
            <input
              id="city"
              type="text"
              value={organizationSettings.city}
              onChange={createTextHandler('city')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              State/Province
            </label>
            <input
              id="state"
              type="text"
              value={organizationSettings.state}
              onChange={createTextHandler('state')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="zipCode"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              ZIP/Postal Code
            </label>
            <input
              id="zipCode"
              type="text"
              value={organizationSettings.zipCode}
              onChange={createTextHandler('zipCode')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="country"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Country
          </label>
          <input
            id="country"
            type="text"
            value={organizationSettings.country}
            onChange={createTextHandler('country')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  )
}

interface FiscalYearSectionProps {
  systemSettings: SystemSettings
  onSystemChange: <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => void
}

const FiscalYearWarning: React.FC = () => (
  <div className="flex">
    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
    <div className="ml-3">
      <p className="text-sm text-blue-800 dark:text-blue-400">
        Changing the fiscal year will affect all date-based reports and
        analytics. Consult with your accountant before making changes.
      </p>
    </div>
  </div>
);

const FiscalYearOptions: React.FC = () => (
  <>
    <optgroup label="Calendar Year End">
      <option value="12-31">December 31</option>
    </optgroup>
    <optgroup label="Fiscal Year Ends (Non-Calendar)">
      <option value="01-31">January 31</option>
      <option value="02-28">February 28/29</option>
      <option value="03-31">March 31</option>
      <option value="04-30">April 30</option>
      <option value="05-31">May 31</option>
      <option value="06-30">June 30</option>
      <option value="07-31">July 31</option>
      <option value="08-31">August 31</option>
      <option value="09-30">September 30</option>
      <option value="10-31">October 31</option>
      <option value="11-30">November 30</option>
    </optgroup>
  </>
);

const FiscalYearSection: React.FC<FiscalYearSectionProps> = ({
  systemSettings,
  onSystemChange,
}) => {
  const createHandler = useCallback(
    <K extends keyof SystemSettings>(key: K) => {
      return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        onSystemChange(key, e.target.value as SystemSettings[K])
      }
    },
    [onSystemChange]
  )

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Calendar className="w-5 h-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Fiscal Year
        </h3>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <FiscalYearWarning />
      </div>

      <div>
        <label
          htmlFor="fiscalYearEnd"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Fiscal Year End
        </label>
        <select
          id="fiscalYearEnd"
          value={systemSettings.fiscalYearEnd}
          onChange={createHandler('fiscalYearEnd')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <FiscalYearOptions />
        </select>
        <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
          Fiscal year start will be the day after the selected year end
        </p>
      </div>
    </div>
  )
}

/**
 * API Keys Section Component
 * Manages external API keys for blockchain data providers
 */
const EtherscanApiKeySection: React.FC<{
  etherscanApiKey: string
  showApiKey: boolean
  isSaved: boolean
  hasExistingKey: boolean
  onKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onToggleShow: () => void
  onSave: () => void
  onClear: () => void
}> = ({
  etherscanApiKey,
  showApiKey,
  isSaved,
  hasExistingKey,
  onKeyChange,
  onToggleShow,
  onSave,
  onClear,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="etherscanApiKey"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Etherscan API Key
        </label>
        <p className="text-xs text-gray-500 dark:text-[#94a3b8] mb-2">
          Required for fetching EVM transaction history on Moonbeam,
          Moonriver, and other EVM chains.
        </p>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <input
              id="etherscanApiKey"
              type={showApiKey ? 'text' : 'password'}
              value={etherscanApiKey}
              onChange={onKeyChange}
              placeholder="Enter your Etherscan API key"
              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <button
              type="button"
              onClick={onToggleShow}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            onClick={onSave}
            disabled={!etherscanApiKey.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save
              </>
            )}
          </button>
          {hasExistingKey && (
            <button
              onClick={onClear}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear
            </button>
          )}
        </div>
        {hasExistingKey && !isSaved && (
          <div className="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4 mr-1" />
            API key configured
          </div>
        )}
        <div className="mt-3 flex items-center">
          <a
            href="https://etherscan.io/myapikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
          >
            Get a free Etherscan API key
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                The Etherscan API is used to fetch transaction history for
                EVM-compatible chains (Moonbeam, Moonriver). The free tier
                allows up to 5 requests per second, which is sufficient for
                most use cases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ApiKeysSection: React.FC = () => {
  // Use lazy initialization to load from localStorage on first render
  const [etherscanApiKey, setEtherscanApiKey] = useState(() => {
    return localStorage.getItem('etherscan_api_key') || ''
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(() => {
    return Boolean(localStorage.getItem('etherscan_api_key'))
  })

  const handleSaveApiKey = useCallback(() => {
    if (etherscanApiKey.trim()) {
      moonscanService.setApiKey(etherscanApiKey.trim())
      setIsSaved(true)
      setHasExistingKey(true)
      setTimeout(() => setIsSaved(false), 3000)
    }
  }, [etherscanApiKey])

  const handleClearApiKey = useCallback(() => {
    localStorage.removeItem('etherscan_api_key')
    setEtherscanApiKey('')
    setHasExistingKey(false)
  }, [])

  const handleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEtherscanApiKey(e.target.value)
      setIsSaved(false)
    },
    []
  )

  const toggleShowApiKey = useCallback(() => {
    setShowApiKey(prev => !prev)
  }, [])

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Key className="w-5 h-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          API Keys
        </h3>
      </div>

      <p className="text-sm text-gray-500 dark:text-[#94a3b8] mb-4">
        Configure API keys for external blockchain data providers. These keys
        are stored locally in your browser.
      </p>

      {/* Etherscan API Key */}
      <EtherscanApiKeySection
        etherscanApiKey={etherscanApiKey}
        showApiKey={showApiKey}
        isSaved={isSaved}
        hasExistingKey={hasExistingKey}
        onKeyChange={handleKeyChange}
        onToggleShow={toggleShowApiKey}
        onSave={handleSaveApiKey}
        onClear={handleClearApiKey}
      />
    </div>
  )
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  userType = 'organization',
}) => {
  const { theme: currentTheme, setTheme } = useTheme()
  const { organizationLogo, setOrganizationLogo } = useOrganization()

  const [organizationSettings, setOrganizationSettings] =
    useState<OrganizationSettings>({
      name: 'My Organization',
      legalName: 'My Organization Inc.',
      taxId: '12-3456789',
      organizationType: 'not-for-profit',
      website: 'https://example.org',
      email: 'contact@example.org',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'United States',
      logo: organizationLogo,
    })

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    fiscalYearStart: '01-01',
    fiscalYearEnd: '12-31',
    timezone: 'America/Los_Angeles',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en',
    theme: currentTheme,
  })

  const [hasChanges, setHasChanges] = useState(false)

  const handleOrganizationChange = useCallback(
    <K extends keyof OrganizationSettings>(
      key: K,
      value: OrganizationSettings[K]
    ) => {
      setOrganizationSettings(prev => ({ ...prev, [key]: value }))
      setHasChanges(true)
    },
    []
  )

  const handleSystemChange = useCallback(
    <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
      setSystemSettings(prev => ({ ...prev, [key]: value }))
      setHasChanges(true)

      // Update theme immediately
      if (key === 'theme' && value !== 'system') {
        setTheme(value as 'light' | 'dark')
      }
    },
    [setTheme]
  )

  const handleSave = useCallback(() => {
    // TODO: Save to backend via Tauri command
    // console.log('Saving settings:', { organizationSettings, systemSettings })
    setHasChanges(false)
    // Show success notification
  }, [])

  const handleReset = useCallback(() => {
    // Reset to defaults
    setHasChanges(false)
  }, [])

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        // TODO: Upload to backend and get URL
        const url = URL.createObjectURL(file)
        setOrganizationLogo(url)
        handleOrganizationChange('logo', url)
      }
    },
    [handleOrganizationChange, setOrganizationLogo]
  )

  // Theme button handlers
  const handleThemeLight = useCallback(
    () => handleSystemChange('theme', 'light'),
    [handleSystemChange]
  )
  const handleThemeDark = useCallback(
    () => handleSystemChange('theme', 'dark'),
    [handleSystemChange]
  )
  const handleThemeSystem = useCallback(
    () => handleSystemChange('theme', 'system'),
    [handleSystemChange]
  )

  // Factory function for system select handlers (used in main component)
  const createSystemSelectHandler = useCallback(
    <K extends keyof SystemSettings>(key: K) => {
      return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        handleSystemChange(key, e.target.value as SystemSettings[K])
      }
    },
    [handleSystemChange]
  )

  // Extracted component to reduce nesting depth
  const TimezoneSelect: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void }> = ({ value, onChange }) => (
    <div>
      <label
        htmlFor="timezone"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Timezone
      </label>
      <select
        id="timezone"
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="Etc/GMT+12">
          UTC-12:00 - International Date Line West (AoE) - Baker Island, Howland Island
        </option>
        <option value="Pacific/Samoa">
          UTC-11:00 - Samoa Standard Time (SST) - Samoa, Niue
        </option>
        <option value="Pacific/Honolulu">
          UTC-10:00 - Hawaii-Aleutian Standard Time (HST) - Honolulu, Tahiti
        </option>
        <option value="Pacific/Marquesas">
          UTC-09:30 - Marquesas Time (MART) - Marquesas Islands (French Polynesia)
        </option>
        <option value="America/Anchorage">
          UTC-09:00 - Alaska Standard Time (AKST) - Anchorage, Juneau
        </option>
        <option value="America/Los_Angeles">
          UTC-08:00 - Pacific Standard Time (PST) - Los Angeles, Vancouver, San Francisco
        </option>
        <option value="America/Denver">
          UTC-07:00 - Mountain Standard Time (MST) - Denver, Phoenix, Calgary
        </option>
        <option value="America/Chicago">
          UTC-06:00 - Central Standard Time (CST) - Chicago, Houston, Mexico City
        </option>
      </select>
    </div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            General Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
            Manage your organization and system preferences
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {hasChanges && (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Organization Information - Only for organizations */}
        {userType === 'organization' && (
          <OrganizationInformationSection
            organizationSettings={organizationSettings}
            onOrganizationChange={handleOrganizationChange}
            onLogoUpload={handleLogoUpload}
          />
        )}

        {/* Fiscal Year Settings - Only for organizations */}
        {userType === 'organization' && (
          <FiscalYearSection
            systemSettings={systemSettings}
            onSystemChange={handleSystemChange}
          />
        )}

        {/* Regional Settings */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Globe2 className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Regional Settings
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TimezoneSelect
              value={systemSettings.timezone}
              onChange={createSystemSelectHandler('timezone')}
            />
          </div>
        </div>
                  UTC-06:00 - Central Standard Time (CST) - Chicago, Mexico
                  City, Dallas
                </option>
                <option value="America/New_York">
                  UTC-05:00 - Eastern Standard Time (EST) - New York, Toronto,
                  Miami, Lima
                </option>
                <option value="America/Halifax">
                  UTC-04:00 - Atlantic Standard Time (AST) - Halifax, Caracas,
                  San Juan
                </option>
                <option value="America/St_Johns">
                  UTC-03:30 - Newfoundland Standard Time (NST) - St. John&apos;s
                  (Canada)
                </option>
                <option value="America/Argentina/Buenos_Aires">
                  UTC-03:00 - Argentina Time (ART) / Brasília Time (BRT) -
                  Buenos Aires, São Paulo
                </option>
                <option value="Atlantic/South_Georgia">
                  UTC-02:00 - Coordinated Universal Time -2 - Fernando de
                  Noronha, South Georgia
                </option>
                <option value="Atlantic/Azores">
                  UTC-01:00 - Azores Time (AZOT) - Azores, Cape Verde
                </option>
                <option value="UTC">
                  UTC+00:00 - Greenwich Mean Time (GMT) / UTC - London, Lisbon,
                  Accra, Reykjavik
                </option>
                <option value="Europe/Paris">
                  UTC+01:00 - Central European Time (CET) - Paris, Berlin, Rome,
                  Madrid, Lagos
                </option>
                <option value="Europe/Athens">
                  UTC+02:00 - Eastern European Time (EET) - Cairo, Athens,
                  Jerusalem, Johannesburg
                </option>
                <option value="Europe/Moscow">
                  UTC+03:00 - Moscow Time (MSK) / Arabia Standard Time (AST) -
                  Moscow, Riyadh, Istanbul, Nairobi
                </option>
                <option value="Asia/Tehran">
                  UTC+03:30 - Iran Standard Time (IRST) - Tehran
                </option>
                <option value="Asia/Dubai">
                  UTC+04:00 - Gulf Standard Time (GST) - Dubai, Abu Dhabi, Baku
                </option>
                <option value="Asia/Kabul">
                  UTC+04:30 - Afghanistan Time (AFT) - Kabul
                </option>
                <option value="Asia/Karachi">
                  UTC+05:00 - Pakistan Standard Time (PKT) - Karachi, Tashkent
                </option>
                <option value="Asia/Kolkata">
                  UTC+05:30 - Indian Standard Time (IST) - New Delhi, Mumbai,
                  Chennai
                </option>
                <option value="Asia/Kathmandu">
                  UTC+05:45 - Nepal Time (NPT) - Kathmandu
                </option>
                <option value="Asia/Dhaka">
                  UTC+06:00 - Bangladesh Standard Time (BST) - Dhaka, Almaty
                </option>
                <option value="Asia/Yangon">
                  UTC+06:30 - Myanmar Standard Time (MMT) - Yangon
                </option>
                <option value="Asia/Bangkok">
                  UTC+07:00 - Indochina Time (ICT) - Bangkok, Jakarta, Hanoi
                </option>
                <option value="Asia/Shanghai">
                  UTC+08:00 - China Standard Time (CST) - Beijing, Hong Kong,
                  Singapore, Perth
                </option>
                <option value="Australia/Eucla">
                  UTC+08:45 - Australian Central Western Standard Time (ACWST) -
                  Eucla (Australia)
                </option>
                <option value="Asia/Tokyo">
                  UTC+09:00 - Japan Standard Time (JST) / Korea Standard Time
                  (KST) - Tokyo, Seoul
                </option>
                <option value="Australia/Adelaide">
                  UTC+09:30 - Australian Central Standard Time (ACST) -
                  Adelaide, Darwin
                </option>
                <option value="Australia/Sydney">
                  UTC+10:00 - Australian Eastern Standard Time (AEST) - Sydney,
                  Melbourne, Brisbane, Guam
                </option>
                <option value="Australia/Lord_Howe">
                  UTC+10:30 - Lord Howe Standard Time (LHST) - Lord Howe Island
                  (Australia)
                </option>
                <option value="Pacific/Guadalcanal">
                  UTC+11:00 - Solomon Islands Time (SBT) - Vladivostok, New
                  Caledonia
                </option>
                <option value="Pacific/Auckland">
                  UTC+12:00 - New Zealand Standard Time (NZST) - Auckland, Fiji
                </option>
                <option value="Pacific/Chatham">
                  UTC+12:45 - Chatham Standard Time (CHAST) - Chatham Islands
                  (New Zealand)
                </option>
                <option value="Pacific/Tongatapu">
                  UTC+13:00 - Phoenix Island Time (PHOT) - Tonga, Phoenix
                  Islands
                </option>
                <option value="Pacific/Kiritimati">
                  UTC+14:00 - Line Islands Time (LINT) - Kiribati
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Language
              </label>
              <select
                id="language"
                value={systemSettings.language}
                onChange={createSystemSelectHandler('language')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="dateFormat"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Date Format
              </label>
              <select
                id="dateFormat"
                value={systemSettings.dateFormat}
                onChange={createSystemSelectHandler('dateFormat')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="timeFormat"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Time Format
              </label>
              <select
                id="timeFormat"
                value={systemSettings.timeFormat}
                onChange={createSystemSelectHandler('timeFormat')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="12h">12-hour (1:00 PM)</option>
                <option value="24h">24-hour (13:00)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Palette className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Appearance
            </h3>
          </div>

          <div>
            <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Theme
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={handleThemeLight}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  systemSettings.theme === 'light'
                    ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  Light
                </div>
                <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Classic light theme
                </div>
              </button>

              <button
                onClick={handleThemeDark}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  systemSettings.theme === 'dark'
                    ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  Dark
                </div>
                <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Easy on the eyes
                </div>
              </button>

              <button
                onClick={handleThemeSystem}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  systemSettings.theme === 'system'
                    ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  System
                </div>
                <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                  Match OS preference
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <ApiKeysSection />
      </div>
    </div>
  )
}

export default GeneralSettings
