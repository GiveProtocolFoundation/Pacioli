import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  User,
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
import { useApp } from '../../contexts/AppContext'

// Check if account is a business type (not individual)

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
  showPhone?: boolean
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({
  profile,
  createProfileInputHandler,
  showPhone = true,
}) => (
  <>
    <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
      Personal Information
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          htmlFor="firstName"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          First Name
        </label>
        <input
          id="firstName"
          type="text"
          value={profile.firstName}
          onChange={createProfileInputHandler('firstName')}
          className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
        />
      </div>
      <div>
        <label
          htmlFor="lastName"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Last Name
        </label>
        <input
          id="lastName"
          type="text"
          value={profile.lastName}
          onChange={createProfileInputHandler('lastName')}
          className="w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
        />
      </div>
      {showPhone && (
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
          >
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
            <input
              id="phone"
              type="tel"
              value={profile.phone}
              onChange={createProfileInputHandler('phone')}
              className="w-full pl-10 pr-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
            />
          </div>
        </div>
      )}
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
    <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
      Work Information
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label
          htmlFor="company"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Company
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
          <input
            id="company"
            type="text"
            value={profile.company}
            onChange={createProfileInputHandler('company')}
            placeholder="Your company or organization"
            className="w-full pl-10 pr-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="jobTitle"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Job Title
        </label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
          <input
            id="jobTitle"
            type="text"
            value={profile.jobTitle}
            onChange={createProfileInputHandler('jobTitle')}
            className="w-full pl-10 pr-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="department"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Department
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
          <input
            id="department"
            type="text"
            value={profile.department}
            onChange={createProfileInputHandler('department')}
            className="w-full pl-10 pr-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
          />
        </div>
      </div>
      <div className="md:col-span-2">
        <label
          htmlFor="location"
          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
        >
          Location
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
          <input
            id="location"
            type="text"
            value={profile.location}
            onChange={createProfileInputHandler('location')}
            className="w-full pl-10 pr-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
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
    isBusinessAccount,
  } = useAuth()
  const { securityMode } = useApp()

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
      <div className="min-h-screen bg-[#fafaf8] dark:bg-[#0f0e0c] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-[#a39d94]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] dark:bg-[#0f0e0c]">
      {/* Header */}
      <header className="bg-[#fafaf8] dark:bg-[#0f0e0c] border-b border-[rgba(201,169,97,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1>Your Profile</h1>
              <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
                Manage your personal information and preferences
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Success message */}
              {saveSuccess && (
                <span className="text-sm text-[#7a9b6f] dark:text-[#8faf84]">
                  Profile saved successfully!
                </span>
              )}
              {/* Error message */}
              {(saveError || authError) && (
                <span className="text-sm text-[#9d6b6b] dark:text-[#b88585]">
                  {saveError || authError}
                </span>
              )}
              {hasChanges && (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] flex items-center disabled:opacity-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#8b4e52] rounded-lg hover:bg-[#7a4248] flex items-center disabled:opacity-50"
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
            <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg border border-[rgba(201,169,97,0.15)] p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-[rgba(201,169,97,0.15)]"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 flex items-center justify-center border-4 border-[rgba(201,169,97,0.15)]">
                      <User className="w-12 h-12 text-[#8b4e52] dark:text-[#a86e72]" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#8b4e52] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#7a4248] transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mt-4">
                  {profile.firstName || profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`.trim()
                    : user?.display_name || 'User'}
                </h3>
                <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
                  {profile.jobTitle || profile.email}
                </p>
              </div>

              {/* Tab Navigation */}
              <nav className="space-y-1">
                <button
                  onClick={handleTabProfile}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
                      : 'text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]'
                  }`}
                >
                  <User className="w-4 h-4 mr-3" />
                  Profile Information
                </button>
                {securityMode !== 'easy' && (
                  <button
                    onClick={handleTabSecurity}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'security'
                        ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
                        : 'text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]'
                    }`}
                  >
                    <Shield className="w-4 h-4 mr-3" />
                    Security
                  </button>
                )}
                <button
                  onClick={handleTabPreferences}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'preferences'
                      ? 'bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
                      : 'text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]'
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
            <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg border border-[rgba(201,169,97,0.15)] p-6">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <PersonalInfo
                      profile={profile}
                      createProfileInputHandler={createProfileInputHandler}
                      showPhone={isBusinessAccount}
                    />
                  </div>
                  {isBusinessAccount && (
                    <div className="border-t border-[rgba(201,169,97,0.15)] pt-6">
                      <WorkInfo
                        profile={profile}
                        createProfileInputHandler={createProfileInputHandler}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'security' && securityMode !== 'easy' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
                      Security Settings
                    </h3>

                    {/* Two-Factor Authentication */}
                    <div className="flex items-center justify-between py-4 border-b border-[rgba(201,169,97,0.15)]">
                      <div className="flex items-start">
                        <Shield className="w-5 h-5 text-[#8b4e52] dark:text-[#a86e72] mr-3 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                            Two-Factor Authentication
                          </p>
                          <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#c9a961]/50 dark:peer-focus:ring-[#c9a961]/30 rounded-full peer dark:bg-[#2a2620] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#8b4e52]" />
                      </label>
                    </div>

                    {/* Login Alerts */}
                    <div className="flex items-center justify-between py-4 border-b border-[rgba(201,169,97,0.15)]">
                      <div className="flex items-start">
                        <Bell className="w-5 h-5 text-[#8b4e52] dark:text-[#a86e72] mr-3 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                            Login Alerts
                          </p>
                          <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#c9a961]/50 dark:peer-focus:ring-[#c9a961]/30 rounded-full peer dark:bg-[#2a2620] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#8b4e52]" />
                      </label>
                    </div>

                    {/* Change Password */}
                    <div className="pt-4">
                      <button className="w-full flex items-center justify-between px-4 py-3 bg-[#f3f1ed] dark:bg-[#1a1815] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors">
                        <div className="flex items-center">
                          <Lock className="w-5 h-5 text-[#696557] dark:text-[#b8b3ac] mr-3" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                              Change Password
                            </p>
                            <p className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                              Last changed 30 days ago
                            </p>
                          </div>
                        </div>
                        <Key className="w-5 h-5 text-[#a39d94]" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
                      Regional Preferences
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="timezone"
                          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                        >
                          Timezone
                        </label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
                          <select
                            id="timezone"
                            value={profile.timezone}
                            onChange={createProfileInputHandler('timezone')}
                            className="select-input w-full pl-10 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                          >
                            <optgroup label="Universal">
                              <option value="UTC">UTC</option>
                            </optgroup>
                            <optgroup label="Americas">
                              <option value="Pacific/Honolulu">
                                Hawaii (HST)
                              </option>
                              <option value="America/Anchorage">
                                Alaska (AKST)
                              </option>
                              <option value="America/Los_Angeles">
                                Pacific Time (US & Canada)
                              </option>
                              <option value="America/Denver">
                                Mountain Time (US & Canada)
                              </option>
                              <option value="America/Phoenix">
                                Arizona (MST)
                              </option>
                              <option value="America/Chicago">
                                Central Time (US & Canada)
                              </option>
                              <option value="America/New_York">
                                Eastern Time (US & Canada)
                              </option>
                              <option value="America/Halifax">
                                Atlantic Time (Canada)
                              </option>
                              <option value="America/St_Johns">
                                Newfoundland (Canada)
                              </option>
                              <option value="America/Mexico_City">
                                Mexico City
                              </option>
                              <option value="America/Bogota">Bogota</option>
                              <option value="America/Lima">Lima</option>
                              <option value="America/Caracas">Caracas</option>
                              <option value="America/Santiago">Santiago</option>
                              <option value="America/Sao_Paulo">
                                Sao Paulo
                              </option>
                              <option value="America/Buenos_Aires">
                                Buenos Aires
                              </option>
                            </optgroup>
                            <optgroup label="Europe">
                              <option value="Atlantic/Reykjavik">
                                Reykjavik (GMT)
                              </option>
                              <option value="Europe/London">
                                London (GMT/BST)
                              </option>
                              <option value="Europe/Dublin">
                                Dublin (GMT/IST)
                              </option>
                              <option value="Europe/Lisbon">Lisbon</option>
                              <option value="Europe/Paris">Paris</option>
                              <option value="Europe/Brussels">Brussels</option>
                              <option value="Europe/Amsterdam">
                                Amsterdam
                              </option>
                              <option value="Europe/Berlin">Berlin</option>
                              <option value="Europe/Zurich">Zurich</option>
                              <option value="Europe/Rome">Rome</option>
                              <option value="Europe/Madrid">Madrid</option>
                              <option value="Europe/Vienna">Vienna</option>
                              <option value="Europe/Warsaw">Warsaw</option>
                              <option value="Europe/Prague">Prague</option>
                              <option value="Europe/Stockholm">
                                Stockholm
                              </option>
                              <option value="Europe/Oslo">Oslo</option>
                              <option value="Europe/Helsinki">Helsinki</option>
                              <option value="Europe/Athens">Athens</option>
                              <option value="Europe/Bucharest">
                                Bucharest
                              </option>
                              <option value="Europe/Kiev">Kyiv</option>
                              <option value="Europe/Moscow">Moscow</option>
                              <option value="Europe/Istanbul">Istanbul</option>
                            </optgroup>
                            <optgroup label="Africa">
                              <option value="Africa/Casablanca">
                                Casablanca
                              </option>
                              <option value="Africa/Lagos">Lagos</option>
                              <option value="Africa/Cairo">Cairo</option>
                              <option value="Africa/Nairobi">Nairobi</option>
                              <option value="Africa/Johannesburg">
                                Johannesburg
                              </option>
                            </optgroup>
                            <optgroup label="Middle East">
                              <option value="Asia/Jerusalem">Jerusalem</option>
                              <option value="Asia/Beirut">Beirut</option>
                              <option value="Asia/Dubai">Dubai</option>
                              <option value="Asia/Riyadh">Riyadh</option>
                              <option value="Asia/Tehran">Tehran</option>
                            </optgroup>
                            <optgroup label="Asia">
                              <option value="Asia/Karachi">Karachi</option>
                              <option value="Asia/Kolkata">
                                Mumbai / New Delhi (IST)
                              </option>
                              <option value="Asia/Dhaka">Dhaka</option>
                              <option value="Asia/Bangkok">Bangkok</option>
                              <option value="Asia/Jakarta">Jakarta</option>
                              <option value="Asia/Singapore">Singapore</option>
                              <option value="Asia/Kuala_Lumpur">
                                Kuala Lumpur
                              </option>
                              <option value="Asia/Hong_Kong">Hong Kong</option>
                              <option value="Asia/Shanghai">
                                Beijing / Shanghai
                              </option>
                              <option value="Asia/Taipei">Taipei</option>
                              <option value="Asia/Manila">Manila</option>
                              <option value="Asia/Seoul">Seoul</option>
                              <option value="Asia/Tokyo">Tokyo</option>
                            </optgroup>
                            <optgroup label="Australia & Pacific">
                              <option value="Australia/Perth">Perth</option>
                              <option value="Australia/Darwin">Darwin</option>
                              <option value="Australia/Adelaide">
                                Adelaide
                              </option>
                              <option value="Australia/Brisbane">
                                Brisbane
                              </option>
                              <option value="Australia/Sydney">
                                Sydney / Melbourne
                              </option>
                              <option value="Pacific/Guam">Guam</option>
                              <option value="Pacific/Auckland">Auckland</option>
                              <option value="Pacific/Fiji">Fiji</option>
                              <option value="Pacific/Tongatapu">Tonga</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="language"
                          className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                        >
                          Language
                        </label>
                        <select
                          id="language"
                          value={profile.language}
                          onChange={createProfileInputHandler('language')}
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
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a39d94]" />
                          <select
                            id="dateFormat"
                            value={profile.dateFormat}
                            onChange={createProfileInputHandler('dateFormat')}
                            className="select-input w-full pl-10 pr-8 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                          >
                            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[rgba(201,169,97,0.15)] pt-6">
                    <h3 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-4">
                      Notification Preferences
                    </h3>

                    <div className="flex items-center justify-between py-4 border-b border-[rgba(201,169,97,0.15)]">
                      <div>
                        <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                          Email Notifications
                        </p>
                        <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#c9a961]/50 dark:peer-focus:ring-[#c9a961]/30 rounded-full peer dark:bg-[#2a2620] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#8b4e52]" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                          SMS Notifications
                        </p>
                        <p className="text-xs text-[#696557] dark:text-[#b8b3ac] mt-1">
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#c9a961]/50 dark:peer-focus:ring-[#c9a961]/30 rounded-full peer dark:bg-[#2a2620] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#8b4e52]" />
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
