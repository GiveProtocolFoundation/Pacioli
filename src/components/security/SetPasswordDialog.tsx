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

  const handleCurrentPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentPassword(e.target.value)
    },
    []
  )

  const handleNewPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPassword(e.target.value)
    },
    []
  )

  const handleConfirmPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPassword(e.target.value)
    },
    []
  )

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

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
      default:
        return 'Password'
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
      default:
        return ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          role="presentation"
          onClick={onClose}
          onKeyDown={handleBackdropKeyDown}
        />

        <div className="relative bg-[#F7FAFA] dark:bg-[#11202B] rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
            {getTitle()}
          </h2>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mb-4">
            {getDescription()}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === 'change' || mode === 'remove') && (
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE]"
                >
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={handleCurrentPasswordChange}
                  disabled={isSubmitting}
                  className="mt-1 block w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2] sm:text-sm"
                />
              </div>
            )}

            {(mode === 'set' || mode === 'change') && (
              <>
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE]"
                  >
                    {mode === 'set' ? 'Password' : 'New Password'}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={handleNewPasswordChange}
                    disabled={isSubmitting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2] sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE]"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    disabled={isSubmitting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2] sm:text-sm"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-[#E8836F] dark:text-[#F09988]">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  mode === 'remove'
                    ? 'bg-[#E8836F] hover:bg-[#C56A57]'
                    : 'bg-[#294050] hover:bg-[#1E2F3C]'
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
