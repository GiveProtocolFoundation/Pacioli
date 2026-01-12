import React, { useState, useCallback, useEffect, useMemo } from 'react'
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
  Loader2,
} from 'lucide-react'
import { useOrganization } from '../../contexts/OrganizationContext'
import { useAuth } from '../../contexts/AuthContext'

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
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

interface PersonalInfoProps {
  profile: UserProfile
  createProfileInputHandler: (
    key: keyof UserProfile
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onChangeEmail: () => void
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({
  profile,
  createProfileInputHandler,
  onChangeEmail,
}) => (
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={profile.email}
              readOnly
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
            />
          </div>
          <button
            type="button"
            onClick={onChangeEmail}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Change
          </button>
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

interface WorkInfoProps {
  profile: UserProfile
  createProfileInputHandler: (
    key: keyof UserProfile
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

const WorkInfo: React.FC<WorkInfoProps> = ({
  profile,
  createProfileInputHandler,
}) => (
  <>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      Work Information
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label
          htmlFor="company"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Company
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="company"
            type="text"
            value={profile.company}
            onChange={createProfileInputHandler('company')}
            placeholder="Your company or organization"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
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

const Profile: React.FC = () => {
  const { userAvatar, setUserAvatar } = useOrganization()
  const {
    user,
    updateUser,
    isLoading: authLoading,
    error: authError,
  } = useAuth()

  // Initialize profile from authenticated user
  const initialProfile = useMemo<UserProfile>(
    () => ({
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company || '',
      jobTitle: user?.job_title || '',
      department: user?.department || '',
      location: user?.location || '',
      timezone: user?.timezone || 'UTC',
      language: user?.language || 'en',
      dateFormat: user?.date_format || 'MM/DD/YYYY',
      avatar: user?.avatar_url || userAvatar,
    }),
    [user, userAvatar]
  )

  const initialSecurity = useMemo<SecuritySettings>(
    () => ({
      twoFactorEnabled: user?.two_factor_enabled || false,
      emailNotifications: user?.email_notifications ?? true,
      smsNotifications: user?.sms_notifications ?? false,
      loginAlerts: user?.login_alerts ?? true,
    }),
    [user]
  )

  const [profile, setProfile] = useState<UserProfile>(initialProfile)
  const [security, setSecurity] = useState<SecuritySettings>(initialSecurity)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'preferences'
  >('profile')

  // Email change state
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false)
  const [emailChangePassword, setEmailChangePassword] = useState('')
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState('')
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null)

  // Update profile when user data changes
  useEffect(() => {
    if (user) {
      setProfile(initialProfile)
      setSecurity(initialSecurity)
      setHasChanges(false)
    }
  }, [user, initialProfile, initialSecurity])

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

  const handleSave = useCallback(async () => {
    if (!user) return

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await updateUser({
        display_name:
          `${profile.firstName} ${profile.lastName}`.trim() ||
          user.display_name,
        avatar_url: profile.avatar || undefined,
        first_name: profile.firstName || undefined,
        last_name: profile.lastName || undefined,
        phone: profile.phone || undefined,
        company: profile.company || undefined,
        job_title: profile.jobTitle || undefined,
        department: profile.department || undefined,
        location: profile.location || undefined,
        timezone: profile.timezone || undefined,
        language: profile.language || undefined,
        date_format: profile.dateFormat || undefined,
        email_notifications: security.emailNotifications,
        sms_notifications: security.smsNotifications,
        login_alerts: security.loginAlerts,
      })
      setHasChanges(false)
      setSaveSuccess(true)
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save profile'
      )
    } finally {
      setIsSaving(false)
    }
  }, [user, profile, security, updateUser])

  const handleCancel = useCallback(() => {
    // Reset to initial values from user data
    setProfile(initialProfile)
    setSecurity(initialSecurity)
    setHasChanges(false)
    setSaveError(null)
  }, [initialProfile, initialSecurity])

  // Email change handlers
  const handleOpenEmailChange = useCallback(() => {
    setShowEmailChangeModal(true)
    setEmailChangePassword('')
    setEmailChangeNewEmail('')
    setEmailChangeError(null)
    setEmailChangeSuccess(null)
  }, [])

  const handleCloseEmailChange = useCallback(() => {
    setShowEmailChangeModal(false)
    setEmailChangePassword('')
    setEmailChangeNewEmail('')
    setEmailChangeError(null)
  }, [])

  const handleSubmitEmailChange = useCallback(async () => {
    if (!emailChangePassword || !emailChangeNewEmail) {
      setEmailChangeError('Please fill in all fields')
      return
    }

    setEmailChangeLoading(true)
    setEmailChangeError(null)

    try {
      const { authService } = await import('../../services/auth')
      const token = authService.getAccessToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await authService.requestEmailChange(
        token,
        emailChangePassword,
        emailChangeNewEmail
      )

      setEmailChangeSuccess(response.message)
      setEmailChangePassword('')
      setEmailChangeNewEmail('')
      // Close modal after 5 seconds on success
      setTimeout(() => {
        setShowEmailChangeModal(false)
        setEmailChangeSuccess(null)
      }, 5000)
    } catch (err) {
      setEmailChangeError(
        err instanceof Error ? err.message : 'Failed to request email change'
      )
    } finally {
      setEmailChangeLoading(false)
    }
  }, [emailChangePassword, emailChangeNewEmail])

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

  // Show loading state while auth is initializing
  if (authLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1>Your Profile</h1>
              <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
                Manage your personal information and preferences
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Success message */}
              {saveSuccess && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  Profile saved successfully!
                </span>
              )}
              {/* Error message */}
              {(saveError || authError) && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {saveError || authError}
                </span>
              )}
              {hasChanges && (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center disabled:opacity-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
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
                  {profile.firstName || profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`.trim()
                    : user?.display_name || 'User'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-[#94a3b8]">
                  {profile.jobTitle || profile.email}
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
                      onChangeEmail={handleOpenEmailChange}
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
                            className="select-input w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <select
                            id="dateFormat"
                            value={profile.dateFormat}
                            onChange={createProfileInputHandler('dateFormat')}
                            className="select-input w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Email Change Modal */}
      {showEmailChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Change Email Address
              </h3>
              <button
                onClick={handleCloseEmailChange}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {emailChangeSuccess ? (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-400">
                  {emailChangeSuccess}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  To change your email address, please enter your current password and new email below.
                  We&apos;ll send a verification link to your new email address.
                </p>

                {emailChangeError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-800 dark:text-red-400">
                      {emailChangeError}
                    </p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="emailChangePassword"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="emailChangePassword"
                      type="password"
                      value={emailChangePassword}
                      onChange={e => setEmailChangePassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="emailChangeNewEmail"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    New Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="emailChangeNewEmail"
                      type="email"
                      value={emailChangeNewEmail}
                      onChange={e => setEmailChangeNewEmail(e.target.value)}
                      placeholder="Enter your new email address"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-4">
                  <button
                    onClick={handleCloseEmailChange}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitEmailChange}
                    disabled={emailChangeLoading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {emailChangeLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Request Change'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
