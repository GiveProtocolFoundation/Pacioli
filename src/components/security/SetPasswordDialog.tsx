/**
 * Set Password Dialog
 * Dialog for setting, changing, or removing the app password
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'

interface SetPasswordDialogProps {
  isOpen: boolean
  onClose: () => void
  mode: 'set' | 'change' | 'remove'
}

export const SetPasswordDialog: React.FC<SetPasswordDialogProps> = ({
  isOpen,
  onClose,
  mode,
}) => {
  const { setPassword, changePassword, removePassword, validatePassword } =
    useApp()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setIsSubmitting(true)

      try {
        if (mode === 'set') {
          if (!newPassword) {
            setError('Please enter a password')
            return
          }

          if (newPassword !== confirmPassword) {
            setError('Passwords do not match')
            return
          }

          const validationError = await validatePassword(newPassword)
          if (validationError) {
            setError(validationError)
            return
          }

          await setPassword(newPassword)
        } else if (mode === 'change') {
          if (!currentPassword) {
            setError('Please enter your current password')
            return
          }

          if (!newPassword) {
            setError('Please enter a new password')
            return
          }

          if (newPassword !== confirmPassword) {
            setError('New passwords do not match')
            return
          }

          const validationError = await validatePassword(newPassword)
          if (validationError) {
            setError(validationError)
            return
          }

          await changePassword(currentPassword, newPassword)
        } else if (mode === 'remove') {
          if (!currentPassword) {
            setError('Please enter your current password')
            return
          }

          await removePassword(currentPassword)
        }

        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      mode,
      currentPassword,
      newPassword,
      confirmPassword,
      setPassword,
      changePassword,
      removePassword,
      validatePassword,
      onClose,
    ]
  )

  if (!isOpen) return null

  const getTitle = () => {
    switch (mode) {
      case 'set':
        return 'Set Password'
      case 'change':
        return 'Change Password'
      case 'remove':
        return 'Remove Password'
    }
  }

  const getDescription = () => {
    switch (mode) {
      case 'set':
        return 'Set a password to protect your data. You will need to enter this password each time you open the app.'
      case 'change':
        return 'Enter your current password and choose a new one.'
      case 'remove':
        return 'Enter your current password to remove password protection. Your data will be accessible without a password.'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          role="presentation"
          onClick={onClose}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
          }}
        />

        <div className="relative bg-[#fafaf8] dark:bg-[#1a1815] rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
            {getTitle()}
          </h2>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
            {getDescription()}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === 'change' || mode === 'remove') && (
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]"
                >
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoFocus
                  disabled={isSubmitting}
                  className="mt-1 block w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] sm:text-sm"
                />
              </div>
            )}

            {(mode === 'set' || mode === 'change') && (
              <>
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]"
                  >
                    {mode === 'set' ? 'Password' : 'New Password'}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus={mode === 'set'}
                    disabled={isSubmitting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] sm:text-sm"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-[#9d6b6b] dark:text-[#b88585]">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  mode === 'remove'
                    ? 'bg-[#9d6b6b] hover:bg-[#8b5c5c]'
                    : 'bg-[#8b4e52] hover:bg-[#7a4248]'
                } disabled:opacity-50`}
              >
                {isSubmitting
                  ? 'Processing...'
                  : mode === 'remove'
                    ? 'Remove Password'
                    : mode === 'change'
                      ? 'Change Password'
                      : 'Set Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
