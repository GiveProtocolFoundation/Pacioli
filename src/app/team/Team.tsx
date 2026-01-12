import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Mail,
  Settings,
  Loader2,
  UserCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { authService, withAutoRefresh } from '../../services/auth'
import type { ProfileUser } from '../../types/auth'

// Role badge colors
const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'admin':
    case 'system-admin':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    case 'approver':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'preparer':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

// Format role name for display
const formatRoleName = (role: string): string => {
  return role
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface TeamMemberCardProps {
  member: ProfileUser
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ member }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {getInitials(member.display_name || member.email)}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {member.display_name || 'Unnamed User'}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}
            >
              {formatRoleName(member.role)}
            </span>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5 mt-3">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">{member.email}</span>
            </div>
          </div>

          {/* Status badge */}
          <div className="mt-3">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                member.status === 'active'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}
            >
              {member.status === 'active' ? 'Active' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const Team: React.FC = () => {
  const navigate = useNavigate()
  const { isBusinessAccount, userProfiles } = useAuth()
  const [members, setMembers] = useState<ProfileUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get the current profile ID
  const currentProfileId =
    localStorage.getItem('currentProfileId') || userProfiles[0]?.profile_id

  // Load team members
  const loadMembers = useCallback(async () => {
    if (!currentProfileId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const profileUsers = await withAutoRefresh(token =>
        authService.getProfileUsers(token, currentProfileId)
      )
      setMembers(profileUsers)
    } catch (err) {
      console.error('[Team] Failed to load team members:', err)
      setError('Failed to load team members')
    } finally {
      setIsLoading(false)
    }
  }, [currentProfileId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // Redirect individual users
  useEffect(() => {
    if (!isBusinessAccount && !isLoading) {
      navigate('/dashboard')
    }
  }, [isBusinessAccount, isLoading, navigate])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading team...</span>
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
              <h1>Team Directory</h1>
              <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-1">
                View your organization&apos;s team members
              </p>
            </div>
            <Link
              to="/settings/users"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Team
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {members.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <UserCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No team members yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Invite team members to collaborate on your organization&apos;s finances.
            </p>
            <Link
              to="/settings/users"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Users className="w-4 h-4 mr-2" />
              Invite Team Members
            </Link>
          </div>
        )}

        {/* Team member grid */}
        {members.length > 0 && (
          <>
            <div className="mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {members.length} team member{members.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(member => (
                <TeamMemberCard key={member.user_id} member={member} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Team
