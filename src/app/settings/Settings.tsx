import React, { useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Globe,
  BookOpen,
  Users,
  Bell,
  FileText,
  Plug,
  ChevronRight,
  Key,
} from 'lucide-react'
import Currencies from './Currencies'
import CoASettings from './CoASettings'
import GeneralSettings from './GeneralSettings'
import UsersPermissions from './UsersPermissions'
import DataProviders from './DataProviders'

type SettingsSection =
  | 'general'
  | 'currencies'
  | 'chart-of-accounts'
  | 'users-permissions'
  | 'data-providers'
  | 'integrations'
  | 'notifications'
  | 'audit-logs'

interface NavigationItem {
  id: SettingsSection
  label: string
  icon: React.ElementType
  description: string
  component?: React.ComponentType
  comingSoon?: boolean
}

const navigationItems: NavigationItem[] = [
  {
    id: 'general',
    label: 'General',
    icon: SettingsIcon,
    description: 'Organization and system preferences',
    component: GeneralSettings,
  },
  {
    id: 'currencies',
    label: 'Currencies',
    icon: Globe,
    description: 'Currency settings and exchange rates',
    component: Currencies,
  },
  {
    id: 'chart-of-accounts',
    label: 'Chart of Accounts',
    icon: BookOpen,
    description: 'Account structure and categories',
    component: CoASettings,
  },
  {
    id: 'users-permissions',
    label: 'Users & Permissions',
    icon: Users,
    description: 'User management and access control',
    component: UsersPermissions,
  },
  {
    id: 'data-providers',
    label: 'Data Providers',
    icon: Key,
    description: 'API keys for faster blockchain sync',
    component: DataProviders,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    description: 'Connect external services',
    comingSoon: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Email and alert preferences',
    comingSoon: true,
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: FileText,
    description: 'Activity history and compliance',
    comingSoon: true,
  },
]

interface SettingsProps {
  userType?: 'individual' | 'organization'
}

/**
 * Renders the settings header section containing title and subtitle.
 *
 * @returns {JSX.Element} The settings header component.
 */
const SettingsHeader: React.FC = () => (
  <header className="bg-[#F7FAFA] dark:bg-[#0C141B] border-b border-[rgba(95,227,192,0.15)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div>
        <h1>Settings</h1>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
          Manage your organization settings and preferences
        </p>
      </div>
    </div>
  </header>
)

/**
 * Renders the sidebar navigation for settings sections.
 *
 * @param {Object} props - Component props.
 * @param {typeof navigationItems} props.items - Array of navigation items.
 * @param {SettingsSection} props.activeSection - Currently active settings section ID.
 * @param {(section: SettingsSection) => void} props.onSectionChange - Callback to change active section.
 * @returns {JSX.Element} The sidebar navigation component.
 */
const SidebarNavigation: React.FC<{
  items: typeof navigationItems
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}> = ({ items, activeSection, onSectionChange }) => {
  const handleClicksMap = useMemo(() => {
    const map: Record<string, () => void> = {}
    items.forEach(item => {
      map[item.id] = () => onSectionChange(item.id)
    })
    return map
  }, [items, onSectionChange])

  return (
    <aside className="lg:w-80 flex-shrink-0">
      <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-3">
        <nav className="space-y-1">
          {items.map(item => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            const handleClick = handleClicksMap[item.id]

            return (
              <button
                key={item.id}
                onClick={handleClick}
                disabled={item.comingSoon}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988]'
                    : item.comingSoon
                      ? 'text-[#647D8B] dark:text-[#294050] cursor-not-allowed'
                      : 'text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]'
                }`}
              >
                <div className="flex items-center flex-1 text-left">
                  <Icon
                    className={`w-5 h-5 mr-3 flex-shrink-0 ${
                      isActive
                        ? 'text-[#294050] dark:text-[#F09988]'
                        : item.comingSoon
                          ? 'text-[#647D8B] dark:text-[#294050]'
                          : 'text-[#294050] dark:text-[#9FB4BE]'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.comingSoon && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EAF3F2] dark:bg-[#16242F] text-[#294050] dark:text-[#9FB4BE]">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#647D8B] dark:text-[#647D8B] mt-0.5 truncate">
                      {item.description}
                    </p>
                  </div>
                </div>
                {isActive && !item.comingSoon && (
                  <ChevronRight className="w-4 h-4 text-[#294050] dark:text-[#F09988] flex-shrink-0 ml-2" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="lg:hidden mt-4 p-3 bg-[#294050]/10 dark:bg-[#294050]/20 rounded-lg border border-[#294050]/30 dark:border-[#294050]/40">
        <div className="flex items-center text-sm">
          <SettingsIcon className="w-4 h-4 text-[#294050] dark:text-[#F09988] mr-2" />
          <span className="text-[#294050] dark:text-[#F09988] font-medium">
            {items.find(item => item.id === activeSection)?.label}
          </span>
        </div>
      </div>
    </aside>
  )
}

/**
 * Renders the settings page and manages navigation between different settings sections.
 *
 * @param {string} userType - The type of user, defaults to 'organization'.
 * @returns {JSX.Element} The Settings component.
 */
const Settings: React.FC<SettingsProps> = ({ userType = 'organization' }) => {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive active section from URL path
  const activeSection = useMemo<SettingsSection>(() => {
    const path = location.pathname
    if (path === '/settings/general') return 'general'
    if (path === '/settings/currencies') return 'currencies'
    if (path === '/settings/users') return 'users-permissions'
    if (path === '/settings/data-providers') return 'data-providers'
    if (path === '/settings/chart-of-accounts') return 'chart-of-accounts'
    return 'general'
  }, [location.pathname])

  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      const item = navigationItems.find(item => item.id === section)
      if (!item?.comingSoon) {
        // Update URL
        if (section === 'general') {
          navigate('/settings/general')
        } else if (section === 'currencies') {
          navigate('/settings/currencies')
        } else if (section === 'users-permissions') {
          navigate('/settings/users')
        } else if (section === 'data-providers') {
          navigate('/settings/data-providers')
        } else if (section === 'chart-of-accounts') {
          navigate('/settings/chart-of-accounts')
        }
      }
    },
    [navigate]
  )

  const ActiveComponent = navigationItems.find(
    item => item.id === activeSection
  )?.component

  return (
    <div className="min-h-screen ledger-background">
      <SettingsHeader />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <SidebarNavigation
            items={navigationItems}
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
          />

          {/* Content Area */}
          <main className="flex-1 min-w-0">
            <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg shadow-sm border border-[rgba(95,227,192,0.15)] overflow-hidden">
              {ActiveComponent ? (
                activeSection === 'general' ? (
                  <GeneralSettings userType={userType} />
                ) : (
                  <ActiveComponent />
                )
              ) : (
                <div className="p-12 text-center">
                  <SettingsIcon className="mx-auto h-12 w-12 text-[#647D8B]" />
                  <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
                    Coming Soon
                  </h3>
                  <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
                    This feature is under development.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Settings
