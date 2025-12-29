import React, { useState, useCallback } from 'react'
import {
  Building2,
  Calendar,
  Globe2,
  Save,
  X,
  Upload,
  AlertCircle,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrganization } from '../../contexts/OrganizationContext'

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
        <LogoUpload
          logo={organizationSettings.logo}
          onLogoUpload={onLogoUpload}
        />

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
            className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
)

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
)

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
          className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

interface TimezoneSelectProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void
}

const TimezoneSelect: React.FC<TimezoneSelectProps> = ({ value, onChange }) => (
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
      className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="Etc/GMT+12">
        UTC-12:00 - International Date Line West (AoE) - Baker Island, Howland
        Island
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
        UTC-08:00 - Pacific Standard Time (PST) - Los Angeles, Vancouver, San
        Francisco
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
    // Backend persistence via Tauri command not yet implemented
    setHasChanges(false)
  }, [])

  const handleReset = useCallback(() => {
    // Reset to defaults
    setHasChanges(false)
  }, [])

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        // Using local blob URL until backend upload is implemented
        const url = URL.createObjectURL(file)
        setOrganizationLogo(url)
        handleOrganizationChange('logo', url)
      }
    },
    [handleOrganizationChange, setOrganizationLogo]
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

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Language Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="12h">12-hour (AM/PM)</option>
                <option value="24h">24-hour</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GeneralSettings
