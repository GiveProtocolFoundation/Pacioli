import React, { useState, useCallback } from 'react'
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
} from 'lucide-react'

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

// Mock data for users
const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.org',
    role: {
      id: 'admin',
      name: 'Administrator',
      description: 'Full access to all features and settings',
      permissions: [],
      isCustom: false,
    },
    status: 'active',
    lastLogin: '2025-10-17T10:30:00Z',
    twoFactorEnabled: true,
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.org',
    role: {
      id: 'accountant',
      name: 'Accountant',
      description: 'Manage transactions and financial records',
      permissions: [],
      isCustom: false,
    },
    status: 'active',
    lastLogin: '2025-10-16T15:45:00Z',
    twoFactorEnabled: true,
  },
  {
    id: '3',
    name: 'Michael Chen',
    email: 'michael.chen@example.org',
    role: {
      id: 'auditor',
      name: 'Auditor',
      description: 'Read-only access with audit logs',
      permissions: [],
      isCustom: false,
    },
    status: 'active',
    lastLogin: '2025-10-15T09:20:00Z',
    twoFactorEnabled: false,
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.davis@example.org',
    role: {
      id: 'viewer',
      name: 'Viewer',
      description: 'View-only access to reports and dashboards',
      permissions: [],
      isCustom: false,
    },
    status: 'inactive',
    lastLogin: '2025-09-28T14:10:00Z',
    twoFactorEnabled: false,
  },
  {
    id: '5',
    name: 'David Martinez',
    email: 'david.martinez@example.org',
    role: {
      id: 'accountant',
      name: 'Accountant',
      description: 'Manage transactions and financial records',
      permissions: [],
      isCustom: false,
    },
    status: 'pending',
    lastLogin: null,
    twoFactorEnabled: false,
  },
]

