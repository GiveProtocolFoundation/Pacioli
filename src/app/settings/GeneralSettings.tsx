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
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrganization } from '../../contexts/OrganizationContext'

interface OrganizationSettings {
  name: string
  legalName: string
  taxId: string
  organizationType: 'not-for-profit' | 'sme' | 'individual'
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

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ userType = 'organization' }) => {
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
  const handleThemeLight = useCallback(() => handleSystemChange('theme', 'light'), [handleSystemChange])
  const handleThemeDark = useCallback(() => handleSystemChange('theme', 'dark'), [handleSystemChange])
  const handleThemeSystem = useCallback(() => handleSystemChange('theme', 'system'), [handleSystemChange])

  // Factory function for organization text input handlers
  const createOrgTextHandler = useCallback(
    (key: keyof OrganizationSettings) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        handleOrganizationChange(key, e.target.value)
      }
    },
    [handleOrganizationChange]
  )

  // Factory function for system select handlers
  const createSystemSelectHandler = useCallback(
    <K extends keyof SystemSettings>(key: K) => {
      return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        handleSystemChange(key, e.target.value as SystemSettings[K])
      }
    },
    [handleSystemChange]
  )

  // Specific handlers for organization type (needs type assertion)
  const handleOrgTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleOrganizationChange('organizationType', e.target.value as OrganizationSettings['organizationType'])
    },
    [handleOrganizationChange]
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            General Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
        {userType === 'organization' && <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Organization Information
            </h3>
          </div>

          <div className="space-y-4">
            {/* Logo Upload */}
            <div>
              <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Logo
              </div>
              <div className="flex items-center space-x-4">
                {organizationSettings.logo ? (
                  <img
                    src={organizationSettings.logo}
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
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Recommended: Square image, at least 200x200px
              </p>
            </div>

            {/* Organization Type */}
            <div>
              <label htmlFor="organizationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Type
              </label>
              <select
                id="organizationType"
                value={organizationSettings.organizationType}
                onChange={handleOrgTypeChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="not-for-profit">Not-for-Profit Organization</option>
                <option value="sme">Small-Medium Enterprise (SME)</option>
                <option value="individual">Individual/Sole Proprietor</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={organizationSettings.name}
                  onChange={createOrgTextHandler('name')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="legalName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Legal Name
                </label>
                <input
                  id="legalName"
                  type="text"
                  value={organizationSettings.legalName}
                  onChange={createOrgTextHandler('legalName')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="taxId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax ID / EIN
                </label>
                <input
                  id="taxId"
                  type="text"
                  value={organizationSettings.taxId}
                  onChange={createOrgTextHandler('taxId')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={organizationSettings.website}
                  onChange={createOrgTextHandler('website')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={organizationSettings.email}
                  onChange={createOrgTextHandler('email')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={organizationSettings.phone}
                  onChange={createOrgTextHandler('phone')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={organizationSettings.address}
                onChange={createOrgTextHandler('address')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={organizationSettings.city}
                  onChange={createOrgTextHandler('city')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State/Province
                </label>
                <input
                  id="state"
                  type="text"
                  value={organizationSettings.state}
                  onChange={createOrgTextHandler('state')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ZIP/Postal Code
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={organizationSettings.zipCode}
                  onChange={createOrgTextHandler('zipCode')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Country
              </label>
              <input
                id="country"
                type="text"
                value={organizationSettings.country}
                onChange={createOrgTextHandler('country')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>}

        {/* Fiscal Year Settings - Only for organizations */}
        {userType === 'organization' && <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Fiscal Year
            </h3>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  Changing the fiscal year will affect all date-based reports and analytics.
                  Consult with your accountant before making changes.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fiscalYearStart" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fiscal Year Start (MM-DD)
              </label>
              <input
                id="fiscalYearStart"
                type="text"
                value={systemSettings.fiscalYearStart}
                onChange={createSystemSelectHandler('fiscalYearStart')}
                placeholder="01-01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="fiscalYearEnd" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fiscal Year End (MM-DD)
              </label>
              <input
                id="fiscalYearEnd"
                type="text"
                value={systemSettings.fiscalYearEnd}
                onChange={createSystemSelectHandler('fiscalYearEnd')}
                placeholder="12-31"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>}

        {/* Regional Settings */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Globe2 className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Regional Settings
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={systemSettings.timezone}
                onChange={createSystemSelectHandler('timezone')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>

            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              <label htmlFor="timeFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <div className="font-medium text-gray-900 dark:text-white mb-1">Light</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
                <div className="font-medium text-gray-900 dark:text-white mb-1">Dark</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
                <div className="font-medium text-gray-900 dark:text-white mb-1">System</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Match OS preference
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GeneralSettings
