import React, { useState, useCallback, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  Lock,
  Mail,
  MoreVertical,
  Check,
  X,
  Search,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { authService, withAutoRefresh } from '../../services/auth'
import type { ProfileUser } from '../../types/auth'

interface User {
  id: string
  name: string
  email: string
  role: Role
  status: 'active' | 'inactive' | 'pending'
  lastLogin: string | null
  twoFactorEnabled: boolean
}

interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  isCustom: boolean
}

interface Permission {
  module: string
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  approve?: boolean
}

// Props interfaces for extracted components
interface UsersTableProps {
  filteredUsers: User[]
  formatLastLogin: (date: string | null) => string
  getStatusBadge: (status: User['status']) => React.ReactNode
  searchQuery: string
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  statusFilter: 'all' | 'active' | 'inactive' | 'pending'
  handleStatusFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  isLoading: boolean
}

interface RolesViewProps {
  roles: Role[]
  users: User[]
}

/** Map auth UserRole to a display-friendly Role object */
function mapUserRoleToRole(role: string): Role {
  const roleDefinitions: Record<string, { name: string; description: string }> = {
    admin: { name: 'Administrator', description: 'Full access to all features and settings' },
    'system-admin': { name: 'System Administrator', description: 'Full system access including configuration' },
    preparer: { name: 'Preparer', description: 'Prepare and submit transactions for approval' },
    approver: { name: 'Approver', description: 'Review and approve submitted transactions' },
    user: { name: 'User', description: 'Standard access to view and manage records' },
  }

  const def = roleDefinitions[role] ?? { name: role, description: `${role} role` }

  return {
    id: role,
    name: def.name,
    description: def.description,
    permissions: [],
    isCustom: false,
  }
}

/** Map auth UserStatus to component status */
function mapUserStatus(status: string): 'active' | 'inactive' | 'pending' {
  switch (status) {
    case 'active':
      return 'active'
    case 'pending_verification':
      return 'pending'
    default:
      return 'inactive'
  }
}

/** Map a ProfileUser from the auth service to the component's User interface */
function mapProfileUserToUser(pu: ProfileUser): User {
  return {
    id: pu.user_id,
    name: pu.display_name || pu.email.split('@')[0],
    email: pu.email,
    role: mapUserRoleToRole(pu.role),
    status: mapUserStatus(pu.status),
    lastLogin: null, // Auth service does not provide lastLogin
    twoFactorEnabled: false, // Not available from current API
  }
}

/** Build deduplicated roles list from users */
function buildRolesFromUsers(users: User[]): Role[] {
  const seen = new Map<string, Role>()
  for (const u of users) {
    if (!seen.has(u.role.id)) {
      seen.set(u.role.id, u.role)
    }
  }
  return Array.from(seen.values())
}

type ViewMode = 'users' | 'roles'

