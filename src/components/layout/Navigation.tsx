import React, { useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  Wallet,
  BarChart3,
  Bell,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  HelpCircle,
  MessageCircle,
  Moon,
  Sun,
  Building2,
  BookOpen,
  Scale,
  CalendarDays,
} from 'lucide-react'
import PacioliWhiteLogo from '../../assets/Pacioli_logo_white.svg'
import PacioliBlackLogo from '../../assets/pacioli_logo_black.svg'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrganization } from '../../contexts/OrganizationContext'
import { useTransactions } from '../../contexts/TransactionContext'
import { useAuth } from '../../contexts/AuthContext'
import NotificationsPanel from '../notifications/NotificationsPanel'
import { useUnreadCount } from '../../contexts/NotificationContext'
import { useNavBadges } from '../../contexts/NavBadgeContext'

interface NavigationProps {
  children: React.ReactNode
  userType?: 'individual' | 'organization'
}

interface SubItem {
  name: string
  href: string
  badge?: number
}

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: number
  subItems?: SubItem[]
}

/**
 * Renders a list of sub-navigation items.
 * @param subItems - Array of sub-navigation items to display.
 * @param location - Current location from React Router.
 * @param onLinkClick - Optional callback invoked when a link is clicked.
 */
const SubNavItems: React.FC<{
  subItems: SubItem[]
  expandedItems: string[]
  location: ReturnType<typeof useLocation>
  onLinkClick?: () => void
}> = ({ subItems, location, onLinkClick }) => (
  <ul className="mt-1 ml-8 space-y-1">
    {subItems.map(subItem => {
      const isSubActive = location.pathname + location.search === subItem.href
      return (
        <li key={subItem.name}>
          <Link
            to={subItem.href}
            onClick={onLinkClick}
            className={`flex items-center justify-between w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
              isSubActive
                ? 'text-[#294050] dark:text-[#EAF3F2] bg-[rgba(41,64,80,0.1)] dark:bg-[rgba(41,64,80,0.15)] font-medium'
                : 'text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] dark:hover:text-[#9FB4BE] font-normal'
            }`}
          >
            <span>{subItem.name}</span>
            {subItem.badge != null && subItem.badge > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-[10px] px-1.5 py-px text-[11px] font-medium leading-none"
                style={{ backgroundColor: '#5FE3C0', color: '#0C141B' }}
              >
                {subItem.badge}
              </span>
            )}
          </Link>
        </li>
      )
    })}
  </ul>
)

/**
 * Renders a list of navigation items, supporting desktop and mobile variants.
 * @param navItems - Array of navigation items to display.
 * @param expandedItems - Array of names of expanded navigation items.
 * @param location - Current location from React Router.
 * @param variant - View variant, either 'desktop' or 'mobile'.
 * @param onToggleExpanded - Callback to toggle expansion of a navigation item.
 * @param onLinkClick - Optional callback invoked when a link is clicked.
 */
