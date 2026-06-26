/**
 * Export Dialog
 * Dialog for exporting all data to an encrypted JSON file
 */

import React, { useState, useCallback, useEffect } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { storage, type ExportStats } from '../../services/storage'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Dialog component for exporting all data to an optionally encrypted JSON file.
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [usePassword, setUsePassword] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [stats, setStats] = useState<ExportStats | null>(null)

  // Load export stats when dialog opens
  useEffect(() => {
    if (isOpen) {
      storage
        .getExportStats()
        .then(setStats)
        .catch(err => console.error('Failed to get export stats:', err))
    } else {
      setPassword('')
      setConfirmPassword('')
      setError(null)
      setStats(null)
    }
  }, [isOpen])

  const handleExport = useCallback(async () => {
    setError(null)

    if (usePassword) {
      if (!password) {
        setError('Please enter a password')
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
    }

    try {
      setIsExporting(true)

      // Show save dialog
      const filePath = await save({
        defaultPath: `pacioli-export-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (!filePath) {
        return // User cancelled
      }

      await storage.exportData(filePath, usePassword ? password : undefined)

      onClose()
    } catch (err) {
      console.error('Export failed:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [password, confirmPassword, usePassword, onClose])

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
  )

  const handleUsePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUsePassword(e.target.checked)
    },
    []
  )

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value)
    },
    []
  )

  const handleConfirmPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPassword(e.target.value)
    },
    []
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={onClose}
          onKeyDown={handleBackdropKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Close dialog"
        />

        <div className="relative bg-[#F7FAFA] dark:bg-[#11202B] rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
            Export Data
          </h2>
          <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mb-4">
            Export all your data to a JSON file. You can optionally encrypt the
            export with a password.
          </p>

          {stats && (
            <div className="mb-4 p-3 bg-[#EAF3F2] dark:bg-[#16242F] rounded-md">
              <p className="text-sm text-[#11202B] dark:text-[#9FB4BE]">
                <strong>Data to export:</strong>
              </p>
              <ul className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
                <li>• {stats.profileCount} profile(s)</li>
                <li>• {stats.walletCount} wallet(s)</li>
                <li>• {stats.settingsCount} setting(s)</li>
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={handleUsePasswordChange}
                className="rounded border-[rgba(95,227,192,0.3)] text-[#294050] focus:ring-[#5FE3C0]"
              />
              <span className="text-sm text-[#11202B] dark:text-[#9FB4BE]">
                Encrypt export with password
              </span>
            </label>

            {usePassword && (
              <>
                <div>
                  <label
                    htmlFor="export-password"
                    className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE]"
                  >
                    Password
                  </label>
                  <input
                    id="export-password"
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isExporting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2] sm:text-sm"
                    placeholder="Enter password for encryption"
                  />
                </div>

                <div>
                  <label
                    htmlFor="export-confirm-password"
                    className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE]"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="export-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    disabled={isExporting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2] sm:text-sm"
                    placeholder="Confirm password"
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
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#294050] hover:bg-[#1E2F3C] rounded-md disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
