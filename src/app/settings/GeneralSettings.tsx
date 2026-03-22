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
    <div className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2">
      Organization Logo
    </div>
    <div className="flex items-center space-x-4">
      {logo ? (
        <img
          src={logo}
          alt="Organization logo"
          className="w-16 h-16 rounded-lg border border-[rgba(201,169,97,0.15)] object-cover"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-[rgba(201,169,97,0.15)] flex items-center justify-center">
          <Building2 className="w-6 h-6 text-[#a39d94]" />
        </div>
      )}
      <label className="cursor-pointer">
        <span className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] inline-flex items-center">
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
    <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
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
    <div className="border border-[rgba(201,169,97,0.15)] rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Building2 className="w-5 h-5 text-[#8b4e52] mr-2" />
        <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
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
            className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
          >
            Organization Type
          </label>
          <select
            id="organizationType"
            value={organizationSettings.organizationType}
            onChange={handleOrgTypeChange}
            className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
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
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={organizationSettings.name}
              onChange={createTextHandler('name')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="legalName"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              Legal Name
            </label>
            <input
              id="legalName"
              type="text"
              value={organizationSettings.legalName}
              onChange={createTextHandler('legalName')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="taxId"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              Tax Id
            </label>
            <input
              id="taxId"
              type="text"
              value={organizationSettings.taxId}
              onChange={createTextHandler('taxId')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="website"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              Website
            </label>
            <input
              id="website"
              type="url"
              value={organizationSettings.website}
              onChange={createTextHandler('website')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={organizationSettings.email}
              onChange={createTextHandler('email')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={organizationSettings.phone}
              onChange={createTextHandler('phone')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
          >
            Address
          </label>
          <input
            id="address"
            type="text"
            value={organizationSettings.address}
            onChange={createTextHandler('address')}
            className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label
              htmlFor="city"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              City
            </label>
            <input
              id="city"
              type="text"
              value={organizationSettings.city}
              onChange={createTextHandler('city')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              State/Province
            </label>
            <input
              id="state"
              type="text"
              value={organizationSettings.state}
              onChange={createTextHandler('state')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>

          <div>
            <label
              htmlFor="zipCode"
              className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
            >
              ZIP/Postal Code
            </label>
            <input
              id="zipCode"
              type="text"
              value={organizationSettings.zipCode}
              onChange={createTextHandler('zipCode')}
              className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="country"
            className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
          >
            Country
          </label>
          <input
            id="country"
            type="text"
            value={organizationSettings.country}
            onChange={createTextHandler('country')}
            className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
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
    <AlertCircle className="w-5 h-5 text-[#8b4e52] dark:text-[#a86e72] flex-shrink-0" />
    <div className="ml-3">
      <p className="text-sm text-[#8b4e52] dark:text-[#a86e72]">
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
    <div className="border border-[rgba(201,169,97,0.15)] rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Calendar className="w-5 h-5 text-[#8b4e52] mr-2" />
        <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
          Fiscal Year
        </h3>
      </div>

      <div className="bg-[#c9a961]/10 dark:bg-[#c9a961]/20 border border-[#c9a961]/30 dark:border-[#c9a961]/40 rounded-lg p-4 mb-4">
        <FiscalYearWarning />
      </div>

      <div>
        <label
          htmlFor="fiscalYearEnd"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Fiscal Year End
        </label>
        <select
          id="fiscalYearEnd"
          value={systemSettings.fiscalYearEnd}
          onChange={createHandler('fiscalYearEnd')}
          className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
        >
          <FiscalYearOptions />
        </select>
        <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
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
      className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
    >
      Timezone
    </label>
    <select
      id="timezone"
      value={value}
      onChange={onChange}
      className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
    >
      <optgroup label="Universal">
        <option value="Etc/GMT+12">UTC-12:00 - Baker Island, Howland Island (AoE)</option>
        <option value="Pacific/Samoa">UTC-11:00 - Samoa, Niue (SST)</option>
        <option value="Pacific/Honolulu">UTC-10:00 - Hawaii (HST)</option>
        <option value="Pacific/Marquesas">UTC-09:30 - Marquesas Islands (MART)</option>
        <option value="America/Anchorage">UTC-09:00 - Alaska (AKST)</option>
        <option value="America/Los_Angeles">UTC-08:00 - Pacific Time (PST)</option>
        <option value="America/Denver">UTC-07:00 - Mountain Time (MST)</option>
        <option value="America/Chicago">UTC-06:00 - Central Time (CST)</option>
        <option value="America/New_York">UTC-05:00 - Eastern Time (EST)</option>
        <option value="UTC">UTC+00:00 - Coordinated Universal Time (UTC)</option>
      </optgroup>
      <optgroup label="Americas">
        <option value="America/Adak">UTC-10:00 - Adak, Alaska</option>
        <option value="America/Phoenix">UTC-07:00 - Phoenix, Arizona (no DST)</option>
        <option value="America/Boise">UTC-07:00 - Boise, Idaho</option>
        <option value="America/Indiana/Indianapolis">UTC-05:00 - Indianapolis, Indiana</option>
        <option value="America/Detroit">UTC-05:00 - Detroit, Michigan</option>
        <option value="America/Kentucky/Louisville">UTC-05:00 - Louisville, Kentucky</option>
        <option value="America/Halifax">UTC-04:00 - Halifax, Atlantic Canada (AST)</option>
        <option value="America/St_Johns">UTC-03:30 - St. John&apos;s, Newfoundland (NST)</option>
        <option value="America/Mexico_City">UTC-06:00 - Mexico City</option>
        <option value="America/Cancun">UTC-05:00 - Cancun</option>
        <option value="America/Tijuana">UTC-08:00 - Tijuana</option>
        <option value="America/Guatemala">UTC-06:00 - Guatemala</option>
        <option value="America/Costa_Rica">UTC-06:00 - Costa Rica</option>
        <option value="America/Panama">UTC-05:00 - Panama</option>
        <option value="America/Havana">UTC-05:00 - Havana, Cuba</option>
        <option value="America/Jamaica">UTC-05:00 - Kingston, Jamaica</option>
        <option value="America/Bogota">UTC-05:00 - Bogota, Colombia</option>
        <option value="America/Lima">UTC-05:00 - Lima, Peru</option>
        <option value="America/Guayaquil">UTC-05:00 - Guayaquil, Ecuador</option>
        <option value="America/Caracas">UTC-04:00 - Caracas, Venezuela</option>
        <option value="America/La_Paz">UTC-04:00 - La Paz, Bolivia</option>
        <option value="America/Manaus">UTC-04:00 - Manaus, Brazil</option>
        <option value="America/Santiago">UTC-04:00 - Santiago, Chile</option>
        <option value="America/Asuncion">UTC-04:00 - Asuncion, Paraguay</option>
        <option value="America/Montevideo">UTC-03:00 - Montevideo, Uruguay</option>
        <option value="America/Sao_Paulo">UTC-03:00 - Sao Paulo, Brazil</option>
        <option value="America/Buenos_Aires">UTC-03:00 - Buenos Aires, Argentina</option>
        <option value="America/Cayenne">UTC-03:00 - Cayenne, French Guiana</option>
        <option value="America/Miquelon">UTC-03:00 - Saint-Pierre and Miquelon</option>
        <option value="America/Nuuk">UTC-03:00 - Nuuk, Greenland</option>
        <option value="America/Noronha">UTC-02:00 - Fernando de Noronha, Brazil</option>
        <option value="Atlantic/South_Georgia">UTC-02:00 - South Georgia Island</option>
        <option value="Atlantic/Azores">UTC-01:00 - Azores, Portugal</option>
        <option value="Atlantic/Cape_Verde">UTC-01:00 - Cape Verde</option>
      </optgroup>
      <optgroup label="Europe">
        <option value="Atlantic/Reykjavik">UTC+00:00 - Reykjavik, Iceland</option>
        <option value="Europe/London">UTC+00:00 - London, Edinburgh (GMT/BST)</option>
        <option value="Europe/Dublin">UTC+00:00 - Dublin, Ireland (GMT/IST)</option>
        <option value="Europe/Lisbon">UTC+00:00 - Lisbon, Portugal (WET)</option>
        <option value="Atlantic/Canary">UTC+00:00 - Canary Islands</option>
        <option value="Europe/Paris">UTC+01:00 - Paris, France (CET)</option>
        <option value="Europe/Brussels">UTC+01:00 - Brussels, Belgium</option>
        <option value="Europe/Amsterdam">UTC+01:00 - Amsterdam, Netherlands</option>
        <option value="Europe/Berlin">UTC+01:00 - Berlin, Germany</option>
        <option value="Europe/Zurich">UTC+01:00 - Zurich, Switzerland</option>
        <option value="Europe/Rome">UTC+01:00 - Rome, Italy</option>
        <option value="Europe/Madrid">UTC+01:00 - Madrid, Spain</option>
        <option value="Europe/Vienna">UTC+01:00 - Vienna, Austria</option>
        <option value="Europe/Warsaw">UTC+01:00 - Warsaw, Poland</option>
        <option value="Europe/Prague">UTC+01:00 - Prague, Czech Republic</option>
        <option value="Europe/Budapest">UTC+01:00 - Budapest, Hungary</option>
        <option value="Europe/Copenhagen">UTC+01:00 - Copenhagen, Denmark</option>
        <option value="Europe/Stockholm">UTC+01:00 - Stockholm, Sweden</option>
        <option value="Europe/Oslo">UTC+01:00 - Oslo, Norway</option>
        <option value="Europe/Belgrade">UTC+01:00 - Belgrade, Serbia</option>
        <option value="Europe/Luxembourg">UTC+01:00 - Luxembourg</option>
        <option value="Europe/Helsinki">UTC+02:00 - Helsinki, Finland (EET)</option>
        <option value="Europe/Tallinn">UTC+02:00 - Tallinn, Estonia</option>
        <option value="Europe/Riga">UTC+02:00 - Riga, Latvia</option>
        <option value="Europe/Vilnius">UTC+02:00 - Vilnius, Lithuania</option>
        <option value="Europe/Athens">UTC+02:00 - Athens, Greece</option>
        <option value="Europe/Bucharest">UTC+02:00 - Bucharest, Romania</option>
        <option value="Europe/Sofia">UTC+02:00 - Sofia, Bulgaria</option>
        <option value="Europe/Kyiv">UTC+02:00 - Kyiv, Ukraine</option>
        <option value="Europe/Chisinau">UTC+02:00 - Chisinau, Moldova</option>
        <option value="Europe/Istanbul">UTC+03:00 - Istanbul, Turkey (TRT)</option>
        <option value="Europe/Moscow">UTC+03:00 - Moscow, Russia (MSK)</option>
        <option value="Europe/Minsk">UTC+03:00 - Minsk, Belarus</option>
        <option value="Europe/Samara">UTC+04:00 - Samara, Russia</option>
      </optgroup>
      <optgroup label="Africa">
        <option value="Africa/Casablanca">UTC+00:00 - Casablanca, Morocco</option>
        <option value="Africa/Monrovia">UTC+00:00 - Monrovia, Liberia</option>
        <option value="Africa/Abidjan">UTC+00:00 - Abidjan, Ivory Coast</option>
        <option value="Africa/Accra">UTC+00:00 - Accra, Ghana</option>
        <option value="Africa/Lagos">UTC+01:00 - Lagos, Nigeria (WAT)</option>
        <option value="Africa/Algiers">UTC+01:00 - Algiers, Algeria</option>
        <option value="Africa/Tunis">UTC+01:00 - Tunis, Tunisia</option>
        <option value="Africa/Kinshasa">UTC+01:00 - Kinshasa, DR Congo</option>
        <option value="Africa/Windhoek">UTC+02:00 - Windhoek, Namibia</option>
        <option value="Africa/Cairo">UTC+02:00 - Cairo, Egypt (EET)</option>
        <option value="Africa/Tripoli">UTC+02:00 - Tripoli, Libya</option>
        <option value="Africa/Johannesburg">UTC+02:00 - Johannesburg, South Africa (SAST)</option>
        <option value="Africa/Harare">UTC+02:00 - Harare, Zimbabwe</option>
        <option value="Africa/Maputo">UTC+02:00 - Maputo, Mozambique</option>
        <option value="Africa/Khartoum">UTC+02:00 - Khartoum, Sudan</option>
        <option value="Africa/Nairobi">UTC+03:00 - Nairobi, Kenya (EAT)</option>
        <option value="Africa/Dar_es_Salaam">UTC+03:00 - Dar es Salaam, Tanzania</option>
        <option value="Africa/Addis_Ababa">UTC+03:00 - Addis Ababa, Ethiopia</option>
      </optgroup>
      <optgroup label="Middle East">
        <option value="Asia/Jerusalem">UTC+02:00 - Jerusalem, Israel (IST)</option>
        <option value="Asia/Beirut">UTC+02:00 - Beirut, Lebanon</option>
        <option value="Asia/Amman">UTC+03:00 - Amman, Jordan</option>
        <option value="Asia/Damascus">UTC+03:00 - Damascus, Syria</option>
        <option value="Asia/Baghdad">UTC+03:00 - Baghdad, Iraq</option>
        <option value="Asia/Riyadh">UTC+03:00 - Riyadh, Saudi Arabia (AST)</option>
        <option value="Asia/Kuwait">UTC+03:00 - Kuwait City</option>
        <option value="Asia/Qatar">UTC+03:00 - Doha, Qatar</option>
        <option value="Asia/Bahrain">UTC+03:00 - Manama, Bahrain</option>
        <option value="Asia/Tehran">UTC+03:30 - Tehran, Iran (IRST)</option>
        <option value="Asia/Dubai">UTC+04:00 - Dubai, UAE (GST)</option>
        <option value="Asia/Muscat">UTC+04:00 - Muscat, Oman</option>
      </optgroup>
      <optgroup label="Central & South Asia">
        <option value="Asia/Tbilisi">UTC+04:00 - Tbilisi, Georgia</option>
        <option value="Asia/Yerevan">UTC+04:00 - Yerevan, Armenia</option>
        <option value="Asia/Baku">UTC+04:00 - Baku, Azerbaijan</option>
        <option value="Asia/Kabul">UTC+04:30 - Kabul, Afghanistan</option>
        <option value="Asia/Karachi">UTC+05:00 - Karachi, Pakistan (PKT)</option>
        <option value="Asia/Tashkent">UTC+05:00 - Tashkent, Uzbekistan</option>
        <option value="Asia/Yekaterinburg">UTC+05:00 - Yekaterinburg, Russia</option>
        <option value="Asia/Kolkata">UTC+05:30 - Mumbai, Kolkata, India (IST)</option>
        <option value="Asia/Colombo">UTC+05:30 - Colombo, Sri Lanka</option>
        <option value="Asia/Kathmandu">UTC+05:45 - Kathmandu, Nepal</option>
        <option value="Asia/Dhaka">UTC+06:00 - Dhaka, Bangladesh (BST)</option>
        <option value="Asia/Almaty">UTC+06:00 - Almaty, Kazakhstan</option>
        <option value="Asia/Omsk">UTC+06:00 - Omsk, Russia</option>
        <option value="Asia/Yangon">UTC+06:30 - Yangon, Myanmar</option>
        <option value="Indian/Cocos">UTC+06:30 - Cocos Islands</option>
      </optgroup>
      <optgroup label="East & Southeast Asia">
        <option value="Asia/Bangkok">UTC+07:00 - Bangkok, Thailand (ICT)</option>
        <option value="Asia/Jakarta">UTC+07:00 - Jakarta, Indonesia (WIB)</option>
        <option value="Asia/Ho_Chi_Minh">UTC+07:00 - Ho Chi Minh City, Vietnam</option>
        <option value="Asia/Novosibirsk">UTC+07:00 - Novosibirsk, Russia</option>
        <option value="Asia/Phnom_Penh">UTC+07:00 - Phnom Penh, Cambodia</option>
        <option value="Asia/Shanghai">UTC+08:00 - Shanghai, Beijing, China (CST)</option>
        <option value="Asia/Hong_Kong">UTC+08:00 - Hong Kong (HKT)</option>
        <option value="Asia/Taipei">UTC+08:00 - Taipei, Taiwan</option>
        <option value="Asia/Singapore">UTC+08:00 - Singapore (SGT)</option>
        <option value="Asia/Kuala_Lumpur">UTC+08:00 - Kuala Lumpur, Malaysia</option>
        <option value="Asia/Manila">UTC+08:00 - Manila, Philippines (PHT)</option>
        <option value="Asia/Makassar">UTC+08:00 - Makassar, Indonesia (WITA)</option>
        <option value="Asia/Brunei">UTC+08:00 - Brunei</option>
        <option value="Asia/Irkutsk">UTC+08:00 - Irkutsk, Russia</option>
        <option value="Australia/Perth">UTC+08:00 - Perth, Australia (AWST)</option>
        <option value="Asia/Jayapura">UTC+09:00 - Jayapura, Indonesia (WIT)</option>
        <option value="Asia/Seoul">UTC+09:00 - Seoul, South Korea (KST)</option>
        <option value="Asia/Tokyo">UTC+09:00 - Tokyo, Japan (JST)</option>
        <option value="Asia/Yakutsk">UTC+09:00 - Yakutsk, Russia</option>
        <option value="Asia/Pyongyang">UTC+09:00 - Pyongyang, North Korea</option>
      </optgroup>
      <optgroup label="Australia">
        <option value="Australia/Darwin">UTC+09:30 - Darwin, Australia (ACST)</option>
        <option value="Australia/Adelaide">UTC+09:30 - Adelaide, Australia (ACST/ACDT)</option>
        <option value="Australia/Brisbane">UTC+10:00 - Brisbane, Australia (AEST, no DST)</option>
        <option value="Australia/Sydney">UTC+10:00 - Sydney, Melbourne, Australia (AEST/AEDT)</option>
        <option value="Australia/Hobart">UTC+10:00 - Hobart, Tasmania (AEST/AEDT)</option>
        <option value="Australia/Lord_Howe">UTC+10:30 - Lord Howe Island</option>
      </optgroup>
      <optgroup label="Pacific">
        <option value="Pacific/Guam">UTC+10:00 - Guam, Saipan (ChST)</option>
        <option value="Pacific/Port_Moresby">UTC+10:00 - Port Moresby, Papua New Guinea</option>
        <option value="Asia/Vladivostok">UTC+10:00 - Vladivostok, Russia</option>
        <option value="Pacific/Guadalcanal">UTC+11:00 - Solomon Islands</option>
        <option value="Pacific/Noumea">UTC+11:00 - Noumea, New Caledonia</option>
        <option value="Asia/Magadan">UTC+11:00 - Magadan, Russia</option>
        <option value="Pacific/Norfolk">UTC+11:00 - Norfolk Island</option>
        <option value="Pacific/Auckland">UTC+12:00 - Auckland, New Zealand (NZST)</option>
        <option value="Pacific/Fiji">UTC+12:00 - Fiji (FJT)</option>
        <option value="Asia/Kamchatka">UTC+12:00 - Kamchatka, Russia</option>
        <option value="Pacific/Chatham">UTC+12:45 - Chatham Islands, NZ</option>
        <option value="Pacific/Tongatapu">UTC+13:00 - Nuku&apos;alofa, Tonga</option>
        <option value="Pacific/Apia">UTC+13:00 - Apia, Samoa</option>
        <option value="Pacific/Kiritimati">UTC+14:00 - Kiritimati, Line Islands</option>
      </optgroup>
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
          <h2 className="text-xl font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
            General Settings
          </h2>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
            Manage your organization and system preferences
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {hasChanges && (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] flex items-center"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-[#8b4e52] rounded-lg hover:bg-[#7a4248] flex items-center"
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
        <div className="border border-[rgba(201,169,97,0.15)] rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Globe2 className="w-5 h-5 text-[#8b4e52] mr-2" />
            <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
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

        <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)] p-6">
          <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
            Language Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
              >
                Language
              </label>
              <select
                id="language"
                value={systemSettings.language}
                onChange={createSystemSelectHandler('language')}
                className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
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
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
              >
                Date Format
              </label>
              <select
                id="dateFormat"
                value={systemSettings.dateFormat}
                onChange={createSystemSelectHandler('dateFormat')}
                className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="timeFormat"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
              >
                Time Format
              </label>
              <select
                id="timeFormat"
                value={systemSettings.timeFormat}
                onChange={createSystemSelectHandler('timeFormat')}
                className="select-input w-full px-3 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
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
