/**
 * Protected Route Component
 * Wraps routes that require authentication
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type Permission } from '../../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: Permission
  fallback?: React.ReactNode
}

/**
 * Loading screen shown while auth state is being determined
 */
const LoadingScreen: React.FC = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

/**
 * Access denied screen when user lacks required permission
 */
const AccessDenied: React.FC<{ permission: Permission }> = ({ permission }) => {
  const { currentProfileRole } = useAuth()

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="max-w-md text-muted-foreground">
          You don&apos;t have permission to access this page.
          {currentProfileRole && (
            <span className="block mt-1">
              Your current role ({currentProfileRole}) doesn&apos;t include the
              &quot;{permission}&quot; permission.
            </span>
          )}
        </p>
        <a href="/" className="text-primary hover:underline">
          Return to Dashboard
        </a>
      </div>
    </div>
  )
}

/**
 * ProtectedRoute - Guards routes that require authentication
 *
 * Usage:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   } />
 *
 *   // With permission requirement
 *   <Route path="/admin" element={
 *     <ProtectedRoute requiredPermission="manage_users">
 *       <AdminPanel />
 *     </ProtectedRoute>
 *   } />
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  fallback,
}) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth()
  const location = useLocation()

  // Show loading state while checking auth
  if (isLoading) {
    return fallback ?? <LoadingScreen />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Save the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDenied permission={requiredPermission} />
  }

  return children
}

export default ProtectedRoute
