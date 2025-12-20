import React, { useState, useCallback } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Shield,
  Bell,
  Lock,
  Key,
  Camera,
  Save,
  X,
  Globe,
  Calendar,
  Briefcase,
} from 'lucide-react'
import { useOrganization } from '../../contexts/OrganizationContext'

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  department: string
  location: string
  timezone: string
  language: string
  dateFormat: string
  avatar: string | null
}

interface SecuritySettings {
  twoFactorEnabled: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  loginAlerts: boolean
}

const Profile: React.FC = () => {
  const { userAvatar, setUserAvatar } = useOrganization()

  const [profile, setProfile] = useState<UserProfile>({
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.org',
    phone: '+1 (555) 123-4567',
    jobTitle: 'Chief Financial Officer',
    department: 'Finance',
    location: 'San Francisco, CA',
    timezone: 'America/Los_Angeles',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    avatar: userAvatar,
  })

  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: true,
    emailNotifications: true,
    smsNotifications: false,
    loginAlerts: true,
  })

  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'preferences'
  >('profile')

  const handleProfileChange = useCallback(
    <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
      setProfile(prev => ({ ...prev, [key]: value }))
      setHasChanges(true)
    },
    []
  )

  const handleSecurityChange = useCallback(
    <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
      setSecurity(prev => ({ ...prev, [key]: value }))
      setHasChanges(true)
    },
    []
  )

  const handleSave = useCallback(() => {
    // TODO: Save to backend
    // console.log('Saving profile:', { profile, security })
    setHasChanges(false)
    // Show success message
  }, [])

  const handleCancel = useCallback(() => {
    // Reset changes
    setHasChanges(false)
  }, [])

  const handleAvatarUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        setUserAvatar(url)
        handleProfileChange('avatar', url)
      }
    },
    [setUserAvatar, handleProfileChange]
  )

  // Tab navigation handlers
  const handleTabProfile = useCallback(() => {
    setActiveTab('profile')
  }, [])

  const handleTabSecurity = useCallback(() => {
    setActiveTab('security')
  }, [])

  const handleTabPreferences = useCallback(() => {
    setActiveTab('preferences')
  }, [])

  // Factory function for profile text/select input handlers
  const createProfileInputHandler = useCallback(
    (key: keyof UserProfile) => {
      return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        handleProfileChange(key, e.target.value)
      }
    },
    [handleProfileChange]
  )

  // Factory function for security checkbox handlers
  const createSecurityToggleHandler = useCallback(
    (key: keyof SecuritySettings) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        handleSecurityChange(key, e.target.checked)
      }
    },
    [handleSecurityChange]
  )

  // Extracted components to reduce JSX nesting
  const PersonalInfo: React.FC<{
    profile: UserProfile
    createProfileInputHandler: (
      key: keyof UserProfile
    ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  }> = ({ profile, createProfileInputHandler }) => (
    <>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Personal Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={profile.firstName}
            onChange={createProfileInputHandler('firstName')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={profile.lastName}
            onChange={createProfileInputHandler('lastName')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={profile.email}
              onChange={createProfileInputHandler('email')}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="phone"
              type="tel"
              value={profile.phone}
              onChange={createProfileInputHandler('phone')}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </>
  )

  /**
   * Component that renders the work information section of the user profile form.
   * @param {Object} props - Component props.
   * @param {UserProfile} props.profile - The user's profile data.
   * @param {(key: keyof UserProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void} props.createProfileInputHandler - Function to create input change handlers for profile fields.
   * @returns {JSX.Element} The work information form section.
   */
  const WorkInfo: React.FC<{
    profile: UserProfile
    createProfileInputHandler: (
      key: keyof UserProfile
    ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  }> = ({ profile, createProfileInputHandler }) => (
    <>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Work Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="jobTitle"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Job Title
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="jobTitle"
              type="text"
              value={profile.jobTitle}
              onChange={createProfileInputHandler('jobTitle')}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="department"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Department
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="department"
              type="text"
              value={profile.department}
              onChange={createProfileInputHandler('department')}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor="location"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Location
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="location"
              type="text"
              value={profile.location}
              onChange={createProfileInputHandler('location')}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Your Profile
              </h1>
              <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
                Manage your personal information and preferences
              </p>
            </div>
            {hasChanges && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCancel}
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
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-4 border-gray-200 dark:border-gray-700">
                      <User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">
                  {profile.firstName} {profile.lastName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-[#94a3b8]">
                  {profile.jobTitle}
                </p>
              </div>

              {/* Tab Navigation */}
              <nav className="space-y-1">
                <button
                  onClick={handleTabProfile}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <User className="w-4 h-4 mr-3" />
                  Profile Information
                </button>
                <button
                  onClick={handleTabSecurity}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'security'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Shield className="w-4 h-4 mr-3" />
                  Security
                </button>
                <button
                  onClick={handleTabPreferences}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'preferences'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Bell className="w-4 h-4 mr-3" />
                  Preferences
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <PersonalInfo
                      profile={profile}
                      createProfileInputHandler={createProfileInputHandler}
                    />
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <WorkInfo
                      profile={profile}
                      createProfileInputHandler={createProfileInputHandler}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Security Settings
                    </h3>

                    {/* Two-Factor Authentication */}
                    <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-start">
                        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Two-Factor Authentication
                          </p>
                          <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                      </div>
                      <label
                        aria-label="Two-Factor Authentication"
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={security.twoFactorEnabled}
                          onChange={createSecurityToggleHandler(
                            'twoFactorEnabled'
                          )}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
                      </label>
                    </div>

                    {/* Login Alerts */}
                    <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-start">
                        <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Login Alerts
                          </p>
                          <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
                            Get notified of new sign-ins to your account
                          </p>
                        </div>
                      </div>
                      <label
                        aria-label="Login Alerts"
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={security.loginAlerts}
                          onChange={createSecurityToggleHandler('loginAlerts')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
                      </label>
                    </div>

                    {/* Change Password */}
                    <div className="pt-4">
                      <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center">
                          <Lock className="w-5 h-5 text-gray-600 dark:text-[#94a3b8] mr-3" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              Change Password
                            </p>
                            <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
                              Last changed 30 days ago
                            </p>
                          </div>
                        </div>
                        <Key className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Regional Preferences
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="timezone"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Timezone
                        </label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <select
                            id="timezone"
                            value={profile.timezone}
                            onChange={createProfileInputHandler('timezone')}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="America/Los_Angeles">
                              Pacific Time (US & Canada)
                            </option>
                            <option value="America/Denver">
                              Mountain Time (US & Canada)
                            </option>
                            <option value="America/Chicago">
                              Central Time (US & Canada)
                            </option>
                            <option value="America/New_York">
                              Eastern Time (US & Canada)
                            </option>
                            <option value="UTC">UTC</option>
                          </select>
                        </div>
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
                          value={profile.language}
                          onChange={createProfileInputHandler('language')}
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
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <select
                            id="dateFormat"
                            value={profile.dateFormat}
                            onChange={createProfileInputHandler('dateFormat')}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Notification Preferences
                    </h3>

                    <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Email Notifications
                        </p>
                        <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
                          Receive notifications via email
                        </p>
                      </div>
                      <label
                        aria-label="Email Notifications"
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={security.emailNotifications}
                          onChange={createSecurityToggleHandler(
                            'emailNotifications'
                          )}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          SMS Notifications
                        </p>
                        <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-1">
                          Receive notifications via SMS
                        </p>
                      </div>
                      <label
                        aria-label="SMS Notifications"
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={security.smsNotifications}
                          onChange={createSecurityToggleHandler(
                            'smsNotifications'
                          )}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