const InviteUserModal: React.FC<{
  roles: Role[]
  handleClose: () => void
  handleSend: () => void
}> = ({ roles, handleClose, handleSend }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Invite User
        </h3>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="inviteEmail"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Email Address
          </label>
          <input
            id="inviteEmail"
            type="email"
            placeholder="user@example.org"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
          />
        </div>

        <div>
          <label
            htmlFor="inviteRole"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Role
          </label>
          <select
            id="inviteRole"
            className="select-input w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
          >
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 border border-[#5FE3C0]/30 dark:border-[#5FE3C0]/40 rounded-lg p-3">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-[#294050] dark:text-[#F09988] flex-shrink-0" />
            <p className="ml-3 text-xs text-[#294050] dark:text-[#F09988]">
              An invitation email will be sent to the user with instructions to
              set up their account.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#294050] rounded-lg hover:bg-[#1E2F3C] flex items-center justify-center"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Invite
          </button>
        </div>
      </div>
    </div>
  </div>
)

// Extracted UsersTable component to avoid recreation on every render
const UsersTable: React.FC<UsersTableProps> = ({
  filteredUsers,
  formatLastLogin,
  getStatusBadge,
  searchQuery,
  handleSearchChange,
  statusFilter,
  handleStatusFilterChange,
  isLoading,
}) => (
  <>
    {/* Search and Filters */}
    <div className="mb-6 flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
        />
      </div>
      <select
        value={statusFilter}
        onChange={handleStatusFilterChange}
        className="select-input px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="pending">Pending</option>
      </select>
    </div>

    {/* Users Table */}
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {isLoading ? (
        <div className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-gray-400 animate-spin" />
          <p className="mt-2 text-sm text-gray-500 dark:text-[#9FB4BE]">
            Loading users…
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#9FB4BE] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#9FB4BE] uppercase tracking-wider">
                  2FA
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-[#9FB4BE] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map(user => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-[#294050]/10 dark:bg-[#294050]/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-[#294050] dark:text-[#F09988]">
                          {user.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-[#9FB4BE]">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {user.role.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#9FB4BE]">
                      {user.role.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(user.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#9FB4BE]">
                    {formatLastLogin(user.lastLogin)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.twoFactorEnabled ? (
                      <span className="inline-flex items-center text-green-600 dark:text-green-400">
                        <Check className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-gray-400">
                        <X className="w-4 h-4" />
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && filteredUsers.length === 0 && (
        <div className="p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No users found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#9FB4BE]">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'No users have been added to this profile yet.'}
          </p>
        </div>
      )}
    </div>
  </>
)

// Extracted RolesView component to avoid recreation on every render
const RolesView: React.FC<RolesViewProps> = ({ roles, users }) => (
  <>
    {roles.length === 0 ? (
      <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No roles found
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-[#9FB4BE]">
          Roles will appear here once users are added to this profile.
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map(role => (
          <div
            key={role.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-lg bg-[#294050]/10 dark:bg-[#294050]/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#294050] dark:text-[#F09988]" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {role.name}
                  </h3>
                  {role.isCustom && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-800 mt-1">
                      Custom
                    </span>
                  )}
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-[#9FB4BE] mb-4">
              {role.description}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#9FB4BE]">
                <span>
                  {users.filter(u => u.role.id === role.id).length} users assigned
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Create Custom Role Card */}
        <button className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-[#294050] dark:hover:border-[#F09988] hover:bg-[#294050]/5 dark:hover:bg-[#294050]/10 transition-colors flex flex-col items-center justify-center text-center min-h-[200px]">
          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Create Custom Role
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#9FB4BE]">
            Define custom permissions for specific needs
          </p>
        </button>
      </div>
    )}

    {/* Security Settings */}
    <div className="mt-8 border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900">
      <div className="flex items-center mb-4">
        <Lock className="w-5 h-5 text-[#294050] mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Security Settings
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              Require Two-Factor Authentication
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9FB4BE]">
              Force all users to enable 2FA for enhanced security
            </div>
          </div>
          <label
            aria-label="Require Two-Factor Authentication"
            className="relative inline-flex items-center cursor-pointer"
          >
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#5FE3C0]/30 dark:peer-focus:ring-[#5FE3C0]/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#294050]" />
          </label>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              Session Timeout
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9FB4BE]">
              Automatically log out inactive users
            </div>
          </div>
          <select className="select-input px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]">
            <option>15 minutes</option>
            <option>30 minutes</option>
            <option>1 hour</option>
            <option>2 hours</option>
            <option>Never</option>
          </select>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              IP Whitelisting
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9FB4BE]">
              Restrict access to specific IP addresses
            </div>
          </div>
          <button className="px-3 py-1.5 text-sm font-medium text-[#294050] dark:text-[#F09988] hover:bg-[#294050]/5 dark:hover:bg-[#294050]/10 rounded-lg transition-colors">
            Configure
          </button>
        </div>
      </div>
    </div>
  </>
)

const UsersPermissions: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('users')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive' | 'pending'
  >('all')
  const [showInviteModal, setShowInviteModal] = useState(false)

  const { userProfiles } = useAuth()
  const currentProfileId =
    localStorage.getItem('currentProfileId') || userProfiles[0]?.profile_id

  // Load users from auth service
  useEffect(() => {
    let cancelled = false
    const loadUsers = async () => {
      if (!currentProfileId) {
        setUsers([])
        setIsLoading(false)
        return
      }
      try {
        setIsLoading(true)
        const profileUsers = await withAutoRefresh(token =>
          authService.getProfileUsers(token, currentProfileId)
        )
        if (!cancelled) {
          setUsers(profileUsers.map(mapProfileUserToUser))
        }
      } catch {
        // Auth service may not be available (dev mode / desktop) — show empty state
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadUsers()
    return () => {
      cancelled = true
    }
  }, [currentProfileId])

  // Derive roles from loaded users
  const roles = buildRolesFromUsers(users)

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = useCallback((status: User['status']) => {
    const styles = {
      active:
        'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
      inactive:
        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#9FB4BE] border-gray-200 dark:border-gray-700',
      pending:
        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }, [])

  const formatLastLogin = useCallback((date: string | null) => {
    if (!date) return 'Never'
    const loginDate = new Date(date)
    const now = new Date()
    const diffInHours = Math.floor(
      (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60)
    )

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    return loginDate.toLocaleDateString()
  }, [])

  const handleOpenInviteModal = useCallback(() => {
    setShowInviteModal(true)
  }, [])

  const handleCloseInviteModal = useCallback(() => {
    setShowInviteModal(false)
  }, [])

  const handleViewModeUsers = useCallback(() => {
    setViewMode('users')
  }, [])

  const handleViewModeRoles = useCallback(() => {
    setViewMode('roles')
  }, [])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    []
  )

  const handleStatusFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatusFilter(e.target.value as typeof statusFilter)
    },
    []
  )

  const handleSendInvite = useCallback(() => {
    setShowInviteModal(false)
  }, [])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Users & Permissions
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#9FB4BE] mt-1">
            Manage user access and role-based permissions
          </p>
        </div>
        <button
          onClick={handleOpenInviteModal}
          className="px-4 py-2 text-sm font-medium text-white bg-[#294050] rounded-lg hover:bg-[#1E2F3C] flex items-center justify-center"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1">
          <button
            onClick={handleViewModeUsers}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
              viewMode === 'users'
                ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988]'
                : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Users
          </button>
          <button
            onClick={handleViewModeRoles}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
              viewMode === 'roles'
                ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988]'
                : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 mr-2" />
            Roles
          </button>
        </div>
      </div>

      {viewMode === 'users' ? (
        <UsersTable
          filteredUsers={filteredUsers}
          formatLastLogin={formatLastLogin}
          getStatusBadge={getStatusBadge}
          searchQuery={searchQuery}
          handleSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          handleStatusFilterChange={handleStatusFilterChange}
          isLoading={isLoading}
        />
      ) : (
        <RolesView roles={roles} users={users} />
      )}

      {showInviteModal && (
        <InviteUserModal
          roles={roles.length > 0 ? roles : [mapUserRoleToRole('user')]}
          handleClose={handleCloseInviteModal}
          handleSend={handleSendInvite}
        />
      )}
    </div>
  )
}

export default UsersPermissions