const NavItemList: React.FC<{
  navItems: NavItem[]
  expandedItems: string[]
  location: ReturnType<typeof useLocation>
  variant: 'desktop' | 'mobile'
  onToggleExpanded: (itemName: string) => () => void
  onLinkClick?: () => void
}> = ({
  navItems,
  expandedItems,
  location,
  variant,
  onToggleExpanded,
  onLinkClick,
}) => {
  const isDesktop = variant === 'desktop'

  /**
   * Returns the CSS class string for a navigation button based on its active state and view variant.
   * @param isActive - Indicates whether the button is in the active state.
   * @returns A string of CSS classes.
   */
  const getButtonClass = (isActive: boolean) => {
    const base = isDesktop
      ? 'w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors'
      : 'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors'
    const active = isDesktop
      ? 'bg-[rgba(41,64,80,0.1)] dark:bg-[rgba(41,64,80,0.15)] text-[#294050] dark:text-[#EAF3F2] font-semibold border-l-[3px] border-[#294050] dark:border-[#294050] -ml-0.5'
      : 'bg-[rgba(41,64,80,0.1)] text-[#294050] dark:text-[#294050]'
    const inactive = isDesktop
      ? 'text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] dark:hover:text-[#9FB4BE] font-medium'
      : 'text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)]'
    return `${base} ${isActive ? active : inactive}`
  }

  /**
   * Returns the CSS class string for a navigation link based on its active state and view variant.
   * @param isActive - Indicates whether the link is in the active state.
   * @returns A string of CSS classes.
   */
  const getLinkClass = (isActive: boolean) => {
    const base = isDesktop
      ? 'w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors'
      : 'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors'
    const active = isDesktop
      ? 'bg-[rgba(41,64,80,0.1)] dark:bg-[rgba(41,64,80,0.15)] text-[#294050] dark:text-[#EAF3F2] font-semibold border-l-[3px] border-[#294050] dark:border-[#294050] -ml-0.5'
      : 'bg-[rgba(41,64,80,0.1)] text-[#294050] dark:text-[#294050]'
    const inactive = isDesktop
      ? 'text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] dark:hover:text-[#9FB4BE] font-medium'
      : 'text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)]'
    return `${base} ${isActive ? active : inactive}`
  }

  const badgeClass = isDesktop
    ? 'inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#E8836F] dark:bg-[#E8836F] rounded-full'
    : 'inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#E8836F] rounded-full'

  return (
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
                onClick={onToggleExpanded(item.name)}
                className={getButtonClass(Boolean(isActive))}
              >
                <div className="flex items-center">
                  <item.icon className="w-5 h-5 mr-3" />
                  <span>{item.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {item.badge && (
                    <span className={badgeClass}>{item.badge}</span>
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
                onClick={onLinkClick}
                className={getLinkClass(Boolean(isActive))}
              >
                <div className="flex items-center">
                  <item.icon className="w-5 h-5 mr-3" />
                  <span>{item.name}</span>
                </div>
                {item.badge && <span className={badgeClass}>{item.badge}</span>}
              </Link>
            )}

            {/* Sub-items */}
            {item.subItems && expandedItems.includes(item.name) && (
              <SubNavItems
                subItems={item.subItems}
                expandedItems={expandedItems}
                location={location}
                onLinkClick={onLinkClick}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Displays a user's avatar or organization logo.
 * @param {Object} props - Component props.
 * @param {string|null|undefined} props.userAvatar - URL of user's avatar image.
 * @param {string|null|undefined} [props.organizationLogo] - URL of organization logo.
 * @param {'individual'|'organization'} [props.userType] - Type of user.
 * @param {'sm'|'lg'} [props.size='lg'] - Size of the avatar.
 * @returns {JSX.Element} Avatar image or placeholder.
 */
const UserAvatar: React.FC<{
  userAvatar: string | null | undefined
  organizationLogo?: string | null | undefined
  userType?: 'individual' | 'organization'
  size?: 'sm' | 'lg'
}> = ({ userAvatar, organizationLogo, userType, size = 'lg' }) => {
  const isLarge = size === 'lg'
  const sizeClass = isLarge ? 'w-10 h-10' : 'w-8 h-8'
  const showImage = isLarge
    ? userAvatar || (userType === 'organization' && organizationLogo)
    : userAvatar
  const imgSrc = isLarge
    ? userAvatar || organizationLogo || ''
    : userAvatar || ''

  if (showImage) {
    return (
      <img
        src={imgSrc}
        alt="User"
        className={`${sizeClass} rounded-full object-cover border-2 border-[rgba(95,227,192,0.15)] dark:border-[rgba(95,227,192,0.15)]`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} bg-[#D9E5E4] dark:bg-[#16242F] rounded-full flex items-center justify-center`}
    >
      <User className="w-5 h-5 text-[#294050] dark:text-[#9FB4BE]" />
    </div>
  )
}

/**
 * Renders a dropdown menu for user actions.
 * @param {Object} props - Component props.
 * @param {string} props.displayName - Display name of the user.
 * @param {string} props.userEmail - Email address of the user.
 * @param {function} props.onLogout - Callback for logout action.
 * @returns {JSX.Element} Dropdown menu component.
 */
const UserMenuDropdown: React.FC<{
  displayName: string
  userEmail: string
  onLogout: () => void
}> = ({ displayName, userEmail, onLogout }) => (
  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#11202B] rounded-lg shadow-lg border border-[rgba(95,227,192,0.15)] dark:border-[rgba(95,227,192,0.15)] py-1">
    <div className="px-4 py-3 border-b border-[rgba(95,227,192,0.1)] dark:border-[rgba(95,227,192,0.1)]">
      <p className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
        {displayName}
      </p>
      <p className="text-xs text-[#647D8B] dark:text-[#647D8B] mt-1">
        {userEmail}
      </p>
    </div>
    <Link
      to="/profile"
      className="w-full px-4 py-2 text-sm text-left text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] flex items-center"
    >
      <User className="w-4 h-4 mr-3" />
      Your Profile
    </Link>
    <Link
      to="/settings"
      className="w-full px-4 py-2 text-sm text-left text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] flex items-center"
    >
      <Settings className="w-4 h-4 mr-3" />
      Settings
    </Link>
    <Link
      to="/support"
      className="w-full px-4 py-2 text-sm text-left text-[#294050] dark:text-[#9FB4BE] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] flex items-center"
    >
      <HelpCircle className="w-4 h-4 mr-3" />
      Help & Support
    </Link>
    <div className="border-t border-[rgba(95,227,192,0.1)] dark:border-[rgba(95,227,192,0.1)] mt-1" />
    <button
      onClick={onLogout}
      className="w-full px-4 py-2 text-sm text-left text-[#E8836F] dark:text-[#E8836F] hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)] flex items-center"
    >
      <LogOut className="w-4 h-4 mr-3" />
      Sign Out
    </button>
  </div>
)

/**
 * Renders the desktop sidebar navigation with user info and navigation items.
 * @param {Object} props - Component props.
 * @param {string} props.theme - Current theme.
 * @param {NavItem[]} props.navItems - List of navigation items.
 * @param {string[]} props.expandedItems - Currently expanded nav item names.
 * @param {ReturnType<typeof useLocation>} props.location - React Router location object.
 * @param {function} props.onToggleExpanded - Callback to toggle expanded nav items.
 * @param {string|null|undefined} props.userAvatar - URL of user's avatar.
 * @param {string|null|undefined} props.organizationLogo - URL of organization logo.
 * @param {'individual'|'organization'} props.userType - Type of the user.
 * @param {string} props.displayName - Display name of the user.
 * @param {string} props.userEmail - Email address of the user.
 * @returns {JSX.Element} Sidebar component.
 */
const DesktopSidebar: React.FC<{
  theme: string
  navItems: NavItem[]
  expandedItems: string[]
  location: ReturnType<typeof useLocation>
  onToggleExpanded: (itemName: string) => () => void
  userAvatar: string | null | undefined
  organizationLogo: string | null | undefined
  userType: 'individual' | 'organization'
  displayName: string
  userEmail: string
}> = ({
  theme,
  navItems,
  expandedItems,
  location,
  onToggleExpanded,
  userAvatar,
  organizationLogo,
  userType,
  displayName,
  userEmail,
}) => (
  <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 ledger-sidebar border-r border-[rgba(95,227,192,0.1)] dark:border-[rgba(95,227,192,0.1)]">
    {/* Logo */}
    <div className="flex items-center h-16 px-3 border-b border-[rgba(95,227,192,0.1)] dark:border-[rgba(95,227,192,0.1)]">
      <div className="flex items-center px-3">
        <img
          src={theme === 'dark' ? PacioliBlackLogo : PacioliWhiteLogo}
          alt="Pacioli"
          className="h-12 w-auto mix-blend-multiply dark:mix-blend-normal"
        />
        <div className="ml-3 flex flex-col">
          <span
            className="brand-wordmark text-[#11202B] dark:text-[#EAF3F2]"
            style={{ fontSize: '24px' }}
          >
            Pacioli
          </span>
          <span className="brand-tagline text-xs text-[#647D8B] dark:text-[#647D8B]">
            Books & Ledgers
          </span>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      <NavItemList
        navItems={navItems}
        expandedItems={expandedItems}
        location={location}
        variant="desktop"
        onToggleExpanded={onToggleExpanded}
      />
    </aside>
)

/**
 * MobileSidebar component renders a sidebar navigation for mobile view.
 * @param theme - Theme string for styling ('light' or 'dark').
 * @param navItems - Array of navigation items to display.
 * @param expandedItems - Array of item names that are currently expanded.
 * @param location - Location object from react-router's useLocation hook.
 * @param onToggleExpanded - Callback to toggle the expanded state of a navigation item.
 * @param onClose - Callback to close the sidebar.
 * @param onBackdropKeyDown - Keyboard event handler for backdrop keydown events.
 * @param userAvatar - URL or identifier for the user's avatar image.
 * @param organizationLogo - URL or identifier for the organization logo.
 * @param userType - User type, either 'individual' or 'organization'.
 * @param displayName - Display name of the user.
 * @param userEmail - Email of the user, if available.
 * @returns JSX.Element representing the mobile sidebar.
 */
const MobileSidebar: React.FC<{
  theme: string
  navItems: NavItem[]
  expandedItems: string[]
  location: ReturnType<typeof useLocation>
  onToggleExpanded: (itemName: string) => () => void
  onClose: () => void
  onBackdropKeyDown: (e: React.KeyboardEvent) => void
  userAvatar: string | null | undefined
  organizationLogo: string | null | undefined
  userType: 'individual' | 'organization'
  displayName: string
  userEmail: string
}> = ({
  theme,
  navItems,
  expandedItems,
  location,
  onToggleExpanded,
  onClose,
  onBackdropKeyDown,
  userAvatar,
  organizationLogo,
  userType,
  displayName,
  userEmail,
}) => (
  <div className="fixed inset-0 z-50 lg:hidden">
    {/* Backdrop */}
    <div
      className="fixed inset-0 bg-[#11202B] bg-opacity-75"
      onClick={onClose}
      onKeyDown={onBackdropKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close sidebar"
    />

    {/* Sidebar panel */}
    <aside className="fixed inset-y-0 left-0 w-64 ledger-sidebar flex flex-col">
      {/* Logo and close button */}
      <div className="flex items-center justify-between h-16 px-3 border-b border-[rgba(95,227,192,0.1)] dark:border-[rgba(95,227,192,0.1)]">
        <div className="flex items-center px-3">
          <img
            src={theme === 'dark' ? PacioliBlackLogo : PacioliWhiteLogo}
            alt="Pacioli"
            className="h-12 w-auto mix-blend-multiply dark:mix-blend-normal"
          />
          <div className="ml-3 flex flex-col">
            <span
              className="brand-wordmark text-[#11202B] dark:text-[#EAF3F2]"
              style={{ fontSize: '24px' }}
            >
              Pacioli
            </span>
            <span className="brand-tagline text-xs text-[#647D8B] dark:text-[#647D8B]">
              Books & Ledgers
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <NavItemList
          navItems={navItems}
          expandedItems={expandedItems}
          location={location}
          variant="mobile"
          onToggleExpanded={onToggleExpanded}
          onLinkClick={onClose}
        />
      </nav>
      {/* User section */}
      <div className="border-t border-[rgba(95,227,192,0.1)] dark:border-[rgba(95,227,192,0.1)] p-4">
        <div className="flex items-center">
          <UserAvatar
            userAvatar={userAvatar}
            organizationLogo={organizationLogo}
            userType={userType}
            size="lg"
          />
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
              {displayName}
            </p>
            <p className="text-xs text-[#647D8B] dark:text-[#647D8B]">
              {userEmail ||
                (userType === 'organization' ? 'Admin' : 'Personal Account')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  </div>
)

/**
 * TopBar component displays the application's top navigation bar, including user info, notifications, theme toggling, and logout.
 * @param {string} theme - The current theme ('light' or 'dark').
 * @param {string|null|undefined} userAvatar - URL of the user's avatar image, or null/undefined if not available.
 * @param {boolean} userMenuOpen - Indicates whether the user menu is open.
 * @param {string} displayName - The name of the currently logged-in user.
 * @param {string} userEmail - The email of the currently logged-in user.
 * @param {number} unreadNotificationCount - The number of unread notifications.
 * @param {() => void} onOpenSidebar - Callback to open the sidebar.
 * @param {() => void} onToggleUserMenu - Callback to toggle the user menu.
 * @param {() => void} onOpenNotifications - Callback to open the notifications panel.
 * @param {() => void} onToggleTheme - Callback to toggle between light and dark themes.
 * @param {() => void} onLogout - Callback to log out the user.
 * @returns {JSX.Element} The rendered TopBar component.
 */
const TopBar: React.FC<{
  theme: string
  userAvatar: string | null | undefined
  userMenuOpen: boolean
  displayName: string
  userEmail: string
  unreadNotificationCount: number
  onOpenSidebar: () => void
  onToggleUserMenu: () => void
  onOpenNotifications: () => void
  onToggleTheme: () => void
  onLogout: () => void
}> = ({
  theme,
  userAvatar,
  userMenuOpen,
  displayName,
  userEmail,
  unreadNotificationCount,
  onOpenSidebar,
  onToggleUserMenu,
  onOpenNotifications,
  onToggleTheme,
  onLogout,
}) => (
  <header className="sticky top-0 z-40 ledger-topbar">
    <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Search bar */}
      <div className="flex-1 max-w-2xl ml-1 mr-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search transactions, wallets, or reports..."
            className="ledger-search w-full pl-4 pr-4 py-2 text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] dark:placeholder-[#647D8B]"
          />
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center space-x-3">
        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]"
        >
          <Bell className="w-6 h-6" />
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#294050] dark:bg-[#294050] rounded-full text-white text-xs font-medium px-1">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Help */}
        <button className="p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]">
          <HelpCircle className="w-6 h-6" />
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE] transition-colors"
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
            onClick={onToggleUserMenu}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-[rgba(95,227,192,0.05)] dark:hover:bg-[rgba(95,227,192,0.08)]"
          >
            <UserAvatar userAvatar={userAvatar} size="sm" />
            <ChevronDown className="w-4 h-4 text-[#294050] dark:text-[#9FB4BE] hidden sm:block" />
          </button>

          {/* User dropdown menu */}
          {userMenuOpen && (
            <UserMenuDropdown
              displayName={displayName}
              userEmail={userEmail}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </div>
  </header>
)

/**
 * Main navigation component with sidebar, top bar, and notification panel.
 * Handles responsive layout for desktop and mobile views.
 */
const Navigation: React.FC<NavigationProps> = ({
  children,
  userType: userTypeProp,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { organizationLogo, userAvatar } = useOrganization()
  const { pendingApprovals } = useTransactions()
  const { user, logout, isBusinessAccount } = useAuth()
  const unreadNotificationCount = useUnreadCount()

  // Determine user type from auth context, fall back to prop for backwards compatibility
  const userType =
    userTypeProp ?? (isBusinessAccount ? 'organization' : 'individual')

  // Get display name from user data
  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.display_name || 'User'
  const userEmail = user?.email || ''

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [logout, navigate])

  const pendingCount = pendingApprovals.length
  const { unclassifiedTransactions, draftJournalEntries } = useNavBadges()

  // Navigation items for organizations/charities
  const organizationNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: Receipt,
      badge: pendingCount > 0 ? pendingCount : undefined,
      subItems: [
        { name: 'All', href: '/transactions?filter=all' },
        {
          name: 'Classify',
          href: '/classification',
          badge: unclassifiedTransactions,
        },
        { name: 'Classified', href: '/transactions?filter=classified' },
        { name: 'Ignored', href: '/transactions?filter=ignored' },
      ],
    },
    {
      name: 'Journal Entries',
      href: '/journal-entries',
      icon: BookOpen,
      subItems: [
        { name: 'All Entries', href: '/journal-entries?filter=all' },
        {
          name: 'Drafts',
          href: '/journal-entries?filter=draft',
          badge: draftJournalEntries,
        },
        { name: 'Posted', href: '/journal-entries?filter=posted' },
      ],
    },
    {
      name: 'Ledger',
      href: '/chart-of-accounts',
      icon: Scale,
      subItems: [
        { name: 'Chart of Accounts', href: '/chart-of-accounts' },
        { name: 'Trial Balance', href: '/trial-balance' },
        { name: 'Reconciliation', href: '/ledger/reconciliation' },
      ],
    },
    { name: 'Periods', href: '/accounting-periods', icon: CalendarDays },
    { name: 'Wallets', href: '/wallets', icon: Wallet },
    { name: 'Entities', href: '/entities', icon: Building2 },
    {
      name: 'Reports',
      href: '/reports',
      icon: FileText,
      subItems: [
        { name: 'Profit & Loss', href: '/reports/financial' },
        { name: 'Balance Sheet', href: '/reports/balance-sheet' },
        { name: 'Tax Reports', href: '/reports/tax' },
        { name: 'Donor Reports', href: '/reports/donors' },
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
        { name: 'General Settings', href: '/settings/general' },
        { name: 'Users & Permissions', href: '/settings/users' },
      ],
    },
  ]

  // Simplified navigation for individuals
  const individualNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: Receipt,
      badge: pendingCount > 0 ? pendingCount : undefined,
      subItems: [
        { name: 'All', href: '/transactions?filter=all' },
        {
          name: 'Classify',
          href: '/classification',
          badge: unclassifiedTransactions,
        },
        { name: 'Classified', href: '/transactions?filter=classified' },
        { name: 'Ignored', href: '/transactions?filter=ignored' },
      ],
    },
    {
      name: 'Journal Entries',
      href: '/journal-entries',
      icon: BookOpen,
      subItems: [
        { name: 'All Entries', href: '/journal-entries?filter=all' },
        {
          name: 'Drafts',
          href: '/journal-entries?filter=draft',
          badge: draftJournalEntries,
        },
        { name: 'Posted', href: '/journal-entries?filter=posted' },
      ],
    },
    {
      name: 'Ledger',
      href: '/chart-of-accounts',
      icon: Scale,
      subItems: [
        { name: 'Chart of Accounts', href: '/chart-of-accounts' },
        { name: 'Trial Balance', href: '/trial-balance' },
        { name: 'Reconciliation', href: '/ledger/reconciliation' },
      ],
    },
    { name: 'Periods', href: '/accounting-periods', icon: CalendarDays },
    { name: 'Wallets', href: '/wallets', icon: Wallet },
    { name: 'Entities', href: '/entities', icon: Building2 },
    { name: 'Tax Reports', href: '/reports', icon: FileText },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      subItems: [
        { name: 'Currencies', href: '/settings/currencies' },
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
    <div className="flex h-screen bg-[#F7FAFA] dark:bg-[#0C141B]">
      <DesktopSidebar
        theme={theme}
        navItems={navItems}
        expandedItems={expandedItems}
        location={location}
        onToggleExpanded={createToggleExpandedHandler}
        userAvatar={userAvatar}
        organizationLogo={organizationLogo}
        userType={userType}
        displayName={displayName}
        userEmail={userEmail}
      />

      {sidebarOpen && (
        <MobileSidebar
          theme={theme}
          navItems={navItems}
          expandedItems={expandedItems}
          location={location}
          onToggleExpanded={createToggleExpandedHandler}
          onClose={handleCloseSidebar}
          onBackdropKeyDown={handleBackdropKeyDown}
          userAvatar={userAvatar}
          organizationLogo={organizationLogo}
          userType={userType}
          displayName={displayName}
          userEmail={userEmail}
        />
      )}

      <div className="flex-1 lg:ml-64">
        <TopBar
          theme={theme}
          userAvatar={userAvatar}
          userMenuOpen={userMenuOpen}
          displayName={displayName}
          userEmail={userEmail}
          unreadNotificationCount={unreadNotificationCount}
          onOpenSidebar={handleOpenSidebar}
          onToggleUserMenu={handleToggleUserMenu}
          onOpenNotifications={handleOpenNotifications}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        />
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