// Predefined roles
const mockRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all features and settings',
    isCustom: false,
    permissions: [
      {
        module: 'Dashboard',
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
      {
        module: 'Transactions',
        view: true,
        create: true,
        edit: true,
        delete: true,
        approve: true,
      },
      { module: 'Wallets', view: true, create: true, edit: true, delete: true },
      { module: 'Reports', view: true, create: true, edit: true, delete: true },
      {
        module: 'Analytics',
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
      {
        module: 'Settings',
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
      { module: 'Users', view: true, create: true, edit: true, delete: true },
    ],
  },
  {
    id: 'accountant',
    name: 'Accountant',
    description: 'Manage transactions and financial records',
    isCustom: false,
    permissions: [
      {
        module: 'Dashboard',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Transactions',
        view: true,
        create: true,
        edit: true,
        delete: false,
        approve: true,
      },
      {
        module: 'Wallets',
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
      {
        module: 'Reports',
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
      {
        module: 'Analytics',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Settings',
        view: true,
        create: false,
        edit: true,
        delete: false,
      },
      {
        module: 'Users',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
    ],
  },
  {
    id: 'auditor',
    name: 'Auditor',
    description: 'Read-only access with audit logs',
    isCustom: false,
    permissions: [
      {
        module: 'Dashboard',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Transactions',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Wallets',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Reports',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Analytics',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Settings',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Users',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'View-only access to reports and dashboards',
    isCustom: false,
    permissions: [
      {
        module: 'Dashboard',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Transactions',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Wallets',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Reports',
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Analytics',
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Settings',
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
      {
        module: 'Users',
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
    ],
  },
]

type ViewMode = 'users' | 'roles'

const UsersPermissions: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('users')
  const [users] = useState<User[]>(mockUsers)
  const [roles] = useState<Role[]>(mockRoles)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive' | 'pending'
  >('all')
  const [showInviteModal, setShowInviteModal] = useState(false)

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: User['status']) => {
    const styles = {
      active:
        'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
      inactive:
        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-[#94a3b8] border-gray-200 dark:border-gray-700',
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
  }
  const formatLastLogin = (date: string | null) => {
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
  }

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
    // TODO: Send invitation
    setShowInviteModal(false)
  }, [])

  // Extracted components to reduce nesting
  const UsersTable: React.FC<{
    filteredUsers: typeof filteredUsers
    formatLastLogin: typeof formatLastLogin
    getStatusBadge: typeof getStatusBadge
    searchQuery: string
    handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    statusFilter: typeof statusFilter
    handleStatusFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  }> = ({
    filteredUsers,
    formatLastLogin,
    getStatusBadge,
    searchQuery,
    handleSearchChange,
    statusFilter,
    handleStatusFilterChange,
  }) => (
    <>
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider">
                  2FA
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider">
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
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                          {user.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-[#94a3b8]">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {user.role.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                      {user.role.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(user.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#94a3b8]">
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

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No users found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#94a3b8]">
              Try adjusting your search or filters.
            </p>
          </div>
        )}
      </div>
    </>
  )

  const RolesView: React.FC<{ roles: typeof roles; users: typeof users }> = ({ roles, users }) => (
    <>
      {/* Roles View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map(role => (
          <div
            key={role.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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

            <p className="text-sm text-gray-500 dark:text-[#94a3b8] mb-4">
              {role.description}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Module
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 dark:text-[#94a3b8]">
                    View
                  </span>
                  <span className="text-gray-500 dark:text-[#94a3b8]">
                    Create
                  </span>
                  <span className="text-gray-500 dark:text-[#94a3b8]">
                    Edit
                  </span>
                  <span className="text-gray-500 dark:text-[#94a3b8]">
                    Delete
                  </span>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {role.permissions.map(permission => (
                  <div
                    key={permission.module}
                    className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800"
                  >
                    <span className="text-gray-700 dark:text-gray-300">
                      {permission.module}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="w-12 text-center">
                        {permission.view ? (
                          <Check className="w-3 h-3 inline text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-3 h-3 inline text-gray-300 dark:text-gray-600" />
                        )}
                      </span>
                      <span className="w-12 text-center">
                        {permission.create ? (
                          <Check className="w-3 h-3 inline text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-3 h-3 inline text-gray-300 dark:text-gray-600" />
                        )}
                      </span>
                      <span className="w-12 text-center">
                        {permission.edit ? (
                          <Check className="w-3 h-3 inline text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-3 h-3 inline text-gray-300 dark:text-gray-600" />
                        )}
                      </span>
                      <span className="w-12 text-center">
                        {permission.delete ? (
                          <Check className="w-3 h-3 inline text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-3 h-3 inline text-gray-300 dark:text-gray-600" />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#94a3b8]">
                <span>
                  {users.filter(u => u.role.id === role.id).length} users
                  assigned
                </span>
                {!role.isCustom && (
                  <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    View details
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Create Custom Role Card */}
        <button className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex flex-col items-center justify-center text-center min-h-[300px]">
          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Create Custom Role
          </h3>
          <p className="text-xs text-gray-500 dark:text-[#94a3b8]">
            Define custom permissions for specific needs
          </p>
        </button>
      </div>
      {/* Security Settings */}
      <div className="mt-8 border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900">
        <div className="flex items-center mb-4">
          <Lock className="w-5 h-5 text-blue-600 mr-2" />
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
              <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                Force all users to enable 2FA for enhanced security
              </div>
            </div>
            <label
              aria-label="Require Two-Factor Authentication"
              className="relative inline-flex items-center cursor-pointer"
            >
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Session Timeout
              </div>
              <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                Automatically log out inactive users
              </div>
            </div>
            <select className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <div className="text-xs text-gray-500 dark:text-[#94a3b8]">
                Restrict access to specific IP addresses
              </div>
            </div>
            <button className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
              Configure
            </button>
          </div>
        </div>
      </div>
    </>
  )

  const InviteUserModal: React.FC<{ roles: typeof roles; handleClose: () => void; handleSend: () => void }> = ({ roles, handleClose, handleSend }) => (
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="ml-3 text-xs text-blue-800 dark:text-blue-400">
                An invitation email will be sent to the user with
                instructions to set up their account.
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
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Invite
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Users & Permissions
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
            Manage user access and role-based permissions
          </p>
        </div>
        <button
          onClick={handleOpenInviteModal}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center"
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
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
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
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
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
        />
      ) : (
        <RolesView roles={roles} users={users} />
      )}

      {showInviteModal && (
        <InviteUserModal
          roles={roles}
          handleClose={handleCloseInviteModal}
          handleSend={handleSendInvite}
        />
      )}
    </div>
  )
}

export default UsersPermissions
