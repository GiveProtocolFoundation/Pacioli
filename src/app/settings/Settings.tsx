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
} from 'lucide-react'
import Currencies from './Currencies'
import ChartOfAccounts from './ChartOfAccounts'
import GeneralSettings from './GeneralSettings'
import UsersPermissions from './UsersPermissions'

type SettingsSection =
  | 'general'
  | 'currencies'
  | 'chart-of-accounts'
  | 'users-permissions'
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
    component: ChartOfAccounts,
  },
  {
    id: 'users-permissions',
    label: 'Users & Permissions',
    icon: Users,
    description: 'User management and access control',
    component: UsersPermissions,
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

const SettingsHeader: React.FC = () => (
  <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
          Manage your organization settings and preferences
        </p>
      </div>
    </div>
  </header>
)

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
    <aside className="lg:w-64 flex-shrink-0">
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
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700'
                : item.comingSoon
                  ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
            }`}
          >
            <div className="flex items-center flex-1 text-left">
              <Icon
                className={`w-5 h-5 mr-3 flex-shrink-0 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : item.comingSoon
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-500 dark:text-[#94a3b8]'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate">{item.label}</span>
                  {item.comingSoon && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8]">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-0.5 truncate">
                  {item.description}
                </p>
              </div>
            </div>
            {isActive && !item.comingSoon && (
              <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
            )}
          </button>
        )
      })}
    </nav>

    <div className="lg:hidden mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
      <div className="flex items-center text-sm">
        <SettingsIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
        <span className="text-blue-700 dark:text-blue-400 font-medium">
          {items.find(item => item.id === activeSection)?.label}
        </span>
      </div>
    </div>
  </aside>
  )
}

const Settings: React.FC<SettingsProps> = ({ userType = 'organization' }) => {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive active section from URL path
  const activeSection = useMemo<SettingsSection>(() => {
    const path = location.pathname
    if (path === '/settings/general') return 'general'
    if (path === '/settings/currencies') return 'currencies'
    if (path === '/settings/users') return 'users-permissions'
    if (path === '/chart-of-accounts') return 'chart-of-accounts'
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
        } else if (section === 'chart-of-accounts') {
          navigate('/chart-of-accounts')
        }
      }
    },
    [navigate]
  )

  const createSectionHandler = useCallback(
    (section: SettingsSection) => {
      return () => handleSectionChange(section)
    },
    [handleSectionChange]
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
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {ActiveComponent ? (
                activeSection === 'general' ? (
                  <GeneralSettings userType={userType} />
                ) : (
                  <ActiveComponent />
                )
              ) : (
                <div className="p-12 text-center">
                  <SettingsIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    Coming Soon
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-[#94a3b8]">
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
