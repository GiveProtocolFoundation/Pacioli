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

        <div className="relative bg-[#fafaf8] dark:bg-[#1a1815] rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
            Export Data
          </h2>
          <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
            Export all your data to a JSON file. You can optionally encrypt the
            export with a password.
          </p>

          {stats && (
            <div className="mb-4 p-3 bg-[#f3f1ed] dark:bg-[#2a2620] rounded-md">
              <p className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                <strong>Data to export:</strong>
              </p>
              <ul className="mt-1 text-sm text-[#696557] dark:text-[#b8b3ac]">
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
                className="rounded border-[rgba(201,169,97,0.3)] text-[#8b4e52] focus:ring-[#c9a961]"
              />
              <span className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                Encrypt export with password
              </span>
            </label>

            {usePassword && (
              <>
                <div>
                  <label
                    htmlFor="export-password"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]"
                  >
                    Password
                  </label>
                  <input
                    id="export-password"
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isExporting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] sm:text-sm"
                    placeholder="Enter password for encryption"
                  />
                </div>

                <div>
                  <label
                    htmlFor="export-confirm-password"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="export-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    disabled={isExporting}
                    className="mt-1 block w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] sm:text-sm"
                    placeholder="Confirm password"
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
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#8b4e52] hover:bg-[#7a4248] rounded-md disabled:opacity-50"
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
