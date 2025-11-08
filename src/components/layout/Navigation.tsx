import React, { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  Wallet,
  BarChart3,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  HelpCircle,
  MessageCircle,
  Moon,
  Sun,
} from 'lucide-react'
import PacioliWhiteLogo from '../../assets/pacioli_logo_white.svg'
import PacioliBlackLogo from '../../assets/Pacioli_logo_black.svg'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrganization } from '../../contexts/OrganizationContext'
import { useTransactions } from '../../contexts/TransactionContext'
import NotificationsPanel from '../notifications/NotificationsPanel'

interface NavigationProps {
  children: React.ReactNode
  userType?: 'individual' | 'organization'
}

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: number
  subItems?: { name: string; href: string }[]
}

const Navigation: React.FC<NavigationProps> = ({
  children,
  userType = 'organization',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { organizationLogo, userAvatar } = useOrganization()
  const { pendingApprovals } = useTransactions()

  const pendingCount = pendingApprovals.length

  // Navigation items for organizations/charities
  const organizationNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: Receipt,
      badge: pendingCount > 0 ? pendingCount : undefined,
      subItems: [
        { name: 'All Transactions', href: '/transactions?filter=all' },
        { name: 'Revenue', href: '/transactions?filter=revenue' },
        { name: 'Expense', href: '/transactions?filter=expense' },
        { name: 'Transfers', href: '/transactions?filter=transfers' },
      ],
    },
    { name: 'Wallets', href: '/wallets', icon: Wallet },
    {
      name: 'Reports',
      href: '/reports',
      icon: FileText,
      subItems: [
        { name: 'Financial Reports', href: '/reports/financial' },
        { name: 'Tax Reports', href: '/reports/tax' },
        { name: 'Donor Reports', href: '/reports/donors' },
        { name: 'Compliance', href: '/reports/compliance' },
      ],
    },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Support', href: '/support', icon: MessageCircle },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      subItems: [
        { name: 'Currencies', href: '/settings/currencies' },
        { name: 'Chart of Accounts', href: '/chart-of-accounts' },
        { name: 'General Settings', href: '/settings/general' },
        { name: 'Users & Permissions', href: '/settings/users' },
      ],
    },
  ]

  // Simplified navigation for individuals
  const individualNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: Receipt, badge: pendingCount > 0 ? pendingCount : undefined },
    { name: 'Wallets', href: '/wallets', icon: Wallet },
    { name: 'Tax Reports', href: '/reports', icon: FileText },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      subItems: [
        { name: 'Currencies', href: '/settings/currencies' },
        { name: 'Chart of Accounts', href: '/chart-of-accounts' },
        { name: 'General Settings', href: '/settings/general' },
      ],
    },
  ]

  const navItems =
    userType === 'organization' ? organizationNavItems : individualNavItems

  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = useCallback((itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true)
  }, [])

  const handleToggleUserMenu = useCallback(() => {
    setUserMenuOpen(prev => !prev)
  }, [])

  const handleBackdropKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSidebarOpen(false)
    }
  }, [])

  const handleOpenNotifications = useCallback(() => {
    setNotificationsOpen(true)
  }, [])

  const handleCloseNotifications = useCallback(() => {
    setNotificationsOpen(false)
  }, [])

  const createToggleExpandedHandler = useCallback(
    (itemName: string) => {
      return () => toggleExpanded(itemName)
    },
    [toggleExpanded]
  )

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-black">
      {/* Sidebar for desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 ledger-sidebar border-r border-gray-200 dark:border-gray-700">
        {/* Logo */}
        <div className="flex items-center h-16 px-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center px-3">
            <img
              src={theme === 'dark' ? PacioliBlackLogo : PacioliWhiteLogo}
              alt="Pacioli"
              className="h-12 w-auto mix-blend-multiply dark:mix-blend-normal"
            />
            <div className="ml-3 flex flex-col">
              <span className="font-serif font-bold text-gray-900 dark:text-white" style={{ fontSize: '24px', letterSpacing: '0.5px', color: '#7c3626' }}>
                Pacioli
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Books & Ledgers
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map(item => {
              const isActive =
                location.pathname === item.href ||
                item.subItems?.some(
                  sub => location.pathname + location.search === sub.href
                )

              return (
                <li key={item.name}>
                  {item.subItems ? (
                    <button
                      onClick={createToggleExpandedHandler(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#7c3626]/10 dark:bg-[#a04830]/10 text-[#7c3626] dark:text-[#a04830] font-semibold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {item.badge && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#c14040] dark:bg-[#d45050] rounded-full">
                            {item.badge}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            expandedItems.includes(item.name)
                              ? 'transform rotate-180'
                              : ''
                          }`}
                        />
                      </div>
                    </button>
                  ) : (
                    <Link
                      to={item.href}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#7c3626]/10 dark:bg-[#a04830]/10 text-[#7c3626] dark:text-[#a04830] font-semibold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#c14040] dark:bg-[#d45050] rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* Sub-items */}
                  {item.subItems && expandedItems.includes(item.name) && (
                    <ul className="mt-1 ml-8 space-y-1">
                      {item.subItems.map(subItem => {
                        const isSubActive =
                          location.pathname + location.search === subItem.href
                        return (
                          <li key={subItem.name}>
                            <Link
                              to={subItem.href}
                              className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                isSubActive
                                  ? 'text-[#7c3626] dark:text-[#a04830] bg-[#7c3626]/10 dark:bg-[#a04830]/10 font-medium'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-normal'
                              }`}
                            >
                              {subItem.name}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            {userType === 'organization' && organizationLogo ? (
              <img
                src={organizationLogo}
                alt="Organization"
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
            )}
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {userType === 'organization' ? 'Hope Foundation' : 'John Doe'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {userType === 'organization' ? 'Admin' : 'Personal Account'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={handleCloseSidebar}
            onKeyDown={handleBackdropKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Close sidebar"
          />

          {/* Sidebar panel */}
          <aside className="fixed inset-y-0 left-0 w-64 ledger-sidebar flex flex-col">
            {/* Logo and close button */}
            <div className="flex items-center justify-between h-16 px-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center px-3">
                <img
                  src={theme === 'dark' ? PacioliBlackLogo : PacioliWhiteLogo}
                  alt="Pacioli"
                  className="h-12 w-auto mix-blend-multiply dark:mix-blend-normal"
                />
                <div className="ml-3 flex flex-col">
                  <span className="font-serif font-bold text-gray-900 dark:text-white" style={{ fontSize: '24px', letterSpacing: '0.5px', color: '#7c3626' }}>
                    Pacioli
                  </span>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Books & Ledgers
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseSidebar}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <ul className="space-y-1">
                {navItems.map(item => {
                  const isActive =
                    location.pathname === item.href ||
                    item.subItems?.some(
                      sub => location.pathname + location.search === sub.href
                    )

                  return (
                    <li key={item.name}>
                      {item.subItems ? (
                        <button
                          onClick={createToggleExpandedHandler(item.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-[#7c3626]/10 text-[#7c3626]'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <item.icon className="w-5 h-5 mr-3" />
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {item.badge && (
                              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#c14040] dark:bg-[#d45050] rounded-full">
                                {item.badge}
                              </span>
                            )}
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                expandedItems.includes(item.name)
                                  ? 'transform rotate-180'
                                  : ''
                              }`}
                            />
                          </div>
                        </button>
                      ) : (
                        <Link
                          to={item.href}
                          onClick={handleCloseSidebar}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-[#7c3626]/10 text-[#7c3626]'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <item.icon className="w-5 h-5 mr-3" />
                            <span>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#c14040] dark:bg-[#d45050] rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )}

                      {item.subItems && expandedItems.includes(item.name) && (
                        <ul className="mt-1 ml-8 space-y-1">
                          {item.subItems.map(subItem => {
                            const isSubActive =
                              location.pathname + location.search ===
                              subItem.href
                            return (
                              <li key={subItem.name}>
                                <Link
                                  to={subItem.href}
                                  onClick={handleCloseSidebar}
                                  className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                    isSubActive
                                      ? 'text-[#7c3626] bg-[#7c3626]/10'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {subItem.name}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* User section */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center">
                {userType === 'organization' && organizationLogo ? (
                  <img
                    src={organizationLogo}
                    alt="Organization"
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {userType === 'organization'
                      ? 'Hope Foundation'
                      : 'John Doe'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userType === 'organization' ? 'Admin' : 'Personal Account'}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 ledger-topbar">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              onClick={handleOpenSidebar}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search transactions, wallets, or reports..."
                  className="ledger-search w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <button
                onClick={handleOpenNotifications}
                className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#c14040] dark:bg-[#d45050] rounded-full"></span>
              </button>

              {/* Help */}
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <HelpCircle className="w-6 h-6" />
              </button>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <Moon className="w-6 h-6" />
                ) : (
                  <Sun className="w-6 h-6" />
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={handleToggleUserMenu}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="User"
                      className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300 hidden sm:block" />
                </button>

                {/* User dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-black rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {userType === 'organization'
                          ? 'Hope Foundation'
                          : 'John Doe'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {userType === 'organization'
                          ? 'admin@hopefoundation.org'
                          : 'john.doe@email.com'}
                      </p>
                    </div>
                    <Link
                      to="/profile"
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                    >
                      <User className="w-4 h-4 mr-3" />
                      Your Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      Settings
                    </Link>
                    <Link
                      to="/support"
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                    >
                      <HelpCircle className="w-4 h-4 mr-3" />
                      Help & Support
                    </Link>
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-1"></div>
                    <button className="w-full px-4 py-2 text-sm text-left text-[#c14040] dark:text-[#d45050] hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={notificationsOpen}
        onClose={handleCloseNotifications}
        userType={userType}
      />
    </div>
  )
}

export default Navigation
