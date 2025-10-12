import React, { useState } from 'react'
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
} from 'lucide-react'
import NumbersWhiteLogo from '../../assets/Numbers_White.svg'

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
  const location = useLocation()

  // Navigation items for organizations/charities
  const organizationNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: Receipt,
      badge: 3,
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
        { name: 'Chart of Accounts', href: '/chart-of-accounts' },
        { name: 'General Settings', href: '/settings/general' },
        { name: 'Users & Permissions', href: '/settings/users' },
      ],
    },
  ]

  // Simplified navigation for individuals
  const individualNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: Receipt, badge: 2 },
    { name: 'Wallets', href: '/wallets', icon: Wallet },
    { name: 'Tax Reports', href: '/reports', icon: FileText },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      subItems: [
        { name: 'Chart of Accounts', href: '/chart-of-accounts' },
        { name: 'General Settings', href: '/settings/general' },
      ],
    },
  ]

  const navItems =
    userType === 'organization' ? organizationNavItems : individualNavItems

  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar for desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <img src={NumbersWhiteLogo} alt="Numbers" className="h-10 w-auto" />
            <div className="ml-3 flex flex-col">
              <span className="text-lg font-semibold text-gray-900">
                Numbers
              </span>
              <span className="text-xs text-gray-500">
                Accounting & Analytics
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
                      onClick={() => toggleExpanded(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {item.badge && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
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
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
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
                                  ? 'text-blue-600 bg-blue-50'
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

        {/* User section at bottom */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                {userType === 'organization' ? 'Hope Foundation' : 'John Doe'}
              </p>
              <p className="text-xs text-gray-500">
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
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar panel */}
          <aside className="fixed inset-y-0 left-0 w-64 bg-white flex flex-col">
            {/* Logo and close button */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
              <div className="flex items-center">
                <img
                  src={NumbersWhiteLogo}
                  alt="Numbers"
                  className="h-10 w-auto"
                />
                <div className="ml-3 flex flex-col">
                  <span className="text-lg font-semibold text-gray-900">
                    Numbers
                  </span>
                  <span className="text-xs text-gray-500">
                    Accounting & Analytics
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-600"
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
                          onClick={() => toggleExpanded(item.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <item.icon className="w-5 h-5 mr-3" />
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {item.badge && (
                              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
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
                          onClick={() => setSidebarOpen(false)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <item.icon className="w-5 h-5 mr-3" />
                            <span>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
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
                                  onClick={() => setSidebarOpen(false)}
                                  className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                    isSubActive
                                      ? 'text-blue-600 bg-blue-50'
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
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {userType === 'organization'
                      ? 'Hope Foundation'
                      : 'John Doe'}
                  </p>
                  <p className="text-xs text-gray-500">
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
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions, wallets, or reports..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-600">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Help */}
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <HelpCircle className="w-6 h-6" />
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
                </button>

                {/* User dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {userType === 'organization'
                          ? 'Hope Foundation'
                          : 'John Doe'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {userType === 'organization'
                          ? 'admin@hopefoundation.org'
                          : 'john.doe@email.com'}
                      </p>
                    </div>
                    <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center">
                      <User className="w-4 h-4 mr-3" />
                      Your Profile
                    </button>
                    <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center">
                      <Settings className="w-4 h-4 mr-3" />
                      Settings
                    </button>
                    <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center">
                      <HelpCircle className="w-4 h-4 mr-3" />
                      Help & Support
                    </button>
                    <div className="border-t border-gray-200 mt-1"></div>
                    <button className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-50 flex items-center">
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
    </div>
  )
}

export default Navigation
